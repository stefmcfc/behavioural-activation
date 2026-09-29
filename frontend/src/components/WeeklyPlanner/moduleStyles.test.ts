import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-13: uniform button treatment, no component-level override', () => {
  it('finds no button-element selector or primary/secondary class in any restyled module', () => {
    const files = [
      '../ActivityBank/ActivityBank.module.css',
      '../ActivityBank/SubTaskList.module.css',
      './PlannerGrid.module.css',
      './BucketList.module.css',
      './OccurrenceItem.module.css',
      './AssignActivityPicker.module.css',
      '../LoginPage.module.css',
    ]
    for (const file of files) {
      const css = readFileSync(resolve(__dirname, file), 'utf-8')
      expect(css).not.toMatch(/\bbutton\s*\{/)
      expect(css).not.toMatch(/primary|secondary/i)
    }
  })
})

describe('FRONTEND-007-AC-26: assign picker panel + no bespoke button/input override', () => {
  it('applies the panel class and defines no button/input selector', () => {
    const css = readFileSync(resolve(__dirname, './AssignActivityPicker.module.css'), 'utf-8')
    expect(css).toMatch(/\.panel\s*\{/)
    expect(css).not.toMatch(/\bbutton\s*\{/)
    expect(css).not.toMatch(/input\[type=/)
  })
})
