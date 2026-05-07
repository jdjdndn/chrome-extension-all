/**
 * 增量更新策略模块
 * 对于大量选中元素，使用增量更新避免性能问题
 */
;(function () {
  'use strict'

  class IncrementalUpdater {
    constructor(options = {}) {
      this.batchSize = options.batchSize || 10
      this.frameDelay = options.frameDelay || 1
      this.updateQueue = []
      this.isProcessing = false
      this.callbacks = {
        onUpdate: options.onUpdate || null,
        onComplete: options.onComplete || null,
        onError: options.onError || null,
      }

      // 性能统计
      this.stats = {
        totalUpdates: 0,
        batchesProcessed: 0,
        avgBatchTime: 0,
        lastUpdateTime: 0,
      }
    }

    /**
     * 添加更新任务到队列
     */
    queueUpdate(task) {
      if (!task || !task.element) return

      this.updateQueue.push({
        element: task.element,
        pickerUid: task.pickerUid,
        type: task.type || 'position',
        timestamp: Date.now(),
        priority: task.priority || 0,
      })

      // 按优先级排序
      this.updateQueue.sort((a, b) => b.priority - a.priority)

      if (!this.isProcessing) {
        this.scheduleProcessing()
      }
    }

    /**
     * 批量添加更新任务
     */
    queueBatch(tasks) {
      if (!Array.isArray(tasks)) return

      tasks.forEach((task) => this.queueUpdate(task))
    }

    /**
     * 调度处理
     */
    scheduleProcessing() {
      if (this.isProcessing || this.updateQueue.length === 0) return

      this.isProcessing = true

      // 使用 requestAnimationFrame 进行调度
      requestAnimationFrame(() => {
        this.processBatch()
      })
    }

    /**
     * 处理一批更新
     */
    async processBatch() {
      if (this.updateQueue.length === 0) {
        this.isProcessing = false
        return
      }

      const startTime = performance.now()
      const batch = this.updateQueue.splice(0, this.batchSize)

      try {
        // 并行处理当前批次
        await Promise.all(batch.map((task) => this.processTask(task)))

        // 更新统计
        this.stats.batchesProcessed++
        this.stats.totalUpdates += batch.length
        const batchTime = performance.now() - startTime
        this.stats.avgBatchTime =
          (this.stats.avgBatchTime * (this.stats.batchesProcessed - 1) + batchTime) /
          this.stats.batchesProcessed
        this.stats.lastUpdateTime = Date.now()

        // 触发回调
        if (this.callbacks.onUpdate) {
          this.callbacks.onUpdate(batch)
        }

        // 继续处理剩余任务
        if (this.updateQueue.length > 0) {
          // 延迟一帧后继续
          requestAnimationFrame(() => this.processBatch())
        } else {
          this.isProcessing = false
          if (this.callbacks.onComplete) {
            this.callbacks.onComplete(this.stats)
          }
        }
      } catch (error) {
        if (this.callbacks.onError) {
          this.callbacks.onError(error, batch)
        }
        this.isProcessing = false
      }
    }

    /**
     * 处理单个任务
     */
    async processTask(task) {
      const { element, pickerUid, type } = task

      if (!element || !element.isConnected) {
        // 元素已从 DOM 中移除
        return { status: 'removed', pickerUid }
      }

      switch (type) {
        case 'position':
          return this.updatePosition(element, pickerUid)
        case 'style':
          return this.updateStyle(element, pickerUid)
        case 'highlight':
          return this.updateHighlight(element, pickerUid)
        default:
          return { status: 'unknown', pickerUid }
      }
    }

    /**
     * 更新位置
     */
    updatePosition(element, pickerUid) {
      const rect = element.getBoundingClientRect()

      return {
        status: 'success',
        pickerUid,
        position: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        },
      }
    }

    /**
     * 更新样式
     */
    updateStyle(element, pickerUid) {
      const computedStyle = window.getComputedStyle(element)

      return {
        status: 'success',
        pickerUid,
        style: {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
        },
      }
    }

    /**
     * 更新高亮
     */
    updateHighlight(element, pickerUid) {
      // 检查高亮元素是否存在
      const highlightEl = document.querySelector(`[data-ep-highlight="${pickerUid}"]`)

      if (highlightEl && element.isConnected) {
        const rect = element.getBoundingClientRect()
        highlightEl.style.left = rect.left + 'px'
        highlightEl.style.top = rect.top + 'px'
        highlightEl.style.width = rect.width + 'px'
        highlightEl.style.height = rect.height + 'px'

        return { status: 'success', pickerUid, updated: true }
      }

      return { status: 'no-highlight', pickerUid }
    }

    /**
     * 清空队列
     */
    clearQueue() {
      this.updateQueue = []
      this.isProcessing = false
    }

    /**
     * 获取队列状态
     */
    getQueueStatus() {
      return {
        pending: this.updateQueue.length,
        isProcessing: this.isProcessing,
        stats: { ...this.stats },
      }
    }

    /**
     * 设置优先级
     */
    setPriority(pickerUid, priority) {
      const task = this.updateQueue.find((t) => t.pickerUid === pickerUid)
      if (task) {
        task.priority = priority
        this.updateQueue.sort((a, b) => b.priority - a.priority)
      }
    }

    /**
     * 销毁
     */
    destroy() {
      this.clearQueue()
      this.callbacks = {}
    }
  }

  // 导出
  window.IncrementalUpdater = IncrementalUpdater
})()
