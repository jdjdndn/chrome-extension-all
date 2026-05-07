# 资源加速器 v15 迭代计划

> 基线版本：v14（性能监控 + 优先级优化 + 内存优化）
> 创建时间：2026-05-06

---

## v15 进行状态

| 迭代   | 功能               | 状态      |
| ------ | ------------------ | --------- |
| 迭代 1 | 自适应压缩策略     | ⏳ 待开发 |
| 迭代 2 | 资源预加载智能调度 | ⏳ 待开发 |

---

## 当前状态 (v14)

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
| 视频懒加载         | ✅   | IntersectionObserver + 预加载策略 + 排除模式       |
| 智能预连接         | ✅   | 历史高频域名 + 持久化 + 数量限制                   |
| 动态资源优先级     | ✅   | 页面类型检测 + 优先级调整                          |
| 离线缓存           | ✅   | Cache API + stale-while-revalidate策略 + 自动清理  |
| CORS优化           | ✅   | 预检缓存 + 请求批量合并                            |
| 智能预加载         | ✅   | 用户行为分析 + 视口感知预加载                      |
| **性能监控与分析** | ✅   | Web Vitals + 资源时序 + 内存监控 + 优化建议        |
| **优先级优化**     | ✅   | 网络感知 + 页面类型感知 + 动态调整                 |
| **内存优化**       | ✅   | 智能缓存淘汰(LRU/LFU/FIFO) + 压力响应 + 预热       |

### v14 遗留问题

1. **压缩策略固定** — 不根据图片类型、尺寸、网络状况动态调整压缩参数
2. **预加载不够智能** — 缺少基于页面结构和用户意图的预加载决策

---

## 迭代目标

**目标**：自适应压缩 + 智能预加载

**原则**：

- 高 ROI 优先：自适应压缩 > 智能预加载
- 不改变现有核心架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值
- 不引入可视化、分享、插件功能

---

## 迭代 1: 自适应压缩策略

**目标**：根据图片类型、尺寸、网络状况动态调整压缩参数

### 问题分析

当前问题：

- 压缩质量固定（默认 0.8）
- 不根据图片类型（摄影/图标/截图）调整策略
- 不根据网络状况动态调整压缩强度

### 功能设计

**自适应压缩配置**

```javascript
adaptiveCompress: {
  enabled: true,
  // 图片类型检测
  typeDetection: {
    enabled: true,
    // 基于文件名模式检测
    patterns: {
      photo: [/\.(jpg|jpeg|png|webp)$/i, /photo|image|pic/i],
      icon: [/icon|logo|avatar|emoji/i, /\.(svg|ico)$/i],
      screenshot: [/screenshot|capture|snap/i],
      diagram: [/chart|graph|diagram|flow/i],
    },
  },
  // 类型特定压缩策略
  typeStrategies: {
    photo: {
      quality: 0.82,
      maxWidth: 1920,
      format: 'webp',  // webp | avif | jpeg | png
      chromaSubsampling: true,
    },
    icon: {
      quality: 0.95,
      maxWidth: 512,
      format: 'webp',
      chromaSubsampling: false,
    },
    screenshot: {
      quality: 0.78,
      maxWidth: 2560,
      format: 'webp',
      chromaSubsampling: true,
    },
    diagram: {
      quality: 0.85,
      maxWidth: 1200,
      format: 'webp',
      chromaSubsampling: false,
    },
  },
  // 网络感知调整
  networkAdaptive: {
    enabled: true,
    adjustments: {
      fast: { qualityMultiplier: 1.1 },    // 高质量
      medium: { qualityMultiplier: 1.0 },   // 标准质量
      slow: { qualityMultiplier: 0.7 },     // 低质量
    },
  },
  // 尺寸感知
  sizeAdaptive: {
    enabled: true,
    smallImageThreshold: 50000,   // 50KB 以下轻度压缩
    largeImageThreshold: 500000,  // 500KB 以上重度压缩
  },
},
```

**自适应压缩管理**

