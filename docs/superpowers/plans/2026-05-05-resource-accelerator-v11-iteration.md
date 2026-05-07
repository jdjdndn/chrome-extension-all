# 资源加速器 v11 迭代计划

> 基线版本：v10（资源依赖 + 内存监控 + 视口感知 + 配置热更新）
> 创建时间：2026-05-05
> 完成时间：2026-05-05

---

## v11 完成状态

| 迭代   | 功能           | 状态      |
| ------ | -------------- | --------- |
| 迭代 1 | 性能指标持久化 | 未实现    |
| 迭代 2 | 压缩缓存持久化 | ✅ 已完成 |
| 迭代 3 | 错误日志增强   | 未实现    |
| 迭代 4 | 配置版本管理   | 未实现    |

---

## 当前状态 (v10 → v11 升级)

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
| **压缩缓存持久化** | ✅   | 跨会话复用 + 过期清理 + 大小限制                   |

---

## 迭代 1: 性能指标持久化

**目标**：性能指标跨页面会话持久化，支持长期趋势分析

### 问题分析

当前问题：

- `state.performance` 仅在当前页面有效，刷新后重置
- 无法追踪同一网站的性能趋势
- 性能基线对比需要手动保存

### 功能设计

**性能指标持久化配置**

```javascript
const PERFORMANCE_CONFIG = {
  enabled: true,
  // 持久化存储键
  storageKey: 'resourceAcceleratorPerformanceHistory',
  // 保留历史记录数量
  maxHistorySize: 100,
  // 自动保存间隔 (ms)
  autoSaveInterval: 30000,
  // 指标类型
  metrics: ['ttfb', 'domContentLoaded', 'loadEvent', 'lcp', 'totalResources'],
}
```

**性能历史管理**

```javascript
class PerformanceHistory {
  constructor(config) {
    this.config = config
    this.history = []
    this.saveTimer = null
  }

  async init() {
    await this.loadHistory()
    this.startAutoSave()
  }

  async loadHistory() {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey)
      this.history = result[this.config.storageKey] || []
    } catch (e) {
      console.warn('[PerformanceHistory] 加载历史失败:', e)
    }
  }

  async saveHistory() {
    try {
      // 保留最近 N 条记录
      const trimmed = this.history.slice(-this.config.maxHistorySize)
      await chrome.storage.local.set({ [this.config.storageKey]: trimmed })
    } catch (e) {
      console.warn('[PerformanceHistory] 保存历史失败:', e)
    }
  }

  addRecord(performanceData) {
    if (!performanceData) return

    const record = {
      timestamp: Date.now(),
      url: location.href,
      hostname: location.hostname,
      ...performanceData,
    }

    this.history.push(record)
    this.scheduleSave()
  }

  scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveHistory()
    }, 5000)
  }

  startAutoSave() {
    setInterval(() => {
      this.saveHistory()
    }, this.config.autoSaveInterval)
  }

  // 获取指定域名的性能趋势
  getTrendByHostname(hostname, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return this.history.filter((r) => r.hostname === hostname && r.timestamp > cutoff)
  }

  // 获取全局性能趋势
  getGlobalTrend(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return this.history.filter((r) => r.timestamp > cutoff)
  }

  // 计算性能改善百分比
  calculateImprovement() {
    if (this.history.length < 2) return null

    const recent = this.history.slice(-10)
    const older = this.history.slice(-20, -10)

    if (older.length === 0) return null

    const recentAvg = this.average(recent)
    const olderAvg = this.average(older)

    return {
      ttfb: this.calcPercent(olderAvg.ttfb, recentAvg.ttfb),
      domContentLoaded: this.calcPercent(olderAvg.domContentLoaded, recentAvg.domContentLoaded),
      loadEvent: this.calcPercent(olderAvg.loadEvent, recentAvg.loadEvent),
      lcp: this.calcPercent(olderAvg.lcp, recentAvg.lcp),
    }
  }

  average(records) {
    const sum = { ttfb: 0, domContentLoaded: 0, loadEvent: 0, lcp: 0 }
    let count = 0

    records.forEach((r) => {
      if (r.ttfb) sum.ttfb += r.ttfb
      if (r.domContentLoaded) sum.domContentLoaded += r.domContentLoaded
      if (r.loadEvent) sum.loadEvent += r.loadEvent
      if (r.lcp) sum.lcp += r.lcp
      count++
    })

    return {
      ttfb: sum.ttfb / count,
      domContentLoaded: sum.domContentLoaded / count,
      loadEvent: sum.loadEvent / count,
      lcp: sum.lcp / count,
    }
  }

  calcPercent(oldVal, newVal) {
    if (!oldVal || !newVal) return null
    return Math.round(((oldVal - newVal) / oldVal) * 100)
  }
}
```

