/**
 * Spark API 服务 - 占位文件
 * 将在后续步骤中实现
 */
import type { TPSData, CPUData } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('SparkService');

/**
 * Spark 内部内存数据
 */
interface SparkMemoryData {
  used: number;
  max: number;
  free: number;
  percentage: number;
  timestamp: number;
}

export interface SparkReport {
  tps: TPSData;
  memory: SparkMemoryData;
  cpu: CPUData;
}

export class SparkService {
  private baseUrl: string = '';

  /**
   * 设置 Spark API URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    logger.info(`Spark API URL 设置为: ${url}`);
  }

  /**
   * 获取完整性能报告
   */
  async getReport(): Promise<SparkReport> {
    logger.debug('获取 Spark 性能报告');
    // TODO: 实现 Spark API 调用
    const now = Date.now();
    return {
      tps: {
        timestamp: now,
        tps: 20,
      },
      memory: {
        used: 2048,
        max: 4096,
        free: 2048,
        percentage: 50,
        timestamp: now,
      },
      cpu: {
        timestamp: now,
        value: 25,
      },
    };
  }

  /**
   * 获取 TPS 数据
   */
  async getTPS(): Promise<TPSData> {
    const report = await this.getReport();
    return report.tps;
  }

  /**
   * 获取内存数据
   */
  async getMemory(): Promise<SparkMemoryData> {
    const report = await this.getReport();
    return report.memory;
  }

  /**
   * 获取 CPU 数据
   */
  async getCPU(): Promise<CPUData> {
    const report = await this.getReport();
    return report.cpu;
  }
}

export const sparkService = new SparkService();
export default sparkService;
