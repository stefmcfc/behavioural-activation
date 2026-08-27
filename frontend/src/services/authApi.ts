import axios, { isAxiosError } from 'axios'
import type { User, LoginCredentials } from '../types/auth'
import { ApiError, type ApiErrorResponse } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api/v1'

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await fn()
    return response.data
  } catch (error) {
    if (isAxiosError<ApiErrorResponse>(error)) {
      const status = error.response?.status ?? 0
      const message = error.response?.data?.message ?? error.message
      const details = error.response?.data?.details ?? null
      throw new ApiError(status, message, details)
    }
    throw error
  }
}

export const authApi = {
  login: (credentials: LoginCredentials): Promise<User> =>
    request<User>(() => client.post('/auth/login', credentials)),

  logout: (): Promise<void> => request<void>(() => client.post('/auth/logout')),

  me: (): Promise<User> => request<User>(() => client.get('/auth/me')),
}
