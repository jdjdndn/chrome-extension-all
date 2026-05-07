# 资源加速器 v14 迭代计划

> 基线版本：v13（离线缓存 + CORS优化 + 智能预加载）
> 创建时间：2026-05-06

---

## v14 进行状态

| 迭代   | 功能               | 状态      |
| ------ | ------------------ | --------- |
| 迭代 1 | 性能监控与分析     | ✅ 已完成 |
| 迭代 2 | 资源加载优先级优化 | ⏳ 待开发 |
| 迭代 3 | 内存优化与缓存策略 | ⏳ 待开发 |

---

## 当前状态 (v13)

| 模块               | 状态 | 说明                                               |
| ------------------ | ---- | -------------------------------------------------- |
| JS库替换           | ✅   | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询  |
| CSS框架替换        | ✅   | 14+ CSS 库，独立开关                               |
| 字体替换           | ✅   | Google Fonts / FontAwesome 镜像 + font-display优化 |
| 图片懒加载         | ✅   | 视口感知懒加载 + 设备适配 + 滚动速度感知           |
| 图片压缩           | ✅   | Web Worker 并行压缩 + 内存压力感知 + 持久化缓存    |
| 站点级配置         | ✅   | 按域名精确/通配符匹配，功能级开关                  |
| 高级过滤规则       | ✅   | 5 种匹配类型 + 4 种动作类型                        |
| 配置导入导出       | ✅   | JSON 格式，版本号校验 + 配置热更新                 |
| 性能基线对比       | ✅   | 加速前后数据对比                                   |
| 第三方脚本延迟     | ✅   | 自动检测 + 用户规则 + 三级策略                     |
| CDN健康探测        | ✅   | HEAD 探测，5 分钟缓存，RTT 记录                    |
| 智能调度           | ✅   | 优先级队列 + 动态批量 + CDN探测优先级              |
| 实时日志           | ✅   | 环形缓冲区(200条) + 错误持久化 + 筛选              |
| SVG优化            | ✅   | 移除注释/元数据 + 小SVG内联                        |
| 预加载优先级       | ✅   | 字体权重优先 + 最大数量控制                        |
| 网络感知           | ✅   | 自动检测网络质量 + 动态调整策略                    |
| 关键资源识别       | ✅   | 首屏CSS/JS/字体优先加载                            |
| 字体加载优化       | ✅   | font-display注入 + 中文字体子集化                  |
| 错误恢复           | ✅   | CDN重试 + 指数退避 + 熔断机制                      |
| 资源依赖建模       | ✅   | 依赖检测 + 拓扑排序 + 延迟加载                     |
| 内存监控           | ✅   | 内存压力感知 + 自动降级 + 缓存清理                 |
| 视口感知懒加载     | ✅   | 设备适配 + 滚动速度感知 + IntersectionObserver     |
| 配置热更新         | ✅   | 实时生效 + 多标签页同步                            |
| 压缩缓存持久化     | ✅   | 跨会话复用 + 过期清理 + 大小限制                   |
| **视频懒加载**     | ✅   | IntersectionObserver + 预加载策略 + 排除模式       |
| **智能预连接**     | ✅   | 历史高频域名 + 持久化 + 数量限制                   |
| **动态资源优先级** | ✅   | 页面类型检测 + 优先级调整                          |
| **离线缓存**       | ✅   | Cache API + stale-while-revalidate策略 + 自动清理  |
| **CORS优化**       | ✅   | 预检缓存 + 请求批量合并                            |
| **智能预加载**     | ✅   | 用户行为分析 + 视口感知预加载                      |
| **性能监控与分析** | ✅   | Web Vitals + 资源时序 + 内存监控 + 优化建议        |

### v13 遗留问题

1. **性能监控不完善** — ~~缺少详细的性能指标收集和分析~~ ✅ v14-1 已解决
2. **资源优先级固定** — 不根据网络状况动态调整资源优先级
3. **内存优化不足** — 缺少精细的内存管理和缓存策略

---

## 迭代目标

**目标**：性能监控 + 优先级优化 + 内存优化

**原则**：

- 高 ROI 优先：性能监控 > 优先级优化 > 内存优化
- 不改变现有核心架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值
- 不引入可视化、分享、插件功能

---

## 迭代 1: 性能监控与分析

**目标**：收集详细的性能指标，提供优化建议

### 问题分析

当前问题：

- 性能指标收集不完善
- 缺少资源加载时间分析
- 无优化建议生成

### 功能设计

**性能监控配置**

