import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
const get = vi.fn()
const create = vi.fn(() => ({ post, get, interceptors: { response: { use: vi.fn() } } }))

function isMockAxiosError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error
}

vi.mock('axios', () => ({
  default: {
    create,
    isAxiosError: isMockAxiosError,
  },
  isAxiosError: isMockAxiosError,
}))

const { authApi } = await import('./authApi')

describe('authApi', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
  })

  it('FRONTEND-001-AC-01: configures its axios instance with withCredentials: true', () => {
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ withCredentials: true }))
  })

  it('FRONTEND-001-AC-02: throws a typed ApiError populated from status and message on failure', async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Invalid credentials', details: null } },
    })

    await expect(authApi.login({ username: 'steve', password: 'wrong' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Invalid credentials',
    })
  })

  it('login() resolves with the username on success and posts credentials', async () => {
    post.mockResolvedValue({ data: { username: 'steve' } })

    const result = await authApi.login({ username: 'steve', password: 'secret' })

    expect(result).toEqual({ username: 'steve' })
    expect(post).toHaveBeenCalledWith('/auth/login', { username: 'steve', password: 'secret' })
  })

  it('me() resolves with the current user', async () => {
    get.mockResolvedValue({ data: { username: 'steve' } })

    const result = await authApi.me()

    expect(result).toEqual({ username: 'steve' })
    expect(get).toHaveBeenCalledWith('/auth/me')
  })

  it('logout() posts to /auth/logout', async () => {
    post.mockResolvedValue({ data: undefined })

    await authApi.logout()

    expect(post).toHaveBeenCalledWith('/auth/logout')
  })
})
