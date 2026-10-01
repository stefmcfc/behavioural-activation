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
  it('declares the Quiet Room light values as the light branch of each light-dark() token', () => {
    const root = block(themeCss, ':root')
    expect(root).toContain('light-dark(#706c64, #b3ac9f)')
    expect(root).toContain('light-dark(#2b2a28, #f1ede6)')
    expect(root).toContain('light-dark(#faf8f5, #211f1c)')
    expect(root).toContain('light-dark(#e4dfd7, #3c3833)')
    expect(root).toContain('light-dark(#f2efe9, #2f2c27)')
    expect(root).toContain('light-dark(#5f7a5e, #93b28e)')
    expect(root).toContain('light-dark(rgba(95, 122, 94, 0.12), rgba(147, 178, 142, 0.15))')
    expect(root).toContain('light-dark(rgba(95, 122, 94, 0.45), rgba(147, 178, 142, 0.5))')
    expect(root).toContain('light-dark(rgba(43, 42, 40, 0.07), rgba(0, 0, 0, 0.35))')
    expect(root).toContain('light-dark(rgba(43, 42, 40, 0.22), rgba(0, 0, 0, 0.5))')
    expect(root).toContain('var(--shadow-color-1) 0 1px 2px')
    expect(root).toContain('var(--shadow-color-2) 0 4px 10px -6px')
    expect(themeCss).not.toContain('#aa3bff')
  })
})

describe('FRONTEND-007-AC-02: dark theme tokens', () => {
  it('declares the Quiet Room dark values as the dark branch of each light-dark() token, no leftover purple accent', () => {
    const root = block(themeCss, ':root')
    expect(root).toContain('light-dark(#706c64, #b3ac9f)')
    expect(root).toContain('light-dark(#2b2a28, #f1ede6)')
    expect(root).toContain('light-dark(#faf8f5, #211f1c)')
    expect(root).toContain('light-dark(#e4dfd7, #3c3833)')
    expect(root).toContain('light-dark(#f2efe9, #2f2c27)')
    expect(root).toContain('light-dark(#5f7a5e, #93b28e)')
    expect(root).toContain('rgba(147, 178, 142, 0.15)')
    expect(root).toContain('light-dark(rgba(43, 42, 40, 0.07), rgba(0, 0, 0, 0.35))')
    expect(root).toContain('light-dark(rgba(43, 42, 40, 0.22), rgba(0, 0, 0, 0.5))')
    expect(themeCss).not.toContain('#c084fc')
  })
})

describe('FRONTEND-007-AC-03: --surface token defined for both branches', () => {
  it('defines --surface as light-dark(#ffffff, #2a2825) in :root', () => {
    expect(block(themeCss, ':root')).toContain('light-dark(#ffffff, #2a2825)')
  })
})

describe('FRONTEND-007-AC-04: category tokens unchanged', () => {
  it('still defines the Okabe-Ito defaults untouched', () => {
    expect(themeCss).toContain('--category-routine: #0072b2')
    expect(themeCss).toContain('--category-necessary: #e69f00')
    expect(themeCss).toContain('--category-pleasurable: #009e73')
  })
})

describe('tooling_spec_003 (no-spec refactor): light-dark() collapses the duplicated theme blocks', () => {
  it('defines color-scheme: light dark at :root, so System mode defers to the OS preference', () => {
    expect(block(themeCss, ':root')).toContain('color-scheme: light dark')
  })

  it('pins color-scheme to a single value in each data-theme override, without re-declaring colors', () => {
    const light = block(themeCss, "[data-theme='light']")
    const dark = block(themeCss, "[data-theme='dark']")
    expect(light.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe('color-scheme: light;')
    expect(dark.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe('color-scheme: dark;')
  })

  it('no longer has a prefers-color-scheme media query or duplicated token blocks', () => {
    expect(themeCss).not.toContain('@media (prefers-color-scheme: dark)')
  })

  it('every color token is declared exactly once via light-dark(), not duplicated per selector', () => {
    const occurrences = (themeCss.match(/--text:/g) ?? []).length
    expect(occurrences).toBe(1)
  })
})