```javascript
const PERF_MONITOR_CONFIG = {
  enabled: true,
  // 监控指标
  metrics: {
    // 核心 Web Vitals
    lcp: true, // Largest Contentful Paint
    fid: true, // First Input Delay
    cls: true, // Cumulative Layout Shift
    ttfb: true, // Time to First Byte
    fcp: true, // First Contentful Paint

    // 资源加载指标
    resourceTiming: true,
    resourceSize: true,
    resourceCount: true,

    // 内存指标
    memoryUsage: true,
    memoryPressure: true,
  },
  // 采样率
  sampleRate: 0.1, // 10% 采样
  // 数据上报
  reportInterval: 60000, // 1分钟
  // 数据存储
  storageKey: 'resourceAcceleratorPerfData',
  maxEntries: 1000,
}
```

**性能监控管理**

```javascript
class PerformanceMonitor {
  constructor(config) {
    this.config = config
    this.metrics = {}
    this.observers = []
    this.sampled = Math.random() < config.sampleRate
  }

  async init() {
    if (!this.config.enabled || !this.sampled) return

    // 初始化指标收集
    this.initCoreWebVitals()
    this.initResourceTiming()
    this.initMemoryMonitoring()

    // 启动定期上报
    this.startReporting()

    console.log(`${LOG_PREFIX} [PerfMonitor] 初始化完成`)
  }

  initCoreWebVitals() {
    // LCP 观察
    if (this.config.metrics.lcp) {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        if (entries.length > 0) {
          this.metrics.lcp = entries[entries.length - 1].startTime
        }
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      this.observers.push(lcpObserver)
    }

    // FID 观察
    if (this.config.metrics.fid) {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        entries.forEach((entry) => {
          if (entry.processingStart) {
            this.metrics.fid = entry.processingStart - entry.startTime
          }
        })
      })
      fidObserver.observe({ type: 'first-input', buffered: true })
      this.observers.push(fidObserver)
    }

    // CLS 观察
    if (this.config.metrics.cls) {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        this.metrics.cls = clsValue
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
      this.observers.push(clsObserver)
    }

    // FCP 观察
    if (this.config.metrics.fcp) {
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime
          }
        })
      })
      fcpObserver.observe({ type: 'paint', buffered: true })
      this.observers.push(fcpObserver)
    }
  }

  initResourceTiming() {
    if (!this.config.metrics.resourceTiming) return

    const resourceObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      entries.forEach((entry) => {
        this.processResourceTiming(entry)
      })
    })
    resourceObserver.observe({ type: 'resource', buffered: true })
    this.observers.push(resourceObserver)
  }

  processResourceTiming(entry) {
    const url = entry.name
    const duration = entry.duration
    const size = entry.transferSize || 0

    // 记录资源加载信息
    if (!this.metrics.resources) {
      this.metrics.resources = []
    }

    this.metrics.resources.push({
      url,
      duration,
      size,
      type: this.getResourceType(url),
      timestamp: Date.now(),
    })

    // 限制记录数量
    if (this.metrics.resources.length > 100) {
      this.metrics.resources = this.metrics.resources.slice(-100)
    }
  }

  getResourceType(url) {
    if (url.endsWith('.js')) return 'script'
    if (url.endsWith('.css')) return 'style'
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image'
    if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font'
    return 'other'
  }

  initMemoryMonitoring() {
    if (!this.config.metrics.memoryUsage) return

    // 定期检查内存使用
    setInterval(() => {
      if (performance.memory) {
        this.metrics.memoryUsage = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        }
      }
    }, 5000)
  }

  startReporting() {
    setInterval(() => {
      this.reportMetrics()
    }, this.config.reportInterval)
  }

  async reportMetrics() {
    if (Object.keys(this.metrics).length === 0) return

    const report = {
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
      metrics: { ...this.metrics },
    }

    // 保存到本地存储
    await this.saveMetrics(report)

    // 清空当前指标
    this.metrics.resources = []
  }

  getConnectionInfo() {
    if (navigator.connection) {
      return {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
      }
    }
    return null
  }

  async saveMetrics(report) {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey)
      const metrics = result[this.config.storageKey] || []

      metrics.push(report)

      // 限制存储数量
      if (metrics.length > this.config.maxEntries) {
        metrics.splice(0, metrics.length - this.config.maxEntries)
      }

      await chrome.storage.local.set({ [this.config.storageKey]: metrics })
    } catch (e) {
      console.warn(`${LOG_PREFIX} [PerfMonitor] 保存指标失败:`, e)
    }
  }

  async getOptimizationSuggestions() {
    const suggestions = []

    // LCP 优化建议
    if (this.metrics.lcp > 2500) {
      suggestions.push({
        type: 'lcp',
        severity: 'high',
        message: 'LCP 时间过长，建议优化关键资源加载',
        actions: ['启用关键资源优先加载', '优化图片加载', '减少渲染阻塞资源'],
      })
    }

    // CLS 优化建议
    if (this.metrics.cls > 0.1) {
      suggestions.push({
        type: 'cls',
        severity: 'medium',
        message: '布局偏移过大，建议稳定页面布局',
        actions: ['为图片设置尺寸', '避免动态插入内容', '使用 CSS containment'],
      })
    }

    // 资源加载优化建议
    if (this.metrics.resources) {
      const slowResources = this.metrics.resources.filter((r) => r.duration > 1000)
      if (slowResources.length > 0) {
        suggestions.push({
          type: 'resource',
          severity: 'medium',
          message: `发现 ${slowResources.length} 个慢加载资源`,
          actions: ['启用 CDN 加速', '优化资源大小', '使用懒加载'],
        })
      }
    }

    return suggestions
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
  }
}
```

