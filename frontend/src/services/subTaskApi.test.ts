import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
const get = vi.fn()
const patch = vi.fn()
const del = vi.fn()
const create = vi.fn(() => ({
  post,
  get,
  patch,
  delete: del,
  interceptors: { response: { use: vi.fn() } },
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

const { subTaskApi } = await import('./subTaskApi')

describe('subTaskApi', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    patch.mockReset()
    del.mockReset()
  })

  it('getAll() unwraps the {data, count} envelope and hits the nested route', async () => {
    const subTask = {
      id: 's1',
      activityId: 'a1',
      name: 'Create a guest list',
      category: 'PLEASURABLE',
      createdAt: '2026-09-29T00:00:00Z',
    }
    get.mockResolvedValue({ data: { data: [subTask], count: 1 } })

    const result = await subTaskApi.getAll('a1')

    expect(result).toEqual([subTask])
    expect(get).toHaveBeenCalledWith('/activities/a1/sub-tasks')
  })

  it('create() posts to the nested route and returns the created sub-task', async () => {
    const created = {
      id: 's1',
      activityId: 'a1',
      name: 'Create a guest list',
      category: 'PLEASURABLE',
      createdAt: '2026-09-29T00:00:00Z',
    }
    post.mockResolvedValue({ data: created })

    const result = await subTaskApi.create('a1', { name: 'Create a guest list' })

    expect(result).toEqual(created)
    expect(post).toHaveBeenCalledWith('/activities/a1/sub-tasks', { name: 'Create a guest list' })
  })

  it('update() patches the nested route and returns the updated sub-task', async () => {
    const updated = {
      id: 's1',
      activityId: 'a1',
      name: 'Create and send a guest list',
      category: 'PLEASURABLE',
      createdAt: '2026-09-29T00:00:00Z',
    }
    patch.mockResolvedValue({ data: updated })

    const result = await subTaskApi.update('a1', 's1', { name: 'Create and send a guest list' })

    expect(result).toEqual(updated)
    expect(patch).toHaveBeenCalledWith('/activities/a1/sub-tasks/s1', {
      name: 'Create and send a guest list',
    })
  })

  it('remove() deletes on the nested route and resolves with no value', async () => {
    del.mockResolvedValue({ data: undefined })

    await subTaskApi.remove('a1', 's1')

    expect(del).toHaveBeenCalledWith('/activities/a1/sub-tasks/s1')
  })

  it('rejects with a typed ApiError on failure', async () => {
    get.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Server error', details: null } },
    })

    await expect(subTaskApi.getAll('a1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Server error',
    })
  })
})
