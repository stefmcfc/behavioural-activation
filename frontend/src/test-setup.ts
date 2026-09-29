import '@testing-library/jest-dom'

// jsdom doesn't implement matchMedia. Provide a default stub (prefers-color-scheme: dark = false)
// so components that call it (e.g. Settings' "System" mode indicator) don't crash in tests that
// don't explicitly stub it themselves.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