### 文件变更

| 文件                                      | 变更                                       |
| ----------------------------------------- | ------------------------------------------ |
| `content/modules/resource-accelerator.js` | 新增 PerformanceHistory 类、性能指标持久化 |

### 验收标准

- [ ] 性能指标自动保存到 storage
- [ ] 支持按域名查询性能趋势
- [ ] 支持全局性能趋势分析
- [ ] 计算性能改善百分比
- [ ] 自动清理过期历史记录

### 风险

| 风险         | 影响             | 缓解             |
| ------------ | ---------------- | ---------------- |
| 存储空间占用 | storage 空间不足 | 限制历史记录数量 |
| 频繁写入性能 | 影响页面性能     | 防抖保存         |
| 数据一致性   | 并发写入冲突     | 使用单一写入源   |

---

## 迭代 2: 压缩缓存持久化

**目标**：压缩结果跨页面会话复用，避免重复压缩

### 问题分析

当前问题：

- 压缩缓存 `_compressCache` 仅在当前页面有效
- 相同图片在不同页面刷新后需重新压缩
- 浪费 CPU 和内存资源

### 功能设计

**缓存持久化配置**

```javascript
const CACHE_CONFIG = {
  enabled: true,
  storageKey: 'resourceAcceleratorCompressCache',
  // 缓存条目最大数量
  maxEntries: 500,
  // 缓存有效期 (ms)
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 天
  // 最大存储空间 (bytes)
  maxStorageSize: 10 * 1024 * 1024, // 10MB
}
```

**缓存管理器**

```javascript
class CompressCacheManager {
  constructor(config) {
    this.config = config
    this.memoryCache = new Map()
    this.storageCache = new Map()
    this.initialized = false
  }

  async init() {
    await this.loadFromStorage()
    this.initialized = true
  }

  async loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey)
      const stored = result[this.config.storageKey] || {}

      // 过滤过期条目
      const now = Date.now()
      for (const [url, entry] of Object.entries(stored)) {
        if (now - entry.timestamp < this.config.ttl) {
          this.storageCache.set(url, entry)
        }
      }

      console.log(`[CompressCache] 从 storage 加载 ${this.storageCache.size} 条缓存`)
    } catch (e) {
      console.warn('[CompressCache] 加载缓存失败:', e)
    }
  }

  async saveToStorage() {
    try {
      const obj = Object.fromEntries(this.storageCache)
      await chrome.storage.local.set({ [this.config.storageKey]: obj })
    } catch (e) {
      console.warn('[CompressCache] 保存缓存失败:', e)
    }
  }

  get(url) {
    // 优先从内存缓存获取
    if (this.memoryCache.has(url)) {
      return this.memoryCache.get(url)
    }

    // 从 storage 缓存获取
    if (this.storageCache.has(url)) {
      const entry = this.storageCache.get(url)
      // 恢复到内存缓存
      this.memoryCache.set(url, entry)
      return entry
    }

    return null
  }

  set(url, result) {
    const entry = {
      url,
      result,
      timestamp: Date.now(),
      blobUrl: result,
    }

    this.memoryCache.set(url, entry)
    this.storageCache.set(url, entry)

    // 检查缓存大小限制
    this.enforceLimits()
  }

  enforceLimits() {
    if (this.storageCache.size > this.config.maxEntries) {
      // 删除最旧的条目
      const entries = Array.from(this.storageCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toDelete = entries.slice(0, Math.floor(entries.length * 0.2))
      toDelete.forEach(([url]) => {
        this.storageCache.delete(url)
        this.memoryCache.delete(url)
      })
    }
  }

  clear() {
    this.memoryCache.clear()
    this.storageCache.clear()
    chrome.storage.local.remove(this.config.storageKey)
  }
}
```

### 文件变更

| 文件                                      | 变更                                     |
| ----------------------------------------- | ---------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 CompressCacheManager 类、缓存持久化 |

### 验收标准

- [ ] 压缩结果自动保存到 storage
- [ ] 页面刷新后复用压缩缓存
- [ ] 缓存过期自动清理
- [ ] 缓存大小限制
- [ ] 支持手动清空缓存

### 风险

| 风险             | 影响         | 缓解                |
| ---------------- | ------------ | ------------------- |
| storage 空间限制 | 缓存不完整   | 限制缓存数量和大小  |
| Blob URL 失效    | 缓存无法使用 | 定期验证缓存有效性  |
| 数据一致性       | 缓存冲突     | 使用 URL 作为唯一键 |

---

## 迭代 3: 错误日志增强

**目标**：错误日志详细分类和统计，便于问题定位

