/**
 * 认证 REST API 路由
 * POST /api/auth/login - 用户登录
 * GET /api/auth/me - 获取当前用户信息
 * POST /api/auth/refresh - 刷新 token
 */
import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import type { LoginRequest, ApiErrorResponse, ApiSuccessResponse } from '../types';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('AuthRoutes');

/**
 * POST /api/auth/login - 用户登录
 * 请求体: { username, password }
 * 返回: { success, data: { user, tokens } }
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;

    if (!username || !password) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名和密码不能为空',
        },
      };
      return res.status(400).json(response);
    }

    const user = authService.validateUser(username, password);

    if (!user) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
        },
      };
      return res.status(401).json(response);
    }

    const tokens = authService.generateTokens(user);

    logger.info(`用户登录成功: ${username}`);

    const response: ApiSuccessResponse<{
      user: Omit<typeof user, 'password'>;
      tokens: typeof tokens;
    }> = {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
        },
        tokens,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('登录失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: '登录失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/auth/me - 获取当前用户信息
 * 需要 Authorization: Bearer <access_token>
 */
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const response: ApiSuccessResponse<{
    userId: string;
    username: string;
    role: string;
  }> = {
    success: true,
    data: {
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
    },
  };
  res.json(response);
});

/**
 * POST /api/auth/refresh - 使用 socket token 刷新 access token
 * 请求体: { socketToken: string }
 */
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { socketToken } = req.body;

    if (!socketToken) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: '缺少 socketToken',
        },
      };
      return res.status(400).json(response);
    }

    const payload = authService.verifyToken(socketToken);

    if (!payload || payload.type !== 'socket') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的 socket token',
        },
      };
      return res.status(401).json(response);
    }

    const tokens = authService.generateTokens({
      id: payload.userId,
      username: payload.username,
      role: payload.role as 'admin' | 'user',
      createdAt: new Date(),
    });

    const response: ApiSuccessResponse<typeof tokens> = {
      success: true,
      data: tokens,
    };

    res.json(response);
  } catch (error) {
    logger.error('Token 刷新失败', { error });
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Token 刷新失败',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/auth/logout - 用户登出（客户端清除 token）
 * 实际上 JWT 是无状态的，只需前端清除 token 即可
 * 此接口用于记录日志和可能的 token 黑名单处理
 */
router.post('/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  logger.info(`用户登出: ${req.user?.username}`);
  const response: ApiSuccessResponse = {
    success: true,
    message: '登出成功',
  };
  res.json(response);
});

export default router;
