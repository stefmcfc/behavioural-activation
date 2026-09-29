import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-30/AC-31: TabNav and Settings stay fully token-driven', () => {
  it('contains no hardcoded hex colours', () => {
    const tabNavCss = readFileSync(resolve(__dirname, './TabNav.module.css'), 'utf-8')
    const settingsCss = readFileSync(resolve(__dirname, '../Settings/Settings.module.css'), 'utf-8')
    expect(tabNavCss).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(settingsCss).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
