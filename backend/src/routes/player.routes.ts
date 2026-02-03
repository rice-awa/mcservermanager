/**
 * 玩家管理 REST API 路由
 * 对应对接文档 3.2 节
 */
import { Router, Request, Response } from 'express';
import type { Player, ApiResponse, PaginatedResponse, PlayerQueryParams } from '../types';
import { playerService } from '../services/player.service';
import { rconService } from '../services/rcon.service';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('PlayerRoutes');

/**
 * GET /api/players - 获取玩家列表（支持筛选与分页）
 * 查询参数：
 * - q: 按名称搜索
 * - status: online | offline | all
 * - page: 页码
 * - pageSize: 每页数量
 * - sortBy: name | onlineTime | ping
 * - sortOrder: asc | desc
 * - serverId: 服务器 ID（必须）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const serverId = req.query.serverId as string;

    if (!serverId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_SERVER_ID',
          message: '缺少必须的 serverId 参数',
        },
      };
      return res.status(400).json(response);
    }

    if (!rconService.isConnected(serverId)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SERVER_NOT_CONNECTED',
          message: '服务器未连接，请先建立连接',
        },
      };
      return res.status(409).json(response);
    }

    const params: PlayerQueryParams = {
      q: req.query.q as string,
      status: req.query.status as 'online' | 'offline' | 'all',
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10,
      sortBy: req.query.sortBy as 'name' | 'onlineTime' | 'ping',
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await playerService.getPlayers(serverId, params);

    const response: ApiResponse<PaginatedResponse<Player>> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取玩家列表失败', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'FETCH_PLAYERS_FAILED',
        message: '获取玩家列表失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/players/count - 获取玩家数量
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const serverId = req.query.serverId as string;

    if (!serverId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_SERVER_ID',
          message: '缺少必须的 serverId 参数',
        },
      };
      return res.status(400).json(response);
    }

    if (!rconService.isConnected(serverId)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SERVER_NOT_CONNECTED',
          message: '服务器未连接，请先建立连接',
        },
      };
      return res.status(409).json(response);
    }

    const count = await playerService.getPlayerCount(serverId);

    const response: ApiResponse<{ online: number; max: number }> = {
      success: true,
      data: count,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取玩家数量失败', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'FETCH_PLAYER_COUNT_FAILED',
        message: '获取玩家数量失败',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
