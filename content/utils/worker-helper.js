/**
 * Worker 创建工具
 * 提供 Manifest V3 兼容的 Worker 创建，自动处理 CSP 限制
 */

/**
 * 创建扩展内 Worker
 * @param {string} workerPath - 相对于扩展根目录的 Worker 文件路径（如 'content/workers/xxx.worker.js'）
 * @param {Object} options - 配置选项
 * @param {Function} options.onMessage - 消息处理函数
 * @param {Function} options.onError - 错误处理函数
 * @param {Function} options.onCSPBlocked - CSP 阻止时的回调
 * @returns {Worker|null} Worker 实例或 null（创建失败时）
 */
export function createExtensionWorker(workerPath, options = {}) {
  const { onMessage, onError, onCSPBlocked } = options

  try {
    // 检查 chrome.runtime 是否可用
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('[WorkerHelper] chrome.runtime 不可用，无法创建 Worker')
      return null
    }

    // 使用 chrome.runtime.getURL() 获取扩展内资源 URL
    const workerUrl = chrome.runtime.getURL(workerPath)
    const worker = new Worker(workerUrl)

    // 消息处理
    if (onMessage) {
      worker.onmessage = onMessage
    }

    // 错误处理（包含 CSP 检测）
    worker.onerror = (e) => {
      // 检测 CSP 错误
      if (e.message && e.message.includes('Content Security Policy')) {
        console.warn(`[WorkerHelper] Worker ${workerPath} 被 CSP 阻止`)
        if (onCSPBlocked) {
          onCSPBlocked(e)
        }
        return
      }

      console.error(`[WorkerHelper] Worker ${workerPath} 错误:`, e.message)
      if (onError) {
        onError(e)
      }
    }

    return worker
  } catch (e) {
    // 捕获同步错误（如 CSP 阻止或路径错误）
    console.warn(`[WorkerHelper] Worker ${workerPath} 创建失败:`, e.message)
    return null
  }
}

/**
 * Worker 池管理器
 * 管理多个 Worker 实例，支持动态扩缩容和健康检查
 */
export class WorkerPool {
  constructor(options = {}) {
    this.workerPath = options.workerPath
    this.maxWorkers = options.maxWorkers || 4
    this.minWorkers = options.minWorkers || 1
    this.onMessage = options.onMessage
    this.onCSPBlocked = options.onCSPBlocked
    this.workers = []
    this.isAvailable = true
    this.loadIndex = 0
  }

  /**
   * 初始化 Worker 池
   */
  init() {
    for (let i = 0; i < this.minWorkers; i++) {
      const worker = this._createWorker()
      if (worker) {
        this.workers.push(worker)
      }
    }

    if (this.workers.length === 0) {
      this.isAvailable = false
    }

    return this.isAvailable
  }

  /**
   * 获取可用 Worker（轮询）
   */
  getWorker() {
    if (!this.isAvailable || this.workers.length === 0) {
      return null
    }
    const worker = this.workers[this.loadIndex % this.workers.length]
    this.loadIndex++
    return worker
  }

  /**
   * 扩容 Worker 池
   */
  scaleUp() {
    if (this.workers.length >= this.maxWorkers) {
      return null
    }
    const worker = this._createWorker()
    if (worker) {
      this.workers.push(worker)
      return worker
    }
    return null
  }

  /**
   * 缩容 Worker 池
   */
  scaleDown() {
    if (this.workers.length <= this.minWorkers) {
      return false
    }
    const worker = this.workers.pop()
    if (worker) {
      worker.terminate()
      return true
    }
    return false
  }

  /**
   * 重建崩溃的 Worker
   */
  rebuild(index) {
    if (index < 0 || index >= this.workers.length) {
      return false
    }
    const oldWorker = this.workers[index]
    if (oldWorker) {
      oldWorker.terminate()
    }
    const newWorker = this._createWorker()
    if (newWorker) {
      this.workers[index] = newWorker
      return true
    }
    return false
  }

  /**
   * 销毁 Worker 池
   */
  destroy() {
    for (const worker of this.workers) {
      if (worker) {
        worker.terminate()
      }
    }
    this.workers = []
    this.isAvailable = false
  }

  /**
   * 获取当前 Worker 数量
   */
  get size() {
    return this.workers.length
  }

  _createWorker() {
    return createExtensionWorker(this.workerPath, {
      onMessage: this.onMessage,
      onCSPBlocked: (e) => {
        this.isAvailable = false
        if (this.onCSPBlocked) {
          this.onCSPBlocked(e)
        }
      },
    })
  }
}

/**
 * 检测当前环境是否支持 Worker
 * @returns {boolean}
 */
export function isWorkerSupported() {
  return typeof Worker !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime
}