### 文件变更

| 文件                                      | 变更                       |
| ----------------------------------------- | -------------------------- |
| `content/modules/resource-accelerator.js` | 新增 PerformanceMonitor 类 |

### 验收标准

- [x] 收集核心 Web Vitals 指标
- [x] 记录资源加载时间和大小
- [x] 监控内存使用情况
- [x] 生成优化建议
- [x] 数据本地存储
- [x] 不影响页面性能

### 风险

| 风险     | 影响         | 缓解                  |
| -------- | ------------ | --------------------- |
| 性能开销 | 影响页面加载 | 采样率控制 + 异步收集 |
| 存储空间 | 设备存储不足 | 限制存储数量          |
| 隐私问题 | 记录用户行为 | 仅记录性能数据        |

---

## 迭代 2: 资源加载优先级优化

**目标**：根据网络状况和页面类型动态调整资源优先级

### 问题分析

当前问题：

- 资源优先级基于固定规则
- 不根据网络状况调整
- 无优先级动态调整机制

### 功能设计

**优先级优化配置**

```javascript
const PRIORITY_OPTIMIZATION_CONFIG = {
  enabled: true,
  // 网络感知优先级
  networkAware: {
    enabled: true,
    // 不同网络状况下的优先级调整
    adjustments: {
      fast: {
        script: 0,
        style: 1,
        image: 2,
        font: 3,
      },
      medium: {
        script: 0,
        style: 0,
        image: 1,
        font: 2,
      },
      slow: {
        script: 0,
        style: 0,
        image: 0,
        font: 1,
      },
    },
  },
  // 页面类型优先级
  pageTypeAware: {
    enabled: true,
    // 不同页面类型的优先级规则
    rules: {
      ecommerce: {
        images: 0, // 商品图片最高优先级
        scripts: 1,
        styles: 2,
        fonts: 3,
      },
      news: {
        scripts: 0, // 新闻脚本优先
        styles: 1,
        images: 2,
        fonts: 3,
      },
      video: {
        video: 0, // 视频最高优先级
        scripts: 1,
        styles: 2,
        images: 3,
      },
    },
  },
  // 资源大小感知
  sizeAware: {
    enabled: true,
    // 小资源优先加载
    smallResourceThreshold: 10000, // 10KB
    // 大资源延迟加载
    largeResourceThreshold: 100000, // 100KB
  },
}
```

**优先级优化管理**

