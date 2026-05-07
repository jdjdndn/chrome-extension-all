/**
 * MessagingUtils 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Chrome API
const mockSendMessage = vi.fn()
const mockOnMessage = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
}

global.chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: mockSendMessage,
    onMessage: mockOnMessage,
  },
} as any

// Mock EventBus
global.EventBus = {
  getState: () => ({ isReady: true }),
  request: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
  on: vi.fn(),
} as any

// Mock ScriptLoader
global.ScriptLoader = {
  waitFor: vi.fn().mockResolvedValue(true),
  markReady: vi.fn(),
} as any

describe('MessagingUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('isExtensionContext', () => {
    it('should return truthy when chrome.runtime.id exists', async () => {
      const { isExtensionContext } = await import('../content/utils/messaging.js')
      expect(isExtensionContext()).toBeTruthy()
    })

    it('should return false when chrome is undefined', async () => {
      const originalChrome = global.chrome
      // @ts-ignore
      delete global.chrome

      vi.resetModules()
      const { isExtensionContext: checkContext } = await import('../content/utils/messaging.js')
      expect(checkContext()).toBe(false)

      global.chrome = originalChrome
    })
  })

  describe('isExtensionContextValid', () => {
    it('should return true for valid context', async () => {
      const { isExtensionContextValid } = await import('../content/utils/messaging.js')
      expect(isExtensionContextValid()).toBe(true)
    })
  })

  describe('sendToBackground', () => {
    it('should send message via EventBus when ready', async () => {
      const mockResponse = { success: true }
      ;(global.EventBus.request as any).mockResolvedValue(mockResponse)

      const { sendToBackground } = await import('../content/utils/messaging.js')
      const result = await sendToBackground({ type: 'TEST_MESSAGE', data: 'test' })

      expect(global.EventBus.request).toHaveBeenCalledWith(
        'TEST_MESSAGE',
        expect.anything(),
        expect.anything()
      )
    })

    it('should fallback to chrome.runtime.sendMessage when EventBus fails', async () => {
      ;(global.EventBus.request as any).mockRejectedValue(new Error('EventBus error'))
      mockSendMessage.mockResolvedValue({ success: true })

      const { sendToBackground } = await import('../content/utils/messaging.js')
      const result = await sendToBackground({ type: 'TEST_MESSAGE' })

      expect(mockSendMessage).toHaveBeenCalled()
    })

    it('should return null when extension context is invalid', async () => {
      const originalChrome = global.chrome
      // @ts-ignore
      delete global.chrome

      vi.resetModules()
      const { sendToBackground } = await import('../content/utils/messaging.js')
      const result = await sendToBackground({ type: 'TEST' })
      expect(result).toBeNull()

      global.chrome = originalChrome
    })
  })

  describe('subscribe', () => {
    it('should subscribe via EventBus when ready', async () => {
      const mockUnsubscribe = vi.fn()
      ;(global.EventBus.subscribe as any).mockReturnValue(mockUnsubscribe)

      const { subscribe } = await import('../content/utils/messaging.js')
      const callback = vi.fn()
      const unsubscribe = subscribe('TEST_EVENT', callback)

      expect(global.EventBus.subscribe).toHaveBeenCalledWith('TEST_EVENT', callback)
    })
  })

  describe('publish', () => {
    it('should publish via EventBus when ready', async () => {
      const { publish } = await import('../content/utils/messaging.js')
      await publish('TEST_EVENT', { data: 'test' })

      expect(global.EventBus.publish).toHaveBeenCalledWith('TEST_EVENT', { data: 'test' })
    })
  })
})
