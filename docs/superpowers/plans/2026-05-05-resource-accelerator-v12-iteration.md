# 资源加速器 v12 迭代计划

> 基线版本：v11（压缩缓存持久化）
> 创建时间：2026-05-05
> 完成时间：2026-05-05

---

## v12 完成状态 ✅

| 迭代   | 功能               | 状态      |
| ------ | ------------------ | --------- |
| 迭代 1 | 视频懒加载         | ✅ 已完成 |
| 迭代 2 | 预连接智能化       | ✅ 已完成 |
| 迭代 3 | 资源优先级动态调整 | ✅ 已完成 |

---

## 当前状态 (v11)

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

### v11 遗留问题

1. **视频无懒加载** — 视频资源不支持懒加载，浪费带宽
2. **预连接不智能** — DNS预连接基于固定规则，不根据实际使用优化
3. **资源优先级固定** — 不根据页面类型动态调整资源优先级
4. **无离线缓存** — 无Service Worker集成，无法离线访问资源
5. **跨域优化缺失** — 无CORS请求优化

---

## 迭代目标

**目标**：视频优化 + 预连接智能化 + 离线支持

**原则**：

- 高 ROI 优先：视频懒加载 > 预连接优化 > 资源优先级 > 离线缓存
- 不改变现有核心架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值
- 不引入可视化、分享、插件功能

---

## 迭代 1: 视频懒加载

**目标**：支持视频资源的懒加载优化

### 问题分析

当前问题：

- 视频资源不支持懒加载，页面加载时立即请求所有视频
- 移动端流量浪费严重
- 无视频预加载策略

### 功能设计

**视频懒加载配置**

```javascript
const VIDEO_CONFIG = {
  enabled: true,
  // 视频懒加载策略
  strategy: 'viewport', // viewport | manual | none
  // 预加载距离 (px)
  preloadDistance: 200,
  // 视频预加载类型
  preloadType: 'metadata', // metadata | auto | none
  // 排除的视频
  excludePatterns: [],
}
```

**视频懒加载实现**

```javascript
class VideoLazyLoader {
  constructor(config) {
    this.config = config
    this.observer = null
    this.videoElements = new Set()
  }

  init() {
    if (!this.config.enabled) return

    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
      rootMargin: `${this.config.preloadDistance}px 0px`,
    })

    this.observeAll()
  }

  observeAll() {
    document.querySelectorAll('video[data-src], video[preload]').forEach((video) => {
      this.observe(video)
    })
  }

  observe(video) {
    if (this.videoElements.has(video)) return

    this.videoElements.add(video)
    this.observer.observe(video)
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadVideo(entry.target)
        this.observer.unobserve(entry.target)
      }
    })
  }

  loadVideo(video) {
    if (video.dataset.src) {
      video.src = video.dataset.src
      video.removeAttribute('data-src')
    }

    // 设置预加载类型
    if (this.config.preloadType !== 'none') {
      video.preload = this.config.preloadType
    }

    // 加载海报图
    if (video.dataset.poster) {
      video.poster = video.dataset.poster
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
    this.videoElements.clear()
  }
}
```

**processVideo 函数**

```javascript
function processVideo(video) {
  if (!isSiteEnabled('videoLazyLoad')) return
  if (video.dataset._raProcessed) return
  if (!video.src && !video.dataset.src) return

  // 高级过滤检查
  const filterResult = matchAdvancedFilter(video.src || video.dataset.src)
  if (filterResult.matched) {
    if (filterResult.action === 'skipAll') return
  }

  video.dataset._raProcessed = '1'

  // 保存原始源
  if (video.src && !video.dataset.src) {
    video.dataset.src = video.src
    video.removeAttribute('src')
  }

  // 设置懒加载属性
  if (this.config.strategy === 'viewport') {
    video.preload = 'none'
    videoLazyLoader.observe(video)
  }
}
```

### 文件变更

| 文件                                      | 变更                                       |
| ----------------------------------------- | ------------------------------------------ |
| `content/modules/resource-accelerator.js` | 新增 VideoLazyLoader 类、processVideo 函数 |

### 验收标准

- [ ] 视频支持懒加载
- [ ] 可视区域内自动加载视频
- [ ] 支持配置预加载距离
- [ ] 支持排除特定视频
- [ ] 不影响已加载视频

