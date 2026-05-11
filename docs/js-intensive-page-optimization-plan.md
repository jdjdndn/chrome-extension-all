# JS密集页面优化计划

## 问题背景

当前策略：`script > 100` 跳过延迟加载 = 放弃优化。
大量脚本的页面更需要优化，不应跳过。

---

## 核心策略

**统一采用 aggressive 优化策略**，不区分页面JS数量：

1. **viewport 优先**：仅处理视口内资源
2. **类型过滤**：图片 > 统计脚本，跳过核心 JS/CSS
3. **性能预算**：首屏 800ms，超时停止
4. **后台分批**：视口外资源延迟后台处理

### 优势

- 简单可靠，无复杂判断逻辑
- 适配所有页面，无需调研阈值
- 低端设备友好，默认保守策略
- 性能可控，有预算兜底

---

## 处理配置

### 资源处理优先级

| 优先级 | 资源类型      | 处理方式            |
| ------ | ------------- | ------------------- |
| P0     | 视口内图片    | 立即处理            |
| P1     | 统计/广告脚本 | 延迟到后台          |
| P2     | 视口外图片    | 后台分批（1秒间隔） |
| P3     | CSS/字体      | 跳过                |
| P4     | 核心 JS       | 跳过                |

### 性能参数

```javascript
const CONFIG = {
  // 空闲调度
  idleTimeout: 100, // 空闲超时 ms
  maxConcurrentIdle: 1, // 最大并发空闲任务

  // 性能预算
  viewportBudget: 800, // 视口处理预算 ms
  backgroundBudget: 300, // 后台每批预算 ms

  // 批处理
  viewportBatchSize: 5, // 视口批处理大小
  backgroundBatchSize: 3, // 后台批处理大小
  backgroundInterval: 1000, // 后台间隔 ms（缩短响应滚动）

  // 预算检测
  budgetCheckInterval: 5, // 每 N 个资源检测一次预算

  // viewport 检测
  viewportRootMargin: '100px', // IntersectionObserver 预加载边距
  viewportTimeout: 100, // viewport 检测超时 ms

  // 缓存清理
  processedUrlsMaxSize: 1000, // 最大缓存条目
  processedUrlsTTL: 300000, // 缓存过期时间 ms (5分钟)

  // 低端设备调整
  lowEndMultiplier: 1.5, // 低端设备预算倍数
}
```

### 低端设备检测

```javascript
const isLowEnd =
  navigator.hardwareConcurrency <= 2 ||
  navigator.deviceMemory <= 2 ||
  navigator.connection?.effectiveType === '2g'

if (isLowEnd) {
  CONFIG.viewportBudget *= CONFIG.lowEndMultiplier
  CONFIG.backgroundBatchSize = 2
  CONFIG.backgroundInterval = 2000 // 低端设备延长间隔
}
```

---

## 修改文件清单

### 1. `content/main.js`

**删除 `checkJSIntensity()`**：不再需要判断JS密集度

**修改 `executeByPriority()`**：

```javascript
// 移除 isJSIntensive 判断
// 统一使用立即执行模式
const executeByPriority = () => {
  setupEarlyIntervention()
  init().catch((err) => {
    console.error('[Main] 初始化失败:', err)
  })
}
```

### 2. `content/modules/resource-accelerator.js`

**新增函数**：

