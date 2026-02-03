/**
 * Spark API 服务
 * 实现双重数据获取策略：
 * - 方案 C（主要）：通过 RCON 执行 spark 命令，解析文本输出
 * - 方案 B（备选）：通过 /spark health --upload 获取 URL，拉取 raw JSON
 */
import axios from 'axios';
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

export class SparkService {
  private config: SparkConfig;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(private rcon: RconService = rconService) {
    this.config = appConfig.spark;
  }

  // ============ 公开 API ============

  /**
   * 获取服务器健康报告（统一入口）
   * 优先使用 RCON 方案，失败时降级到 API 方案
   */
  async getHealth(serverId: string): Promise<SparkHealthReport | null> {
    // 检查缓存
    const cached = this.getFromCache(serverId);
    if (cached) {
      logger.debug(`使用缓存的健康报告 [${serverId}]`);
      return cached;
    }

    // 方案 C：RCON 命令解析
    if (this.config.preferRcon) {
      const rconResult = await this.getHealthViaRcon(serverId);
      if (rconResult) {
        this.setCache(serverId, rconResult);
        return rconResult;
      }
      logger.warn(`RCON 方案失败，尝试 API 方案 [${serverId}]`);
    }

    // 方案 B：Health Report API
    const apiResult = await this.getHealthViaApi(serverId);
    if (apiResult) {
      this.setCache(serverId, apiResult);
      return apiResult;
    }

    logger.error(`所有方案均失败 [${serverId}]`);
    return null;
  }

  /**
   * 仅获取 TPS 数据（通过 RCON）
   */
  async getTPS(serverId: string): Promise<SparkTPSStats | null> {
    const result = await this.rcon.send(serverId, 'spark tps');
    if (!result.success) {
      logger.error(`获取 TPS 失败: ${result.response}`);
      return null;
    }
    return this.parseTPSOutput(result.response);
  }

  // ============ 方案 C：RCON 命令解析 ============

  /**
   * 通过 RCON 获取健康报告
   */
  private async getHealthViaRcon(serverId: string): Promise<SparkHealthReport | null> {
    try {
      // 并行获取 TPS 和 health 数据
      const [tpsResult, healthResult] = await Promise.all([
        this.rcon.send(serverId, 'spark tps'),
        this.rcon.send(serverId, 'spark health'),
      ]);

      if (!tpsResult.success || !healthResult.success) {
        logger.warn(`RCON 命令执行失败: tps=${tpsResult.success}, health=${healthResult.success}`);
        return null;
      }

      // 解析 TPS 和 MSPT
      const tpsData = this.parseTPSOutput(tpsResult.response);
      const msptData = this.parseMSPTFromTPSOutput(tpsResult.response);

      // 解析 health 输出中的 CPU、内存、磁盘
      const healthData = this.parseHealthOutput(healthResult.response);

      if (!tpsData || !healthData) {
        logger.warn('解析 spark 输出失败');
        return null;
      }

      const result: SparkHealthReport = {
        tps: tpsData,
        mspt: msptData || this.getDefaultMSPT(),
        cpu: healthData.cpu || this.getDefaultCPU(),
        memory: healthData.memory || this.getDefaultMemory(),
        timestamp: Date.now(),
      };

      if (healthData.disk) {
        result.disk = healthData.disk;
      }

      return result;
    } catch (error) {
      logger.error('RCON 方案异常', error);
      return null;
    }
  }

  /**
   * 解析 spark tps 命令输出
   * 示例输出: "TPS from last 5s, 10s, 1m, 5m, 15m: 20.0, 20.0, 20.0, 20.0, 20.0"
   */
  private parseTPSOutput(output: string): SparkTPSStats | null {
    const cleaned = this.cleanColorCodes(output);

    // 匹配 TPS 数值（支持 * 标记）
    // 格式: "TPS from last 5s, 10s, 1m, 5m, 15m:"
    const tpsMatch = cleaned.match(
      /TPS[^:]*:\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?,?\s*\*?([\d.]+)\*?/i
    );

    if (tpsMatch) {
      return {
        last5s: this.safeParseFloat(tpsMatch[1], 20),
        last10s: this.safeParseFloat(tpsMatch[2], 20),
        last1m: this.safeParseFloat(tpsMatch[3], 20),
        last5m: this.safeParseFloat(tpsMatch[4], 20),
        last15m: this.safeParseFloat(tpsMatch[5], 20),
      };
    }

    // 备用解析：查找连续的数字
    const numbers = cleaned.match(/[\d.]+/g);
    if (numbers && numbers.length >= 5) {
      return {
        last5s: this.safeParseFloat(numbers[0], 20),
        last10s: this.safeParseFloat(numbers[1], 20),
        last1m: this.safeParseFloat(numbers[2], 20),
        last5m: this.safeParseFloat(numbers[3], 20),
        last15m: this.safeParseFloat(numbers[4], 20),
      };
    }

    logger.warn(`无法解析 TPS 输出: ${cleaned.substring(0, 100)}`);
    return null;
  }

