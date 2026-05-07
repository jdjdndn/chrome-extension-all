# 资源加速器 v6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级现有第三方延迟系统 + 新增性能度量、AVIF 压缩、字体预加载优化

**Architecture:** 在现有 `resource-accelerator.js` 上增量扩展。第三方延迟系统已存在，本次升级为其添加自动检测和用户规则管理。其余三项为全新功能。

**Tech Stack:** Chrome Extension Manifest V3, Content Script (ES6+), chrome.storage.local, PerformanceNavigationTiming API, Canvas API (AVIF/WebP)

**Spec:** `docs/superpowers/specs/2026-05-02-resource-accelerator-v6-design.md`

**现有代码状态（重要）：**

- `thirdPartyDeferral` 配置和 `deferScript()`/`matchDeferralRule()` 已存在（resource-accelerator.js:39-206）
- Popup HTML 已有 `ra-third-party-defer` 等元素（popup.html:627-638）
- Popup JS 已有元素引用但缺少事件绑定（popup.js:2943-2945）
- 性能度量、AVIF、字体优化均未实现

---

## 迭代 A: 升级第三方脚本延迟（自动检测 + 用户规则）

### Task A1: 添加 getBaseDomain 和 isThirdPartyScript

**Files:**

- Modify: `content/modules/resource-accelerator.js` (在 `isCDNUrl` 函数后，约 127 行)

- [ ] **Step 1: 新增工具函数**

在 `isCDNUrl` 函数后面、`supportsWebP` 之前添加：

```javascript
function getBaseDomain(hostname) {
  const parts = hostname.split('.')
  return parts.slice(-2).join('.')
}

function isThirdPartyScript(url) {
  try {
    const urlObj = new URL(url)
    const pageBase = getBaseDomain(location.hostname)
    const scriptBase = getBaseDomain(urlObj.hostname)
    if (pageBase === scriptBase) return false
    if (isCDNUrl(url)) return false
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add getBaseDomain and isThirdPartyScript for auto-detection"
```

---

### Task A2: 升级 matchDeferralRule 支持自动检测和用户规则

**Files:**

- Modify: `content/modules/resource-accelerator.js:142-149` (matchDeferralRule)

- [ ] **Step 1: 替换 matchDeferralRule 函数**

将现有的 `matchDeferralRule` 函数替换为：

```javascript
function matchDeferralRule(url) {
  const deferral = state.config.thirdPartyDeferral
  if (!deferral?.enabled) return null

  // 1. 用户自定义规则优先（正则匹配）
  for (const rule of deferral.userRules || []) {
    try {
      if (new RegExp(rule.pattern, 'i').test(url)) {
        return { pattern: rule.pattern, strategy: rule.strategy, name: rule.pattern }
      }
    } catch {}
  }

  // 2. 内置已知规则（字符串包含匹配）
  const { strategy, rules } = deferral
  for (const rule of rules) {
    if (url.includes(rule.pattern)) {
      return { pattern: rule.pattern, strategy: rule.strategy || strategy, name: rule.pattern }
    }
  }

  // 3. 自动检测：非 CDN + 非同域
  if (isThirdPartyScript(url)) {
    return { pattern: '*', strategy: strategy || 'idle', name: 'auto-detected' }
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): upgrade matchDeferralRule with auto-detection and user rules"
```

---

### Task A3: 在 DEFAULT_CONFIG 中添加 userRules 字段

**Files:**

- Modify: `content/modules/resource-accelerator.js:39-52` (thirdPartyDeferral config)

- [ ] **Step 1: 在 thirdPartyDeferral 配置中添加 userRules**

在 `rules` 数组之后、`maxDeferralMs` 之前添加 `userRules: []`：

```javascript
thirdPartyDeferral: {
  enabled: false,
  strategy: 'idle',
  rules: [
    // ... 现有规则不变 ...
  ],
  userRules: [],  // 用户自定义规则 [{ pattern: string, strategy: string }]
  maxDeferralMs: 10000,
},
```

