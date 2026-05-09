# 资源加速器插件化架构设计

> 设计目标：降低代码耦合度，提升可维护性和扩展性
> 创建时间：2026-05-09
> 预计工期：4周

---

## 一、现状分析

### 1.1 代码规模

| 文件 | 行数 | 职责 |
|------|------|------|
| resource-accelerator.js | 4970 | 所有功能集中 |
| image-compressor.worker.js | 89 | Worker压缩 |
| SelectorWorker.js | ~500 | 选择器工作 |

### 1.2 功能模块

当前 `resource-accelerator.js` 包含以下功能：

1. **资源拦截** - API Hook（createElement/appendChild）
2. **脚本处理** - JS CDN替换、延迟加载
3. **样式处理** - CSS CDN替换、预加载
4. **图片处理** - 压缩、延迟加载、格式转换
5. **字体处理** - 字体预加载、CDN替换
6. **Worker管理** - Worker池、任务调度
7. **缓存管理** - 压缩缓存、位置缓存
8. **性能监控** - 指标采集、日志记录
9. **配置管理** - 配置加载、持久化
10. **事件系统** - MutationObserver、IntersectionObserver

### 1.3 存在问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| 单文件近5000行 | 难以维护、测试 | 高 |
| 功能耦合严重 | 修改一处影响多处 | 高 |
| 缺少模块边界 | 难以独立测试 | 中 |
| 扩展困难 | 新增功能需修改核心代码 | 中 |

---

## 二、架构设计

### 2.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     ResourceAccelerator                      │
│                      (核心引擎 Core)                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PluginManager│  │ EventManager │  │ CacheManager │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Plugin Interface                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
         │ ScriptPlugin│ │ Image   │ │ Font      │
         │             │ │ Plugin  │ │ Plugin    │
         └─────────────┘ └─────────┘ └───────────┘
                │             │             │
         ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
         │ StylePlugin │ │ Worker  │ │ Monitor   │
         │             │ │ Plugin  │ │ Plugin    │
         └─────────────┘ └─────────┘ └───────────┘
```

### 2.2 核心概念

#### 2.2.1 核心引擎（Core）

**职责**：

- 初始化和管理插件
- 提供共享服务和API
- 协调插件间通信
- 管理全局配置和状态

**核心API**：

```javascript
class ResourceAcceleratorCore {
  constructor(config) {
    this.pluginManager = new PluginManager(this)
    this.eventManager = new EventManager(this)
    this.cacheManager = new CacheManager(this)
    this.config = config
    this.state = {}
  }

  // 注册插件
  registerPlugin(plugin) {
    this.pluginManager.register(plugin)
  }

  // 获取插件
  getPlugin(name) {
    return this.pluginManager.get(name)
  }

  // 触发事件
  emit(event, data) {
    this.eventManager.emit(event, data)
  }

  // 监听事件
  on(event, handler) {
    this.eventManager.on(event, handler)
  }

  // 启动
  async init() {
    await this.pluginManager.initAll()
  }

  // 销毁
  async destroy() {
    await this.pluginManager.destroyAll()
  }
}
```

#### 2.2.2 插件接口（Plugin Interface）

**标准插件接口**：

```javascript
/**
 * 插件基类
 */
class Plugin {
  constructor(core, options = {}) {
    this.core = core
    this.options = options
    this.name = this.constructor.name
    this.enabled = true
  }

  /**
   * 插件元数据
   */
  static get meta() {
    return {
      name: 'PluginName',
      version: '1.0.0',
      description: 'Plugin description',
      author: 'Author',
      dependencies: [] // 依赖的其他插件
    }
  }

  /**
   * 插件默认配置
   */
  static get defaultConfig() {
    return {}
  }

  /**
   * 初始化 - 插件加载时调用
   */
  async init() {
    throw new Error('Plugin.init() must be implemented')
  }

  /**
   * 销毁 - 插件卸载时调用
   */
  async destroy() {
    // 子类可选实现
  }

  /**
   * 启用插件
   */
  enable() {
    this.enabled = true
  }

  /**
   * 禁用插件
   */
  disable() {
    this.enabled = false
  }

