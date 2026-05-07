# 资源加速器 v6 迭代计划

> 基于 v5（缺陷修复 + 统计持久化 + 压缩缓存 + 图片缩放）的功能扩展迭代

---

## 当前状态 (v5)

| 模块                  | 状态 | 说明                                              |
| --------------------- | ---- | ------------------------------------------------- |
| JS库替换              | ✅   | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询 |
| CSS框架替换           | ✅   | 14+ CSS 库，独立开关                              |
| 字体替换              | ✅   | Google Fonts / FontAwesome 镜像                   |
| 图片懒加载            | ✅   | 原生 `loading="lazy"` + `fetchPriority="low"`     |
| 图片压缩              | ✅   | Canvas 重绘 WebP/JPEG，2048px 缩放，队列控制      |
| CDN健康探测           | ✅   | HEAD 探测，5 分钟缓存，RTT 记录，降级链集成       |
| CDN Preconnect        | ✅   | 优先 preconnect，其余 dns-prefetch                |
| API 拦截              | ✅   | 拦截 createElement / appendChild / insertBefore   |
| MutationObserver 兜底 | ✅   | 50ms 批量，每次 100 节点                          |
| 统计持久化            | ✅   | 防抖 + 增量写入 chrome.storage.local              |
| 替换详情记录          | ✅   | 最近 50 条，含类型/库名/CDN/时间                  |
| 资源去重              | ✅   | 页面内 Set 去重                                   |
| 压缩结果缓存          | ✅   | 页面内 Map 缓存压缩决策                           |

### v5 遗留问题

1. **图片大小判断仍用像素估算** — `compressImage()` 用 `naturalWidth × naturalHeight × 4` 估算，未用 fetch HEAD 获取实际文件大小
2. **无第三方脚本延迟加载** — analytics、广告、社交 widget 等非 CDN 库无法优化
3. **无站点级配置** — 用户无法按域名单独启用/禁用加速器
4. **无性能对比数据** — 缺少加速前后的加载时间对比
5. **字体预加载策略粗糙** — 无条件地 preload 所有匹配字体，未根据页面实际字体使用情况优化
6. **无 AVIF 支持** — 仅 WebP/JPEG，缺少更高效的 AVIF 格式

---

## 迭代目标

**目标**：扩展第三方资源优化能力 + 提升用户可控性 + 增加性能可观测性

**原则**：

- 高 ROI 优先：第三方脚本延迟 > 站点配置 > 性能度量
- 不改变现有核心拦截架构，增量扩展
- 每个迭代独立可交付、可验证
- 安全优先：所有延迟加载方案必须有降级机制

---

## 迭代 1: 第三方脚本延迟加载

**目标**：对非 CDN 可替换的第三方脚本（analytics、广告、社交 SDK）进行延迟加载

### 问题分析

当前加速器只能替换 CDN 可用的库。但页面中常见的拖慢项是：

- Google Analytics / 百度统计
- 广告脚本（AdSense、联盟广告）
- 社交分享按钮（微信 SDK、微博 SDK）
- 客服聊天插件
- A/B 测试脚本

这些无法用 CDN 替换，但可以**延迟到页面空闲时加载**。

### 功能设计

**策略分级**：

| 策略    | 行为                                  | 适用场景         |
| ------- | ------------------------------------- | ---------------- |
| `idle`  | 页面空闲时注入（requestIdleCallback） | 非关键 analytics |
| `defer` | 页面 load 后 3 秒注入                 | 社交 SDK、客服   |
| `block` | 完全不注入                            | 用户主动屏蔽     |
| `pass`  | 不处理（原始行为）                    | 默认             |

**匹配规则**（用户可配置）：

```javascript
{
  thirdPartyDeferral: {
    enabled: false,  // 默认关闭，用户手动开启
    strategy: 'idle',  // 全局默认策略
    rules: [
      // 已知的非关键脚本
      { pattern: 'google-analytics.com', strategy: 'idle' },
      { pattern: 'googletagmanager.com', strategy: 'idle' },
      { pattern: 'baidu.com/hm.js', strategy: 'idle' },
      { pattern: 'cnzz.com', strategy: 'idle' },
      { pattern: 'umeng.com', strategy: 'idle' },
      { pattern: 'jsagent.*.com', strategy: 'defer' },  // 客服
      { pattern: 'widget.*.com', strategy: 'defer' },   // 社交
    ],
    maxDeferralMs: 10000,  // 最大延迟时间，超过则强制加载
  }
}
```

**实现方案**：

