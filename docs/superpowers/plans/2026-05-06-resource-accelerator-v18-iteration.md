# 资源加速器 v18 迭代计划

> 基线版本：v17（content-visibility + fetchPriority全局扫描）
> 创建时间：2026-05-06

**Goal:** 第三方 iframe 懒加载 + 全站 DNS prefetch，减少首屏阻塞。

---

## 迭代 1: 第三方 iframe 懒加载

**目标：** YouTube/地图/社交嵌入等 iframe 延迟到可视区再加载

### 功能设计

扫描页面中的 `<iframe[src]>`，对第三方 iframe：

- 移除 `src`，存到 `data-src`
- 设置 `loading="lazy"`
- 通过 IntersectionObserver 在进入可视区 200px 时恢复 `src`

**配置：**

```javascript
iframeLazyLoad: {
  enabled: true,
  threshold: 200,  // 预加载距离(px)
  excludePatterns: [],  // 不懒加载的域名
},
```

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG：**

```javascript
// 第三方iframe懒加载
iframeLazyLoad: {
  enabled: true,
  threshold: 200,
  excludePatterns: [],
},
```

**2. 添加处理函数（在 processImage 之后）：**

```javascript
// ========== 第三方iframe懒加载 ==========
function processIframeLazyLoad() {
  if (!isSiteEnabled('iframeLazyLoad')) return
  const config = state.config.iframeLazyLoad
  const threshold = config.threshold || 200

  const iframes = document.querySelectorAll('iframe[src]')
  iframes.forEach((iframe) => {
    try {
      const url = new URL(iframe.src, location.href)
      // 跳过同源 iframe
      if (url.hostname === location.hostname) return
      // 跳过排除的域名
      if (config.excludePatterns?.some((p) => url.hostname.includes(p))) return
      // 跳过已经处理过的
      if (iframe.dataset._raIframeProcessed) return

      iframe.dataset._raIframeProcessed = '1'
      iframe.dataset.src = iframe.src
      iframe.removeAttribute('src')
      iframe.loading = 'lazy'

      // IntersectionObserver 恢复 src
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target
              if (el.dataset.src) {
                el.src = el.dataset.src
                delete el.dataset.src
              }
              observer.unobserve(el)
            }
          })
        },
        { rootMargin: `0px 0px ${threshold}px 0px` }
      )
      observer.observe(iframe)
    } catch {
      // URL 解析失败，跳过
    }
  })
}
```

**3. 在 init() 中调用（处理已有资源部分）：**

```javascript
// 处理已有iframe
processIframeLazyLoad()
```

**4. MutationObserver 中添加 iframe 处理：**
在 MutationObserver 回调中，对新增的 iframe 调用 `processIframeLazyLoad()`。

---

## 迭代 2: 全站 DNS prefetch

**目标：** 扫描页面所有外部域名，添加 dns-prefetch 提示

### 功能设计

扫描页面中所有 `<script src>` / `<link href>` / `<img src>` / `<iframe src>` 的外部域名，对未添加 dns-prefetch 的域名自动添加。

**配置：**

```javascript
dnsPrefetch: {
  enabled: true,
  maxDomains: 15,  // 最大域名数
},
```

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG：**

```javascript
// 全站DNS prefetch
dnsPrefetch: {
  enabled: true,
  maxDomains: 15,
},
```

**2. 添加处理函数：**

```javascript
// ========== 全站DNS prefetch ==========
function _addGlobalDnsPrefetch() {
  if (!isSiteEnabled('dnsPrefetch')) return
  const config = state.config.dnsPrefetch
  const maxDomains = config.maxDomains || 15
  const origins = new Set()
  const head = document.head || document.documentElement

  // 扫描所有外部资源
  document.querySelectorAll('script[src], link[href], img[src], iframe[src]').forEach((el) => {
    const url = el.src || el.href
    if (!url) return
    try {
      const origin = new URL(url, location.href).origin
      if (origin !== location.origin) {
        origins.add(origin)
      }
    } catch {}
  })

  // 添加 dns-prefetch（排除已有 preconnect 的）
  let count = 0
  origins.forEach((origin) => {
    if (count >= maxDomains) return
    if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return
    if (head.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) return

    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = origin
    head.appendChild(link)
    count++
  })
}
```

**3. 在 init() 中调用（在 \_addCDNPreconnect 之后）：**

```javascript
// 全站DNS prefetch
_addGlobalDnsPrefetch()
```

---

## 实施顺序

```
迭代1: iframe懒加载 → 迭代2: DNS prefetch
```

两个迭代独立，无依赖。

---

## 约束条件

1. **向后兼容** — 增量叠加，不删除已有逻辑
2. **降级可用** — 禁用时回退到现有行为
3. **性能安全** — 不显著影响页面加载