  /**
   * 处理资源 - 核心方法
   */
  async handle(element, resourceInfo) {
    if (!this.enabled) return null
    // 子类实现具体逻辑
  }
}
```

#### 2.2.3 插件管理器（PluginManager）

**职责**：

- 插件注册和注销
- 插件生命周期管理
- 插件依赖解析
- 插件启用/禁用控制

**实现**：

```javascript
class PluginManager {
  constructor(core) {
    this.core = core
    this.plugins = new Map()      // name -> plugin instance
    this.pluginConfigs = new Map() // name -> config
  }

  /**
   * 注册插件
   */
  register(PluginClass, options = {}) {
    const meta = PluginClass.meta
    
    // 检查依赖
    for (const dep of meta.dependencies || []) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Plugin ${meta.name} depends on ${dep}, but not registered`)
      }
    }

    // 合并配置
    const config = { ...PluginClass.defaultConfig, ...options }
    
    // 创建实例
    const plugin = new PluginClass(this.core, config)
    
    this.plugins.set(meta.name, plugin)
    this.pluginConfigs.set(meta.name, config)
    
    this.core.emit('plugin:registered', { name: meta.name, plugin })
    
    return plugin
  }

  /**
   * 初始化所有插件
   */
  async initAll() {
    const initOrder = this._resolveInitOrder()
    
    for (const name of initOrder) {
      const plugin = this.plugins.get(name)
      if (plugin && plugin.enabled) {
        await plugin.init()
        this.core.emit('plugin:initialized', { name })
      }
    }
  }

  /**
   * 销毁所有插件
   */
  async destroyAll() {
    const destroyOrder = [...this.plugins.keys()].reverse()
    
    for (const name of destroyOrder) {
      const plugin = this.plugins.get(name)
      if (plugin) {
        await plugin.destroy()
        this.core.emit('plugin:destroyed', { name })
      }
    }
  }

  /**
   * 获取插件
   */
  get(name) {
    return this.plugins.get(name)
  }

  /**
   * 启用插件
   */
  enable(name) {
    const plugin = this.plugins.get(name)
    if (plugin) {
      plugin.enable()
      this.core.emit('plugin:enabled', { name })
    }
  }

  /**
   * 禁用插件
   */
  disable(name) {
    const plugin = this.plugins.get(name)
    if (plugin) {
      plugin.disable()
      this.core.emit('plugin:disabled', { name })
    }
  }

  /**
   * 解析初始化顺序（拓扑排序）
   */
  _resolveInitOrder() {
    const order = []
    const visited = new Set()
    const visiting = new Set()

    const visit = (name) => {
      if (visited.has(name)) return
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`)
      }

      visiting.add(name)
      
      const plugin = this.plugins.get(name)
      const meta = plugin.constructor.meta
      
      for (const dep of meta.dependencies || []) {
        visit(dep)
      }

      visiting.delete(name)
      visited.add(name)
      order.push(name)
    }

    for (const name of this.plugins.keys()) {
      visit(name)
    }

    return order
  }
}
```

#### 2.2.4 事件管理器（EventManager）

**职责**：

- 插件间通信
- 事件发布/订阅
- 事件生命周期管理

**实现**：

```javascript
class EventManager {
  constructor(core) {
    this.core = core
    this.listeners = new Map() // event -> Set<handler>
  }

  /**
   * 监听事件
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(handler)
    
    // 返回取消监听函数
    return () => this.off(event, handler)
  }

  /**
   * 监听一次
   */
  once(event, handler) {
    const wrapper = (data) => {
      handler(data)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }

  /**
   * 取消监听
   */
  off(event, handler) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`[EventManager] Handler error for ${event}:`, error)
        }
      })
    }
  }

  /**
   * 清除所有监听器
   */
  clear() {
    this.listeners.clear()
  }
}
```

#### 2.2.5 缓存管理器（CacheManager）

**职责**：

- 统一缓存接口
- 缓存命名空间
- 缓存策略管理

**实现**：

```javascript
class CacheManager {
  constructor(core) {
    this.core = core
    this.caches = new Map() // namespace -> cache instance
  }

