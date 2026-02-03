/**
 * 后端类型定义
 */

// 服务器配置
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  rconPort: number;
  rconPassword: string;
  sparkApiUrl?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 连接状态
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// 服务器连接信息
export interface ServerConnection {
  serverId: string;
  status: ConnectionStatus;
  lastConnected?: Date;
  error?: string;
}

// RCON 命令执行结果
export interface CommandResult {
  success: boolean;
  response: string;
  timestamp: Date;
  executionTime: number;
}

// 控制台消息
export interface ConsoleMessage {
  id: string;
  serverId: string;
  type: 'command' | 'response' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

// TPS 数据
export interface TPSData {
  current: number;
  avg1m: number;
  avg5m: number;
  avg15m: number;
  timestamp: Date;
}

// 内存数据
export interface MemoryData {
  used: number;
  max: number;
  free: number;
  percentage: number;
  timestamp: Date;
}

// CPU 数据
export interface CPUData {
  processUsage: number;
  systemUsage: number;
  timestamp: Date;
}

// 服务器状态
export interface ServerStats {
  serverId: string;
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  tps?: TPSData;
  memory?: MemoryData;
  cpu?: CPUData;
  uptime?: number;
  timestamp: Date;
}

// 玩家信息
export interface PlayerInfo {
  uuid: string;
  name: string;
  displayName?: string;
  ping?: number;
  joinedAt?: Date;
  gameMode?: string;
  world?: string;
}

// WebSocket 事件类型
export interface SocketEvents {
  // 客户端 -> 服务器
  'server:connect': { serverId: string };
  'server:disconnect': { serverId: string };
  'console:command': { serverId: string; command: string };
  'stats:subscribe': { serverId: string };
  'stats:unsubscribe': { serverId: string };

  // 服务器 -> 客户端
  'server:status': ServerConnection;
  'console:message': ConsoleMessage;
  'stats:update': ServerStats;
  'error': { message: string; code?: string };
}

// 应用配置
export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rcon: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  stats: {
    updateInterval: number;
    historySize: number;
  };
}

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志条目
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: unknown;
}

// API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}

// 分页参数
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
