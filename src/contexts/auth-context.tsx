import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { AuthTokens, AuthUser, LoginRequest } from '@/types'
import {
  clearAuth,
  getAuthState,
  setAuthTokens,
  setAuthUser,
  subscribeAuth,
} from '@/services/auth.store'
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshTokens as refreshTokensRequest,
} from '@/services/auth.service'
import { socketService } from '@/services/socket.service'

type AuthContextValue = {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  loading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<AuthTokens | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState(getAuthState())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeAuth(setState)
  }, [])

  useEffect(() => {
    if (state.tokens?.socketToken) {
      socketService.setAuthToken(state.tokens.socketToken)
    }
  }, [state.tokens?.socketToken])

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const tokens = getAuthState().tokens
      if (tokens?.accessToken) {
        try {
          const user = await fetchMe(tokens.accessToken)
          if (isMounted) {
            setAuthUser(user)
          }
        } catch {
          if (isMounted) {
            clearAuth()
          }
        }
      }
      if (isMounted) {
        setLoading(false)
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (credentials: LoginRequest) => {
    const result = await loginRequest(credentials)
    setAuthTokens(result.tokens)
    setAuthUser(result.user)
    socketService.setAuthToken(result.tokens.socketToken)
  }

  const logout = async () => {
    const token = getAuthState().tokens?.accessToken
    try {
      if (token) {
        await logoutRequest(token)
      }
    } finally {
      clearAuth()
      socketService.disconnect()
    }
  }

  const refresh = async () => {
    const socketToken = getAuthState().tokens?.socketToken
    if (!socketToken) {
      return null
    }
    const tokens = await refreshTokensRequest(socketToken)
    setAuthTokens(tokens)
    socketService.setAuthToken(tokens.socketToken)
    return tokens
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      tokens: state.tokens,
      isAuthenticated: Boolean(state.tokens?.accessToken),
      loading,
      login,
      logout,
      refresh,
    }),
    [state.user, state.tokens, loading, login, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return context
}
