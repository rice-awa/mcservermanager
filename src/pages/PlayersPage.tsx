import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getMockPlayers, type PlayerRow } from '@/services/mock'

const pageSize = 6

const initialPlayers = getMockPlayers()

const formatDuration = (seconds: number) => {
  if (seconds <= 0) {
    return '--'
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const formatPosition = (player: PlayerRow) => {
  if (!player.position) {
    return '--'
  }
  const { x, y, z, dimension } = player.position
  return `${x}, ${y}, ${z} (${dimension})`
}

const pingColor = (ping: number) => {
  if (ping === 0) {
    return 'text-muted-foreground'
  }
  if (ping < 80) {
    return 'text-emerald-500'
  }
  if (ping < 150) {
    return 'text-amber-500'
  }
  return 'text-destructive'
}

export default function PlayersPage() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>(
    'all'
  )
  const [sortKey, setSortKey] = useState<'name' | 'onlineTime' | 'ping'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  const filteredPlayers = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    return initialPlayers.filter((player) => {
      const matchesQuery = lowerQuery
        ? player.name.toLowerCase().includes(lowerQuery)
        : true
      const matchesStatus =
        statusFilter === 'all' ? true : player.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, statusFilter])

  const sortedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers]
    sorted.sort((a, b) => {
      let result = 0
      if (sortKey === 'name') {
        result = a.name.localeCompare(b.name)
      } else if (sortKey === 'onlineTime') {
        result = a.onlineTime - b.onlineTime
      } else {
        result = a.ping - b.ping
      }
      return sortDirection === 'asc' ? result : -result
    })
    return sorted
  }, [filteredPlayers, sortKey, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize))
  const pagedPlayers = sortedPlayers.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const handleSort = (key: 'name' | 'onlineTime' | 'ping') => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const onlineCount = filteredPlayers.filter((player) => player.status === 'online')
    .length
  const offlineCount = filteredPlayers.length - onlineCount

  const handleMenuAction = (
    action: 'message' | 'detail' | 'ban',
    player: PlayerRow,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    const details = event.currentTarget.closest('details')
    if (details) {
      details.removeAttribute('open')
    }
    if (action === 'ban') {
      const confirmed = window.confirm(`确定要封禁 ${player.name} 吗？`)
      if (!confirmed) {
        return
      }
    }
    const actionLabel =
      action === 'message' ? '发送私信' : action === 'detail' ? '查看详情' : '封禁'
    window.alert(`${actionLabel}：${player.name}`)
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">玩家管理</h1>
          <p className="mt-2 text-muted-foreground">在线玩家列表和管理</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="text-xs">
            在线 {onlineCount}
          </Badge>
          <Badge variant="outline" className="text-xs">
            离线 {offlineCount}
          </Badge>
          <Badge variant="outline" className="text-xs">
            总计 {filteredPlayers.length}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索玩家名称"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | 'online' | 'offline')
            }
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="all">全部状态</option>
            <option value="online">仅在线</option>
            <option value="offline">仅离线</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">玩家</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 font-semibold"
                  >
                    名称
                    <span className="text-[10px]">
                      {sortKey === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('onlineTime')}
                    className="flex items-center gap-1 font-semibold"
                  >
                    在线时长
                    <span className="text-[10px]">
                      {sortKey === 'onlineTime'
                        ? sortDirection === 'asc'
                          ? '↑'
                          : '↓'
                        : ''}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('ping')}
                    className="flex items-center gap-1 font-semibold"
                  >
                    延迟
                    <span className="text-[10px]">
                      {sortKey === 'ping' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">位置</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedPlayers.map((player) => (
                <tr
                  key={player.id}
                  className="border-t border-border transition-colors hover:bg-accent/30"
                >
                  <td className="px-4 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {player.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{player.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {player.uuid}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          player.status === 'online'
                            ? 'bg-emerald-500'
                            : 'bg-muted-foreground'
                        )}
                      />
                      <span className="text-sm">
                        {player.status === 'online' ? '在线' : '离线'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {player.lastSeen}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDuration(player.onlineTime)}</td>
                  <td className={cn('px-4 py-3', pingColor(player.ping))}>
                    {player.ping ? `${player.ping} ms` : '--'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatPosition(player)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                        操作
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-32 rounded-md border bg-popover p-1 text-xs shadow-lg">
                        <button
                          type="button"
                          onClick={(event) =>
                            handleMenuAction('message', player, event)
                          }
                          className="w-full rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          发送私信
                        </button>
                        <button
                          type="button"
                          onClick={(event) =>
                            handleMenuAction('detail', player, event)
                          }
                          className="w-full rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleMenuAction('ban', player, event)}
                          className="w-full rounded-md px-2 py-1 text-left text-destructive transition-colors hover:bg-destructive/10"
                        >
                          封禁
                        </button>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {pagedPlayers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    未找到符合条件的玩家
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            当前第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium',
                page === 1
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              )}
            >
              首页
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium',
                page === 1
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              )}
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium',
                page === totalPages
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              )}
            >
              下一页
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium',
                page === totalPages
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              )}
            >
              末页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