  /**
   * 创建缓存
   */
  create(name, options = {}) {
    const cache = {
      data: new Map(),
      maxSize: options.maxSize || 100,
      ttl: options.ttl || 0, // 0 = 永不过期
      stats: {
        hits: 0,
        misses: 0
      }
    }
    
    this.caches.set(name, cache)
    return this._createCacheInterface(cache)
  }

  /**
   * 获取缓存
   */
  get(name) {
    return this.caches.get(name)
  }

  /**
   * 创建缓存接口
   */
  _createCacheInterface(cache) {
    return {
      get: (key) => {
        const item = cache.data.get(key)
        
        if (!item) {
          cache.stats.misses++
          return null
        }
        
        // 检查过期
        if (cache.ttl > 0 && Date.now() - item.time > cache.ttl) {
          cache.data.delete(key)
          cache.stats.misses++
          return null
        }
        
        cache.stats.hits++
        return item.value
      },

      set: (key, value) => {
        // LRU淘汰
        if (cache.data.size >= cache.maxSize) {
          const oldest = cache.data.keys().next().value
          cache.data.delete(oldest)
        }
        
        cache.data.set(key, {
          value,
          time: Date.now()
        })
      },

      delete: (key) => {
        return cache.data.delete(key)
      },

      clear: () => {
        cache.data.clear()
      },

      stats: () => {
        const total = cache.stats.hits + cache.stats.misses
        return {
          ...cache.stats,
          size: cache.data.size,
          hitRate: total > 0 ? cache.stats.hits / total : 0
        }
      }
    }
  }
}
```

---

## 三、插件实现示例

### 3.1 图片处理插件

```javascript
/**
 * 图片处理插件
 */
class ImagePlugin extends Plugin {
  static get meta() {
    return {
      name: 'ImagePlugin',
      version: '1.0.0',
      description: '图片压缩、延迟加载、格式转换',
      author: 'ResourceAccelerator',
      dependencies: ['CachePlugin', 'WorkerPlugin']
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      compress: true,
      lazyLoad: true,
      quality: 0.8,
      minSize: 102400, // 100KB
      maxWidth: 2048
    }
  }

  async init() {
    // 获取依赖插件
    this.cachePlugin = this.core.getPlugin('CachePlugin')
    this.workerPlugin = this.core.getPlugin('WorkerPlugin')
    
    // 创建图片缓存
    this.cache = this.core.cacheManager.create('image', {
      maxSize: 200,
      ttl: 30 * 60 * 1000 // 30分钟
    })
    
    // 初始化延迟加载观察器
    this._initLazyLoadObserver()
    
    // 监听事件
    this.core.on('resource:image', this.handle.bind(this))
    
    console.log('[ImagePlugin] Initialized')
  }

