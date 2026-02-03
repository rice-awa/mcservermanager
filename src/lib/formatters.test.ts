import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  formatDuration,
  formatPercentage,
  getTPSStatus,
  getTPSColor,
} from './formatters'

describe('formatBytes', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
  })

  it('respects decimal places parameter', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB')
    expect(formatBytes(1536, 1)).toBe('1.5 KB')
    expect(formatBytes(1536, 3)).toBe('1.5 KB')
  })

  it('handles negative decimals as 0', () => {
    expect(formatBytes(1536, -1)).toBe('2 KB')
  })
})

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(0)).toBe('0s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(60)).toBe('1m 0s')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(3660)).toBe('1h 1m')
    expect(formatDuration(7200)).toBe('2h 0m')
  })

  it('handles large durations', () => {
    expect(formatDuration(86400)).toBe('24h 0m')
  })
})

describe('formatPercentage', () => {
  it('formats percentage with default decimals', () => {
    expect(formatPercentage(50)).toBe('50.0%')
    expect(formatPercentage(75.5)).toBe('75.5%')
  })

  it('formats percentage with custom decimals', () => {
    expect(formatPercentage(50, 0)).toBe('50%')
    expect(formatPercentage(75.55, 2)).toBe('75.55%')
  })

  it('handles edge cases', () => {
    expect(formatPercentage(0)).toBe('0.0%')
    expect(formatPercentage(100)).toBe('100.0%')
  })
})

describe('getTPSStatus', () => {
  it('returns "excellent" for TPS >= 19.5', () => {
    expect(getTPSStatus(20)).toBe('excellent')
    expect(getTPSStatus(19.5)).toBe('excellent')
  })

  it('returns "good" for TPS >= 18 and < 19.5', () => {
    expect(getTPSStatus(19)).toBe('good')
    expect(getTPSStatus(18)).toBe('good')
  })

  it('returns "warning" for TPS >= 15 and < 18', () => {
    expect(getTPSStatus(17)).toBe('warning')
    expect(getTPSStatus(15)).toBe('warning')
  })

  it('returns "critical" for TPS < 15', () => {
    expect(getTPSStatus(14)).toBe('critical')
    expect(getTPSStatus(0)).toBe('critical')
  })
})

describe('getTPSColor', () => {
  it('returns correct color for excellent TPS', () => {
    expect(getTPSColor(20)).toBe('text-green-500')
  })

  it('returns correct color for good TPS', () => {
    expect(getTPSColor(18)).toBe('text-blue-500')
  })

  it('returns correct color for warning TPS', () => {
    expect(getTPSColor(16)).toBe('text-yellow-500')
  })

  it('returns correct color for critical TPS', () => {
    expect(getTPSColor(10)).toBe('text-red-500')
  })
})