```javascript
class AdaptiveCompressor {
  constructor(config) {
    this.config = config
    this.typeCache = new Map()
  }

  init() {
    if (!this.config.enabled) return
    console.log(`${LOG_PREFIX} [AdaptiveCompressor] 初始化完成`)
  }

  detectImageType(url, element) {
    if (!this.config.typeDetection.enabled) return 'photo'

    const cacheKey = url
    if (this.typeCache.has(cacheKey)) {
      return this.typeCache.get(cacheKey)
    }

    let detectedType = 'photo'

    for (const [type, patterns] of Object.entries(this.config.typeDetection.patterns)) {
      const matches = patterns.some(
        (pattern) => pattern.test(url) || pattern.test(element?.className || '')
      )
      if (matches) {
        detectedType = type
        break
      }
    }

    this.typeCache.set(cacheKey, detectedType)
    return detectedType
  }

  getCompressParams(url, element, originalSize) {
    const imageType = this.detectImageType(url, element)
    const baseParams = this.config.typeStrategies[imageType] || this.config.typeStrategies.photo

    let quality = baseParams.quality
    let maxWidth = baseParams.maxWidth

    // 网络感知调整
    // 注意：需要在 state 对象中添加 _lastNetworkQuality 属性
    // 或从 NetworkAdaptive 模块获取当前网络质量
    if (this.config.networkAdaptive.enabled && typeof state !== 'undefined') {
      // 方案1：从 state._lastNetworkQuality 获取（需要在 NetworkAdaptive 模块中设置）
      const networkQuality = state._lastNetworkQuality || 'medium'

      // 方案2：如果 _lastNetworkQuality 不存在，使用默认值 'medium'
      const adjustment = this.config.networkAdaptive.adjustments[networkQuality]
      if (adjustment) {
        quality = Math.min(1, quality * adjustment.qualityMultiplier)
      }
    }

    // 尺寸感知调整
    if (this.config.sizeAdaptive.enabled && originalSize) {
      if (originalSize < this.config.sizeAdaptive.smallImageThreshold) {
        quality = Math.min(1, quality * 1.1) // 小图高质量
      } else if (originalSize > this.config.sizeAdaptive.largeImageThreshold) {
        quality = Math.max(0.3, quality * 0.7) // 大图低质量
        maxWidth = Math.floor(maxWidth * 0.7)
      }
    }

    return {
      quality,
      maxWidth,
      format: baseParams.format,
      chromaSubsampling: baseParams.chromaSubsampling,
      imageType,
    }
  }

  destroy() {
    this.typeCache.clear()
  }
}
```

### 文件变更

| 文件                                      | 变更                       |
| ----------------------------------------- | -------------------------- |
| `content/modules/resource-accelerator.js` | 新增 AdaptiveCompressor 类 |

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG**

在 `svgOptimize` 配置之后添加：

```javascript
// 自适应压缩
adaptiveCompress: {
  enabled: true,
  typeDetection: {
    enabled: true,
    patterns: {
      photo: [/\.(jpg|jpeg|png|webp)$/i, /photo|image|pic/i],
      icon: [/icon|logo|avatar|emoji/i, /\.(svg|ico)$/i],
      screenshot: [/screenshot|capture|snap/i],
      diagram: [/chart|graph|diagram|flow/i],
    },
  },
  typeStrategies: {
    photo: { quality: 0.82, maxWidth: 1920, format: 'webp', chromaSubsampling: true },
    icon: { quality: 0.95, maxWidth: 512, format: 'webp', chromaSubsampling: false },
    screenshot: { quality: 0.78, maxWidth: 2560, format: 'webp', chromaSubsampling: true },
    diagram: { quality: 0.85, maxWidth: 1200, format: 'webp', chromaSubsampling: false },
  },
  networkAdaptive: {
    enabled: true,
    adjustments: {
      fast: { qualityMultiplier: 1.1 },
      medium: { qualityMultiplier: 1.0 },
      slow: { qualityMultiplier: 0.7 },
    },
  },
  sizeAdaptive: {
    enabled: true,
    smallImageThreshold: 50000,
    largeImageThreshold: 500000,
  },
},
```

**2. 添加类定义（在 MemoryOptimizer 类之后）**

```javascript
// ========== 自适应压缩 ==========
class AdaptiveCompressor {
  // ... 完整类定义见上方
}
```

**3. 修改 compressImage 函数**

在 `canvas.toBlob` 调用前添加自适应参数获取，并将 maxWidth 传递给 canvas 缩放逻辑：

