/**
 * RCON 服务 - Minecraft 服务器远程控制
 * 实现连接管理、命令发送、连接池和断线重连
 */
import { Rcon } from 'rcon-client';
import type { ServerConfig, CommandResult, ConnectionStatus } from '../types';
import { createLogger } from '../utils/logger';
import { loadConfig } from '../config';

const logger = createLogger('RconService');
const appConfig = loadConfig();

// 连接信息接口
interface RconConnection {
  rcon: Rcon;
  config: ServerConfig;
  status: ConnectionStatus;
  lastActivity: Date;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
}

// 事件回调类型
type StatusChangeCallback = (serverId: string, status: ConnectionStatus, error?: string) => void;

export class RconService {
  // 连接池
  private connections: Map<string, RconConnection> = new Map();
  // 状态变化回调
  private statusCallbacks: Set<StatusChangeCallback> = new Set();
  // 配置
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor() {
    this.timeout = appConfig.rcon.timeout;
    this.retryAttempts = appConfig.rcon.retryAttempts;
    this.retryDelay = appConfig.rcon.retryDelay;
  }

  /**
   * 注册状态变化回调
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * 触发状态变化事件
   */
  private emitStatusChange(serverId: string, status: ConnectionStatus, error?: string): void {
    for (const callback of this.statusCallbacks) {
      try {
        callback(serverId, status, error);
      } catch (e) {
        logger.error('状态回调执行失败', e);
      }
    }
  }

