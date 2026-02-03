/**
 * WebSocket 服务
 * 封装 Socket.IO 连接和事件处理，与后端对接文档保持一致
 */
import { io, Socket } from 'socket.io-client';
import type { 
  ConsoleMessage, 
  ServerStats, 
  Player, 
  ConnectionStatus 
} from '@/types';

// WebSocket 基础配置
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

/**
 * WebSocket 事件回调类型
 */
export interface SocketEventCallbacks {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onConsoleMessage?: (message: ConsoleMessage) => void;
  onStatsUpdate?: (stats: ServerStats) => void;
  onPlayerUpdate?: (players: Player[]) => void;
  onConnectionStatus?: (status: ConnectionStatus, message?: string) => void;
}

/**
 * WebSocket 服务类
 * 单例模式，全局只有一个实例
 */
class SocketService {
  private socket: Socket | null = null;
  private callbacks: SocketEventCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentServerId: string | null = null;

  /**
   * 连接到 WebSocket 服务器
   */
  connect(callbacks?: SocketEventCallbacks): void {
    if (this.socket?.connected) {
      console.log('[SocketService] Already connected');
      return;
    }

    // 合并回调
    if (callbacks) {
      this.callbacks = { ...this.callbacks, ...callbacks };
    }

    // 创建 Socket.IO 连接
    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventHandlers();
    console.log('[SocketService] Connecting to:', WS_URL);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentServerId = null;
      console.log('[SocketService] Disconnected');
    }
  }

  /**
   * 判断是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * 更新事件回调
   */
  setCallbacks(callbacks: SocketEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 设置事件监听器
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('[SocketService] Connected, socket ID:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    });

    // 断开连接
    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketService] Disconnected:', reason);
      this.callbacks.onDisconnect?.(reason);
    });

    // 连接错误
    this.socket.on('connect_error', (error: Error) => {
      console.error('[SocketService] Connection error:', error.message);
      this.reconnectAttempts++;
      this.callbacks.onError?.(error);
    });

    // 重连失败
    this.socket.on('reconnect_failed', () => {
      console.error('[SocketService] Reconnection failed after max attempts');
      const error = new Error('无法连接到服务器');
      this.callbacks.onError?.(error);
    });

    // ============ 业务事件（对接文档 4.2） ============

    // 控制台消息输出
    this.socket.on('commandOutput', (data: { type: string; payload: { message: ConsoleMessage } }) => {
      console.log('[SocketService] Console message:', data.payload.message);
      this.callbacks.onConsoleMessage?.(data.payload.message);
    });

    // 服务器状态更新
    this.socket.on('statsUpdate', (data: { type: string; payload: { stats: ServerStats } }) => {
      console.log('[SocketService] Stats update:', data.payload.stats);
      this.callbacks.onStatsUpdate?.(data.payload.stats);
    });

    // 玩家列表更新
    this.socket.on('playerUpdate', (data: { type: string; payload: { items: Player[] } }) => {
      console.log('[SocketService] Player update:', data.payload.items);
      this.callbacks.onPlayerUpdate?.(data.payload.items);
    });

    // 错误消息
    this.socket.on('error', (data: { type: string; payload: { message: string; code?: string } }) => {
      console.error('[SocketService] Server error:', data.payload.message);
      const error = new Error(data.payload.message);
      this.callbacks.onError?.(error);
    });

    // 服务器连接状态变化
    this.socket.on('server:status', (data: { serverId: string; status: ConnectionStatus; message?: string }) => {
      console.log('[SocketService] Server status:', data);
      this.callbacks.onConnectionStatus?.(data.status, data.message);
    });
  }

  // ============ 发送事件到服务器（对接文档 4.1） ============

  /**
   * 连接到 MC 服务器
   */
  connectToServer(serverId: string): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Not connected to WebSocket server');
      return;
    }

    console.log('[SocketService] Connecting to server:', serverId);
    this.currentServerId = serverId;
    this.socket.emit('server:connect', { serverId });
  }

  /**
   * 断开 MC 服务器连接
   */
  disconnectFromServer(serverId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    console.log('[SocketService] Disconnecting from server:', serverId);
    this.socket.emit('server:disconnect', { serverId });
    this.currentServerId = null;
  }

  /**
   * 执行控制台命令
   */
  executeCommand(serverId: string, command: string): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Not connected to WebSocket server');
      return;
    }

    console.log('[SocketService] Executing command:', command);
    this.socket.emit('console:command', { serverId, command });
  }

  /**
   * 订阅服务器状态更新
   */
  subscribeStats(serverId: string): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Not connected to WebSocket server');
      return;
    }

    console.log('[SocketService] Subscribing to stats:', serverId);
    this.socket.emit('stats:subscribe', { serverId });
  }

  /**
   * 取消订阅服务器状态更新
   */
  unsubscribeStats(serverId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    console.log('[SocketService] Unsubscribing from stats:', serverId);
    this.socket.emit('stats:unsubscribe', { serverId });
  }

  /**
   * 测试服务器连接
   */
  testConnection(config: unknown): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Not connected to WebSocket server');
      return;
    }

    console.log('[SocketService] Testing connection');
    this.socket.emit('server:test', config);
  }

  /**
   * 获取当前连接的服务器 ID
   */
  getCurrentServerId(): string | null {
    return this.currentServerId;
  }

  /**
   * 发送自定义事件
   */
  emit(event: string, data?: unknown): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Not connected to WebSocket server');
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * 监听自定义事件
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.socket) {
      console.error('[SocketService] Socket not initialized');
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }
}

// 导出单例实例
export const socketService = new SocketService();
export default socketService;