```javascript
class PriorityOptimizer {
  constructor(config) {
    this.config = config
    this.currentPriority = {}
    this.networkQuality = 'medium'
    this.pageType = 'default'
  }

  async init() {
    if (!this.config.enabled) return

    // 检测网络状况
    this.detectNetworkQuality()

    // 检测页面类型
    this.detectPageType()

    // 计算优先级
    this.calculatePriority()

    // 监听网络变化
    this.listenNetworkChanges()

    console.log(`${LOG_PREFIX} [PriorityOptimizer] 初始化完成`)
  }

  detectNetworkQuality() {
    if (!this.config.networkAware.enabled) return

    if (navigator.connection) {
      const effectiveType = navigator.connection.effectiveType
      const downlink = navigator.connection.downlink

      if (effectiveType === '4g' && downlink > 10) {
        this.networkQuality = 'fast'
      } else if (effectiveType === '4g' || effectiveType === '3g') {
        this.networkQuality = 'medium'
      } else {
        this.networkQuality = 'slow'
      }
    }
  }

  detectPageType() {
    if (!this.config.pageTypeAware.enabled) return

    const url = location.href
    const hostname = location.hostname

    for (const [type, rules] of Object.entries(this.config.pageTypeAware.rules)) {
      const patterns = this.getPageTypePatterns(type)
      const matches = patterns.some((pattern) => pattern.test(url) || pattern.test(hostname))

      if (matches) {
        this.pageType = type
        return
      }
    }

    this.pageType = 'default'
  }

  getPageTypePatterns(type) {
    const patterns = {
      ecommerce: [/product/i, /item/i, /shop/i, /cart/i],
      news: [/article/i, /news/i, /post/i, /blog/i],
      video: [/video/i, /watch/i, /player/i, /stream/i],
    }

    return patterns[type] || []
  }

  calculatePriority() {
    const basePriority = this.getBasePriority()
    const networkAdjustment = this.getNetworkAdjustment()
    const pageTypeAdjustment = this.getPageTypeAdjustment()

    // 合并优先级
    this.currentPriority = { ...basePriority }

    // 应用网络调整
    if (this.config.networkAware.enabled && networkAdjustment) {
      Object.keys(this.currentPriority).forEach((type) => {
        if (networkAdjustment[type] !== undefined) {
          this.currentPriority[type] = networkAdjustment[type]
        }
      })
    }

    // 应用页面类型调整
    if (this.config.pageTypeAware.enabled && pageTypeAdjustment) {
      Object.keys(this.currentPriority).forEach((type) => {
        if (pageTypeAdjustment[type] !== undefined) {
          this.currentPriority[type] = pageTypeAdjustment[type]
        }
      })
    }
  }

  getBasePriority() {
    return {
      script: 0,
      style: 1,
      image: 2,
      font: 3,
      video: 4,
    }
  }

  getNetworkAdjustment() {
    return this.config.networkAware.adjustments[this.networkQuality]
  }

  getPageTypeAdjustment() {
    return this.config.pageTypeAware.rules[this.pageType]
  }

  listenNetworkChanges() {
    if (!navigator.connection) return

    navigator.connection.addEventListener('change', () => {
      this.detectNetworkQuality()
      this.calculatePriority()
    })
  }

  getResourcePriority(url, type) {
    let priority = this.currentPriority[type] ?? 2

    // 资源大小感知
    if (this.config.sizeAware.enabled) {
      const size = this.estimateResourceSize(url, type)
      if (size < this.config.sizeAware.smallResourceThreshold) {
        priority = Math.max(0, priority - 1) // 小资源提高优先级
      } else if (size > this.config.sizeAware.largeResourceThreshold) {
        priority = Math.min(4, priority + 1) // 大资源降低优先级
      }
    }

    return priority
  }

  estimateResourceSize(url, type) {
    // 基于类型和URL估算资源大小
    const sizeEstimates = {
      script: 50000, // 50KB
      style: 20000, // 20KB
      image: 100000, // 100KB
      font: 30000, // 30KB
      video: 1000000, // 1MB
    }

    return sizeEstimates[type] || 50000
  }

  applyPriorityToResource(element, url, type) {
    const priority = this.getResourcePriority(url, type)

    // 设置 fetchPriority 属性
    if (element.fetchPriority) {
      element.fetchPriority = priority <= 1 ? 'high' : priority >= 3 ? 'low' : 'auto'
    }

    // 设置 loading 属性
    if (element.loading) {
      element.loading = priority <= 1 ? 'eager' : 'lazy'
    }
  }
}
```

### 文件变更

| 文件                                      | 变更                      |
| ----------------------------------------- | ------------------------- |
| `content/modules/resource-accelerator.js` | 新增 PriorityOptimizer 类 |

### 验收标准

- [ ] 根据网络状况调整资源优先级
- [ ] 根据页面类型调整资源优先级
- [ ] 资源大小感知
- [ ] 动态优先级调整
- [ ] 不影响资源加载正确性

### 风险

| 风险         | 影响         | 缓解           |
| ------------ | ------------ | -------------- |
| 优先级冲突   | 加载顺序混乱 | 明确优先级规则 |
| 网络检测不准 | 优先级不合适 | 提供手动配置   |
| 性能开销     | 影响页面加载 | 缓存检测结果   |

---

## 迭代 3: 内存优化与缓存策略

**目标**：优化内存使用，提供智能缓存策略

