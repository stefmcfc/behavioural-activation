import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
const get = vi.fn()
const patch = vi.fn()
const del = vi.fn()
const create = vi.fn(() => ({ post, get, patch, delete: del }))

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

const { planApi } = await import('./planApi')

const occurrence = {
  id: '1',
  activityId: 'a1',
  subTaskId: null,
  name: 'Go for a walk',
  category: 'ROUTINE',
  weekStart: '2026-10-05',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

describe('planApi', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    patch.mockReset()
    del.mockReset()
  })

  describe('FRONTEND-004-AC-01: getWeek() calls GET /api/v1/plan, unwraps envelope', () => {
    it('calls GET /plan with the weekStart param and returns the data array', async () => {
      get.mockResolvedValue({ data: { data: [occurrence], count: 1 } })

      const result = await planApi.getWeek('2026-10-05')

      expect(result).toEqual([occurrence])
      expect(get).toHaveBeenCalledWith('/plan', { params: { weekStart: '2026-10-05' } })
    })
  })

  describe('FRONTEND-004-AC-02: create() calls POST /api/v1/plan/occurrences', () => {
    it('posts the input and returns the created occurrence', async () => {
      post.mockResolvedValue({ data: occurrence })

      const input = {
        activityId: 'a1',
        subTaskId: null,
        weekStart: '2026-10-05',
        dayOfWeek: 'MONDAY' as const,
        slot: 'MORNING' as const,
      }
      const result = await planApi.create(input)

      expect(result).toEqual(occurrence)
      expect(post).toHaveBeenCalledWith('/plan/occurrences', input)
    })
  })

  describe('FRONTEND-004-AC-03: move() calls PATCH /api/v1/plan/occurrences/{id}', () => {
    it('patches the occurrence and returns the updated one', async () => {
      const moved = { ...occurrence, dayOfWeek: 'TUESDAY', slot: 'AFTERNOON' }
      patch.mockResolvedValue({ data: moved })

      const input = { dayOfWeek: 'TUESDAY' as const, slot: 'AFTERNOON' as const }
      const result = await planApi.move('1', input)

      expect(result).toEqual(moved)
      expect(patch).toHaveBeenCalledWith('/plan/occurrences/1', input)
    })
  })

  describe('FRONTEND-004-AC-04: remove() calls DELETE /api/v1/plan/occurrences/{id}', () => {
    it('deletes the occurrence and resolves with no value', async () => {
      del.mockResolvedValue({ data: undefined })

      await planApi.remove('1')

      expect(del).toHaveBeenCalledWith('/plan/occurrences/1')
    })
  })

  describe('FRONTEND-004-AC-05: complete() calls POST .../occurrences/{id}/completion', () => {
    it('posts to the completion route and returns the updated occurrence', async () => {
      const completed = { ...occurrence, completed: true, completedAt: '2026-10-05T09:00:00Z' }
      post.mockResolvedValue({ data: completed })

      const result = await planApi.complete('1')

      expect(result).toEqual(completed)
      expect(post).toHaveBeenCalledWith('/plan/occurrences/1/completion')
    })
  })

  describe('FRONTEND-004-AC-06: undoCompletion() calls DELETE .../occurrences/{id}/completion', () => {
    it('deletes the completion record and resolves with no value', async () => {
      del.mockResolvedValue({ data: undefined })

      await planApi.undoCompletion('1')

      expect(del).toHaveBeenCalledWith('/plan/occurrences/1/completion')
    })
  })

  describe('FRONTEND-004-AC-07: carryForward() calls POST .../occurrences/{id}/carry-forward', () => {
    it('posts to the carry-forward route and returns the updated occurrence', async () => {
      const carried = { ...occurrence, weekStart: '2026-10-12' }
      post.mockResolvedValue({ data: carried })

      const result = await planApi.carryForward('1')

      expect(result).toEqual(carried)
      expect(post).toHaveBeenCalledWith('/plan/occurrences/1/carry-forward')
    })
  })

  describe('FRONTEND-004-AC-08: rejected calls throw a typed ApiError', () => {
    it('rejects with a typed ApiError on failure', async () => {
      get.mockRejectedValue({
        isAxiosError: true,
        message: 'Request failed with status code 500',
        response: { status: 500, data: { message: 'Server error', details: null } },
      })

      await expect(planApi.getWeek('2026-10-05')).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
        message: 'Server error',
      })
    })
  })
})
