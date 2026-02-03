import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Terminal,
  Users,
  Settings,
  Server,
  X,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/hooks/use-theme'

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

const menuItems = [
  {
    title: '仪表盘',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    title: '控制台',
    icon: Terminal,
    path: '/console',
  },
  {
    title: '玩家管理',
    icon: Users,
    path: '/players',
  },
  {
    title: '设置',
    icon: Settings,
    path: '/settings',
  },
]

export default function Sidebar({
  open = false,
  onClose = () => {},
}: SidebarProps) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 border-r bg-card flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* 移动端关闭按钮 */}
      <button
        type="button"
        className="absolute right-2 top-2 p-2 lg:hidden"
        onClick={onClose}
        aria-label="关闭侧边栏"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Logo 区域 */}
      <div className="p-6 flex items-center gap-3">
        <Server className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-bold text-lg">MC Manager</h1>
          <p className="text-xs text-muted-foreground">服务器管理</p>
        </div>
      </div>

      <Separator />

      {/* 连接状态 */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">连接状态</span>
          <Badge variant="outline" className="text-xs">
            <span className="h-2 w-2 rounded-full bg-gray-400 mr-1.5" />
            未连接
          </Badge>
        </div>
      </div>

      <Separator />

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* 底部用户信息 */}
      <div className="p-4 border-t space-y-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">管理员</p>
            <p className="text-xs text-muted-foreground">admin@mc.com</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {isDark ? '切换到亮色' : '切换到暗色'}
        </button>
      </div>
    </aside>
  )
}
