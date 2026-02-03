import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
