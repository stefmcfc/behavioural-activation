import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const buttonVariantsCss = readFileSync(resolve(__dirname, './buttonVariants.module.css'), 'utf-8')

describe('FRONTEND-031-AC-02: .primary variant', () => {
  it('sets background/border-color/color from --accent tokens', () => {
    expect(buttonVariantsCss).toMatch(/\.primary\s*\{[^}]*background:\s*var\(--accent\)/s)
    expect(buttonVariantsCss).toMatch(/\.primary\s*\{[^}]*border-color:\s*var\(--accent\)/s)
    expect(buttonVariantsCss).toMatch(/\.primary\s*\{[^}]*color:\s*var\(--accent-ink\)/s)
  })

  it('defines a .primary:hover rule preserving the existing box-shadow lift', () => {
    expect(buttonVariantsCss).toMatch(
      /\.primary:hover\s*\{[^}]*box-shadow:\s*rgba\(43, 42, 40, 0\.1\) 0 2px 4px, rgba\(43, 42, 40, 0\.28\) 0 6px 14px -6px/s,
    )
  })

  it('re-asserts background/color on hover, so the global button:hover rule cannot override them', () => {
    // Regression guard: index.css's `button:hover` sets `background: var(--code-bg)` with higher
    // specificity than `.primary`'s own (unhovered) background -- without re-asserting
    // background/color here, hovering a primary button paired --accent-ink text against
    // --code-bg, producing near-zero contrast in both themes.
    expect(buttonVariantsCss).toMatch(/\.primary:hover\s*\{[^}]*background:\s*var\(--accent\)/s)
    expect(buttonVariantsCss).toMatch(/\.primary:hover\s*\{[^}]*color:\s*var\(--accent-ink\)/s)
  })
})

describe('FRONTEND-031-AC-03: .destructive variant', () => {
  it('sets background/border-color/color from --error tokens', () => {
    expect(buttonVariantsCss).toMatch(/\.destructive\s*\{[^}]*background:\s*var\(--error\)/s)
    expect(buttonVariantsCss).toMatch(/\.destructive\s*\{[^}]*border-color:\s*var\(--error\)/s)
    expect(buttonVariantsCss).toMatch(/\.destructive\s*\{[^}]*color:\s*var\(--error-ink\)/s)
  })

  it('defines a .destructive:hover rule with the same box-shadow hover treatment', () => {
    expect(buttonVariantsCss).toMatch(
      /\.destructive:hover\s*\{[^}]*box-shadow:\s*rgba\(43, 42, 40, 0\.1\) 0 2px 4px, rgba\(43, 42, 40, 0\.28\) 0 6px 14px -6px/s,
    )
  })

  it('re-asserts background/color on hover, so the global button:hover rule cannot override them', () => {
    expect(buttonVariantsCss).toMatch(/\.destructive:hover\s*\{[^}]*background:\s*var\(--error\)/s)
    expect(buttonVariantsCss).toMatch(/\.destructive:hover\s*\{[^}]*color:\s*var\(--error-ink\)/s)
  })
})

describe('FRONTEND-031-AC-04: neither variant overrides :focus-visible', () => {
  it('contains no :focus-visible rule anywhere in the stylesheet', () => {
    expect(buttonVariantsCss).not.toMatch(/:focus-visible/)
  })
})
