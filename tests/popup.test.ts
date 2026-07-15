import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Mock Chrome APIs (must be set up before evaluating popup.js)
// ---------------------------------------------------------------------------
global.chrome = {
  storage: {
    sync: { get: vi.fn(), set: vi.fn() },
    local: { get: vi.fn(), set: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(),
    getURL: vi.fn((p: string) => `chrome-extension://test/${p}`),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
} as any

// ---------------------------------------------------------------------------
// Helpers – extract & evaluate individual functions from popup.js
// ---------------------------------------------------------------------------
const POPUP_PATH = path.resolve(__dirname, '..', 'popup.js')
const popupSource = fs.readFileSync(POPUP_PATH, 'utf-8')

/**
 * Extract the full source of a named function declaration from popup.js,
 * correctly handling nested braces.
 */
function extractFunction(source: string, funcName: string): string {
  const marker = `function ${funcName}(`
  const startIdx = source.indexOf(marker)
  if (startIdx === -1) throw new Error(`Function "${funcName}" not found in popup.js`)

  let depth = 0
  let started = false
  let endIdx = startIdx

  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === '{') {
      depth++
      started = true
    } else if (source[i] === '}') {
      depth--
      if (started && depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  return source.substring(startIdx, endIdx)
}

// Pre-extract function sources
const parseSelectorsSource = extractFunction(popupSource, 'parseSelectors')
const parseDomainInputSource = extractFunction(popupSource, 'parseDomainInput')
const showToastSource = extractFunction(popupSource, 'showToast')
const showConfirmSource = extractFunction(popupSource, 'showConfirm')

// ---------------------------------------------------------------------------
// Evaluate pure functions in an isolated scope (no DOM/Chrome needed)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-new-func
const parseSelectors: (text: string) => string[] = new Function(
  `${parseSelectorsSource}\nreturn parseSelectors;`,
)()

// eslint-disable-next-line no-new-func
const parseDomainInput: (input: string) => string[] = new Function(
  `${parseDomainInputSource}\nreturn parseDomainInput;`,
)()

// For DOM-interacting functions we evaluate in global scope so they can
// reference `document`, `requestAnimationFrame`, `setTimeout`, etc.
;(0, eval)(showToastSource)
;(0, eval)(showConfirmSource)

declare const showToast: (message: string, type?: string, duration?: number) => void
declare const showConfirm: (message: string) => Promise<boolean>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSelectors', () => {
  it('returns empty array for empty / falsy input', () => {
    expect(parseSelectors('')).toEqual([])
    expect(parseSelectors(null as any)).toEqual([])
    expect(parseSelectors(undefined as any)).toEqual([])
  })

  it('parses a single selector', () => {
    expect(parseSelectors('.my-class')).toEqual(['.my-class'])
  })

  // ---- newline-separated ----

  it('parses newline-separated selectors', () => {
    const input = '.header\n.footer\n.sidebar'
    expect(parseSelectors(input)).toEqual(['.header', '.footer', '.sidebar'])
  })

  it('trims whitespace from newline-separated selectors', () => {
    const input = '  .header  \n  .footer  '
    expect(parseSelectors(input)).toEqual(['.header', '.footer'])
  })

  it('skips blank lines in newline-separated input', () => {
    const input = '.header\n\n\n.footer'
    expect(parseSelectors(input)).toEqual(['.header', '.footer'])
  })

  it('strips surrounding quotes on newline-separated selectors', () => {
    const input = '".quoted-selector"\n\'.another-one\''
    expect(parseSelectors(input)).toEqual(['.quoted-selector', '.another-one'])
  })

  it('deduplicates newline-separated selectors', () => {
    const input = '.dup\n.dup\n.other'
    expect(parseSelectors(input)).toEqual(['.dup', '.other'])
  })

  // ---- space-separated (single-line) ----

  it('parses space-separated simple selectors', () => {
    expect(parseSelectors('.a .b .c')).toEqual(['.a', '.b', '.c'])
  })

  it('handles single-quoted selectors containing double quotes on a single line', () => {
    // Single-quote wrapping preserves internal double quotes (e.g. attribute selectors)
    const input = `'xg-icon:not([class*="foo"])' .simple`
    expect(parseSelectors(input)).toEqual(['xg-icon:not([class*="foo"])', '.simple'])
  })

  it('handles double-quoted selectors containing single quotes on a single line', () => {
    const input = `"div[class*='bar']" .other`
    expect(parseSelectors(input)).toEqual(["div[class*='bar']", '.other'])
  })

  // ---- complex selectors with parens / brackets ----

  it('does not split inside parentheses or brackets', () => {
    const input = 'div:not(.hidden) span[class~="item"]'
    expect(parseSelectors(input)).toEqual(['div:not(.hidden)', 'span[class~="item"]'])
  })

  it('handles deeply nested pseudo-selectors', () => {
    const input = 'xg-icon:not([class*="recommend"])\n.video-card'
    expect(parseSelectors(input)).toEqual([
      'xg-icon:not([class*="recommend"])',
      '.video-card',
    ])
  })

  it('handles a selector with multiple nested brackets and parens', () => {
    const sel = 'div:not([data-type="ad"]):not([class*="banner"])'
    expect(parseSelectors(sel)).toEqual([sel])
  })

  // ---- deduplication across formats ----

  it('deduplicates identical selectors regardless of position', () => {
    const input = '.dup .other .dup'
    expect(parseSelectors(input)).toEqual(['.dup', '.other'])
  })

  // ---- edge cases ----

  it('handles input that is only whitespace', () => {
    expect(parseSelectors('   \n   \n   ')).toEqual([])
  })

  it('handles a trailing newline', () => {
    expect(parseSelectors('.foo\n')).toEqual(['.foo'])
  })

  it('handles selectors with combinators (>, +, ~)', () => {
    // When on separate lines each is its own selector
    const input = 'div > span\nul + p\nh1 ~ h2'
    expect(parseSelectors(input)).toEqual(['div > span', 'ul + p', 'h1 ~ h2'])
  })
})

describe('parseDomainInput', () => {
  it('returns empty array for empty / falsy input', () => {
    expect(parseDomainInput('')).toEqual([])
    expect(parseDomainInput(null as any)).toEqual([])
    expect(parseDomainInput(undefined as any)).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parseDomainInput('   ')).toEqual([])
  })

  it('parses a single domain', () => {
    expect(parseDomainInput('example.com')).toEqual(['example.com'])
  })

  it('trims whitespace from a single domain', () => {
    expect(parseDomainInput('  example.com  ')).toEqual(['example.com'])
  })

  it('parses comma-separated domains', () => {
    expect(parseDomainInput('a.com, b.com, c.com')).toEqual([
      'a.com',
      'b.com',
      'c.com',
    ])
  })

  it('handles extra spaces around commas', () => {
    expect(parseDomainInput('  a.com  ,  b.com  ')).toEqual(['a.com', 'b.com'])
  })

  it('strips surrounding double quotes', () => {
    expect(parseDomainInput('"a.com, b.com"')).toEqual(['a.com', 'b.com'])
  })

  it('strips surrounding single quotes', () => {
    expect(parseDomainInput("'a.com, b.com'")).toEqual(['a.com', 'b.com'])
  })

  it('filters out empty segments from trailing commas', () => {
    expect(parseDomainInput('a.com,')).toEqual(['a.com'])
    expect(parseDomainInput('a.com,,b.com')).toEqual(['a.com', 'b.com'])
  })

  it('handles subdomains and ports', () => {
    expect(parseDomainInput('tracking.example.com:8080')).toEqual([
      'tracking.example.com:8080',
    ])
  })
})

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('creates the toast container on first call', () => {
    showToast('Hello', 'info')

    const container = document.getElementById('popup-toast-container')
    expect(container).not.toBeNull()
    expect(container?.tagName).toBe('DIV')
  })

  it('reuses existing container on subsequent calls', () => {
    showToast('First')
    showToast('Second')

    const containers = document.querySelectorAll('#popup-toast-container')
    expect(containers.length).toBe(1)
  })

  it('creates a toast element with the correct message', () => {
    showToast('Test message', 'success')

    const container = document.getElementById('popup-toast-container')!
    expect(container.children.length).toBe(1)
    expect(container.children[0].textContent).toBe('Test message')
  })

  it('applies the correct background colour for each type', () => {
    showToast('err', 'error')
    showToast('ok', 'success')

    const container = document.getElementById('popup-toast-container')!
    const errorToast = container.children[0] as HTMLElement
    const successToast = container.children[1] as HTMLElement

    // jsdom normalises hex colours to rgb() format
    expect(errorToast.style.background).toBe('rgb(239, 68, 68)')    // #ef4444
    expect(successToast.style.background).toBe('rgb(16, 185, 129)') // #10b981
  })

  it('defaults type to info when not specified', () => {
    showToast('msg')

    const container = document.getElementById('popup-toast-container')!
    const toast = container.children[0] as HTMLElement
    expect(toast.style.background).toBe('rgb(51, 51, 51)') // #333
  })

  it('auto-removes the toast after the specified duration', () => {
    vi.spyOn(requestAnimationFrame, 'bind').mockImplementation(() => (() => {}) as any)

    showToast('temp', 'info', 500)

    const container = document.getElementById('popup-toast-container')!
    expect(container.children.length).toBe(1)

    // Advance past duration + fade-out delay (300ms)
    vi.advanceTimersByTime(500 + 300 + 1)

    expect(container.children.length).toBe(0)
  })

  it('creates multiple toasts stacked in the container', () => {
    showToast('A')
    showToast('B')
    showToast('C')

    const container = document.getElementById('popup-toast-container')!
    expect(container.children.length).toBe(3)
    expect(container.children[0].textContent).toBe('A')
    expect(container.children[1].textContent).toBe('B')
    expect(container.children[2].textContent).toBe('C')
  })
})

