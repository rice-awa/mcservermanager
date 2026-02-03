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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ServerStats, TPSData } from '@/types'
import {
  dashboardDefaultRefreshInterval,
  dashboardRefreshIntervals,
  getInitialDashboardState,
} from '@/services/mock'

type MetricPoint = { timestamp: number; value: number }
type MemoryPoint = { timestamp: number; used: number; allocated: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const randomDelta = (variance: number) =>
  (Math.random() - 0.5) * variance * 2

const formatTimeShort = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  })

const formatNumber = (value: number, digits = 2) => value.toFixed(digits)

const formatMemory = (value: number) => `${formatNumber(value, 1)} GB`

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
  const initialDashboardState = useMemo(() => getInitialDashboardState(), [])
  const [stats, setStats] = useState<ServerStats>(
    initialDashboardState.stats
  )
  const [tpsHistory, setTpsHistory] = useState<TPSData[]>(
    initialDashboardState.tpsHistory
  )
  const [cpuHistory, setCpuHistory] = useState<MetricPoint[]>(
    initialDashboardState.cpuHistory
  )
  const [memoryHistory, setMemoryHistory] = useState<MemoryPoint[]>(
    initialDashboardState.memoryHistory
  )
  const [refreshInterval, setRefreshInterval] = useState(
    dashboardDefaultRefreshInterval
  )
  const [lastUpdated, setLastUpdated] = useState(Date.now())

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
    if (stats.cpu < 60) {
      return { label: '正常', color: 'text-emerald-500' }
    }
    if (stats.cpu < 80) {
      return { label: '偏高', color: 'text-amber-500' }
    }
    return { label: '高负载', color: 'text-destructive' }
  }, [stats.cpu])

  const memoryUsagePercent = useMemo(() => {
    return (stats.memory.used / stats.memory.max) * 100
  }, [stats.memory])

  const refreshData = useCallback(() => {
    const now = Date.now()
    let nextTps = 0
    let nextCpu = 0
    let nextUsed = 0
    let nextAllocated = 0
    let nextPlayers = 0
    let nextChunks = 0

    setStats((prev) => {
      nextTps = clamp(prev.tps + randomDelta(0.5), 12, 20)
      nextCpu = clamp(prev.cpu + randomDelta(6), 10, 95)
      nextUsed = clamp(prev.memory.used + randomDelta(0.6), 1, prev.memory.max)
      nextAllocated = clamp(
        prev.memory.allocated + randomDelta(0.6),
        nextUsed,
        prev.memory.max
      )
      nextPlayers = clamp(
        prev.onlinePlayers + Math.round(randomDelta(1)),
        0,
        prev.maxPlayers
      )
      nextChunks = Math.max(0, Math.round(prev.loadedChunks + randomDelta(120)))
      return {
        ...prev,
        tps: nextTps,
        cpu: nextCpu,
        memory: {
          ...prev.memory,
          used: nextUsed,
          allocated: nextAllocated,
        },
        onlinePlayers: nextPlayers,
        loadedChunks: nextChunks,
      }
    })

    setTpsHistory((prev) => [
      ...prev.slice(1),
      { timestamp: now, tps: nextTps },
    ])
    setCpuHistory((prev) => [
      ...prev.slice(1),
      { timestamp: now, value: nextCpu },
    ])
    setMemoryHistory((prev) => [
      ...prev.slice(1),
      { timestamp: now, used: nextUsed, allocated: nextAllocated },
    ])
    setLastUpdated(now)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshData()
    }, refreshInterval)
    return () => window.clearInterval(timer)
  }, [refreshInterval, refreshData])

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="mt-2 text-muted-foreground">服务器状态监控</p>
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
            onClick={refreshData}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            立即刷新
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="TPS"
          value={formatNumber(stats.tps)}
          hint={tpsStatus.label}
          trend="过去 5 分钟趋势"
          className={tpsStatus.color}
        />
        <StatCard
          title="CPU 使用率"
          value={`${formatNumber(stats.cpu, 1)}%`}
          hint={cpuStatus.label}
          trend="当前核心负载"
          className={cpuStatus.color}
        />
        <StatCard
          title="内存占用"
          value={`${formatNumber(memoryUsagePercent, 1)}%`}
          hint={`${formatMemory(stats.memory.used)} / ${formatMemory(
            stats.memory.max
          )}`}
          trend={`已分配 ${formatMemory(stats.memory.allocated)}`}
        />
        <StatCard
          title="在线玩家"
          value={`${stats.onlinePlayers} / ${stats.maxPlayers}`}
          hint="实时在线"
          trend={`当前区块 ${stats.loadedChunks.toLocaleString()}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">TPS 趋势</div>
            <Badge variant="outline" className="text-xs">
              {tpsStatus.label}
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tpsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeShort}
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(value) => formatTimeShort(Number(value))}
                  formatter={(value) => [`${Number(value).toFixed(2)} TPS`, 'TPS']}
                />
                <Line
                  type="monotone"
                  dataKey="tps"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">CPU 历史趋势</div>
            <Badge variant="outline" className="text-xs">
              {cpuStatus.label}
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeShort}
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(value) => formatTimeShort(Number(value))}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'CPU']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">内存使用情况</div>
            <Badge variant="outline" className="text-xs">
              {formatNumber(memoryUsagePercent, 1)}%
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={memoryHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeShort}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  domain={[0, stats.memory.max]}
                  tickFormatter={(value) => `${value} GB`}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(value) => formatTimeShort(Number(value))}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(1)} GB`,
                    name === 'used' ? '已使用' : '已分配',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="allocated"
                  stroke="#60a5fa"
                  fill="rgba(96, 165, 250, 0.3)"
                />
                <Area
                  type="monotone"
                  dataKey="used"
                  stroke="#22c55e"
                  fill="rgba(34, 197, 94, 0.35)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 text-sm font-medium">服务器信息</div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">版本</span>
              <span className="font-medium">{stats.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">游戏模式</span>
              <span className="font-medium">{stats.gamemode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">难度</span>
              <span className="font-medium">{stats.difficulty}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">已加载区块</span>
              <span className="font-medium">
                {stats.loadedChunks.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">在线玩家</span>
              <span className="font-medium">
                {stats.onlinePlayers}/{stats.maxPlayers}
              </span>
            </div>
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              自动刷新间隔：
              {
                dashboardRefreshIntervals.find(
                  (item) => item.value === refreshInterval
                )?.label
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
