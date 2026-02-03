/**
 * WebSocket 处理器
 * 处理客户端与服务器之间的实时通信
 */
import type { Server as SocketServer, Socket } from 'socket.io';
import type { ServerConfig } from '../types';
import { createLogger } from '../utils/logger';
import { rconService } from '../services/rcon.service';
import { configService } from '../services/config.service';

const logger = createLogger('SocketHandler');

/**
 * 设置 WebSocket 处理器
 */
export function setupSocketHandlers(io: SocketServer): void {
  // 监听 RCON 状态变化，广播给所有客户端
  rconService.onStatusChange((serverId, status, error) => {
    io.to(`server:${serverId}`).emit('server:status', {
      serverId,
      status,
      error,
      lastConnected: status === 'connected' ? new Date() : undefined,
    });
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`客户端连接: ${socket.id}`);

    // 发送当前所有服务器状态
    sendCurrentStatus(socket);

    // 连接服务器事件
    socket.on('server:connect', async (data: { serverId: string; config?: Partial<ServerConfig> }) => {
      await handleServerConnect(socket, data.serverId, data.config);
    });

    // 断开服务器连接事件
    socket.on('server:disconnect', (data: { serverId: string }) => {
      handleServerDisconnect(socket, data.serverId);
    });

    // 控制台命令事件
    socket.on('console:command', async (data: { serverId: string; command: string }) => {
      await handleConsoleCommand(socket, data.serverId, data.command);
    });

    // 测试连接事件
    socket.on('server:test', async (data: { config: Partial<ServerConfig> }) => {
      await handleTestConnection(socket, data.config);
    });

    // 获取服务器列表
    socket.on('servers:list', () => {
      handleServersList(socket);
    });

    // 添加服务器配置
    socket.on('servers:add', (data: { config: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'> }) => {
      handleAddServer(socket, data.config);
    });

    // 更新服务器配置
    socket.on('servers:update', (data: { serverId: string; config: Partial<ServerConfig> }) => {
      handleUpdateServer(socket, data.serverId, data.config);
    });

    // 删除服务器配置
    socket.on('servers:delete', (data: { serverId: string }) => {
      handleDeleteServer(socket, data.serverId);
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
 * 发送当前所有服务器状态
 */
function sendCurrentStatus(socket: Socket): void {
  const connections = rconService.getAllConnections();
  const configs = configService.getAll();

  // 发送所有配置的服务器
  socket.emit('servers:list', {
    servers: configs.map((config) => {
      const conn = connections.find((c) => c.serverId === config.id);
      return {
        ...config,
        status: conn?.status ?? 'disconnected',
        lastActivity: conn?.lastActivity,
      };
    }),
  });
}

/**
 * 处理服务器连接请求
 */
async function handleServerConnect(
  socket: Socket,
  serverId: string,
  configOverride?: Partial<ServerConfig>
): Promise<void> {
  logger.info(`请求连接服务器: ${serverId}`);

  try {
    // 获取服务器配置
    let config = configService.get(serverId);

    if (!config && configOverride) {
      // 如果没有配置但提供了配置信息，创建临时配置
      const createConfig: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'> = {
        name: configOverride.name ?? '未命名服务器',
        host: configOverride.host ?? 'localhost',
        rconPort: configOverride.rconPort ?? 25575,
        rconPassword: configOverride.rconPassword ?? '',
        enabled: true,
      };
      if (configOverride.sparkApiUrl) {
        createConfig.sparkApiUrl = configOverride.sparkApiUrl;
      }
      config = configService.create(createConfig);
      serverId = config.id;
    }

    if (!config) {
      socket.emit('error', {
        message: `服务器配置不存在: ${serverId}`,
        code: 'CONFIG_NOT_FOUND',
      });
      return;
    }

    // 加入服务器房间
    socket.join(`server:${config.id}`);

    // 连接到 RCON
    await rconService.connect(config);

    // 状态会通过 onStatusChange 回调广播
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

  // 断开 RCON 连接
  rconService.disconnect(serverId);

  // 离开服务器房间
  socket.leave(`server:${serverId}`);
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

  // 发送命令消息
  socket.emit('console:message', {
    id: generateId(),
    serverId,
    type: 'command',
    content: command,
    timestamp: new Date(),
  });

  const result = await rconService.send(serverId, command);

  // 发送响应消息
  socket.emit('console:message', {
    id: generateId(),
    serverId,
    type: result.success ? 'response' : 'error',
    content: result.response,
    timestamp: new Date(),
  });
}

/**
 * 处理测试连接
 */
async function handleTestConnection(
  socket: Socket,
  config: Partial<ServerConfig>
): Promise<void> {
  logger.info(`测试连接: ${config.host}:${config.rconPort}`);

  const testConfig: ServerConfig = {
    id: 'test',
    name: config.name ?? 'Test',
    host: config.host ?? 'localhost',
    rconPort: config.rconPort ?? 25575,
    rconPassword: config.rconPassword ?? '',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (config.sparkApiUrl) {
    testConfig.sparkApiUrl = config.sparkApiUrl;
  }

  const result = await rconService.testConnection(testConfig);

  socket.emit('server:testResult', {
    success: result.success,
    message: result.message,
    latency: result.latency,
  });
}

/**
 * 处理获取服务器列表
 */
function handleServersList(socket: Socket): void {
  sendCurrentStatus(socket);
}

/**
 * 处理添加服务器
 */
function handleAddServer(
  socket: Socket,
  config: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>
): void {
  const newConfig = configService.create(config);
  socket.emit('servers:added', { server: newConfig });

  // 广播给所有客户端
  socket.broadcast.emit('servers:added', { server: newConfig });
}

/**
 * 处理更新服务器配置
 */
function handleUpdateServer(
  socket: Socket,
  serverId: string,
  config: Partial<ServerConfig>
): void {
  const updated = configService.update(serverId, config);
  if (updated) {
    socket.emit('servers:updated', { server: updated });
    socket.broadcast.emit('servers:updated', { server: updated });
  } else {
    socket.emit('error', {
      message: `服务器配置不存在: ${serverId}`,
      code: 'CONFIG_NOT_FOUND',
    });
  }
}

/**
 * 处理删除服务器配置
 */
function handleDeleteServer(socket: Socket, serverId: string): void {
  // 先断开连接
  if (rconService.isConnected(serverId)) {
    rconService.disconnect(serverId);
  }

  const deleted = configService.delete(serverId);
  if (deleted) {
    socket.emit('servers:deleted', { serverId });
    socket.broadcast.emit('servers:deleted', { serverId });
  } else {
    socket.emit('error', {
      message: `服务器配置不存在: ${serverId}`,
      code: 'CONFIG_NOT_FOUND',
    });
  }
}

/**
 * 处理状态订阅
 */
function handleStatsSubscribe(socket: Socket, serverId: string): void {
  logger.info(`订阅状态更新: ${serverId}`);
  socket.join(`stats:${serverId}`);
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
