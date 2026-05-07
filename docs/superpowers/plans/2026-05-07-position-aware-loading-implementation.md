# 位置感知加载实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据资源在页面中的位置决定加载优先级，视口内资源最高优先，离视口近的资源次优先，距离远的资源延迟加载。

**Architecture:** 抽取统一位置计算函数 `_getResourcePositionPriority()`，供预加载、压缩队列、延迟加载共用。

**Tech Stack:** IntersectionObserver, getBoundingClientRect

---

## 文件变更汇总

| 文件 | 变更类型 | 职责 |
|------|---------|------|
| `content/modules/resource-accelerator.js` | 修改 | 所有改动都在此文件 |

---

## Task 1: 添加配置项

**Files:**
- Modify: `content/modules/resource-accelerator.js:200-220` (DEFAULT_CONFIG 末尾)

- [ ] **Step 1: 在 DEFAULT_CONFIG 中添加 positionAwareLoading 配置**

在 `DEFAULT_CONFIG` 对象末尾（约第200行，`adaptiveQuality` 配置之后）添加：

```javascript
// 位置感知加载
positionAwareLoading: {
  enabled: true,
  nearbyThreshold: 1,      // 触发加载的距离阈值（屏数），默认1屏
  processLoaded: false,    // 已加载资源是否重新处理
},
```

- [ ] **Step 2: 提交配置变更**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add positionAwareLoading config"
```

---

## Task 2: 添加核心位置优先级函数

**Files:**
- Modify: `content/modules/resource-accelerator.js:1495-1515` (在 `_getCompressPriority` 函数之前)

- [ ] **Step 1: 添加 `_getResourcePositionPriority()` 函数**

在 `// ========== 图片压缩 ==========` 注释之后，`_getCompressPriority` 函数之前添加：

```javascript
/**
 * 获取资源位置优先级
 * @param {Element} element - DOM元素
 * @returns {{ zone: 'inViewport'|'nearby'|'far', priority: number, distance: number }}
 */
function _getResourcePositionPriority(element) {
  if (!element || !element.isConnected) {
    return { zone: 'far', priority: 999, distance: Infinity };
  }

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // 计算元素距离视口的距离
  const distanceToViewport = rect.top < 0
    ? -rect.top  // 视口上方，取绝对值
    : rect.top > viewportHeight
      ? rect.top - viewportHeight  // 视口下方
      : 0;  // 在视口内

  // 获取配置的距离阈值（屏数）
  const nearbyThreshold = (state.config.positionAwareLoading?.nearbyThreshold || 1) * viewportHeight;

  // 判断区域
  if (distanceToViewport === 0) {
    return { zone: 'inViewport', priority: 0, distance: 0 };
  }

  if (distanceToViewport <= nearbyThreshold) {
    // nearby 区域：优先级 10-19，距离越近优先级越高
    return {
      zone: 'nearby',
      priority: 10 + Math.floor(distanceToViewport / viewportHeight * 10),
      distance: distanceToViewport
    };
  }

  // far 区域
  return { zone: 'far', priority: 100, distance: distanceToViewport };
}
```

- [ ] **Step 2: 提交核心函数**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add _getResourcePositionPriority core function"
```

---

## Task 3: 添加已加载资源检测函数

**Files:**
- Modify: `content/modules/resource-accelerator.js` (紧接 Task 2 之后)

- [ ] **Step 1: 添加 `_isResourceLoaded()` 函数**

在 `_getResourcePositionPriority()` 函数之后添加：

```javascript
/**
 * 检查资源是否已加载
 * @param {Element} element - DOM元素
 * @param {string} type - 资源类型
 * @returns {boolean}
 */
function _isResourceLoaded(element, type) {
  switch (type) {
    case 'image':
      return element.complete && element.naturalHeight > 0;
    case 'iframe':
      if (element.dataset.loaded === 'true') return true;
      // 跨域iframe访问contentDocument会抛出安全错误
      try {
        return element.contentDocument !== null;
      } catch {
        return false;
      }
    case 'script':
      return element.dataset.loaded === 'true';
    default:
      return false;
  }
}
```

- [ ] **Step 2: 提交检测函数**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add _isResourceLoaded detection function"
```

---

## Task 4: 修改压缩优先级函数

**Files:**
- Modify: `content/modules/resource-accelerator.js:1500-1515` (现有 `_getCompressPriority` 函数)

- [ ] **Step 1: 修改 `_getCompressPriority()` 使用位置优先级**

替换现有的 `_getCompressPriority` 函数为：

```javascript
// 获取图片压缩优先级（基于位置）
function _getCompressPriority(img) {
  // 已加载跳过
  if (_isResourceLoaded(img, 'image')) return 999;

  const { zone, priority } = _getResourcePositionPriority(img);

  // far 区域不压缩
  if (zone === 'far') return 999;

  // inViewport 和 nearby 使用位置优先级
  // 小图在同级别内微调 -1
  const size = (img.naturalWidth || 0) * (img.naturalHeight || 0);
  const sizeBonus = size < 100000 ? -1 : 0;

  return Math.max(0, priority + sizeBonus);
}
```