```javascript
// ========== viewport 检测（IntersectionObserver） ==========

function _filterByViewport(resources) {
  return new Promise((resolve) => {
    // DOM 不完整时降级
    if (!document.body || document.readyState === 'loading') {
      resolve(resources.slice(0, CONFIG.viewportBatchSize))
      return
    }

    const visible = []
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.push(entry.target)
          }
        })
      },
      { rootMargin: CONFIG.viewportRootMargin }
    )

    resources.forEach((r) => observer.observe(r))

    // 超时兜底
    setTimeout(() => {
      observer.disconnect()
      resolve(visible)
    }, CONFIG.viewportTimeout)
  })
}

// ========== viewport 动态更新 ==========

let _viewportObserver = null
const _pendingViewportResources = new Set()

function _setupViewportObserver(processFn) {
  if (_viewportObserver) return

  _viewportObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && _pendingViewportResources.has(entry.target)) {
          _pendingViewportResources.delete(entry.target)
          processFn(entry.target).catch((err) => {
            console.warn('[ResourceAccelerator] 资源处理失败:', err)
          })
        }
      })
    },
    { rootMargin: CONFIG.viewportRootMargin }
  )
}

function _watchForViewport(resource, processFn) {
  if (!_viewportObserver) _setupViewportObserver(processFn)
  _pendingViewportResources.add(resource)
  _viewportObserver.observe(resource)
}

// ========== 类型判断 ==========

function _getResourceType(resource) {
  if (resource.tagName === 'IMG') return 'image'
  if (resource.tagName === 'SCRIPT') {
    if (_isAnalyticsScript(resource.src)) return 'analytics'
    return 'core-js'
  }
  if (resource.tagName === 'LINK') {
    if (resource.rel === 'stylesheet') return 'css'
    if (resource.as === 'font') return 'font'
  }
  return 'other'
}

// 统计脚本判断（可扩展）
function _isAnalyticsScript(src) {
  if (!src) return false
  const patterns = [
    'google-analytics',
    'googletagmanager',
    'baidu.com/hm',
    'cnzz.com',
    'umeng.com',
    'jsagent',
    'analytics',
    'tracker',
    'facebook.net/tr',
    'twitter.com/i/adsct',
    'hotjar',
    'segment.com',
    'mixpanel',
    'amplitude',
    'sentry',
  ]
  return patterns.some((p) => src.toLowerCase().includes(p))
}

// ========== 性能预算处理 ==========

async function _batchProcessWithBudget(resources, budgetMs, processFn) {
  const startTime = performance.now()
  const results = { processed: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < resources.length; i++) {
    // 每 N 个资源检测一次预算
    if (i % CONFIG.budgetCheckInterval === 0) {
      if (performance.now() - startTime > budgetMs) {
        console.warn('[ResourceAccelerator] 预算超时，停止处理')
        results.skipped = resources.length - i
        break
      }
    }

    // 单资源错误不影响整批
    try {
      await processFn(resources[i])
      results.processed++
    } catch (err) {
      results.errors++
      console.warn('[ResourceAccelerator] 资源处理失败:', err.message)
    }
  }

  return results
}

// ========== 后台分批调度 ==========

function _scheduleBackgroundBatch(resources, processFn) {
  let index = 0
  const batchSize = CONFIG.backgroundBatchSize

  const processBatch = async () => {
    const batch = resources.slice(index, index + batchSize)
    if (batch.length === 0) return

    const results = await _batchProcessWithBudget(batch, CONFIG.backgroundBudget, processFn)

    index += batchSize

    if (index < resources.length) {
      setTimeout(processBatch, CONFIG.backgroundInterval)
    }
  }

  // 首次延迟启动
  setTimeout(processBatch, CONFIG.backgroundInterval)
}

// ========== 缓存清理 ==========

function _cleanupProcessedUrls() {
  if (state.processedUrls.size > CONFIG.processedUrlsMaxSize) {
    // 简单策略：清空一半
    const entries = Array.from(state.processedUrls)
    const keepCount = Math.floor(CONFIG.processedUrlsMaxSize / 2)
    state.processedUrls = new Set(entries.slice(-keepCount))
    console.log('[ResourceAccelerator] 清理 processedUrls 缓存')
  }
}

// 定期清理
setInterval(_cleanupProcessedUrls, CONFIG.processedUrlsTTL)
```

**修改 `processImages()`**：

