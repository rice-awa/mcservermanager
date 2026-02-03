/**
 * WebSocket 处理器
 * 处理客户端与服务器之间的实时通信
 * 与 docs/backend-integration.md 对接文档保持一致
 */
import type { Server as SocketServer, Socket } from 'socket.io';
import type {
  ServerConfig,
  ConsoleMessage,
  WSMessage,
  ConnectPayload,
  ExecuteCommandPayload,
  CommandOutputPayload,
  ErrorPayload,
} from '../types';
import { createLogger } from '../utils/logger';
import { rconService } from '../services/rcon.service';
import { configService } from '../services/config.service';
import { sparkService } from '../services/spark.service';
import { statsService } from '../services/stats.service';
import * as path from 'path';
import { loadConfig } from '../config';

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

    // ============ 对接文档 4.1 客户端 -> 服务端事件 ============

    /**
     * connect 事件（对接文档 4.1）
     * 传入配置 id 或完整配置
     */
    socket.on('connect', async (data: WSMessage<ConnectPayload>) => {
      const { configId } = data.payload;
      await handleServerConnect(socket, configId);
    });

    /**
     * executeCommand 事件（对接文档 4.1）
     * 发送控制台命令
     */
    socket.on('executeCommand', async (data: WSMessage<ExecuteCommandPayload>) => {
      const serverId = (socket as unknown as { currentServerId?: string }).currentServerId;
      if (!serverId) {
        emitError(socket, '未连接到服务器', 'NOT_CONNECTED');
        return;
      }
      await handleConsoleCommand(socket, serverId, data.payload.command);
    });

    // ============ 兼容旧版事件名称 ============

    // 连接服务器事件（兼容）
    socket.on('server:connect', async (data: { serverId: string; config?: Partial<ServerConfig> }) => {
      await handleServerConnect(socket, data.serverId, data.config);
    });

    // 断开服务器连接事件
    socket.on('server:disconnect', (data: { serverId: string }) => {
      handleServerDisconnect(socket, data.serverId);
    });

    // 控制台命令事件（兼容）
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
    socket.on('servers:add', (data: { config: Omit<ServerConfig, 'id'> }) => {
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
 * 发送错误消息（对接文档格式）
 */
function emitError(socket: Socket, message: string, code?: string): void {
  const payload: ErrorPayload = { message, code };
  socket.emit('error', { type: 'error', payload });
}

/**
 * 发送命令输出（对接文档 4.2）
 */
function emitCommandOutput(socket: Socket, message: ConsoleMessage): void {
  const payload: CommandOutputPayload = { message };
  socket.emit('commandOutput', { type: 'commandOutput', payload });
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
      // 如果没有配置但提供了配置信息，创建新配置
      const createConfig: Omit<ServerConfig, 'id'> = {
        name: configOverride.name ?? '未命名服务器',
        host: configOverride.host ?? 'localhost',
        port: configOverride.port ?? 25575,
        password: configOverride.password ?? '',
        timeout: configOverride.timeout,
        sparkApiUrl: configOverride.sparkApiUrl,
        serverDir: configOverride.serverDir,
      };
      config = configService.create(createConfig);
      serverId = config.id;
    }

    if (!config) {
      emitError(socket, `服务器配置不存在: ${serverId}`, 'CONFIG_NOT_FOUND');
      return;
    }

    // 保存当前连接的服务器ID
    (socket as unknown as { currentServerId: string }).currentServerId = config.id;

    // 加入服务器房间
    socket.join(`server:${config.id}`);

    // 连接到 RCON
    await rconService.connect(config);

    // 设置 Spark 服务的日志文件路径
    const appConfig = loadConfig();
    const logPath = config.serverDir
      ? path.join(config.serverDir, appConfig.logMonitor.logPath)
      : appConfig.logMonitor.logPath;
    sparkService.setLogPath(logPath);
    logger.debug(`设置 Spark 日志路径: ${logPath}`);

    // 启动状态采集
    statsService.startCollecting(config.id, appConfig.stats.updateInterval);

    // 状态会通过 onStatusChange 回调广播
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    emitError(socket, `连接服务器失败: ${message}`, 'CONNECTION_ERROR');
  }
}

/**
 * 处理服务器断开连接
 */
function handleServerDisconnect(socket: Socket, serverId: string): void {
  logger.info(`断开服务器: ${serverId}`);

  // 断开 RCON 连接
  rconService.disconnect(serverId);

  // 停止状态采集
  statsService.stopCollecting(serverId);

  // 离开服务器房间
  socket.leave(`server:${serverId}`);

  // 清除当前服务器ID
  delete (socket as unknown as { currentServerId?: string }).currentServerId;
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

  // 创建命令消息（对接文档格式）
  const commandMessage: ConsoleMessage = {
    id: generateId(),
    timestamp: Date.now(),
    type: 'command',
    content: command,
  };

  // 发送命令消息
  emitCommandOutput(socket, commandMessage);

  const result = await rconService.send(serverId, command);

  // 创建响应消息（对接文档格式）
  const outputMessage: ConsoleMessage = {
    id: generateId(),
    timestamp: Date.now(),
    type: result.success ? 'output' : 'error',
    content: result.response,
  };

  // 发送响应消息
  emitCommandOutput(socket, outputMessage);
}

/**
 * 处理测试连接
 */
async function handleTestConnection(
  socket: Socket,
  config: Partial<ServerConfig>
): Promise<void> {
  logger.info(`测试连接: ${config.host}:${config.port}`);

  const testConfig: ServerConfig = {
    id: 'test',
    name: config.name ?? 'Test',
    host: config.host ?? 'localhost',
    port: config.port ?? 25575,
    password: config.password ?? '',
    timeout: config.timeout,
    sparkApiUrl: config.sparkApiUrl,
  };

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
  config: Omit<ServerConfig, 'id'>
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
    emitError(socket, `服务器配置不存在: ${serverId}`, 'CONFIG_NOT_FOUND');
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

  // 停止状态采集
  statsService.stopCollecting(serverId);

  const deleted = configService.delete(serverId);
  if (deleted) {
    socket.emit('servers:deleted', { serverId });
    socket.broadcast.emit('servers:deleted', { serverId });
  } else {
    emitError(socket, `服务器配置不存在: ${serverId}`, 'CONFIG_NOT_FOUND');
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