```javascript
// processScript() 中新增
async function processScript(script) {
  // ... 现有 CDN 替换逻辑 ...

  // CDN 无法替换 → 尝试第三方延迟
  if (!match && state.config.thirdPartyDeferral?.enabled) {
    const deferralRule = matchDeferralRule(url)
    if (deferralRule) {
      deferScript(script, deferralRule.strategy)
      return
    }
  }
}

function deferScript(script, strategy) {
  const src = script.src
  script.removeAttribute('src')
  script.dataset._deferredSrc = src
  script.dataset._deferralStrategy = strategy
  script.dataset._raDeferralTime = Date.now()

  const loadFn = () => {
    script.src = script.dataset._deferredSrc
    script.dataset._raLoaded = 'true'
  }

  switch (strategy) {
    case 'idle':
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadFn, { timeout: state.config.thirdPartyDeferral.maxDeferralMs })
      } else {
        setTimeout(loadFn, 100)
      }
      break
    case 'defer':
      if (document.readyState === 'complete') {
        setTimeout(loadFn, 3000)
      } else {
        window.addEventListener('load', () => setTimeout(loadFn, 3000), { once: true })
      }
      break
    case 'block':
      // 不加载，记录到统计
      state.stats.thirdPartyBlocked = (state.stats.thirdPartyBlocked || 0) + 1
      break
  }
}
```

### 文件变更

| 文件                                      | 变更                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `deferScript()`、`matchDeferralRule()`，扩展 `processScript()` |
| `popup.html`                              | 新增第三方脚本延迟配置区域                                          |
| `popup.js`                                | 新增延迟策略 UI 交互                                                |

### 配置项

```javascript
{
  thirdPartyDeferral: {
    enabled: false,
    strategy: 'idle',
    rules: [...],
    maxDeferralMs: 10000,
  }
}
```

### 验收标准

- [ ] 匹配规则内的第三方脚本被延迟加载
- [ ] `idle` 策略在页面空闲时注入
- [ ] `defer` 策略在 load 后 3 秒注入
- [ ] `block` 策略完全阻止加载
- [ ] 超过 `maxDeferralMs` 时强制加载
- [ ] popup 可配置启用/禁用和规则列表
- [ ] 不影响现有 CDN 替换逻辑

### 风险

| 风险                     | 影响                   | 缓解                              |
| ------------------------ | ---------------------- | --------------------------------- |
| 延迟加载导致页面功能异常 | 部分脚本有执行顺序依赖 | 提供策略选择 + maxDeferralMs 兜底 |
| CSP 限制第三方脚本       | 延迟注入失败           | CSP 检测到时自动跳过              |
| 用户误开启               | 体验下降               | 默认关闭，需用户手动开启          |

---

## 迭代 2: 站点级配置

**目标**：支持按域名配置加速器行为

### 问题分析

当前加速器是全局生效的，但某些站点可能：

- 自身已有 CDN 加速，不需要替换
- 有特殊 CSP 限制，替换会导致功能异常
- 图片压缩不适用（如图片编辑网站）

### 功能设计

**数据结构**：

```javascript
{
  siteConfig: {
    enabled: true,
    rules: [
      {
        domain: 'example.com',
        enabled: false,  // 该站点禁用
      },
      {
        domain: '*.github.io',
        enabled: true,
        jsReplace: false,  // 仅禁用 JS 替换
        imageCompress: true,
      }
    ]
  }
}
```

**匹配逻辑**：

```javascript
function getSiteConfig(hostname) {
  const rules = state.config.siteConfig?.rules || []
  // 精确匹配优先
  const exact = rules.find((r) => r.domain === hostname)
  if (exact) return exact
  // 通配符匹配
  const wildcard = rules.find((r) => {
    if (!r.domain.startsWith('*')) return false
    const suffix = r.domain.slice(1)
    return hostname.endsWith(suffix)
  })
  return wildcard || null
}

// 在 init() 和 processScript/processLink/processImage 中调用
function isSiteEnabled(feature) {
  const site = getSiteConfig(location.hostname)
  if (site && !site.enabled) return false
  if (site && feature in site) return site[feature]
  return state.config[feature] // 回退到全局配置
}
```

### 文件变更

| 文件                                      | 变更                                                        |
| ----------------------------------------- | ----------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `getSiteConfig()`、`isSiteEnabled()`，各处理函数中调用 |
| `popup.html`                              | 新增站点配置管理 UI                                         |
| `popup.js`                                | 新增站点配置 CRUD 逻辑                                      |

### 验收标准