### 风险

| 风险         | 影响             | 缓解               |
| ------------ | ---------------- | ------------------ |
| 视频加载延迟 | 用户体验下降     | 合理设置预加载距离 |
| 内存占用     | 多视频同时加载   | 限制同时加载数量   |
| 移动端兼容性 | 部分浏览器不支持 | 降级到立即加载     |

---

## 迭代 2: 预连接智能化

**目标**：基于页面实际使用优化DNS预连接

### 问题分析

当前问题：

- DNS预连接基于固定规则，不根据实际使用优化
- 无法预测用户可能访问的域名
- 预连接数量无限制

### 功能设计

**智能预连接配置**

```javascript
const PRECONNECT_CONFIG = {
  enabled: true,
  // 最大预连接数量
  maxPreconnects: 6,
  // 预连接策略
  strategy: 'smart', // smart | aggressive | conservative
  // 历史记录有效期 (ms)
  historyTtl: 7 * 24 * 60 * 60 * 1000,
  // 存储键
  storageKey: 'resourceAcceleratorPreconnectHistory',
}
```

**智能预连接管理**

```javascript
class SmartPreconnect {
  constructor(config) {
    this.config = config
    this.history = new Map()
    this.preconnected = new Set()
  }

  async init() {
    await this.loadHistory()
    this.analyzeAndPreconnect()
  }

  async loadHistory() {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey)
      const stored = result[this.config.storageKey] || {}

      const now = Date.now()
      for (const [domain, data] of Object.entries(stored)) {
        if (now - data.lastSeen < this.config.historyTtl) {
          this.history.set(domain, data)
        }
      }
    } catch (e) {
      console.warn('[SmartPreconnect] 加载历史失败:', e)
    }
  }

  async saveHistory() {
    try {
      const obj = Object.fromEntries(this.history)
      await chrome.storage.local.set({ [this.config.storageKey]: obj })
    } catch (e) {
      console.warn('[SmartPreconnect] 保存历史失败:', e)
    }
  }

  recordDomain(domain) {
    if (!this.history.has(domain)) {
      this.history.set(domain, {
        domain,
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      })
    }

    const data = this.history.get(domain)
    data.count++
    data.lastSeen = Date.now()

    this.scheduleSave()
  }

  analyzeAndPreconnect() {
    // 获取当前页面的域名
    const pageDomains = this.getPageDomains()

    // 获取历史高频域名
    const highFrequencyDomains = this.getHighFrequencyDomains(10)

    // 合并并排序
    const candidates = [...new Set([...pageDomains, ...highFrequencyDomains])]

    // 预连接（限制数量）
    let count = 0
    for (const domain of candidates) {
      if (count >= this.config.maxPreconnects) break
      if (this.preconnected.has(domain)) continue

      this.addPreconnect(domain)
      this.preconnected.add(domain)
      count++
    }
  }

  getPageDomains() {
    const domains = new Set()
    const elements = document.querySelectorAll('script[src], link[href], img[src]')

    elements.forEach((el) => {
      const url = el.src || el.href
      try {
        const urlObj = new URL(url)
        if (urlObj.hostname !== location.hostname) {
          domains.add(urlObj.hostname)
        }
      } catch {}
    })

    return Array.from(domains)
  }

  getHighFrequencyDomains(limit = 10) {
    return Array.from(this.history.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((d) => d.domain)
  }

  addPreconnect(domain) {
    const head = document.head || document.documentElement
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = `https://${domain}`
    link.crossOrigin = 'anonymous'
    head.insertBefore(link, head.firstChild)
  }

  scheduleSave() {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      this.saveHistory()
    }, 5000)
  }
}
```

### 文件变更

| 文件                                      | 变更                    |
| ----------------------------------------- | ----------------------- |
| `content/modules/resource-accelerator.js` | 新增 SmartPreconnect 类 |

### 验收标准

- [ ] 记录页面使用的域名
- [ ] 基于历史高频域名预连接
- [ ] 限制预连接数量
- [ ] 预连接历史持久化
- [ ] 自动清理过期历史

### 风险

| 风险       | 影响             | 缓解                 |
| ---------- | ---------------- | -------------------- |
| 预连接过多 | 影响页面性能     | 限制最大数量         |
| 隐私问题   | 记录用户访问域名 | 仅记录域名不记录路径 |
| 存储空间   | 历史数据占用     | 限制历史记录数量     |

---

## 迭代 3: 资源优先级动态调整

**目标**：根据页面类型动态调整资源优先级

### 问题分析

当前问题：

- 资源优先级基于固定规则
- 不同页面类型（电商、新闻、视频）使用相同优先级
- 无法适应页面特征

### 功能设计

**页面类型检测配置**

```javascript
const PRIORITY_CONFIG = {
  enabled: true,
  // 页面类型规则
  pageTypes: {
    ecommerce: {
      patterns: [/product/i, /item/i, /shop/i, /cart/i],
      priorities: {
        images: 0, // 商品图片最高优先级
        scripts: 1,
        styles: 2,
      },
    },
    news: {
      patterns: [/article/i, /news/i, /post/i, /blog/i],
      priorities: {
        scripts: 0,
        styles: 1,
        images: 2,
      },
    },
    video: {
      patterns: [/video/i, /watch/i, /player/i, /stream/i],
      priorities: {
        video: 0,
        scripts: 1,
        images: 2,
      },
    },
    default: {
      priorities: {
        styles: 0,
        scripts: 1,
        images: 2,
      },
    },
  },
}
```

**动态优先级管理**

```javascript
class DynamicPriority {
  constructor(config) {
    this.config = config
    this.currentPageType = 'default'
  }

