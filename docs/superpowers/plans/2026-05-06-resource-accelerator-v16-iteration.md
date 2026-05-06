# 资源加速器 v16 迭代计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 基线版本：v15（自适应压缩 + 智能预加载）
> 创建时间：2026-05-06

**Goal:** 极致优化加载速度，通过关键资源预加载升级和图片渐进式占位，实现用户感知"秒开"。

**Architecture:** 迭代1升级SmartPreloadV2的资源提示策略，aboveFold关键资源使用`<link rel="preload">`（高优先级）而非`prefetch`（低优先级）。迭代2在图片懒加载流程中注入LQIP占位+CSS过渡动画，消除白屏闪烁。

**Tech Stack:** HTML `<link rel="preload/as="image">`, CSS `filter: blur()` + `@keyframes fade-in`, Canvas API (现有)

---

## 文件变更汇总

| 文件 | 迭代1 | 迭代2 |
|------|-------|-------|
| `content/modules/resource-accelerator.js` | ✅ 修改 | ✅ 修改 |

---

## 迭代 1: 关键资源预加载升级

**目标：** aboveFold关键资源用`preload`（高优先级），非关键保持`prefetch`（低优先级）

### 问题分析

SmartPreloadV2的`executePreload()`对所有资源统一使用`<link rel="prefetch">`。prefetch是低优先级提示，浏览器可能不立即下载。aboveFold的关键图片应该用`<link rel="preload" as="image">`让浏览器立即高优先级下载。

### 功能设计

**修改executePreload方法** — 根据reason参数决定rel类型：

| reason | rel | 说明 |
|--------|-----|------|
| aboveFold / hover / scroll-predict | `preload` | 高优先级，立即下载 |
| content-detail / related-link / related-content / next-page | `prefetch` | 低优先级，空闲下载 |

**修改config** — 新增maxPreloads限制preload元素数量：

```javascript
smartPreloadV2: {
  // ...existing config...
  priorityScheduling: {
    // ...existing...
    maxPreloads: 6,  // 最大preload元素数（高优先级资源）
  },
},
```

### 集成代码

**1. 修改DEFAULT_CONFIG中smartPreloadV2.priorityScheduling**

在现有`priorityScheduling`配置中添加`maxPreloads`：

```javascript
priorityScheduling: {
  enabled: true,
  maxConcurrent: 3,
  priorityQueue: true,
  abortOnNavigate: true,
  maxPreloads: 6,  // 新增：最大preload元素数
},
```

**2. 修改SmartPreloadV2.executePreload方法**

```javascript
// 修改前：
executePreload(url, reason) {
  this.activePreloads++;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.dataset.preloadReason = reason;
  document.head.appendChild(link);
  setTimeout(() => {
    this.activePreloads--;
    this.processQueue();
  }, 50);
}

// 修改后：
_executePreload(url, reason) {
  this.activePreloads++;
  const isCritical = reason === 'aboveFold' || reason === 'hover' || reason === 'scroll-predict';
  const link = document.createElement('link');
  link.rel = isCritical ? 'preload' : 'prefetch';
  link.href = url;
  if (isCritical) {
    link.as = 'image';
    // 限制preload元素数量（检查在append之前，避免off-by-one）
    const preloadCount = document.querySelectorAll('link[rel="preload"][data-preload-reason]').length;
    if (preloadCount >= (this.config.priorityScheduling.maxPreloads || 6)) {
      link.rel = 'prefetch';
      delete link.as;
    }
  }
  link.dataset.preloadReason = reason;
  document.head.appendChild(link);
  setTimeout(() => {
    this.activePreloads--;
    this.processQueue();
  }, 50);
}
```

**3. 修改detectCriticalResources方法 — 标记aboveFold图片的reason**

```javascript
// 在detectCriticalResources中，aboveFold图片的reason改为'aboveFold'：
// 当前代码在 preloadNextResources 中使用 'scroll-predict' 作为reason
// 需要让 detectCriticalResources 中标记的 aboveFold 图片使用 'aboveFold' reason
// 这些图片会在 init 时通过 schedulePreload 被调度
```

**4. 添加init时的关键资源预加载**

在`init()`方法末尾，`analyzePageStructure()`之后，添加关键资源的立即预加载：

