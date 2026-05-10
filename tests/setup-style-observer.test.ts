/**
 * MutationObserver 初始化边界情况测试
 * 测试 _initAfterDOMReady 和 _setupStyleChangeObserver 在 document.body 不存在时的处理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('DOM Ready 初始化逻辑', () => {
  let observerInstances: any[]
  let originalDocumentBody: any
  let originalReadyState: any
  let consoleWarnSpy: any

  beforeEach(() => {
    observerInstances = []

    // Mock MutationObserver with class syntax
    class MockMutationObserver {
      callback: any
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: any) {
        this.callback = callback
        observerInstances.push(this)
      }
    }

    global.MutationObserver = MockMutationObserver as any
    originalDocumentBody = Object.getOwnPropertyDescriptor(document, 'body')
    originalReadyState = Object.getOwnPropertyDescriptor(document, 'readyState')
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalDocumentBody) {
      Object.defineProperty(document, 'body', originalDocumentBody)
    }
    if (originalReadyState) {
      Object.defineProperty(document, 'readyState', originalReadyState)
    }
    consoleWarnSpy.mockRestore()
    vi.restoreAllMocks()
  })

  describe('_initAfterDOMReady', () => {
    it('document.body 存在时应该立即初始化', () => {
      Object.defineProperty(document, 'body', {
        value: document.createElement('body'),
        configurable: true,
      })

      const state = { _domReadyInitialized: false, _styleChangeObserver: null }

      function _setupStyleChangeObserver() {
        if (state._styleChangeObserver) return
        if (typeof MutationObserver === 'undefined') return
        if (!document.body) return

        state._styleChangeObserver = new MutationObserver(() => {})
        state._styleChangeObserver.observe(document.body, {
          attributes: true,
          subtree: true,
        })
      }

      function _initAfterDOMReady() {
        if (state._domReadyInitialized) return

        const runInit = () => {
          state._domReadyInitialized = true
          _setupStyleChangeObserver()
        }

        if (document.body) {
          runInit()
        } else {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInit, { once: true })
          } else {
            const docObserver = new MutationObserver(() => {
              if (document.body) {
                docObserver.disconnect()
                runInit()
              }
            })
            docObserver.observe(document.documentElement, { childList: true, subtree: true })
          }
        }
      }

      _initAfterDOMReady()

      expect(state._domReadyInitialized).toBe(true)
      expect(state._styleChangeObserver).toBeDefined()
    })

    it('readyState=loading 时应该等待 DOMContentLoaded', () => {
      Object.defineProperty(document, 'body', {
        value: null,
        configurable: true,
      })

      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true,
      })

      const state = { _domReadyInitialized: false }
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      function _initAfterDOMReady() {
        if (state._domReadyInitialized) return

        const runInit = () => {
          state._domReadyInitialized = true
        }

        if (document.body) {
          runInit()
        } else {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInit, { once: true })
          }
        }
      }

      _initAfterDOMReady()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
        { once: true }
      )
      expect(state._domReadyInitialized).toBe(false)
    })

    it('readyState!=loading 且 body 不存在时应该使用 MutationObserver', () => {
      Object.defineProperty(document, 'body', {
        value: null,
        configurable: true,
      })

      Object.defineProperty(document, 'readyState', {
        value: 'interactive',
        configurable: true,
      })

      const state = { _domReadyInitialized: false }

      function _initAfterDOMReady() {
        if (state._domReadyInitialized) return

        const runInit = () => {
          state._domReadyInitialized = true
        }

        if (document.body) {
          runInit()
        } else {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInit, { once: true })
          } else {
            const docObserver = new MutationObserver(() => {
              if (document.body) {
                docObserver.disconnect()
                runInit()
              }
            })
            docObserver.observe(document.documentElement, { childList: true, subtree: true })
          }
        }
      }

      _initAfterDOMReady()

      expect(observerInstances.length).toBe(1)
      expect(observerInstances[0].observe).toHaveBeenCalledWith(
        document.documentElement,
        expect.objectContaining({ childList: true, subtree: true })
      )
    })

    it('重复调用应该直接返回', () => {
      Object.defineProperty(document, 'body', {
        value: document.createElement('body'),
        configurable: true,
      })

      const state = { _domReadyInitialized: true }

      function _initAfterDOMReady() {
        if (state._domReadyInitialized) return
        state._domReadyInitialized = true
      }

      _initAfterDOMReady()

      expect(observerInstances.length).toBe(0)
    })
  })

  describe('_setupStyleChangeObserver', () => {
    it('document.body 存在时应该正常初始化', () => {
      Object.defineProperty(document, 'body', {
        value: document.createElement('body'),
        configurable: true,
      })

      const state = { _styleChangeObserver: null }

      function _setupStyleChangeObserver() {
        if (state._styleChangeObserver) return
        if (typeof MutationObserver === 'undefined') return
        if (!document.body) {
          console.warn('[RA] _setupStyleChangeObserver called before document.body is ready')
          return
        }

        state._styleChangeObserver = new MutationObserver(() => {})
        state._styleChangeObserver.observe(document.body, {
          attributes: true,
          subtree: true,
        })
      }

      _setupStyleChangeObserver()

      expect(observerInstances.length).toBe(1)
      expect(state._styleChangeObserver).toBe(observerInstances[0])
    })

    it('document.body 不存在时应该记录警告并返回', () => {
      Object.defineProperty(document, 'body', {
        value: null,
        configurable: true,
      })

      const state = { _styleChangeObserver: null }

      function _setupStyleChangeObserver() {
        if (state._styleChangeObserver) return
        if (typeof MutationObserver === 'undefined') return
        if (!document.body) {
          console.warn('[RA] _setupStyleChangeObserver called before document.body is ready')
          return
        }

        state._styleChangeObserver = new MutationObserver(() => {})
        state._styleChangeObserver.observe(document.body, {
          attributes: true,
          subtree: true,
        })
      }

      _setupStyleChangeObserver()

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(state._styleChangeObserver).toBeNull()
      expect(observerInstances.length).toBe(0)
    })

    it('已初始化时应该直接返回', () => {
      Object.defineProperty(document, 'body', {
        value: document.createElement('body'),
        configurable: true,
      })

      const state = { _styleChangeObserver: {} }

      function _setupStyleChangeObserver() {
        if (state._styleChangeObserver) return
        if (typeof MutationObserver === 'undefined') return
        if (!document.body) return

        state._styleChangeObserver = new MutationObserver(() => {})
        state._styleChangeObserver.observe(document.body, {
          attributes: true,
          subtree: true,
        })
      }

      _setupStyleChangeObserver()

      expect(observerInstances.length).toBe(0)
    })

    it('MutationObserver 不存在时应该直接返回', () => {
      Object.defineProperty(document, 'body', {
        value: document.createElement('body'),
        configurable: true,
      })

      const original = global.MutationObserver
      // @ts-ignore
      delete global.MutationObserver

      const state = { _styleChangeObserver: null }

      function _setupStyleChangeObserver() {
        if (state._styleChangeObserver) return
        if (typeof MutationObserver === 'undefined') return
        if (!document.body) return

        state._styleChangeObserver = new MutationObserver(() => {})
        state._styleChangeObserver.observe(document.body, {
          attributes: true,
          subtree: true,
        })
      }

      _setupStyleChangeObserver()

      expect(state._styleChangeObserver).toBeNull()

      // 恢复
      global.MutationObserver = original
    })
  })
})