### 问题分析

当前问题：

- 错误日志无详细分类，难以快速定位问题
- 无错误统计，无法发现高频错误
- 错误关联性分析缺失

### 功能设计

**错误分类配置**

```javascript
const ERROR_CONFIG = {
  enabled: true,
  // 错误分类
  categories: {
    network: ['fetch', 'timeout', 'cors', 'dns'],
    resource: ['404', '500', '502', '503', '504'],
    script: ['syntax', 'reference', 'type', 'undefined'],
    memory: ['quota', 'overflow'],
    cdn: ['circuit-open', 'fallback-failed'],
  },
  // 错误统计
  stats: {
    enabled: true,
    topN: 10,
    timeWindow: 60 * 60 * 1000, // 1 小时
  },
}
```

**错误分析器**

```javascript
class ErrorAnalyzer {
  constructor(config) {
    this.config = config
    this.errorStats = new Map()
    this.errorPatterns = new Map()
  }

  categorizeError(error) {
    const { message, stack, type } = error

    // 网络错误
    if (message.includes('fetch') || message.includes('timeout') || message.includes('cors')) {
      return 'network'
    }

    // 资源错误
    if (message.includes('404') || message.includes('500') || message.includes('502')) {
      return 'resource'
    }

    // 脚本错误
    if (stack && (stack.includes('SyntaxError') || stack.includes('ReferenceError'))) {
      return 'script'
    }

    // 内存错误
    if (message.includes('quota') || message.includes('memory')) {
      return 'memory'
    }

    return 'unknown'
  }

  recordError(error) {
    const category = this.categorizeError(error)
    const key = `${category}:${error.message}`

    if (!this.errorStats.has(key)) {
      this.errorStats.set(key, {
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        samples: [],
      })
    }

    const stat = this.errorStats.get(key)
    stat.count++
    stat.lastSeen = Date.now()

    // 保留最近 5 个样本
    if (stat.samples.length < 5) {
      stat.samples.push({
        timestamp: Date.now(),
        url: error.url,
        stack: error.stack,
      })
    }

    // 检测错误模式
    this.detectPatterns(key, stat)
  }

  detectPatterns(key, stat) {
    // 高频错误检测
    if (stat.count > 10) {
      this.errorPatterns.set(key, {
        type: 'high-frequency',
        count: stat.count,
        suggestion: '检查是否存在系统性问题',
      })
    }

    // 重复错误检测
    if (stat.samples.length >= 3) {
      const urls = stat.samples.map((s) => s.url)
      if (new Set(urls).size === 1) {
        this.errorPatterns.set(key, {
          type: 'single-source',
          url: urls[0],
          suggestion: '该 URL 可能存在问题',
        })
      }
    }
  }

  getTopErrors(limit = 10) {
    return Array.from(this.errorStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([key, stat]) => ({ key, ...stat }))
  }

  getErrorsByCategory(category) {
    return Array.from(this.errorStats.entries())
      .filter(([key]) => key.startsWith(category + ':'))
      .map(([key, stat]) => ({ key, ...stat }))
  }

  getPatterns() {
    return Array.from(this.errorPatterns.entries()).map(([key, pattern]) => ({ key, ...pattern }))
  }

  clearStats() {
    this.errorStats.clear()
    this.errorPatterns.clear()
  }
}
```

### 文件变更

| 文件                                      | 变更                                  |
| ----------------------------------------- | ------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 ErrorAnalyzer 类、错误分类和统计 |

### 验收标准

- [ ] 错误自动分类（网络/资源/脚本/内存）
- [ ] 错误统计和计数
- [ ] 高频错误检测
- [ ] 错误模式识别
- [ ] 支持按类别查询错误

### 风险

| 风险     | 影响             | 缓解         |
| -------- | ---------------- | ------------ |
| 内存占用 | 错误统计占用内存 | 限制统计数量 |
| 性能开销 | 错误分析耗时     | 异步处理     |
| 误分类   | 错误归类不准确   | 提供手动分类 |

---

## 迭代 4: 配置版本管理

**目标**：配置版本控制和回滚支持

### 问题分析

当前问题：

- 配置修改后无法回滚
- 无配置变更历史
- 多设备配置同步困难

### 功能设计

**版本管理配置**

```javascript
const VERSION_CONFIG = {
  enabled: true,
  storageKey: 'resourceAcceleratorConfigVersions',
  // 保留版本数量
  maxVersions: 20,
  // 自动保存版本的条件
  autoSaveOn: ['import', 'reset', 'major-change'],
}
```

**版本管理器**

