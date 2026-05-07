# 资源加速器 - 位置感知加载设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 基线版本：v21（Worker and cache optimizations）
> 创建时间：2026-05-07

**Goal:** 根据资源在页面中的位置决定加载优先级，视口内资源最高优先，离视口近的资源次优先，距离远的资源延迟加载。

**Architecture:** 抽取统一位置计算函数，供预加载、压缩队列、延迟加载共用。

**Tech Stack:** IntersectionObserver, getBoundingClientRect

---

## 问题分析

当前资源加载不考虑页面位置：

| 环节 | 当前逻辑 | 问题 |
|------|---------|------|
| 预加载 | 基于资源大小估算 | 不考虑位置，可能预加载视口外的资源 |
| 压缩队列 | 视口内/外 + 图片大小 | 视口外所有图片优先级相同，不区分远近 |
| 延迟加载 | 仅设置 loading="lazy" | 没有主动管理加载时机 |

**用户期望：**
1. 视口内资源 → 最高优先级，立即加载
2. 离视口近的资源（1屏内）→ 次优先级，延迟加载
3. 距离远的资源（超出1屏）→ 不加载，滚动到范围内再加载
4. 已加载的资源 → 不重复加载
5. 关键资源（CSS、关键JS）→ 正常加载，不受位置规则影响

---

## 功能设计

### 位置区域定义

```
┌─────────────────────────────────────┐
│           FAR (不加载)               │  ← 上方超出1屏
├─────────────────────────────────────┤
│                                     │
│          NEARBY (延迟加载)           │  ← 上方1屏内
│                                     │
├─────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓ INVIEWPORT (立即加载) ▓▓▓▓▓ │  ← 视口内
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────────┤
│                                     │
│          NEARBY (延迟加载)           │  ← 下方1屏内
│                                     │
├─────────────────────────────────────┤
│           FAR (不加载)               │  ← 下方超出1屏
└─────────────────────────────────────┘
```

### 资源分类处理

| 资源类型 | 处理策略 |
|---------|---------|
| CSS | 不受位置规则影响，正常加载 |
| 关键JS（`type="module"` 或在 `<head>` 中） | 不受位置规则影响，正常加载 |
| 非关键JS | 按位置规则处理 |
| 图片 | 按位置规则处理 |
| iframe | 按位置规则处理 |

---

## 技术设计

### 1. 核心位置优先级函数

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
  // 负值表示在视口上方，正值表示在视口下方
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

**优先级数值说明：**

| 区域 | priority | 说明 |
|------|----------|------|
| inViewport | 0 | 视口内，最高优先 |
| nearby | 10-19 | 视口阈值内，10 + 距离比例 |
| far | 100 | 超出阈值，不加载 |