```javascript
// 修改前：
const MAX_DIMENSION = state.config.imageMaxDimension || 2048
// ... canvas 缩放逻辑使用 MAX_DIMENSION
canvas.toBlob(
  (blob) => {
    // ... 处理逻辑
  },
  'image/jpeg',
  state.config.imageQuality
)

// 修改后：
let quality = state.config.imageQuality
let MAX_DIMENSION = state.config.imageMaxDimension || 2048

if (_adaptiveCompressor) {
  const params = _adaptiveCompressor.getCompressParams(url, img, originalSize)
  quality = params.quality
  MAX_DIMENSION = params.maxWidth // 使用自适应 maxWidth
}

// ... canvas 缩放逻辑使用 MAX_DIMENSION
canvas.toBlob(
  (blob) => {
    // ... 处理逻辑
  },
  'image/jpeg',
  quality
)
```

**4. 添加初始化函数**

```javascript
let _adaptiveCompressor = null

function _initAdaptiveCompressor() {
  if (!state.config.adaptiveCompress?.enabled) return
  _adaptiveCompressor = new AdaptiveCompressor(state.config.adaptiveCompress)
  _adaptiveCompressor.init()
}
```

**5. 在 init() 函数中调用**

在其他初始化调用之后添加：

```javascript
// 1.17 初始化自适应压缩
_initAdaptiveCompressor()
```

**6. 在 destroy() 函数中清理**

```javascript
_adaptiveCompressor?.destroy()
```

### 验收标准

- [ ] 自动检测图片类型（摄影/图标/截图/图表）
- [ ] 根据类型应用不同压缩策略
- [ ] 根据网络状况调整压缩质量
- [ ] 根据图片尺寸调整压缩强度
- [ ] 向后兼容现有压缩功能
- [ ] 不影响页面性能

### 风险

| 风险         | 影响         | 缓解           |
| ------------ | ------------ | -------------- |
| 类型检测不准 | 压缩效果不佳 | 用户可手动覆盖 |
| 性能开销     | 影响页面加载 | 缓存检测结果   |
| 格式兼容性   | 浏览器不支持 | 降级到 JPEG    |

---

## 迭代 2: 资源预加载智能调度

**目标**：基于页面结构和用户意图智能调度预加载

### 问题分析

当前问题：

- 预加载基于固定规则
- 不理解页面结构和内容
- 缺少用户意图预测

### 功能设计

**智能预加载配置**

```javascript
smartPreloadV2: {
  enabled: true,
  // 页面结构分析
  pageStructure: {
    enabled: true,
    // 检测页面关键区域
    criticalRegions: {
      aboveFold: true,      // 首屏区域
      navigation: true,     // 导航区域
      mainContent: true,    // 主要内容区域
      sidebar: false,       // 侧边栏（非关键）
    },
    // 内容类型检测
    contentTypes: {
      article: { patterns: [/article/i, /post/i, /blog/i], preloadImages: 3 },
      ecommerce: { patterns: [/product/i, /item/i, /shop/i], preloadImages: 5 },
      video: { patterns: [/video/i, /watch/i, /player/i], preloadVideo: true },
      gallery: { patterns: [/gallery/i, /album/i, /photo/i], preloadImages: 8 },
    },
  },
  // 用户意图预测
  intentPrediction: {
    enabled: true,
    // 基于滚动速度预测
    scrollSpeed: {
      fastThreshold: 1000,  // 快速滚动阈值 (px/s)
      slowThreshold: 200,   // 慢速滚动阈值
      fastBehavior: 'preload-more',  // 快速滚动时预加载更多
      slowBehavior: 'preload-details',  // 慢速滚动时预加载详情
    },
    // 基于停留时间预测
    dwellTime: {
      shortThreshold: 2000,   // 短停留阈值 (ms)
      longThreshold: 10000,   // 长停留阈值
      shortBehavior: 'preload-next',  // 短停留预加载下一个
      longBehavior: 'preload-related',  // 长停留预加载相关内容
    },
    // 基于鼠标移动预测
    mouseMovement: {
      enabled: true,
      hoverPreload: true,  // 悬停预加载
      hoverDelay: 300,     // 悬停延迟 (ms)
    },
  },
  // 资源优先级调度
  priorityScheduling: {
    enabled: true,
    maxConcurrent: 3,  // 最大并发预加载数
    priorityQueue: true,  // 优先级队列
    abortOnNavigate: true,  // 导航时中止低优先级预加载
  },
},
```

**智能预加载管理**

