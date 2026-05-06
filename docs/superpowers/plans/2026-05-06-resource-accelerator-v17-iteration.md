# 资源加速器 v17 迭代计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 基线版本：v16（关键资源预加载升级 + LQIP渐进式占位）
> 创建时间：2026-05-06

**Goal:** 通过 CSS content-visibility 和 fetchPriority 全局扫描，减少非可视区渲染开销并优化资源下载优先级。

**Architecture:** 迭代1注入 `content-visibility: auto` CSS规则，让浏览器跳过非可视区元素的渲染。迭代2增强 PriorityOptimizer，在 init 时扫描所有已存在的 DOM 资源并批量应用 fetchPriority。

**Tech Stack:** CSS `content-visibility`, `contain-intrinsic-size`, JavaScript `fetchPriority`

---

## 迭代 1: content-visibility 渲染优化

**目标：** 跳过非可视区元素的渲染，减少首屏渲染时间

### 问题分析

浏览器会对所有 DOM 元素进行布局和绘制，即使它们不在可视区内。`content-visibility: auto` 告诉浏览器跳过非可视区元素的渲染，直到用户滚动到它们附近。这对长页面（新闻、电商、博客）效果显著。

### 功能设计

注入 CSS 规则，对以下元素应用 `content-visibility: auto`：
- `article` / `section` / `aside` — 内容区块
- `.sidebar` / `.footer` / `.comments` — 非关键区域
- `nav` — 导航（折叠时跳过）

**配置：**
```javascript
contentVisibility: {
  enabled: true,
  // 应用 content-visibility: auto 的选择器
  selectors: [
    'article',
    'section',
    'aside',
    '.sidebar',
    '.footer',
    '.comments',
  ],
  // 排除的选择器（不应用）
  excludeSelectors: [
    'nav',  // 导航通常在首屏，不跳过
    'header',
    '.above-fold',
  ],
},
```

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG**（在 `lqip` 配置之后）：
```javascript
// content-visibility 渲染优化
contentVisibility: {
  enabled: true,
  selectors: ['article', 'section', 'aside', '.sidebar', '.footer', '.comments'],
  excludeSelectors: ['nav', 'header', '.above-fold'],
},
```

**2. 添加 CSS 注入函数**（在 `_injectLqipCSS` 函数之后）：
```javascript
// ========== content-visibility 渲染优化 ==========
let _contentVisibilityInjected = false;

function _injectContentVisibilityCSS() {
  if (_contentVisibilityInjected) return;
  const config = state.config.contentVisibility;
  if (!config?.enabled) return;

  const includeSelector = config.selectors.join(', ');
  const excludeSelector = config.excludeSelectors.map(s => `:not(${s})`).join('');

  const style = document.createElement('style');
  style.textContent = `
    ${includeSelector}${excludeSelector} {
      content-visibility: auto;
      contain-intrinsic-size: 0 500px;
    }
  `;
  const head = document.head || document.documentElement;
  head.appendChild(style);
  _contentVisibilityInjected = true;
}
```

**3. 在 init() 中调用**（在 `_injectLqipCSS()` 之后）：
```javascript
// 注入 content-visibility 样式
_injectContentVisibilityCSS();
```

### 验收标准

- [ ] 非可视区元素应用 `content-visibility: auto`
- [ ] 首屏元素（nav/header）不被跳过
- [ ] 配置可禁用
- [ ] 不影响页面功能

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 可视区边界计算不准 | 内容闪烁 | contain-intrinsic-size 提供预估高度 |
| 固定定位元素被跳过 | 布局错乱 | excludeSelectors 排除关键元素 |

---

## 迭代 2: fetchPriority 全局扫描

**目标：** 在页面加载时扫描所有已有资源，批量应用 fetchPriority

### 问题分析

当前 PriorityOptimizer 只在 `processScript`/`processLink`/`processImage` 时逐个应用 fetchPriority。但页面加载时已存在的 `<script>`/`<link>`/`<img>` 元素不会被处理。需要在 init 时批量扫描并应用。

### 功能设计

PriorityOptimizer 新增 `applyToExistingElements()` 方法，在 init 时扫描：
- 所有 `<script src>` — 根据类型和位置设置 fetchPriority
- 所有 `<link rel="stylesheet">` — 首屏样式 high，其余 auto
- 所有 `<img src>` — 首屏 high，可视区下方 lazy + low

**配置：**
```javascript
priorityOptimizer: {
  // ...existing...
  scanExisting: {
    enabled: true,
    maxElements: 50,  // 最大扫描数量
  },
},
```

### 集成代码

**1. 添加配置到 DEFAULT_CONFIG**（在 `priorityOptimizer` 中添加 `scanExisting`）：
```javascript
priorityOptimizer: {
  // ...existing config...
  scanExisting: {
    enabled: true,
    maxElements: 50,
  },
},
```

**2. PriorityOptimizer 新增方法**（在 `applyPriorityToResource` 之后）：
```javascript
applyToExistingElements() {
  if (!this.config.scanExisting?.enabled) return;

  const viewportHeight = window.innerHeight;
  let count = 0;
  const max = this.config.scanExisting.maxElements || 50;

  // 扫描 script
  document.querySelectorAll('script[src]').forEach(script => {
    if (count >= max) return;
    this.applyPriorityToResource(script, script.src, 'script');
    count++;
  });

  // 扫描 link (stylesheet)
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    if (count >= max) return;
    this.applyPriorityToResource(link, link.href, 'style');
    count++;
  });

  // 扫描 img
  document.querySelectorAll('img[src]').forEach(img => {
    if (count >= max) return;
    const rect = img.getBoundingClientRect();
    const isInViewport = rect.top < viewportHeight;
    const priority = isInViewport ? 0 : 3;
    this.applyPriorityToResource(img, img.src, 'image');
    // 首屏外图片额外设置 lazy
    if (!isInViewport && img.loading !== 'lazy') {
      img.loading = 'lazy';
    }
    count++;
  });

  console.log(`${LOG_PREFIX} [PriorityOptimizer] 扫描已有资源: ${count} 个`);
}
```

**3. 在 PriorityOptimizer.init() 中调用**（在 `this.calculatePriority()` 之后）：
```javascript
init() {
  if (!this.config.enabled) return;
  this.detectNetworkQuality();
  this.detectPageType();
  this.calculatePriority();
  this.applyToExistingElements();  // 新增
  this.listenNetworkChanges();
  console.log(`${LOG_PREFIX} [PriorityOptimizer] 初始化完成`);
}
```

### 验收标准

- [ ] 页面加载时扫描已有 script/link/img 元素
- [ ] 根据可视区位置设置 fetchPriority
- [ ] 首屏外图片设置 loading=lazy
- [ ] 扫描数量不超过 maxElements 限制
- [ ] 不影响已处理的元素（通过 fetchPriority 属性存在性判断）

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 扫描时机过早 | 部分元素尚未加载 | MutationObserver 兜底 |
| 与 processImage 冲突 | 重复设置 | PriorityOptimizer 有 enabled 判断 |

---

## 实施顺序

```
迭代1: content-visibility → 迭代2: fetchPriority升级
```

两个迭代独立，无依赖关系。

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 新增配置有合理默认值
