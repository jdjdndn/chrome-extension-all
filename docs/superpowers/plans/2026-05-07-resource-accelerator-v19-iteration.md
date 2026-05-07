# 资源加速器 v19 迭代计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 基线版本：v18（第三方iframe懒加载 + 全站DNS prefetch）
> 创建时间：2026-05-07

**Goal:** 自适应资源质量 + WebWorker后台压缩，根据网络/设备动态调整压缩策略，并将压缩计算移至后台线程避免阻塞主线程。

**Architecture:** 迭代1根据网络质量和设备性能动态调整图片压缩质量参数。迭代2创建WebWorker将图片压缩计算移至后台线程，主线程只负责调度和结果处理。

**Tech Stack:** Network Information API, Device Memory API, Web Workers, Canvas API (transferable)

---

## 文件变更汇总

| 文件                                         | 迭代1   | 迭代2   |
| -------------------------------------------- | ------- | ------- |
| `content/modules/resource-accelerator.js`    | ✅ 修改 | ✅ 修改 |
| `content/workers/image-compressor.worker.js` | -       | ✅ 新建 |

---

## 迭代 1: 自适应资源质量

**目标：** 根据网络质量和设备性能动态调整图片压缩质量

### 问题分析

当前压缩参数固定（quality: 0.7, maxWidth: 1280），不区分网络和设备：

- 高速网络 + 高端设备：压缩过度，浪费带宽
- 慢速网络 + 低端设备：压缩不足，加载缓慢

### 功能设计

**自适应质量矩阵：**

| 网络质量 | 高端设备                      | 中端设备                      | 低端设备                      |
| -------- | ----------------------------- | ----------------------------- | ----------------------------- |
| fast     | quality: 0.85, maxWidth: 1920 | quality: 0.75, maxWidth: 1440 | quality: 0.65, maxWidth: 1080 |
| medium   | quality: 0.75, maxWidth: 1440 | quality: 0.70, maxWidth: 1280 | quality: 0.60, maxWidth: 960  |
| slow     | quality: 0.65, maxWidth: 1080 | quality: 0.60, maxWidth: 960  | quality: 0.50, maxWidth: 720  |

**设备判断：** `navigator.deviceMemory`（Chrome支持）

- 高端：deviceMemory >= 8
- 中端：deviceMemory >= 4
- 低端：deviceMemory < 4

**网络判断：** 已有 `detectNetworkQuality()` 函数

**配置：**

```javascript
adaptiveQuality: {
  enabled: true,
  // 质量矩阵：[网络][设备] -> { quality, maxWidth }
  matrix: {
    fast: {
      high: { quality: 0.85, maxWidth: 1920 },
      medium: { quality: 0.75, maxWidth: 1440 },
      low: { quality: 0.65, maxWidth: 1080 },
    },
    medium: {
      high: { quality: 0.75, maxWidth: 1440 },
      medium: { quality: 0.70, maxWidth: 1280 },
      low: { quality: 0.60, maxWidth: 960 },
    },
    slow: {
      high: { quality: 0.65, maxWidth: 1080 },
      medium: { quality: 0.60, maxWidth: 960 },
      low: { quality: 0.50, maxWidth: 720 },
    },
  },
  // 回退默认值（API不可用时）
  fallback: { quality: 0.70, maxWidth: 1280 },
},
```

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG**（在 `adaptiveCompress` 配置之后）：

```javascript
// 自适应质量
adaptiveQuality: {
  enabled: true,
  matrix: {
    fast: {
      high: { quality: 0.85, maxWidth: 1920 },
      medium: { quality: 0.75, maxWidth: 1440 },
      low: { quality: 0.65, maxWidth: 1080 },
    },
    medium: {
      high: { quality: 0.75, maxWidth: 1440 },
      medium: { quality: 0.70, maxWidth: 1280 },
      low: { quality: 0.60, maxWidth: 960 },
    },
    slow: {
      high: { quality: 0.65, maxWidth: 1080 },
      medium: { quality: 0.60, maxWidth: 960 },
      low: { quality: 0.50, maxWidth: 720 },
    },
  },
  fallback: { quality: 0.70, maxWidth: 1280 },
},
```

**2. 添加设备性能检测函数**：

```javascript
/**
 * 检测设备性能等级
 * @returns {'high'|'medium'|'low'}
 */
function detectDeviceTier() {
  // 优先使用 deviceMemory API
  if (navigator.deviceMemory) {
    if (navigator.deviceMemory >= 8) return 'high'
    if (navigator.deviceMemory >= 4) return 'medium'
    return 'low'
  }
  // 回退：根据硬件并发数判断
  if (navigator.hardwareConcurrency) {
    if (navigator.hardwareConcurrency >= 8) return 'high'
    if (navigator.hardwareConcurrency >= 4) return 'medium'
    return 'low'
  }
  return 'medium' // 默认中端
}
```

**3. 添加质量参数获取函数**：

