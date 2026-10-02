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

// jsdom (as of v30) doesn't implement the Popover API at all: no showPopover()/hidePopover()/
// togglePopover() methods exist on HTMLElement, and jsdom's built-in stylesheet unconditionally
// applies `display: none` to any [popover] element (there's no `:popover-open` support to ever
// flip it back) -- confirmed by direct inspection, not assumed. Clicking a button with
// popovertarget also does nothing natively, since the click-activation-behavior algorithm that
// wires popovertarget buttons up to their target isn't implemented either. Polyfill just enough of
// the real contract (open/close via an inline display override, native toggle-on-click via
// popovertarget/popovertargetaction, and popover="auto" mutual exclusivity -- only one auto
// popover open at a time) for SettingsMenu/AccountMenu to be testable. Native light-dismiss
// (click-outside/Escape) is deliberately NOT polyfilled here -- that's exactly the part
// FRONTEND-030-AC-06 marks [MANUAL] and verifies in a real browser instead.
if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.showPopover) {
  const openAutoPopovers = new Set<HTMLElement>()

  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    const popoverType = this.getAttribute('popover')
    if (popoverType === null || openAutoPopovers.has(this)) return

    if (popoverType !== 'manual') {
      for (const other of openAutoPopovers) {
        if (other !== this && other.getAttribute('popover') !== 'manual') {
          other.hidePopover()
        }
      }
      openAutoPopovers.add(this)
    }
    this.style.display = 'block'
  }

  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    openAutoPopovers.delete(this)
    this.style.display = 'none'
  }

  HTMLElement.prototype.togglePopover = function (
    this: HTMLElement,
    options?: boolean | TogglePopoverOptions,
  ): boolean {
    const isOpen = this.style.display === 'block'
    const force = typeof options === 'boolean' ? options : options?.force
    const shouldOpen = force === undefined ? !isOpen : force
    if (shouldOpen) {
      this.showPopover()
    } else {
      this.hidePopover()
    }
    return shouldOpen
  }

  document.addEventListener('click', (event) => {
    const clicked = event.target as HTMLElement | null
    const trigger = clicked?.closest('[popovertarget]')
    if (!trigger) return
    const targetId = trigger.getAttribute('popovertarget')
    const panel = targetId ? document.getElementById(targetId) : null
    if (!panel) return

    const action = trigger.getAttribute('popovertargetaction')
    if (action === 'show') {
      panel.showPopover()
    } else if (action === 'hide') {
      panel.hidePopover()
    } else {
      panel.togglePopover()
    }
  })
}
