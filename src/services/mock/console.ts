import type { ConsoleMessage } from '@/types'

export const consoleHistoryStorageKey = 'mcservermanager-console-history'
export const consoleMaxHistorySize = 50

export const consoleCommandCatalog = [
  'help',
  'list',
  'say',
  'time set day',
  'time set night',
  'weather clear',
  'weather rain',
  'weather thunder',
  'gamemode survival',
  'gamemode creative',
  'whitelist add',
  'whitelist remove',
  'kick',
  'ban',
  'pardon',
  'stop',
  'save-all',
  'tp',
]

export const consoleMessageTypeLabels: Record<ConsoleMessage['type'], string> = {
  system: '系统',
  command: '命令',
  output: '输出',
  error: '错误',
  chat: '聊天',
  join: '加入',
  leave: '离开',
}

export const consoleMessageTypeStyles: Record<ConsoleMessage['type'], string> = {
  system: 'text-muted-foreground',
  command: 'text-sky-500',
  output: 'text-foreground',
  error: 'text-destructive',
  chat: 'text-emerald-500',
  join: 'text-emerald-400',
  leave: 'text-amber-500',
}

export const getConsoleInitialMessages = (): ConsoleMessage[] => {
  const now = Date.now()
  return [
    {
      id: 'init-1',
      timestamp: now - 1000 * 60 * 3,
      type: 'system',
      content: '控制台已就绪，等待服务器连接。',
    },
    {
      id: 'init-2',
      timestamp: now - 1000 * 60 * 2,
      type: 'output',
      content: '上次自动保存完成。',
    },
    {
      id: 'init-3',
      timestamp: now - 1000 * 30,
      type: 'chat',
      content: '[Steve] 大家好，我上线了！',
    },
  ]
}
