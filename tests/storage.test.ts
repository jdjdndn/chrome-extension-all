/**
 * StorageUtils 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Chrome Storage API
const mockSyncGet = vi.fn()
const mockSyncSet = vi.fn()
const mockLocalGet = vi.fn()
const mockLocalSet = vi.fn()
const mockRemove = vi.fn()
const mockOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
}

global.chrome = {
  storage: {
    sync: {
      get: mockSyncGet,
      set: mockSyncSet,
    },
    local: {
      get: mockLocalGet,
      set: mockLocalSet,
      remove: mockRemove,
    },
    onChanged: mockOnChanged,
  },
} as any

describe('StorageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    delete (window as any).StorageBridge
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('isExtensionContext', () => {
    it('should return truthy when chrome.storage exists', async () => {
      const { isExtensionContext } = await import('../content/utils/storage.js')
      expect(isExtensionContext()).toBeTruthy()
    })

    it('should return false when chrome is undefined', async () => {
      const originalChrome = global.chrome
      // @ts-ignore
      delete global.chrome

      vi.resetModules()
      const { isExtensionContext: checkContext } = await import('../content/utils/storage.js')
      expect(checkContext()).toBe(false)

      global.chrome = originalChrome
    })
  })

  describe('getSync', () => {
    it('should call chrome.storage.sync.get', async () => {
      mockSyncGet.mockResolvedValue({ testKey: 'testValue' })

      const { getSync } = await import('../content/utils/storage.js')
      const result = await getSync('testKey')

      expect(mockSyncGet).toHaveBeenCalledWith('testKey')
      expect(result).toEqual({ testKey: 'testValue' })
    })

    it('should return empty object when extension context invalid', async () => {
      const originalChrome = global.chrome
      // @ts-ignore
      delete global.chrome

      vi.resetModules()
      const { getSync } = await import('../content/utils/storage.js')
      const result = await getSync('testKey')
      expect(result).toEqual({})

      global.chrome = originalChrome
    })
  })

  describe('setSync', () => {
    it('should call chrome.storage.sync.set', async () => {
      mockSyncSet.mockResolvedValue(undefined)

      const { setSync } = await import('../content/utils/storage.js')
      const result = await setSync({ testKey: 'testValue' })

      expect(mockSyncSet).toHaveBeenCalledWith({ testKey: 'testValue' })
      expect(result).toBe(true)
    })
  })

  describe('getLocal', () => {
    it('should call chrome.storage.local.get', async () => {
      mockLocalGet.mockResolvedValue({ testKey: 'localValue' })

      const { getLocal } = await import('../content/utils/storage.js')
      const result = await getLocal('testKey')

      expect(mockLocalGet).toHaveBeenCalledWith('testKey')
      expect(result).toEqual({ testKey: 'localValue' })
    })
  })

  describe('setLocal', () => {
    it('should call chrome.storage.local.set', async () => {
      mockLocalSet.mockResolvedValue(undefined)

      const { setLocal } = await import('../content/utils/storage.js')
      const result = await setLocal({ testKey: 'localValue' })

      expect(mockLocalSet).toHaveBeenCalledWith({ testKey: 'localValue' })
      expect(result).toBe(true)
    })
  })

  describe('remove', () => {
    it('should call chrome.storage.local.remove by default', async () => {
      mockRemove.mockResolvedValue(undefined)

      const { remove } = await import('../content/utils/storage.js')
      const result = await remove('testKey')

      expect(mockRemove).toHaveBeenCalledWith('testKey')
      expect(result).toBe(true)
    })
  })

  describe('watch', () => {
    it('should add listener to chrome.storage.onChanged', async () => {
      const { watch } = await import('../content/utils/storage.js')
      const callback = vi.fn()
      const unsubscribe = watch('testKey', callback)

      expect(mockOnChanged.addListener).toHaveBeenCalled()

      // Test listener callback
      const listener = mockOnChanged.addListener.mock.calls[0][0]
      listener({ testKey: { newValue: 'new', oldValue: 'old' } }, 'local')

      expect(callback).toHaveBeenCalledWith('new', 'old')

      // Test unsubscribe
      unsubscribe()
      expect(mockOnChanged.removeListener).toHaveBeenCalled()
    })
  })

  describe('getDomainSettings', () => {
    it('should return domain settings from local storage', async () => {
      mockLocalGet.mockResolvedValue({
        domainSettings: {
          'example.com': { enabled: true },
        },
      })

      const { getDomainSettings } = await import('../content/utils/storage.js')
      const result = await getDomainSettings('domainSettings', 'example.com')

      expect(result).toEqual({ enabled: true })
    })

    it('should return null for unknown domain', async () => {
      mockLocalGet.mockResolvedValue({
        domainSettings: {
          'example.com': { enabled: true },
        },
      })

      const { getDomainSettings } = await import('../content/utils/storage.js')
      const result = await getDomainSettings('domainSettings', 'unknown.com')

      expect(result).toBeNull()
    })
  })

  describe('setDomainSettings', () => {
    it('should save domain settings to local storage', async () => {
      mockLocalGet.mockResolvedValue({})
      mockLocalSet.mockResolvedValue(undefined)

      const { setDomainSettings } = await import('../content/utils/storage.js')
      const result = await setDomainSettings('domainSettings', 'example.com', { enabled: true })

      expect(mockLocalSet).toHaveBeenCalledWith({
        domainSettings: {
          'example.com': { enabled: true },
        },
      })
      expect(result).toBe(true)
    })
  })
})