```javascript
init() {
  if (!this.config.enabled) return;
  this.analyzePageStructure();
  this.preloadCriticalResources();  // 新增
  this.initScrollListener();
  this.initMouseListener();
  this.initDwellTimeTracker();
  console.log(`${LOG_PREFIX} [SmartPreloadV2] 初始化完成`);
}

// 新增方法：
preloadCriticalResources() {
  if (!this.criticalResources || this.criticalResources.length === 0) return;
  // 只预加载aboveFold图片（priority === 0）
  this.criticalResources
    .filter(r => r.type === 'image' && r.priority === 0)
    .slice(0, this.config.priorityScheduling.maxPreloads || 6)
    .forEach(r => this._executePreload(r.url, 'aboveFold'));
}
```

**5. 修改所有executePreload调用 — 使用新方法名**

`executePreload` 重命名为 `_executePreload`，需要更新所有调用点：
- `schedulePreload` 中（line ~2558）：`this._executePreload(url, reason);`
- `processQueue` 中（line ~2578）：`this._executePreload(item.url, item.reason);`

### 验收标准

- [ ] aboveFold图片使用`<link rel="preload" as="image">`
- [ ] 非关键资源保持`<link rel="prefetch">`
- [ ] preload元素数量不超过maxPreloads限制
- [ ] 超过限制时降级为prefetch
- [ ] 页面初始化时立即预加载关键图片
- [ ] 向后兼容：disabled时无影响

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| preload过多抢占带宽 | 首屏渲染变慢 | maxPreloads限制 + 降级机制 |
| 浏览器不支持preload as=image | 降级为prefetch | 浏览器自动处理 |

---

## 迭代 2: 图片渐进式占位

**目标：** 图片加载过程中显示模糊占位 + 交叉淡入，消除白屏闪烁

### 问题分析

当前图片懒加载流程：
1. `processImage()` → 设置`loading="lazy"` + `fetchPriority="low"` → 设置1x1透明GIF占位
2. `enqueueCompress()` → 加入压缩队列
3. `compressImage()` → Canvas压缩
4. 加载压缩后的图片 → 图片突然出现

问题：1x1透明GIF占位 → 图片突然出现，用户看到白屏闪烁。

### 功能设计

**LQIP渐进式占位流程：**
1. 图片创建时 → 设置1px浅灰色占位 + CSS模糊样式
2. 图片进入可视区 → 浏览器开始下载原图（native lazy loading）
3. 图片下载完成 → CSS过渡：从模糊到清晰 + 淡入动画
4. 如果启用了压缩 → 压缩完成后同样触发过渡

**CSS过渡规则：**
```css
img[data-lqip] {
  filter: blur(8px);
  transition: filter 0.3s ease-out, opacity 0.3s ease-out;
  opacity: 0.6;
}
img[data-lqip-loaded] {
  filter: blur(0);
  opacity: 1;
}
```

**渐进式占位配置：**
```javascript
imageLazyLoad: true,
lqip: {
  enabled: true,
  blurRadius: 8,         // 模糊半径
  transitionDuration: 300, // 过渡时长(ms)
  placeholderColor: '#f0f0f0', // 占位颜色
},
```

### 集成代码

**1. 添加配置到DEFAULT_CONFIG**

在`imageMaxDimension`之后添加：

```javascript
// 渐进式图片占位
lqip: {
  enabled: true,
  blurRadius: 8,
  transitionDuration: 300,
  placeholderColor: '#f0f0f0',
},
```

**2. 添加CSS注入函数**

```javascript
// ========== LQIP 渐进式占位 ==========
let _lqipStyleInjected = false;

function _injectLqipCSS() {
  if (_lqipStyleInjected) return;
  const config = state.config.lqip;
  if (!config?.enabled) return;

  const style = document.createElement('style');
  style.textContent = `
    img[data-lqip] {
      filter: blur(${config.blurRadius}px);
      transition: filter ${config.transitionDuration}ms ease-out, opacity ${config.transitionDuration}ms ease-out;
      opacity: 0.6;
      background-color: ${config.placeholderColor};
    }
    img[data-lqip-loaded] {
      filter: blur(0);
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
  _lqipStyleInjected = true;
}
```

**3. 修改processImage函数 — 注入LQIP占位**

在`processImage`中，在`enqueueCompress`调用之前设置LQIP占位（覆盖压缩和非压缩两条路径）：

```javascript
// 修改前（line ~1010-1014）：
img.dataset.src = originalSrc;

// 图片压缩：预压缩后直接加载
if (state.config.imageCompress) {
  enqueueCompress(img, originalSrc);
}

// 修改后：
img.dataset.src = originalSrc;

