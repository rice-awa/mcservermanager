/**
 * 状态统计服务
 * 采集和管理 Minecraft 服务器状态数据
 */
import type { ServerStats, TPSData, CPUData, MemoryHistoryData } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsService');

/**
 * 带时间戳的状态记录（内部使用）
 */
interface StatsRecord {
  timestamp: number;
  stats: ServerStats;
}

export class StatsService {
  private statsHistory: Map<string, StatsRecord[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private historySize = 100;

  /**
   * 开始采集服务器状态
   */
  startCollecting(serverId: string, intervalMs: number = 5000): void {
    if (this.updateIntervals.has(serverId)) {
      logger.warn(`服务器 ${serverId} 已在采集状态`);
      return;
    }

    logger.info(`开始采集服务器 ${serverId} 状态，间隔: ${intervalMs}ms`);

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
    // TODO: 实现实际的状态采集逻辑（通过 Spark API 或 RCON）
    const stats: ServerStats = {
      tps: 20,
      cpu: 0,
      memory: { used: 0, max: 4096, allocated: 2048 },
      onlinePlayers: 0,
      maxPlayers: 20,
      loadedChunks: 0,
      version: 'Unknown',
      gamemode: 'survival',
      difficulty: 'normal',
    };

    this.addToHistory(serverId, stats);
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
    logger.info('状态服务已清理');
  }
}

export const statsService = new StatsService();
export default statsService;
