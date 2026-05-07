import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟 DOM 环境
describe('DOMUtils', () => {
  beforeEach(() => {
    // 重置 DOM
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  describe('generateHideCSS', () => {
    it('should generate CSS for hiding elements', async () => {
      const { generateHideCSS } = await import('../content/utils/dom.ts')
      const selectors = ['.ad-banner', '#popup']
      const css = generateHideCSS(selectors)

      expect(css).toContain('.ad-banner { display: none !important; }')
      expect(css).toContain('#popup { display: none !important; }')
    })

    it('should filter empty selectors', async () => {
      const { generateHideCSS } = await import('../content/utils/dom.ts')
      const selectors = ['.ad', '', '  ', '#popup']
      const css = generateHideCSS(selectors)

      expect(css).toContain('.ad')
      expect(css).toContain('#popup')
      expect(css.split('\n').length).toBe(2)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const { debounce } = await import('../content/utils/dom.ts')
      vi.useFakeTimers()

      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(mockFn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      const { throttle } = await import('../content/utils/dom.ts')
      vi.useFakeTimers()

      const mockFn = vi.fn().mockReturnValue('result')
      const throttledFn = throttle(mockFn, 100)

      const result1 = throttledFn()
      throttledFn()
      throttledFn()

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(result1).toBe('result')

      vi.advanceTimersByTime(100)
      throttledFn()

      expect(mockFn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('createThrottleState', () => {
    it('should create throttle state', async () => {
      const { createThrottleState } = await import('../content/utils/dom.ts')
      vi.useFakeTimers()

      const state = createThrottleState(100)

      expect(state.check()).toBe(true)
      expect(state.check()).toBe(false)

      vi.advanceTimersByTime(100)

      expect(state.check()).toBe(true)

      state.reset()
      expect(state.check()).toBe(true)

      vi.useRealTimers()
    })
  })
})
