import axios, { isAxiosError } from 'axios'
import { ApiError, type ApiErrorResponse } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8420/api/v1'

export const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError<ApiErrorResponse>(error) && error.response?.status === 401) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
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
