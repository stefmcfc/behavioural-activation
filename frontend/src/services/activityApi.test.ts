import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
const get = vi.fn()
const put = vi.fn()
const del = vi.fn()
const create = vi.fn(() => ({ post, get, put, delete: del }))

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

const { activityApi } = await import('./activityApi')

describe('activityApi', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    put.mockReset()
    del.mockReset()
  })

  it('FRONTEND-002-AC-02: getAll() unwraps the {data, count} envelope', async () => {
    const activity = {
      id: '1',
      name: 'Walk',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
      archived: false,
      createdAt: '2026-09-28T00:00:00Z',
    }
    get.mockResolvedValue({ data: { data: [activity], count: 1 } })

    const result = await activityApi.getAll()

    expect(result).toEqual([activity])
    expect(get).toHaveBeenCalledWith('/activities', undefined)
  })

  it('FRONTEND-006: getAll() with no argument omits includeArchived (default excludes archived)', async () => {
    get.mockResolvedValue({ data: { data: [], count: 0 } })

    await activityApi.getAll()

    expect(get).toHaveBeenCalledWith('/activities', undefined)
  })

  it('FRONTEND-006: getAll(true) requests includeArchived=true', async () => {
    get.mockResolvedValue({ data: { data: [], count: 0 } })

    await activityApi.getAll(true)

    expect(get).toHaveBeenCalledWith('/activities', { params: { includeArchived: true } })
  })

  it('FRONTEND-006: getAll(false) is equivalent to the default (no includeArchived param)', async () => {
    get.mockResolvedValue({ data: { data: [], count: 0 } })

    await activityApi.getAll(false)

    expect(get).toHaveBeenCalledWith('/activities', undefined)
  })

  it('FRONTEND-002-AC-03: create() posts and returns the created activity', async () => {
    const created = {
      id: '1',
      name: 'Walk',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
      archived: false,
      createdAt: '2026-09-28T00:00:00Z',
    }
    post.mockResolvedValue({ data: created })

    const result = await activityApi.create({
      name: 'Walk',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
    })

    expect(result).toEqual(created)
    expect(post).toHaveBeenCalledWith('/activities', {
      name: 'Walk',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
    })
  })

  it('FRONTEND-002-AC-04: update() puts and returns the updated activity', async () => {
    const updated = {
      id: '1',
      name: 'Walk longer',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
      archived: false,
      createdAt: '2026-09-28T00:00:00Z',
    }
    put.mockResolvedValue({ data: updated })

    const result = await activityApi.update('1', {
      name: 'Walk longer',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
    })

    expect(result).toEqual(updated)
    expect(put).toHaveBeenCalledWith('/activities/1', {
      name: 'Walk longer',
      category: 'ROUTINE',
      description: null,
      repeatable: true,
    })
  })

  it('FRONTEND-002-AC-05: remove() deletes and resolves with no value', async () => {
    del.mockResolvedValue({ data: undefined })

    await activityApi.remove('1')

    expect(del).toHaveBeenCalledWith('/activities/1')
  })

  it('FRONTEND-002-AC-06: rejects with a typed ApiError on failure', async () => {
    get.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Server error', details: null } },
    })

    await expect(activityApi.getAll()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Server error',
    })
  })

  it('FRONTEND-006: archive() posts to the archive endpoint and returns the updated activity', async () => {
    const archived = {
      id: '1',
      name: 'Apply for jobs',
      category: 'NECESSARY',
      description: null,
      repeatable: false,
      archived: true,
      createdAt: '2026-09-28T00:00:00Z',
    }
    post.mockResolvedValue({ data: archived })

    const result = await activityApi.archive('1')

    expect(result).toEqual(archived)
    expect(post).toHaveBeenCalledWith('/activities/1/archive')
  })

  it('FRONTEND-006: unarchive() deletes the archive endpoint and resolves with no value', async () => {
    del.mockResolvedValue({ data: undefined })

    await activityApi.unarchive('1')

    expect(del).toHaveBeenCalledWith('/activities/1/archive')
  })
})
