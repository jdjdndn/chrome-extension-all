# 全链路用户体验优化计划

> 从浏览器输入URL到用户看到内容、进行交互的完整链路优化方案

## 一、当前架构概要

项目采用分层架构:
- **Background Service Worker** (`background.js`): 管理扩展生命周期、域名阻止规则、DeclarativeNetRequest、消息路由
- **Content Scripts** (`content/core-bundle.js`): 通过 `LoadScheduler` + `LazyInitManager` 实现 L1-L4 分层懒初始化
- **页面注入脚本** (`inject.js`): 在页面上下文拦截 fetch/XHR 实现 mock
- **站点工厂** (`SiteFactory` + `SiteBase`): 基于域名自动匹配和创建站点实例
- **资源加速器** (`ResourceAccelerator`): CDN 替换、字体替换、CSS 加速、图片优化
- **EventBus v4.6**: 跨环境消息系统 (content script / background / devtools / page context)

---

## 二、阶段一：浏览器输入 URL 阶段

### 2.1 问题分析

当前 `background.js` 中的脚本注入策略存在以下问题:

1. **注入时机滞后**: `markTabsForLazyInjection` 在扩展安装/更新后 500ms 才执行，且仅注入当前激活 tab。其他 tab 需要等到 `onActivated` 或 `onUpdated` 事件才注入。

2. **重复检测开销**: 每次 tab 激活时通过 `chrome.scripting.executeScript` 检查 `window.ExtensionAPI` 是否存在，这个跨进程调用本身有延迟。

3. **串行注入**: `injectAllScriptsForTab` 采用 `for...of` 串行注入多个脚本文件 (`core-bundle.js`, `common-bundle.js`, 域名 bundle)，每个脚本都需要等待前一个完成。

### 2.2 优化方案

**方案 A：预解析域名匹配（零成本域名检测）**

在 `background.js` 的 `onUpdated` 事件中，当 `changeInfo.status === 'loading'` 时就执行域名匹配和脚本预注册，而非等到 `complete`。

具体步骤:
- 在 `chrome.tabs.onUpdated` 的 `loading` 阶段，提取 URL 的 hostname
- 与 `domainScripts` 映射表做匹配，如果匹配到域名脚本，提前将脚本路径缓存到一个 Map 中
- 当 `complete` 事件触发时，直接使用缓存的脚本列表，跳过重复的 URL 解析和域名匹配

**方案 B：并行注入基础脚本**

修改 `injectAllScriptsForTab` 中的注入逻辑:
- `core-bundle.js` 和 `common-bundle.js` 如果都需要注入，使用 `Promise.all` 并行注入而非串行
- 域名 bundle 脚本可以在基础脚本注入完成后立即注入（因为域名脚本依赖基础脚本中的全局变量）

**方案 C：基于 webNavigation 的更早拦截**

在 `manifest.json` 中增加 `webNavigation` 权限的利用:
- 监听 `chrome.webNavigation.onBeforeNavigate` 事件，在页面开始加载时就确定需要注入的脚本
- 利用 `chrome.webNavigation.onCommitted` 在导航提交时注入最关键的脚本

### 2.3 实施步骤

1. 在 `background.js` 中增加 `onBeforeNavigate` 监听器，提前解析域名
2. 将域名匹配结果缓存到内存 Map 中（key: tabId, value: { scripts: [], timestamp }）
3. 修改 `injectAllScriptsForTab` 支持并行注入基础脚本
4. 添加注入完成后的性能埋点，用于后续分析

---

## 三、阶段二：页面加载阶段

### 3.1 问题分析

1. **Content Script 加载链过长**: `core-bundle.js` 内部通过 `content/entries/core.js` 导入了大量模块（约 30+ 个文件），虽然采用了 `LoadScheduler` 区分关键/空闲/延迟模块，但所有模块的 IIFE 仍在 bundle 中顺序执行。

2. **ResourceAccelerator 初始化阻塞**: 在 `core.js` 入口中，`resource-accelerator.js` 被标记为关键模块（立即加载），其 `init()` 方法会执行配置加载、缓存加载、CDN 探测等异步操作。

3. **LazyInitManager 的激活时机**: 当前只有收到 `EXTENSION_ACTIVATE` 消息时才初始化 L2 核心层，但某些功能（如隐藏元素）需要更早生效。