```javascript
class SmartPreloadV2 {
  constructor(config) {
    this.config = config
    this.pageType = 'default'
    this.preloadQueue = []
    this.activePreloads = 0
    this.scrollSpeed = 0
    this.lastScrollY = 0
    this.lastScrollTime = Date.now()
    this.dwellTime = 0
    this.pageLoadTime = Date.now()
  }

  init() {
    if (!this.config.enabled) return

    this.analyzePageStructure()
    this.initScrollListener()
    this.initMouseListener()
    this.initDwellTimeTracker()

    console.log(`${LOG_PREFIX} [SmartPreloadV2] 初始化完成`)
  }

  analyzePageStructure() {
    if (!this.config.pageStructure.enabled) return

    // 检测页面类型
    const url = location.href
    for (const [type, rules] of Object.entries(this.config.pageStructure.contentTypes)) {
      const matches = rules.patterns.some((pattern) => pattern.test(url))
      if (matches) {
        this.pageType = type
        break
      }
    }

    // 检测关键区域
    this.criticalResources = this.detectCriticalResources()
  }

  detectCriticalResources() {
    const resources = []

    // 检测首屏图片
    if (this.config.pageStructure.criticalRegions.aboveFold) {
      const viewportHeight = window.innerHeight
      document.querySelectorAll('img[src]').forEach((img) => {
        const rect = img.getBoundingClientRect()
        if (rect.top < viewportHeight) {
          resources.push({
            url: img.src,
            type: 'image',
            priority: 0, // 最高优先级
            region: 'aboveFold',
          })
        }
      })
    }

    // 检测导航链接
    if (this.config.pageStructure.criticalRegions.navigation) {
      document.querySelectorAll('nav a[href], .nav a[href], header a[href]').forEach((link) => {
        resources.push({
          url: link.href,
          type: 'link',
          priority: 1,
          region: 'navigation',
        })
      })
    }

    return resources
  }

  initScrollListener() {
    if (!this.config.intentPrediction.enabled) return

    let scrollTimer = null
    this._scrollHandler = () => {
      const now = Date.now()
      const deltaY = Math.abs(window.scrollY - this.lastScrollY)
      const deltaTime = now - this.lastScrollTime

      if (deltaTime > 0) {
        this.scrollSpeed = deltaY / (deltaTime / 1000)
      }

      this.lastScrollY = window.scrollY
      this.lastScrollTime = now

      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        this.onScrollEnd()
      }, 150)
    }
    window.addEventListener('scroll', this._scrollHandler, { passive: true })
  }

  onScrollEnd() {
    const { fastThreshold, slowThreshold, fastBehavior, slowBehavior } =
      this.config.intentPrediction.scrollSpeed

    if (this.scrollSpeed > fastThreshold) {
      this.executeStrategy(fastBehavior)
    } else if (this.scrollSpeed < slowThreshold) {
      this.executeStrategy(slowBehavior)
    }
  }

  initMouseListener() {
    if (!this.config.intentPrediction.mouseMovement.enabled) return

    this._mouseHandler = (e) => {
      const target = e.target.closest('a[href], img[src]')
      if (!target) return

      const url = target.href || target.src
      if (!url) return

      setTimeout(() => {
        this.schedulePreload(url, 'hover', 2)
      }, this.config.intentPrediction.mouseMovement.hoverDelay)
    }
    document.addEventListener('mouseover', this._mouseHandler, { passive: true })
  }

  initDwellTimeTracker() {
    if (!this.config.intentPrediction.enabled) return

    setInterval(() => {
      this.dwellTime = Date.now() - this.pageLoadTime
      const { shortThreshold, longThreshold, shortBehavior, longBehavior } =
        this.config.intentPrediction.dwellTime

      if (this.dwellTime > longThreshold) {
        this.executeStrategy(longBehavior)
      } else if (this.dwellTime > shortThreshold && this.dwellTime < longThreshold) {
        // 中等停留时间，不执行特殊策略
      }
    }, 5000)
  }

  executeStrategy(strategy) {
    switch (strategy) {
      case 'preload-more':
        this.preloadNextResources(3)
        break
      case 'preload-details':
        this.preloadCurrentContentDetails()
        break
      case 'preload-next':
        this.preloadNextPage()
        break
      case 'preload-related':
        this.preloadRelatedContent()
        break
    }
  }

  schedulePreload(url, reason, priority) {
    if (this.activePreloads >= this.config.priorityScheduling.maxConcurrent) {
      this.preloadQueue.push({ url, reason, priority })
      this.preloadQueue.sort((a, b) => a.priority - b.priority)
      return
    }

    this.executePreload(url, reason)
  }

  async executePreload(url, reason) {
    this.activePreloads++
    try {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = url
      link.dataset.preloadReason = reason
      document.head.appendChild(link)
    } finally {
      this.activePreloads--
      this.processQueue()
    }
  }

  processQueue() {
    while (
      this.preloadQueue.length > 0 &&
      this.activePreloads < this.config.priorityScheduling.maxConcurrent
    ) {
      const item = this.preloadQueue.shift()
      this.executePreload(item.url, item.reason)
    }
  }

  preloadNextResources(count) {
    // 预加载视口下方的图片
    const viewportHeight = window.innerHeight
    const images = document.querySelectorAll('img[data-src], img[src]')
    let preloaded = 0

    for (const img of images) {
      if (preloaded >= count) break

      const rect = img.getBoundingClientRect()
      // 只预加载视口下方 500px 范围内的图片
      if (rect.top > viewportHeight && rect.top < viewportHeight + 500) {
        const url = img.dataset.src || img.src
        if (url && !url.startsWith('data:')) {
          this.schedulePreload(url, 'scroll-predict', 1)
          preloaded++
        }
      }
    }
  }

  preloadCurrentContentDetails() {
    // 预加载当前文章的相关图片和资源
    const article = document.querySelector('article, .article, .post-content, .entry-content')
    if (!article) return

    // 预加载文章内的图片
    const images = article.querySelectorAll('img[data-src], img[src]')
    images.forEach((img) => {
      const url = img.dataset.src || img.src
      if (url && !url.startsWith('data:')) {
        this.schedulePreload(url, 'content-detail', 2)
      }
    })

    // 预加载相关链接
    const links = article.querySelectorAll('a[href]')
    links.forEach((link) => {
      if (link.hostname === location.hostname) {
        this.schedulePreload(link.href, 'related-link', 3)
      }
    })
  }

  preloadNextPage() {
    // 预加载下一页（分页场景）
    const nextLink = document.querySelector('a[rel="next"], .next-page, .pagination .next a')
    if (nextLink) {
      this.schedulePreload(nextLink.href, 'next-page', 1)
    }
  }

  preloadRelatedContent() {
    // 预加载相关内容（侧边栏推荐、相关文章等）
    const relatedSections = document.querySelectorAll(
      '.related-posts, .recommended, .similar-articles, aside'
    )

    relatedSections.forEach((section) => {
      const links = section.querySelectorAll('a[href]')
      links.forEach((link) => {
        if (link.hostname === location.hostname) {
          this.schedulePreload(link.href, 'related-content', 2)
        }
      })
    })
  }

  destroy() {
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler)
    }
    if (this._mouseHandler) {
      document.removeEventListener('mouseover', this._mouseHandler)
    }
    this.preloadQueue = []
  }
}
```

