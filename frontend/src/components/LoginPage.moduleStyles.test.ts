import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-28: login form controls have no bespoke override', () => {
  it('defines no button/input selector in LoginPage.module.css', () => {
    const css = readFileSync(resolve(__dirname, './LoginPage.module.css'), 'utf-8')
    expect(css).not.toMatch(/\bbutton\s*\{/)
    expect(css).not.toMatch(/input\[type=/)
  })
})