```javascript
/**
 * 获取自适应压缩参数
 * @returns {{ quality: number, maxWidth: number }}
 */
function getAdaptiveQualityParams() {
  if (!state.config.adaptiveQuality?.enabled) {
    return state.config.adaptiveQuality?.fallback || { quality: 0.7, maxWidth: 1280 }
  }

  const networkQuality = detectNetworkQuality()
  const deviceTier = detectDeviceTier()
  const matrix = state.config.adaptiveQuality.matrix

  return matrix[networkQuality]?.[deviceTier] || state.config.adaptiveQuality.fallback
}
```

**4. 修改 compressImage 函数**：

```javascript
async function compressImage(src) {
  // ... existing checks ...

  // 获取自适应参数
  const params = getAdaptiveQualityParams()
  const quality = params.quality
  const maxWidth = params.maxWidth

  // 记录使用的参数
  addLog('debug', 'image', 'adaptive_quality', {
    url: src,
    quality,
    maxWidth,
    network: detectNetworkQuality(),
    device: detectDeviceTier(),
  })

  // ... rest of compression logic using quality and maxWidth ...
}
```

### 验收标准

- [ ] 根据网络质量调整压缩参数
- [ ] 根据设备性能调整压缩参数
- [ ] API不可用时回退到默认参数
- [ ] 日志记录使用的参数和网络/设备状态
- [ ] 向后兼容：disabled时使用固定参数

### 风险

| 风险                   | 影响         | 缓解                                |
| ---------------------- | ------------ | ----------------------------------- |
| deviceMemory API不支持 | 无法检测设备 | 回退到hardwareConcurrency或默认中端 |
| 网络状态变化           | 参数过时     | 每次压缩时重新检测                  |
| 低质量导致图片模糊     | 用户体验差   | 设置最低质量阈值0.5                 |

---

## 迭代 2: WebWorker 后台压缩

**目标：** 将图片压缩计算移至WebWorker，避免阻塞主线程

### 问题分析

当前 `compressImage()` 在主线程执行Canvas压缩：

- 大图片压缩耗时100-300ms
- 压缩期间主线程阻塞，页面卡顿
- 多图片并行压缩时更严重

### 功能设计

**架构：**

```
主线程                          WebWorker
  │                                │
  │ ── compressImage(src) ──────>  │
  │                                │ 创建 OffscreenCanvas
  │                                │ fetch(src) → Blob
  │                                │ createImageBitmap(Blob)
  │                                │ OffscreenCanvas压缩
  │ <── return blob:url ────────── │
  │                                │
```

**关键点：**

1. 使用 `OffscreenCanvas`（Worker内可用）
2. 使用 `createImageBitmap()` 代替 `new Image()`
3. 使用 `Transferable` 传输结果
4. Worker池管理（最多2个Worker）

**配置：**

```javascript
workerCompress: {
  enabled: true,
  maxWorkers: 2,        // 最大Worker数
  timeout: 5000,        // 超时时间(ms)
  fallbackToMain: true, // Worker失败时回退主线程
},
```

### 集成代码

**1. 创建 Worker 文件** `content/workers/image-compressor.worker.js`：

```javascript
// 图片压缩 Worker
self.onmessage = async function (e) {
  const { id, src, quality, maxWidth, maxHeight } = e.data

  try {
    // 1. 获取图片数据
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`)
    }
    const blob = await response.blob()

    // 2. 创建 ImageBitmap
    const imageBitmap = await createImageBitmap(blob)

    // 3. 计算目标尺寸
    let width = imageBitmap.width
    let height = imageBitmap.height
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }

    // 4. 使用 OffscreenCanvas 压缩
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageBitmap, 0, 0, width, height)

    // 5. 导出为 Blob
    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality,
    })

    // 6. 返回结果（使用 Transferable）
    const reader = new FileReader()
    reader.onload = () => {
      self.postMessage({
        id,
        success: true,
        dataUrl: reader.result,
        originalSize: blob.size,
        compressedSize: compressedBlob.size,
      })
    }
    reader.readAsDataURL(compressedBlob)
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message,
    })
  }
}
```

**2. 添加 Worker 管理器**：

```javascript
// ========== Worker 压缩管理 ==========
let _compressorWorkers = []
let _workerTaskId = 0
let _workerPendingTasks = new Map()

function _initCompressorWorkers() {
  if (!state.config.workerCompress?.enabled) return
  if (typeof Worker === 'undefined') return

  const maxWorkers = state.config.workerCompress.maxWorkers || 2
  for (let i = 0; i < maxWorkers; i++) {
    try {
      const worker = new Worker(chrome.runtime.getURL('content/workers/image-compressor.worker.js'))
      worker.onmessage = _handleWorkerMessage
      worker.onerror = _handleWorkerError
      _compressorWorkers.push(worker)
    } catch (e) {
      console.warn(`${LOG_PREFIX} Worker初始化失败:`, e)
    }
  }

  if (_compressorWorkers.length > 0) {
    console.log(`${LOG_PREFIX} 已初始化 ${_compressorWorkers.length} 个压缩Worker`)
  }
}

function _handleWorkerMessage(e) {
  const { id, success, dataUrl, error, originalSize, compressedSize } = e.data
  const task = _workerPendingTasks.get(id)
  if (!task) return

  _workerPendingTasks.delete(id)

  if (success) {
    task.resolve({
      dataUrl,
      originalSize,
      compressedSize,
    })
  } else {
    task.reject(new Error(error))
  }
}

