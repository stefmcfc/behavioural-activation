import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
const get = vi.fn()
const responseUse = vi.fn()
const create = vi.fn(() => ({
  post,
  get,
  interceptors: {
    response: {
      use: responseUse,
    },
  },
}))

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

const { request, setUnauthorizedHandler } = await import('./client')

describe('client.ts 401 interceptor', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    setUnauthorizedHandler(null)
  })

  it('FRONTEND-029-AC-01: registers a response interceptor on the shared axios instance', () => {
    expect(responseUse).toHaveBeenCalledWith(expect.any(Function), expect.any(Function))
  })

  it('FRONTEND-029-AC-01: invokes the registered handler when the response rejection has status 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    const [, rejectionHandler] = responseUse.mock.calls[0]
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Authentication required' } },
    }

    await expect(rejectionHandler(axiosError)).rejects.toBe(axiosError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('FRONTEND-029-AC-01/AC-06: does not invoke the handler for non-401 responses', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    const [, rejectionHandler] = responseUse.mock.calls[0]
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Something went wrong' } },
    }

    await expect(rejectionHandler(axiosError)).rejects.toBe(axiosError)
    expect(handler).not.toHaveBeenCalled()
  })

  it('FRONTEND-029-AC-01: does nothing when no handler is registered', async () => {
    setUnauthorizedHandler(null)

    const [, rejectionHandler] = responseUse.mock.calls[0]
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Authentication required' } },
    }

    await expect(rejectionHandler(axiosError)).rejects.toBe(axiosError)
  })

  it('FRONTEND-029-AC-01: request() still wraps a 401 rejection into an ApiError after the interceptor runs', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Authentication required', details: null } },
    })

    await expect(request(() => post())).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Authentication required',
    })
  })
})
