import type { ServerConfig } from '@/types'

export type ConnectionFormState = {
  name: string
  host: string
  port: number
  password: string
  timeout: number
  sparkApiUrl: string
  serverDir?: string
}

export const createConnectionFormState = (
  config?: ServerConfig
): ConnectionFormState => ({
  name: config?.name ?? '',
  host: config?.host ?? '',
  port: config?.port ?? 25575,
  password: config?.password ?? '',
  timeout: config?.timeout ?? 5000,
  sparkApiUrl: config?.sparkApiUrl ?? '',
  serverDir: config?.serverDir ?? '',
})
