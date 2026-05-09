# 可改进任务实施计划

> 基线版本：v21
> 创建时间：2026-05-09
> 预计工期：3周

---

## 任务概述

本计划包含三个核心改进：

1. **位置感知加载完善** - 优化视口检测和优先级队列
2. **Worker健康检查增强** - 添加崩溃自动重启和任务重试
3. **内存监控集成** - 完善缓存策略和内存管理

---

## 一、位置感知加载完善

### 1.1 现状分析

**已实现功能**：

- ✅ `_getResourcePositionPriority()` - 核心位置计算
- ✅ `_isResourceLoaded()` - 已加载检测
- ✅ `_lazyLoadObserver` - IntersectionObserver观察器
- ✅ 位置缓存机制（WeakMap + 100ms TTL）

**存在问题**：

| 问题 | 影响 | 优先级 |
|------|------|--------|
| IntersectionObserver未集成到图片处理流程 | 视口外图片仍会加载 | 高 |
| 压缩队列未使用位置优先级 | 压缩顺序不合理 | 中 |
| 滚动预测未实现 | 无法预加载用户即将看到的内容 | 低 |

### 1.2 实施方案

#### 1.2.1 图片处理流程集成

**目标**：将位置检测集成到图片处理全流程

**修改点**：

1. **`_processImage()` 函数**

   - 添加位置检测判断
   - far区域图片加入延迟加载观察
   - inViewport图片立即压缩

2. **压缩队列优先级调整**

   - 修改 `_getCompressPriority()` 函数
   - 使用 `_getResourcePositionPriority()` 返回值
   - inViewport = 0，nearby = 10-19，far = 100

3. **IntersectionObserver回调完善**

   - 触发图片加载
   - 触发压缩任务
   - 更新缓存状态

**伪代码**：

```javascript
// 图片处理主流程
function _processImage(img) {
  // 1. 已加载检测
  if (_isResourceLoaded(img, 'image')) return
  
  // 2. 获取位置优先级
  const { zone, priority } = _getResourcePositionPriority(img)
  
  // 3. 根据区域处理
  switch (zone) {
    case 'inViewport':
      // 视口内：立即加载+压缩
      img.fetchPriority = 'high'
      img.loading = 'eager'
      enqueueCompress(img, img.src, priority)
      break
      
    case 'nearby':
      // 视口附近：延迟加载+压缩
      img.fetchPriority = 'auto'
      img.loading = 'lazy'
      enqueueCompress(img, img.src, priority)
      break
      
    case 'far':
      // 远离视口：清空src，加入观察器
      if (img.src && !img.dataset.lazySrc) {
        img.dataset.lazySrc = img.src
        img.src = '' // 清空，等待滚动触发
      }
      _observeLazyLoad(img)
      break
  }
}
```

#### 1.2.2 滚动预测加载（可选）

**目标**：预测用户滚动方向，提前加载

**实现要点**：

1. 监听滚动事件
2. 记录滚动速度和方向
3. 预加载滚动方向上的资源
4. 使用 `requestIdleCallback` 在空闲时预加载

**配置项**：

```javascript
positionAwareLoading: {
  enabled: true,
  nearbyThreshold: 1,
  scrollPrediction: {
    enabled: false, // 默认关闭
    velocityThreshold: 500, // px/s
    preloadDistance: 1000, // 预加载距离
  }
}
```

### 1.3 验收标准

- [ ] 视口内图片优先级最高，立即加载
- [ ] 视口外图片延迟加载，滚动到范围才加载
- [ ] 压缩队列按位置优先级排序
- [ ] 位置缓存命中率 > 80%
- [ ] 滚动流畅度不受影响

---

## 二、Worker健康检查增强

### 2.1 现状分析

**已实现功能**：

- ✅ Worker池管理 (`_compressorWorkers`)
- ✅ Worker创建和初始化
- ✅ 错误回退机制
- ✅ Worker onerror 监听（部分）

**存在问题**：

| 问题 | 影响 | 优先级 |
|------|------|--------|
| Worker崩溃后未自动重启 | 功能中断 | 高 |
| 任务失败未重试 | 压缩失败 | 中 |
| 无健康状态监控 | 无法感知Worker状态 | 中 |
| 无预热机制 | 首次压缩延迟 | 低 |

