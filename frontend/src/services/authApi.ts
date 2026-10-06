import type { User, LoginCredentials } from '../types/auth'
import { client, request } from './client'

export const authApi = {
  login: (credentials: LoginCredentials): Promise<User> =>
    request<User>(() => client.post('/auth/login', credentials)),

  logout: (): Promise<void> => request<void>(() => client.post('/auth/logout')),

  me: (): Promise<User> => request<User>(() => client.get('/auth/me')),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    request<void>(() => client.patch('/auth/password', { currentPassword, newPassword })),
}
