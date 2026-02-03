import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus, ServerConfig } from '@/types'
import {
  createConnectionFormState,
  getMockConnectionConfigs,
  simulateConnectionTest,
  type ConnectionFormState,
} from '@/services/mock'

const defaultConfigs = getMockConnectionConfigs()

const createConfigId = (() => {
  let seed = 0
  return () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    seed += 1
    return `config-${Date.now()}-${seed}`
  }
})()

const statusMeta: Record<ConnectionStatus, { label: string; color: string; dot: string }> = {
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
  const [configs, setConfigs] = useState<ServerConfig[]>(() =>
    defaultConfigs.map((config) => ({ ...config }))
  )
  const [editingId, setEditingId] = useState<string | null>(
    defaultConfigs[0]?.id ?? null
  )
  const [activeId, setActiveId] = useState<string | null>(
    defaultConfigs[0]?.id ?? null
  )
  const [form, setForm] = useState<ConnectionFormState>(() =>
    createConnectionFormState(defaultConfigs[0])
  )
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [statusMessage, setStatusMessage] = useState('等待连接')
  const [lastAttempt, setLastAttempt] = useState<number | undefined>()
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [requestPending, setRequestPending] = useState(false)
  const [reconnectPending, setReconnectPending] = useState(false)
  const reconnectTimerRef = useRef<number | null>(null)

  const activeConfig = useMemo(
    () => configs.find((config) => config.id === activeId),
    [configs, activeId]
  )

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

  const buildConfigFromForm = (id?: string): ServerConfig => ({
    id: id ?? createConfigId(),
    name: form.name.trim() || '未命名服务器',
    host: form.host.trim(),
    port: Number.isFinite(form.port) ? form.port : 25575,
    password: form.password,
    timeout: Number.isFinite(form.timeout) ? form.timeout : 5000,
    sparkApiUrl: form.sparkApiUrl.trim() || undefined,
  })

  const scheduleReconnect = (config: ServerConfig) => {
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
      void runConnectionTest(config, true)
    }, 5000)
  }

  const runConnectionTest = async (config: ServerConfig, activate: boolean) => {
    setRequestPending(true)
    setStatus('connecting')
    setStatusMessage(activate ? '正在连接服务器...' : '测试连接中...')
    setLastAttempt(Date.now())
    const result = await simulateConnectionTest(config)
    setRequestPending(false)
    if (result.success) {
      setStatus('connected')
      setStatusMessage(result.message)
      if (activate) {
        setActiveId(config.id)
      }
      return
    }
    setStatus('error')
    setStatusMessage(result.message)
    if (activate) {
      scheduleReconnect(config)
    }
  }

  const handleSave = () => {
    const nextConfig = buildConfigFromForm(editingId ?? undefined)
    setConfigs((prev) => {
      const exists = prev.findIndex((item) => item.id === nextConfig.id)
      if (exists >= 0) {
        const copy = [...prev]
        copy[exists] = nextConfig
        return copy
      }
      return [...prev, nextConfig]
    })
    setEditingId(nextConfig.id)
  }

  const handleEdit = (config: ServerConfig) => {
    setEditingId(config.id)
    setForm(createConnectionFormState(config))
  }

  const handleDelete = (configId: string) => {
    setConfigs((prev) => prev.filter((item) => item.id !== configId))
    if (editingId === configId) {
      setEditingId(null)
      setForm(createConnectionFormState())
    }
    if (activeId === configId) {
      setActiveId(null)
      setStatus('disconnected')
      setStatusMessage('当前连接已断开')
    }
  }

  const handleQuickSwitch = (config: ServerConfig) => {
    setActiveId(config.id)
    setEditingId(config.id)
    setForm(createConnectionFormState(config))
    void runConnectionTest(config, true)
  }

  const statusBadge = statusMeta[status]
  const activeName =
    activeConfig?.name ?? (activeId ? form.name || '未保存配置' : '未选择')

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
              onClick={() =>
                void runConnectionTest(
                  buildConfigFromForm(editingId ?? undefined),
                  false
                )
              }
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
              onClick={() =>
                void runConnectionTest(
                  buildConfigFromForm(editingId ?? undefined),
                  true
                )
              }
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
              onClick={handleSave}
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
                const isActive = config.id === activeId
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
                          onClick={() => handleDelete(config.id)}
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
