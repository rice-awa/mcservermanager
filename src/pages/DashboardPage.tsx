import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { cn } from '@/lib/utils'
import type { ServerStats, TPSData } from '@/types'
import {
  dashboardDefaultRefreshInterval,
  dashboardRefreshIntervals,
} from '@/services/mock'
import { getStats, getStatsHistory } from '@/services/api.service'
import { useServerState } from '@/hooks/use-server'

const emptyStats: ServerStats = {
  tps: 0,
  cpu: 0,
  cpuProcess: 0,
  cpuSystem: 0,
  memory: {
    used: 0,
    max: 0,
    allocated: 0,
  },
  onlinePlayers: 0,
  maxPlayers: 0,
  loadedChunks: 0,
  version: 'Unknown',
  gamemode: 'Unknown',
  difficulty: 'Unknown',
}

type CpuHistoryPoint = { timestamp: number; process: number; system: number }
type MemoryPoint = { timestamp: number; used: number; allocated: number }

const formatTimeShort = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  })

const formatNumber = (value: number, digits = 2) => value.toFixed(digits)

const formatMemory = (value: number) => `${formatNumber(value / 1024, 1)} GB`

const formatTimeLabel: TooltipProps<number, string>['labelFormatter'] = (
  label
) => formatTimeShort(Number(label ?? 0))

const formatTpsTooltip: TooltipProps<number, string>['formatter'] = (value) => [
  typeof value === 'number' ? value.toFixed(2) : '0',
  'TPS',
]

const formatMemoryTooltip: TooltipProps<number, string>['formatter'] = (
  value,
  name
) => [
  typeof value === 'number' ? formatMemory(value) : '0 GB',
  name === 'used' ? '已使用' : '已分配',
]

const appendHistory = <T,>(items: T[], next: T, limit: number) => {
  const updated = [...items, next]
  return updated.length > limit ? updated.slice(-limit) : updated
}

