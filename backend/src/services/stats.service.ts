/**
 * 状态统计服务
 * 采集和管理 Minecraft 服务器状态数据
 * 集成 SparkService 获取真实性能数据
 */
import type { ServerStats, TPSData, CPUData, MemoryHistoryData } from '../types';
import { createLogger } from '../utils/logger';
import { sparkService, type SparkService } from './spark.service';
import { rconService, type RconService } from './rcon.service';

const logger = createLogger('StatsService');

/**
 * 带时间戳的状态记录（内部使用）
 */
interface StatsRecord {
  timestamp: number;
  stats: ServerStats;
}

/**
 * 服务器基础信息缓存
 */
interface ServerInfoCache {
  version: string;
  maxPlayers: number;
  lastUpdated: number;
}

export class StatsService {
  private statsHistory: Map<string, StatsRecord[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private serverInfoCache: Map<string, ServerInfoCache> = new Map();
  private historySize = 100;
  private infoCacheTTL = 60000; // 服务器信息缓存 60 秒

  constructor(
    private spark: SparkService = sparkService,
    private rcon: RconService = rconService
  ) {}

  /**
   * 开始采集服务器状态
   */
  startCollecting(serverId: string, intervalMs: number = 5000): void {
    if (this.updateIntervals.has(serverId)) {
      logger.warn(`服务器 ${serverId} 已在采集状态`);
      return;
    }

    logger.info(`开始采集服务器 ${serverId} 状态，间隔: ${intervalMs}ms`);

    // 立即执行一次采集
    this.collectStats(serverId);

    const interval = setInterval(() => {
      this.collectStats(serverId);
    }, intervalMs);

    this.updateIntervals.set(serverId, interval);
  }

  /**
   * 停止采集服务器状态
   */
  stopCollecting(serverId: string): void {
    const interval = this.updateIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(serverId);
      logger.info(`停止采集服务器 ${serverId} 状态`);
    }
  }

  /**
   * 采集单次状态
   */
  private async collectStats(serverId: string): Promise<void> {
    try {
      // 检查 RCON 连接状态
      if (!this.rcon.isConnected(serverId)) {
        logger.debug(`服务器 ${serverId} 未连接，跳过采集`);
        return;
      }

      // 并行获取 Spark 数据和 RCON 数据
      const [healthReport, playerInfo, serverInfo] = await Promise.all([
        this.spark.getHealth(serverId),
        this.getPlayerInfo(serverId),
        this.getServerInfo(serverId),
      ]);

      // 构建状态数据
      const cpuUsage =
        healthReport?.cpu.process.last1m ??
        healthReport?.cpu.system.last1m ??
        0;
      const stats: ServerStats = {
        tps: healthReport?.tps.last1m ?? 20,
        cpu: cpuUsage,
        memory: {
          used: healthReport?.memory.used ?? 0,
          max: healthReport?.memory.max ?? 0,
          allocated: healthReport?.memory.allocated ?? 0,
        },
        onlinePlayers: playerInfo.online,
        maxPlayers: playerInfo.max || serverInfo.maxPlayers,
        loadedChunks: 0, // 暂时无法获取
        version: serverInfo.version,
        gamemode: 'survival', // 默认值，可通过 RCON 获取
        difficulty: 'normal', // 默认值，可通过 RCON 获取
      };

      this.addToHistory(serverId, stats);
      logger.debug(`采集状态完成 [${serverId}]: TPS=${stats.tps}, CPU=${stats.cpu}%`);
    } catch (error) {
      logger.error(`采集状态失败 [${serverId}]`, error);
    }
  }

  /**
   * 获取玩家信息（通过 RCON list 命令）
   */
  private async getPlayerInfo(serverId: string): Promise<{ online: number; max: number }> {
    try {
      const result = await this.rcon.send(serverId, 'list');
      if (!result.success) {
        return { online: 0, max: 0 };
      }

      // 解析 "There are X of a max of Y players online"
      // 或 "There are X/Y players online"
      const match = result.response.match(/(\d+)\s*(?:of a max of|\/)\s*(\d+)/i);
      if (match && match[1] && match[2]) {
        return {
          online: parseInt(match[1], 10) || 0,
          max: parseInt(match[2], 10) || 20,
        };
      }

      // 备用解析：查找数字
      const numbers = result.response.match(/\d+/g);
      if (numbers && numbers.length >= 2 && numbers[0] && numbers[1]) {
        return {
          online: parseInt(numbers[0], 10) || 0,
          max: parseInt(numbers[1], 10) || 20,
        };
      }

      return { online: 0, max: 0 };
    } catch (error) {
      logger.debug(`获取玩家信息失败 [${serverId}]`, error);
      return { online: 0, max: 0 };
    }
  }

