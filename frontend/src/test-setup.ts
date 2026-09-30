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

// jsdom doesn't implement <dialog>'s showModal()/close() (no native <dialog> support at all —
// https://github.com/jsdom/jsdom/issues/3294). Polyfill just enough of the real behaviour (open
// reflects the attribute already; showModal/close/the close event don't exist) for Modal.tsx to be
// testable — mirrors the browser contract Modal.tsx actually relies on.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) return
    if (returnValue !== undefined) {
      this.returnValue = returnValue
    }
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