### 2. 已加载资源检测

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
        return false; // 跨域iframe无法判断，返回false
      }
    case 'script':
      return element.dataset.loaded === 'true';
    default:
      return false;
  }
}
```

### 3. 预加载阶段改造

修改 `PriorityOptimizer.applyPriorityToResource()` 方法：

```javascript
applyPriorityToResource(element, url, type) {
  // 已加载资源跳过
  if (_isResourceLoaded(element, type)) return;

  // 图片和iframe使用位置优先级
  if (type === 'image' || type === 'iframe') {
    const { zone, priority } = _getResourcePositionPriority(element);

    if (zone === 'inViewport') {
      element.fetchPriority = 'high';
      element.loading = 'eager';
    } else if (zone === 'nearby') {
      element.fetchPriority = 'auto';
      element.loading = 'lazy';
    } else {
      // far - 设置lazy，等待滚动触发
      element.fetchPriority = 'low';
      element.loading = 'lazy';
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

### 4. 压缩队列阶段改造

修改 `_getCompressPriority()` 函数：

```javascript
/**
 * 获取图片压缩优先级（基于位置）
 * @param {HTMLImageElement} img - 图片元素
 * @returns {number} 优先级数值，越小越高
 */
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

### 5. 延迟加载触发器

```javascript
let _lazyLoadObserver = null;

/**
 * 设置延迟加载观察器
 */
function _setupLazyLoadObserver() {
  if (_lazyLoadObserver) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const nearbyThreshold = state.config.positionAwareLoading?.nearbyThreshold || 1;
  const rootMargin = `${nearbyThreshold * 100}% 0px`;

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
        if (type === 'img' && !el.complete) {
          enqueueCompress(el, el.src);
        }

        _lazyLoadObserver.unobserve(el);
      }
    });
  }, {
    rootMargin: rootMargin // 视口上下各N屏
  });
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
```

---

## 配置设计

```javascript
// 在 DEFAULT_CONFIG 中添加
positionAwareLoading: {
  enabled: true,
  nearbyThreshold: 1,      // 触发加载的距离阈值（屏数），默认1屏
  processLoaded: false,    // 已加载资源是否重新处理
}
```

---

## 集成点

### 初始化

在 `init()` 函数中添加：

```javascript
// 初始化位置感知加载
_initPositionAwareLoading();
```

```javascript
function _initPositionAwareLoading() {
  if (!state.config.positionAwareLoading?.enabled) return;
  _setupLazyLoadObserver();
  addLog('info', 'loader', 'init', { feature: 'positionAwareLoading' });
}
```

### 销毁

在 `destroy()` 函数中添加：

```javascript
_destroyLazyLoadObserver();
```

### 图片处理集成

在 `_processImage()` 中添加位置检测：

```javascript
function _processImage(img) {
  // 已加载跳过
  if (_isResourceLoaded(img, 'image')) return;

  const { zone } = _getResourcePositionPriority(img);

  // far 区域加入延迟加载观察
  if (zone === 'far') {
    if (img.src && !img.dataset.lazySrc) {
      img.dataset.lazySrc = img.src;
      img.src = ''; // 清空src，等待滚动触发
    }
    _observeLazyLoad(img);
    return;
  }

  // inViewport 和 nearby 正常处理
  // ... 原有逻辑
}
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|---------|
| `content/modules/resource-accelerator.js` | 修改 |

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

---

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 清空src导致布局跳动 | 用户体验差 | 使用透明1x1像素占位图或CSS aspect-ratio保持布局 |
| IntersectionObserver不支持 | 功能失效 | 检测支持性，降级为原生lazy |
| 滚动频繁触发 | 性能问题 | rootMargin已设置阈值，只触发一次 |
| 跨域iframe检测失败 | 误判未加载 | 使用dataset标记加载状态，try-catch保护 |

---

## 测试用例

| 场景 | 预期结果 |
|------|---------|
| 图片在视口内 | fetchPriority='high', loading='eager' |
| 图片在视口下方0.5屏 | fetchPriority='auto', loading='lazy' |
| 图片在视口下方2屏 | fetchPriority='low', loading='lazy', 加入observer |
| 滚动到far图片位置 | 图片开始加载 |
| 快速滚动经过far区域 | 图片不加载，直到滚动停止在范围内 |
| 向上滚动到far图片位置 | 图片开始加载（双向滚动支持） |
| 已加载图片 | 跳过处理 |
| 关键JS脚本 | 不受影响，正常加载 |
| 非关键JS在far区域 | src被清空，等待滚动触发 |
| 跨域iframe加载检测 | try-catch保护，使用dataset判断 |
| nearbyThreshold=2 | 视口上下2屏内都算nearby |

---

## 实施顺序

1. 添加 `_getResourcePositionPriority()` 核心函数
2. 添加 `_isResourceLoaded()` 检测函数
3. 添加配置项 `positionAwareLoading`
4. 修改 `applyPriorityToResource()` 应用位置优先级
5. 修改 `_getCompressPriority()` 使用位置优先级
6. 添加 `_setupLazyLoadObserver()` 和相关函数
7. 在 `init()` 中初始化
8. 在 `destroy()` 中清理
9. 测试验证