4. **newtab.html 的关键渲染路径**: `newtab.html` 已经做了较好的优化（内联关键 CSS、骨架屏、preconnect），但 `newtab.js` (91KB) 的加载和执行仍会阻塞交互。

### 3.2 优化方案

**方案 A：Content Script 分级注入优化**

将 `core-bundle.js` 进一步拆分为:
- **critical-bundle.js** (极小): 仅包含 `LoadScheduler`、`EventBus` 基础通信、域名检测、`inject.js` 注入逻辑
- **core-bundle.js** (懒加载): 其余核心模块通过 `LoadScheduler.registerIdle` 在浏览器空闲时加载

这可以将 content script 的首次执行时间从当前的全量执行减少到仅执行最关键的几 KB 代码。

**方案 B：ResourceAccelerator 延迟初始化**

将 `resource-accelerator.js` 从"关键模块"改为"空闲模块":
- CDN 映射表 (`cdn-mappings.js`) 仍保持立即加载（用于拦截）
- 但 `ResourceAccelerator.init()` 中的配置加载和缓存加载延迟到 `requestIdleCallback`
- 页面中已有的资源立即使用内存缓存替换，缓存未命中时再异步加载持久化缓存

**方案 C：预注入隐藏元素样式**

在 `content.js` 的 `initHideElements` 中，当前需要等待 `DOMUtils` 加载完成才能获取域名和应用隐藏规则。优化方案:
- 将域名默认隐藏选择器硬编码到 `core-bundle.js` 的关键路径中
- 在 `document_start` 阶段直接注入 `<style>` 标签（不依赖 DOMUtils）
- 这样广告/弹窗等元素在 DOM 解析前就被 CSS 隐藏，减少布局闪烁

**方案 D：newtab.js 代码分割**

当前 `newtab.js` 有 91KB，包含所有功能（天气、每日一言、快捷链接、历史记录、设置等）。优化方案:
- 将天气 API 调用、每日一言数据独立为按需加载的模块
- 使用 `requestIdleCallback` 加载非首屏功能
- 快捷链接的渲染使用虚拟列表（如果链接数量较多）

### 3.3 实施步骤

1. 拆分 `content/entries/core.js`，提取 critical 部分为独立入口
2. 修改 `vite.config.js` 中的 `CONTENT_BUNDLES` 配置，增加 critical bundle
3. 修改 `manifest.json` 的 `content_scripts` 配置，仅注入 critical bundle
4. 在 `LoadScheduler` 中增加自动触发机制，不依赖 `EXTENSION_ACTIVATE` 消息
5. 对 `newtab.js` 进行动态 import 拆分

---

## 四、阶段三：内容渲染阶段

### 4.1 问题分析

1. **DOM 监听器的性能开销**: `UnifiedDOMWatcher` 虽然已经是单例模式并支持优先级，但其 `subtree: true` 的配置会在每次 DOM 变化时触发大量回调。

2. **隐藏元素的应用时机**: `applyHideElementsStyle` 通过动态创建 `<style>` 标签来应用隐藏规则，但如果 DOM 已经渲染完成才应用，用户会短暂看到被隐藏的元素（闪烁）。

3. **站点脚本的初始化阻塞**: `SiteBase.init()` 会依次执行: 检测本地服务 → 注册阻止域名 → 加载设置 → 自定义初始化 → 应用隐藏元素，其中每一步都有异步等待。

4. **CSS 加载策略**: `styles.css` 作为 content script 的 CSS 在 `document_start` 加载，但其中包含的样式（如 `.extension-button`）在页面加载初期并不需要。

### 4.2 优化方案

**方案 A：关键 CSS 内联 + 非关键 CSS 异步**

参考 `newtab.html` 的优化策略，将隐藏元素相关的 CSS 直接内联到 `core-bundle.js` 中:
```javascript
// 在 document_start 阶段直接注入
const style = document.createElement('style')
style.textContent = `.ad-banner, .popup-overlay { display: none !important; }`
document.documentElement.appendChild(style)
```
这样在 DOM 解析的最早期就应用了隐藏规则，完全消除闪烁。

**方案 B：DOM 变化批处理优化**