- [ ] **Step 2: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add userRules field to thirdPartyDeferral config"
```

---

### Task A4: Popup UI — 用户规则管理

**Files:**

- Modify: `popup.html` (在 `ra-third-party-settings` 区域内)
- Modify: `popup.js`

- [ ] **Step 1: 在 popup.html 的第三方延迟设置区域添加用户规则管理 UI**

在 `<select id="ra-deferral-strategy"` 元素之后添加：

```html
<div style="margin-top: 8px;">
  <div style="font-size: 11px; color: #666; margin-bottom: 4px;">自定义规则</div>
  <div
    id="ra-3p-user-rules-list"
    style="max-height: 80px; overflow-y: auto; font-size: 11px;"
  ></div>
  <div style="display: flex; gap: 4px; margin-top: 4px;">
    <input
      type="text"
      id="ra-3p-rule-pattern"
      placeholder="URL正则模式"
      style="flex: 1; padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
    />
    <select
      id="ra-3p-rule-strategy"
      style="padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
    >
      <option value="idle">idle</option>
      <option value="defer">defer</option>
      <option value="block">block</option>
    </select>
    <button
      id="ra-3p-rule-add"
      style="font-size: 11px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;"
    >
      +
    </button>
  </div>
</div>
```

- [ ] **Step 2: 在 popup.js 中绑定用户规则管理事件**

在 popup.js 中找到 `thirdPartyDeferEl` 相关代码区域（约 2943 行），在其后添加用户规则管理逻辑。注意：现有代码获取了元素引用但缺少事件绑定，需要同时补全。

```javascript
// 第三方延迟配置加载和事件绑定
if (thirdPartyDeferEl) {
  // 加载配置
  thirdPartyDeferEl.checked = config.thirdPartyDeferral?.enabled || false
  if (thirdPartySettingsEl) {
    thirdPartySettingsEl.style.display = thirdPartyDeferEl.checked ? 'block' : 'none'
  }
  if (deferralStrategyEl) {
    deferralStrategyEl.value = config.thirdPartyDeferral?.strategy || 'idle'
  }

  // 渲染用户规则列表
  function render3pUserRules() {
    const listEl = document.getElementById('ra-3p-user-rules-list')
    if (!listEl) return
    const userRules = config.thirdPartyDeferral?.userRules || []
    listEl.innerHTML = userRules
      .map(
        (r, i) =>
          `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">
        <span style="flex:1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.pattern}">${r.pattern}</span>
        <span style="color:#666;font-size:10px;">${r.strategy}</span>
        <button data-3p-rule-remove="${i}" style="background:#dc3545;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;padding:1px 4px;line-height:1;">×</button>
      </div>`
      )
      .join('')
  }
  render3pUserRules()

  // 开关事件
  thirdPartyDeferEl.addEventListener('change', async () => {
    if (!config.thirdPartyDeferral)
      config.thirdPartyDeferral = { enabled: false, strategy: 'idle', rules: [], userRules: [] }
    config.thirdPartyDeferral.enabled = thirdPartyDeferEl.checked
    if (thirdPartySettingsEl) {
      thirdPartySettingsEl.style.display = thirdPartyDeferEl.checked ? 'block' : 'none'
    }
    await chrome.storage.local.set({ resourceAcceleratorConfig: config })
    notifyResourceAccelerator(config)
  })

  // 策略选择事件
  if (deferralStrategyEl) {
    deferralStrategyEl.addEventListener('change', async () => {
      if (!config.thirdPartyDeferral)
        config.thirdPartyDeferral = { enabled: false, strategy: 'idle', rules: [], userRules: [] }
      config.thirdPartyDeferral.strategy = deferralStrategyEl.value
      await chrome.storage.local.set({ resourceAcceleratorConfig: config })
      notifyResourceAccelerator(config)
    })
  }

  // 添加用户规则
  const ruleAddBtn = document.getElementById('ra-3p-rule-add')
  const rulePatternInput = document.getElementById('ra-3p-rule-pattern')
  const ruleStrategySelect = document.getElementById('ra-3p-rule-strategy')
  if (ruleAddBtn) {
    ruleAddBtn.addEventListener('click', async () => {
      const pattern = rulePatternInput?.value?.trim()
      const strategy = ruleStrategySelect?.value || 'idle'
      if (!pattern) return
      // 验证正则
      try {
        new RegExp(pattern)
      } catch {
        alert('无效的正则表达式')
        return
      }
      if (!config.thirdPartyDeferral)
        config.thirdPartyDeferral = { enabled: false, strategy: 'idle', rules: [], userRules: [] }
      if (!config.thirdPartyDeferral.userRules) config.thirdPartyDeferral.userRules = []
      config.thirdPartyDeferral.userRules.push({ pattern, strategy })
      rulePatternInput.value = ''
      render3pUserRules()
      await chrome.storage.local.set({ resourceAcceleratorConfig: config })
      notifyResourceAccelerator(config)
    })
  }

  // 删除用户规则
  const rulesListEl = document.getElementById('ra-3p-user-rules-list')
  if (rulesListEl) {
    rulesListEl.addEventListener('click', async (e) => {
      const idx = e.target.dataset['3pRuleRemove']
      if (idx !== undefined && config.thirdPartyDeferral?.userRules) {
        config.thirdPartyDeferral.userRules.splice(parseInt(idx), 1)
        render3pUserRules()
        await chrome.storage.local.set({ resourceAcceleratorConfig: config })
        notifyResourceAccelerator(config)
      }
    })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add popup.html popup.js
git commit -m "feat(ra): add user rules management UI for third-party deferral"
```

---

## 迭代 B: 性能度量对比

### Task B1: 新增性能状态和 collectPerformanceMetrics

**Files:**

- Modify: `content/modules/resource-accelerator.js` (state 对象 + init 函数区域)

- [ ] **Step 1: 在 state 对象中添加性能字段**

在 `state` 对象中 `_deferredScripts: [],` 之后添加：

```javascript
// 性能度量
performance: null,
```

- [ ] **Step 2: 新增 collectPerformanceMetrics 函数**

在 `// ========== 导出 API` 区域之前（约 760 行）添加：

```javascript
function collectPerformanceMetrics() {
  try {
    const navEntries = performance.getEntriesByType('navigation')
    if (!navEntries.length) return null
    const nav = navEntries[0]

    const resEntries = performance.getEntriesByType('resource')
    const totalDuration = resEntries.reduce((sum, e) => sum + e.duration, 0)

    const estimatedTimeSaved =
      state.stats.jsReplaced * 150 +
      (state.stats.cssReplaced || 0) * 100 +
      state.stats.fontsReplaced * 120

    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
      totalResources: resEntries.length,
      totalDuration: Math.round(totalDuration),
      replacedJs: state.stats.jsReplaced,
      replacedCss: state.stats.cssReplaced || 0,
      replacedFonts: state.stats.fontsReplaced,
      imagesCompressed: state.stats.imagesCompressed,
      bytesSaved: state.stats.imagesCompressBytesSaved,
      estimatedTimeSaved,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: 在 init() 中注册 window.load 事件**

在 `init()` 函数中 `console.log(`${LOG_PREFIX} 初始化完成`);` 之前添加：

```javascript
window.addEventListener(
  'load',
  () => {
    state.performance = collectPerformanceMetrics()
  },
  { once: true }
)
```

- [ ] **Step 4: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add collectPerformanceMetrics with Navigation Timing"
```

---

### Task B2: 暴露性能数据到 getStats

**Files:**

- Modify: `content/modules/resource-accelerator.js` (getStats 导出，约 770 行)

- [ ] **Step 1: 在 getStats 返回中添加 performance 字段**

找到 `getStats` 的返回对象，在 `recentReplacements` 之后添加 `performance`：

```javascript
getStats: () => ({
  ...state.stats,
  cspRestricted: state.cspRestricted,
  recentReplacements: state.recentReplacements.slice(-50),
  performance: state.performance,
}),
```

- [ ] **Step 2: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): expose performance metrics via getStats API"
```

---

### Task B3: Popup UI — 性能度量展示

**Files:**

- Modify: `popup.html` (在 ra-details-panel 之后)
- Modify: `popup.js`

- [ ] **Step 1: 在 popup.html 中添加性能度量展示区域**

在 `<div id="ra-details-panel"` 区域之后、缓存管理按钮之前添加：

```html
<div
  id="ra-performance-panel"
  style="margin-top: 8px; padding: 8px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 6px; display: none;"
>
  <div style="font-size: 12px; color: #2e7d32; margin-bottom: 6px; font-weight: 500;">
    加速效果（预估）
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 11px;">
    <div>首字节: <span id="ra-perf-ttfb">-</span></div>
    <div>DOM Ready: <span id="ra-perf-dcl">-</span></div>
    <div>完全加载: <span id="ra-perf-load">-</span></div>
  </div>
  <div style="margin-top: 4px; font-size: 11px; color: #555;">
    替换: JS <span id="ra-perf-js">0</span> / CSS <span id="ra-perf-css">0</span> / 字体
    <span id="ra-perf-font">0</span>
  </div>
  <div style="margin-top: 2px; font-size: 11px; color: #555;">
    图片压缩: <span id="ra-perf-img">0</span> 张，节省 <span id="ra-perf-bytes">0</span>
  </div>
  <div style="margin-top: 4px; font-size: 12px; color: #1b5e20; font-weight: 500;">
    预估节省: ~<span id="ra-perf-time">0</span>s
  </div>
</div>
```

- [ ] **Step 2: 在 popup.js 中填充性能数据**

在 `RESOURCE_ACCELERATOR_GET_STATS` 响应处理逻辑中（约 3252 行附近），添加性能数据展示：

```javascript
// 性能度量展示
if (sessionStats?.performance) {
  const perf = sessionStats.performance
  const perfPanel = document.getElementById('ra-performance-panel')
  if (perfPanel) {
    perfPanel.style.display = 'block'
    const fmt = (ms) => (ms > 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms')
    const fmtBytes = (b) =>
      b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'
    const el = (id) => document.getElementById(id)
    if (el('ra-perf-ttfb')) el('ra-perf-ttfb').textContent = perf.ttfb ? fmt(perf.ttfb) : '-'
    if (el('ra-perf-dcl'))
      el('ra-perf-dcl').textContent = perf.domContentLoaded ? fmt(perf.domContentLoaded) : '-'
    if (el('ra-perf-load'))
      el('ra-perf-load').textContent = perf.loadEvent ? fmt(perf.loadEvent) : '-'
    if (el('ra-perf-js')) el('ra-perf-js').textContent = perf.replacedJs || 0
    if (el('ra-perf-css')) el('ra-perf-css').textContent = perf.replacedCss || 0
    if (el('ra-perf-font')) el('ra-perf-font').textContent = perf.replacedFonts || 0
    if (el('ra-perf-img')) el('ra-perf-img').textContent = perf.imagesCompressed || 0
    if (el('ra-perf-bytes'))
      el('ra-perf-bytes').textContent = perf.bytesSaved ? fmtBytes(perf.bytesSaved) : '0'
    if (el('ra-perf-time'))
      el('ra-perf-time').textContent = perf.estimatedTimeSaved
        ? (perf.estimatedTimeSaved / 1000).toFixed(1)
        : '0'
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add popup.html popup.js
git commit -m "feat(ra): add performance metrics display in popup"
```

---

## 迭代 C: AVIF 图片格式支持

### Task C1: 新增 getSupportedImageFormat 函数

**Files:**

- Modify: `content/modules/resource-accelerator.js` (supportsWebP 函数之后，约 138 行)

- [ ] **Step 1: 在 state 中添加 \_imageFormat 缓存字段**

在 `state` 对象中 `_supportsWebP: undefined,` 之后添加：

```javascript
_imageFormat: null,
```

- [ ] **Step 2: 新增格式检测常量和函数**

在 `supportsWebP` 函数之后添加：

```javascript
const IMAGE_FORMAT_PRIORITY = [
  { mime: 'image/avif', test: 'image/avif' },
  { mime: 'image/webp', test: 'image/webp' },
  { mime: 'image/jpeg', test: null },
]

function getSupportedImageFormat() {
  if (state._imageFormat) return state._imageFormat
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  for (const fmt of IMAGE_FORMAT_PRIORITY) {
    try {
      if (!fmt.test) {
        state._imageFormat = fmt
        return fmt
      }
      if (canvas.toDataURL(fmt.mime).startsWith(`data:${fmt.mime}`)) {
        state._imageFormat = fmt
        return fmt
      }
    } catch {}
  }
  state._imageFormat = IMAGE_FORMAT_PRIORITY[2]
  return state._imageFormat
}
```

- [ ] **Step 3: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add getSupportedImageFormat with AVIF > WebP > JPEG priority"
```

---

### Task C2: 修改 compressImage 使用检测到的格式

**Files:**

- Modify: `content/modules/resource-accelerator.js` (compressImage 函数)

- [ ] **Step 1: 修改跳过条件，添加 .avif**

找到 `compressImage` 中的 `if (/\.(webp|svg|gif)$/i.test(url))` 行，改为：

```javascript
if (/\.(webp|svg|gif|avif)$/i.test(url)) {
```

- [ ] **Step 2: 修改 Canvas 压缩使用检测到的格式**

找到 `const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';` 行，替换为：

```javascript
const format = getSupportedImageFormat()
const mimeType = format.mime
```

- [ ] **Step 3: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): use detected optimal format in compressImage (AVIF/WebP/JPEG)"
```

---

## 迭代 D: 字体预加载优化

### Task D1: 新增字体候选状态和字重优先级函数

**Files:**

- Modify: `content/modules/resource-accelerator.js` (state 对象 + 工具方法区域)

- [ ] **Step 1: 在 state 中添加字体候选字段**

在 `state` 对象中 `_deferredScripts: [],` 之后添加：

```javascript
_fontCandidates: [],
_fontPreloadedUrls: new Set(),
```

- [ ] **Step 2: 新增字重优先级和解析函数**

在工具方法区域（`supportsWebP` 之后）添加：

```javascript
function getWeightPriority(weight) {
  if (!weight || weight === 'unknown') return 99
  const w = parseInt(weight)
  if (w === 400 || weight === 'normal') return 0
  if (w === 700 || weight === 'bold') return 1
  return 2
}

function parseFontWeight(url) {
  // Google Fonts CSS: wght@400 或 weight=400
  const queryMatch = url.match(/wght[@=](\d+)/i)
  if (queryMatch) return queryMatch[1]
  // 文件名: -Regular, -Bold, -Light 等
  const nameMatch = url.match(/-(Regular|Bold|Light|Medium|SemiBold|ExtraBold|Thin|Black)/i)
  if (nameMatch) {
    const map = {
      regular: '400',
      bold: '700',
      light: '300',
      medium: '500',
      semibold: '600',
      extrabold: '800',
      thin: '100',
      black: '900',
    }
    return map[nameMatch[1].toLowerCase()] || 'unknown'
  }
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add font candidate state and weight priority functions"
```

---

### Task D2: 重构 addPreloadHint 支持字体优先级

**Files:**

- Modify: `content/modules/resource-accelerator.js` (addPreloadHint 函数，约 500 行)

- [ ] **Step 1: 替换 addPreloadHint 函数**

将现有的 `addPreloadHint` 函数替换为：

```javascript
function addPreloadHint(cdnUrl, type, fontInfo) {
  if (state.stats.preloadHints >= state.config.maxPreloadHints) return

  if (type === 'font') {
    if (state._fontPreloadedUrls.has(cdnUrl)) return

    const weight = fontInfo?.weight || parseFontWeight(cdnUrl)
    state._fontCandidates.push({
      url: cdnUrl,
      priority: getWeightPriority(weight),
      weight: weight || 'unknown',
    })

    state._fontCandidates.sort((a, b) => a.priority - b.priority)
    state._fontCandidates = state._fontCandidates.slice(0, 3)

    _flushFontPreloads()
    return
  }

  _insertPreloadLink(cdnUrl, type)
}

function _insertPreloadLink(cdnUrl, type) {
  const head = document.head || document.documentElement
  if (head.querySelector(`link[rel="preload"][href="${cdnUrl}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = cdnUrl
  if (type === 'js') {
    link.as = 'script'
  } else if (type === 'font') {
    link.as = 'font'
    link.crossOrigin = 'anonymous'
  } else {
    link.as = 'style'
  }
  head.insertBefore(link, head.firstChild)
  state.stats.preloadHints++
}

function _flushFontPreloads() {
  for (const candidate of state._fontCandidates) {
    if (!state._fontPreloadedUrls.has(candidate.url)) {
      _insertPreloadLink(candidate.url, 'font')
      state._fontPreloadedUrls.add(candidate.url)
    }
  }
}
```

- [ ] **Step 2: 修改 processLink 中的 addPreloadHint 调用**

找到 `processLink` 函数中 `addPreloadHint(match.cdnUrl, 'css');` 的调用（约 330 行），改为根据匹配类型传入 fontInfo：

```javascript
if (fontMatch) {
  addPreloadHint(match.cdnUrl, 'font', { weight: parseFontWeight(originalHref) })
} else {
  addPreloadHint(match.cdnUrl, 'css')
}
```

- [ ] **Step 3: Commit**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): refactor addPreloadHint with font weight priority (max 3)"
```

---

## 迭代 E: 测试和收尾

### Task E1: 更新测试

**Files:**

- Modify: `tests/resource-accelerator.test.js`

- [ ] **Step 1: 新增 v6 功能测试**

在 `testResourceAccelerator` 测试函数中添加：

```javascript
// 测试第三方延迟配置（已存在，验证 userRules 字段）
this.assert(
  typeof accelerator.config.thirdPartyDeferral === 'object',
  'thirdPartyDeferral 配置存在'
)
this.assert(Array.isArray(accelerator.config.thirdPartyDeferral.userRules), 'userRules 数组存在')

// 测试性能度量（初始化后为 null，load 后有值）
this.assert(
  accelerator.performance === null || typeof accelerator.performance === 'object',
  'performance 字段存在'
)
```

- [ ] **Step 2: Commit**

```bash
git add tests/resource-accelerator.test.js
git commit -m "test(ra): add v6 feature tests"
```

---

### Task E2: 最终验证

- [ ] **Step 1: 检查所有功能完整性**

确认以下功能点：

- [ ] `getBaseDomain()` 和 `isThirdPartyScript()` 函数存在
- [ ] `matchDeferralRule()` 支持用户规则 + 内置规则 + 自动检测三级匹配
- [ ] `DEFAULT_CONFIG.thirdPartyDeferral.userRules` 字段存在
- [ ] Popup 中用户规则管理 UI 可交互（添加/删除）
- [ ] `collectPerformanceMetrics()` 使用 PerformanceNavigationTiming API
- [ ] `getStats` 返回 `performance` 字段
- [ ] Popup 中性能度量展示区域正确显示
- [ ] `getSupportedImageFormat()` 检测 AVIF > WebP > JPEG
- [ ] `compressImage()` 使用检测到的格式，跳过条件包含 .avif
- [ ] `addPreloadHint()` 支持字体字重优先级，最多 3 个
- [ ] `_insertPreloadLink()` 对 font 类型设置 `as="font"` 和 `crossOrigin`

- [ ] **Step 2: 最终 Commit**

```bash
git add content/modules/resource-accelerator.js popup.html popup.js tests/resource-accelerator.test.js
git commit -m "feat(ra): resource accelerator v6 complete - auto-detect, metrics, AVIF, font optimization"
```

---

## 实施顺序总结

```
A1 → A2 → A3 → A4 → B1 → B2 → B3 → C1 → C2 → D1 → D2 → E1 → E2
```

每个 Task 独立可验证，可单独 commit。遇到问题可暂停在任意 Task 处。
