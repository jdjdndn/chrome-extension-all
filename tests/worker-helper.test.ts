/**
 * Worker 创建工具测试
 * 测试 Manifest V3 兼容的 Worker 创建功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createExtensionWorker, WorkerPool, isWorkerSupported } from '../content/utils/worker-helper.js'

// Mock Worker 类
class MockWorker {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  terminated = false

  constructor(url: string) {
    this.url = url
  }

  postMessage(_data: unknown): void {
    // 模拟异步消息
  }

  terminate(): void {
    this.terminated = true
  }

  // 模拟错误
  simulateError(message: string): void {
    if (this.onerror) {
      this.onerror({ message } as ErrorEvent)
    }
  }

  // 模拟消息
  simulateMessage<T>(data: T): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent)
    }
  }
}

describe('createExtensionWorker', () => {
  let originalChrome: typeof chrome | undefined
  let originalWorker: typeof Worker | undefined

  beforeEach(() => {
    // 保存原始对象
    originalChrome = global.chrome
    originalWorker = global.Worker

    // Mock Worker
    global.Worker = MockWorker as unknown as typeof Worker
  })

  afterEach(() => {
    // 恢复原始对象
    global.chrome = originalChrome
    global.Worker = originalWorker
    vi.clearAllMocks()
  })

  describe('正常创建 Worker', () => {
    it('应成功创建 Worker 实例', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const worker = createExtensionWorker('content/workers/test.worker.js')

      expect(worker).toBeInstanceOf(MockWorker)
      expect((worker as MockWorker).url).toBe('chrome-extension://test-id/content/workers/test.worker.js')
    })

    it('应正确设置消息回调', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const onMessage = vi.fn()
      const worker = createExtensionWorker('content/workers/test.worker.js', { onMessage })

      ;(worker as MockWorker).simulateMessage({ type: 'test' })

      expect(onMessage).toHaveBeenCalledWith({ data: { type: 'test' } })
    })

    it('应正确设置错误回调', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const onError = vi.fn()
      const worker = createExtensionWorker('content/workers/test.worker.js', { onError })

      ;(worker as MockWorker).simulateError('Some error')

      expect(onError).toHaveBeenCalled()
    })
  })

  describe('chrome.runtime 不可用', () => {
    it('chrome 未定义时返回 null', () => {
      // @ts-expect-error 测试未定义情况
      global.chrome = undefined

      const worker = createExtensionWorker('content/workers/test.worker.js')

      expect(worker).toBeNull()
    })

    it('chrome.runtime 不存在时返回 null', () => {
      global.chrome = {} as typeof chrome

      const worker = createExtensionWorker('content/workers/test.worker.js')

      expect(worker).toBeNull()
    })

    it('chrome.runtime.getURL 不存在时返回 null', () => {
      global.chrome = { runtime: {} } as typeof chrome

      const worker = createExtensionWorker('content/workers/test.worker.js')

      expect(worker).toBeNull()
    })
  })

  describe('CSP 阻止处理', () => {
    it('检测到 CSP 错误时应调用 onCSPBlocked 回调', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const onCSPBlocked = vi.fn()
      const worker = createExtensionWorker('content/workers/test.worker.js', { onCSPBlocked })

      ;(worker as MockWorker).simulateError(
        "Content Security Policy: The page's settings blocked the loading of a resource"
      )

      expect(onCSPBlocked).toHaveBeenCalled()
    })

    it('CSP 错误不应触发 onError 回调', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const onError = vi.fn()
      const onCSPBlocked = vi.fn()
      const worker = createExtensionWorker('content/workers/test.worker.js', {
        onError,
        onCSPBlocked,
      })

      ;(worker as MockWorker).simulateError('Content Security Policy directive violated')

      expect(onError).not.toHaveBeenCalled()
      expect(onCSPBlocked).toHaveBeenCalled()
    })
  })

  describe('Worker 错误处理', () => {
    it('非 CSP 错误应触发 onError 回调', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      const onError = vi.fn()
      const worker = createExtensionWorker('content/workers/test.worker.js', { onError })

      ;(worker as MockWorker).simulateError('Uncaught ReferenceError: x is not defined')

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Uncaught ReferenceError: x is not defined',
        })
      )
    })
  })

  describe('同步错误捕获', () => {
    it('Worker 构造函数抛出异常时应返回 null', () => {
      global.chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      } as typeof chrome

      // Mock Worker 构造函数抛出异常
      global.Worker = class {
        constructor() {
          throw new Error('Failed to create Worker')
        }
      } as unknown as typeof Worker

      const worker = createExtensionWorker('content/workers/test.worker.js')

      expect(worker).toBeNull()
    })
  })
})

describe('WorkerPool', () => {
  let originalChrome: typeof chrome | undefined
  let originalWorker: typeof Worker | undefined
  let mockWorkers: MockWorker[]

  beforeEach(() => {
    originalChrome = global.chrome
    originalWorker = global.Worker
    mockWorkers = []

    // Mock chrome API
    global.chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`,
      },
    } as typeof chrome

    // Mock Worker，跟踪创建的实例
    global.Worker = class {
      url: string
      onmessage: ((e: MessageEvent) => void) | null = null
      onerror: ((e: ErrorEvent) => void) | null = null
      terminated = false

      constructor(url: string) {
        this.url = url
        mockWorkers.push(this as unknown as MockWorker)
      }

      postMessage() {}

      terminate() {
        this.terminated = true
      }
    } as unknown as typeof Worker
  })

  afterEach(() => {
    global.chrome = originalChrome
    global.Worker = originalWorker
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('应初始化 minWorkers 数量的 Worker', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
      })

      const result = pool.init()

      expect(result).toBe(true)
      expect(pool.size).toBe(2)
      expect(pool.isAvailable).toBe(true)
    })

    it('所有 Worker 创建失败时应标记为不可用', () => {
      // Mock Worker 构造失败
      global.Worker = class {
        constructor() {
          throw new Error('Failed')
        }
      } as unknown as typeof Worker

      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
      })

      const result = pool.init()

      expect(result).toBe(false)
      expect(pool.size).toBe(0)
      expect(pool.isAvailable).toBe(false)
    })
  })

  describe('轮询获取 Worker', () => {
    it('应通过轮询返回 Worker', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
      })
      pool.init()

      const worker1 = pool.getWorker()
      const worker2 = pool.getWorker()
      const worker3 = pool.getWorker()

      expect(worker1).toBeDefined()
      expect(worker2).toBeDefined()
      // 第三个应该回到第一个（轮询）
      expect(worker3).toBe(worker1)
    })

    it('池不可用时应返回 null', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 1,
      })
      pool.init()
      pool.isAvailable = false

      expect(pool.getWorker()).toBeNull()
    })

    it('池为空时应返回 null', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 1,
      })
      pool.init()
      pool.workers = []

      expect(pool.getWorker()).toBeNull()
    })
  })

  describe('扩容', () => {
    it('未达上限时成功扩容', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 1,
        maxWorkers: 3,
      })
      pool.init()

      const newWorker = pool.scaleUp()

      expect(newWorker).toBeDefined()
      expect(pool.size).toBe(2)
    })

    it('已达上限时返回 null', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
        maxWorkers: 2,
      })
      pool.init()

      const result = pool.scaleUp()

      expect(result).toBeNull()
      expect(pool.size).toBe(2)
    })
  })

  describe('缩容', () => {
    it('高于最小值时成功缩容', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 1,
        maxWorkers: 3,
      })
      pool.init()
      pool.scaleUp()

      const result = pool.scaleDown()

      expect(result).toBe(true)
      expect(pool.size).toBe(1)
      expect(mockWorkers[1].terminated).toBe(true)
    })

    it('已达最小值时缩容失败', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
        maxWorkers: 4,
      })
      pool.init()

      const result = pool.scaleDown()

      expect(result).toBe(false)
      expect(pool.size).toBe(2)
    })
  })

  describe('重建崩溃的 Worker', () => {
    it('有效索引时成功重建', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
      })
      pool.init()

      const oldWorker = pool.workers[0]
      const result = pool.rebuild(0)

      expect(result).toBe(true)
      expect(oldWorker.terminated).toBe(true)
      expect(pool.workers[0]).not.toBe(oldWorker)
    })

    it('无效索引时重建失败', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 2,
      })
      pool.init()

      expect(pool.rebuild(-1)).toBe(false)
      expect(pool.rebuild(10)).toBe(false)
    })
  })

  describe('销毁', () => {
    it('应终止所有 Worker 并清空池', () => {
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 3,
      })
      pool.init()

      pool.destroy()

      expect(pool.size).toBe(0)
      expect(pool.isAvailable).toBe(false)
      expect(mockWorkers.every((w) => w.terminated)).toBe(true)
    })
  })

  describe('CSP 阻止处理', () => {
    it('Worker 被 CSP 阻止时应标记池为不可用', () => {
      const onCSPBlocked = vi.fn()
      const pool = new WorkerPool({
        workerPath: 'content/workers/test.worker.js',
        minWorkers: 1,
        onCSPBlocked,
      })
      pool.init()

      // 模拟 CSP 错误
      if (pool.workers[0].onerror) {
        pool.workers[0].onerror({ message: 'Content Security Policy blocked' } as ErrorEvent)
      }

      expect(pool.isAvailable).toBe(false)
      expect(onCSPBlocked).toHaveBeenCalled()
    })
  })
})

describe('isWorkerSupported', () => {
  let originalChrome: typeof chrome | undefined
  let originalWorker: typeof Worker | undefined

  beforeEach(() => {
    originalChrome = global.chrome
    originalWorker = global.Worker
  })

  afterEach(() => {
    global.chrome = originalChrome
    global.Worker = originalWorker
  })

  it('Worker 和 chrome.runtime 都可用时返回 true', () => {
    global.Worker = function () {} as unknown as typeof Worker
    global.chrome = { runtime: {} } as typeof chrome

    expect(isWorkerSupported()).toBe(true)
  })

  it('Worker 未定义时返回 false', () => {
    // @ts-expect-error 测试未定义情况
    global.Worker = undefined
    global.chrome = { runtime: {} } as typeof chrome

    expect(isWorkerSupported()).toBe(false)
  })

  it('chrome 未定义时返回 false', () => {
    global.Worker = function () {} as unknown as typeof Worker
    // @ts-expect-error 测试未定义情况
    global.chrome = undefined

    expect(isWorkerSupported()).toBe(false)
  })

  it('chrome.runtime 未定义时返回 false', () => {
    global.Worker = function () {} as unknown as typeof Worker
    global.chrome = {} as typeof chrome

    expect(isWorkerSupported()).toBe(false)
  })
})
