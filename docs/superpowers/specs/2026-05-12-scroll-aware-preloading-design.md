# 滚动感知预加载设计文档

> 创建时间：2026-05-12
> 状态：待审核

---

## 一、背景

### 当前问题

资源加速器对 `far` 区域（距离视口超过 1 个视口高度）的图片采取**替换 src 为透明占位图**的策略：

```javascript
// 当前实现
if (positionState.zone === 'far') {
  img.dataset.lazySrc = img.src
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
}
```

**问题链路**：
```
far 区域图片 → 替换 src 为透明占位 → 用户滚动 → IntersectionObserver 触发 → 恢复 src → 图片开始加载 → 空白等待
```

**用户体验**：滚动时图片位置空白，造成"不跟手"的感觉。

### 目标

实现**即时响应**：滚动到图片位置时图片应该已存在（或正在加载中），不要出现空白占位。

---

## 二、设计方案

### 核心改动

**移除 src 替换逻辑，改用原生懒加载 + 滚动速度感知预加载**

```
当前：far 图片 → 替换 src 为透明占位 → 滚动触发 → 恢复 src → 加载等待
改后：far 图片 → 保持 src + loading='lazy' → 滚动感知 → 动态预加载 → 即时显示
```

### 方案对比

| 维度 | 方案 B（纯原生） | 方案 C（滚动感知） |
|------|-----------------|-------------------|
| 实现复杂度 | 低（删除代码） | 中（新增滚动检测） |
| 即时响应 | 依赖浏览器 | 主动预加载 |
| 带宽消耗 | 中 | 动态调整 |
| 推荐场景 | 通用 | 滚动密集型页面 |

**选择方案 C**：滚动感知预加载，能更好地平衡即时响应和带宽消耗。

---

## 三、详细设计

### 3.1 配置项

新增 `scrollPreload` 配置：

```javascript
scrollPreload: {
  enabled: true,
  // 滚动速度阈值
  fastThreshold: 1500,    // px/s，快滚阈值
  slowThreshold: 300,     // px/s，慢滚阈值
  // 预加载距离（视口高度倍数）
  fastPreloadDistance: 3, // 快滚时预加载 3 屏
  normalPreloadDistance: 2, // 正常滚动预加载 2 屏
  slowPreloadDistance: 1, // 慢滚时预加载 1 屏
  // 滚动采样
  sampleInterval: 100,    // 滚动采样间隔 ms
  // 停止滚动后
  stopDelay: 200,         // 停止滚动后重置延迟 ms
}
```

### 3.2 移除 src 替换逻辑

**修改 `processImage` 函数**：

```javascript
// 删除以下代码块（约 1862-1867 行）
if (positionState.zone === 'far') {
  if (img.src && !img.dataset.lazySrc) {
    img.dataset.lazySrc = img.src
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  }
  ...
}

// 替换为
if (positionState.zone === 'far') {
  // 保持原 src，仅设置懒加载属性
  img.loading = 'lazy'
  img.fetchPriority = 'low'
  img.dataset._raLazyLoad = '1'
  // 滚动感知预加载会在用户滚动时自动预加载
  return
}
```

### 3.3 滚动速度检测

**新增滚动监听模块**：

```javascript
// 滚动状态
const _scrollState = {
  lastY: 0,
  lastTime: 0,
  speed: 0,           // 当前滚动速度 px/s
  direction: 'down',  // 'down' | 'up' | 'none'
  isScrolling: false,
  stopTimer: null,
}

// 初始化滚动监听
function _initScrollDetection() {
  if (!state.config.scrollPreload?.enabled) {
    return
  }

  window.addEventListener('scroll', _handleScroll, { passive: true })
  addLog('info', 'loader', 'init', { feature: 'scrollDetection' })
}

// 滚动事件处理
function _handleScroll() {
  const config = state.config.scrollPreload
  const now = performance.now()
  const currentY = window.scrollY
  const dt = now - _scrollState.lastTime

  // 计算滚动速度
  if (dt > 0) {
    const dy = currentY - _scrollState.lastY
    _scrollState.speed = Math.abs(dy) / dt * 1000  // px/s
    _scrollState.direction = dy > 0 ? 'down' : dy < 0 ? 'up' : 'none'
  }

  _scrollState.lastY = currentY
  _scrollState.lastTime = now
  _scrollState.isScrolling = true

  // 重置停止计时器
  clearTimeout(_scrollState.stopTimer)
  _scrollState.stopTimer = setTimeout(() => {
    _scrollState.isScrolling = false
    _scrollState.speed = 0
    _onScrollStop()
  }, config.stopDelay)

  // 动态调整预加载
  _updatePreloadStrategy()
}

// 滚动停止回调
function _onScrollStop() {
  // 恢复默认预加载距离
  _adjustIntersectionObserver(state.config.scrollPreload.normalPreloadDistance)
}
```

