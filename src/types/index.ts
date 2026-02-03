// 服务器配置类型
export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  password: string
  timeout?: number
  sparkApiUrl?: string // Spark Mod API 地址
}

// 玩家信息类型
export interface Player {
  id: string
  name: string
  uuid: string
  onlineTime: number // 在线时长（秒）
  ping: number
  position?: {
    x: number
    y: number
    z: number
    dimension: string
  }
}

// 服务器状态类型
export interface ServerStats {
  tps: number
  cpu: number // CPU 占用率 (0-100)
  memory: {
    used: number
    max: number
    allocated: number
  }
  onlinePlayers: number
  maxPlayers: number
  loadedChunks: number
  version: string
  gamemode: string
  difficulty: string
}

// TPS 历史数据
export interface TPSData {
  timestamp: number
  tps: number
}

// 控制台消息类型
export interface ConsoleMessage {
  id: string
  timestamp: number
  type: 'system' | 'command' | 'output' | 'error' | 'chat' | 'join' | 'leave'
  content: string
  sender?: string
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'connect' | 'disconnect' | 'error' | 'executeCommand' | 'commandOutput' | 'statsUpdate' | 'playerUpdate' | 'ping' | 'pong'
  payload?: unknown
}

// 连接状态
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// 主题类型
export type Theme = 'light' | 'dark' | 'system'

// API 响应类型
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
  message?: string
  timestamp?: Date
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  timestamp?: Date
}