- [ ] 按域名精确匹配配置
- [ ] 支持通配符 `*.domain.com`
- [ ] 站点配置优先于全局配置
- [ ] popup 可添加/编辑/删除站点规则
- [ ] 当前站点在 popup 中高亮显示其配置状态

---

## 迭代 3: 性能度量对比

**目标**：采集加速前后的页面性能数据，提供直观对比

### 问题分析

用户使用加速器后无法感知效果。需要量化指标来证明价值。

### 功能设计

**采集指标**：

```javascript
{
  performance: {
    // Navigation Timing（页面加载）
    navigationStart: 0,
    domContentLoaded: 0,
    loadEventEnd: 0,
    // 资源统计
    totalResources: 0,
    totalTransferSize: 0,
    totalDuration: 0,
    // 替换效果
    jsReplacedCount: 0,
    cssReplacedCount: 0,
    fontReplacedCount: 0,
    imagesCompressedCount: 0,
    bytesSaved: 0,
    // 预估节省
    estimatedTimeSaved: 0,  // 基于 CDN RTT 差异估算
  }
}
```

**实现方案**：

```javascript
// init() 中采集初始数据
function collectNavigationTiming() {
  if (!window.PerformanceNavigationTiming) return null
  const entries = performance.getEntriesByType('navigation')
  if (!entries.length) return null
  const nav = entries[0]
  return {
    ttfb: nav.responseStart - nav.requestStart,
    domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
    loadEvent: nav.loadEventEnd - nav.startTime,
    transferSize: nav.transferSize,
  }
}

// 页面 load 后汇总
function collectResourceTiming() {
  const entries = performance.getEntriesByType('resource')
  return entries.map((e) => ({
    name: e.name,
    type: e.initiatorType,
    duration: e.duration,
    transferSize: e.transferSize,
  }))
}

// 估算节省时间（基于 RTT 差异）
function estimateTimeSaved(replacements) {
  // 假设：国内 CDN RTT ~50ms，原始 CDN RTT ~200ms
  return replacements.length * 150 // 每个替换节省 ~150ms
}
```

**Popup 展示**：

```
┌─────────────────────────────────────┐
│  ⚡ 加速效果                         │
│  ──────────────────────────────     │
│  页面加载: 1.2s → 0.8s (节省 33%)    │
│  资源请求: 45 个 (替换 12 个)         │
│  传输体积: 3.2 MB → 2.1 MB          │
│  节省流量: 1.1 MB (34%)             │
│  ──────────────────────────────     │
│  ⏱️ 预估节省: ~1.8s                 │
└─────────────────────────────────────┘
```

### 文件变更

| 文件                                      | 变更                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `collectNavigationTiming()`、`collectResourceTiming()`、`estimateTimeSaved()` |
| `popup.html`                              | 新增性能对比展示区域                                                               |
| `popup.js`                                | 新增性能数据展示逻辑                                                               |

### 验收标准

- [ ] 采集 Navigation Timing 数据
- [ ] 采集 Resource Timing 数据
- [ ] 计算替换数量和节省流量
- [ ] popup 显示加速效果对比
- [ ] 预估节省时间基于实际 RTT 数据

---

## 迭代 4: AVIF 图片格式支持

**目标**：优先使用 AVIF 格式压缩图片，进一步提升压缩率

### 问题分析

当前图片压缩仅支持 WebP/JPEG。AVIF 相比 WebP 可再节省 20-30% 体积，且 2026 年浏览器支持率已超过 95%。

### 功能设计

**格式优先级**：

```javascript
const IMAGE_FORMAT_PRIORITY = [
  { mime: 'image/avif', ext: '.avif', test: 'toDataURL("image/avif")' },
  { mime: 'image/webp', ext: '.webp', test: 'toDataURL("image/webp")' },
  { mime: 'image/jpeg', ext: '.jpg', test: null }, // 通用
]
```

**修改 `compressImage()`**：

```javascript
// 支持格式检测
function getSupportedImageFormat() {
  if (state._imageFormat) return state._imageFormat
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  for (const fmt of IMAGE_FORMAT_PRIORITY) {
    try {
      if (fmt.test && canvas.toDataURL(fmt.mime).startsWith(`data:${fmt.mime}`)) {
        state._imageFormat = fmt
        return fmt
      }
    } catch {}
  }
  state._imageFormat = IMAGE_FORMAT_PRIORITY[2] // fallback JPEG
  return state._imageFormat
}

// 压缩时使用最优格式
function compressImage(url) {
  // ... 现有逻辑 ...
  const format = getSupportedImageFormat()
  canvas.toBlob(
    (blob) => {
      // 同时尝试次优格式，取体积更小的
      // ... 比较逻辑 ...
    },
    format.mime,
    state.config.imageQuality
  )
}
```

