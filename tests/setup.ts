/**
 * Vitest测试设置文件
 */

import { beforeAll, afterAll, vi } from 'vitest'

// 模拟Chrome API
const mockChrome = {
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve())
    },
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve())
    }
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn()
  }
}

// 注入到全局
beforeAll(() => {
  global.chrome = mockChrome as any
})

// 清理
afterAll(() => {
  vi.clearAllMocks()
})

// 模拟performance.memory
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024
  },
  configurable: true
})

// 模拟IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
}

window.IntersectionObserver = MockIntersectionObserver as any

// 模拟ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

window.ResizeObserver = MockResizeObserver as any

// 模拟PerformanceObserver
class MockPerformanceObserver {
  private callback: Function

  constructor(callback: Function) {
    this.callback = callback
  }

  observe = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

window.PerformanceObserver = MockPerformanceObserver as any

// 抑制console.warn（测试中）
vi.spyOn(console, 'warn').mockImplementation(() => {})

// 导出mock对象供测试使用
export { mockChrome }
