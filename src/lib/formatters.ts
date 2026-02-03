import { format } from 'date-fns'

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
  return format(new Date(timestamp), pattern)
}

/**
 * 格式化在线时长
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * 获取 TPS 健康状态
 */
export function getTPSStatus(tps: number): 'excellent' | 'good' | 'warning' | 'critical' {
  if (tps >= 19.5) return 'excellent'
  if (tps >= 18) return 'good'
  if (tps >= 15) return 'warning'
  return 'critical'
}

/**
 * 获取 TPS 状态颜色
 */
export function getTPSColor(tps: number): string {
  const status = getTPSStatus(tps)
  const colors = {
    excellent: 'text-green-500',
    good: 'text-blue-500',
    warning: 'text-yellow-500',
    critical: 'text-red-500',
  }
  return colors[status]
}