### 文件变更

| 文件                                      | 变更                   |
| ----------------------------------------- | ---------------------- |
| `content/modules/resource-accelerator.js` | 新增 SmartPreloadV2 类 |

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG**

在 `adaptiveCompress` 配置之后添加：

```javascript
// 智能预加载 v2
smartPreloadV2: {
  enabled: true,
  pageStructure: {
    enabled: true,
    criticalRegions: {
      aboveFold: true,
      navigation: true,
      mainContent: true,
      sidebar: false,
    },
    contentTypes: {
      article: { patterns: [/article/i, /post/i, /blog/i], preloadImages: 3 },
      ecommerce: { patterns: [/product/i, /item/i, /shop/i], preloadImages: 5 },
      video: { patterns: [/video/i, /watch/i, /player/i], preloadVideo: true },
      gallery: { patterns: [/gallery/i, /album/i, /photo/i], preloadImages: 8 },
    },
  },
  intentPrediction: {
    enabled: true,
    scrollSpeed: {
      fastThreshold: 1000,
      slowThreshold: 200,
      fastBehavior: 'preload-more',
      slowBehavior: 'preload-details',
    },
    dwellTime: {
      shortThreshold: 2000,
      longThreshold: 10000,
      shortBehavior: 'preload-next',
      longBehavior: 'preload-related',
    },
    mouseMovement: {
      enabled: true,
      hoverPreload: true,
      hoverDelay: 300,
    },
  },
  priorityScheduling: {
    enabled: true,
    maxConcurrent: 3,
    priorityQueue: true,
    abortOnNavigate: true,
  },
},
```

