# JS 资源加载优化实现文档

## 概述

本文档记录了对 Chrome 扩展资源加速器的 JS 资源加载优化实现，包括 defer/async 智能策略、动态 import 代码分割、脚本优先级管理等。

---

## 新增文件

### 1. `content/modules/js-optimizer.js`

独立的 JS 优化器模块，提供以下功能：

#### 核心功能

| 功能 | 描述 |
|------|------|
| **智能加载策略** | 自动决定 defer/async/lazy/module 策略 |
| **优先级分类** | critical / high / medium / low 四级优先级 |
| **动态 import** | 将非关键脚本转换为动态 import 加载 |
| **第三方脚本优化** | 分析/广告脚本自动降低优先级并延迟 |
| **依赖管理** | 脚本依赖关系图管理 |
| **预加载优化** | 关键脚本自动 preload |
| **元数据缓存** | 避免重复分析相同脚本 |

#### 类型定义

```javascript
type ScriptPriority = 'critical' | 'high' | 'medium' | 'low'
type LoadStrategy = 'auto' | 'defer' | 'async' | 'module' | 'lazy'
```

#### 核心 API

```javascript
// 优化单个脚本
JSOptimizer.optimizeScript(scriptElement)

// 批量优化
JSOptimizer.batchOptimizeScripts(scriptElements)

// 分析脚本元数据
JSOptimizer.analyzeScriptMetadata(script, url)

// 获取统计信息
JSOptimizer.getStats()
```

#### 脚本分类规则

| 分类 | 判定条件 | 默认策略 | fetchPriority |
|------|---------|---------|--------------|
| **Critical** | 第一方核心库、head 中的脚本 | defer | high |
| **High** | 第一方非核心库 | async | auto |
| **Medium** | 交互相关脚本 | async | auto |
| **Low** | 第三方分析/广告脚本 | lazy | low |

#### 第三方脚本分类

```javascript
thirdPartyPatterns: {
  analytics: [GA, GTM, 百度统计, CNZZ, 友盟],
  ads: [DoubleClick, Google Ads, AdRoll],
  social: [Facebook, Twitter, LinkedIn],
  widget: [widget, embed, player]
}
```

---

## 修改文件

### 1. `content/modules/resource-accelerator.js`

#### 新增配置项

在 `DEFAULT_CONFIG` 中添加：

```javascript
jsOptimizer: {
  enabled: true,              // 启用 JS 优化器
  autoStrategy: true,         // 自动决定 defer/async
  dynamicImport: true,        // 动态 import 代码分割
  dependencyManagement: true, // 依赖管理
  criticalPreload: true,      // 关键脚本预加载
  thirdPartyLowPriority: true, // 第三方脚本低优先级
  analyticsDeferral: true,    // 统计脚本延迟
}
```

#### 新增状态

```javascript
_cdnMatchCache: new Map(),   // CDN 匹配缓存
_cdnMatchCacheMax: 200,     // 最大缓存数量
```

#### 修改内容

##### 1. processScript 函数优化

- **集成 JS 优化器**：CDN 替换前先执行 JS 优化器
- **CDN 匹配缓存**：避免重复查询相同 URL 的 CDN 匹配

```javascript
// 优化前：每次都调用 matchJSLibraryAsync
const match = await window.CDNMappings?.matchJSLibraryAsync?.(url)

// 优化后：先查缓存
let match = state._cdnMatchCache.get(url)
if (!match) {
  match = await window.CDNMappings?.matchJSLibraryAsync?.(url)
  if (match) {
    state._cdnMatchCache.set(url, match)
  }
}
```

##### 2. createElement Hook 优化

- **快速路径**：只对 SCRIPT/LINK/IMG 标签执行 Hook，其他标签直接返回
- **减少 Object.defineProperty 调用**：只在必要时定义属性

```javascript
// 优化前：所有标签都进入判断逻辑
// 优化后：
const HOOKED_TAGS = new Set(['SCRIPT', 'LINK', 'IMG'])

document.createElement = function (tagName, options) {
  const el = _createElement(tagName, options)

  // 快速路径：非目标标签直接返回，避免性能开销
  const tag = el.tagName
  if (!HOOKED_TAGS.has(tag)) {
    return el
  }

  // ... 原有 Hook 逻辑
}
```

---

## 性能优化效果

### 预期收益

