import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

// Mock window properties
const mockWindow = () => {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>')
  global.window = dom.window as any
  global.document = dom.window.document
  global.MutationObserver = dom.window.MutationObserver
  global.console = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}

describe('CSSAccelerator', () => {
  let CSSAccelerator: any

  beforeEach(async () => {
    mockWindow()
    // Import the module fresh for each test
    vi.resetModules()
    const mod = await import('./css-accelerator')
    CSSAccelerator = mod.default || mod.CSSAccelerator
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clean up global state
    delete (global as any).window
    delete (global as any).document
    delete (global as any).MutationObserver
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const accelerator = new CSSAccelerator()
      expect(accelerator.enabled).toBe(true)
      expect(accelerator.excludePatterns).toEqual([])
      expect(accelerator.reportEnabled).toBe(true)
      expect(accelerator.stats).toEqual({
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        details: [],
      })
    })

    it('should accept custom options', () => {
      const options = {
        enabled: false,
        excludePatterns: ['example.com'],
        reportEnabled: false,
      }
      const accelerator = new CSSAccelerator(options)
      expect(accelerator.enabled).toBe(false)
      expect(accelerator.excludePatterns).toEqual(['example.com'])
      expect(accelerator.reportEnabled).toBe(false)
    })

    it('should initialize with existing window.CSSAccelerator', () => {
      ;(window as any).CSSAccelerator = true
      const accelerator = new CSSAccelerator()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('已存在，跳过初始化'))
    })
  })

  describe('init', () => {
    it('should not process links when disabled', () => {
      const accelerator = new CSSAccelerator({ enabled: false })
      const processSpy = vi.spyOn(accelerator, '_processExistingLinks')
      accelerator.init()
      expect(processSpy).not.toHaveBeenCalled()
    })

    it('should process existing links when enabled', () => {
      const accelerator = new CSSAccelerator()
      const processSpy = vi.spyOn(accelerator, '_processExistingLinks')
      accelerator.init()
      expect(processSpy).toHaveBeenCalled()
    })

    it('should setup mutation observer', () => {
      const accelerator = new CSSAccelerator()
      const observerSpy = vi.spyOn(accelerator, '_setupMutationObserver')
      accelerator.init()
      expect(observerSpy).toHaveBeenCalled()
    })
  })

  describe('processLink', () => {
    let accelerator: any

    beforeEach(() => {
      accelerator = new CSSAccelerator()
      ;(window as any).CDNMappings = {
        matchCSS: vi.fn(),
      }
    })

    it('should skip processing when disabled', () => {
      accelerator.enabled = false
      const link = document.createElement('link')
      link.href = 'https://example.com/style.css'
      accelerator.processLink(link)
      expect(accelerator.stats.total).toBe(0)
    })

    it('should skip links without href', () => {
      const link = document.createElement('link')
      accelerator.processLink(link)
      expect(accelerator.stats.total).toBe(0)
    })

    it('should skip already processed links', () => {
      const link = document.createElement('link')
      link.href = 'https://example.com/style.css'
      accelerator.processLink(link)
      accelerator.processLink(link) // Second call
      expect(accelerator.stats.total).toBe(1)
    })

    it('should skip excluded patterns', () => {
      accelerator.excludePatterns = ['example.com']
      const link = document.createElement('link')
      link.href = 'https://example.com/style.css'
      accelerator.processLink(link)
      expect(accelerator.stats.skipped).toBe(1)
    })

    it('should skip target CDN URLs', () => {
      accelerator._isTargetCDN = vi.fn().mockReturnValue(true)
      const link = document.createElement('link')
      link.href = 'https://cdn.example.com/style.css'
      accelerator.processLink(link)
      expect(accelerator.stats.skipped).toBe(1)
    })

    it('should skip when no CDN match found', () => {
      ;(window as any).CDNMappings.matchCSS.mockReturnValue(null)
      const link = document.createElement('link')
      link.href = 'https://unknown.com/style.css'
      accelerator.processLink(link)
      expect(accelerator.stats.skipped).toBe(1)
    })

    it('should replace href when CDN match found', () => {
      const mockMatch = {
        name: 'Test Framework',
        cdnUrl: 'https://cdn.example.com/test.css',
      }
      ;(window as any).CDNMappings.matchCSS.mockReturnValue(mockMatch)

      const link = document.createElement('link')
      const originalUrl = 'https://original.com/style.css'
      link.href = originalUrl

      accelerator.processLink(link)

      expect(link.href).toBe(mockMatch.cdnUrl)
      expect(accelerator.stats.replaced).toBe(1)
      expect(accelerator.stats.details).toContainEqual(
        expect.objectContaining({
          name: mockMatch.name,
          original: originalUrl,
          cdn: mockMatch.cdnUrl,
        })
      )
    })

    it('should handle errors during replacement', () => {
      ;(window as any).CDNMappings.matchCSS.mockImplementation(() => {
        throw new Error('Test error')
      })

      const link = document.createElement('link')
      link.href = 'https://error.com/style.css'

      accelerator.processLink(link)
      expect(accelerator.stats.errors).toBe(1)
    })
  })

  describe('mutation observer', () => {
    let accelerator: any

    beforeEach(() => {
      accelerator = new CSSAccelerator()
      ;(window as any).CDNMappings = {
        matchCSS: vi.fn(),
      }
      accelerator.init()
    })

    it('should process dynamically added link elements', async () => {
      const mockMatch = {
        name: 'Dynamic CSS',
        cdnUrl: 'https://cdn.example.com/dynamic.css',
      }
      ;(window as any).CDNMappings.matchCSS.mockReturnValue(mockMatch)

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://dynamic.com/style.css'
      document.head.appendChild(link)

      // Wait for mutation observer to process
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(accelerator.stats.replaced).toBe(1)
      expect(link.href).toBe(mockMatch.cdnUrl)
    })

    it('should process links in dynamically added containers', async () => {
      const mockMatch = {
        name: 'Nested CSS',
        cdnUrl: 'https://cdn.example.com/nested.css',
      }
      ;(window as any).CDNMappings.matchCSS.mockReturnValue(mockMatch)

      const div = document.createElement('div')
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://nested.com/style.css'
      div.appendChild(link)
      document.body.appendChild(div)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(accelerator.stats.replaced).toBe(1)
    })
  })

  describe('statistics', () => {
    it('should track multiple replacements', () => {
      const accelerator = new CSSAccelerator()
      ;(window as any).CDNMappings = {
        matchCSS: vi
          .fn()
          .mockReturnValueOnce({ name: 'CSS 1', cdnUrl: 'https://cdn1.example.com/1.css' })
          .mockReturnValueOnce({ name: 'CSS 2', cdnUrl: 'https://cdn2.example.com/2.css' })
          .mockReturnValueOnce(null),
      }

      const links = [
        document.createElement('link'),
        document.createElement('link'),
        document.createElement('link'),
      ]

      links[0].href = 'https://example1.com/style.css'
      links[1].href = 'https://example2.com/style.css'
      links[2].href = 'https://example3.com/style.css'

      links.forEach((link) => accelerator.processLink(link))

      expect(accelerator.stats.total).toBe(3)
      expect(accelerator.stats.replaced).toBe(2)
      expect(accelerator.stats.skipped).toBe(1)
      expect(accelerator.stats.details.length).toBe(2)
    })
  })

  describe('reporting', () => {
    it('should call _reportReplacement when reportEnabled', () => {
      const accelerator = new CSSAccelerator({ reportEnabled: true })
      ;(window as any).CDNMappings = {
        matchCSS: vi
          .fn()
          .mockReturnValue({ name: 'Test', cdnUrl: 'https://cdn.example.com/test.css' }),
      }

      const reportSpy = vi.spyOn(accelerator, '_reportReplacement')
      const link = document.createElement('link')
      link.href = 'https://example.com/style.css'

      accelerator.processLink(link)

      expect(reportSpy).toHaveBeenCalled()
    })

    it('should not call _reportReplacement when reportEnabled is false', () => {
      const accelerator = new CSSAccelerator({ reportEnabled: false })
      ;(window as any).CDNMappings = {
        matchCSS: vi
          .fn()
          .mockReturnValue({ name: 'Test', cdnUrl: 'https://cdn.example.com/test.css' }),
      }

      const reportSpy = vi.spyOn(accelerator, '_reportReplacement')
      const link = document.createElement('link')
      link.href = 'https://example.com/style.css'

      accelerator.processLink(link)

      expect(reportSpy).not.toHaveBeenCalled()
    })
  })
})
