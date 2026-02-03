/**
 * WebSocket 处理器
 */
import type { Server as SocketServer, Socket } from 'socket.io';
import { createLogger } from '../utils/logger';
import { rconService } from '../services/rcon.service';
import { statsService } from '../services/stats.service';

const logger = createLogger('SocketHandler');

/**
 * 设置 WebSocket 处理器
 */
export function setupSocketHandlers(io: SocketServer): void {
  io.on('connection', (socket: Socket) => {
    logger.info(`客户端连接: ${socket.id}`);

    // 连接服务器事件
    socket.on('server:connect', async (data: { serverId: string }) => {
      await handleServerConnect(socket, data.serverId);
    });

    // 断开服务器连接事件
    socket.on('server:disconnect', (data: { serverId: string }) => {
      handleServerDisconnect(socket, data.serverId);
    });

    // 控制台命令事件
    socket.on('console:command', async (data: { serverId: string; command: string }) => {
      await handleConsoleCommand(socket, data.serverId, data.command);
    });

    // 订阅状态更新事件
    socket.on('stats:subscribe', (data: { serverId: string }) => {
      handleStatsSubscribe(socket, data.serverId);
    });

    // 取消订阅状态更新事件
    socket.on('stats:unsubscribe', (data: { serverId: string }) => {
      handleStatsUnsubscribe(socket, data.serverId);
    });

    // 客户端断开连接
    socket.on('disconnect', (reason: string) => {
      logger.info(`客户端断开: ${socket.id}, 原因: ${reason}`);
    });

    // 错误处理
    socket.on('error', (error: Error) => {
      logger.error(`Socket 错误: ${error.message}`, { socketId: socket.id });
    });
  });
}

/**
 * 处理服务器连接请求
 */
async function handleServerConnect(socket: Socket, serverId: string): Promise<void> {
  logger.info(`请求连接服务器: ${serverId}`);

  try {
    // TODO: 从配置获取服务器信息并连接
    socket.emit('server:status', {
      serverId,
      status: 'connected',
      lastConnected: new Date(),
    });

    // 加入服务器房间
    socket.join(`server:${serverId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    socket.emit('error', {
      message: `连接服务器失败: ${message}`,
      code: 'CONNECTION_ERROR',
    });
  }
}

/**
 * 处理服务器断开连接
 */
function handleServerDisconnect(socket: Socket, serverId: string): void {
  logger.info(`断开服务器: ${serverId}`);

  // 离开服务器房间
  socket.leave(`server:${serverId}`);

  socket.emit('server:status', {
    serverId,
    status: 'disconnected',
  });
}

/**
 * 处理控制台命令
 */
async function handleConsoleCommand(
  socket: Socket,
  serverId: string,
  command: string
): Promise<void> {
  logger.debug(`执行命令 [${serverId}]: ${command}`);

  try {
    const result = await rconService.send(serverId, command);

    // 发送命令消息
    socket.emit('console:message', {
      id: generateId(),
      serverId,
      type: 'command',
      content: command,
      timestamp: new Date(),
    });

    // 发送响应消息
    socket.emit('console:message', {
      id: generateId(),
      serverId,
      type: result.success ? 'response' : 'error',
      content: result.response,
      timestamp: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    socket.emit('console:message', {
      id: generateId(),
      serverId,
      type: 'error',
      content: `命令执行失败: ${message}`,
      timestamp: new Date(),
    });
  }
}

/**
 * 处理状态订阅
 */
function handleStatsSubscribe(socket: Socket, serverId: string): void {
  logger.info(`订阅状态更新: ${serverId}`);
  socket.join(`stats:${serverId}`);
  // TODO: 启动状态采集并定期推送
}

/**
 * 处理取消状态订阅
 */
function handleStatsUnsubscribe(socket: Socket, serverId: string): void {
  logger.info(`取消状态订阅: ${serverId}`);
  socket.leave(`stats:${serverId}`);
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default setupSocketHandlers;