优化 `UnifiedDOMWatcher` 的批处理逻辑:
- 将 `_debounceDelay` 从 16ms 调整为可配置，对于高优先级 (CRITICAL) 回调使用 `requestAnimationFrame` 立即执行
- 对于普通优先级回调，使用 `requestIdleCallback` 并设置合理的 timeout
- 添加变化统计和自适应节流: 如果单帧内变化超过阈值（如 100 个 mutation），自动降级为批量处理

**方案 C：站点初始化流水线并行化**

修改 `SiteBase.init()` 的执行策略:
- 将"检测本地服务"和"注册阻止域名"改为并行执行（它们互不依赖）
- 将"加载设置"和"自定义初始化"中不依赖设置的部分也并行执行
- 仅在需要设置数据的步骤才等待 `loadSettings` 完成

**方案 D：IntersectionObserver 驱动的按需渲染**

对于页面中的大量列表项（如 B站推荐视频、抖音视频流），使用 IntersectionObserver 替代 DOM 监听:
- 仅渲染视口内及附近（预加载区域）的元素
- 离开视口的元素用占位符替代
- 这与项目中已有的 `VirtualList.js` 模块结合使用

### 4.3 实施步骤

1. 在 `content.js` 的立即执行部分增加隐藏元素的 CSS 内联注入
2. 修改 `UnifiedDOMWatcher` 增加自适应节流逻辑
3. 重构 `SiteBase.init()` 为并行流水线
4. 为各站点脚本（bili.js, douyin.js 等）添加 IntersectionObserver 支持

---

## 五、阶段四：用户交互阶段

### 5.1 问题分析

1. **消息通信延迟**: content script 与 background 之间的消息通过 `EventBus.request` 发送，每次通信都有序列化/反序列化和跨进程开销。

2. **Storage 读写延迟**: `StorageUtils.getSync` 虽然名称中有 "Sync"，但实际是异步的，依赖 `chrome.storage` API。

3. **脚本开关检查的同步/异步不一致**: `getScriptSwitch` 是同步的（使用内存缓存），但 `getScriptSwitchAsync` 是异步的，代码中两处使用不一致。

4. **Popup 打开延迟**: `popup.html` (47KB) + `popup.js` (104KB) 的加载和执行需要时间，用户点击扩展图标后需要等待。

5. **元素拾取器的注入延迟**: `injectElementPickerScript` 需要动态创建 `<script>` 标签注入页面上下文，然后等待 `onload` 事件，再通过 `CustomEvent` 发送启动命令，整个链路有多个异步环节。

### 5.2 优化方案

**方案 A：消息通信批处理**

在 `Services.sendToBackground` 中增加消息批处理:
- 将短时间内的多个消息合并为一个批量请求
- background 端拆分并并行处理
- 减少跨进程通信次数

**方案 B：Storage 缓存层优化**

当前 `CacheManager` 已经支持 TTL/LRU/LFU 策略，但需要更积极地利用:
- 对于频繁读取的配置（如脚本开关、隐藏选择器），在 content script 中维护一个内存缓存副本
- 使用 `chrome.storage.onChanged` 事件同步变更
- 对于写操作，采用 write-back 策略: 先更新内存缓存，再异步持久化

**方案 C：Popup 预加载**

利用 Chrome 扩展的 popup 特性进行优化:
- 在 `background.js` 中监听 `chrome.action.onClicked`，提前准备 popup 所需的数据
- 将 popup 的核心 HTML/CSS 内联到 `popup.html` 的 `<head>` 中（已有部分内联）
- 将 `popup.js` 中的非关键功能（如设置页面、域名管理）拆分为按需加载的子模块

**方案 D：元素拾取器优化**

优化拾取器的注入链路:
- 在扩展安装时就预注入拾取器脚本到所有页面（通过 `web_accessible_resources` + `document_start` 注入）
- 拾取器默认处于休眠状态，仅在收到 `START` 命令时激活
- 减少动态脚本注入的延迟

**方案 E：键盘快捷键优化**

当前 `keyboard-pagination.js` 和 `keyboard-click.js` 已实现键盘翻页功能，但需要:
- 在 `content.js` 中尽早注册键盘事件监听（document_start 阶段）
- 使用 `addEventListener` 的 `capture: true` 选项确保在页面脚本之前拦截
- 添加快捷键冲突检测和用户自定义支持

### 5.3 实施步骤

