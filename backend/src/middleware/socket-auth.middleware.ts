/**
 * Socket.io 认证中间件
 * 支持通过 query 参数或 auth 事件进行 Socket token 认证
 */
import type { Socket } from 'socket.io';
import { authService } from '../services/auth.service';
import type { TokenPayload } from '../types/auth';

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

export function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): void {
  let token: string | undefined;

  // 1. 优先从 query 参数获取 token
  token = socket.handshake.query.token as string | undefined;

  // 2. 从 auth 事件中获取（客户端可以在连接后发送认证）
  if (!token) {
    socket.on('auth', (data: { token: string }) => {
      if (data.token) {
        validateAndAttachUser(socket, data.token, next);
      }
    });

    // 3. 允许延迟认证，不立即阻止连接
    // 设置 30 秒超时，超时后断开未认证的连接
    socket.timeout(30000).on('auth', async (data, callback) => {
      try {
        const payload = authService.verifyToken(data.token);
        if (payload && payload.type === 'socket') {
          socket.user = payload;
          callback({ success: true });
          next();
        } else {
          callback({ success: false, error: '无效的 socket token' });
          next(new Error('无效的 socket token'));
        }
      } catch (error) {
        callback({ success: false, error: '认证失败' });
        next(new Error('认证失败'));
      }
    });

    // 对于公开端点，允许匿名连接
    next();
    return;
  }

  validateAndAttachUser(socket, token, next);
}

function validateAndAttachUser(
  socket: AuthenticatedSocket,
  token: string,
  next: (err?: Error) => void
): void {
  const payload = authService.verifyToken(token);

  if (!payload) {
    next(new Error('无效或已过期的 token'));
    return;
  }

  if (payload.type !== 'socket') {
    next(new Error('需要 socket token'));
    return;
  }

  socket.user = payload;
  next();
}

export function requireSocketAuth(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): void {
  if (!socket.user) {
    next(new Error('需要认证'));
    return;
  }
  next();
}

export default socketAuthMiddleware;
