/**
 * Spark API 服务
 * 
 * 实现策略：使用 Spark 官方 Web API 获取性能数据
 * 
 * 工作流程：
 * 1. 通过 RCON 执行 `spark health --upload` 命令
 * 2. 从命令输出中提取上传的 URL（格式：https://spark.lucko.me/xxxxx）
 * 3. 使用 URL + ?raw=1 参数获取 JSON 格式的原始数据
 * 4. 解析 JSON 数据并转换为应用所需格式
 * 
 * 数据源：https://spark.lucko.me/docs/misc/Raw-spark-data
 * 
 * JSON 响应结构（基于 HealthData protobuf）：
 * {
 *   "type": "health",
 *   "metadata": {
 *     "platformStatistics": {
 *       "tps": { "last1m": 20.0, "last5m": 20.0, "last15m": 20.0 },
 *       "mspt": {
 *         "last1m": { "median": 5.2, "percentile95": 8.1, "min": 2.1, "max": 12.3 }
 *       }
 *     },
 *     "systemStatistics": {
 *       "cpu": {
 *         "processUsage": { "last1m": 15.2, "last15m": 12.8 },
 *         "systemUsage": { "last1m": 45.6, "last15m": 42.1 }
 *       },
 *       "memory": {
 *         "physical": { "used": 2048000000, "total": 8192000000 }
 *       },
 *       "disk": { "used": 50000000000, "total": 100000000000 }
 *     }
 *   }
 * }
 */

import axios from 'axios';
import * as fs from 'fs';
import * as readline from 'readline';
import type {
  SparkHealthReport,
  SparkTPSStats,
  SparkMSPTStats,
  SparkCPUStats,
  SparkMemoryStats,
  SparkDiskStats,
  SparkConfig,
} from '../types';
import { createLogger } from '../utils/logger';
import { loadConfig } from '../config';
import { rconService, type RconService } from './rcon.service';

const logger = createLogger('SparkService');
const appConfig = loadConfig();

/**
 * 缓存条目
 */
interface CacheEntry {
  data: SparkHealthReport;
  timestamp: number;
}

/**
 * Spark API 原始响应格式（基于 protobuf schema）
 */
interface SparkApiResponse {
  type: 'health' | 'sampler' | 'heap';
  metadata: {
    platformStatistics?: {
      tps?: {
        last1m?: number;
        last5m?: number;
        last15m?: number;
      };
      mspt?: {
        last1m?: {
          mean?: number;
          median?: number;
          min?: number;
          max?: number;
          percentile95?: number;
        };
        last5m?: {
          mean?: number;
          median?: number;
          min?: number;
          max?: number;
          percentile95?: number;
        };
      };
      memory?: {
        heap?: {
          used?: number;
          committed?: number;
          max?: number;
        };
      };
    };
    systemStatistics?: {
      cpu?: {
        processUsage?: {
          last1m?: number;
          last15m?: number;
        };
        systemUsage?: {
          last1m?: number;
          last15m?: number;
        };
      };
      memory?: {
        physical?: {
          used?: number;
          total?: number;
        };
      };
      disk?: {
        used?: number;
        total?: number;
      };
    };
  };
}

export class SparkService {
  private config: SparkConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private logFilePath: string = '';

  constructor(
    private rcon: RconService = rconService
  ) {
    this.config = appConfig.spark;
  }

  /**
   * 设置日志文件路径
   * 在使用前必须先设置
   */
  setLogPath(logPath: string): void {
    this.logFilePath = logPath;
    logger.debug(`设置日志文件路径: ${logPath}`);
  }

  // ============ 公开 API ============

  /**
   * 获取服务器健康报告
   * 使用 Spark Web API 方式
   */
  async getHealth(serverId: string): Promise<SparkHealthReport | null> {
    // 检查缓存
    const cached = this.getFromCache(serverId);
    if (cached) {
      logger.debug(`使用缓存的健康报告 [${serverId}]`);
      return cached;
    }

    // 通过 Web API 获取数据
    const result = await this.getHealthViaWebApi(serverId);
    if (result) {
      this.setCache(serverId, result);
      return result;
    }

    logger.error(`获取健康报告失败 [${serverId}]`);
    return null;
  }

  /**
   * 获取 TPS 数据
   */
  async getTPS(serverId: string): Promise<SparkTPSStats | null> {
    const health = await this.getHealth(serverId);
    return health ? health.tps : null;
  }

  // ============ Web API 实现 ============

