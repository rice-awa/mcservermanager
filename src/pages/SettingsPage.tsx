import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus, ServerConfig } from '@/types'
import {
  createConfig,
  deleteConfig,
  getConfigs,
  updateConfig,
} from '@/services/api.service'
import {
  createConnectionFormState,
  type ConnectionFormState,
} from '@/services/connection-form'
import { socketService } from '@/services/socket.service'
import { useAuth } from '@/contexts/auth-context'
import { useServerState } from '@/hooks/use-server'
import {
  setActiveServer,
  setConnectionStatus,
  setServerConfigs,
  setStatusMessage,
} from '@/services/server.store'

const statusMeta: Record<
  ConnectionStatus,
  { label: string; color: string; dot: string }
> = {
  disconnected: {
    label: '未连接',
    color: 'text-muted-foreground',
    dot: 'bg-gray-400',
  },
  connecting: {
    label: '连接中',
    color: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  connected: {
    label: '已连接',
    color: 'text-emerald-500',
    dot: 'bg-emerald-500',
  },
  error: {
    label: '连接失败',
    color: 'text-destructive',
    dot: 'bg-destructive',
  },
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) {
    return '--'
  }
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function SettingsPage() {
  const { tokens } = useAuth()
  const {
    configs,
    activeServerId,
    connectionStatus,
    statusMessage,
  } = useServerState()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ConnectionFormState>(() =>
    createConnectionFormState()
  )
  const [lastAttempt, setLastAttempt] = useState<number | undefined>()
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [requestPending, setRequestPending] = useState(false)
  const [reconnectPending, setReconnectPending] = useState(false)
  const reconnectTimerRef = useRef<number | null>(null)

  const activeConfig = useMemo(
    () => configs.find((config) => config.id === activeServerId),
    [configs, activeServerId]
  )

  useEffect(() => {
    socketService.connect(undefined, tokens?.socketToken)

    const isStatusPayload = (
      value: unknown
    ): value is {
      serverId: string
      status: ConnectionStatus
      error?: string
    } => {
      if (!value || typeof value !== 'object') {
        return false
      }
      const data = value as {
        serverId?: unknown
        status?: unknown
        error?: unknown
      }
      return (
        typeof data.serverId === 'string' &&
        typeof data.status === 'string' &&
        (data.error === undefined || typeof data.error === 'string')
      )
    }

    const handleStatus = (...args: unknown[]) => {
      const [data] = args
      if (!isStatusPayload(data)) {
        return
      }
      if (data.serverId !== activeServerId) {
        return
      }
      const message = data.error
        ? `连接失败：${data.error}`
        : data.status === 'connected'
          ? '连接成功'
          : data.status === 'connecting'
            ? '正在连接服务器...'
            : '已断开连接'
      setConnectionStatus(data.status, message)
      if (data.status === 'error' && autoReconnect) {
        scheduleReconnect(data.serverId)
      }
    }

    socketService.on('server:status', handleStatus)

    return () => {
      socketService.off('server:status', handleStatus)
    }
  }, [tokens?.socketToken, activeServerId, autoReconnect])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!autoReconnect && reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
      setReconnectPending(false)
    }
  }, [autoReconnect])

  useEffect(() => {
    let isMounted = true

    const loadConfigs = async () => {
      try {
        const data = await getConfigs()
        if (!isMounted) {
          return
        }
        setServerConfigs(data)
        if (data.length > 0) {
          const preferredId = activeServerId ?? data[0]?.id ?? null
          if (preferredId) {
            const preferredConfig = data.find((item) => item.id === preferredId)
            setEditingId(preferredId)
            setForm(createConnectionFormState(preferredConfig))
          }
        }
      } catch {
        // ignore load failure
      }
    }

    loadConfigs()

    return () => {
      isMounted = false
    }
  }, [activeServerId])

  const buildConfigPayload = (): Omit<ServerConfig, 'id'> => ({
    name: form.name.trim() || '未命名服务器',
    host: form.host.trim(),
    port: Number.isFinite(form.port) ? form.port : 25575,
    password: form.password,
    timeout: Number.isFinite(form.timeout) ? form.timeout : 5000,
    sparkApiUrl: form.sparkApiUrl.trim() || undefined,
    serverDir: form.serverDir?.trim() || undefined,
  })

  const scheduleReconnect = (serverId: string) => {
    if (!autoReconnect) {
      return
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
    }
    setReconnectPending(true)
    reconnectTimerRef.current = window.setTimeout(() => {
      setReconnectPending(false)
      reconnectTimerRef.current = null
      connectServerById(serverId)
    }, 5000)
  }

  const handleTestConnection = async () => {
    setRequestPending(true)
    setConnectionStatus('connecting', '测试连接中...')
    setLastAttempt(Date.now())

    try {
      socketService.connect(undefined, tokens?.socketToken)
      const result = await socketService.requestTestConnection(
        buildConfigPayload()
      )
      if (result.success) {
        setConnectionStatus('connected', result.message)
      } else {
        setConnectionStatus('error', result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '测试失败'
      setConnectionStatus('error', message)
    } finally {
      setRequestPending(false)
    }
  }

  const handleSave = async () => {
    setRequestPending(true)
    try {
      const payload = buildConfigPayload()
      let nextConfig: ServerConfig

      if (editingId) {
        nextConfig = await updateConfig(editingId, payload)
      } else {
        nextConfig = await createConfig(payload)
      }

      const nextConfigs = editingId
        ? configs.map((item) => (item.id === nextConfig.id ? nextConfig : item))
        : [...configs, nextConfig]

      setServerConfigs(nextConfigs)
      setEditingId(nextConfig.id)
      setForm(createConnectionFormState(nextConfig))
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      setConnectionStatus('error', message)
    } finally {
      setRequestPending(false)
    }
  }

  const connectServerById = (serverId: string) => {
    setConnectionStatus('connecting', '正在连接服务器...')
    setStatusMessage('正在连接服务器...')
    setLastAttempt(Date.now())
    socketService.connect(undefined, tokens?.socketToken)
    socketService.connectToServer(serverId)
    setActiveServer(serverId)
  }

  const handleConnectServer = async () => {
    setRequestPending(true)
    try {
      const payload = buildConfigPayload()
      let nextConfig: ServerConfig

      if (editingId) {
        nextConfig = await updateConfig(editingId, payload)
        const nextConfigs = configs.map((item) =>
          item.id === nextConfig.id ? nextConfig : item
        )
        setServerConfigs(nextConfigs)
      } else {
        nextConfig = await createConfig(payload)
        const nextConfigs = [...configs, nextConfig]
        setServerConfigs(nextConfigs)
        setEditingId(nextConfig.id)
      }

      connectServerById(nextConfig.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      setConnectionStatus('error', message)
    } finally {
      setRequestPending(false)
    }
  }

  const handleEdit = (config: ServerConfig) => {
    setEditingId(config.id)
    setForm(createConnectionFormState(config))
  }

  const handleDelete = async (configId: string) => {
    await deleteConfig(configId)
    const nextConfigs = configs.filter((item) => item.id !== configId)
    setServerConfigs(nextConfigs)

    if (editingId === configId) {
      setEditingId(null)
      setForm(createConnectionFormState())
    }
    if (activeServerId === configId) {
      setActiveServer(null)
      setConnectionStatus('disconnected', '当前连接已断开')
      setStatusMessage('当前连接已断开')
    }
  }

  const handleQuickSwitch = (config: ServerConfig) => {
    setEditingId(config.id)
    setForm(createConnectionFormState(config))
    connectServerById(config.id)
  }

  const statusBadge = statusMeta[connectionStatus]
  const activeName =
    activeConfig?.name ?? (activeServerId ? form.name || '未保存配置' : '未选择')

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">连接管理</h1>
          <p className="mt-2 text-muted-foreground">服务器连接配置与状态</p>
        </div>
        <Badge variant="outline" className={cn('text-xs', statusBadge.color)}>
          <span className={cn('mr-1.5 h-2 w-2 rounded-full', statusBadge.dot)} />
          {statusBadge.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">连接配置</div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              配置名称
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="例如：生产服务器"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              服务器地址
              <input
                value={form.host}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, host: event.target.value }))
                }
                placeholder="IP 或域名"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              RCON 端口
              <input
                type="number"
                value={form.port}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    port: Number(event.target.value),
                  }))
                }
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              密码
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="RCON 密码"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              连接超时 (ms)
              <input
                type="number"
                value={form.timeout}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    timeout: Number(event.target.value),
                  }))
                }
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Spark API 地址
              <input
                value={form.sparkApiUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sparkApiUrl: event.target.value }))
                }
                placeholder="http://host:port/spark"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={requestPending}
              className={cn(
                'h-9 rounded-md border px-4 text-sm font-medium transition-colors',
                requestPending
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              )}
            >
              测试连接
            </button>
            <button
              type="button"
              onClick={() => void handleConnectServer()}
              disabled={requestPending}
              className={cn(
                'h-9 rounded-md px-4 text-sm font-medium transition-colors',
                requestPending
                  ? 'cursor-not-allowed bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              连接服务器
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              保存配置
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setForm(createConnectionFormState())
              }}
              className="h-9 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              新建配置
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 text-sm font-medium">连接状态</div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">当前服务器</span>
              <span className="font-medium">{activeName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">状态消息</span>
              <span className={cn('font-medium', statusBadge.color)}>
                {statusMessage}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">最后尝试</span>
              <span className="font-medium">{formatTime(lastAttempt)}</span>
            </div>
            <label className="flex items-center justify-between">
              <span className="text-muted-foreground">自动重连</span>
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(event) => setAutoReconnect(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
            {reconnectPending ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                自动重连将在 5 秒后尝试。
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          已保存配置
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">地址</th>
                <th className="px-4 py-3">端口</th>
                <th className="px-4 py-3">超时</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const isActive = config.id === activeServerId
                return (
                  <tr
                    key={config.id}
                    className="border-t border-border transition-colors hover:bg-accent/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {isActive ? (
                          <Badge variant="outline" className="text-[10px]">
                            当前
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {config.host}
                    </td>
                    <td className="px-4 py-3">{config.port}</td>
                    <td className="px-4 py-3">{config.timeout ?? '--'} ms</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {isActive ? statusBadge.label : '未连接'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(config)}
                          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickSwitch(config)}
                          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          切换
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(config.id)}
                          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {configs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    暂无连接配置，请先创建。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
