import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(resolve(__dirname, './theme.css'), 'utf-8')

function block(source: string, selector: string): string {
  const start = source.indexOf(selector)
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

describe('FRONTEND-007-AC-01: light theme tokens', () => {
  it('defines the Quiet Room light values identically in :root and [data-theme="light"]', () => {
    for (const b of [block(themeCss, ':root'), block(themeCss, "[data-theme='light']")]) {
      expect(b).toContain('--text: #706c64')
      expect(b).toContain('--text-h: #2b2a28')
      expect(b).toContain('--bg: #faf8f5')
      expect(b).toContain('--border: #e4dfd7')
      expect(b).toContain('--code-bg: #f2efe9')
      expect(b).toContain('--accent: #5f7a5e')
      expect(b).toContain('--accent-bg: rgba(95, 122, 94, 0.12)')
      expect(b).toContain('--accent-border: rgba(95, 122, 94, 0.45)')
      expect(b).toContain('rgba(43, 42, 40, 0.07) 0 1px 2px')
      expect(b).toContain('rgba(43, 42, 40, 0.22) 0 4px 10px -6px')
    }
    expect(themeCss).not.toContain('#aa3bff')
  })
})

describe('FRONTEND-007-AC-02: dark theme tokens', () => {
  it('defines the Quiet Room dark values identically in the media query and [data-theme="dark"], no leftover purple accent', () => {
    const mediaBlock = block(themeCss, '@media (prefers-color-scheme: dark)')
    const dataThemeBlock = block(themeCss, "[data-theme='dark']")
    for (const b of [mediaBlock, dataThemeBlock]) {
      expect(b).toContain('--text: #b3ac9f')
      expect(b).toContain('--text-h: #f1ede6')
      expect(b).toContain('--bg: #211f1c')
      expect(b).toContain('--border: #3c3833')
      expect(b).toContain('--code-bg: #2f2c27')
      expect(b).toContain('--accent: #93b28e')
      expect(b).toContain('--accent-bg: rgba(147, 178, 142, 0.15)')
      expect(b).toContain('--accent-border: rgba(147, 178, 142, 0.5)')
      expect(b).toContain('rgba(0, 0, 0, 0.35) 0 1px 2px')
      expect(b).toContain('rgba(0, 0, 0, 0.5) 0 4px 10px -6px')
    }
    expect(themeCss).not.toContain('#c084fc')
  })
})

describe('FRONTEND-007-AC-03: --surface token added to all four blocks', () => {
  it('defines --surface distinct from --bg everywhere', () => {
    expect(block(themeCss, ':root')).toContain('--surface: #ffffff')
    expect(block(themeCss, "[data-theme='light']")).toContain('--surface: #ffffff')
    expect(block(themeCss, '@media (prefers-color-scheme: dark)')).toContain('--surface: #2a2825')
    expect(block(themeCss, "[data-theme='dark']")).toContain('--surface: #2a2825')
  })
})

describe('FRONTEND-007-AC-04: category tokens unchanged', () => {
  it('still defines the Okabe-Ito defaults untouched', () => {
    expect(themeCss).toContain('--category-routine: #0072b2')
    expect(themeCss).toContain('--category-necessary: #e69f00')
    expect(themeCss).toContain('--category-pleasurable: #009e73')
  })
})
