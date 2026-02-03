/**
 * API 客户端服务
 * 封装所有 REST API 调用，与后端对接文档保持一致
 */
import type {
  ServerConfig,
  Player,
  ServerStats,
  TPSData,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from '@/types'
import { getAuthTokens, setAuthTokens, clearAuth } from '@/services/auth.store'
import { refreshTokens } from '@/services/auth.service'
import { ApiError } from '@/services/api-error'

// API 基础配置
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * 玩家查询参数
 */
export interface PlayerQueryParams {
  q?: string
  status?: 'online' | 'offline' | 'all'
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'onlineTime' | 'ping'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 仪表盘历史数据
 */
export interface DashboardHistoryData {
  stats: ServerStats
  tpsHistory: TPSData[]
  cpuHistory: Array<{ timestamp: number; value: number }>
  memoryHistory: Array<{ timestamp: number; used: number; allocated: number }>
}

/**
 * 测试连接结果
 */
export interface TestConnectionResult {
  success: boolean
  message: string
  latency?: number
}

/**
 * 发送 HTTP 请求
 */
type FetchConfig = {
  requireAuth?: boolean
  retryOnAuthError?: boolean
}

const buildHeaders = (options: RequestInit, accessToken?: string | null) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' }
  const merged = {
    ...baseHeaders,
    ...(options.headers ?? {}),
  } as Record<string, string>
  if (accessToken) {
    merged.Authorization = `Bearer ${accessToken}`
  }
  return merged
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  config: FetchConfig = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const tokens = getAuthTokens()

  if (config.requireAuth && !tokens?.accessToken) {
    throw new ApiError('需要登录后访问', 'UNAUTHORIZED')
  }

  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options, tokens?.accessToken),
  })

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as ApiResponse<T>) : null

  if (!response.ok || !payload?.success) {
    const error = payload as ApiErrorResponse | null
    const errorCode = error?.error?.code
    const shouldRefresh =
      config.retryOnAuthError !== false &&
      tokens?.socketToken &&
      (response.status === 401 ||
        errorCode === 'INVALID_TOKEN' ||
        errorCode === 'UNAUTHORIZED' ||
        errorCode === 'TOKEN_EXPIRED' ||
        errorCode === 'MISSING_TOKEN')

    if (shouldRefresh) {
      try {
        const refreshed = await refreshTokens(tokens.socketToken)
        setAuthTokens(refreshed)
        return fetchApi(endpoint, options, {
          ...config,
          retryOnAuthError: false,
        })
      } catch (refreshError) {
        clearAuth()
        throw refreshError instanceof ApiError
          ? refreshError
          : new ApiError('登录状态已失效，请重新登录', 'UNAUTHORIZED')
      }
    }

    throw new ApiError(
      error?.error?.message || '请求失败',
      error?.error?.code,
      error?.error?.details
    )
  }

  return (payload as ApiSuccessResponse<T>)?.data as T
}

// ============ 配置管理 API（对接文档 3.1） ============

/**
 * 获取配置列表
 */
export async function getConfigs(): Promise<ServerConfig[]> {
  return fetchApi<ServerConfig[]>('/api/configs');
}

/**
 * 获取单个配置
 */
export async function getConfig(id: string): Promise<ServerConfig> {
  return fetchApi<ServerConfig>(`/api/configs/${id}`);
}

/**
 * 新建配置
 */
export async function createConfig(
  config: Omit<ServerConfig, 'id'>
): Promise<ServerConfig> {
  return fetchApi<ServerConfig>('/api/configs', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * 更新配置
 */
export async function updateConfig(
  id: string,
  config: Partial<ServerConfig>
): Promise<ServerConfig> {
  return fetchApi<ServerConfig>(`/api/configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/**
 * 删除配置
 */
export async function deleteConfig(id: string): Promise<void> {
  return fetchApi<void>(`/api/configs/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 测试连接
 */
export async function testConnection(
  id: string
): Promise<TestConnectionResult> {
  return fetchApi<TestConnectionResult>(`/api/configs/${id}/test`, {
    method: 'POST',
  });
}

// ============ 玩家管理 API（对接文档 3.2） ============

/**
 * 获取玩家列表（支持筛选与分页）
 */
export async function getPlayers(
  serverId: string,
  params?: PlayerQueryParams
): Promise<PaginatedResponse<Player>> {
  const queryParams = new URLSearchParams();
  queryParams.append('serverId', serverId);
  
  if (params?.q) queryParams.append('q', params.q);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  return fetchApi<PaginatedResponse<Player>>(`/api/players?${queryParams}`);
}

/**
 * 获取玩家数量
 */
export async function getPlayerCount(
  serverId: string
): Promise<{ online: number; max: number }> {
  const queryParams = new URLSearchParams({ serverId });
  return fetchApi<{ online: number; max: number }>(`/api/players/count?${queryParams}`);
}

// ============ 仪表盘数据 API（对接文档 3.3） ============

/**
 * 获取一次性快照
 */
export async function getStats(serverId: string): Promise<ServerStats> {
  const queryParams = new URLSearchParams({ serverId });
  return fetchApi<ServerStats>(`/api/stats?${queryParams}`);
}

/**
 * 获取历史曲线数据
 */
export async function getStatsHistory(
  serverId: string
): Promise<DashboardHistoryData> {
  const queryParams = new URLSearchParams({ serverId });
  return fetchApi<DashboardHistoryData>(`/api/stats/history?${queryParams}`);
}

// ============ 工具函数 ============

/**
 * 检查后端服务是否可用
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await fetch(`${API_BASE_URL}/health`);
    return true;
  } catch {
    return false;
  }
}
