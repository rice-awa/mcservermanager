/**
 * 仪表盘数据 REST API 路由
 * 对应对接文档 3.3 节
 */
import { Router, Request, Response } from 'express';
import type { ApiResponse, ServerStats, DashboardStatsResponse } from '../types';
import { statsService } from '../services/stats.service';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('StatsRoutes');

/**
 * GET /api/stats - 获取一次性快照
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

    const stats = statsService.getLatestStats(serverId);

    if (!stats) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NO_STATS_AVAILABLE',
          message: '暂无服务器状态数据',
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ServerStats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取状态快照失败', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'FETCH_STATS_FAILED',
        message: '获取状态快照失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/stats/history - 获取历史曲线（TPS/CPU/内存）
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const serverId = req.query.serverId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

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

    const latestStats = statsService.getLatestStats(serverId);

    // 构建对接文档格式的响应
    const dashboardData: DashboardStatsResponse = {
      stats: latestStats ?? {
        tps: 20,
        cpu: 0,
        cpuProcess: 0,
        cpuSystem: 0,
        memory: { used: 0, max: 0, allocated: 0 },
        onlinePlayers: 0,
        maxPlayers: 20,
        loadedChunks: 0,
        version: 'Unknown',
        gamemode: 'survival',
        difficulty: 'normal',
      },
      tpsHistory: statsService.getTpsHistory(serverId, limit),
      cpuHistory: statsService.getCpuHistory(serverId, limit),
      memoryHistory: statsService.getMemoryHistory(serverId, limit),
    };

    const response: ApiResponse<DashboardStatsResponse> = {
      success: true,
      data: dashboardData,
    };
    res.json(response);
  } catch (error) {
    logger.error('获取历史数据失败', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'FETCH_HISTORY_FAILED',
        message: '获取历史数据失败',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
