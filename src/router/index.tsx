import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ConsolePage from '@/pages/ConsolePage'
import DashboardPage from '@/pages/DashboardPage'
import PlayersPage from '@/pages/PlayersPage'
import SettingsPage from '@/pages/SettingsPage'
import LoginPage from '@/pages/LoginPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'console',
        element: (
          <ProtectedRoute>
            <ConsolePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'players',
        element: <PlayersPage />,
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
])
