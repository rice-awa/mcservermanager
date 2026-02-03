import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在验证登录状态...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
