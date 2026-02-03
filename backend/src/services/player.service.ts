/**
 * 玩家管理服务
 * 管理 Minecraft 服务器玩家数据
 */
import type { Player, PlayerQueryParams, PaginatedResponse } from '../types';
import { createLogger } from '../utils/logger';
import { rconService } from './rcon.service';

const logger = createLogger('PlayerService');

export class PlayerService {
  // 玩家缓存（按服务器 ID 存储）
  private playerCache: Map<string, Player[]> = new Map();
  private lastUpdateTime: Map<string, Date> = new Map();

  /**
   * 获取玩家列表（带分页和筛选）
   */
  async getPlayers(
    serverId: string,
    params: PlayerQueryParams = {}
  ): Promise<PaginatedResponse<Player>> {
    const {
      q,
      status = 'all',
      page = 1,
      pageSize = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = params;

    // 获取或刷新玩家数据
    let players = await this.fetchPlayers(serverId);

    // 按状态筛选
    if (status === 'online') {
      players = players.filter((p) => p.ping >= 0);
    } else if (status === 'offline') {
      players = players.filter((p) => p.ping < 0);
    }

    // 按名称搜索
    if (q) {
      const searchTerm = q.toLowerCase();
      players = players.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.uuid.toLowerCase().includes(searchTerm)
      );
    }

    // 排序
    players.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'onlineTime':
          comparison = a.onlineTime - b.onlineTime;
          break;
        case 'ping':
          comparison = a.ping - b.ping;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // 分页
    const total = players.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = players.slice(startIndex, endIndex);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取所有在线玩家
   */
  async getOnlinePlayers(serverId: string): Promise<Player[]> {
    const players = await this.fetchPlayers(serverId);
    return players.filter((p) => p.ping >= 0);
  }

  /**
   * 获取玩家数量
   */
  async getPlayerCount(serverId: string): Promise<{ online: number; max: number }> {
    try {
      // 尝试通过 RCON 获取玩家数量
      const result = await rconService.send(serverId, 'list');
      if (result.success) {
        // 解析响应，格式通常为 "There are X of a max of Y players online: ..."
        const match = result.response.match(/There are (\d+) of a max of (\d+)/i);
        if (match && match[1] && match[2]) {
          return {
            online: parseInt(match[1], 10),
            max: parseInt(match[2], 10),
          };
        }
      }
    } catch (error) {
      logger.error(`获取玩家数量失败: ${serverId}`, { error });
    }

    // 返回默认值
    const players = this.playerCache.get(serverId) ?? [];
    return {
      online: players.filter((p) => p.ping >= 0).length,
      max: 20,
    };
  }

  /**
   * 从服务器获取玩家数据
   */
  private async fetchPlayers(serverId: string): Promise<Player[]> {
    // 检查缓存是否有效（5秒内不重复请求）
    const lastUpdate = this.lastUpdateTime.get(serverId);
    const cached = this.playerCache.get(serverId);
    if (cached && lastUpdate && Date.now() - lastUpdate.getTime() < 5000) {
      return cached;
    }

    try {
      // 通过 RCON 获取玩家列表
      const result = await rconService.send(serverId, 'list');
      if (result.success) {
        const players = this.parsePlayerList(result.response, serverId);
        this.playerCache.set(serverId, players);
        this.lastUpdateTime.set(serverId, new Date());
        return players;
      }
    } catch (error) {
      logger.error(`获取玩家列表失败: ${serverId}`, { error });
    }

    return cached ?? [];
  }

  /**
   * 解析 RCON list 命令响应
   */
  private parsePlayerList(response: string, serverId: string): Player[] {
    // 响应格式: "There are X of a max of Y players online: player1, player2, ..."
    const match = response.match(/players online[:\s]+(.*)/i);
    if (!match || !match[1]) {
      return [];
    }

    const playerNames = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    return playerNames.map((name) => ({
      id: `${serverId}_${name}`,
      name,
      uuid: '', // RCON list 命令不返回 UUID，需要其他方式获取
      onlineTime: 0, // 需要 Spark API 或其他方式获取
      ping: 0, // 需要 Spark API 或其他方式获取
    }));
  }

  /**
   * 更新玩家缓存（用于 WebSocket 推送）
   */
  updatePlayerCache(serverId: string, players: Player[]): void {
    this.playerCache.set(serverId, players);
    this.lastUpdateTime.set(serverId, new Date());
  }

  /**
   * 清除服务器的玩家缓存
   */
  clearCache(serverId: string): void {
    this.playerCache.delete(serverId);
    this.lastUpdateTime.delete(serverId);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.playerCache.clear();
    this.lastUpdateTime.clear();
  }
}

export const playerService = new PlayerService();
export default playerService;
