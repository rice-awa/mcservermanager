/**
 * 错误处理工具
 */
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types';
import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // 维护正确的原型链
    Object.setPrototypeOf(this, AppError.prototype);

    // 捕获堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常见错误工厂函数
 */
export const errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(message, 400, 'BAD_REQUEST', true, details),

  unauthorized: (message: string = '未授权访问') =>
    new AppError(message, 401, 'UNAUTHORIZED', true),

  forbidden: (message: string = '禁止访问') =>
    new AppError(message, 403, 'FORBIDDEN', true),

  notFound: (resource: string = '资源') =>
    new AppError(`${resource}不存在`, 404, 'NOT_FOUND', true),

  conflict: (message: string) =>
    new AppError(message, 409, 'CONFLICT', true),

  validation: (message: string, details?: unknown) =>
    new AppError(message, 422, 'VALIDATION_ERROR', true, details),

  internal: (message: string = '服务器内部错误') =>
    new AppError(message, 500, 'INTERNAL_ERROR', false),

  serviceUnavailable: (message: string = '服务暂时不可用') =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE', true),

  rconConnection: (message: string) =>
    new AppError(message, 502, 'RCON_CONNECTION_ERROR', true),

  rconTimeout: (message: string = 'RCON 命令执行超时') =>
    new AppError(message, 504, 'RCON_TIMEOUT', true),
};

/**
 * 创建错误响应
 */
function createErrorResponse(error: AppError | Error): ApiResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date(),
    };
  }

  // 未知错误
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
    timestamp: new Date(),
  };
}

/**
 * Express 错误处理中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 记录错误
  const isOperational = err instanceof AppError && err.isOperational;
  const logMethod = isOperational ? 'warn' : 'error';

  logger[logMethod](`${req.method} ${req.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
    query: req.query,
  });

  // 确定状态码
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // 发送响应
  const response = createErrorResponse(err);
  res.status(statusCode).json(response);
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = errors.notFound(`路由 ${req.method} ${req.path}`);
  next(error);
}

/**
 * 异步处理器包装函数
 * 用于捕获异步路由处理器中的错误
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
  };
}

export default {
  AppError,
  errors,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createSuccessResponse,
};