1. 在 `Services` 模块中实现消息批处理接口
2. 修改 `CacheManager` 支持 write-back 策略
3. 在 `background.js` 中增加 popup 预热逻辑
4. 将 `element-picker-inject.js` 改为预注入模式
5. 在 `keyboard-pagination.js` 中增加 capture 阶段监听

---

## 六、跨阶段优化

### 6.1 性能监控体系

建立端到端的性能监控:
- 在每个阶段的关键路径添加 Performance API 标记 (`performance.mark` / `performance.measure`)
- 记录以下指标:
  - `TTI_ScriptInject`: 从 URL 输入到 content script 注入完成
  - `TTI_CoreInit`: 从注入到核心模块初始化完成
  - `TTI_SiteInit`: 从核心初始化到站点脚本初始化完成
  - `TTI_FirstPaint`: 隐藏元素首次应用时间
  - `TTI_Interaction`: 首次可交互时间
- 数据通过 `EventBus` 发送到 background，存储到 `chrome.storage.local`
- 在 popup 中展示性能仪表盘

### 6.2 内存优化

当前项目中多个模块使用全局变量和 Map 存储，需要:
- 定期清理 `CacheManager` 中的过期缓存（已有自动清理机制，但间隔可优化）
- 对 `UnifiedDOMWatcher` 的订阅者列表进行弱引用管理
- 在 tab 关闭时清理对应的 EventBus Transport 端口
- 监控 `Service Worker` 的内存使用，避免因内存过高被 Chrome 终止

### 6.3 构建优化

当前 `vite.config.js` 使用 `esbuild` 进行 content script 打包:
- 启用 minify（当前 `minify: false`），生产环境减少 bundle 体积
- 使用 tree-shaking 移除未使用的模块
- 对 `cdn-mappings.js` 进行压缩（当前包含大量 CDN 源配置）
- 考虑将 `event-bus-v4.6.js` (32KB) 拆分为核心部分和扩展部分

### 6.4 页面优化状态检测（发现并跳过已有优化）

#### 6.4.1 问题背景

当用户访问的页面已经进行了某些优化（如使用了CDN加速、图片懒加载、字体优化等），扩展会重复执行这些优化，造成不必要的性能开销。需要在优化执行前检测页面已有的优化状态，并跳过重复操作。

#### 6.4.2 当前已有的检测机制

| 检测类型 | 实现位置 | 检测方法 |
|----------|----------|----------|
| 已处理元素 | `FontReplacer._processedLinks` (WeakSet) | 跟踪已处理的link标签，避免重复处理 |
| 目标CDN | `FontReplacer._isTargetCDN()` | 检查是否已在 fonts.font.im / fonts.loli.net / cdn.bootcdn.net |
| 排除规则 | `shouldExclude()` / `_shouldExclude()` | 根据配置排除特定URL |
| 预加载去重 | `HTMLOptimizer` / `ResourcePreloader` | 检查是否已存在 preload/prefetch 链接 |

#### 6.4.3 当前机制的不足

| 场景 | 当前状态 | 问题 |
|------|----------|------|
| 页面已使用其他CDN | 仅检测3个目标CDN | 无法识别 cdnjs、unpkg、jsdelivr 等 |
| 页面已做字体子集化 | 未检测 | 可能重复处理 |
| 页面已做图片懒加载 | 未检测 | 可能重复添加 lazy 属性 |
| 页面已做CSS压缩 | 未检测 | 可能重复优化 |
| Service Worker 已缓存 | 未检测 | 可能重复预加载 |

#### 6.4.4 增强方案：页面优化状态检测器

**方案 A：指纹检测（推荐）**

在页面加载早期检测页面已有的优化特征：