  async destroy() {
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect()
    }
    this.cache.clear()
  }

  async handle(element, resourceInfo) {
    if (!this.enabled || !this.options.compress) return null
    
    const { url } = resourceInfo
    
    // 检查缓存
    const cached = this.cache.get(url)
    if (cached) {
      return cached
    }
    
    // 位置检测
    const position = this._getPosition(element)
    
    if (position.zone === 'far') {
      // 延迟加载
      this._deferLoad(element, url)
      return null
    }
    
    // 压缩图片
    const compressed = await this._compress(url, position.priority)
    
    // 缓存结果
    if (compressed) {
      this.cache.set(url, compressed)
    }
    
    return compressed
  }

  _getPosition(element) {
    if (!element || !element.isConnected) {
      return { zone: 'far', priority: 100 }
    }
    
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const threshold = viewportHeight * 1 // 1屏
    
    if (rect.top < viewportHeight && rect.bottom > 0) {
      return { zone: 'inViewport', priority: 0 }
    }
    
    const distance = rect.top < 0 ? -rect.top : rect.top - viewportHeight
    
    if (distance <= threshold) {
      return { zone: 'nearby', priority: 10 + Math.floor(distance / viewportHeight * 10) }
    }
    
    return { zone: 'far', priority: 100 }
  }

  async _compress(url, priority) {
    // 优先使用Worker压缩
    if (this.workerPlugin && this.options.compress) {
      return this.workerPlugin.compressImage(url, {
        quality: this.options.quality,
        maxWidth: this.options.maxWidth,
        priority
      })
    }
    
    // 回退主线程压缩
    return this._compressOnMainThread(url)
  }

  _compressOnMainThread(url) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // 计算尺寸
          let width = img.naturalWidth
          let height = img.naturalHeight
          if (width > this.options.maxWidth) {
            const ratio = this.options.maxWidth / width
            width = this.options.maxWidth
            height = Math.floor(height * ratio)
          }
          
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          }, 'image/webp', this.options.quality)
        } catch (error) {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  _initLazyLoadObserver() {
    if (typeof IntersectionObserver === 'undefined') return
    
    this.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target
          if (img.dataset.lazySrc) {
            img.src = img.dataset.lazySrc
            delete img.dataset.lazySrc
            
            // 触发压缩
            this.core.emit('resource:image', { element: img, url: img.src })
          }
          this.lazyLoadObserver.unobserve(img)
        }
      })
    }, { rootMargin: '100% 0px' })
  }

  _deferLoad(element, url) {
    if (!element.dataset.lazySrc) {
      element.dataset.lazySrc = url
      element.src = ''
      this.lazyLoadObserver?.observe(element)
    }
  }
}
```

### 3.2 Worker管理插件

```javascript
/**
 * Worker管理插件
 */
class WorkerPlugin extends Plugin {
  static get meta() {
    return {
      name: 'WorkerPlugin',
      version: '1.0.0',
      description: 'Worker池管理、任务调度',
      author: 'ResourceAccelerator',
      dependencies: []
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      maxWorkers: 2,
      timeout: 5000
    }
  }

  async init() {
    this.workers = []
    this.taskQueue = []
    this.taskCallbacks = new Map()
    this.taskId = 0
    
    // 创建Worker池
    this._initWorkerPool()
    
    console.log('[WorkerPlugin] Initialized')
  }

  async destroy() {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.taskQueue = []
    this.taskCallbacks.clear()
  }

  _initWorkerPool() {
    for (let i = 0; i < this.options.maxWorkers; i++) {
      const worker = this._createWorker(i)
      if (worker) {
        this.workers.push(worker)
      }
    }
  }

  _createWorker(index) {
    try {
      const workerUrl = chrome.runtime.getURL('content/workers/image-compressor.worker.js')
      const worker = new Worker(workerUrl)
      
      worker.onerror = (e) => {
        console.error(`[WorkerPlugin] Worker ${index} error:`, e.message)
        // 重启Worker
        this._restartWorker(index)
      }
      
      worker.onmessage = (e) => {
        const { id, success, dataUrl, error } = e.data
        const callback = this.taskCallbacks.get(id)
        
        if (callback) {
          this.taskCallbacks.delete(id)
          
          if (success) {
            callback.resolve(dataUrl)
          } else {
            callback.reject(new Error(error))
          }
        }
        
        // 处理队列中的下一个任务
        this._processNextTask(index)
      }
      
      return worker
    } catch (error) {
      console.error('[WorkerPlugin] Failed to create worker:', error)
      return null
    }
  }

  _restartWorker(index) {
    const worker = this.workers[index]
    if (worker) {
      worker.terminate()
    }
    
    const newWorker = this._createWorker(index)
    if (newWorker) {
      this.workers[index] = newWorker
      this.core.emit('worker:restarted', { index })
    }
  }

  async compressImage(url, options = {}) {
    const taskId = ++this.taskId
    
    return new Promise((resolve, reject) => {
      // 保存回调
      this.taskCallbacks.set(taskId, { resolve, reject })
      
      // 加入队列
      this.taskQueue.push({
        id: taskId,
        url,
        ...options
      })
      
      // 分配Worker
      this._assignTask()
      
      // 超时处理
      setTimeout(() => {
        if (this.taskCallbacks.has(taskId)) {
          this.taskCallbacks.delete(taskId)
          reject(new Error('Worker timeout'))
        }
      }, this.options.timeout)
    })
  }