| 优化项 | 预期收益 | 实现方式 |
|--------|---------|---------|
| CDN 匹配缓存 | 查询时间减少 50-80% | Map 缓存匹配结果 |
| createElement 优化 | DOM 创建开销减少 30-50% | 快速路径跳过非目标标签 |
| 第三方脚本优化 | 首屏 JS 阻塞减少 40-60% | 分析/广告脚本延迟加载 |
| 动态 import | 初始 JS 体积减少 20-30% | 非关键路径按需加载 |

### 核心指标改进

| 指标 | 预期改进 |
|------|---------|
| **LCP** | 10-25% |
| **FCP** | 15-30% |
| **TBT** | 20-40% |
| **主线程阻塞** | 30-50% |

---

## 实现原则

### 1. 渐进增强

- 不破坏现有功能，优化是附加的
- 失败时优雅回退到原行为
- 可通过配置开关单独禁用

### 2. 尊重原始意图

- 已有 `defer`/`async`/`type="module"` 属性的脚本保持原有行为
- 核心库不做过度优化
- 第一方脚本优先保证功能正确性

### 3. 性能与功能平衡

- 快速路径优先于完整性检查
- 缓存策略有上限，避免内存泄漏
- 元数据分析有超时保护

---

## 已知限制

1. **动态 import 限制**：仅对第一方非模块脚本生效
2. **依赖检测**：静态分析无法检测所有依赖关系
3. **CSP 限制**：严格的 CSP 策略可能阻止动态脚本插入
4. **内联脚本**：当前不处理内联脚本（无 src 属性）

---

## 后续优化方向

1. **执行顺序保证**：通过依赖管理确保脚本加载顺序
2. **内联脚本优化**：非关键内联脚本延迟执行
3. **预取智能预测**：基于用户行为预测需要的脚本
4. **流式编译**：利用 Streaming JavaScript 编译优化
5. **代码覆盖率分析**：基于真实使用数据的动态代码分割

---

## 测试验证

### 功能测试

- [ ] 第一方核心脚本正常执行
- [ ] 第三方分析脚本正确延迟
- [ ] CDN 替换功能正常工作
- [ ] 页面无控制台错误

### 性能测试

- [ ] LCP 指标改善
- [ ] TBT 指标改善
- [ ] 无新增长任务
- [ ] createElement 调用开销降低

---

## CSS 资源加载优化实现

### 概述

实现了独立的 CSS 优化器模块，提供关键 CSS 提取、非关键 CSS 延迟加载、媒体查询拆分、字体加载优化等功能。

### 新增文件

#### 1. `content/modules/css-optimizer.js`

独立的 CSS 优化器模块，提供以下功能：

| 功能 | 描述 |
|------|------|
| **关键CSS提取** | 自动提取首屏渲染所需的关键样式规则 |
| **非关键CSS延迟** | 非首屏样式延迟加载，避免阻塞渲染 |
| **媒体查询拆分** | 按媒体查询条件拆分CSS，按需加载 |
| **CSS去重** | 移除重复的CSS规则 |
| **字体加载优化** | font-display: swap，避免FOIT |
| **FOUC防护** | 防止无样式内容闪烁 |

#### 核心 API

```javascript
// 初始化
CSSOptimizer.init(config)

// 处理单个样式表
CSSOptimizer.processStylesheet(linkElement)

// 提取关键CSS
CSSOptimizer.extractCriticalCSS(cssContent)

// 内联关键CSS
CSSOptimizer.inlineCriticalCSS(cssContent)

// 延迟加载非关键CSS
CSSOptimizer.deferNonCriticalCSS(url, options)

// 媒体查询拆分
CSSOptimizer.splitByMediaQuery(cssContent)

// CSS去重
CSSOptimizer.deduplicateCSS(cssContent)

// 获取统计信息
CSSOptimizer.getStats()
```

#### 关键CSS提取规则

| 规则类型 | 处理策略 |
|---------|---------|
| `@font-face` | 始终视为关键 |
| 当前媒体查询匹配的规则 | 提取内部关键规则 |
| 非当前媒体查询 | 延迟加载 |
| 匹配首屏元素的规则 | 视为关键 |
| 其他规则 | 归为非关键 |

#### 首屏元素判定

1. **位置判定**：元素顶部位置在视口高度范围内
2. **选择器匹配**：匹配关键选择器（header, nav, main, .hero等）
3. **面积判定**：元素面积占视口面积 > 5%

#### 字体加载优化

```javascript
// 自动添加 font-display: swap
css.replace(/(@font-face\s*\{)/gi, '$1font-display:swap;')

// 预加载关键字体（前3个）
<link rel="preload" as="font" href="..." crossorigin="anonymous">
```

#### FOUC防护