### 2.2 实施方案

#### 2.2.1 Worker生命周期管理

**目标**：完整的Worker创建、监控、重启机制

**新增数据结构**：

```javascript
// Worker状态跟踪
const _workerStates = new Map() // worker -> state

const WorkerState = {
  IDLE: 'idle',
  BUSY: 'busy', 
  ERROR: 'error',
  TERMINATED: 'terminated'
}

// 任务队列（支持重试）
const _taskQueue = []
const _pendingTasks = new Map() // taskId -> { task, retries }
```

**核心函数**：

1. **健康检查函数**

```javascript
function _checkWorkerHealth(worker) {
  const state = _workerStates.get(worker)
  
  // 检查条件：
  // 1. 状态是否异常
  // 2. 是否超时无响应
  // 3. 错误计数是否超限
  
  if (state.errorCount > 3) {
    _restartWorker(worker)
    return false
  }
  
  return true
}
```

2. **自动重启函数**

```javascript
function _restartWorker(worker) {
  const index = _compressorWorkers.indexOf(worker)
  if (index === -1) return
  
  // 1. 清理旧Worker
  worker.terminate()
  _workerStates.delete(worker)
  
  // 2. 创建新Worker
  const newWorker = _createWorker(index)
  _compressorWorkers[index] = newWorker
  
  // 3. 重试失败任务
  _retryFailedTasks(index)
  
  addLog('info', 'worker', 'restarted', { index })
}
```

3. **任务重试机制**

```javascript
function _retryFailedTasks(workerIndex) {
  const tasks = _getTasksByWorker(workerIndex)
  
  tasks.forEach(task => {
    if (task.retries < 3) {
      task.retries++
      _taskQueue.push(task)
      addLog('debug', 'worker', 'retry_task', { 
        taskId: task.id, 
        retries: task.retries 
      })
    } else {
      // 超过重试次数，回退主线程
      _fallbackToMainThread(task)
    }
  })
}
```

#### 2.2.2 Worker预热机制

**目标**：页面加载时预创建Worker，减少首次压缩延迟

**实现要点**：

1. 在 `_initCompressorWorkers()` 中添加预热任务
2. 发送微型测试任务（1x1像素图片）
3. 确保Worker已完全初始化

**伪代码**：

```javascript
function _warmupWorker(worker) {
  return new Promise((resolve) => {
    const testId = `warmup_${Date.now()}`
    
    const handler = (e) => {
      if (e.data.id === testId) {
        worker.removeEventListener('message', handler)
        resolve()
      }
    }
    
    worker.addEventListener('message', handler)
    
    // 发送测试任务
    worker.postMessage({
      id: testId,
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      quality: 0.1,
      maxWidth: 1,
      maxHeight: 1
    })
    
    // 超时处理
    setTimeout(() => {
      worker.removeEventListener('message', handler)
      resolve()
    }, 1000)
  })
}
```

#### 2.2.3 监控面板（可选）

**目标**：可视化Worker状态

**展示内容**：

- Worker状态（idle/busy/error）
- 任务队列长度
- 成功/失败计数
- 平均处理时间

**实现方式**：

- 在开发模式注入调试面板
- 使用 `console.table()` 或自定义UI
- 实时更新统计数据

### 2.3 验收标准

- [ ] Worker崩溃后5秒内自动重启
- [ ] 失败任务自动重试（最多3次）
- [ ] 预热机制减少首次压缩延迟 > 50%
- [ ] 错误计数和健康检查正常工作
- [ ] 日志完整记录Worker生命周期事件

---

## 三、内存监控集成

### 3.1 现状分析

**已实现功能**：

- ✅ 压缩缓存 (`_compressCache`)
- ✅ 缓存大小限制 (50MB)
- ✅ 基本LRU淘汰
- ✅ 缓存大小追踪 (`_compressCacheSize`)

**存在问题**：

| 问题 | 影响 | 优先级 |
|------|------|--------|
| LRU淘汰不够精确 | 可能淘汰热数据 | 中 |
| 无多级缓存 | 所有缓存同等对待 | 低 |
| 无内存压力检测 | 浏览器内存紧张时未调整 | 中 |
| 缓存未持久化 | 页面刷新后丢失 | 低 |

### 3.2 实施方案