describe('showConfirm', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('creates an overlay with the provided message', () => {
    showConfirm('Are you sure?')

    // The overlay is a fixed-position div appended to body
    const overlay = document.body.lastElementChild!
    expect(overlay).not.toBeNull()
    // The inner box should contain the message text
    expect(overlay.textContent).toContain('Are you sure?')
  })

  it('renders OK and Cancel buttons', () => {
    showConfirm('Proceed?')

    const overlay = document.body.lastElementChild!
    const buttons = overlay.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].textContent).toBe('取消') // Cancel
    expect(buttons[1].textContent).toBe('确定') // OK
  })

  it('resolves true when OK is clicked', async () => {
    const promise = showConfirm('Confirm?')

    const overlay = document.body.lastElementChild!
    const okBtn = overlay.querySelectorAll('button')[1]
    okBtn.click()

    await expect(promise).resolves.toBe(true)
  })

  it('resolves false when Cancel is clicked', async () => {
    const promise = showConfirm('Cancel me?')

    const overlay = document.body.lastElementChild!
    const cancelBtn = overlay.querySelectorAll('button')[0]
    cancelBtn.click()

    await expect(promise).resolves.toBe(false)
  })

  it('removes the overlay after a button is clicked', async () => {
    const promise = showConfirm('Remove me')
    const initialChildCount = document.body.children.length

    const overlay = document.body.lastElementChild!
    const okBtn = overlay.querySelectorAll('button')[1]
    okBtn.click()
    await promise

    expect(document.body.children.length).toBe(initialChildCount - 1)
  })

  it('supports multiple concurrent confirm dialogs', async () => {
    const p1 = showConfirm('First?')
    const p2 = showConfirm('Second?')

    const overlays = document.body.querySelectorAll('body > div')
    expect(overlays.length).toBe(2)

    // Click OK on first, Cancel on second
    const firstOk = overlays[0].querySelectorAll('button')[1]
    const secondCancel = overlays[1].querySelectorAll('button')[0]

    firstOk.click()
    secondCancel.click()

    expect(await p1).toBe(true)
    expect(await p2).toBe(false)
  })
})
