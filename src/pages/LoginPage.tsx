import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname?: string } })?.from
        ?.pathname
      navigate(from || '/', { replace: true })
    }
  }, [isAuthenticated, location.state, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await login({ username, password })
      const from = (location.state as { from?: { pathname?: string } })?.from
        ?.pathname
      navigate(from || '/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-bold">登录管理面板</h1>
          <p className="text-sm text-muted-foreground">
            使用管理员账号进入 MC Manager
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'h-10 w-full rounded-md text-sm font-semibold transition-colors',
              submitting
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