```javascript
class ConfigVersionManager {
  constructor(config) {
    this.config = config
    this.versions = []
    this.currentVersion = null
  }

  async init() {
    await this.loadVersions()
  }

  async loadVersions() {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey)
      this.versions = result[this.config.storageKey] || []
      this.currentVersion = this.getVersionHash(state.config)
    } catch (e) {
      console.warn('[ConfigVersion] 加载版本失败:', e)
    }
  }

  async saveVersions() {
    try {
      const trimmed = this.versions.slice(-this.config.maxVersions)
      await chrome.storage.local.set({ [this.config.storageKey]: trimmed })
    } catch (e) {
      console.warn('[ConfigVersion] 保存版本失败:', e)
    }
  }

  getVersionHash(config) {
    return JSON.stringify(config)
  }

  saveVersion(config, description = '') {
    const version = {
      id: Date.now(),
      timestamp: Date.now(),
      description,
      config: { ...config },
      hash: this.getVersionHash(config),
    }

    this.versions.push(version)
    this.currentVersion = version.hash

    this.saveVersions()

    return version
  }

  restoreVersion(versionId) {
    const version = this.versions.find((v) => v.id === versionId)
    if (!version) {
      throw new Error('版本不存在')
    }

    return { ...version.config }
  }

  getVersions() {
    return this.versions.map((v) => ({
      id: v.id,
      timestamp: v.timestamp,
      description: v.description,
      isCurrent: v.hash === this.currentVersion,
    }))
  }

  diffVersions(versionId1, versionId2) {
    const v1 = this.versions.find((v) => v.id === versionId1)
    const v2 = this.versions.find((v) => v.id === versionId2)

    if (!v1 || !v2) return null

    return this.deepDiff(v1.config, v2.config)
  }

  deepDiff(obj1, obj2, path = '') {
    const diffs = []

    for (const key of Object.keys(obj1)) {
      const currentPath = path ? `${path}.${key}` : key

      if (!(key in obj2)) {
        diffs.push({ type: 'removed', path: currentPath, value: obj1[key] })
      } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
        diffs.push(...this.deepDiff(obj1[key], obj2[key], currentPath))
      } else if (obj1[key] !== obj2[key]) {
        diffs.push({ type: 'changed', path: currentPath, oldValue: obj1[key], newValue: obj2[key] })
      }
    }

    for (const key of Object.keys(obj2)) {
      if (!(key in obj1)) {
        const currentPath = path ? `${path}.${key}` : key
        diffs.push({ type: 'added', path: currentPath, value: obj2[key] })
      }
    }

    return diffs
  }
}
```

### 文件变更

| 文件                                      | 变更                                       |
| ----------------------------------------- | ------------------------------------------ |
| `content/modules/resource-accelerator.js` | 新增 ConfigVersionManager 类、配置版本管理 |

### 验收标准

- [ ] 配置修改自动保存版本
- [ ] 支持配置回滚
- [ ] 支持版本对比
- [ ] 支持版本列表查看
- [ ] 限制版本数量

### 风险

| 风险         | 影响             | 缓解           |
| ------------ | ---------------- | -------------- |
| 存储空间占用 | 版本过多         | 限制版本数量   |
| 版本冲突     | 回滚覆盖当前配置 | 回滚前确认     |
| 数据一致性   | 版本保存失败     | 错误处理和重试 |

---

## 实施顺序

```
迭代1: 性能持久化 → 迭代2: 压缩缓存 → 迭代3: 错误分析 → 迭代4: 配置版本
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4

**理由**：

- 迭代 1（性能持久化）ROI 最高：支持长期性能追踪
- 迭代 2（压缩缓存）效率提升：避免重复压缩
- 迭代 3（错误分析）问题定位：提升调试效率
- 迭代 4（配置版本）安全性：支持配置回滚

---

## 风险评估

| 风险             | 影响         | 缓解措施         |
| ---------------- | ------------ | ---------------- |
| storage 空间限制 | 数据不完整   | 限制数据量和大小 |
| 性能开销         | 影响页面性能 | 异步处理和防抖   |
| 数据一致性       | 并发写入冲突 | 使用单一写入源   |
| 版本冲突         | 配置覆盖     | 回滚前确认机制   |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 | 迭代4 |
| ----------------------------------------- | ----- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    | ✅    |

---

## 与 v10 的关系

v10 完成了资源依赖建模、内存监控、视口感知、配置热更新。v11 在此基础上：

| v10 基础设施 | v11 扩展             |
| ------------ | -------------------- |
| 实时性能指标 | 扩展为持久化性能历史 |
| 内存压缩缓存 | 扩展为跨会话缓存     |
| 基础错误日志 | 扩展为错误分类和分析 |
| 配置热更新   | 扩展为版本管理和回滚 |

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