  /**
   * 从 spark tps 输出中解析 MSPT
   * 示例: "Tick durations (min/median/95%ile/max ms): 0.5/1.2/2.3/5.1"
   */
  private parseMSPTFromTPSOutput(output: string): SparkMSPTStats | null {
    const cleaned = this.cleanColorCodes(output);

    // 匹配 MSPT 数值
    const msptMatch = cleaned.match(
      /(?:Tick durations?|MSPT)[^:]*:\s*\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?\/\*?([\d.]+)\*?/i
    );

    if (msptMatch) {
      return {
        min: this.safeParseFloat(msptMatch[1], 0),
        median: this.safeParseFloat(msptMatch[2], 0),
        percentile95: this.safeParseFloat(msptMatch[3], 0),
        max: this.safeParseFloat(msptMatch[4], 0),
      };
    }

    return null;
  }

  /**
   * 解析 spark health 命令输出
   * 提取 CPU、内存、磁盘信息
   */
  private parseHealthOutput(output: string): Partial<{
    cpu: SparkCPUStats;
    memory: SparkMemoryStats;
    disk: SparkDiskStats;
  }> | null {
    const cleaned = this.cleanColorCodes(output);
    const result: Partial<{
      cpu: SparkCPUStats;
      memory: SparkMemoryStats;
      disk: SparkDiskStats;
    }> = {};

    // 解析 CPU
    // 格式: "CPU Process: 15%, 12%, 10% (last 10s, 1m, 15m)"
    // 或: "CPU System: 25%, 22%, 20%"
    const cpuProcessMatch = cleaned.match(
      /CPU\s*(?:Process|Usage)[^:]*:\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?/i
    );
    const cpuSystemMatch = cleaned.match(
      /CPU\s*System[^:]*:\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?,?\s*\*?([\d.]+)%?\*?/i
    );

    if (cpuProcessMatch || cpuSystemMatch) {
      result.cpu = {
        process: cpuProcessMatch
          ? {
              last10s: this.safeParseFloat(cpuProcessMatch[1], 0),
              last1m: this.safeParseFloat(cpuProcessMatch[2], 0),
              last15m: this.safeParseFloat(cpuProcessMatch[3], 0),
            }
          : { last10s: 0, last1m: 0, last15m: 0 },
        system: cpuSystemMatch
          ? {
              last10s: this.safeParseFloat(cpuSystemMatch[1], 0),
              last1m: this.safeParseFloat(cpuSystemMatch[2], 0),
              last15m: this.safeParseFloat(cpuSystemMatch[3], 0),
            }
          : { last10s: 0, last1m: 0, last15m: 0 },
      };
    }

    // 解析内存
    // 格式: "Memory: 2048/4096 MB (50%)" 或 "Memory: 2.0/4.0 GB"
    const memoryMatch = cleaned.match(
      /Memory[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(MB|GB)?/i
    );

    if (memoryMatch) {
      let used = this.safeParseFloat(memoryMatch[1], 0);
      let max = this.safeParseFloat(memoryMatch[2], 0);
      const unit = memoryMatch[3]?.toUpperCase();

      // 转换为 MB
      if (unit === 'GB') {
        used *= 1024;
        max *= 1024;
      }

      result.memory = {
        used: Math.round(used),
        allocated: Math.round(used), // allocated 近似等于 used
        max: Math.round(max),
      };
    }

    // 解析磁盘
    // 格式: "Disk: 50/100 GB (50%)"
    const diskMatch = cleaned.match(
      /Disk[^:]*:\s*([\d.]+)\s*[/]\s*([\d.]+)\s*(GB|TB)?/i
    );

    if (diskMatch) {
      let used = this.safeParseFloat(diskMatch[1], 0);
      let total = this.safeParseFloat(diskMatch[2], 0);
      const unit = diskMatch[3]?.toUpperCase();

      // 转换为 GB
      if (unit === 'TB') {
        used *= 1024;
        total *= 1024;
      }

      result.disk = {
        used: Math.round(used * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  // ============ 方案 B：Health Report API ============

  /**
   * 通过 API 获取健康报告
   */
  private async getHealthViaApi(serverId: string): Promise<SparkHealthReport | null> {
    try {
      // 执行上传命令
      const uploadResult = await this.rcon.send(serverId, 'spark health --upload');
      if (!uploadResult.success) {
        logger.error(`上传 health report 失败: ${uploadResult.response}`);
        return null;
      }

      // 提取 URL
      const reportUrl = this.extractReportUrl(uploadResult.response);
      if (!reportUrl) {
        logger.error('无法从输出中提取报告 URL');
        return null;
      }

      logger.info(`获取到报告 URL: ${reportUrl}`);

      // 获取 JSON 数据
      return await this.fetchHealthReportJson(reportUrl);
    } catch (error) {
      logger.error('API 方案异常', error);
      return null;
    }
  }

  /**
   * 从 spark 输出中提取报告 URL
   * 示例: "https://spark.lucko.me/abc123"
   */
  private extractReportUrl(output: string): string | null {
    const cleaned = this.cleanColorCodes(output);
    const urlMatch = cleaned.match(/https?:\/\/spark\.lucko\.me\/([a-zA-Z0-9]+)/);
    return urlMatch ? urlMatch[0] : null;
  }

  /**
   * 从报告 URL 中提取 ID
   */
  private extractReportId(url: string): string | null {
    const match = url.match(/spark\.lucko\.me\/([a-zA-Z0-9]+)/);
    return match && match[1] ? match[1] : null;
  }

  /**
   * 通过 URL 获取 health report JSON
   */
  private async fetchHealthReportJson(reportUrl: string): Promise<SparkHealthReport | null> {
    try {
      const jsonUrl = `${reportUrl}?raw=1`;
      const response = await axios.get(jsonUrl, {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data) {
        return this.parseApiResponse(response.data);
      }

      return null;
    } catch (error) {
      logger.error('获取报告 JSON 失败', error);
      return null;
    }
  }

  /**
   * 解析 API 响应转换为 SparkHealthReport
   */
  private parseApiResponse(data: unknown): SparkHealthReport | null {
    try {
      // spark API 返回的 JSON 结构
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = data as any;

      // 提取 metadata 中的数据
      const metadata = json.metadata || json;
      const platform = metadata.platform || {};
      const systemStatistics = metadata.systemStatistics || {};
      const serverConfigurations = metadata.serverConfigurations || {};

      // 解析 TPS
      const tps: SparkTPSStats = {
        last5s: this.extractNumber(systemStatistics.tps?.last5s, 20),
        last10s: this.extractNumber(systemStatistics.tps?.last10s, 20),
        last1m: this.extractNumber(systemStatistics.tps?.last1m, 20),
        last5m: this.extractNumber(systemStatistics.tps?.last5m, 20),
        last15m: this.extractNumber(systemStatistics.tps?.last15m, 20),
      };

      // 解析 MSPT
      const mspt: SparkMSPTStats = {
        min: this.extractNumber(systemStatistics.mspt?.min, 0),
        median: this.extractNumber(systemStatistics.mspt?.median, 0),
        percentile95: this.extractNumber(systemStatistics.mspt?.percentile95, 0),
        max: this.extractNumber(systemStatistics.mspt?.max, 0),
      };

      // 解析 CPU
      const cpuProcess = systemStatistics.cpu?.process || {};
      const cpuSystem = systemStatistics.cpu?.system || {};
      const cpu: SparkCPUStats = {
        process: {
          last10s: this.extractNumber(cpuProcess.last10s, 0),
          last1m: this.extractNumber(cpuProcess.last1m, 0),
          last15m: this.extractNumber(cpuProcess.last15m, 0),
        },
        system: {
          last10s: this.extractNumber(cpuSystem.last10s, 0),
          last1m: this.extractNumber(cpuSystem.last1m, 0),
          last15m: this.extractNumber(cpuSystem.last15m, 0),
        },
      };

      // 解析内存
      const memoryData = systemStatistics.memory || {};
      const memory: SparkMemoryStats = {
        used: this.extractNumber(memoryData.used, 0),
        allocated: this.extractNumber(memoryData.allocated, 0),
        max: this.extractNumber(memoryData.max, 0),
      };

      // 解析磁盘
      const diskData = systemStatistics.disk || {};
      const disk: SparkDiskStats | undefined = diskData.used !== undefined ? {
        used: this.extractNumber(diskData.used, 0),
        total: this.extractNumber(diskData.total, 0),
      } : undefined;

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
      logger.error('解析 API 响应失败', error);
      return null;
    }
  }

  // ============ 工具方法 ============

  /**
   * 清理 Minecraft 颜色代码
   */
  private cleanColorCodes(text: string): string {
    // 移除 § 颜色代码
    let cleaned = text.replace(/§[0-9a-fk-or]/gi, '');
    // 移除其他控制字符
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    return cleaned.trim();
  }

  /**
   * 安全解析浮点数
   */
  private safeParseFloat(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 安全提取数字
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

  /**
   * 获取默认 MSPT 数据
   */
  private getDefaultMSPT(): SparkMSPTStats {
    return { min: 0, median: 0, percentile95: 0, max: 0 };
  }

  /**
   * 获取默认 CPU 数据
   */
  private getDefaultCPU(): SparkCPUStats {
    return {
      process: { last10s: 0, last1m: 0, last15m: 0 },
      system: { last10s: 0, last1m: 0, last15m: 0 },
    };
  }

  /**
   * 获取默认内存数据
   */
  private getDefaultMemory(): SparkMemoryStats {
    return { used: 0, allocated: 0, max: 0 };
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