function StatCard({
  title,
  value,
  hint,
  trend,
  className,
}: {
  title: string
  value: string
  hint?: string
  trend?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{title}</span>
        {hint ? <span className="text-xs">{hint}</span> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      {trend ? (
        <div className="mt-2 text-xs text-muted-foreground">{trend}</div>
      ) : null}
    </div>
  )
}

export default function DashboardPage() {
  const { activeServerId, activeServerName } = useServerState()
  const [stats, setStats] = useState<ServerStats>(emptyStats)
  const [tpsHistory, setTpsHistory] = useState<TPSData[]>([])
  const [cpuHistory, setCpuHistory] = useState<CpuHistoryPoint[]>([])
  const [memoryHistory, setMemoryHistory] = useState<MemoryPoint[]>([])
  const [refreshInterval, setRefreshInterval] = useState(
    dashboardDefaultRefreshInterval
  )
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tpsStatus = useMemo(() => {
    if (stats.tps >= 18) {
      return { label: '良好', color: 'text-emerald-500' }
    }
    if (stats.tps >= 15) {
      return { label: '警告', color: 'text-amber-500' }
    }
    return { label: '危险', color: 'text-destructive' }
  }, [stats.tps])

  const cpuStatus = useMemo(() => {
    if (stats.cpuSystem < 60) {
      return { label: '正常', color: 'text-emerald-500' }
    }
    if (stats.cpuSystem < 80) {
      return { label: '偏高', color: 'text-amber-500' }
    }
    return { label: '高负载', color: 'text-destructive' }
  }, [stats.cpuSystem])

  const memoryUsagePercent = useMemo(() => {
    if (stats.memory.max <= 0) {
      return 0
    }
    return (stats.memory.used / stats.memory.max) * 100
  }, [stats.memory])

  const loadHistory = useCallback(async () => {
    if (!activeServerId) {
      setStats(emptyStats)
      setTpsHistory([])
      setCpuHistory([])
      setMemoryHistory([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await getStatsHistory(activeServerId)
      setStats(data.stats)
      setTpsHistory(data.tpsHistory)
      setCpuHistory(data.cpuHistory)
      setMemoryHistory(data.memoryHistory)
      setLastUpdated(Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取状态失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [activeServerId])

  const refreshData = useCallback(async () => {
    if (!activeServerId) {
      return
    }

    try {
      const nextStats = await getStats(activeServerId)
      const limit = Math.max(
        20,
        tpsHistory.length,
        cpuHistory.length,
        memoryHistory.length
      )
      const now = Date.now()

      setStats(nextStats)
      setTpsHistory((prev) =>
        appendHistory(prev, { timestamp: now, tps: nextStats.tps }, limit)
      )
      setCpuHistory((prev) =>
        appendHistory(
          prev,
          {
            timestamp: now,
            process: nextStats.cpuProcess,
            system: nextStats.cpuSystem,
          },
          limit
        )
      )
      setMemoryHistory((prev) =>
        appendHistory(
          prev,
          {
            timestamp: now,
            used: nextStats.memory.used,
            allocated: nextStats.memory.allocated,
          },
          limit
        )
      )
      setLastUpdated(now)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : '刷新失败'
      setError(message)
    }
  }, [activeServerId, tpsHistory.length, cpuHistory.length, memoryHistory.length])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!activeServerId) {
      return
    }
    const timer = window.setInterval(() => {
      void refreshData()
    }, refreshInterval)
    return () => window.clearInterval(timer)
  }, [refreshInterval, refreshData, activeServerId])

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="mt-2 text-muted-foreground">服务器状态监控</p>
          {activeServerName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              当前服务器：{activeServerName}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="text-muted-foreground">
            最后更新：{formatTimeShort(lastUpdated)}
          </div>
          <select
            value={refreshInterval}
            onChange={(event) => setRefreshInterval(Number(event.target.value))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {dashboardRefreshIntervals.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshData()}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            立即刷新
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!activeServerId ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          尚未选择服务器，请先在设置中连接服务器。
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          title="TPS"
          value={formatNumber(stats.tps, 2)}
          hint={tpsStatus.label}
          className={tpsStatus.color}
        />
        <StatCard
          title="CPU(进程)"
          value={`${formatNumber(stats.cpuProcess, 1)}%`}
          hint="Java 进程"
          className="text-sky-500"
        />
        <StatCard
          title="CPU(系统)"
          value={`${formatNumber(stats.cpuSystem, 1)}%`}
          hint={cpuStatus.label}
          className={cpuStatus.color}
        />
        <StatCard
          title="内存"
          value={`${formatMemory(stats.memory.used)} / ${formatMemory(
            stats.memory.max
          )}`}
          hint={`${formatNumber(memoryUsagePercent, 1)}%`}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">在线玩家</div>
        <div className="mt-2 text-2xl font-semibold">
          {stats.onlinePlayers} / {stats.maxPlayers}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">TPS 曲线</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tpsHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeShort}
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis domain={[0, 20]} className="text-xs" stroke="currentColor" />
                <Tooltip
                  formatter={formatTpsTooltip}
                  labelFormatter={formatTimeLabel}
                />
                <Line type="monotone" dataKey="tps" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 text-sm font-medium">CPU 曲线</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cpuHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeShort}
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis domain={[0, 100]} className="text-xs" stroke="currentColor" />
                <Tooltip
                  formatter={(value, name) => [
                    `${typeof value === 'number' ? value.toFixed(1) : '0'}%`,
                    name === 'process' ? '进程' : '系统',
                  ]}
                  labelFormatter={formatTimeLabel}
                />
                <Area
                  type="monotone"
                  dataKey="process"
                  stroke="hsl(var(--primary))"
                  fillOpacity={0.2}
                  fill="url(#cpuGradient)"
                  name="process"
                />
                <Area
                  type="monotone"
                  dataKey="system"
                  stroke="hsl(var(--destructive))"
                  fillOpacity={0.15}
                  fill="url(#cpuGradient)"
                  name="system"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 text-sm font-medium">内存曲线</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={memoryHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimeShort}
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis className="text-xs" stroke="currentColor" />
              <Tooltip
                formatter={formatMemoryTooltip}
                labelFormatter={formatTimeLabel}
              />
              <Area
                type="monotone"
                dataKey="used"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#memoryGradient)"
              />
              <Area
                type="monotone"
                dataKey="allocated"
                stroke="hsl(var(--primary))"
                fillOpacity={0.2}
                fill="url(#memoryGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
