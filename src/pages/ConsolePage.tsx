import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ConsoleMessage, ConnectionStatus } from '@/types'
import { useAuth } from '@/contexts/auth-context'
import { useServerState } from '@/hooks/use-server'
import { socketService } from '@/services/socket.service'
import {
  consoleCommandCatalog,
  consoleHistoryStorageKey,
  consoleMaxHistorySize,
  consoleMessageTypeLabels,
  consoleMessageTypeStyles,
  getConsoleInitialMessages,
} from '@/services/mock'

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

const createId = (() => {
  let seed = 0
  return () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    seed += 1
    return `console-${Date.now()}-${seed}`
  }
})()

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

function getStoredHistory(): string[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const stored = window.localStorage.getItem(consoleHistoryStorageKey)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export default function ConsolePage() {
  const { tokens } = useAuth()
  const { activeServerId, activeServerName, connectionStatus } = useServerState()
  const [messages, setMessages] = useState<ConsoleMessage[]>(
    getConsoleInitialMessages
  )
  const [inputValue, setInputValue] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [history, setHistory] = useState<string[]>(getStoredHistory)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const draftRef = useRef('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    socketService.connect(undefined, tokens?.socketToken)

    const handleCommandOutput = (data: {
      type: string
      payload: { message: ConsoleMessage }
    }) => {
      if (data?.payload?.message) {
        appendMessage(data.payload.message)
      }
    }

    const handleLegacyMessage = (data: {
      id: string
      type: ConsoleMessage['type']
      content: string
      timestamp: string | Date
    }) => {
      const timestamp =
        typeof data.timestamp === 'string'
          ? new Date(data.timestamp).getTime()
          : new Date(data.timestamp).getTime()
      appendMessage({
        id: data.id,
        timestamp,
        type: data.type,
        content: data.content,
      })
    }

    socketService.on('commandOutput', handleCommandOutput)
    socketService.on('console:message', handleLegacyMessage)

    return () => {
      socketService.off('commandOutput', handleCommandOutput)
      socketService.off('console:message', handleLegacyMessage)
    }
  }, [tokens?.socketToken, appendMessage])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(consoleHistoryStorageKey, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    if (!autoScroll) {
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, autoScroll])

  const activeLine = useMemo(() => {
    const lines = inputValue.split('\n')
    return lines[lines.length - 1] ?? ''
  }, [inputValue])

  const commandQuery = useMemo(() => {
    const trimmed = activeLine.trimStart()
    if (!trimmed) {
      return ''
    }
    return trimmed.split(/\s+/)[0]?.toLowerCase() ?? ''
  }, [activeLine])

  const suggestions = useMemo(() => {
    if (!commandQuery) {
      return []
    }
    return consoleCommandCatalog.filter((command) =>
      command.toLowerCase().startsWith(commandQuery)
    )
  }, [commandQuery])

  const setInputAndFocus = (value: string) => {
    setInputValue(value)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(value.length, value.length)
    })
  }

  const applySuggestion = (suggestion: string) => {
    const lines = inputValue.split('\n')
    const lastLine = lines[lines.length - 1] ?? ''
    const leadingWhitespace = lastLine.match(/^\s*/)?.[0] ?? ''
    const trimmed = lastLine.trimStart()
    const commandPart = trimmed.split(/\s+/)[0] ?? ''
    const rest = trimmed.slice(commandPart.length)
    lines[lines.length - 1] = `${leadingWhitespace}${suggestion}${rest}`
    setInputAndFocus(lines.join('\n'))
  }

  const pushHistory = (command: string) => {
    setHistory((prev) => {
      const next = [...prev, command].slice(-consoleMaxHistorySize)
      return next
    })
  }

  const appendMessage = useCallback((message: ConsoleMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const handleSend = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      return
    }

    if (!activeServerId) {
      appendMessage({
        id: createId(),
        timestamp: Date.now(),
        type: 'error',
        content: '未选择服务器，请先在设置中连接服务器。',
      })
      return
    }

    if (!socketService.isConnected()) {
      appendMessage({
        id: createId(),
        timestamp: Date.now(),
        type: 'error',
        content: 'WebSocket 未连接，无法发送命令。',
      })
      return
    }

    socketService.executeCommand(activeServerId, trimmed)
    pushHistory(trimmed)
    setInputValue('')
    setHistoryIndex(-1)
    draftRef.current = ''
  }

  const handleHistoryNavigation = (direction: 'up' | 'down') => {
    if (history.length === 0) {
      return
    }

    if (direction === 'up') {
      if (historyIndex === -1) {
        draftRef.current = inputValue
        const nextIndex = history.length - 1
        setHistoryIndex(nextIndex)
        setInputAndFocus(history[nextIndex])
        return
      }

      const nextIndex = Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInputAndFocus(history[nextIndex])
      return
    }

    if (historyIndex === -1) {
      return
    }

    const nextIndex = historyIndex + 1
    if (nextIndex >= history.length) {
      setHistoryIndex(-1)
      setInputAndFocus(draftRef.current)
      return
    }

    setHistoryIndex(nextIndex)
    setInputAndFocus(history[nextIndex])
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab' && suggestions.length > 0) {
      event.preventDefault()
      applySuggestion(suggestions[0])
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      const isMultiLine = inputValue.includes('\n')
      const atStart = textarea.selectionStart === 0
      const atEnd = textarea.selectionEnd === inputValue.length
      const canNavigate =
        !isMultiLine ||
        (event.key === 'ArrowUp' && atStart) ||
        (event.key === 'ArrowDown' && atEnd)

      if (canNavigate) {
        event.preventDefault()
        handleHistoryNavigation(event.key === 'ArrowUp' ? 'up' : 'down')
      }
    }
  }

  const toggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev
      if (next) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        })
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">控制台</h1>
          <p className="mt-2 text-muted-foreground">实时服务器控制台</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">当前服务器</span>
            <span className="font-medium">
              {activeServerName || activeServerId || '未选择'}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn('text-xs', statusMeta[connectionStatus].color)}
          >
            <span
              className={cn(
                'mr-1.5 h-2 w-2 rounded-full',
                statusMeta[connectionStatus].dot
              )}
            />
            {statusMeta[connectionStatus].label}
          </Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">控制台输出</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAutoScroll}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                autoScroll
                  ? 'border-border text-foreground hover:bg-accent'
                  : 'border-primary text-primary hover:bg-primary/10'
              )}
            >
              {autoScroll ? '暂停滚动' : '恢复滚动'}
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 rounded-lg border bg-card">
          <div className="space-y-2 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex flex-wrap items-start gap-3 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {formatTimestamp(message.timestamp)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {consoleMessageTypeLabels[message.type]}
                </span>
                <span
                  className={cn(
                    'flex-1 whitespace-pre-wrap',
                    consoleMessageTypeStyles[message.type]
                  )}
                >
                  {message.type === 'command'
                    ? `> ${message.content}`
                    : message.content}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">命令输入</span>
              <span className="text-xs text-muted-foreground">
                Enter 发送 / Shift+Enter 换行 / Tab 补全
              </span>
            </div>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入服务器命令，例如：list"
                className="min-h-[96px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {suggestions.length > 0 && commandQuery && (
                <div className="absolute z-10 mt-2 w-full rounded-md border bg-popover p-2 text-xs shadow-lg">
                  <div className="mb-2 text-[10px] text-muted-foreground">
                    建议命令
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => applySuggestion(item)}
                        className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>历史记录保存最近 {consoleMaxHistorySize} 条命令</span>
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  'rounded-md px-4 py-2 text-xs font-semibold transition-colors',
                  inputValue.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'cursor-not-allowed bg-muted text-muted-foreground'
                )}
              >
                发送命令
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
