import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const create = vi.fn(() => ({ get, interceptors: { response: { use: vi.fn() } } }))

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

const { exportApi } = await import('./exportApi')

describe('exportApi', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('FRONTEND-051-AC-05: downloadExport() requests GET /export with responseType: blob', async () => {
    const blob = new Blob(['-- export'], { type: 'application/sql' })
    get.mockResolvedValue({ data: blob })

    const result = await exportApi.downloadExport()

    expect(get).toHaveBeenCalledWith('/export', { responseType: 'blob' })
    expect(result).toBe(blob)
  })

  it('FRONTEND-051-AC-05: propagates a rejection from the underlying request', async () => {
    get.mockRejectedValue(new Error('Server error'))

    await expect(exportApi.downloadExport()).rejects.toThrow('Server error')
  })
})
