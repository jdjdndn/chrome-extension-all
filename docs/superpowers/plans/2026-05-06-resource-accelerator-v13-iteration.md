# 资源加速器 v13 迭代计划

> 基线版本：v12（视频懒加载 + 智能预连接 + 动态资源优先级）
> 创建时间：2026-05-06

---

## v13 进行状态

| 迭代   | 功能                    | 状态      |
| ------ | ----------------------- | --------- |
| 迭代 1 | Service Worker 离线缓存 | ✅ 已完成 |
| 迭代 2 | CORS 请求优化           | ✅ 已完成 |
| 迭代 3 | 资源预加载智能决策      | ✅ 已完成 |

---

## 当前状态 (v12)

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

### v12 遗留问题

1. **无离线缓存** — 无Service Worker集成，无法离线访问资源
2. **跨域优化缺失** — 无CORS请求优化
3. **预加载决策简单** — 无基于用户行为的预加载预测

---

## 迭代目标

**目标**：离线支持 + 跨域优化 + 智能预加载

**原则**：

- 高 ROI 优先：离线缓存 > CORS优化 > 智能预加载
- 不改变现有核心架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值
- 不引入可视化、分享、插件功能

---

## 迭代 1: Service Worker 离线缓存

**目标**：支持资源的离线缓存，提升弱网和离线场景体验

### 问题分析

当前问题：

- 无离线缓存能力，网络中断时无法访问已访问过的资源
- 弱网环境下资源加载缓慢
- 无资源预缓存机制

### 功能设计

**离线缓存配置**

```javascript
const OFFLINE_CACHE_CONFIG = {
  enabled: true,
  // 缓存策略
  strategy: 'stale-while-revalidate', // cache-first | network-first | stale-while-revalidate
  // 缓存大小限制 (MB)
  maxCacheSize: 50,
  // 缓存过期时间 (ms)
  cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7天
  // 预缓存资源类型
  precacheTypes: ['css', 'js', 'fonts'],
  // 缓存排除域名
  excludeDomains: ['localhost'],
  // 缓存排除URL模式
  excludePatterns: [/\/api\//i, /\/admin\//i],
}
```

**Service Worker 实现**

```javascript
// sw.js - Service Worker 文件
const CACHE_NAME = 'resource-accelerator-v1'
const OFFLINE_CACHE_KEY = 'offlineCacheConfig'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 预缓存关键资源
      return cache.addAll([
        // 核心资源由 content script 注入
      ])
    })
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 检查是否在排除列表
  if (shouldExclude(url)) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // 缓存成功的响应
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone)
            })
          }
          return response
        })
        .catch(() => {
          // 网络失败时返回缓存
          return cached
        })

      // stale-while-revalidate 策略
      return cached || fetchPromise
    })
  )
})
```

**离线缓存管理类**

```javascript
class OfflineCacheManager {
  constructor(config) {
    this.config = config
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
    }
  }

  async init() {
    if (!this.config.enabled) return

    // 注册 Service Worker
    await this.registerServiceWorker()

    // 加载缓存配置
    await this.loadCacheConfig()

    // 设置消息监听
    this.setupMessageListener()
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log(`${LOG_PREFIX} [OfflineCache] Service Worker 注册成功`)
        this.swRegistration = registration
      } catch (error) {
        console.warn(`${LOG_PREFIX} [OfflineCache] Service Worker 注册失败:`, error)
      }
    }
  }

  async loadCacheConfig() {
    try {
      const result = await chrome.storage.local.get(OFFLINE_CACHE_KEY)
      this.cacheConfig = result[OFFLINE_CACHE_KEY] || this.config
    } catch (e) {
      this.cacheConfig = this.config
    }
  }

  async updateCacheConfig(config) {
    this.cacheConfig = config
    try {
      await chrome.storage.local.set({ [OFFLINE_CACHE_KEY]: config })
      // 通知 Service Worker 更新配置
      this.postMessage({ type: 'UPDATE_CONFIG', config })
    } catch (e) {
      console.warn(`${LOG_PREFIX} [OfflineCache] 保存配置失败:`, e)
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CACHE_STATS') {
        sendResponse(this.cacheStats)
      }
    })
  }

  postMessage(message) {
    if (this.swRegistration && this.swRegistration.active) {
      this.swRegistration.active.postMessage(message)
    }
  }

  async getCacheSize() {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME)
      const keys = await cache.keys()
      return keys.length
    }
    return 0
  }

  async clearCache() {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME)
      this.cacheStats = { hits: 0, misses: 0, size: 0 }
    }
  }
}
```

