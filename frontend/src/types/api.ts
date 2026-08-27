export interface ApiErrorResponse {
  message: string
  details?: Record<string, unknown> | null
}

export class ApiError extends Error {
  readonly status: number
  readonly details: Record<string, unknown> | null

  constructor(status: number, message: string, details: Record<string, unknown> | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}