### 问题分析

当前问题：

- 内存使用不透明
- 缓存策略简单
- 无内存压力感知

### 功能设计

**内存优化配置**

```javascript
const MEMORY_OPTIMIZATION_CONFIG = {
  enabled: true,
  // 内存监控
  monitoring: {
    enabled: true,
    checkInterval: 5000, // 5秒
    thresholds: {
      warning: 100, // 100MB
      critical: 200, // 200MB
    },
  },
  // 缓存策略
  caching: {
    enabled: true,
    // 缓存大小限制
    maxSize: 50 * 1024 * 1024, // 50MB
    // 缓存过期时间
    ttl: 7 * 24 * 60 * 60 * 1000, // 7天
    // 缓存淘汰策略
    evictionPolicy: 'lru', // lru | lfu | fifo
    // 缓存预热
    prewarm: {
      enabled: true,
      types: ['css', 'js', 'fonts'],
    },
  },
  // 内存压力响应
  pressureResponse: {
    enabled: true,
    strategies: {
      warning: {
        disableImageCompress: false,
        reduceCacheSize: true,
        pauseBackgroundTasks: false,
      },
      critical: {
        disableImageCompress: true,
        reduceCacheSize: true,
        pauseBackgroundTasks: true,
      },
    },
  },
}
```

**内存优化管理**

```javascript
class MemoryOptimizer {
  constructor(config) {
    this.config = config
    this.cache = new Map()
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    }
    this.memoryPressure = 'normal'
  }

  async init() {
    if (!this.config.enabled) return

    // 初始化内存监控
    this.initMemoryMonitoring()

    // 初始化缓存
    this.initCache()

    // 加载缓存数据
    await this.loadCacheData()

    console.log(`${LOG_PREFIX} [MemoryOptimizer] 初始化完成`)
  }

  initMemoryMonitoring() {
    if (!this.config.monitoring.enabled) return

    setInterval(() => {
      this.checkMemoryPressure()
    }, this.config.monitoring.checkInterval)
  }

  checkMemoryPressure() {
    if (!performance.memory) return

    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024

    if (usedMB > this.config.monitoring.thresholds.critical) {
      this.memoryPressure = 'critical'
      this.applyPressureResponse('critical')
    } else if (usedMB > this.config.monitoring.thresholds.warning) {
      this.memoryPressure = 'warning'
      this.applyPressureResponse('warning')
    } else {
      this.memoryPressure = 'normal'
    }
  }

  applyPressureResponse(pressure) {
    const strategy = this.config.pressureResponse.strategies[pressure]
    if (!strategy) return

    // 应用压力响应策略
    if (strategy.disableImageCompress) {
      state.config.imageCompress = false
    }

    if (strategy.reduceCacheSize) {
      this.reduceCacheSize()
    }

    if (strategy.pauseBackgroundTasks) {
      this.pauseBackgroundTasks()
    }
  }

  reduceCacheSize() {
    const currentSize = this.getCacheSize()
    const targetSize = this.config.caching.maxSize * 0.5 // 减少到50%

    if (currentSize > targetSize) {
      this.evictCacheEntries(currentSize - targetSize)
    }
  }

  pauseBackgroundTasks() {
    // 暂停后台任务
    if (state._workerPool) {
      state._workerPool.pause()
    }
  }

  initCache() {
    // 初始化缓存
    this.cache = new Map()
  }

  async loadCacheData() {
    try {
      const result = await chrome.storage.local.get('resourceAcceleratorCacheData')
      const cachedData = result.resourceAcceleratorCacheData || {}

      // 加载缓存数据
      for (const [key, value] of Object.entries(cachedData)) {
        if (this.isCacheEntryValid(value)) {
          this.cache.set(key, value)
        }
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} [MemoryOptimizer] 加载缓存数据失败:`, e)
    }
  }

  isCacheEntryValid(entry) {
    if (!entry || !entry.timestamp) return false

    const now = Date.now()
    return now - entry.timestamp < this.config.caching.ttl
  }

  async saveCacheData() {
    try {
      const cacheData = Object.fromEntries(this.cache)
      await chrome.storage.local.set({ resourceAcceleratorCacheData: cacheData })
    } catch (e) {
      console.warn(`${LOG_PREFIX} [MemoryOptimizer] 保存缓存数据失败:`, e)
    }
  }

  getCacheSize() {
    let size = 0
    for (const [key, value] of this.cache.entries()) {
      size += this.estimateSize(value)
    }
    return size
  }

  estimateSize(value) {
    // 估算缓存项大小
    if (typeof value === 'string') {
      return value.length * 2 // UTF-16
    }
    return JSON.stringify(value).length * 2
  }

  evictCacheEntries(targetSize) {
    let evictedSize = 0
    const entries = Array.from(this.cache.entries())

    // 根据淘汰策略排序
    switch (this.config.caching.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0))
        break
      case 'lfu':
        entries.sort((a, b) => (a[1].accessCount || 0) - (b[1].accessCount || 0))
        break
      case 'fifo':
        entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
        break
    }

    // 淘汰缓存项
    for (const [key, value] of entries) {
      if (evictedSize >= targetSize) break

      const size = this.estimateSize(value)
      this.cache.delete(key)
      evictedSize += size
      this.cacheStats.evictions++
    }
  }

  async getFromCache(key) {
    if (!this.config.caching.enabled) return null

    const entry = this.cache.get(key)
    if (!entry) {
      this.cacheStats.misses++
      return null
    }

    // 检查是否过期
    if (!this.isCacheEntryValid(entry)) {
      this.cache.delete(key)
      this.cacheStats.misses++
      return null
    }

    // 更新访问信息
    entry.lastAccess = Date.now()
    entry.accessCount = (entry.accessCount || 0) + 1

    this.cacheStats.hits++
    return entry.value
  }

  async setCache(key, value) {
    if (!this.config.caching.enabled) return

    // 检查缓存大小
    const currentSize = this.getCacheSize()
    const entrySize = this.estimateSize(value)

    if (currentSize + entrySize > this.config.caching.maxSize) {
      this.evictCacheEntries(entrySize)
    }

    // 存储缓存项
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
    })

    // 定期保存缓存数据
    this.scheduleSaveCacheData()
  }

  scheduleSaveCacheData() {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      this.saveCacheData()
    }, 5000)
  }

  getCacheStats() {
    return {
      ...this.cacheStats,
      size: this.getCacheSize(),
      entries: this.cache.size,
      memoryPressure: this.memoryPressure,
    }
  }

  clearCache() {
    this.cache.clear()
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 }
    this.saveCacheData()
  }
}
```

### 文件变更

| 文件                                      | 变更                    |
| ----------------------------------------- | ----------------------- |
| `content/modules/resource-accelerator.js` | 新增 MemoryOptimizer 类 |

### 验收标准

- [ ] 监控内存使用情况
- [ ] 智能缓存淘汰策略
- [ ] 内存压力响应
- [ ] 缓存预热
- [ ] 缓存数据持久化
- [ ] 不影响页面性能

### 风险

| 风险     | 影响         | 缓解         |
| -------- | ------------ | ------------ |
| 缓存污染 | 显示旧内容   | 版本化缓存键 |
| 内存泄漏 | 应用崩溃     | 定期清理缓存 |
| 性能开销 | 影响页面加载 | 异步操作     |

---

## 实施顺序

```
迭代1: 性能监控 → 迭代2: 优先级优化 → 迭代3: 内存优化
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3

