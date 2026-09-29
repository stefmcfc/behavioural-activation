function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

function toLinear(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexA)
  const luminanceB = relativeLuminance(hexB)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Computes the WCAG relative-luminance contrast ratio of `backgroundHex` against both
 * pure black and pure white, and returns whichever achieves the higher ratio. Guarantees only
 * the objectively better of the two fixed choices — not that the winner clears any particular
 * WCAG contrast threshold (e.g. AA's 4.5:1) for every possible background.
 */
export function getReadableTextColor(backgroundHex: string): '#000000' | '#ffffff' {
  const contrastWithBlack = contrastRatio(backgroundHex, '#000000')
  const contrastWithWhite = contrastRatio(backgroundHex, '#ffffff')
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff'
}