**2. 添加类定义（在 AdaptiveCompressor 类之后）**

```javascript
// ========== 智能预加载 v2 ==========
class SmartPreloadV2 {
  // ... 完整类定义见上方
}
```

**3. 添加初始化函数**

```javascript
let _smartPreloadV2 = null

function _initSmartPreloadV2() {
  if (!state.config.smartPreloadV2?.enabled) return
  _smartPreloadV2 = new SmartPreloadV2(state.config.smartPreloadV2)
  _smartPreloadV2.init()
}
```

**4. 在 init() 函数中调用**

在 `_initAdaptiveCompressor()` 之后添加：

```javascript
// 1.18 初始化智能预加载 v2
_initSmartPreloadV2()
```

**5. 在 destroy() 函数中清理**

在 `_adaptiveCompressor?.destroy();` 之后添加：

```javascript
_smartPreloadV2?.destroy()
```

### 验收标准

- [ ] 分析页面结构和内容类型
- [ ] 基于滚动速度预测用户意图
- [ ] 基于停留时间预测用户意图
- [ ] 基于鼠标悬停预加载资源
- [ ] 智能调度预加载优先级
- [ ] 不影响页面性能

### 风险

| 风险         | 影响         | 缓解               |
| ------------ | ------------ | ------------------ |
| 意图预测不准 | 预加载无效   | 多种信号综合判断   |
| 带宽浪费     | 用户流量消耗 | 限制并发数量       |
| 隐私问题     | 记录用户行为 | 仅本地处理，不上报 |

---

## 实施顺序

```
迭代1: 自适应压缩 → 迭代2: 智能预加载
```

**优先级**：迭代 1 > 迭代 2

**理由**：

- 迭代 1（自适应压缩）ROI 最高：直接影响图片加载性能
- 迭代 2（智能预加载）性能提升：减少用户等待时间

---

## 风险评估

| 风险           | 影响         | 缓解措施                |
| -------------- | ------------ | ----------------------- |
| 压缩策略不准   | 图片质量下降 | 用户可手动覆盖          |
| 预加载浪费带宽 | 用户流量消耗 | 限制并发数量            |
| 性能开销       | 影响页面加载 | 缓存检测结果 + 异步处理 |

---

## 测试策略

### 迭代 1 测试用例

| 测试场景                 | 预期结果                                 |
| ------------------------ | ---------------------------------------- |
| 上传摄影图片             | 使用 photo 策略压缩（quality=0.82）      |
| 上传图标图片             | 使用 icon 策略压缩（quality=0.95）       |
| 上传截图图片             | 使用 screenshot 策略压缩（quality=0.78） |
| 上传大尺寸图片（>500KB） | 降低质量并缩小尺寸                       |
| 上传小尺寸图片（<50KB）  | 提高质量                                 |
| 网络状况为 fast          | 质量乘以 1.1                             |
| 网络状况为 slow          | 质量乘以 0.7                             |
| 关闭自适应压缩           | 使用默认压缩参数                         |

### 迭代 2 测试用例

| 测试场景            | 预期结果           |
| ------------------- | ------------------ |
| 快速滚动页面        | 预加载更多下方资源 |
| 慢速滚动页面        | 预加载当前内容详情 |
| 悬停在链接上 300ms  | 预加载链接目标     |
| 停留时间 > 10s      | 预加载相关内容     |
| 页面有分页          | 预加载下一页       |
| 并发预加载超过 3 个 | 排队等待           |
| 关闭智能预加载      | 不执行任何预加载   |

### 测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- --grep "AdaptiveCompressor"
npm test -- --grep "SmartPreloadV2"
```

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 |
| ----------------------------------------- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    |

---

## 与 v14 的关系

v14 完成了性能监控、优先级优化、内存优化。v15 在此基础上：

| v14 基础设施 | v15 扩展             |
| ------------ | -------------------- |
| 固定压缩策略 | 扩展为自适应压缩策略 |
| 简单预加载   | 扩展为智能预加载调度 |

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
