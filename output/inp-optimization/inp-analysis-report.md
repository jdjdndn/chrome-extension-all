# 资源加速器 INP 问题根因分析报告

## 执行摘要

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| **INP** | **8192ms** | < 200ms | 严重超标 (40倍) |
| LCP | 1.61s | < 2.5s | 良好 |
| CLS | 0.04 | < 0.1 | 良好 |

**核心问题**：资源加速器存在多个严重的主线程阻塞点，导致用户交互响应延迟超过 8 秒。

---

## 问题清单（按影响程度排序）

### P0 - 严重问题（预计贡献 70%+ INP）

#### 1. 多个 MutationObserver 同时监听整个 DOM 树

**问题描述**：6 个模块各自创建独立的 MutationObserver，全部监听 `document.documentElement` 的 `subtree: true`。

**代码位置**：
| 模块 | 文件 | 行号 |
|------|------|------|
| JSReplacer | js-replacer.js | 66-81 |
| FontReplacer | font-replacer.js | 62-83 |
| CSSAccelerator | css-accelerator.js | 65-84 |
| ImageOptimizer | image-optimizer.js | 120-150, 385-398 |
| ResourcePreloader | resource-preloader.js | 126-167 |
| ResourceDeduplicator | resource-deduplicator.js | 66-93 |

**影响分析**：
- 每次 DOM 变化触发 6 个回调
- 每个回调都执行 `querySelectorAll` 遍历子节点
- 页面加载时可能触发数千次回调
- 估算单次 DOM 变化导致的主线程阻塞：10-50ms × 6 = 60-300ms

**预估 INP 改善**：4000-6000ms

**优化建议**：
```javascript
// 方案1：统一 MutationObserver 管理器
class UnifiedDOMWatcher {
  constructor() {
    this.callbacks = new Set()
    this.observer = null
  }

  subscribe(callback) {
    this.callbacks.add(callback)
    if (!this.observer) this._startObserver()
  }

  _startObserver() {
    this.observer = new MutationObserver((mutations) => {
      // 批量处理，避免多次回调
      requestIdleCallback(() => {
        this.callbacks.forEach(cb => cb(mutations))
      })
    })
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }
}
```

---

#### 2. 图片压缩在主线程执行

**问题描述**：`compressImage()` 使用 Canvas API 在主线程进行图片压缩，CPU 密集型操作阻塞主线程。

**代码位置**：`image-optimizer.js:235-286`

**影响分析**：
- Canvas `drawImage()` + `toBlob()` 是同步 CPU 操作
- 一张 1920x1080 图片压缩可能耗时 100-500ms
- 用户滚动触发 `IntersectionObserver` 时执行
- 多张图片同时进入视口时串行处理

**预估 INP 改善**：1500-2500ms

**优化建议**：
```javascript
// 方案：使用 Web Worker 进行图片压缩
// 创建 image-compressor.worker.js
class ImageCompressorWorker {
  async compress(imageData, options) {
    // 在 Worker 中执行 Canvas 压缩
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
    return blob
  }
}
```

---

### P1 - 高优先级问题（预计贡献 20% INP）

#### 3. IntersectionObserver 回调中执行繁重操作

**问题描述**：`_handleIntersection()` 在滚动时触发，可能同步执行图片压缩。

**代码位置**：`image-optimizer.js:90-102`

```javascript
_handleIntersection(entries) {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target
      if (el.tagName === 'VIDEO') {
        this._loadVideo(el)
      } else {
        this.loadImage(el) // 可能触发压缩
      }
      this.observer.unobserve(el)
    }
  })
}
```

**影响分析**：
- 滚动事件是高频触发场景
- 每次触发可能阻塞主线程 100-500ms
- 多个图片同时进入视口时叠加

**预估 INP 改善**：500-1000ms

**优化建议**：
```javascript
// 使用 requestIdleCallback 延迟非紧急操作
_handleIntersection(entries) {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target
      this.observer.unobserve(el)
      
      // 延迟到空闲时处理
      requestIdleCallback(() => {
        if (el.tagName === 'VIDEO') {
          this._loadVideo(el)
        } else {
          this.loadImage(el)
        }
      }, { timeout: 100 }) // 最多等待 100ms
    }
  })
}
```

---

#### 4. 同步 DOM 批量操作

**问题描述**：多个模块在初始化时同步遍历整个 DOM 树。

**代码位置**：
| 模块 | 方法 | 行号 |
|------|------|------|
| ResourceAccelerator | `_applyCacheToPage()` | 266-299 |
| JSReplacer | `_processExistingScripts()` | 58-61 |
| FontReplacer | `_processExistingLinks()` | 54-57 |
| ImageOptimizer | `_observeImages()` | 107-115 |
| ResourcePreloader | `_processExistingResources()` | 98-121 |

**影响分析**：
- `querySelectorAll('script[src]')` 等选择器遍历整个 DOM
- 页面有 100+ 资源时，初始化耗时 50-200ms
- 阻塞 `DOMContentLoaded` 和首次交互