  _assignTask() {
    if (this.taskQueue.length === 0) return
    
    // 找空闲Worker
    const freeWorkerIndex = this.workers.findIndex((w, i) => {
      return !this.taskCallbacks.has(`worker_${i}_busy`)
    })
    
    if (freeWorkerIndex === -1) return
    
    const task = this.taskQueue.shift()
    if (!task) return
    
    const worker = this.workers[freeWorkerIndex]
    
    // 标记Worker为忙碌
    this.taskCallbacks.set(`worker_${freeWorkerIndex}_busy`, true)
    
    // 发送任务
    worker.postMessage({
      id: task.id,
      src: task.url,
      quality: task.quality || 0.8,
      maxWidth: task.maxWidth || 2048,
      maxHeight: task.maxWidth || 2048,
      priority: task.priority || 0
    })
  }

  _processNextTask(workerIndex) {
    // 清除忙碌标记
    this.taskCallbacks.delete(`worker_${workerIndex}_busy`)
    
    // 分配下一个任务
    this._assignTask()
  }
}
```

### 3.3 脚本处理插件

```javascript
/**
 * 脚本处理插件
 */
class ScriptPlugin extends Plugin {
  static get meta() {
    return {
      name: 'ScriptPlugin',
      version: '1.0.0',
      description: 'JS CDN替换、延迟加载',
      author: 'ResourceAccelerator',
      dependencies: ['CDNPlugin']
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      cdnReplace: true,
      deferThirdParty: true,
      excludePatterns: []
    }
  }

  async init() {
    this.cdnPlugin = this.core.getPlugin('CDNPlugin')
    
    // Hook createElement
    this._hookCreateElement()
    
    this.core.on('resource:script', this.handle.bind(this))
    
    console.log('[ScriptPlugin] Initialized')
  }

  async handle(element, resourceInfo) {
    if (!this.enabled) return null
    
    const { url } = resourceInfo
    
    // CDN替换
    if (this.options.cdnReplace && this.cdnPlugin) {
      const cdnUrl = this.cdnPlugin.replace(url, 'js')
      if (cdnUrl) {
        element.src = cdnUrl
        return cdnUrl
      }
    }
    
    // 第三方脚本延迟
    if (this.options.deferThirdParty && this._isThirdParty(url)) {
      this._deferScript(element, url)
    }
    
    return null
  }

  _hookCreateElement() {
    const originalCreateElement = document.createElement.bind(document)
    
    document.createElement = (tagName, options) => {
      const element = originalCreateElement(tagName, options)
      
      if (tagName.toUpperCase() === 'SCRIPT') {
        this._hookScriptSrc(element)
      }
      
      return element
    }
  }

  _hookScriptSrc(element) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')
    
    if (descriptor && descriptor.configurable) {
      Object.defineProperty(element, 'src', {
        get() {
          return descriptor.get.call(this)
        },
        set(value) {
          descriptor.set.call(this, value)
          if (value) {
            Promise.resolve().then(() => {
              this.core.emit('resource:script', { element, url: value })
            })
          }
        }
      })
    }
  }

  _isThirdParty(url) {
    try {
      const urlObj = new URL(url, location.origin)
      return urlObj.origin !== location.origin
    } catch {
      return false
    }
  }

  _deferScript(element, url) {
    // 判断是否关键脚本
    const isCritical = element.type === 'module' || element.closest('head')
    
    if (!isCritical) {
      element.dataset.deferSrc = url
      element.src = ''
    }
  }
}
```

---

## 四、迁移方案

### 4.1 迁移策略

**分阶段迁移**：

```
Phase 1: 核心架构搭建（1周）
  ├─ 创建Core类
  ├─ 实现PluginManager
  ├─ 实现EventManager
  └─ 实现CacheManager

Phase 2: 插件抽取（2周）
  ├─ WorkerPlugin（独立，无依赖）
  ├─ CachePlugin（独立，无依赖）
  ├─ CDNPlugin（独立，无依赖）
  ├─ ImagePlugin（依赖Cache、Worker）
  ├─ ScriptPlugin（依赖CDN）
  └─ StylePlugin（依赖CDN）