// LQIP：在压缩/懒加载之前设置占位
if (state.config.lqip?.enabled) {
  img.dataset.lqip = '1';
  img.style.backgroundColor = state.config.lqip.placeholderColor || '#f0f0f0';
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

// 图片压缩：预压缩后直接加载
if (state.config.imageCompress) {
  enqueueCompress(img, originalSrc);
}
```

注意：LQIP占位必须在`enqueueCompress`之前设置，这样压缩路径和非压缩路径都能触发过渡。当压缩成功/失败设置新src时，`data-lqip-loaded`属性会触发CSS过渡。

**4. 添加LQIP过渡辅助函数**

为避免重复代码，提取LQIP过渡逻辑为独立函数：

```javascript
// ========== LQIP 过渡辅助 ==========
function _triggerLqipTransition(img) {
  if (!img.dataset.lqip) return;
  if (img.complete) {
    img.dataset.lqipLoaded = '1';
  } else {
    img.addEventListener('load', () => {
      img.dataset.lqipLoaded = '1';
    }, { once: true });
  }
}
```

**5. 修改processCompressQueue — 图片加载完成时触发LQIP过渡**

在`processCompressQueue`中，压缩成功/失败/catch三个路径都调用`_triggerLqipTransition`：

```javascript
// 压缩成功后（line ~1217）：
task.img.src = compressed;
task.img.dataset.lazyLoading = 'false';
task.img.dataset.lazyLoaded = 'true';
task.img.dataset.compressed = 'true';
_triggerLqipTransition(task.img);  // 新增
addLog('info', 'image', 'compress', { url: task.src, reason: 'success', duration });

// 压缩失败/跳过回退到原图后（line ~1228）：
task.img.src = task.src;
task.img.dataset.lazyLoading = 'false';
task.img.dataset.lazyLoaded = 'true';
_triggerLqipTransition(task.img);  // 新增
addLog('info', 'image', 'skip', { url: task.src, reason: 'not_worth_compressing', duration });

// catch块异常回退（line ~1237）：
} catch {
  task.img.src = task.src;
  task.img.dataset.lazyLoading = 'false';
  task.img.dataset.lazyLoaded = 'true';
  _triggerLqipTransition(task.img);  // 新增
  addLog('error', 'image', 'error', { url: task.src, reason: 'compress_exception' });
}
```

**6. 在init()中注入CSS**

在`init()`函数的其他初始化调用之前添加：

```javascript
// 1.19 注入LQIP样式
_injectLqipCSS();
```

**7. 添加destroy()清理**

```javascript
// 在destroy()中清理LQIP样式（可选，不清理也不影响功能）
// 无需清理，style元素不影响性能
```

### 验收标准

- [ ] 图片加载前显示浅灰色模糊占位
- [ ] 图片加载完成后模糊到清晰过渡
- [ ] 过渡动画平滑无闪烁
- [ ] 启用/禁用LQIP可配置
- [ ] 压缩图片和原图都正确触发过渡
- [ ] 不影响现有压缩和懒加载功能

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| CSS选择器污染 | 影响其他img元素 | 使用data属性精确匹配 |
| 过渡期间图片闪烁 | 用户体验差 | 使用once事件监听 |
| 内存占用 | style元素常驻 | 极小开销，可忽略 |

---

## 实施顺序

```
迭代1: 关键资源预加载升级 → 迭代2: 图片渐进式占位
```

**优先级**：迭代 1 > 迭代 2

**理由**：
- 迭代 1（预加载升级）ROI 最高：直接减少关键图片等待时间
- 迭代 2（LQIP占位）感知提升：消除视觉闪烁，提升"秒开"感

---

## 测试策略

### 迭代 1 测试用例

| 测试场景 | 预期结果 |
|---------|---------|
| 页面有aboveFold图片 | 生成`<link rel="preload" as="image">` |
| 非关键图片预加载 | 生成`<link rel="prefetch">` |
| preload数量超过maxPreloads | 降级为prefetch |
| SmartPreloadV2 disabled | 不生成任何preload/prefetch |
| destroy后 | 所有preload/prefetch link被移除 |

### 迭代 2 测试用例

| 测试场景 | 预期结果 |
|---------|---------|
| 图片加载前 | 显示模糊占位（data-lqip属性存在） |
| 图片加载完成后 | 触发模糊到清晰过渡（data-lqip-loaded属性） |
| LQIP disabled | 使用原始透明GIF占位 |
| 压缩成功 | 压缩图片触发LQIP过渡 |
| 压缩失败回退原图 | 原图触发LQIP过渡 |

### 测试命令

```bash
npm test
```

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 新增配置有合理默认值
5. **不引入可视化** — 不添加图表、可视化面板等 UI 功能
6. **不引入分享** — 不添加配置分享、数据导出分享等功能
7. **不引入插件** — 不添加插件系统、扩展 API 等功能