```javascript
// 临时隐藏未样式化的内容
html:not([data-styled]) body {
  visibility: hidden;
}

// 所有样式加载完成后显示
document.documentElement.setAttribute('data-styled', 'true')
```

---

### 修改文件

#### 1. `content/modules/resource-accelerator.js`

##### 新增配置项

```javascript
cssOptimizer: {
  enabled: true,
  criticalCSSExtraction: true,     // 关键CSS提取
  nonCriticalDefer: true,          // 非关键CSS延迟
  mediaQuerySplit: true,           // 媒体查询拆分
  cssDedup: true,                  // CSS去重
  fontDisplaySwap: true,           // 字体font-display: swap
  avoidFOUC: true,                 // 避免FOUC
  maxCriticalRules: 200,           // 最大关键CSS规则数
  criticalSelectors: [             // 关键选择器
    'header', 'nav', 'main', '.hero', '.above-fold',
    '.container', '.content', '#app', '#root'
  ],
  deferThreshold: {
    viewportRatio: 0.5,
    distanceFromTop: 1000
  },
  fontOptimization: {
    preload: true,
    swap: true,
    fallbackFonts: true
  }
}
```

##### 修改 processLink 函数

在 CDN 匹配前集成 CSS 优化器：

```javascript
// CSS优化器集成：CDN匹配前先进行CSS优化
if (window.CSSOptimizer && state.config.cssOptimizer?.enabled && link.rel === 'stylesheet') {
  CSSOptimizer.processStylesheet(link).catch(err => {
    addLog('warn', 'style', 'css_optimizer_error', { url, error: err.message })
  })
  return
}
```

---

### 性能优化效果

#### 预期收益

| 优化项 | 预期收益 | 实现方式 |
|--------|---------|---------|
| 关键CSS内联 | FCP 改善 15-25% | 首屏样式立即渲染 |
| 非关键CSS延迟 | 首屏渲染阻塞减少 40-60% | 异步加载非首屏样式 |
| 媒体查询拆分 | 按需加载减少 30-50% | 只加载当前媒体查询的样式 |
| CSS去重 | CSS体积减少 5-15% | 移除重复规则 |
| 字体加载优化 | FOIT 减少 80-100% | font-display: swap |
| FOUC防护 | 用户体验提升 | 平滑过渡 |

#### 核心指标改进

| 指标 | 预期改进 |
|------|---------|
| **FCP** | 15-30% |
| **LCP** | 10-20% |
| **CLS** | 5-10% |
| **阻塞时间** | 40-60% |

---

### 实现原则

#### 1. 智能提取

- 基于元素位置和选择器匹配判断关键性
- 字体声明始终视为关键
- 当前媒体查询匹配的规则优先处理
- 最大规则数限制防止过度内联

#### 2. 渐进增强

- CSS 优化器独立模块，可选启用
- 失败时优雅回退到原行为
- 与 CDN 替换功能兼容
- 不破坏现有样式层叠关系

#### 3. 性能优先

- 异步处理避免阻塞主线程
- Blob URL 避免额外网络请求
- 缓存机制避免重复处理
- 规则数限制防止过度内联

---

### 已知限制

1. **动态内容**：后续动态插入的元素可能需要额外样式
2. **媒体查询变化**：窗口大小变化时需要重新评估
3. **跨域限制**：无法获取跨域 CSS 内容（回退到原行为）
4. **性能权衡**：过度内联关键 CSS 可能增加 HTML 体积

---

### 后续优化方向

1. **动态关键CSS**：根据页面内容动态调整关键CSS提取
2. **自适应规则数**：根据页面复杂度自动调整最大规则数
3. **CSS层次管理**：利用CSS Layers优化样式优先级
4. **响应式预加载**：根据设备特性预加载相应媒体查询的CSS
5. **实时监控**：监控CSS加载性能，动态调整策略

---

### 测试验证

#### 功能测试

- [ ] 关键CSS正确提取并内联
- [ ] 非关键CSS延迟加载
- [ ] 字体显示正常，无FOIT
- [ ] 无FOUC现象
- [ ] 页面样式正确渲染
- [ ] 媒体查询按需加载

#### 性能测试

- [ ] FCP 指标改善
- [ ] LCP 指标改善
- [ ] CLS 指标改善
- [ ] 首屏渲染阻塞时间减少
- [ ] CSS体积减少

---

## HTML 解析和渲染优化实现

### 概述

实现了独立的 HTML 优化器模块，提供资源预加载提示、优先级优化、关键渲染路径优化、DNS 预解析、骨架屏支持、DOM 解析优化等功能。