```javascript
async function processImages() {
  // 清理缓存
  _cleanupProcessedUrls()

  // 获取所有图片
  const images = Array.from(document.querySelectorAll('img[data-src], img[src]'))

  // 过滤已处理
  const unprocessed = images.filter((img) => {
    const url = img.src || img.dataset.src
    return url && !state.processedUrls.has(url)
  })

  if (unprocessed.length === 0) return

  // viewport 过滤（异步）
  const viewportImages = await _filterByViewport(unprocessed)
  const backgroundImages = unprocessed.filter((img) => !viewportImages.includes(img))

  // 视口图片立即处理（有预算）
  if (viewportImages.length > 0) {
    await _batchProcessWithBudget(viewportImages, CONFIG.viewportBudget, compressImage)
  }

  // 视口外图片：设置 viewport 监听（滚动时自动处理）
  backgroundImages.forEach((img) => {
    _watchForViewport(img, compressImage)
  })
}
```

**修改 `batchProcessExistingScripts()`**：

```javascript
async function batchProcessExistingScripts() {
  if (state.cspRestricted) return

  const scripts = Array.from(document.querySelectorAll('script[src]'))

  // 过滤已处理 + 仅统计脚本
  const analyticsScripts = scripts.filter((s) => {
    const url = s.src
    return url && !state.processedUrls.has(url) && _isAnalyticsScript(url)
  })

  // 延迟到后台处理
  _scheduleBackgroundBatch(analyticsScripts, replaceScript)

  // 核心 JS 跳过，不处理
}
```

### 3. `content/core/load-scheduler.js`

**修改默认配置**：

```javascript
const CONFIG = {
  idleTimeout: 100,
  maxConcurrentIdle: 1,
  forceExecuteTimeout: 300,
  debug: false,
}
```

---

## 处理流程

```
页面加载 (document_start)
    │
    ▼
init()
    │
    ▼
processImages()
    │
    ├─► 清理 processedUrls 缓存
    │
    ├─► 获取所有图片
    │
    ├─► 过滤已处理
    │
    ├─► _filterByViewport() [IntersectionObserver]
    │       │
    │       ├─► viewport 内 → 立即处理（800ms 预算）
    │       │                  ├─ 每 5 个资源检测预算
    │       │                  ├─ 单资源失败不影响整批
    │       │                  └─ 标记 processedUrls
    │       │
    │       └─► viewport 外 → _watchForViewport()
    │                          └─ 滚动进入视口时自动处理
    │
    └─► batchProcessExistingScripts()
            │
            ├─► 过滤：仅统计脚本
            │
            └─► 后台分批处理（1秒间隔）
                └─ 核心 JS 跳过
```

---

## 关键改进

### 1. IntersectionObserver 替代 getBoundingClientRect

| 对比     | getBoundingClientRect | IntersectionObserver |
| -------- | --------------------- | -------------------- |
| 性能     | 触发强制回流          | 无回流，异步         |
| 准确性   | 同步快照              | 实时更新             |
| 滚动响应 | 需手动监听            | 自动触发             |

### 2. 预算检测优化

```javascript
// 旧：每个资源检测（高开销）
for (const r of resources) {
  if (performance.now() - startTime > budgetMs) break
}

// 新：每 N 个检测（减少开销）
for (let i = 0; i < resources.length; i++) {
  if (i % CONFIG.budgetCheckInterval === 0) {
    if (performance.now() - startTime > budgetMs) break
  }
}
```

### 3. viewport 动态更新

```
滚动前：
  [viewport]  [图片A] [图片B] [图片C]
  └─ A 立即处理，B/C 加入监听

滚动后：
           [viewport]  [图片B] [图片C] [图片D]
           └─ B 进入视口，自动触发处理
```

### 4. 错误隔离

```javascript
// 单资源失败不影响整批
try {
  await processFn(resource)
  results.processed++
} catch (err) {
  results.errors++
  // 继续处理下一个
}
```

### 5. 缓存清理

```javascript
// 定期清理，防止内存泄漏
if (state.processedUrls.size > 1000) {
  // 保留最近 500 条
  state.processedUrls = new Set(recent500)
}
```

---

## 特殊场景处理

### CSP 限制

- 检测 `state.cspRestricted`
- CSP 下禁用脚本替换，仅处理图片
- 图片处理仍按 viewport 优先

### 动态 AJAX 资源

- 复用 MutationObserver
- 新资源自动加入 `_watchForViewport()` 监听
- 滚动进入视口时自动处理

### 已处理资源