### 文件变更

| 文件                                      | 变更                        |
| ----------------------------------------- | --------------------------- |
| `content/modules/resource-accelerator.js` | 新增 OfflineCacheManager 类 |
| `sw.js`                                   | 新增 Service Worker 文件    |
| `manifest.json`                           | 添加 Service Worker 配置    |

### 验收标准

- [ ] Service Worker 正常注册
- [ ] 静态资源可离线访问
- [ ] 缓存大小可配置和限制
- [ ] 缓存过期自动清理
- [ ] 支持预缓存关键资源
- [ ] 不影响动态内容加载

### 风险

| 风险                    | 影响         | 缓解             |
| ----------------------- | ------------ | ---------------- |
| 缓存污染                | 显示旧内容   | 版本化缓存名称   |
| 存储空间占用            | 设备存储不足 | 限制缓存大小     |
| Service Worker 生命周期 | 注册失败     | 降级到无缓存模式 |

---

## 迭代 2: CORS 请求优化

**目标**：优化跨域请求，减少 CORS 预检开销

### 问题分析

当前问题：

- 频繁的 CORS 预检请求增加延迟
- 跨域资源加载无优化
- 无跨域请求合并

### 功能设计

**CORS 优化配置**

```javascript
const CORS_CONFIG = {
  enabled: true,
  // 预检缓存时间 (ms)
  preflightCacheTtl: 5 * 60 * 1000, // 5分钟
  // 允许的源
  allowedOrigins: ['*'],
  // 允许的头
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // 允许的方法
  allowedMethods: ['GET', 'POST', 'HEAD'],
  // 是否启用请求合并
  enableBatching: true,
  // 批量请求最大数量
  maxBatchSize: 10,
}
```

**CORS 优化管理**

```javascript
class CorsOptimizer {
  constructor(config) {
    this.config = config
    this.preflightCache = new Map()
    this.batchQueue = []
    this.batchTimer = null
  }

  init() {
    if (!this.config.enabled) return

    // 拦截 fetch 请求
    this.interceptFetch()

    // 拦截 XMLHttpRequest
    this.interceptXHR()

    // 设置预检缓存清理
    this.setupCacheCleanup()
  }

  interceptFetch() {
    const originalFetch = window.fetch
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url

      // 检查是否需要预检
      if (this.needsPreflight(init)) {
        // 检查预检缓存
        const cached = this.getCachedPreflight(url)
        if (cached) {
          // 使用缓存的预检结果
          init.headers = { ...init.headers, ...cached.headers }
        }
      }

      // 批量请求优化
      if (this.config.enableBatching && this.canBatch(init)) {
        return this.addToBatch(url, init)
      }

      return originalFetch(input, init)
    }
  }

  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      this._raMethod = method
      this._raUrl = url
      this._raHeaders = {}
      return originalOpen.call(this, method, url, ...args)
    }

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      this._raHeaders[name] = value
      return originalSetRequestHeader.call(this, name, value)
    }
  }

  needsPreflight(init) {
    const method = (init.method || 'GET').toUpperCase()

    // 简单请求不需要预检
    if (['GET', 'POST', 'HEAD'].includes(method)) {
      const headers = init.headers || {}
      const customHeaders = Object.keys(headers).filter(
        (name) =>
          !['accept', 'accept-language', 'content-language', 'content-type'].includes(
            name.toLowerCase()
          )
      )

      if (customHeaders.length === 0) {
        return false
      }
    }

    return true
  }

  getCachedPreflight(url) {
    const cached = this.preflightCache.get(url)
    if (cached && Date.now() - cached.timestamp < this.config.preflightCacheTtl) {
      return cached
    }
    this.preflightCache.delete(url)
    return null
  }

  cachePreflight(url, headers) {
    this.preflightCache.set(url, {
      headers,
      timestamp: Date.now(),
    })
  }

  canBatch(init) {
    const method = (init.method || 'GET').toUpperCase()
    return method === 'GET' && !init.body
  }

  addToBatch(url, init) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ url, init, resolve, reject })

      if (this.batchQueue.length >= this.config.maxBatchSize) {
        this.flushBatch()
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.flushBatch(), 100)
      }
    })
  }

  async flushBatch() {
    if (this.batchQueue.length === 0) return

    const batch = [...this.batchQueue]
    this.batchQueue = []
    this.batchTimer = null

    // 执行批量请求
    const promises = batch.map(({ url, init }) => fetch(url, init))
    const results = await Promise.allSettled(promises)

    // 分发结果
    results.forEach((result, index) => {
      const { resolve, reject } = batch[index]
      if (result.status === 'fulfilled') {
        resolve(result.value)
      } else {
        reject(result.reason)
      }
    })
  }

  setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now()
      for (const [url, cached] of this.preflightCache.entries()) {
        if (now - cached.timestamp > this.config.preflightCacheTtl) {
          this.preflightCache.delete(url)
        }
      }
    }, 60000)
  }
}
```

