/**
 * Worker管理插件
 * 负责Worker池管理、任务调度、健康检查
 */

import { Plugin } from './Plugin.js'

export class WorkerPlugin extends Plugin {
  static get meta() {
    return {
      name: 'WorkerPlugin',
      version: '1.0.0',
      description: 'Worker池管理和任务调度',
      author: 'ResourceAccelerator',
      dependencies: [],
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      maxWorkers: 2,
      timeout: 5000,
      healthCheck: {
        enabled: true,
        interval: 10000,
        maxErrors: 3,
      },
      heartbeat: {
        enabled: true,
        interval: 2000,
        timeout: 3000,
        maxRetryCount: 2,
      },
      warmup: true,
    }
  }

  async init() {
    this.workers = []
    this.taskQueue = []
    this.backupQueue = new Map() // 任务备份队列
    this.taskCallbacks = new Map()
    this.taskId = 0
    this.workerStates = new Map()
    this.healthCheckTimer = null
    this.heartbeatTimer = null
    this.heartbeatPending = new Map() // 待响应的心跳

    // 创建Worker池
    this._initWorkerPool()

    // 启动健康检查
    if (this.options.healthCheck?.enabled) {
      this._startHealthCheck()
    }

    // 启动心跳检测
    if (this.options.heartbeat?.enabled) {
      this._startHeartbeat()
    }

    // 预热Worker
    if (this.options.warmup) {
      this._warmupWorkers()
    }

    this.log('info', 'init', {
      workers: this.workers.length,
      warmup: this.options.warmup,
      heartbeat: this.options.heartbeat?.enabled,
    })
  }

  async destroy() {
    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    // 停止心跳检测
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    // 终止所有Worker
    this.workers.forEach((w) => w.terminate())
    this.workers = []
    this.taskQueue = []
    this.backupQueue.clear()
    this.taskCallbacks.clear()
    this.workerStates.clear()
    this.heartbeatPending.clear()

    this.log('info', 'destroy')
  }

  _initWorkerPool() {
    const maxWorkers = this.options.maxWorkers || 2

    for (let i = 0; i < maxWorkers; i++) {
      const worker = this._createWorker(i)
      if (worker) {
        this.workers.push(worker)
        this.workerStates.set(worker, {
          status: 'idle',
          errorCount: 0,
          taskCount: 0,
          heartbeatFailures: 0,
        })
      }
    }
  }

  _createWorker(index) {
    try {
      const workerUrl = chrome.runtime.getURL('content/workers/image-compressor.worker.js')
      const worker = new Worker(workerUrl)

      worker.onmessage = (e) => this._handleWorkerMessage(worker, e)
      worker.onerror = (e) => this._handleWorkerError(worker, index, e)

      return worker
    } catch (error) {
      this.log('error', 'create_worker_failed', { index, error: error.message })
      return null
    }
  }

  _handleWorkerMessage(worker, e) {
    const { id, success, dataUrl, error, originalSize, compressedSize, type } = e.data

    // 处理心跳响应
    if (type === 'pong') {
      this._handleHeartbeatResponse(worker)
      return
    }

    const callback = this.taskCallbacks.get(id)

    if (!callback) {
      return
    }

    this.taskCallbacks.delete(id)
    this.backupQueue.delete(id) // 任务完成，删除备份

    // 更新Worker状态
    const state = this.workerStates.get(worker)
    if (state) {
      state.status = 'idle'
      state.taskCount++
      state.heartbeatFailures = 0 // 重置心跳失败计数
    }

    if (success) {
      callback.resolve({ dataUrl, originalSize, compressedSize })
    } else {
      callback.reject(new Error(error))
    }

    // 处理下一个任务
    this._processNextTask(worker)
  }

  _handleWorkerError(worker, index, e) {
    const state = this.workerStates.get(worker)
    if (state) {
      state.errorCount++
    }

    this.log('error', 'worker_error', { index, message: e.message })

    // 检查是否需要重启
    if (state && state.errorCount >= (this.options.healthCheck?.maxErrors || 3)) {
      this._restartWorker(index)
    }
  }

  _restartWorker(index) {
    const worker = this.workers[index]
    if (!worker) {
      return
    }

    const startTime = Date.now()
    const pendingTasks = this._getPendingTasksForWorker(worker)

    worker.terminate()
    this.workerStates.delete(worker)

    const newWorker = this._createWorker(index)
    if (newWorker) {
      this.workers[index] = newWorker
      this.workerStates.set(newWorker, {
        status: 'idle',
        errorCount: 0,
        taskCount: 0,
        heartbeatFailures: 0,
      })

      // 恢复备份任务
      this._recoverTasks(pendingTasks)

      const recoveryTime = Date.now() - startTime
      this.emit('worker:restarted', { index, recoveryTime, pendingTasks: pendingTasks.length })

      this.log('info', 'worker_restarted', {
        index,
        recoveryTime,
        recoveredTasks: pendingTasks.length,
      })
    }
  }

  _getPendingTasksForWorker(worker) {
    // 获取当前Worker正在处理的任务（从backupQueue）
    const pendingTasks = []
    for (const [id, task] of this.backupQueue.entries()) {
      // backupQueue中存储的是所有待处理任务的备份
      if (!this.taskCallbacks.has(id)) {
        continue
      }
      pendingTasks.push({ id, ...task })
    }
    return pendingTasks
  }

  _recoverTasks(tasks) {
    // 按优先级重放任务
    tasks.sort((a, b) => (a.priority || 0) - (b.priority || 0))

    for (const task of tasks) {
      const worker = this._getIdleWorker()
      if (worker) {
        this._sendTaskToWorker(worker, task)
      } else {
        // 无可用Worker，重新加入队列
        this.taskQueue.push(task)
      }
    }
  }

