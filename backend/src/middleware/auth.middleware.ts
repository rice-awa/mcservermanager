/**
 * JWT 认证中间件
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import type { TokenPayload } from '../types/auth';
import type { ApiErrorResponse } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: '缺少 Authorization header',
      },
    };
    res.status(401).json(response);
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Authorization header 格式应为: Bearer <token>',
      },
    };
    res.status(401).json(response);
    return;
  }

  const token = parts[1] as string;
  const payload = authService.verifyToken(token);

  if (!payload) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '无效或已过期的 token',
      },
    };
    res.status(401).json(response);
    return;
  }

  if (payload.type !== 'access') {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN_TYPE',
        message: '需要 access token',
      },
    };
    res.status(401).json(response);
    return;
  }

  req.user = payload;
  next();
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    next();
    return;
  }

  const token = parts[1] as string;
  const payload = authService.verifyToken(token);

  if (payload && payload.type === 'access') {
    req.user = payload;
  }

  next();
}

export default authMiddleware;
