import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(resolve(__dirname, './index.css'), 'utf-8')

describe('FRONTEND-007-AC-05: sans/heading font stack updated', () => {
  it('includes -apple-system in --sans and --heading', () => {
    expect(indexCss).toMatch(/--sans:\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*sans-serif/)
    expect(indexCss).toMatch(/--heading:\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*sans-serif/)
  })
})

describe('FRONTEND-007-AC-06/AC-07: heading weight, tracking, balance', () => {
  it('sets bold, tighter, balanced headings', () => {
    expect(indexCss).toContain('font-weight: 700')
    expect(indexCss).toContain('letter-spacing: -0.01em')
    expect(indexCss).toContain('text-wrap: balance')
  })
})

describe('FRONTEND-007-AC-08: tabular numerals globally', () => {
  it('applies font-variant-numeric: tabular-nums', () => {
    expect(indexCss).toContain('font-variant-numeric: tabular-nums')
  })
})

describe('FRONTEND-007-AC-10/AC-11/AC-12: global button base styles', () => {
  it('defines the pill button rule reusing the shared shadow token', () => {
    expect(indexCss).toMatch(/button\s*\{[^}]*border-radius:\s*999px/s)
    expect(indexCss).toMatch(/button\s*\{[^}]*box-shadow:\s*var\(--shadow\)/s)
  })

  it('gates the hover transition behind prefers-reduced-motion', () => {
    expect(indexCss).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*button:hover/)
  })

  it('sets a visible focus-visible outline using the accent token', () => {
    expect(indexCss).toMatch(/button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/s)
  })
})

describe('FRONTEND-031-AC-05: disabled-state dimming', () => {
  it('defines a generic button:disabled rule with reduced opacity and not-allowed cursor', () => {
    expect(indexCss).toMatch(/button:disabled\s*\{[^}]*opacity:/s)
    expect(indexCss).toMatch(/button:disabled\s*\{[^}]*cursor:\s*not-allowed/s)
  })
})

describe('FRONTEND-007-AC-14: text input/textarea/select base styles', () => {
  it('defines the moderate-radius field rule', () => {
    expect(indexCss).toMatch(/input\[type="text"\],\s*textarea,\s*select\s*\{[^}]*border-radius:\s*6px/s)
  })
})

describe('FRONTEND-007-AC-15: colour input sizing', () => {
  it('defines a dedicated input[type="color"] rule', () => {
    expect(indexCss).toMatch(/input\[type="color"\]\s*\{[^}]*width:\s*2\.5rem/s)
  })
})

describe('FRONTEND-007-AC-16: radio accent-color only', () => {
  it('sets accent-color with no other overrides', () => {
    expect(indexCss).toMatch(/input\[type="radio"\]\s*\{\s*accent-color:\s*var\(--accent\);\s*\}/)
  })
})