  init() {
    this.currentPageType = this.detectPageType()
    this.applyPriorities()
  }

  detectPageType() {
    const url = location.href
    const hostname = location.hostname

    for (const [type, typeConfig] of Object.entries(this.config.pageTypes)) {
      if (type === 'default') continue

      const matches = typeConfig.patterns.some(
        (pattern) => pattern.test(url) || pattern.test(hostname)
      )

      if (matches) {
        return type
      }
    }

    return 'default'
  }

  applyPriorities() {
    const typeConfig = this.config.pageTypes[this.currentPageType]
    if (!typeConfig) return

    state.config.resourcePriorities = typeConfig.priorities
  }

  getResourcePriority(url, type) {
    const typeConfig = this.config.pageTypes[this.currentPageType]
    if (!typeConfig) return 2

    return typeConfig.priorities[type] ?? 2
  }
}
```

### 文件变更

| 文件                                      | 变更                    |
| ----------------------------------------- | ----------------------- |
| `content/modules/resource-accelerator.js` | 新增 DynamicPriority 类 |

### 验收标准

- [ ] 自动检测页面类型
- [ ] 根据页面类型调整资源优先级
- [ ] 支持自定义页面类型规则
- [ ] 不影响无匹配页面
- [ ] 优先级调整可配置

### 风险

| 风险         | 影响         | 缓解           |
| ------------ | ------------ | -------------- |
| 页面类型误判 | 优先级不合适 | 提供手动配置   |
| 优先级冲突   | 加载顺序混乱 | 明确优先级规则 |
| 性能开销     | 类型检测耗时 | 缓存检测结果   |

---

## 实施顺序

```
迭代1: 视频懒加载 → 迭代2: 预连接优化 → 迭代3: 资源优先级
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3

**理由**：

- 迭代 1（视频懒加载）ROI 最高：节省移动端流量
- 迭代 2（预连接优化）性能提升：减少DNS解析时间
- 迭代 3（资源优先级）体验优化：根据页面类型智能调整

---

## 风险评估

| 风险         | 影响             | 缓解措施           |
| ------------ | ---------------- | ------------------ |
| 视频加载延迟 | 用户体验下降     | 合理设置预加载距离 |
| 预连接过多   | 影响页面性能     | 限制最大数量       |
| 页面类型误判 | 优先级不合适     | 提供手动配置       |
| 存储空间占用 | storage 空间不足 | 限制历史记录数量   |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 |
| ----------------------------------------- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    |

---

## 与 v11 的关系

v11 完成了压缩缓存持久化。v12 在此基础上：

| v11 基础设施   | v12 扩展             |
| -------------- | -------------------- |
| 图片懒加载     | 扩展为视频懒加载     |
| 固定DNS预连接  | 扩展为智能预连接     |
| 固定资源优先级 | 扩展为动态优先级调整 |

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