- [ ] **Step 2: 提交压缩优先级修改**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): update _getCompressPriority to use position priority"
```

---

## Task 5: 修改预加载优先级应用

**Files:**
- Modify: `content/modules/resource-accelerator.js:2471-2481` (PriorityOptimizer.applyPriorityToResource 方法)

- [ ] **Step 1: 修改 `applyPriorityToResource()` 方法**

替换现有的 `applyPriorityToResource` 方法为：

```javascript
applyPriorityToResource(element, url, type) {
  // 已加载资源跳过
  if (_isResourceLoaded(element, type)) return;

  // 图片和iframe使用位置优先级
  if (type === 'image' || type === 'iframe') {
    const { zone } = _getResourcePositionPriority(element);

    if (zone === 'inViewport') {
      if ('fetchPriority' in element) element.fetchPriority = 'high';
      if ('loading' in element) element.loading = 'eager';
    } else if (zone === 'nearby') {
      if ('fetchPriority' in element) element.fetchPriority = 'auto';
      if ('loading' in element) element.loading = 'lazy';
    } else {
      // far - 设置lazy，等待滚动触发
      if ('fetchPriority' in element) element.fetchPriority = 'low';
      if ('loading' in element) element.loading = 'lazy';
    }
    return;
  }

  // 脚本：关键JS正常加载，非关键按位置
  if (type === 'script') {
    const isCritical = element.type === 'module' || element.closest('head');
    if (isCritical) return; // 关键JS不干预

    const { zone } = _getResourcePositionPriority(element);
    if (zone === 'far') {
      // 非关键JS在far区域延迟加载
      if (!element.dataset.src) {
        element.dataset.src = element.src;
        element.src = '';
      }
    }
    return;
  }

  // CSS 不处理
}
```

- [ ] **Step 2: 提交预加载优先级修改**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): update applyPriorityToResource to use position priority"
```

---

## Task 6: 添加延迟加载观察器

**Files:**
- Modify: `content/modules/resource-accelerator.js` (在 Task 3 函数之后)

- [ ] **Step 1: 添加延迟加载观察器变量和函数**

在 `_isResourceLoaded()` 函数之后添加：

```javascript
// ========== 延迟加载观察器 ==========
let _lazyLoadObserver = null;

/**
 * 设置延迟加载观察器
 */
function _setupLazyLoadObserver() {
  if (_lazyLoadObserver) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const nearbyThreshold = state.config.positionAwareLoading?.nearbyThreshold || 1;
  const rootMargin = `${nearbyThreshold * 100}% 0px ${nearbyThreshold * 100}% 0px`;

  _lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const type = el.tagName.toLowerCase();

        // 触发加载
        if (el.dataset.lazySrc) {
          el.src = el.dataset.lazySrc;
          delete el.dataset.lazySrc;
        }

        // 图片触发压缩
        if (type === 'img' && !el.complete && el.src) {
          enqueueCompress(el, el.src);
        }

        _lazyLoadObserver.unobserve(el);
      }
    });
  }, {
    rootMargin: rootMargin
  });

  addLog('info', 'loader', 'init', { feature: 'lazyLoadObserver', threshold: nearbyThreshold });
}

/**
 * 将元素加入延迟加载观察
 * @param {Element} element - DOM元素
 */
function _observeLazyLoad(element) {
  if (!_lazyLoadObserver) return;
  _lazyLoadObserver.observe(element);
}

/**
 * 销毁延迟加载观察器
 */
function _destroyLazyLoadObserver() {
  if (_lazyLoadObserver) {
    _lazyLoadObserver.disconnect();
    _lazyLoadObserver = null;
  }
}

/**
 * 初始化位置感知加载
 */
function _initPositionAwareLoading() {
  if (!state.config.positionAwareLoading?.enabled) return;
  _setupLazyLoadObserver();
}
```

- [ ] **Step 2: 提交延迟加载观察器**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add lazy load observer for position-aware loading"
```

---

## Task 7: 修改图片处理函数

**Files:**
- Modify: `content/modules/resource-accelerator.js:1190-1290` (processImage 函数)

- [ ] **Step 1: 修改 `processImage()` 函数开头添加位置检测**

在 `processImage` 函数中，`img.dataset._raProcessed = '1';` 之后（约第1215行）添加位置检测逻辑：

```javascript
img.dataset._raProcessed = '1';

// 位置感知加载：检测图片位置
const positionState = _getResourcePositionPriority(img);

