import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthTokens,
  AuthUser,
  LoginRequest,
} from '@/types'
import { ApiError } from '@/services/api-error'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

const requestAuth = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as ApiResponse<T>) : null

  if (!response.ok || !payload?.success) {
    const error = payload as ApiErrorResponse | null
    throw new ApiError(
      error?.error?.message || '请求失败',
      error?.error?.code,
      error?.error?.details
    )
  }

  return (payload as ApiSuccessResponse<T>).data as T
}

export const login = async (
  credentials: LoginRequest
): Promise<{ user: AuthUser; tokens: AuthTokens }> => {
  const data = await requestAuth<{ user: AuthUser; tokens: AuthTokens }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    }
  )

  return {
    user: {
      id: data.user.id,
      username: data.user.username,
      role: data.user.role,
      createdAt: data.user.createdAt,
    },
    tokens: data.tokens,
  }
}

export const fetchMe = async (accessToken: string): Promise<AuthUser> => {
  const data = await requestAuth<{
    userId: string
    username: string
    role: string
  }>('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return {
    id: data.userId,
    username: data.username,
    role: data.role as AuthUser['role'],
  }
}

export const refreshTokens = async (
  socketToken: string
): Promise<AuthTokens> => {
  return requestAuth<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ socketToken }),
  })
}

export const logout = async (accessToken: string): Promise<void> => {
  await requestAuth<void>('/api/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
