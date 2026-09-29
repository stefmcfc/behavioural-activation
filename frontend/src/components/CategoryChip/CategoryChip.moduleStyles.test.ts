import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-29: CategoryChip matches the new type scale', () => {
  it('updates font-size/weight/padding, keeps the pill radius', () => {
    const css = readFileSync(resolve(__dirname, './CategoryChip.module.css'), 'utf-8')
    expect(css).toContain('font-size: 0.72rem')
    expect(css).toContain('font-weight: 700')
    expect(css).toContain('padding: 0.18rem 0.65rem')
    expect(css).toContain('border-radius: 999px')
  })
})