  /**
   * 通过 Web API 获取健康报告
   * 
   * 新策略：
   * 1. 执行 RCON 命令 `spark health --upload`
   * 2. 等待命令执行完成
   * 3. 直接读取日志文件最后 N 行，搜索 URL
   */
  private async getHealthViaWebApi(serverId: string): Promise<SparkHealthReport | null> {
    try {
      // 检查日志文件路径是否已设置
      if (!this.logFilePath) {
        logger.error('日志文件路径未设置，请先调用 setLogPath()');
        return null;
      }

      // 1. 执行 spark health --upload 命令
      logger.info(`执行 spark health --upload 命令 [${serverId}]`);
      
      const uploadResult = await this.rcon.send(serverId, 'spark health --upload');
      
      if (!uploadResult.success) {
        logger.error(`执行命令失败: ${uploadResult.response}`);
        return null;
      }

      logger.debug('命令已发送，等待输出写入日志...');

      // 2. 等待一段时间让命令完成并写入日志
      await this.sleep(2000);

      // 3. 从日志文件中提取 URL
      const reportUrl = await this.extractUrlFromLog();
      if (!reportUrl) {
        logger.error('未能从日志中获取报告 URL');
        logger.info('请确认：');
        logger.info('  1. Spark 插件已正确安装');
        logger.info('  2. 日志文件路径正确');
        logger.info('  3. 网络可访问 spark.lucko.me');
        return null;
      }

      logger.info(`获取到报告 URL: ${reportUrl}`);

      // 4. 获取 JSON 数据
      const jsonData = await this.fetchHealthReportJson(reportUrl);
      if (!jsonData) {
        logger.error('获取 JSON 数据失败');
        return null;
      }

      // 5. 解析并转换数据
      const healthReport = this.parseApiResponse(jsonData);
      if (!healthReport) {
        logger.error('解析 API 响应失败');
        return null;
      }

      logger.info(`成功获取健康报告 [${serverId}]`);
      return healthReport;
    } catch (error) {
      logger.error('Web API 方案异常', error);
      return null;
    }
  }

