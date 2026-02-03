/**
 * 后端类型定义
 * 与 docs/backend-integration.md 对接文档保持一致
 */

// ============ 对接文档规范类型 ============

/**
 * 服务器配置（与对接文档 3.1 一致）
 */
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;           // RCON 端口
  password: string;       // RCON 密码
  timeout?: number | undefined;       // 连接超时（毫秒）
  sparkApiUrl?: string | undefined;   // Spark Mod API 地址
}

/**
 * 内部存储的服务器配置（带时间戳）
 */
export interface ServerConfigInternal extends ServerConfig {
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
  timeout?: number | undefined;
  sparkApiUrl?: string | undefined;
}

/**
 * 玩家信息（与对接文档 2 一致）
 */
export interface Player {
  id: string;
  name: string;
  uuid: string;
  onlineTime: number;     // 在线时间（秒）
  ping: number;           // 延迟（毫秒）
  position?: {
    x: number;
    y: number;
    z: number;
    dimension: string;
  };
}

/**
 * 服务器状态（与对接文档 2 一致）
 */
export interface ServerStats {
  tps: number;
  cpu: number;            // CPU 使用率百分比
  memory: {
    used: number;         // 已使用内存（MB）
    max: number;          // 最大内存（MB）
    allocated: number;    // 已分配内存（MB）
  };
  onlinePlayers: number;
  maxPlayers: number;
  loadedChunks: number;
  version: string;
  gamemode: string;
  difficulty: string;
}

/**
 * TPS 数据（与对接文档 2 一致）
 */
export interface TPSData {
  timestamp: number;
  tps: number;
}

/**
 * CPU 历史数据
 */
export interface CPUData {
  timestamp: number;
  value: number;
}

/**
 * 内存历史数据
 */
export interface MemoryHistoryData {
  timestamp: number;
  used: number;
  allocated: number;
}

/**
 * 控制台消息（与对接文档 2 一致）
 */
export interface ConsoleMessage {
  id: string;
  timestamp: number;
  type: 'system' | 'command' | 'output' | 'error' | 'chat' | 'join' | 'leave';
  content: string;
  sender?: string;
}

/**
 * 连接状态（与对接文档 2 一致）
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============ WebSocket 消息类型（与对接文档 4 一致） ============

/**
 * WebSocket 消息基础结构
 */
export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
}

/**
 * 连接请求 payload
 */
export interface ConnectPayload {
  configId: string;
}

/**
 * 执行命令 payload
 */
export interface ExecuteCommandPayload {
  command: string;
}

/**
 * 命令输出 payload
 */
export interface CommandOutputPayload {
  message: ConsoleMessage;
}

/**
 * 状态更新 payload
 */
export interface StatsUpdatePayload {
  stats: ServerStats;
}

/**
 * 玩家更新 payload
 */
export interface PlayerUpdatePayload {
  items: Player[];
}

/**
 * 错误 payload
 */
export interface ErrorPayload {
  message: string;
  code?: string | undefined;
}

// ============ REST API 响应类型（与对接文档 3、5 一致） ============

/**
 * API 成功响应
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  timestamp?: Date;
}

/**
 * API 错误响应（与对接文档 5 一致）
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: Date;
}

/**
 * 通用 API 响应
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 分页响应（与对接文档 3.2 一致）
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 仪表盘数据响应（与对接文档 3.3 一致）
 */
export interface DashboardStatsResponse {
  stats: ServerStats;
  tpsHistory: TPSData[];
  cpuHistory: CPUData[];
  memoryHistory: MemoryHistoryData[];
}

/**
 * 玩家查询参数（与对接文档 3.2 一致）
 */
export interface PlayerQueryParams {
  q?: string;                           // 按名称搜索
  status?: 'online' | 'offline' | 'all';
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'onlineTime' | 'ping';
  sortOrder?: 'asc' | 'desc';
}

// ============ Spark API 类型 ============

/**
 * Spark TPS 统计窗口
 */
export interface SparkTPSStats {
  last5s: number;
  last10s: number;
  last1m: number;
  last5m: number;
  last15m: number;
}

/**
 * Spark MSPT 统计（毫秒/tick）
 */
export interface SparkMSPTStats {
  min: number;
  median: number;
  percentile95: number;
  max: number;
}

/**
 * Spark CPU 统计（百分比）
 */
export interface SparkCPUStats {
  process: {
    last10s: number;
    last1m: number;
    last15m: number;
  };
  system: {
    last10s: number;
    last1m: number;
    last15m: number;
  };
}

/**
 * Spark 内存统计（MB）
 */
export interface SparkMemoryStats {
  used: number;
  allocated: number;
  max: number;
}

/**
 * Spark 磁盘统计（GB）
 */
export interface SparkDiskStats {
  used: number;
  total: number;
}

/**
 * 完整 Spark 健康报告
 */
export interface SparkHealthReport {
  tps: SparkTPSStats;
  mspt: SparkMSPTStats;
  cpu: SparkCPUStats;
  memory: SparkMemoryStats;
  disk?: SparkDiskStats;
  timestamp: number;
}

/**
 * Spark 配置
 */
export interface SparkConfig {
  preferRcon: boolean;       // 优先使用 RCON 方案
  reportCacheTTL: number;    // 报告缓存时间（毫秒）
  timeout: number;           // API 请求超时（毫秒）
}

// ============ 内部使用类型 ============

/**
 * RCON 命令执行结果
 */
export interface CommandResult {
  success: boolean;
  response: string;
  timestamp: Date;
  executionTime: number;
}

/**
 * 服务器连接信息
 */
export interface ServerConnection {
  serverId: string;
  status: ConnectionStatus;
  lastConnected?: Date;
  lastActivity?: Date;
  error?: string;
}

/**
 * 应用配置
 */
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
  spark: SparkConfig;
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志条目
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: unknown;
}

/**
 * 连接测试结果
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  latency?: number;
}

// ============ 认证类型 ============

export type {
  User,
  LoginRequest,
  TokenPayload,
  AuthTokens,
  LoginResponse,
  AuthenticatedRequest,
} from './auth';