```javascript
// 页面优化状态检测器
class PageOptimizationDetector {
  constructor() {
    this.fingerprints = null
    this._initialized = false
  }

  /**
   * 初始化检测器，在DOM加载完成后执行检测
   */
  async init() {
    if (this._initialized) return this
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve()
        } else {
          window.addEventListener('DOMContentLoaded', resolve, { once: true })
        }
      })
    }

    this.fingerprints = {
      cdn: this._detectCDN(),
      lazyLoad: this._detectLazyLoad(),
      preload: this._detectPreload(),
      fontOptimized: this._detectFontOptimization(),
      totalResources: this._countTotalResources(),
    }
    this._initialized = true
    return this
  }

  _detectCDN() {
    const scripts = document.querySelectorAll('script[src]')
    const links = document.querySelectorAll('link[href]')
    const urls = [...scripts, ...links].map(el => el.src || el.href)
    
    const cdnPatterns = [
      { name: 'bootcdn', pattern: /cdn\.bootcdn\.net/ },
      { name: 'cdnjs', pattern: /cdnjs\.cloudflare\.com/ },
      { name: 'unpkg', pattern: /unpkg\.com/ },
      { name: 'jsdelivr', pattern: /cdn\.jsdelivr\.net/ },
      { name: 'fonts.google', pattern: /fonts\.googleapis\.com/ },
    ]
    
    return cdnPatterns.filter(cdn => 
      urls.some(url => cdn.pattern.test(url))
    )
  }

  _detectLazyLoad() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]')
    const lazySrcImages = document.querySelectorAll('img[data-src]')
    const totalImages = document.querySelectorAll('img')
    
    return {
      hasLazyImages: lazyImages.length > 0,
      hasLazySrc: lazySrcImages.length > 0,
      hasIntersectionObserver: 'IntersectionObserver' in window,
      lazyImageCount: lazyImages.length + lazySrcImages.length,
      totalImageCount: totalImages.length,
    }
  }

  _detectPreload() {
    return {
      preload: document.querySelectorAll('link[rel="preload"]').length,
      prefetch: document.querySelectorAll('link[rel="prefetch"]').length,
      preconnect: document.querySelectorAll('link[rel="preconnect"]').length,
    }
  }

  _detectFontOptimization() {
    const fontLinks = document.querySelectorAll('link[href*="fonts"]')
    const hasFontDisplay = Array.from(fontLinks).some(
      link => link.href.includes('display=swap')
    )
    return {
      hasOptimizedFonts: hasFontDisplay,
      fontCount: fontLinks.length,
    }
  }

  _countTotalResources() {
    return document.querySelectorAll('script[src], link[rel="stylesheet"], img').length
  }
}
```

**方案 B：优化跳过决策器**

基于检测结果决定跳过哪些优化：

```javascript
class OptimizationSkipper {
  constructor(detector, config = {}) {
    this.detector = detector
    this.config = {
      cdnThreshold: 0.8,        // CDN替换跳过阈值（80%资源已在CDN上）
      lazyLoadThreshold: 0.9,   // 懒加载跳过阈值（90%图片已有懒加载）
      preloadThreshold: 3,      // 预加载跳过阈值
      ...config
    }
    this.skipRules = {
      // 如果页面已使用优质CDN，跳过CDN替换
      cdnReplace: (fingerprint) => {
        const targetCDNs = ['bootcdn', 'cdnjs', 'jsdelivr']
        const matchedCount = fingerprint.cdn.filter(c => 
          targetCDNs.includes(c.name)
        ).length
        // 需要超过80%的资源已在优质CDN上才跳过
        return matchedCount > 0 && 
               (matchedCount / fingerprint.totalResources) > this.config.cdnThreshold
      },
      
      // 如果已有懒加载，跳过图片懒加载
      imageLazyLoad: (fingerprint) => {
        const lazyImages = fingerprint.lazyLoad.lazyImageCount
        const totalImages = fingerprint.lazyLoad.totalImageCount
        // 需要超过90%的图片已有懒加载才跳过
        return totalImages > 0 && 
               (lazyImages / totalImages) > this.config.lazyLoadThreshold
      },
      
      // 如果已有preload，减少预加载数量
      preload: (fingerprint) => {
        return fingerprint.preload.preload > this.config.preloadThreshold
      },
    }
  }

  shouldSkip(optimizationType) {
    try {
      const fingerprint = this.detector.fingerprints
      const rule = this.skipRules[optimizationType]
      return rule ? rule(fingerprint) : false
    } catch (error) {
      // 降级：检测失败时不跳过任何优化
      console.warn(`[OptimizationSkipper] 检测失败，不跳过 ${optimizationType}:`, error)
      return false
    }
  }
}
```

**方案 C：与现有模块集成**

在各优化模块中集成跳过逻辑：