**理由**：

- 迭代 1（性能监控）ROI 最高：提供数据支撑后续优化
- 迭代 2（优先级优化）性能提升：智能调整资源加载顺序
- 迭代 3（内存优化）体验优化：减少内存占用，提升稳定性

---

## 风险评估

| 风险         | 影响         | 缓解措施              |
| ------------ | ------------ | --------------------- |
| 性能监控开销 | 影响页面加载 | 采样率控制 + 异步收集 |
| 优先级冲突   | 加载顺序混乱 | 明确优先级规则        |
| 内存泄漏     | 应用崩溃     | 定期清理缓存          |
| 缓存不一致   | 显示旧内容   | 版本化缓存键          |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 |
| ----------------------------------------- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    |

---

## 与 v13 的关系

v13 完成了离线缓存、CORS优化、智能预加载。v14 在此基础上：

| v13 基础设施   | v14 扩展                      |
| -------------- | ----------------------------- |
| 基础性能指标   | 扩展为详细性能监控            |
| 固定资源优先级 | 扩展为网络/页面类型感知优先级 |
| 简单内存管理   | 扩展为智能内存优化和缓存策略  |

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 新增配置有合理默认值
5. **测试覆盖** — 每个迭代需配套测试用例
6. **不引入可视化** — 不添加图表、可视化面板等 UI 功能
7. **不引入分享** — 不添加配置分享、数据导出分享等功能
8. **不引入插件** — 不添加插件系统、扩展 API 等功能