### 3.4 动态预加载策略

```javascript
// 根据滚动速度调整预加载距离
function _updatePreloadStrategy() {
  const config = state.config.scrollPreload
  let distance = config.normalPreloadDistance

  if (_scrollState.speed > config.fastThreshold) {
    distance = config.fastPreloadDistance
  } else if (_scrollState.speed < config.slowThreshold) {
    distance = config.slowPreloadDistance
  }

  // 预加载方向优化：只预加载滚动方向的图片
  const preferBottom = _scrollState.direction === 'down'
  _adjustIntersectionObserver(distance, preferBottom)
}

// 调整 IntersectionObserver 的 rootMargin
function _adjustIntersectionObserver(distance, preferBottom = true) {
  if (!_lazyLoadObserver) {
    return
  }

  // 构建非对称 rootMargin
  // 快速向下滚动时：底部预加载距离更大
  const topMargin = preferBottom ? distance * 50 : distance * 100
  const bottomMargin = preferBottom ? distance * 100 : distance * 50
  const rootMargin = `${topMargin}% 0px ${bottomMargin}% 0px`

  // 当前配置相同则跳过
  if (_lazyLoadObserver._currentMargin === rootMargin) {
    return
  }

  // 重建 Observer
  _destroyLazyLoadObserver()
  _setupLazyLoadObserverWithMargin(rootMargin)
  _lazyLoadObserver._currentMargin = rootMargin

  addLog('info', 'loader', 'preload_adjust', {
    distance,
    speed: Math.round(_scrollState.speed),
    direction: _scrollState.direction,
  })
}
```

### 3.5 修改 IntersectionObserver 初始化

```javascript
function _setupLazyLoadObserverWithMargin(rootMargin) {
  if (typeof IntersectionObserver === 'undefined') {
    return
  }

  _lazyLoadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target

          // 恢复 src（如果有备份）
          if (el.dataset.lazySrc) {
            el.src = el.dataset.lazySrc
            delete el.dataset.lazySrc
          }

          // 图片优先压缩
          if (el.tagName === 'IMG' && !el.complete && el.src) {
            enqueueCompress(el, el.src)
          }

          _lazyLoadObserver.unobserve(el)
        }
      })
    },
    { rootMargin }
  )
}
```

---

## 四、文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `content/modules/resource-accelerator.js` | 修改 | 移除 src 替换，新增滚动感知预加载 |

---

## 五、验收标准

- [ ] 滚动时无空白占位图片
- [ ] 快速滚动时预加载距离自动增大
- [ ] 停止滚动后预加载距离恢复默认
- [ ] 带宽消耗不显著增加（可通过预加载距离控制）
- [ ] 向下滚动时优先预加载下方图片

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 滚动监听影响性能 | 低 | 中 | 使用 passive 事件，节流采样 |
| 预加载过多消耗带宽 | 中 | 中 | 根据滚动速度动态调整，限制最大距离 |
| IntersectionObserver 频繁重建 | 低 | 低 | 缓存当前配置，相同则跳过 |

---

## 七、后续优化

1. **网络状态感知**：慢网络时减少预加载距离
2. **设备性能感知**：低端设备减少预加载
3. **用户行为学习**：记录用户滚动习惯，预测预加载时机
