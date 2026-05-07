# 资源加速器 v6 设计文档

> 基于 v5 实现，扩展第三方脚本延迟、性能度量、AVIF 压缩、字体优化

---

## 1. 第三方脚本延迟加载

### 目标

对非 CDN 可替换的跨域第三方脚本进行延迟注入，减少首屏阻塞。

### 策略

三级策略：

| 策略    | 行为                                         | 适用场景           |
| ------- | -------------------------------------------- | ------------------ |
| `idle`  | `requestIdleCallback` 注入，10s 超时强制加载 | analytics、统计类  |
| `defer` | 页面 `load` 后 3 秒注入                      | 社交 SDK、客服插件 |
| `block` | 从 DOM 移除 `<script>` 元素，阻止加载        | 用户主动屏蔽       |

**`idle` 策略实现约定**：

- 使用 `requestIdleCallback(cb, { timeout: 10000 })` 形式，浏览器会在 10s 内确保回调执行
- 不需要额外的 `setTimeout` 兜底（`requestIdleCallback` 的 `timeout` 参数已保证）
- `requestIdleCallback` 不支持时（极少数情况）降级为 `setTimeout(cb, 100)`

**`block` 策略实现约定**：

- `script.remove()` 从 DOM 移除元素
- 记录到 `state.stats.thirdPartyBlocked` 统计
- 不保留 `onload` 回调

### 规则来源（优先级从高到低）

1. **用户自定义规则** — popup 配置，URL 正则模式 + 策略
2. **内置已知规则** — 硬编码的 analytics/统计类脚本
3. **自动检测** — 非 CDN + 非同域的 `<script>`，应用默认策略

### 内置已知规则

```javascript
const BUILTIN_DEFERRAL_RULES = [
  { pattern: 'google-analytics\\.com', strategy: 'idle', name: 'Google Analytics' },
  { pattern: 'googletagmanager\\.com', strategy: 'idle', name: 'Google Tag Manager' },
  { pattern: 'baidu\\.com/hm\\.js', strategy: 'idle', name: '百度统计' },
  { pattern: 'cnzz\\.com', strategy: 'idle', name: 'CNZZ' },
  { pattern: 'umeng\\.com', strategy: 'idle', name: '友盟' },
  { pattern: '51\\.la', strategy: 'idle', name: '51.la' },
  { pattern: 'hotjar\\.com', strategy: 'idle', name: 'Hotjar' },
  { pattern: 'sentry\\.io', strategy: 'idle', name: 'Sentry' },
]
```

### 自动检测逻辑

```javascript
function isThirdPartyScript(url) {
  try {
    const urlObj = new URL(url)
    // 提取 base domain（example.com）进行比较，忽略子域名差异
    const pageBase = getBaseDomain(location.hostname)
    const scriptBase = getBaseDomain(urlObj.hostname)
    if (pageBase === scriptBase) return false
    // CDN 上的不算第三方（已在 CDN 替换流程中处理）
    if (isCDNUrl(url)) return false
    return true
  } catch {
    return false
  }
}

// 简单的 base domain 提取：取最后两段（co.uk 等特殊 TLD 不处理）
function getBaseDomain(hostname) {
  const parts = hostname.split('.')
  return parts.slice(-2).join('.')
}
```

### 处理流程

```
processScript(script)
  ├── CDN 匹配成功 → 替换（现有逻辑）
  ├── CDN 匹配失败（async 结果返回后）
  │   ├── 第三方延迟启用
  │   │   ├── 匹配用户自定义规则 → 按规则延迟（计时从这里开始）
  │   │   ├── 匹配内置已知规则 → 按规则延迟
  │   │   ├── isThirdPartyScript() = true → 按默认策略延迟
  │   │   └── 同域非 CDN → 不处理（pass）
  │   └── 第三方延迟禁用 → 不处理
  └── 注意：延迟计时在 CDN 匹配明确失败后才开始，避免与异步匹配竞态
```

**竞态处理**：`defer` / `idle` 策略的计时起点是 CDN 匹配明确返回 `null` 之后，而非 `<script>` 元素首次遇到时。这确保了 jsDelivr API 异步查询不会被延迟计时抢先。

### 配置结构

所有新配置字段合入现有 `resourceAcceleratorConfig` storage key，通过 `{ ...DEFAULT_CONFIG, ...result[CONFIG_KEY] }` 模式自动合并，无需迁移。

```javascript
{
  thirdPartyDeferral: {
    enabled: false,           // 默认关闭
    defaultStrategy: 'idle',  // 自动检测时的默认策略
    maxDeferralMs: 10000,     // 最大延迟时间
    userRules: []             // 用户自定义规则 [{ pattern: string, strategy: string }]
  }
}
```