### 文件变更

| 文件                                      | 变更                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `getSupportedImageFormat()`，修改 `compressImage()` |
| `popup.js`                                | 统计展示中显示实际使用的图片格式                         |

### 验收标准

- [ ] AVIF 支持的浏览器优先使用 AVIF
- [ ] AVIF 不支持时降级到 WebP
- [ ] WebP 不支持时降级到 JPEG
- [ ] 格式检测结果缓存，不重复检测
- [ ] popup 显示实际使用的压缩格式

---

## 迭代 5: 字体预加载优化

**目标**：基于页面实际字体使用情况智能预加载

### 问题分析

当前字体预加载是无条件的：匹配到字体 CSS 就 preload。但很多页面虽然引入了字体 CSS，实际只使用了其中 1-2 个字重。无条件预加载浪费带宽。

### 功能设计

**策略**：

1. **首屏字体优先**：只 preload 首屏可见区域用到的字体
2. **按字重优先级**：regular (400) > bold (700) > 其他
3. **限制 preload 数量**：最多 3 个字体 preload

**实现方案**：

```javascript
function analyzeFontUsage(fontCSS) {
  // 解析 @font-face 声明
  // 按字重统计：400 > 700 > 其他
  // 返回按优先级排序的字体 URL 列表
  const declarations = parseFontFaces(fontCSS)
  return declarations
    .sort((a, b) => getWeightPriority(a.weight) - getWeightPriority(b.weight))
    .slice(0, 3) // 最多 3 个
}

function getWeightPriority(weight) {
  if (weight === '400' || weight === 'normal') return 0
  if (weight === '700' || weight === 'bold') return 1
  return 2
}
```

### 文件变更

| 文件                                      | 变更                                   |
| ----------------------------------------- | -------------------------------------- |
| `content/modules/resource-accelerator.js` | 修改 `addPreloadHint()` 和字体处理逻辑 |

### 验收标准

- [ ] 只 preload regular 和 bold 字重
- [ ] 最多 3 个字体 preload
- [ ] 不影响字体实际加载

---

## 实施顺序

```
迭代1: 第三方脚本延迟 → 迭代2: 站点配置 → 迭代3: 性能度量 → 迭代4: AVIF支持 → 迭代5: 字体优化
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4 > 迭代 5

**理由**：

- 迭代 1（第三方延迟）ROI 最高：analytics/广告脚本是页面最大拖慢项
- 迭代 2（站点配置）解决用户可控性问题，是长期使用的基础设施
- 迭代 3（性能度量）让用户看到加速效果，提升使用粘性
- 迭代 4（AVIF）是压缩率的进一步提升，锦上添花
- 迭代 5（字体优化）收益较小，优先级最低

---

## 风险评估

| 风险                           | 影响                   | 缓解措施                                         |
| ------------------------------ | ---------------------- | ------------------------------------------------ |
| 第三方脚本延迟导致页面功能异常 | 部分脚本有执行顺序依赖 | 默认关闭 + maxDeferralMs 兜底 + 用户可按站点调整 |
| 站点配置规则过多导致性能问题   | 规则匹配耗时           | 规则数量限制 + 精确匹配优先                      |
| AVIF 编码耗时                  | 压缩延迟增加           | 异步 + 并发限制 + 缓存                           |
| 字体 preload 误判              | 首屏字体加载变慢       | 降级为无条件 preload                             |
| CSP 限制第三方脚本注入         | 延迟加载失败           | CSP 检测到时自动跳过                             |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 | 迭代4 | 迭代5 |
| ----------------------------------------- | ----- | ----- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    | ✅    | ✅    |
| `popup.html`                              | ✅    | ✅    | ✅    | -     | -     |
| `popup.js`                                | ✅    | ✅    | ✅    | ✅    | -     |

---

## 与 v5 的关系

v5 完成了基础缺陷修复和功能补全（去重、持久化、缓存、缩放）。v6 在此基础上：

| v5 基础设施                       | v6 扩展                      |
| --------------------------------- | ---------------------------- |
| API 拦截 `createElement`          | 扩展为支持第三方脚本延迟注入 |
| 全局配置 `DEFAULT_CONFIG`         | 扩展为支持站点级配置覆盖     |
| `state.stats` 统计收集            | 扩展为性能度量对比           |
| `compressImage()` WebP/JPEG       | 扩展为 AVIF 优先             |
| `addPreloadHint()` 无条件 preload | 扩展为基于字重的智能预加载   |
