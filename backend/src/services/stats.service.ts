/**
 * 状态统计服务 - 占位文件
 * 将在后续步骤中实现
 */
import type { ServerStats } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsService');

export class StatsService {
  private statsHistory: Map<string, ServerStats[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

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
    // TODO: 实现状态采集逻辑
    const stats: ServerStats = {
      serverId,
      online: true,
      playerCount: 0,
      maxPlayers: 20,
      timestamp: new Date(),
    };

    this.addToHistory(serverId, stats);
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(serverId: string, stats: ServerStats): void {
    const history = this.statsHistory.get(serverId) ?? [];
    history.push(stats);

    // 保留最近 100 条记录
    if (history.length > 100) {
      history.shift();
    }

    this.statsHistory.set(serverId, history);
  }

  /**
   * 获取最新状态
   */
  getLatestStats(serverId: string): ServerStats | null {
    const history = this.statsHistory.get(serverId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1] ?? null;
  }

  /**
   * 获取状态历史
   */
  getStatsHistory(serverId: string, limit: number = 100): ServerStats[] {
    const history = this.statsHistory.get(serverId) ?? [];
    return history.slice(-limit);
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