### 文件变更

| 文件                                      | 变更                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `deferScript()`、`matchDeferralRule()`、`isThirdPartyScript()`、`getBaseDomain()`，扩展 `processScript()` |
| `popup.html`                              | 新增第三方脚本延迟配置区域                                                                                     |
| `popup.js`                                | 新增延迟策略 UI 交互（开关 + 默认策略 + 规则列表管理）                                                         |

---

## 2. 性能度量对比

### 目标

采集页面加载性能数据，与替换效果关联，popup 展示加速效果。

### 采集时机

- **页面指标**：`window.load` 事件后通过 `PerformanceNavigationTiming` API 采集（权威数据，不受 content script 执行时机影响）
- **资源指标**：同事件通过 `PerformanceResourceTiming` API 采集
- **替换效果**：从 `state.stats` 和 `state.recentReplacements` 汇总

**不使用 `performance.now()` 作为基准**：content script 在 `document_start` 执行，此时页面导航已进行到中途，`performance.now()` 无法反映真实的 TTFB 或连接开销。`PerformanceNavigationTiming` 提供完整的导航时间线。

### 数据结构

```javascript
{
  performance: {
    // Navigation Timing（来自 PerformanceNavigationTiming）
    ttfb: 0,                    // 首字节时间 (responseStart - requestStart)
    domContentLoaded: 0,        // DOM Ready (domContentLoadedEventEnd - startTime)
    loadEvent: 0,               // 页面完全加载 (loadEventEnd - startTime)
    // Resource Timing 汇总
    totalResources: 0,          // 总资源数
    totalDuration: 0,           // 总加载耗时（各资源 duration 之和）
    // 替换效果（来自 state.stats，非 Resource Timing）
    replacedJs: 0,             // 替换的 JS 数
    replacedCss: 0,            // 替换的 CSS 数
    replacedFonts: 0,          // 替换的字体数
    imagesCompressed: 0,       // 压缩的图片数
    bytesSaved: 0,             // 图片压缩节省字节数（来自 state.stats.imagesCompressBytesSaved）
    estimatedTimeSaved: 0      // 预估节省时间（基于替换数量估算）
  }
}
```

**注意**：`bytesSaved` 仅统计图片压缩节省，不与 CDN 替换重复计算。CDN 替换节省通过 `estimatedTimeSaved` 体现。

### 跨域 Resource Timing 限制

`PerformanceResourceTiming.transferSize` 对跨域资源返回 0（除非服务器发送 `Timing-Allow-Origin`）。因此 **不使用 Resource Timing 的 transferSize 做流量统计**。流量节省信息来自图片压缩的实际字节差值。

### 预估节省时间算法

```
estimatedTimeSaved = jsReplaced * 150ms + cssReplaced * 100ms + fontsReplaced * 120ms

基准假设：国内 CDN RTT ~50ms，原始海外 CDN RTT ~200ms
UI 展示标注"预估"字样，避免误导
```

### 错误处理

`collectPerformanceMetrics()` 在 `PerformanceNavigationTiming` 不可用时（如隐私模式、受限上下文）返回空对象，popup 不展示性能区域。

### Popup 展示

```
┌─────────────────────────────────────┐
│  ⚡ 加速效果（预估）                  │
│  ──────────────────────────────     │
│  首字节: 320ms                      │
│  DOM Ready: 1.2s                    │
│  完全加载: 2.8s                     │
│  ──────────────────────────────     │
│  替换: JS 8 / CSS 3 / 字体 1        │
│  图片压缩: 12 张，节省 1.1 MB        │
│  预估节省: ~1.8s                    │
└─────────────────────────────────────┘
```

### 文件变更

| 文件                                      | 变更                                                            |
| ----------------------------------------- | --------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `collectPerformanceMetrics()`，在 `window.load` 事件中调用 |
| `popup.html`                              | 新增性能度量展示区域                                            |
| `popup.js`                                | 新增性能数据获取和展示逻辑                                      |

---

## 3. AVIF 图片格式支持

### 目标

优先使用 AVIF 格式压缩，比 WebP 再省 20-30%。

### 格式优先级

```
AVIF → WebP → JPEG
```

### 格式检测

使用 `canvas.toDataURL()` 检测浏览器支持，结果缓存到 `state._imageFormat`：

```javascript
const IMAGE_FORMAT_PRIORITY = [
  { mime: 'image/avif', test: 'image/avif' },
  { mime: 'image/webp', test: 'image/webp' },
  { mime: 'image/jpeg', test: null }, // 通用兜底
]
```

### 压缩流程修改