// far 区域加入延迟加载观察，不立即处理
if (positionState.zone === 'far') {
  if (img.src && !img.dataset.lazySrc) {
    img.dataset.lazySrc = img.src;
    // 使用透明占位图保持布局
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  if ('fetchPriority' in img) img.fetchPriority = 'low';
  img.loading = 'lazy';
  img.dataset._raLazyLoad = '1';
  _observeLazyLoad(img);
  addLog('info', 'image', 'far_delayed', {
    url: img.dataset.lazySrc,
    distance: Math.round(positionState.distance),
    zone: positionState.zone
  });
  return;
}
```

- [ ] **Step 2: 提交图片处理修改**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add position detection to processImage"
```

---

## Task 8: 修改 iframe 延迟加载函数

**Files:**
- Modify: `content/modules/resource-accelerator.js:1296-1331` (processIframeLazyLoad 函数)

- [ ] **Step 1: 修改 `processIframeLazyLoad()` 函数使用位置优先级**

替换现有的 `processIframeLazyLoad` 函数为：

```javascript
function processIframeLazyLoad() {
  if (!isSiteEnabled('iframeLazyLoad')) return;
  const config = state.config.iframeLazyLoad;

  const iframes = document.querySelectorAll('iframe[src]');
  iframes.forEach(iframe => {
    try {
      const url = new URL(iframe.src, location.href);
      if (url.hostname === location.hostname) return;
      if (config.excludePatterns?.some(p => url.hostname.includes(p))) return;
      if (iframe.dataset._raIframeProcessed) return;
      if (_isResourceLoaded(iframe, 'iframe')) return;

      iframe.dataset._raIframeProcessed = '1';

      // 使用位置优先级判断
      const { zone } = _getResourcePositionPriority(iframe);

      if (zone === 'inViewport') {
        // 视口内：正常加载
        if ('fetchPriority' in iframe) iframe.fetchPriority = 'high';
        return;
      }

      // nearby 和 far 区域：延迟加载
      iframe.dataset.lazySrc = iframe.src;
      iframe.removeAttribute('src');
      iframe.loading = 'lazy';
      if ('fetchPriority' in iframe) iframe.fetchPriority = zone === 'nearby' ? 'auto' : 'low';

      // 使用统一的延迟加载观察器
      _observeLazyLoad(iframe);

      addLog('info', 'iframe', 'lazy', {
        url: iframe.dataset.lazySrc,
        zone: zone
      });
    } catch {
      // URL 解析失败，跳过
    }
  });
}
```

- [ ] **Step 2: 提交 iframe 处理修改**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): update processIframeLazyLoad to use position priority"
```

---

## Task 9: 初始化集成

**Files:**
- Modify: `content/modules/resource-accelerator.js:3565-3570` (init 函数中 Worker 初始化之后)

- [ ] **Step 1: 在 `init()` 函数中添加初始化调用**

在 `_initCompressorWorkers();` 之后添加：

```javascript
// 初始化位置感知加载
_initPositionAwareLoading();
```

- [ ] **Step 2: 提交初始化集成**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): integrate position-aware loading in init"
```

---

## Task 10: 销毁集成

**Files:**
- Modify: `content/modules/resource-accelerator.js:4066-4073` (destroy 函数)

- [ ] **Step 1: 在 `destroy()` 函数中添加清理调用**

在 `_terminateCompressorWorkers();` 之前添加：

```javascript
_destroyLazyLoadObserver();
```

- [ ] **Step 2: 提交销毁集成**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(ra): add lazyLoadObserver cleanup in destroy"
```

---

## Task 11: 测试验证

- [ ] **Step 1: 启动开发环境测试**

在浏览器中测试以下场景：

| 场景 | 预期结果 |
|------|---------|
| 图片在视口内 | fetchPriority='high', loading='eager' |
| 图片在视口下方0.5屏 | fetchPriority='auto', loading='lazy' |
| 图片在视口下方2屏 | fetchPriority='low', data-lazy-src属性存在 |
| 滚动到far图片位置 | 图片开始加载 |
| iframe在视口内 | fetchPriority='high', 正常加载 |
| iframe在视口下方2屏 | fetchPriority='low', data-lazy-src属性存在 |
| 滚动到far iframe位置 | iframe开始加载 |
| 已加载图片/iframe | 跳过处理 |

- [ ] **Step 2: 最终提交**

```bash
git add -A
git commit -m "feat(ra): complete position-aware loading implementation"
```

---

## 验收标准

- [ ] 视口内图片立即加载，优先级最高
- [ ] 视口上下1屏内的图片次优先级加载
- [ ] 超出1屏的图片不加载，滚动到范围内再触发
- [ ] 已加载的图片不重复处理
- [ ] 关键JS（module/head中）不受位置规则影响
- [ ] CSS不受位置规则影响
- [ ] 非关键JS按位置规则延迟加载
- [ ] iframe按位置规则延迟加载
- [ ] 配置项 `nearbyThreshold` 可调整触发距离
- [ ] destroy() 时正确清理 IntersectionObserver