```javascript
// 在 ResourceAccelerator.init() 中
async init() {
  // 检测页面优化状态
  const detector = new PageOptimizationDetector()
  await detector.init()
  
  const skipper = new OptimizationSkipper(detector, {
    cdnThreshold: 0.8,
    lazyLoadThreshold: 0.9,
  })
  
  // 根据检测结果初始化子模块
  // 使用空对象模式避免空指针错误
  const noopModule = { process: () => {}, init: () => Promise.resolve() }
  
  this.modules = {
    jsReplacer: skipper.shouldSkip('jsReplace') ? noopModule : new JSReplacer(),
    fontReplacer: skipper.shouldSkip('fontReplace') ? noopModule : new FontReplacer(),
    cssAccelerator: skipper.shouldSkip('cssReplace') ? noopModule : new CSSAccelerator(),
    imageOptimizer: skipper.shouldSkip('imageLazyLoad') ? noopModule : new ImageOptimizer(),
  }
  
  // 记录跳过的优化
  this.skippedOptimizations = {
    jsReplace: skipper.shouldSkip('jsReplace'),
    fontReplace: skipper.shouldSkip('fontReplace'),
    cssReplace: skipper.shouldSkip('cssReplace'),
    imageLazyLoad: skipper.shouldSkip('imageLazyLoad'),
  }
}
```

#### 6.4.5 优化跳过优先级

| 优先级 | 优化项 | 检测方法 | 跳过条件 | 验证方式 |
|--------|--------|----------|----------|----------|
| P0 | CDN替换 | 检测页面已有CDN | >80%资源已在优质CDN（bootcdn/cdnjs/jsdelivr） | 抽样检查资源URL |
| P0 | 字体替换 | 检测字体链接 | 已使用目标CDN或已优化display=swap | 检查字体链接属性 |
| P1 | 图片懒加载 | 检测loading属性 | >90%图片已有loading="lazy"或data-src | 统计图片属性 |
| P1 | 预加载 | 检测link标签 | 已有preload且数量>3 | 统计link标签数量 |
| P2 | CSS优化 | 检测CSS文件 | 已压缩或已使用CDN | 检查文件大小和来源 |

#### 6.4.6 实施步骤

1. 创建 `content/core/page-optimizer-detector.js` 模块
2. 在 `ResourceAccelerator.init()` 中集成检测逻辑
3. 为各子模块（FontReplacer、CSSAccelerator、JSReplacer、ImageOptimizer）添加 skip 参数支持
4. 添加检测结果的缓存和统计上报
5. 在 popup 中展示"跳过的优化"统计信息

#### 6.4.7 降级策略

当检测逻辑本身出错时，需要有降级策略：

```javascript
// 在 ResourceAccelerator.init() 中
async init() {
  let skipper = { shouldSkip: () => false } // 默认不跳过
  
  try {
    const detector = new PageOptimizationDetector()
    await detector.init()
    skipper = new OptimizationSkipper(detector, {
      cdnThreshold: 0.8,
      lazyLoadThreshold: 0.9,
    })
  } catch (error) {
    // 降级：检测失败时执行全部优化
    console.warn('[ResourceAccelerator] 页面优化检测失败，执行全部优化:', error)
    this.stats.detectionErrors++
  }
  
  // 使用skipper初始化模块...
}
```

#### 6.4.8 监控指标

| 指标 | 说明 | 采集方式 |
|------|------|----------|
| `detection_accuracy` | 检测准确率 | A/B测试对比 |
| `false_positive_rate` | 误判率（跳过了应该优化的资源） | 用户反馈+日志分析 |
| `skipped_optimizations` | 跳过的优化次数 | 统计上报 |
| `detection_time` | 检测耗时 | Performance API |
| `detection_errors` | 检测失败次数 | 错误日志 |

#### 6.4.9 测试策略

**单元测试**：
```javascript
describe('PageOptimizationDetector', () => {
  it('should detect CDN correctly', async () => {
    document.body.innerHTML = '<script src="https://cdn.bootcdn.net/vue.js"></script>'
    const detector = new PageOptimizationDetector()
    await detector.init()
    expect(detector.fingerprints.cdn).toContainEqual(
      expect.objectContaining({ name: 'bootcdn' })
    )
  })

  it('should handle detection failure gracefully', async () => {
    // 模拟DOM查询失败
    jest.spyOn(document, 'querySelectorAll').mockImplementation(() => {
      throw new Error('DOM error')
    })
    const detector = new PageOptimizationDetector()
    await expect(detector.init()).rejects.toThrow()
  })
})
```