1. 检测支持的最优格式（缓存结果）
2. 直接用最优格式压缩，不做双重编码比较

**不比较两种格式**：AVIF 编码耗时比 WebP 长 2-3 倍，双重编码的 CPU 开销不值得。AVIF 几乎总是比 WebP 小。

### 跳过条件

- `.webp` / `.svg` / `.gif` / `.avif` 文件不压缩
- 小于 `imageMinSize` 的不压缩
- 排除域名内的不压缩

### 文件变更

| 文件                                      | 变更                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `getSupportedImageFormat()`，修改 `compressImage()` 使用检测到的格式 |
| `popup.js`                                | 统计展示中显示实际压缩格式                                                |

---

## 4. 字体预加载优化

### 目标

按字重优先级智能 preload，避免无条件 preload 所有字体。

### 字重优先级

| 优先级 | 字重         | 说明         |
| ------ | ------------ | ------------ |
| 0      | 400 / normal | 正文，最重要 |
| 1      | 700 / bold   | 标题，次重要 |
| 2      | 其他         | 轻体、斜体等 |

### 策略

- 最多 preload **3 个**字体资源
- **先收集所有候选字体，排序后取前 3**
- 如果无法解析字重信息，按 encounter 顺序排在末尾
- 最终只对排序后的前 3 个执行 preload

### 字重解析（Best-effort）

从 URL 和 CSS 上下文中尝试提取字重：

| 来源             | 解析方式                                  | 示例                          |
| ---------------- | ----------------------------------------- | ----------------------------- |
| Google Fonts CSS | 查询参数 `wght@400` 或 `weight=400`       | `?family=Roboto:wght@400;700` |
| Font 文件名      | 路径中的 `-Regular`、`-Bold`、`-Light` 等 | `Roboto-Regular.woff2`        |
| `@font-face` CSS | `font-weight` 属性                        | `font-weight: 400;`           |

无法解析时，字重标记为 `unknown`，排在已知字重之后。

### 实现方案

```javascript
// state 中新增
_fontCandidates: ([], // 待处理的字体候选列表
  function addPreloadHint(cdnUrl, type, fontInfo) {
    if (state.stats.preloadHints >= state.config.maxPreloadHints) return

    if (type === 'font') {
      // 收集候选，不立即 preload
      state._fontCandidates.push({
        url: cdnUrl,
        priority: fontInfo?.weight ? getWeightPriority(fontInfo.weight) : 99,
        weight: fontInfo?.weight || 'unknown',
      })
      // 排序：按优先级升序（0 最高），unknown 排末尾
      state._fontCandidates.sort((a, b) => a.priority - b.priority)
      // 只保留前 3 个
      state._fontCandidates = state._fontCandidates.slice(0, 3)
      // 重新执行 preload（可能有新的更高优先级字体替换了旧的）
      _flushFontPreloads()
      return
    }

    // 非字体类型：直接 preload（现有逻辑）
    _insertPreloadLink(cdnUrl, type)
  })

function _flushFontPreloads() {
  // 清除旧的字体 preload，重新插入前 3 个
  // （简化实现：只在首次 flush 时插入，后续候选追加时不重复插入）
  for (const candidate of state._fontCandidates) {
    if (!candidate._preloaded) {
      _insertPreloadLink(candidate.url, 'font')
      candidate._preloaded = true
    }
  }
}
```

### 文件变更

| 文件                                      | 变更                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 重构 `addPreloadHint()`，新增 `_fontCandidates`、`_flushFontPreloads()`、`getWeightPriority()` |

---

## 实施顺序

```
迭代 A: 第三方脚本延迟 → 迭代 B: 性能度量 → 迭代 C: AVIF → 迭代 D: 字体优化
```

每个迭代独立可交付、可验证。

## 配置持久化

所有新增配置字段合入现有 `resourceAcceleratorConfig` storage key。现有 `{ ...DEFAULT_CONFIG, ...result[CONFIG_KEY] }` 合并模式天然支持新字段扩展，无需迁移。

## 风险

| 风险                                | 缓解                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| 第三方脚本延迟导致功能异常          | 默认关闭 + `requestIdleCallback` timeout 兜底          |
| AVIF 编码耗时                       | 异步 + 并发限制 + 不做双重编码比较                     |
| 字体 preload 误判                   | 降级为最多 3 个无差别 preload                          |
| CSP 限制第三方脚本注入              | CSP 检测到时自动跳过延迟                               |
| 性能度量数据不准确                  | 仅展示 + 标注"预估"，不做关键决策依据                  |
| 跨域 Resource Timing transferSize=0 | 不使用 transferSize 做流量统计，用图片压缩实际字节差值 |
