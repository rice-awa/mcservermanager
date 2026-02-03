export class ApiError extends Error {
  code?: string
  details?: unknown

  constructor(message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}
