import type { AuthTokens, AuthUser } from '@/types'

const tokensStorageKey = 'mcsm_auth_tokens'
const userStorageKey = 'mcsm_auth_user'

type AuthState = {
  tokens: AuthTokens | null
  user: AuthUser | null
}

const listeners = new Set<(state: AuthState) => void>()

const loadFromStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const saveToStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

const removeFromStorage = (key: string) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage errors
  }
}

let state: AuthState = {
  tokens: loadFromStorage<AuthTokens>(tokensStorageKey),
  user: loadFromStorage<AuthUser>(userStorageKey),
}

const emitChange = () => {
  listeners.forEach((listener) => listener({ ...state }))
}

export const getAuthState = () => state

export const getAuthTokens = () => state.tokens

export const getAuthUser = () => state.user

export const setAuthTokens = (tokens: AuthTokens | null) => {
  state = { ...state, tokens }
  if (tokens) {
    saveToStorage(tokensStorageKey, tokens)
  } else {
    removeFromStorage(tokensStorageKey)
  }
  emitChange()
}

export const setAuthUser = (user: AuthUser | null) => {
  state = { ...state, user }
  if (user) {
    saveToStorage(userStorageKey, user)
  } else {
    removeFromStorage(userStorageKey)
  }
  emitChange()
}

export const clearAuth = () => {
  state = { tokens: null, user: null }
  removeFromStorage(tokensStorageKey)
  removeFromStorage(userStorageKey)
  emitChange()
}

export const subscribeAuth = (listener: (state: AuthState) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