#### 3.2.1 增强LRU缓存

**目标**：更精确的缓存淘汰策略

**改进点**：

1. **访问频率权重**

```javascript
class EnhancedLRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.accessCount = new Map()
    this.currentSize = 0
  }

  get(key) {
    if (!this.cache.has(key)) return null
    
    // 增加访问计数
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1)
    
    // 移到末尾
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    
    return value
  }

  set(key, value, size) {
    // 淘汰策略：考虑大小和访问频率
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      // 找出访问次数最少且最大的项
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => {
        const freqA = this.accessCount.get(a[0]) || 0
        const freqB = this.accessCount.get(b[0]) || 0
        // 优先淘汰访问少的
        if (freqA !== freqB) return freqA - freqB
        // 访问次数相同，淘汰最旧的
        return 0
      })
      
      const [evictKey] = entries[0]
      this.delete(evictKey)
    }
    
    this.cache.set(key, value)
    this.currentSize += size
  }
}
```

2. **大小分级缓存**

```javascript
// 分级缓存配置
const CACHE_TIERS = {
  SMALL: { maxSize: 10 * 1024 * 1024, threshold: 100 * 1024 },   // < 100KB
  MEDIUM: { maxSize: 30 * 1024 * 1024, threshold: 500 * 1024 }, // < 500KB
  LARGE: { maxSize: 10 * 1024 * 1024, threshold: Infinity }     // > 500KB
}

// 不同大小使用不同缓存池
function _getCacheTier(size) {
  if (size < CACHE_TIERS.SMALL.threshold) return 'SMALL'
  if (size < CACHE_TIERS.MEDIUM.threshold) return 'MEDIUM'
  return 'LARGE'
}
```

#### 3.2.2 内存压力检测

**目标**：根据浏览器内存压力动态调整缓存

**实现要点**：

1. **内存使用监控**

```javascript
function _monitorMemoryUsage() {
  if (!performance.memory) return
  
  setInterval(() => {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory
    const usageRatio = usedJSHeapSize / jsHeapSizeLimit
    
    // 内存使用超过70%，触发清理
    if (usageRatio > 0.7) {
      _reduceCacheSize(0.3) // 清理30%缓存
      addLog('warn', 'memory', 'high_usage', { 
        usageRatio: (usageRatio * 100).toFixed(1) + '%',
        action: 'cache_reduced_30%'
      })
    }
    
    // 内存使用超过85%，紧急清理
    if (usageRatio > 0.85) {
      _clearCache() // 清空缓存
      addLog('error', 'memory', 'critical_usage', {
        usageRatio: (usageRatio * 100).toFixed(1) + '%',
        action: 'cache_cleared'
      })
    }
  }, 5000) // 每5秒检查一次
}
```

2. **动态调整缓存大小**

```javascript
function _adjustCacheByMemoryPressure() {
  if (!performance.memory) return
  
  const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory
  const availableMemory = jsHeapSizeLimit - usedJSHeapSize
  
  // 根据可用内存动态调整缓存上限
  const newMaxSize = Math.min(
    50 * 1024 * 1024, // 最大50MB
    Math.floor(availableMemory * 0.3) // 可用内存的30%
  )
  
  if (newMaxSize < state._compressCacheMaxSize) {
    state._compressCacheMaxSize = newMaxSize
    _enforceCacheLimit()
  }
}
```

#### 3.2.3 缓存持久化（可选）

**目标**：使用 IndexedDB 持久化缓存

**实现要点**：

```javascript
// 1. 打开 IndexedDB
async function _initPersistentCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ResourceAcceleratorCache', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      db.createObjectStore('compressCache', { keyPath: 'url' })
    }
  })
}

// 2. 保存缓存
async function _saveCacheToIndexedDB(url, data) {
  const db = await _initPersistentCache()
  const tx = db.transaction('compressCache', 'readwrite')
  const store = tx.objectStore('compressCache')
  
  store.put({
    url,
    data,
    timestamp: Date.now(),
    size: data.length
  })
}

// 3. 恢复缓存
async function _restoreCacheFromIndexedDB() {
  const db = await _initPersistentCache()
  const tx = db.transaction('compressCache', 'readonly')
  const store = tx.objectStore('compressCache')
  
  return new Promise((resolve) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const items = request.result
      items.forEach(item => {
        // 只恢复最近24小时的缓存
        if (Date.now() - item.timestamp < 24 * 60 * 60 * 1000) {
          state._compressCache.set(item.url, { result: item.data })
          state._compressCacheSize += item.size
        }
      })
      resolve()
    }
  })
}
```