  /**
   * 连接到 RCON 服务器
   */
  async connect(config: ServerConfig): Promise<void> {
    const { id: serverId, name, host, rconPort, rconPassword } = config;

    // 检查是否已连接
    const existing = this.connections.get(serverId);
    if (existing && existing.status === 'connected') {
      logger.warn(`服务器 ${name} 已连接，跳过重复连接`);
      return;
    }

    logger.info(`正在连接服务器: ${name} (${host}:${rconPort})`);
    this.emitStatusChange(serverId, 'connecting');

    try {
      const rcon = new Rcon({
        host,
        port: rconPort,
        password: rconPassword,
        timeout: this.timeout,
      });

      // 设置错误处理
      rcon.on('error', (error) => {
        logger.error(`RCON 错误 [${name}]: ${error.message}`);
        this.handleDisconnect(serverId, error.message);
      });

      // 设置关闭处理
      rcon.on('end', () => {
        logger.info(`RCON 连接关闭 [${name}]`);
        this.handleDisconnect(serverId, '连接已关闭');
      });

      // 连接
      await rcon.connect();

      // 保存连接
      const connection: RconConnection = {
        rcon,
        config,
        status: 'connected',
        lastActivity: new Date(),
        reconnectAttempts: 0,
      };
      this.connections.set(serverId, connection);

      logger.info(`服务器连接成功: ${name}`);
      this.emitStatusChange(serverId, 'connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      logger.error(`连接服务器失败 [${name}]: ${message}`);
      this.emitStatusChange(serverId, 'error', message);
      throw error;
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(serverId: string, reason: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    // 如果状态已经是断开或错误，跳过
    if (connection.status === 'disconnected' || connection.status === 'error') {
      return;
    }

    connection.status = 'disconnected';
    this.emitStatusChange(serverId, 'disconnected', reason);

    // 如果配置了自动重连，尝试重连
    if (connection.config.enabled && connection.reconnectAttempts < this.retryAttempts) {
      this.scheduleReconnect(serverId);
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    // 清除现有的重连定时器
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }

    connection.reconnectAttempts++;
    const delay = this.retryDelay * connection.reconnectAttempts;

    logger.info(`计划重连服务器 ${connection.config.name}，${delay}ms 后尝试（第 ${connection.reconnectAttempts} 次）`);

    connection.reconnectTimer = setTimeout(async () => {
      try {
        await this.reconnect(serverId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        logger.error(`重连失败 [${connection.config.name}]: ${message}`);

        // 继续尝试重连
        if (connection.reconnectAttempts < this.retryAttempts) {
          this.scheduleReconnect(serverId);
        } else {
          logger.error(`重连次数已达上限 [${connection.config.name}]`);
          this.emitStatusChange(serverId, 'error', '重连失败次数已达上限');
        }
      }
    }, delay);
  }

  /**
   * 重新连接
   */
  private async reconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    logger.info(`正在重连服务器: ${connection.config.name}`);
    this.emitStatusChange(serverId, 'connecting');

    try {
      // 先清理旧连接
      try {
        connection.rcon.end();
      } catch {
        // 忽略清理错误
      }

      // 创建新连接
      const rcon = new Rcon({
        host: connection.config.host,
        port: connection.config.rconPort,
        password: connection.config.rconPassword,
        timeout: this.timeout,
      });

      rcon.on('error', (error) => {
        logger.error(`RCON 错误 [${connection.config.name}]: ${error.message}`);
        this.handleDisconnect(serverId, error.message);
      });

      rcon.on('end', () => {
        logger.info(`RCON 连接关闭 [${connection.config.name}]`);
        this.handleDisconnect(serverId, '连接已关闭');
      });

      await rcon.connect();

      // 更新连接
      connection.rcon = rcon;
      connection.status = 'connected';
      connection.lastActivity = new Date();
      connection.reconnectAttempts = 0;

      logger.info(`重连成功: ${connection.config.name}`);
      this.emitStatusChange(serverId, 'connected');
    } catch (error) {
      throw error;
    }
  }

  /**
   * 发送命令
   */
  async send(serverId: string, command: string): Promise<CommandResult> {
    const startTime = Date.now();
    const connection = this.connections.get(serverId);

    if (!connection) {
      return {
        success: false,
        response: `服务器 ${serverId} 未连接`,
        timestamp: new Date(),
        executionTime: 0,
      };
    }

    if (connection.status !== 'connected') {
      return {
        success: false,
        response: `服务器 ${connection.config.name} 当前状态: ${connection.status}`,
        timestamp: new Date(),
        executionTime: 0,
      };
    }

    logger.debug(`发送命令 [${connection.config.name}]: ${command}`);

    try {
      const response = await this.sendWithRetry(connection, command);
      connection.lastActivity = new Date();

      const executionTime = Date.now() - startTime;
      logger.debug(`命令执行完成 [${connection.config.name}], 耗时: ${executionTime}ms`);

      return {
        success: true,
        response: this.parseResponse(response),
        timestamp: new Date(),
        executionTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      const executionTime = Date.now() - startTime;

      logger.error(`命令执行失败 [${connection.config.name}]: ${message}`);

      return {
        success: false,
        response: `命令执行失败: ${message}`,
        timestamp: new Date(),
        executionTime,
      };
    }
  }

  /**
   * 带重试的命令发送
   */
  private async sendWithRetry(connection: RconConnection, command: string, attempt: number = 1): Promise<string> {
    try {
      return await connection.rcon.send(command);
    } catch (error) {
      if (attempt < this.retryAttempts) {
        logger.warn(`命令发送失败，尝试重试 (${attempt}/${this.retryAttempts})`);
        await this.delay(this.retryDelay);
        return this.sendWithRetry(connection, command, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * 解析 RCON 响应
   * 处理 Minecraft 颜色代码等
   */
  private parseResponse(response: string): string {
    // 移除 Minecraft 颜色代码 (§ 后跟一个字符)
    let parsed = response.replace(/§[0-9a-fk-or]/gi, '');

    // 移除其他控制字符
    parsed = parsed.replace(/[\x00-\x1F\x7F]/g, '');

    // 清理多余空白
    parsed = parsed.trim();

    return parsed || '(无响应)';
  }

  /**
   * 断开连接
   */
  disconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) {
      logger.warn(`服务器 ${serverId} 不存在`);
      return;
    }

    logger.info(`断开服务器连接: ${connection.config.name}`);

    // 清除重连定时器
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }

    // 关闭连接
    try {
      connection.rcon.end();
    } catch {
      // 忽略关闭错误
    }

    // 移除连接
    this.connections.delete(serverId);
    this.emitStatusChange(serverId, 'disconnected');
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    logger.info('断开所有服务器连接');
    for (const serverId of this.connections.keys()) {
      this.disconnect(serverId);
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    return connection?.status === 'connected';
  }

  /**
   * 获取连接状态
   */
  getStatus(serverId: string): ConnectionStatus {
    const connection = this.connections.get(serverId);
    return connection?.status ?? 'disconnected';
  }

  /**
   * 获取所有连接信息
   */
  getAllConnections(): Array<{
    serverId: string;
    name: string;
    status: ConnectionStatus;
    lastActivity: Date;
  }> {
    return Array.from(this.connections.entries()).map(([serverId, conn]) => ({
      serverId,
      name: conn.config.name,
      status: conn.status,
      lastActivity: conn.lastActivity,
    }));
  }

  /**
   * 测试连接
   */
  async testConnection(config: ServerConfig): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();

    try {
      const rcon = new Rcon({
        host: config.host,
        port: config.rconPort,
        password: config.rconPassword,
        timeout: this.timeout,
      });

      await rcon.connect();
      const response = await rcon.send('list');
      rcon.end();

      const latency = Date.now() - startTime;

      return {
        success: true,
        message: `连接成功: ${this.parseResponse(response)}`,
        latency,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        message: `连接失败: ${message}`,
      };
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const rconService = new RconService();
export default rconService;