**预估 INP 改善**：300-500ms

**优化建议**：
```javascript
// 使用分块处理，让出主线程
async _processExistingScripts() {
  const scripts = [...document.querySelectorAll('script[src]')]
  const CHUNK_SIZE = 10

  for (let i = 0; i < scripts.length; i += CHUNK_SIZE) {
    const chunk = scripts.slice(i, i + CHUNK_SIZE)
    chunk.forEach(script => this.processScript(script))

    // 每 10 个让出主线程
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}
```

---

### P2 - 中等优先级问题（预计贡献 10% INP）

#### 5. CDN 健康探测定时器

**问题描述**：每 5 分钟执行 CDN 健康探测，可能阻塞主线程。

**代码位置**：`resource-accelerator.js:425-430`

```javascript
this._healthProbeInterval = setInterval(() => {
  window.CDNMappings.CDNHealthProbe.probeAll(allCdnIds)
}, 5 * 60 * 1000)
```

**影响分析**：
- 探测多个 CDN 端点
- 网络请求可能触发 Promise 回调
- 在用户交互时可能产生竞争

**预估 INP 改善**：100-200ms

**优化建议**：
```javascript
// 使用 requestIdleCallback 调度探测
this._scheduleHealthProbe = () => {
  requestIdleCallback(async () => {
    await window.CDNMappings.CDNHealthProbe.probeAll(allCdnIds)
    // 下一次探测
    setTimeout(this._scheduleHealthProbe, 5 * 60 * 1000)
  }, { timeout: 10000 })
}
```

---

#### 6. 缓存 LRU 淘汰同步执行

**问题描述**：`_evictCache()` 同步遍历大量缓存条目并删除属性。

**代码位置**：`resource-accelerator.js:225-248`

**影响分析**：
- 缓存条目超过 200 时触发淘汰
- 同步删除对象属性可能触发 GC
- 在保存缓存时同步执行

**预估 INP 改善**：50-100ms

**优化建议**：
```javascript
// 使用异步淘汰
async _evictCache(type) {
  const entries = this.cache[type]
  if (!entries || Object.keys(entries).length <= MAX_CACHE_ENTRIES) return

  // 延迟到空闲时执行
  requestIdleCallback(() => {
    const keys = Object.keys(entries)
    const toRemove = keys.length - MAX_CACHE_ENTRIES
    keys.slice(0, toRemove).forEach(key => delete entries[key])
  })
}
```

---

## 问题严重度分布

| 级别 | 数量 | 预估 INP 贡献 |
|------|------|---------------|
| **严重 (P0)** | 2 | 5500-8500ms |
| **高 (P1)** | 2 | 800-1500ms |
| **中等 (P2)** | 2 | 150-300ms |

---

## 优化优先级路线图

### 阶段 1：立即修复（预计改善 70% INP）

1. **统一 MutationObserver** - 合并 6 个 Observer 为 1 个
2. **图片压缩移至 Worker** - 使用 OffscreenCanvas

### 阶段 2：短期优化（预计改善 20% INP）

3. **IntersectionObserver 回调优化** - 使用 requestIdleCallback
4. **DOM 操作分块** - 让出主线程

### 阶段 3：长期优化（预计改善 10% INP）

5. **定时器优化** - 使用 requestIdleCallback 调度
6. **缓存淘汰异步化** - 避免同步操作

---

## 优化预期效果

| 阶段 | INP 改善 | 预期 INP | LCP 影响 | CLS 影响 |
|------|----------|----------|----------|----------|
| 当前 | - | 8192ms | 1.61s | 0.04 |
| 阶段 1 | 5500-8500ms | 200-2700ms | 无影响 | 无影响 |
| 阶段 2 | 800-1500ms | 100-1200ms | 无影响 | 无影响 |
| 阶段 3 | 150-300ms | **< 200ms** | 无影响 | 无影响 |

---

## 附录：代码模式识别

### 模式 1：MutationObserver 过度监听

```javascript
// 问题代码模式
this._observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      // 同步遍历，无节流
    })
  })
})
this._observer.observe(document.documentElement, {
  childList: true,
  subtree: true, // 监听整个 DOM 树
})
```

### 模式 2：主线程 CPU 密集操作

```javascript
// 问题代码模式
canvas.toBlob((blob) => {
  // 同步执行，阻塞主线程
}, format, quality)
```

### 模式 3：同步 DOM 批量操作

```javascript
// 问题代码模式
const elements = document.querySelectorAll('...') // 遍历整个 DOM
elements.forEach(el => this.processElement(el)) // 同步处理
```

---

## 下一步行动

1. 创建 `UnifiedDOMWatcher` 类统一管理 MutationObserver
2. 将图片压缩逻辑迁移至 Web Worker
3. 为 IntersectionObserver 回调添加 requestIdleCallback 包装
4. 实现分块 DOM 处理机制
5. 添加性能监控点，验证优化效果

---

**报告生成时间**：2026-05-16
**分析工具**：代码静态分析 + 性能模式识别