### 新增文件

#### 1. `content/modules/html-optimizer.js`

独立的 HTML 优化器模块，提供以下功能：

| 功能 | 描述 |
|------|------|
| **预加载提示** | preload/prefetch 自动添加 |
| **预连接** | DNS 预解析 + TCP 预连接 |
| **优先级优化** | fetch-priority 自动设置 |
| **关键渲染路径** | 识别关键资源，移除渲染阻塞 |
| **骨架屏** | 加载中占位符动画 |
| **DOM 解析优化** | 分块处理，使用 requestIdleCallback |

#### 核心 API

```javascript
// 初始化
HTMLOptimizer.init(config)

// 预加载
HTMLOptimizer.addPreload(url, type, options)
HTMLOptimizer.addPrefetch(url, type)

// 预连接
HTMLOptimizer.addDNSPrefetch(origin)
HTMLOptimizer.addPreconnect(origin)
HTMLOptimizer.addPreconnects(origins)

// 优先级
HTMLOptimizer.setFetchPriority(element, priority)
HTMLOptimizer.autoSetPriority(element)

// 关键渲染路径
HTMLOptimizer.identifyCriticalResources()
HTMLOptimizer.preloadCriticalResources()
HTMLOptimizer.removeRenderBlocking()

// 骨架屏
HTMLOptimizer.createSkeleton(element, options)

// DOM 解析
HTMLOptimizer.chunkedProcess(nodes, processor, options)
HTMLOptimizer.deferNonCritical(task, delay)

// 统计
HTMLOptimizer.getStats()
```

#### 预加载提示规则

| 资源类型 | 预加载策略 | 优先级 |
|---------|-----------|--------|
| **关键样式** | head 中的样式表 | high |
| **关键脚本** | head 中的同步脚本 | high |
| **关键字体** | @font-face 中的字体 | high |
| **首屏大图** | 占屏幕 > 5% 的图片 | high |

#### 预连接策略

```javascript
// 常用 CDN 源自动预连接
const commonOrigins = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
]
```

#### 骨架屏实现

```javascript
// 为元素创建骨架屏
const removeSkeleton = HTMLOptimizer.createSkeleton(element, {
  placeholderColor: '#f0f0f0',
  animationDuration: 300,
})

// 内容加载完成后移除骨架屏
removeSkeleton()
```

#### DOM 解析优化

```javascript
// 分块处理大量 DOM 节点
HTMLOptimizer.chunkedProcess(nodes, (node) => {
  // 处理每个节点
}, {
  chunkSize: 50,      // 每批处理 50 个
  chunkDelay: 16,     // 批次间隔 16ms
  idleCallback: true, // 使用 requestIdleCallback
})
```

---

### 修改文件

#### 1. `content/modules/resource-accelerator.js`

##### 新增配置项

在 `DEFAULT_CONFIG` 中添加：

```javascript
htmlOptimizer: {
  enabled: true,
  // 预加载提示
  preload: {
    enabled: true,
    maxPreloads: 15,              // 最大预加载数量
    maxPrefetch: 10,              // 最大预取数量
    criticalResources: true,      // 自动识别关键资源
    fontPreload: true,            // 字体预加载
    imagePreload: true,           // 关键图片预加载
    stylePreload: true,           // 关键样式预加载
    scriptPreload: true,          // 关键脚本预加载
  },
  // 预连接
  preconnect: {
    enabled: true,
    maxPreconnect: 10,            // 最大预连接数量
    dnsPrefetch: true,            // DNS 预解析
    tcpPreconnect: true,          // TCP 预连接
    importantOrigins: [],         // 重要源列表
  },
  // 优先级优化
  priority: {
    enabled: true,
    autoFetchPriority: true,      // 自动设置 fetch-priority
    lcpPriority: 'high',          // LCP 元素优先级
    viewportPriority: 'high',     // 视口元素优先级
    belowFoldPriority: 'low',     // 折叠下方元素优先级
  },
  // 关键渲染路径
  criticalPath: {
    enabled: true,
    inlineCriticalCSS: true,      // 内联关键 CSS
    deferNonCriticalJS: true,     // 延迟非关键 JS
    removeRenderBlocking: true,   // 移除渲染阻塞资源
    asyncStyles: true,            // 异步加载样式
  },
  // 骨架屏/占位符
  skeleton: {
    enabled: true,
    autoGenerate: false,          // 自动生成骨架屏（实验性）
    placeholderColor: '#f0f0f0',
    animationDuration: 300,
    selectors: [],                // 需要骨架屏的选择器
    maxSkeletons: 10,             // 最大骨架屏数量
  },
  // DOM 解析优化
  domParsing: {
    enabled: true,
    deferDOMReady: true,          // 延迟 DOMContentLoaded 处理
    chunkedParsing: true,         // 分块解析
    idleCallback: true,           // 使用 requestIdleCallback
    chunkSize: 50,                // 每批处理的 DOM 节点数
    chunkDelay: 16,               // 每批之间的延迟（ms）
  },
}
```