- 复用 `state.processedUrls`
- 每次处理前过滤
- 定期清理防止内存泄漏

### 低端设备

- 预算增加 50%
- 批处理大小减半
- 后台间隔延长到 2 秒

### 用户自定义规则

- 用户规则优先
- `state.config.siteConfig.rules` 覆盖默认行为
- 用户禁用的功能直接跳过

### DOM 不完整

- `document.readyState === 'loading'` 时降级
- 只处理前 N 个资源，避免 viewport 检测失败

---

## 实现阶段

### Phase 1: 删除旧逻辑

- [ ] 删除 `content/main.js` 中 `checkJSIntensity()` 函数
- [ ] 删除 `executeByPriority()` 中 `isJSIntensive` 判断
- [ ] 简化优先级逻辑，统一立即执行

### Phase 2: viewport 检测

- [ ] 新增 `_filterByViewport()` 使用 IntersectionObserver
- [ ] 新增 `_setupViewportObserver()` 滚动监听
- [ ] 新增 `_watchForViewport()` 动态更新

### Phase 3: 性能预算优化

- [ ] 修改 `_batchProcessWithBudget()` 每 N 个检测
- [ ] 新增错误隔离（单资源失败不影响整批）
- [ ] 新增结果统计 { processed, skipped, errors }

### Phase 4: 缓存管理

- [ ] 新增 `_cleanupProcessedUrls()` 清理函数
- [ ] 新增定期清理定时器
- [ ] 新增配置项 `processedUrlsMaxSize`, `processedUrlsTTL`

### Phase 5: 修改入口函数

- [ ] 修改 `processImages()` 使用新 viewport 检测
- [ ] 修改 `batchProcessExistingScripts()` 仅处理统计脚本
- [ ] 修改 `load-scheduler.js` 默认配置

### Phase 6: 测试

- [ ] 测试 IntersectionObserver 准确性
- [ ] 测试滚动触发 viewport 更新
- [ ] 测试性能预算超时停止
- [ ] 测试单资源错误隔离
- [ ] 测试缓存清理
- [ ] 测试低端设备调整
- [ ] 测试 CSP 页面
- [ ] 测试 DOM 不完整场景

---

## 测试矩阵

| 场景             | 测试重点                                  |
| ---------------- | ----------------------------------------- |
| 普通博客         | IntersectionObserver 生效，非视口图片延迟 |
| douyin.com       | 性能预算生效，超时停止                    |
| youtube.com      | 统计脚本延迟，核心 JS 跳过                |
| 长页面滚动       | viewport 动态更新，滚动触发处理           |
| 快速滚动         | 资源处理不阻塞滚动                        |
| 低端设备模拟     | 预算增加，批处理减小                      |
| CSP 受限页面     | 仅图片处理，脚本跳过                      |
| AJAX 动态加载    | 新资源加入 viewport 监听                  |
| DOM loading 状态 | 降级处理，不崩溃                          |
| 单资源处理失败   | 错误隔离，继续处理其他                    |

---

## 回滚方案

1. **配置开关**：

   ```javascript
   state.config.viewportPriority.enabled = false
   ```

   禁用新策略，恢复原有逻辑

2. **快速回滚**：恢复 `checkJSIntensity()` 逻辑

3. **白名单域名**：

   ```javascript
   state.config.viewportPriority.excludeDomains = ['example.com']
   ```

   跳过特定域名

4. **降级开关**：
   ```javascript
   CONFIG.useIntersectionObserver = false
   ```
   回退到 `getBoundingClientRect`

---

## 预期效果

| 指标         | 当前           | 目标                 |
| ------------ | -------------- | -------------------- |
| 首屏处理时间 | 跳过（无优化） | < 800ms              |
| 滚动响应     | N/A            | 实时处理进入视口资源 |
| 主线程阻塞   | 跳过           | 减少 40%             |
| 低端设备内存 | N/A            | 减少 50%             |
| 处理成功率   | 0%             | > 90%                |
| 错误隔离     | 无             | 单资源失败不影响整批 |
| 内存泄漏风险 | 高             | 低（定期清理）       |