### 3.3 验收标准

- [ ] 缓存命中率 > 85%
- [ ] 内存占用降低 30%
- [ ] 内存压力检测正常工作
- [ ] 高内存压力时自动清理缓存
- [ ] 缓存淘汰策略合理（不淘汰热数据）

---

## 四、实施顺序

### 第1周：位置感知加载

```
Day 1-2: 图片处理流程集成
Day 3-4: 压缩队列优先级调整
Day 5: 测试和调优
```

### 第2周：Worker健康检查

```
Day 1-2: Worker生命周期管理
Day 3-4: 任务重试机制
Day 5: Worker预热和监控
```

### 第3周：内存监控

```
Day 1-2: 增强LRU缓存
Day 3-4: 内存压力检测
Day 5: 缓存持久化（可选）
```

---

## 五、测试计划

### 5.1 单元测试

| 模块 | 测试点 | 覆盖率目标 |
|------|--------|-----------|
| 位置感知 | 区域判断、优先级计算、缓存 | > 90% |
| Worker健康 | 崩溃重启、任务重试、预热 | > 85% |
| 内存管理 | LRU淘汰、内存检测、缓存限制 | > 85% |

### 5.2 集成测试

| 场景 | 验证点 |
|------|--------|
| 图片加载流程 | 位置检测→优先级→加载→压缩完整流程 |
| Worker崩溃恢复 | 崩溃→重启→任务恢复 |
| 内存压力场景 | 高内存使用→缓存清理→功能正常 |

### 5.3 性能测试

| 指标 | 基准值 | 目标值 |
|------|--------|--------|
| LCP | - | 提升 15% |
| 内存占用 | - | 降低 30% |
| 缓存命中率 | 75% | > 85% |
| Worker恢复时间 | - | < 5秒 |

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| IntersectionObserver兼容性 | 低 | 中 | 降级为原生lazy |
| Worker创建失败 | 中 | 高 | 主线程回退 |
| 内存检测API不支持 | 中 | 低 | 使用默认缓存策略 |
| IndexedDB配额限制 | 低 | 低 | 缓存大小限制 |

---

## 七、文档更新

完成后需更新以下文档：

- [ ] 更新 `memory/manifest-v3-worker-pattern.md` - 添加健康检查模式
- [ ] 更新 `memory/worker-priority-queue.md` - 添加位置优先级说明
- [ ] 新建 `memory/cache-strategy.md` - 缓存策略文档
- [ ] 更新 API 文档 - 新增配置项说明

---

## 附录：配置项汇总

```javascript
// 完整配置示例
const config = {
  // 位置感知加载
  positionAwareLoading: {
    enabled: true,
    nearbyThreshold: 1,          // 触发距离（屏数）
    scrollPrediction: {          // 滚动预测（可选）
      enabled: false,
      velocityThreshold: 500,
      preloadDistance: 1000
    }
  },
  
  // Worker压缩
  workerCompress: {
    enabled: true,
    maxWorkers: 2,
    timeout: 5000,
    fallbackToMain: true,
    healthCheck: {               // 新增
      enabled: true,
      interval: 10000,           // 健康检查间隔
      maxErrors: 3,              // 最大错误数
      restartDelay: 1000         // 重启延迟
    },
    warmup: true                 // 新增：预热
  },
  
  // 缓存配置
  cache: {                       // 新增
    maxSize: 50 * 1024 * 1024,   // 50MB
    tiers: {
      small: { maxSize: 10 * 1024 * 1024, threshold: 100 * 1024 },
      medium: { maxSize: 30 * 1024 * 1024, threshold: 500 * 1024 },
      large: { maxSize: 10 * 1024 * 1024, threshold: Infinity }
    },
    memoryPressure: {
      enabled: true,
      checkInterval: 5000,
      highThreshold: 0.7,        // 70%使用率
      criticalThreshold: 0.85    // 85%使用率
    },
    persistent: false            // 持久化（可选）
  }
}
```