  _startHealthCheck() {
    this.healthCheckTimer = setInterval(() => {
      this.workers.forEach((worker, index) => {
        const state = this.workerStates.get(worker)
        if (!state) {
          return
        }

        // 检查错误计数
        if (state.errorCount >= this.options.healthCheck.maxErrors) {
          this._restartWorker(index)
        }
      })
    }, this.options.healthCheck.interval)
  }

  /**
   * 启动心跳检测
   */
  _startHeartbeat() {
    const { interval = 2000, timeout = 3000, maxRetryCount = 2 } = this.options.heartbeat

    this.heartbeatTimer = setInterval(() => {
      this.workers.forEach((worker, index) => {
        const state = this.workerStates.get(worker)
        if (!state || state.status === 'busy') {
          return
        }

        // 发送ping
        const pingId = `ping-${index}-${Date.now()}`
        this.heartbeatPending.set(pingId, {
          worker,
          index,
          timestamp: Date.now(),
          timeout,
        })

        worker.postMessage({ type: 'ping', id: pingId })

        // 设置超时检测
        setTimeout(() => {
          const pending = this.heartbeatPending.get(pingId)
          if (pending) {
            this.heartbeatPending.delete(pingId)
            state.heartbeatFailures = (state.heartbeatFailures || 0) + 1

            this.log('warn', 'heartbeat_timeout', {
              index,
              failures: state.heartbeatFailures,
            })

            // 超过最大重试次数，重启Worker
            if (state.heartbeatFailures >= maxRetryCount) {
              this.log('error', 'heartbeat_failed', { index, failures: state.heartbeatFailures })
              this._restartWorker(index)
            }
          }
        }, timeout)
      })
    }, interval)
  }

  /**
   * 处理心跳响应
   */
  _handleHeartbeatResponse(worker) {
    const state = this.workerStates.get(worker)
    if (state) {
      state.heartbeatFailures = 0
    }

    // 清理对应的心跳pending
    for (const [pingId, pending] of this.heartbeatPending.entries()) {
      if (pending.worker === worker) {
        this.heartbeatPending.delete(pingId)
        break
      }
    }
  }

  _warmupWorkers() {
    const testPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    this.workers.forEach((worker, i) => {
      const id = `warmup-${i}-${Date.now()}`
      worker.postMessage({
        id,
        src: testPng,
        quality: 0.1,
        maxWidth: 1,
        maxHeight: 1,
      })
    })

    this.log('info', 'workers_warmup', { count: this.workers.length })
  }

  _processNextTask(worker) {
    if (this.taskQueue.length === 0) {
      return
    }

    // 优先级排序
    this.taskQueue.sort((a, b) => a.priority - b.priority)
    const task = this.taskQueue.shift()

    if (!task) {
      return
    }

    this._sendTaskToWorker(worker, task)
  }

  _sendTaskToWorker(worker, task) {
    const state = this.workerStates.get(worker)
    if (state) {
      state.status = 'busy'
    }

    const { id, src, quality, maxWidth, maxHeight, priority, isCors } = task

    worker.postMessage({ id, src, quality, maxWidth, maxHeight, priority, isCors })
  }

  /**
   * 压缩图片
   * @param {string} src - 图片URL
   * @param {Object} options - 压缩选项
   * @returns {Promise<Object>} 压缩结果
   */
  async compressImage(src, options = {}) {
    return new Promise((resolve, reject) => {
      const worker = this._getIdleWorker()
      const isCors = this._isCorsUrl(src)

      const task = {
        id: ++this.taskId,
        src,
        quality: options.quality || 0.8,
        maxWidth: options.maxWidth || 2048,
        maxHeight: options.maxWidth || 2048,
        priority: options.priority || 0,
        isCors,
        resolve,
        reject,
      }

      // 保存任务备份（入队时即保存）
      this.backupQueue.set(task.id, {
        src: task.src,
        quality: task.quality,
        maxWidth: task.maxWidth,
        maxHeight: task.maxHeight,
        priority: task.priority,
        isCors: task.isCors,
      })

      if (!worker) {
        // 加入队列
        this.taskQueue.push(task)
        return
      }

      // 设置超时
      const timer = setTimeout(() => {
        this.taskCallbacks.delete(task.id)
        this.backupQueue.delete(task.id)
        reject(new Error('Worker timeout'))
      }, this.options.timeout)

      // 保存回调
      this.taskCallbacks.set(task.id, {
        resolve: (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })

      this._sendTaskToWorker(worker, task)
    })
  }

  _getIdleWorker() {
    for (const [worker, state] of this.workerStates.entries()) {
      if (state.status === 'idle') {
        return worker
      }
    }
    return null
  }

  _isCorsUrl(url) {
    if (!url || url.startsWith('data:')) {
      return false
    }

    try {
      const urlObj = new URL(url, location.href)
      return urlObj.origin !== location.origin
    } catch {
      return true
    }
  }

  /**
   * 获取Worker统计信息
   */
  getStats() {
    const stats = {
      workers: this.workers.length,
      idle: 0,
      busy: 0,
      error: 0,
      queueLength: this.taskQueue.length,
      backupQueueLength: this.backupQueue.size,
    }

    this.workerStates.forEach((state) => {
      if (state.status === 'idle') {
        stats.idle++
      } else if (state.status === 'busy') {
        stats.busy++
      } else if (state.status === 'error') {
        stats.error++
      }
    })

    return stats
  }
}