  /**
   * 获取服务器基础信息（带缓存）
   */
  private async getServerInfo(serverId: string): Promise<ServerInfoCache> {
    // 检查缓存
    const cached = this.serverInfoCache.get(serverId);
    if (cached && Date.now() - cached.lastUpdated < this.infoCacheTTL) {
      return cached;
    }

    try {
      // 尝试获取版本信息（通过 spark 或其他方式）
      const info: ServerInfoCache = {
        version: 'Minecraft Server',
        maxPlayers: 20,
        lastUpdated: Date.now(),
      };

      // 尝试通过 list 命令获取 maxPlayers
      const listResult = await this.rcon.send(serverId, 'list');
      if (listResult.success) {
        const match = listResult.response.match(/max of (\d+)/i);
        if (match && match[1]) {
          info.maxPlayers = parseInt(match[1], 10) || 20;
        }
      }

      this.serverInfoCache.set(serverId, info);
      return info;
    } catch (error) {
      logger.debug(`获取服务器信息失败 [${serverId}]`, error);
      return {
        version: 'Unknown',
        maxPlayers: 20,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(serverId: string, stats: ServerStats): void {
    const history = this.statsHistory.get(serverId) ?? [];
    const record: StatsRecord = {
      timestamp: Date.now(),
      stats,
    };
    history.push(record);

    // 保留最近记录
    if (history.length > this.historySize) {
      history.shift();
    }

    this.statsHistory.set(serverId, history);
  }

  /**
   * 手动更新状态（用于外部推送）
   */
  updateStats(serverId: string, stats: ServerStats): void {
    this.addToHistory(serverId, stats);
  }

  /**
   * 获取最新状态
   */
  getLatestStats(serverId: string): ServerStats | null {
    const history = this.statsHistory.get(serverId);
    if (!history || history.length === 0) return null;
    const latest = history[history.length - 1];
    return latest?.stats ?? null;
  }

  /**
   * 获取状态历史（返回带时间戳的记录）
   */
  getStatsHistory(
    serverId: string,
    limit: number = 100
  ): Array<{ timestamp: number } & ServerStats> {
    const history = this.statsHistory.get(serverId) ?? [];
    return history.slice(-limit).map((record) => ({
      timestamp: record.timestamp,
      ...record.stats,
    }));
  }

  /**
   * 获取 TPS 历史数据
   */
  getTpsHistory(serverId: string, limit: number = 100): TPSData[] {
    const history = this.statsHistory.get(serverId) ?? [];
    return history.slice(-limit).map((record) => ({
      timestamp: record.timestamp,
      tps: record.stats.tps,
    }));
  }

  /**
   * 获取 CPU 历史数据
   */
  getCpuHistory(serverId: string, limit: number = 100): CPUData[] {
    const history = this.statsHistory.get(serverId) ?? [];
    return history.slice(-limit).map((record) => ({
      timestamp: record.timestamp,
      value: record.stats.cpu,
    }));
  }

  /**
   * 获取内存历史数据
   */
  getMemoryHistory(serverId: string, limit: number = 100): MemoryHistoryData[] {
    const history = this.statsHistory.get(serverId) ?? [];
    return history.slice(-limit).map((record) => ({
      timestamp: record.timestamp,
      used: record.stats.memory.used,
      allocated: record.stats.memory.allocated,
    }));
  }

  /**
   * 清理所有采集任务
   */
  cleanup(): void {
    for (const [serverId] of this.updateIntervals) {
      this.stopCollecting(serverId);
    }
    this.statsHistory.clear();
    this.serverInfoCache.clear();
    logger.info('状态服务已清理');
  }
}

export const statsService = new StatsService();
export default statsService;