**集成测试**：
- 测试跳过逻辑与各模块的集成
- 测试降级策略是否正确执行

**E2E测试**：
- 测试真实页面场景（B站、抖音、YouTube等）
- 验证跳过逻辑不影响页面功能

#### 6.4.10 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 检测逻辑误判 | 高 | 中 | 细化跳过条件+降级策略+用户手动开关 |
| 拆分bundle导致依赖问题 | 高 | 低 | 完善的集成测试+依赖图分析 |
| 并行注入导致时序问题 | 中 | 中 | 严格测试+时序验证 |
| 检测耗时影响性能 | 中 | 低 | 异步检测+缓存结果 |

---

## 七、实施优先级和里程碑

### 第一阶段（1-2 周）：消除关键路径阻塞

**目标**：减少Content Script首次执行时间，消除隐藏元素闪烁

**任务**：
1. 预解析域名匹配 + 并行注入基础脚本
2. 隐藏元素 CSS 内联注入
3. ResourceAccelerator 延迟初始化

**验收标准**：
- [ ] Content Script 首次执行时间减少 >50%
- [ ] 隐藏元素应用时间 <100ms（无闪烁）
- [ ] ResourceAccelerator 初始化阻塞时间 <50ms

### 第二阶段（2-3 周）：交互体验提升

**目标**：提升用户交互响应速度，减少等待时间

**任务**：
1. Popup 预加载和代码分割
2. 消息通信批处理
3. Storage 缓存层优化
4. 元素拾取器预注入

**验收标准**：
- [ ] Popup 打开时间减少 >30%
- [ ] 消息通信延迟减少 >40%
- [ ] Storage 读写延迟减少 >50%

### 第三阶段（3-4 周）：性能监控和持续优化

**目标**：建立性能监控体系，持续优化

**任务**：
1. 端到端性能监控体系
2. DOM 监听器自适应节流
3. 构建优化（minify、tree-shaking）
4. 内存优化
5. 页面优化状态检测（发现并跳过已有优化）

**验收标准**：
- [ ] 性能监控覆盖率 >90%
- [ ] DOM 变化处理性能提升 >30%
- [ ] Bundle 体积减少 >20%
- [ ] 页面优化检测准确率 >85%

### 第四阶段（持续）：用户反馈驱动迭代

**目标**：根据用户反馈持续优化

**任务**：
1. 收集性能数据，分析瓶颈
2. 针对高频使用站点（B站、抖音、YouTube）专项优化
3. A/B 测试验证优化效果

**验收标准**：
- [ ] 用户满意度提升 >20%
- [ ] 性能问题工单减少 >30%

---

## 八、关键文件

实施本优化计划最关键的文件:

| 文件 | 用途 | 修改类型 |
|------|------|----------|
| `background.js` | Service Worker，需要重构脚本注入时机、增加预解析域名匹配、并行注入逻辑、popup 预热 | 重构 |
| `content/entries/core.js` | 核心模块入口，需要拆分为 critical bundle 和 lazy bundle，调整模块加载策略 | 重构 |
| `content/core/load-scheduler.js` | 加载调度器，需要增加自动激活机制，不依赖 EXTENSION_ACTIVATE 消息 | 修改 |
| `content/core/site-base.js` | 站点基类，需要重构 init() 为并行流水线 | 重构 |
| `content.js` | Content script 入口，需要增加隐藏元素 CSS 内联注入、优化消息处理链路 | 修改 |
| `content/core/page-optimizer-detector.js` | **新增** 页面优化状态检测器，用于检测页面已有优化并跳过重复操作 | 新增 |
| `content/modules/resource-accelerator.js` | 资源加速器主模块，需要集成页面优化状态检测，支持跳过逻辑 | 修改 |
| `content/modules/font-replacer.js` | 字体替换模块，需要支持skip参数 | 修改 |
| `content/modules/css-accelerator.js` | CSS加速模块，需要支持skip参数 | 修改 |
| `content/modules/js-replacer.js` | JS替换模块，需要支持skip参数 | 修改 |
| `content/modules/image-optimizer.js` | 图片优化模块，需要支持skip参数 | 修改 |