### 文件变更

| 文件                                      | 变更                  |
| ----------------------------------------- | --------------------- |
| `content/modules/resource-accelerator.js` | 新增 CorsOptimizer 类 |

### 验收标准

- [ ] 预检请求结果可缓存
- [ ] 简单请求不触发预检
- [ ] 支持 GET 请求批量合并
- [ ] 批量请求有数量限制
- [ ] 缓存自动过期清理
- [ ] 不影响跨域安全性

### 风险

| 风险           | 影响      | 缓解               |
| -------------- | --------- | ------------------ |
| 预检缓存不一致 | 请求失败  | 合理设置缓存时间   |
| 批量请求延迟   | 响应变慢  | 限制批量等待时间   |
| 安全策略冲突   | CORS 错误 | 遵循浏览器安全策略 |

---

## 迭代 3: 资源预加载智能决策

**目标**：基于用户行为预测，智能决定是否预加载资源

### 问题分析

当前问题：

- 预加载基于固定规则，不考虑用户行为
- 无法预测用户可能访问的页面
- 预加载资源可能浪费带宽

### 功能设计

**智能预加载配置**

```javascript
const SMART_PRELOAD_CONFIG = {
  enabled: true,
  // 预加载策略
  strategy: 'predictive', // predictive | aggressive | conservative
  // 最大预加载数量
  maxPreloads: 5,
  // 预加载距离 (px)
  preloadDistance: 300,
  // 用户行为分析
  behaviorAnalysis: {
    enabled: true,
    historySize: 100, // 记录最近100次访问
    patternDetection: true, // 启用模式检测
  },
  // 排除模式
  excludePatterns: [/\/api\//i, /\/admin\//i],
}
```

**用户行为分析**

```javascript
class UserBehaviorAnalyzer {
  constructor(config) {
    this.config = config
    this.history = []
    this.patterns = new Map()
  }

  async init() {
    await this.loadHistory()
    this.analyzePatterns()
  }

  async loadHistory() {
    try {
      const result = await chrome.storage.local.get('userBehaviorHistory')
      this.history = result.userBehaviorHistory || []
    } catch (e) {
      this.history = []
    }
  }

  async saveHistory() {
    try {
      // 限制历史大小
      if (this.history.length > this.config.historySize) {
        this.history = this.history.slice(-this.config.historySize)
      }
      await chrome.storage.local.set({ userBehaviorHistory: this.history })
    } catch (e) {
      console.warn(`${LOG_PREFIX} [BehaviorAnalyzer] 保存历史失败:`, e)
    }
  }

  recordVisit(url) {
    const urlObj = new URL(url)
    const entry = {
      url,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      timestamp: Date.now(),
      referrer: document.referrer,
    }

    this.history.push(entry)
    this.updatePatterns(entry)
  }

  updatePatterns(entry) {
    if (!this.config.patternDetection) return

    // 检测导航模式
    const lastVisits = this.history.slice(-5)
    const pattern = lastVisits.map((v) => v.pathname).join(' -> ')

    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, {
        count: 0,
        lastSeen: 0,
        predictions: [],
      })
    }

    const patternData = this.patterns.get(pattern)
    patternData.count++
    patternData.lastSeen = Date.now()
  }

  analyzePatterns() {
    // 分析高频访问路径
    const pathCounts = {}
    this.history.forEach((entry) => {
      pathCounts[entry.pathname] = (pathCounts[entry.pathname] || 0) + 1
    })

    // 识别可能的导航目标
    this.predictions = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))
  }

  getNextLikelyPages(currentUrl) {
    const urlObj = new URL(currentUrl)
    const currentPath = urlObj.pathname

    // 基于历史模式预测
    const predictions = []

    // 检查导航模式
    for (const [pattern, data] of this.patterns.entries()) {
      if (pattern.includes(currentPath)) {
        const parts = pattern.split(' -> ')
        const currentIndex = parts.indexOf(currentPath)
        if (currentIndex >= 0 && currentIndex < parts.length - 1) {
          predictions.push({
            path: parts[currentIndex + 1],
            confidence: data.count / this.history.length,
          })
        }
      }
    }

    // 补充高频访问路径
    this.predictions.forEach((pred) => {
      if (!predictions.find((p) => p.path === pred.path)) {
        predictions.push({
          path: pred.path,
          confidence: (pred.count / this.history.length) * 0.5,
        })
      }
    })

    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, this.config.maxPreloads)
  }
}
```

