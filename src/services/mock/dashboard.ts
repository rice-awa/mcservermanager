import type { ServerStats, TPSData } from '@/types'

type MetricPoint = { timestamp: number; value: number }
type MemoryPoint = { timestamp: number; used: number; allocated: number }

const historyLength = 20

export const dashboardDefaultRefreshInterval = 10000

export const dashboardRefreshIntervals = [
  { label: '5 秒', value: 5000 },
  { label: '10 秒', value: 10000 },
  { label: '30 秒', value: 30000 },
  { label: '60 秒', value: 60000 },
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const randomDelta = (variance: number) =>
  (Math.random() - 0.5) * variance * 2

const createHistory = (
  length: number,
  base: number,
  variance: number,
  min: number,
  max: number,
  step = dashboardDefaultRefreshInterval
): MetricPoint[] => {
  const now = Date.now()
  return Array.from({ length }, (_, index) => {
    const timestamp = now - (length - 1 - index) * step
    const value = clamp(base + randomDelta(variance), min, max)
    return { timestamp, value }
  })
}

const createMemoryHistory = (
  length: number,
  usedBase: number,
  allocatedBase: number,
  max: number,
  step = dashboardDefaultRefreshInterval
): MemoryPoint[] => {
  const now = Date.now()
  return Array.from({ length }, (_, index) => {
    const timestamp = now - (length - 1 - index) * step
    const used = clamp(usedBase + randomDelta(0.6), 1, max)
    const allocated = clamp(allocatedBase + randomDelta(0.6), used, max)
    return { timestamp, used, allocated }
  })
}

export const getInitialDashboardState = () => {
  const stats: ServerStats = {
    tps: 19.6,
    cpu: 37,
    memory: {
      used: 6.4,
      max: 16,
      allocated: 8.2,
    },
    onlinePlayers: 8,
    maxPlayers: 20,
    loadedChunks: 5231,
    version: '1.20.4',
    gamemode: '生存',
    difficulty: '普通',
  }

  const tpsHistory: TPSData[] = createHistory(
    historyLength,
    19.2,
    0.6,
    15,
    20
  ).map((item) => ({ timestamp: item.timestamp, tps: item.value }))

  const cpuHistory = createHistory(historyLength, 42, 6, 10, 95)

  const memoryHistory = createMemoryHistory(
    historyLength,
    6.2,
    8.1,
    stats.memory.max
  )

  return {
    stats,
    tpsHistory,
    cpuHistory,
    memoryHistory,
  }
}