function _handleWorkerError(e) {
  console.error(`${LOG_PREFIX} Worker错误:`, e.message)
}

function _getAvailableWorker() {
  // 简单轮询：找空闲Worker（pending任务少的）
  return _compressorWorkers[0] || null
}

async function _compressViaWorker(src, quality, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const worker = _getAvailableWorker()
    if (!worker) {
      reject(new Error('No available worker'))
      return
    }

    const id = ++_workerTaskId
    const timeout = state.config.workerCompress?.timeout || 5000

    // 设置超时
    const timer = setTimeout(() => {
      _workerPendingTasks.delete(id)
      reject(new Error('Worker timeout'))
    }, timeout)

    _workerPendingTasks.set(id, {
      resolve: (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      reject: (err) => {
        clearTimeout(timer)
        reject(err)
      },
    })

    worker.postMessage({
      id,
      src,
      quality,
      maxWidth,
      maxHeight,
    })
  })
}
```

**3. 修改 compressImage 函数**：

```javascript
async function compressImage(src) {
  // ... existing checks ...

  const params = getAdaptiveQualityParams()
  const quality = params.quality
  const maxWidth = params.maxWidth
  const maxHeight = state.config.imageMaxDimension || 2048

  // 尝试 Worker 压缩
  if (state.config.workerCompress?.enabled && _compressorWorkers.length > 0) {
    try {
      const result = await _compressViaWorker(src, quality, maxWidth, maxHeight)
      if (result.dataUrl && result.compressedSize < result.originalSize * 0.95) {
        addLog('info', 'image', 'worker_compress', {
          url: src,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          ratio: (result.compressedSize / result.originalSize).toFixed(2),
        })
        return result.dataUrl
      }
    } catch (e) {
      if (!state.config.workerCompress?.fallbackToMain) {
        throw e
      }
      addLog('warn', 'image', 'worker_fallback', { url: src, error: e.message })
    }
  }

  // 回退到主线程压缩（现有逻辑）
  return _compressOnMainThread(src, quality, maxWidth, maxHeight)
}
```

**4. 在 init() 中初始化 Worker**：

```javascript
// 初始化压缩Worker
_initCompressorWorkers()
```

**5. 在 destroy() 中清理 Worker**：

```javascript
_compressorWorkers.forEach((w) => w.terminate())
_compressorWorkers = []
```

**6. 在 manifest.json 中注册 Worker**：

```json
{
  "web_accessible_resources": [
    {
      "resources": ["content/workers/image-compressor.worker.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 验收标准

- [ ] Worker 成功创建并执行压缩
- [ ] 主线程不阻塞
- [ ] Worker 超时时回退主线程
- [ ] Worker 错误时回退主线程
- [ ] 多图片并行压缩正常工作
- [ ] destroy() 时正确清理 Worker

### 风险

| 风险                   | 影响                | 缓解                   |
| ---------------------- | ------------------- | ---------------------- |
| OffscreenCanvas 不支持 | Worker 压缩失败     | 检测支持性，回退主线程 |
| Worker 创建失败        | 无法后台压缩        | fallbackToMain 回退    |
| 跨域图片无法 fetch     | Worker 无法获取图片 | 主线程使用 canvas 绕过 |
| 内存占用增加           | 多 Worker 并行      | 限制 maxWorkers=2      |

---

## 实施顺序

```
迭代1: 自适应资源质量 → 迭代2: WebWorker后台压缩
```

**优先级**：迭代 1 > 迭代 2

**理由**：

- 迭代1（自适应质量）ROI高，直接优化压缩效果
- 迭代2（Worker）需要迭代1的质量参数，且复杂度更高

---

## 测试策略

### 迭代 1 测试用例

| 测试场景                 | 预期结果                    |
| ------------------------ | --------------------------- |
| 高端设备 + 快速网络      | quality=0.85, maxWidth=1920 |
| 低端设备 + 慢速网络      | quality=0.50, maxWidth=720  |
| API不支持                | 使用 fallback 参数          |
| adaptiveQuality disabled | 使用固定参数                |

### 迭代 2 测试用例

| 测试场景        | 预期结果             |
| --------------- | -------------------- |
| Worker 正常压缩 | 返回压缩后的 dataUrl |
| Worker 超时     | 回退主线程压缩       |
| Worker 错误     | 回退主线程压缩       |
| 多图片并行      | 所有图片正确压缩     |
| destroy()       | Worker 被终止        |

### 测试命令

```bash
npm test
```

---

## 约束条件

1. **向后兼容** — Worker 不可用时回退主线程压缩
2. **降级可用** — 新功能禁用时使用现有逻辑
3. **性能安全** — Worker 数量限制为2，避免内存问题
4. **配置安全** — 新增配置有合理默认值
5. **不引入可视化** — 不添加图表、可视化面板等 UI 功能
6. **不引入分享** — 不添加配置分享、数据导出分享等功能
7. **不引入插件** — 不添加插件系统、扩展 API 等功能