**智能预加载管理**

```javascript
class SmartPreloader {
  constructor(config, behaviorAnalyzer) {
    this.config = config
    this.behaviorAnalyzer = behaviorAnalyzer
    this.preloaded = new Set()
    this.observer = null
  }

  init() {
    if (!this.config.enabled) return

    // 设置视口感知预加载
    this.setupViewportPreloading()

    // 记录当前页面访问
    this.behaviorAnalyzer.recordVisit(location.href)
  }

  setupViewportPreloading() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.preloadLink(entry.target)
          }
        })
      },
      { rootMargin: `${this.config.preloadDistance}px 0px` }
    )

    // 观察所有链接
    document.querySelectorAll('a[href]').forEach((link) => {
      this.observer.observe(link)
    })
  }

  preloadLink(link) {
    const href = link.href
    if (!href || this.preloaded.has(href)) return

    // 检查排除模式
    if (this.shouldExclude(href)) return

    // 检查是否是同源链接
    const urlObj = new URL(href)
    if (urlObj.hostname !== location.hostname) return

    // 创建预加载提示
    this.addPreloadHint(href)
    this.preloaded.add(href)
  }

  addPreloadHint(href) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    link.as = 'document'
    document.head.appendChild(link)
  }

  preloadPredictedPages() {
    const predictions = this.behaviorAnalyzer.getNextLikelyPages(location.href)

    predictions.forEach((pred) => {
      const href = `${location.origin}${pred.path}`
      if (!this.preloaded.has(href)) {
        this.addPreloadHint(href)
        this.preloaded.add(href)
      }
    })
  }

  shouldExclude(href) {
    return this.config.excludePatterns.some((pattern) => pattern.test(href))
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}
```

### 文件变更

| 文件                                      | 变更                                           |
| ----------------------------------------- | ---------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 UserBehaviorAnalyzer 和 SmartPreloader 类 |

### 验收标准

- [ ] 记录用户访问历史
- [ ] 识别导航模式
- [ ] 预测可能访问的页面
- [ ] 智能预加载预测页面
- [ ] 支持视口感知预加载
- [ ] 不浪费带宽

### 风险

| 风险     | 影响         | 缓解                 |
| -------- | ------------ | -------------------- |
| 隐私问题 | 记录用户行为 | 仅记录路径不记录内容 |
| 预测不准 | 浪费带宽     | 限制预加载数量       |
| 存储空间 | 历史数据占用 | 限制历史大小         |

---

## 实施顺序

```
迭代1: 离线缓存 → 迭代2: CORS优化 → 迭代3: 智能预加载
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3

**理由**：

- 迭代 1（离线缓存）ROI 最高：弱网和离线场景体验提升
- 迭代 2（CORS优化）性能提升：减少跨域请求延迟
- 迭代 3（智能预加载）体验优化：预测用户行为

---

## 风险评估

| 风险                    | 影响         | 缓解措施             |
| ----------------------- | ------------ | -------------------- |
| Service Worker 注册失败 | 无离线缓存   | 降级到无缓存模式     |
| 预检缓存不一致          | 跨域请求失败 | 合理设置缓存时间     |
| 用户行为记录            | 隐私问题     | 仅记录路径不记录内容 |
| 存储空间占用            | 设备存储不足 | 限制缓存和历史大小   |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 |
| ----------------------------------------- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    |
| `sw.js`                                   | ✅    | -     | -     |
| `manifest.json`                           | ✅    | -     | -     |

---

## 与 v12 的关系

v12 完成了视频懒加载、智能预连接、动态资源优先级。v13 在此基础上：

| v12 基础设施   | v13 扩展                     |
| -------------- | ---------------------------- |
| 无离线缓存     | 新增 Service Worker 离线缓存 |
| 无跨域优化     | 新增 CORS 预检缓存和请求合并 |
| 简单预加载规则 | 扩展为用户行为预测预加载     |

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