  /**
   * 从日志文件中提取 Spark URL
   * 读取最后 N 行并搜索 URL
   */
  private async extractUrlFromLog(): Promise<string | null> {
    try {
      const lines = await this.readLastLines(this.logFilePath, 50);
      
      // 从后往前查找 URL（最新的在最后）
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        
        if (!line) continue;
        
        // 检查是否是 Spark 线程输出
        if (!line.includes('spark-worker-pool')) {
          continue;
        }
        
        // 检查是否包含 URL
        const urlMatch = line.match(/https?:\/\/spark\.lucko\.me\/([a-zA-Z0-9]+)/);
        if (urlMatch) {
          logger.debug(`在日志第 ${i + 1} 行找到 URL: ${urlMatch[0]}`);
          return urlMatch[0];
        }
      }
      
      logger.warn('未在最近 50 行日志中找到 Spark URL');
      return null;
    } catch (error) {
      logger.error('读取日志文件失败', error);
      return null;
    }
  }

  /**
   * 读取文件的最后 N 行
   */
  private async readLastLines(filePath: string, lineCount: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
      });
      
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });
      
      rl.on('line', (line) => {
        lines.push(line);
        // 只保留最后 N 行
        if (lines.length > lineCount) {
          lines.shift();
        }
      });
      
      rl.on('close', () => {
        resolve(lines);
      });
      
      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 从 spark 输出中提取报告 URL
   * 
   * 示例输出：
   * "Health report: https://spark.lucko.me/abc123"
   * 或直接返回 URL
   */
  private extractReportUrl(output: string): string | null {
    // 清理颜色代码
    const cleaned = this.cleanColorCodes(output);
    
    // 匹配 spark.lucko.me URL
    const urlMatch = cleaned.match(/https?:\/\/spark\.lucko\.me\/([a-zA-Z0-9]+)/);
    return urlMatch ? urlMatch[0] : null;
  }

  /**
   * 通过 URL 获取 health report JSON
   * 
   * @param reportUrl - Spark 报告 URL（例如：https://spark.lucko.me/abc123）
   * @returns 解析后的 JSON 数据
   */
  private async fetchHealthReportJson(reportUrl: string): Promise<SparkApiResponse | null> {
    try {
      // 添加 ?raw=1 参数获取 JSON 格式数据
      const jsonUrl = `${reportUrl}?raw=1`;
      
      logger.debug(`请求 JSON 数据: ${jsonUrl}`);
      
      const response = await axios.get<SparkApiResponse>(jsonUrl, {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'mcservermanager-backend/1.0',
        },
      });

      if (response.data && response.data.type === 'health') {
        logger.debug('成功获取 health 数据');
        return response.data;
      }

      logger.warn(`意外的响应类型: ${response.data?.type}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`HTTP 请求失败: ${error.message}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
      } else {
        logger.error('获取报告 JSON 失败', error);
      }
      return null;
    }
  }

  /**
   * 解析 Spark API 响应并转换为应用格式
   * 
   * 根据 protobuf schema 解析数据结构
   */
  private parseApiResponse(data: SparkApiResponse): SparkHealthReport | null {
    try {
      const metadata = data.metadata;
      if (!metadata) {
        logger.warn('metadata 为空');
        return null;
      }

      const platformStats = metadata.platformStatistics || {};
      const systemStats = metadata.systemStatistics || {};

      // 解析 TPS（来自 platformStatistics）
      const tpsData = platformStats.tps || {};
      const tps: SparkTPSStats = {
        last5s: 20, // API 不提供 5s/10s 数据，使用默认值
        last10s: 20,
        last1m: this.extractNumber(tpsData.last1m, 20),
        last5m: this.extractNumber(tpsData.last5m, 20),
        last15m: this.extractNumber(tpsData.last15m, 20),
      };

      // 解析 MSPT（来自 platformStatistics，使用 last1m 数据）
      const msptData = platformStats.mspt?.last1m || {};
      const mspt: SparkMSPTStats = {
        min: this.extractNumber(msptData.min, 0),
        median: this.extractNumber(msptData.median, 0),
        percentile95: this.extractNumber(msptData.percentile95, 0),
        max: this.extractNumber(msptData.max, 0),
      };

      // 解析 CPU（来自 systemStatistics）
      const cpuData = systemStats.cpu || {};
      const processUsage = cpuData.processUsage || {};
      const systemUsage = cpuData.systemUsage || {};
      
      const cpu: SparkCPUStats = {
        process: {
          last10s: 0, // API 不提供 10s 数据
          last1m: this.extractNumber(processUsage.last1m, 0),
          last15m: this.extractNumber(processUsage.last15m, 0),
        },
        system: {
          last10s: 0, // API 不提供 10s 数据
          last1m: this.extractNumber(systemUsage.last1m, 0),
          last15m: this.extractNumber(systemUsage.last15m, 0),
        },
      };

      // 解析内存（来自 systemStatistics.memory.physical）
      // 注意：physical memory 以字节为单位，需要转换为 MB
      const memoryData = systemStats.memory?.physical || {};
      const physicalUsedBytes = this.extractNumber(memoryData.used, 0);
      const physicalTotalBytes = this.extractNumber(memoryData.total, 0);
      
      // 也可以使用 platformStatistics.memory.heap 数据（JVM heap）
      const heapData = platformStats.memory?.heap || {};
      const heapUsedBytes = this.extractNumber(heapData.used, 0);
      const heapMaxBytes = this.extractNumber(heapData.max, 0);
      
      // 优先使用 heap 数据（更准确），如果没有则使用 physical
      const useHeap = heapUsedBytes > 0;
      const memory: SparkMemoryStats = {
        used: Math.round((useHeap ? heapUsedBytes : physicalUsedBytes) / 1024 / 1024),
        allocated: Math.round((useHeap ? heapUsedBytes : physicalUsedBytes) / 1024 / 1024),
        max: Math.round((useHeap ? heapMaxBytes : physicalTotalBytes) / 1024 / 1024),
      };

      // 解析磁盘（来自 systemStatistics.disk）
      // 磁盘数据以字节为单位，需要转换为 GB
      const diskData = systemStats.disk;
      let disk: SparkDiskStats | undefined;
      
      if (diskData && (diskData.used !== undefined || diskData.total !== undefined)) {
        const diskUsedBytes = this.extractNumber(diskData.used, 0);
        const diskTotalBytes = this.extractNumber(diskData.total, 0);
        
        disk = {
          used: Math.round(diskUsedBytes / 1024 / 1024 / 1024 * 100) / 100,
          total: Math.round(diskTotalBytes / 1024 / 1024 / 1024 * 100) / 100,
        };
      }

      const result: SparkHealthReport = {
        tps,
        mspt,
        cpu,
        memory,
        timestamp: Date.now(),
      };

      if (disk) {
        result.disk = disk;
      }

      return result;
    } catch (error) {
      logger.error('解析 API 响应异常', error);
      return null;
    }
  }

  // ============ 工具方法 ============

  /**
   * 清理 Minecraft 颜色代码
   * 移除 § 符号和 ANSI 转义序列
   */
  private cleanColorCodes(text: string): string {
    // 移除 § 颜色代码（Minecraft 格式）
    let cleaned = text.replace(/§[0-9a-fk-or]/gi, '');
    // 移除 ANSI 转义序列
    cleaned = cleaned.replace(/\u001b\[[0-9;]*m/g, '');
    // 移除其他控制字符
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F]/g, '');
    return cleaned.trim();
  }

  /**
   * 安全提取数字
   * 支持 number 和 string 类型
   */
  private extractNumber(value: unknown, defaultValue: number): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  // ============ 缓存管理 ============

  /**
   * 从缓存获取
   */
  private getFromCache(serverId: string): SparkHealthReport | null {
    const entry = this.cache.get(serverId);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.config.reportCacheTTL) {
      this.cache.delete(serverId);
      return null;
    }

    return entry.data;
  }

  /**
   * 设置缓存
   */
  private setCache(serverId: string, data: SparkHealthReport): void {
    this.cache.set(serverId, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除缓存
   */
  clearCache(serverId?: string): void {
    if (serverId) {
      this.cache.delete(serverId);
    } else {
      this.cache.clear();
    }
  }
}

export const sparkService = new SparkService();
export default sparkService;
