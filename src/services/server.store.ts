import type { ConnectionStatus, ServerConfig } from '@/types'

const activeServerStorageKey = 'mcsm_active_server_id'

type ServerState = {
  activeServerId: string | null
  activeServerName: string | null
  connectionStatus: ConnectionStatus
  statusMessage: string
  configs: ServerConfig[]
}

const listeners = new Set<(state: ServerState) => void>()

const getStoredActiveId = () => {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(activeServerStorageKey)
}

const saveActiveId = (id: string | null) => {
  if (typeof window === 'undefined') {
    return
  }
  if (id) {
    window.localStorage.setItem(activeServerStorageKey, id)
  } else {
    window.localStorage.removeItem(activeServerStorageKey)
  }
}

let state: ServerState = {
  activeServerId: getStoredActiveId(),
  activeServerName: null,
  connectionStatus: 'disconnected',
  statusMessage: '未连接',
  configs: [],
}

const emitChange = () => {
  listeners.forEach((listener) => listener({ ...state }))
}

const syncActiveName = () => {
  if (!state.activeServerId) {
    state = { ...state, activeServerName: null }
    return
  }
  const match = state.configs.find((config) => config.id === state.activeServerId)
  state = { ...state, activeServerName: match?.name ?? state.activeServerName }
}

export const getServerState = () => state

export const setServerConfigs = (configs: ServerConfig[]) => {
  state = { ...state, configs }
  syncActiveName()
  emitChange()
}

export const setActiveServer = (serverId: string | null) => {
  state = { ...state, activeServerId: serverId }
  saveActiveId(serverId)
  syncActiveName()
  emitChange()
}

export const setConnectionStatus = (
  status: ConnectionStatus,
  message?: string
) => {
  state = {
    ...state,
    connectionStatus: status,
    statusMessage: message ?? state.statusMessage,
  }
  emitChange()
}

export const setStatusMessage = (message: string) => {
  state = { ...state, statusMessage: message }
  emitChange()
}

export const subscribeServer = (listener: (state: ServerState) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
