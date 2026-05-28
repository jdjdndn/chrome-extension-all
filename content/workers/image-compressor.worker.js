/**
 * 图片压缩 Worker
 * 使用 OffscreenCanvas 在后台线程进行压缩
 * 避免阻塞主线程
 *
 * 支持功能：
 * - 优先级队列（高优先级任务优先处理）
 * - 跨域图片处理
 * - WebP/JPEG 自动选择
 * - 心跳检测与超时处理
 * - 任务重试机制
 */

// 任务队列（按优先级排序）
const taskQueue = []
const MAX_QUEUE_SIZE = 100
let isProcessing = false

// Worker 状态
const workerState = {
  createdAt: Date.now(),
  status: 'healthy', // healthy, busy, error
  lastHeartbeat: Date.now(),
  taskCount: 0,
  errorCount: 0,
}

// 心跳超时检测（30秒无心跳则认为连接断开）
const HEARTBEAT_TIMEOUT = 30000
let heartbeatCheckInterval = null

/**
 * 启动心跳检测
 */
function startHeartbeatCheck() {
  if (heartbeatCheckInterval) {
    clearInterval(heartbeatCheckInterval)
  }

  heartbeatCheckInterval = setInterval(() => {
    const elapsed = Date.now() - workerState.lastHeartbeat
    if (elapsed > HEARTBEAT_TIMEOUT && workerState.status !== 'error') {
      workerState.status = 'error'
      self.postMessage({
        type: 'health_status',
        status: 'error',
        reason: 'heartbeat_timeout',
        elapsed,
      })
    }
  }, 10000) // 每10秒检测一次
}

/**
 * 更新心跳时间
 */
function updateHeartbeat() {
  workerState.lastHeartbeat = Date.now()
  workerState.status = 'healthy'
}

/**
 * 处理压缩任务
 */
async function processCompressTask(data) {
  const { id, src, quality, maxWidth, maxHeight, isCors } = data

  workerState.status = 'busy'
  workerState.taskCount++

  try {
    // 1. 获取图片数据
    let blob
    if (isCors) {
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
      if (!response.ok) {
        throw new Error(`cors_fetch_failed: ${response.status}`)
      }
      blob = await response.blob()
    } else {
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`fetch failed: ${response.status}`)
      }
      blob = await response.blob()
    }

    // 2. 创建 ImageBitmap
    const imageBitmap = await createImageBitmap(blob)

    // 3. 计算压缩尺寸
    let width = imageBitmap.width
    let height = imageBitmap.height

    // 如果指定了最大尺寸，进行缩放
    if (maxWidth && maxHeight && width > 0 && height > 0) {
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
    }

    // 4. 使用 OffscreenCanvas 压缩
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageBitmap, 0, 0, width, height)

    // 5. 导出为 Blob (优先使用webp，不支持时回退jpeg)
    let compressedBlob
    try {
      compressedBlob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: quality,
      })
    } catch {
      // webp不支持时回退jpeg
      compressedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: quality,
      })
    }

    // 6. 返回结果（Promise 化 FileReader 避免 processQueue 竞态）
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('FileReader error'))
      reader.readAsDataURL(compressedBlob)
    })

    workerState.status = 'healthy'
    self.postMessage({
      id,
      success: true,
      dataUrl,
      originalSize: blob.size,
      compressedSize: compressedBlob.size,
    })
  } catch (error) {
    workerState.status = 'error'
    workerState.errorCount++

    // 判断错误是否可重试
    const retryable =
      !error.message.includes('cors_fetch_failed') &&
      !error.message.includes('404') &&
      !error.message.includes('403')

    self.postMessage({
      id,
      success: false,
      error: error.message,
      retryable,
    })
  }
}

/**
 * 处理任务队列
 */
async function processQueue() {
  if (isProcessing || taskQueue.length === 0) {
    return
  }

  isProcessing = true

  // 按优先级排序（高优先级先处理）
  taskQueue.sort((a, b) => b.priority - a.priority)

  while (taskQueue.length > 0) {
    const task = taskQueue.shift()
    await processCompressTask(task.data)
  }

  isProcessing = false
}

/**
 * 消息处理
 */
self.onmessage = async function (e) {
  const { type, id, src, quality, maxWidth, maxHeight, priority, isCors } = e.data

  // 处理心跳ping
  if (type === 'ping') {
    updateHeartbeat()
    self.postMessage({ type: 'pong', id })
    return
  }

  // 处理状态查询
  if (type === 'get_status') {
    self.postMessage({
      type: 'status_response',
      id,
      status: {
        ...workerState,
        uptime: Date.now() - workerState.createdAt,
        queueLength: taskQueue.length,
      },
    })
    return
  }

  // 压缩任务
  if (type === 'compress') {
    const taskData = {
      id,
      src,
      quality: quality || 0.8,
      maxWidth,
      maxHeight,
      isCors: isCors || false,
    }

    // 高优先级任务直接处理，低优先级进队列
    if (priority >= 5) {
      await processCompressTask(taskData)
    } else {
      taskQueue.push({ data: taskData, priority: priority || 0 })
      if (taskQueue.length > MAX_QUEUE_SIZE) {
        taskQueue.splice(0, taskQueue.length - MAX_QUEUE_SIZE)
      }
      processQueue()
    }
    return
  }

  // 未知消息类型
  self.postMessage({
    id,
    success: false,
    error: `Unknown message type: ${type}`,
  })
}

// 启动心跳检测
startHeartbeatCheck()

// 初始化完成
console.log('[ImageCompressorWorker] 已初始化', {
  createdAt: new Date(workerState.createdAt).toISOString(),
})
