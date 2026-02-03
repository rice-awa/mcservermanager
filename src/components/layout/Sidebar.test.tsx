import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

const renderSidebar = (initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders the logo and title', () => {
    renderSidebar()
    expect(screen.getByText('MC Manager')).toBeInTheDocument()
    expect(screen.getByText('服务器管理')).toBeInTheDocument()
  })

  it('renders all navigation menu items', () => {
    renderSidebar()
    expect(screen.getByText('仪表盘')).toBeInTheDocument()
    expect(screen.getByText('控制台')).toBeInTheDocument()
    expect(screen.getByText('玩家管理')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
  })

  it('renders connection status badge', () => {
    renderSidebar()
    expect(screen.getByText('连接状态')).toBeInTheDocument()
    expect(screen.getByText('未连接')).toBeInTheDocument()
  })

  it('renders user info section', () => {
    renderSidebar()
    expect(screen.getByText('管理员')).toBeInTheDocument()
    expect(screen.getByText('admin@mc.com')).toBeInTheDocument()
  })

  it('highlights active menu item based on current path', () => {
    renderSidebar('/')
    const dashboardLink = screen.getByText('仪表盘').closest('a')
    expect(dashboardLink).toHaveClass('bg-primary')
  })

  it('highlights console menu when on /console path', () => {
    renderSidebar('/console')
    const consoleLink = screen.getByText('控制台').closest('a')
    expect(consoleLink).toHaveClass('bg-primary')
  })

  it('has correct navigation links', () => {
    renderSidebar()
    expect(screen.getByText('仪表盘').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('控制台').closest('a')).toHaveAttribute('href', '/console')
    expect(screen.getByText('玩家管理').closest('a')).toHaveAttribute('href', '/players')
    expect(screen.getByText('设置').closest('a')).toHaveAttribute('href', '/settings')
  })
})