##### 集成点

1. **初始化阶段**：在 `init()` 中初始化 HTML 优化器

```javascript
// 1.5. 初始化 HTML 优化器（预连接、预加载提示）
if (window.HTMLOptimizer && state.config.htmlOptimizer?.enabled) {
  window.HTMLOptimizer.init(state.config.htmlOptimizer)
}
```

2. **LCP 保护图片**：添加预加载提示

```javascript
// HTML 优化器：添加预加载提示
if (window.HTMLOptimizer && state.config.htmlOptimizer?.enabled) {
  window.HTMLOptimizer.addPreload(img.src, 'image', { priority: 'high' })
}
```

3. **视口内图片**：自动设置优先级

```javascript
// HTML 优化器：自动设置优先级
if (window.HTMLOptimizer && state.config.htmlOptimizer?.priority?.autoFetchPriority) {
  window.HTMLOptimizer.autoSetPriority(img)
}
```

4. **统计信息**：`getStats()` 包含 HTML 优化器统计

```javascript
getStats: () => ({
  ...state.stats,
  htmlOptimizer: window.HTMLOptimizer?.getStats() || null,
})
```

---

### 性能优化效果

#### 预期收益

| 优化项 | 预期收益 | 实现方式 |
|--------|---------|---------|
| DNS 预解析 | DNS 查询时间减少 100-300ms | 提前解析关键域名 |
| TCP 预连接 | 连接建立时间减少 100-200ms | 提前建立 TCP/TLS 连接 |
| 资源预加载 | 资源加载提前 200-500ms | preload 提示 |
| 优先级优化 | 关键资源加载优先 30-50% | fetch-priority 设置 |
| 移除渲染阻塞 | FCP 改善 15-30% | async/defer 策略 |
| 骨架屏 | 感知加载速度提升 | 加载占位符 |
| DOM 分块处理 | 主线程阻塞减少 40-60% | requestIdleCallback |

#### 核心指标改进

| 指标 | 预期改进 |
|------|---------|
| **LCP** | 15-30% |
| **FCP** | 20-35% |
| **TTFB** | 10-20% |
| **TBT** | 40-60% |

---

### 实现原则

#### 1. 渐进增强

- 预加载和预连接是提示性的，浏览器可忽略
- 失败时优雅回退到原行为
- 可通过配置开关单独禁用

#### 2. 智能识别

- 自动识别关键资源（head 中的脚本/样式）
- 基于位置判断优先级（视口内 vs 折叠下方）
- 基于面积判断 LCP 候选（占屏幕 > 5%）

#### 3. 性能优先

- 使用 requestIdleCallback 进行低优先级处理
- 分块处理避免长任务
- 缓存已处理的 URL 避免重复

---

### 已知限制

1. **预连接数量限制**：过多预连接会稀释效果，限制为 10 个
2. **骨架屏自动生成**：当前为实验性功能，默认禁用
3. **跨域限制**：无法获取跨域样式表内容进行关键 CSS 提取
4. **浏览器支持**：fetch-priority 在旧浏览器中不支持，自动降级

---

### 后续优化方向

1. **智能预取**：基于用户行为预测下一页资源
2. **Service Worker 集成**：利用 Service Worker 缓存预取资源
3. **自适应预加载**：根据网络状况动态调整预加载数量
4. **骨架屏模板**：提供常用骨架屏模板库
5. **实时监控**：监控预加载命中率，动态调整策略

---

### 测试验证

#### 功能测试

- [ ] 预加载提示正确添加
- [ ] 预连接提示正确添加
- [ ] 优先级正确设置
- [ ] 骨架屏正确显示和移除
- [ ] DOM 分块处理正常工作
- [ ] 页面无控制台错误

#### 性能测试

- [ ] FCP 指标改善
- [ ] LCP 指标改善
- [ ] TTFB 指标改善
- [ ] TBT 指标改善
- [ ] 首屏渲染时间减少

---

**文档生成时间**: 2026-05-14
**版本**: v1.1
