import type { ServerConfig } from '@/types'

export type ConnectionFormState = {
  name: string
  host: string
  port: number
  password: string
  timeout: number
  sparkApiUrl: string
}

const mockConfigs: ServerConfig[] = [
  {
    id: 'server-1',
    name: '主世界服务器',
    host: '127.0.0.1',
    port: 25575,
    password: 'demo-password',
    timeout: 5000,
    sparkApiUrl: 'http://127.0.0.1:3000/spark',
  },
  {
    id: 'server-2',
    name: '测试服务器',
    host: '192.168.1.33',
    port: 25575,
    password: 'test-1234',
    timeout: 8000,
    sparkApiUrl: 'http://192.168.1.33:3000/spark',
  },
]

export const getMockConnectionConfigs = (): ServerConfig[] =>
  mockConfigs.map((config) => ({ ...config }))

export const createConnectionFormState = (
  config?: ServerConfig
): ConnectionFormState => ({
  name: config?.name ?? '',
  host: config?.host ?? '',
  port: config?.port ?? 25575,
  password: config?.password ?? '',
  timeout: config?.timeout ?? 5000,
  sparkApiUrl: config?.sparkApiUrl ?? '',
})

export type ConnectionTestResult = {
  success: boolean
  message: string
}

export const simulateConnectionTest = async (
  config: ServerConfig
): Promise<ConnectionTestResult> => {
  const delay = 600 + Math.random() * 800
  await new Promise((resolve) => setTimeout(resolve, delay))
  const unreachable = config.host.includes('0.0.0.0') || config.port <= 0
  const randomFailure = Math.random() < 0.2
  if (unreachable || randomFailure) {
    return {
      success: false,
      message: '连接失败：请检查地址、端口或密码。',
    }
  }
  return {
    success: true,
    message: '连接成功，RCON 握手完成。',
  }
}