Phase 3: 集成测试（1周）
  ├─ 插件间通信测试
  ├─ 功能回归测试
  └─ 性能测试
```

### 4.2 目录结构

```
content/
├── modules/
│   ├── core/
│   │   ├── ResourceAcceleratorCore.js    # 核心引擎
│   │   ├── PluginManager.js              # 插件管理器
│   │   ├── EventManager.js               # 事件管理器
│   │   └── CacheManager.js               # 缓存管理器
│   ├── plugins/
│   │   ├── Plugin.js                     # 插件基类
│   │   ├── ImagePlugin.js                # 图片处理插件
│   │   ├── ScriptPlugin.js               # 脚本处理插件
│   │   ├── StylePlugin.js                # 样式处理插件
│   │   ├── FontPlugin.js                 # 字体处理插件
│   │   ├── WorkerPlugin.js               # Worker管理插件
│   │   ├── CDNPlugin.js                  # CDN替换插件
│   │   ├── CachePlugin.js                # 缓存插件
│   │   └── MonitorPlugin.js              # 性能监控插件
│   └── resource-accelerator.js           # 入口文件（精简版）
└── workers/
    ├── image-compressor.worker.js
    └── selector.worker.js
```

### 4.3 入口文件示例

```javascript
// content/modules/resource-accelerator.js
(function() {
  'use strict'
  
  // 导入核心
  importScripts('core/ResourceAcceleratorCore.js')
  importScripts('core/PluginManager.js')
  importScripts('core/EventManager.js')
  importScripts('core/CacheManager.js')
  
  // 导入插件
  importScripts('plugins/Plugin.js')
  importScripts('plugins/WorkerPlugin.js')
  importScripts('plugins/CachePlugin.js')
  importScripts('plugins/CDNPlugin.js')
  importScripts('plugins/ImagePlugin.js')
  importScripts('plugins/ScriptPlugin.js')
  importScripts('plugins/StylePlugin.js')
  importScripts('plugins/FontPlugin.js')
  importScripts('plugins/MonitorPlugin.js')
  
  // 配置
  const config = {
    plugins: {
      worker: { enabled: true, maxWorkers: 2 },
      image: { enabled: true, compress: true, lazyLoad: true },
      script: { enabled: true, cdnReplace: true },
      style: { enabled: true, cdnReplace: true },
      monitor: { enabled: true }
    }
  }
  
  // 创建核心实例
  const accelerator = new ResourceAcceleratorCore(config)
  
  // 注册插件
  accelerator.registerPlugin(WorkerPlugin, config.plugins.worker)
  accelerator.registerPlugin(CachePlugin, config.plugins.cache)
  accelerator.registerPlugin(CDNPlugin, config.plugins.cdn)
  accelerator.registerPlugin(ImagePlugin, config.plugins.image)
  accelerator.registerPlugin(ScriptPlugin, config.plugins.script)
  accelerator.registerPlugin(StylePlugin, config.plugins.style)
  accelerator.registerPlugin(FontPlugin, config.plugins.font)
  accelerator.registerPlugin(MonitorPlugin, config.plugins.monitor)
  
  // 初始化
  accelerator.init().then(() => {
    console.log('[ResourceAccelerator] Initialized')
  }).catch(error => {
    console.error('[ResourceAccelerator] Init failed:', error)
  })
  
  // 暴露到全局
  window.__resourceAccelerator = accelerator
})()
```

---

## 五、优势分析

### 5.1 代码质量提升

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 单文件行数 | 4970 | < 500 | 90% |
| 模块耦合度 | 高 | 低 | 显著 |
| 测试覆盖率 | 低 | > 80% | 显著 |
| 代码重复率 | 中 | < 5% | 显著 |

### 5.2 开发效率提升

| 方面 | 改进前 | 改进后 |
|------|--------|--------|
| 新增功能 | 修改核心代码，风险高 | 新建插件，隔离影响 |
| Bug修复 | 影响范围广 | 局限在单个插件 |
| 单元测试 | 困难 | 容易（独立测试插件） |
| 团队协作 | 冲突多 | 并行开发插件 |

### 5.3 可维护性提升

1. **模块边界清晰** - 每个插件职责单一
2. **依赖关系明确** - 通过meta.dependencies声明
3. **生命周期完整** - init/destroy统一管理
4. **可扩展性强** - 新增插件无需修改核心

---

## 六、测试方案

### 6.1 单元测试

```javascript
// tests/plugins/ImagePlugin.test.js
describe('ImagePlugin', () => {
  let core, plugin
  
  beforeEach(() => {
    core = new ResourceAcceleratorCore({})
    plugin = new ImagePlugin(core, ImagePlugin.defaultConfig)
  })
  
  afterEach(async () => {
    await plugin.destroy()
  })
  
  test('should initialize correctly', async () => {
    await plugin.init()
    expect(plugin.cache).toBeDefined()
    expect(plugin.lazyLoadObserver).toBeDefined()
  })
  
  test('should detect position correctly', () => {
    const element = createMockElement({ top: 0, bottom: 100 })
    const position = plugin._getPosition(element)
    expect(position.zone).toBe('inViewport')
    expect(position.priority).toBe(0)
  })
  
  test('should compress image', async () => {
    await plugin.init()
    
    const url = 'https://example.com/image.png'
    const result = await plugin._compress(url, 0)
    
    expect(result).toBeTruthy()
    expect(result.startsWith('data:image/')).toBe(true)
  })
})
```

### 6.2 集成测试

```javascript
// tests/integration/plugin-communication.test.js
describe('Plugin Communication', () => {
  let accelerator
  
  beforeEach(async () => {
    accelerator = new ResourceAcceleratorCore({})
    accelerator.registerPlugin(WorkerPlugin)
    accelerator.registerPlugin(ImagePlugin)
    await accelerator.init()
  })
  
  afterEach(async () => {
    await accelerator.destroy()
  })
  
  test('ImagePlugin should use WorkerPlugin for compression', async () => {
    const imagePlugin = accelerator.getPlugin('ImagePlugin')
    const workerPlugin = accelerator.getPlugin('WorkerPlugin')
    
    const url = 'https://example.com/image.png'
    const spy = jest.spyOn(workerPlugin, 'compressImage')
    
    await imagePlugin.handle(createMockImage(url), { url })
    
    expect(spy).toHaveBeenCalled()
  })
})
```

---

## 七、实施计划

### Week 1: 核心架构

- [ ] Day 1-2: 实现ResourceAcceleratorCore
- [ ] Day 3-4: 实现PluginManager、EventManager、CacheManager
- [ ] Day 5: 编写核心架构单元测试

### Week 2: 插件抽取

- [ ] Day 1: WorkerPlugin、CachePlugin
- [ ] Day 2: CDNPlugin
- [ ] Day 3: ImagePlugin
- [ ] Day 4: ScriptPlugin、StylePlugin
- [ ] Day 5: FontPlugin、MonitorPlugin

### Week 3: 集成和测试

- [ ] Day 1-2: 集成测试、功能回归
- [ ] Day 3-4: 性能测试、优化
- [ ] Day 5: 文档更新、代码审查

### Week 4: 发布和监控

- [ ] Day 1-2: Beta测试
- [ ] Day 3-4: Bug修复、优化
- [ ] Day 5: 正式发布

---

## 八、风险和缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 性能下降 | 中 | 中 | 基准测试、性能监控 |
| 兼容性问题 | 低 | 高 | 渐进式迁移、降级方案 |
| 插件冲突 | 低 | 中 | 依赖检查、隔离测试 |
| 文件数量增加 | 高 | 低 | 构建优化、Tree Shaking |

---

## 九、后续规划

### 9.1 插件市场（可选）

- 允许第三方开发者编写插件
- 提供插件发布平台
- 插件评分和推荐系统

### 9.2 配置可视化

- Web界面配置插件
- 实时预览配置效果
- 配置导出/导入

### 9.3 性能分析

- 插件级性能监控
- 性能报告生成
- 优化建议系统
