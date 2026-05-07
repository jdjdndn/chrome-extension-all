# 资源加速器 v9 迭代计划

> 基线版本：v8（智能调度 + 实时日志 + 性能可视化 + SVG优化 + 预加载优先级）
> 完成时间：2026-05-05

---

## v9 完成状态 ✅

| 迭代   | 功能                 | 状态      |
| ------ | -------------------- | --------- |
| 迭代 1 | Web Worker 图片压缩  | ✅ 已完成 |
| 迭代 2 | 网络感知自适应       | ✅ 已完成 |
| 迭代 3 | 关键资源识别与优先级 | ✅ 已完成 |
| 迭代 4 | 字体加载优化         | ✅ 已完成 |
| 迭代 5 | 错误恢复与重试       | ✅ 已完成 |

---

## 当前状态 (v8 → v9 升级)

| 模块                | 状态 | 说明                                              |
| ------------------- | ---- | ------------------------------------------------- |
| JS库替换            | ✅   | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询 |
| CSS框架替换         | ✅   | 14+ CSS 库，独立开关                              |
| 字体替换            | ✅   | Google Fonts / FontAwesome 镜像                   |
| 图片懒加载          | ✅   | 原生 `loading="lazy"` + `fetchPriority="low"`     |
| 图片压缩            | ✅   | Canvas 重绘 WebP/JPEG/AVIF + Web Worker 并行压缩  |
| 站点级配置          | ✅   | 按域名精确/通配符匹配，功能级开关                 |
| 高级过滤规则        | ✅   | 5 种匹配类型 + 4 种动作类型                       |
| 配置导入导出        | ✅   | JSON 格式，版本号校验                             |
| 性能基线对比        | ✅   | 加速前后数据对比                                  |
| 第三方脚本延迟      | ✅   | 自动检测 + 用户规则 + 三级策略                    |
| CDN健康探测         | ✅   | HEAD 探测，5 分钟缓存，RTT 记录                   |
| 智能调度            | ✅   | 优先级队列 + 动态批量 + CDN探测优先级             |
| 实时日志            | ✅   | 环形缓冲区(200条) + 错误持久化 + 筛选             |
| SVG优化             | ✅   | 移除注释/元数据 + 小SVG内联                       |
| 预加载优先级        | ✅   | 字体权重优先 + 最大数量控制                       |
| **Web Worker 压缩** | ✅   | Worker池 + 并行压缩 + 降级策略                    |
| **网络感知**        | ✅   | 自动检测网络质量 + 动态调整策略                   |
| **关键资源识别**    | ✅   | 首屏CSS/JS/字体优先加载                           |
| **字体加载优化**    | ✅   | font-display注入 + 中文字体子集化                 |
| **错误恢复**        | ✅   | CDN重试 + 指数退避 + 熔断机制                     |

---

## 迭代 1: Web Worker 图片压缩

**目标**：将图片压缩从主线程卸载到 Web Worker，消除卡顿

### 问题分析

当前问题：

- Canvas 重绘在主线程执行，压缩 500KB+ 图片时阻塞渲染
- 页面滚动、交互在压缩期间明显卡顿
- 无法利用多核 CPU 并行压缩

### 功能设计

**Worker 池管理**

```javascript
// Worker 池配置
{
  workerPool: {
    enabled: true,
    maxWorkers: navigator.hardwareConcurrency || 4,
    taskTimeout: 10000,  // 单任务超时 10s
    fallbackToMain: true,  // Worker 不可用时降级到主线程
  }
}
```

**压缩任务分发**

```javascript
// 主线程：发送压缩任务到 Worker
function compressImageViaWorker(img, src, priority) {
  if (!_workerPool || !state.config.workerPool.enabled) {
    return compressImage(img, src) // 降级到主线程
  }

  return new Promise((resolve, reject) => {
    const taskId = _nextTaskId++
    const timeout = setTimeout(() => {
      _pendingTasks.delete(taskId)
      resolve(compressImage(img, src)) // 超时降级
    }, state.config.workerPool.taskTimeout)

    _pendingTasks.set(taskId, { resolve, reject, timeout })

    // 获取图片数据并发送到 Worker
    fetch(src)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader()
        reader.onload = () => {
          _workerPool.postMessage({
            type: 'compress',
            taskId,
            data: reader.result,
            quality: state.config.imageQuality,
            maxDimension: state.config.imageMaxDimension,
            format: state._imageFormat,
          })
        }
        reader.readAsArrayBuffer(blob)
      })
  })
}

// Worker 代码（内联到 Blob URL）
const workerCode = `
  self.onmessage = function(e) {
    if (e.data.type === 'compress') {
      // 在 Worker 中创建 OffscreenCanvas 执行压缩
      const { data, quality, maxDimension, format } = e.data;
      const blob = new Blob([data]);
      createImageBitmap(blob).then(bitmap => {
        const canvas = new OffscreenCanvas(
          Math.min(bitmap.width, maxDimension),
          Math.min(bitmap.height, maxDimension)
        );
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        canvas.convertToBlob({ type: format, quality }).then(result => {
          const reader = new FileReader();
          reader.onload = () => {
            self.postMessage({
              type: 'compressed',
              taskId: e.data.taskId,
              data: reader.result,
              originalSize: data.byteLength,
              compressedSize: result.size,
            });
          };
          reader.readAsArrayBuffer(result);
        });
      });
    }
  };
`
```

**降级策略**

```javascript
// Worker 不支持时的降级检测
const supportsWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'

// 任务队列溢出时降级
function handlePoolOverflow(task) {
  if (_pendingTasks.size > state.config.maxCompressQueueSize) {
    // 直接在主线程处理
    return compressImage(task.img, task.src)
  }
  // 排队等待
  return new Promise((resolve) => _taskQueue.push({ ...task, resolve }))
}
```

### 文件变更

| 文件                                      | 变更                               |
| ----------------------------------------- | ---------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 Worker 池、任务分发、降级逻辑 |

### 验收标准

- [ ] 图片压缩在 Worker 中执行，主线程无卡顿
- [ ] Worker 池大小自动适配 CPU 核心数
- [ ] Worker 不可用时自动降级到主线程
- [ ] 压缩超时自动降级
- [ ] 内存占用不显著增加

### 风险

| 风险                   | 影响             | 缓解                      |
| ---------------------- | ---------------- | ------------------------- |
| OffscreenCanvas 兼容性 | 部分浏览器不支持 | 降级到主线程 Canvas       |
| Worker 通信开销        | 小图压缩变慢     | 小图(<50KB)直接主线程处理 |
| 内存双倍占用           | 页面内存增加     | 限制并发 Worker 数量      |

---

## 迭代 2: 网络感知自适应

**目标**：根据网络质量动态调整压缩策略和功能开关

### 问题分析

当前问题：

- WiFi 和 3G 使用相同压缩质量（0.8），3G 下仍然加载未压缩大图
- 不根据网络速度调整并发数和批量大小
- 无网络变化响应，WiFi 断开后策略不调整

### 功能设计

**网络质量检测**

```javascript
// 网络质量评估
function getNetworkQuality() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!conn) return 'unknown'

  const { effectiveType, downlink, rtt } = conn

  // 基于 effectiveType + downlink + rtt 综合判断
  if (effectiveType === '4g' && downlink >= 5) return 'fast' // WiFi/高速 4G
  if (effectiveType === '4g' || (effectiveType === '3g' && downlink >= 1.5)) return 'medium' // 普通 4G
  if (effectiveType === '3g' || effectiveType === '2g') return 'slow' // 3G/2G
  return 'slow' // unknown 默认保守
}
```

**自适应策略矩阵**

```javascript
const ADAPTIVE_STRATEGIES = {
  fast: {
    imageQuality: 0.85,
    imageMaxConcurrency: 5,
    batchInterval: 50,
    enableImageCompress: true,
    enableSvgOptimize: true,
    maxPreloadHints: 15,
  },
  medium: {
    imageQuality: 0.75,
    imageMaxConcurrency: 3,
    batchInterval: 80,
    enableImageCompress: true,
    enableSvgOptimize: true,
    maxPreloadHints: 10,
  },
  slow: {
    imageQuality: 0.6,
    imageMaxConcurrency: 2,
    batchInterval: 150,
    enableImageCompress: true,
    enableSvgOptimize: true,
    maxPreloadHints: 5,
    // 慢网络额外优化
    forceImageLazyLoad: true, // 强制所有图片懒加载
    aggressiveDeferral: true, // 激进延迟非关键脚本
  },
  unknown: {
    // 保持用户配置不变
  },
}

function applyNetworkStrategy() {
  const quality = getNetworkQuality()
  const strategy = ADAPTIVE_STRATEGIES[quality]
  if (!strategy || quality === 'unknown') return

  // 合并策略到配置（用户显式配置优先）
  Object.keys(strategy).forEach((key) => {
    if (key in state.config) {
      state.config[key] = strategy[key]
    }
  })
}
```

**网络变化监听**

```javascript
// 监听网络变化
if (navigator.connection) {
  navigator.connection.addEventListener('change', () => {
    const newQuality = getNetworkQuality()
    if (newQuality !== _lastNetworkQuality) {
      _lastNetworkQuality = newQuality
      applyNetworkStrategy()
      addLog('info', 'system', 'network', {
        reason: `网络变化: ${newQuality}`,
        details: {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
        },
      })
    }
  })
}
```

### 文件变更

| 文件                                      | 变更                               |
| ----------------------------------------- | ---------------------------------- |
| `content/modules/resource-accelerator.js` | 新增网络检测、自适应策略、变化监听 |
| `popup.html`                              | 新增网络状态显示                   |
| `popup.js`                                | 新增网络质量展示逻辑               |

### 验收标准

- [ ] 自动检测网络质量（fast/medium/slow）
- [ ] 根据网络质量调整压缩质量和并发数
- [ ] 慢网络激进优化（强制懒加载、激进延迟）
- [ ] 网络变化时自动调整策略
- [ ] 用户显式配置不被覆盖

### 风险

| 风险                  | 影响                 | 缓解                |
| --------------------- | -------------------- | ------------------- |
| Connection API 兼容性 | 部分浏览器不支持     | 降级到 unknown 策略 |
| 网络抖动频繁切换      | 策略频繁变化         | 防抖 5s + 变化阈值  |
| 激进策略影响功能      | 脚本延迟导致页面异常 | 保留白名单机制      |

---

## 迭代 3: 关键资源识别与优先级

**目标**：识别首屏关键资源，优化加载顺序

### 问题分析

当前问题：

- 所有资源同等对待，首屏关键 JS/CSS 和非关键资源一起处理
- Preload 提示不区分关键/非关键，可能浪费带宽
- 图片懒加载阈值固定，不感知实际视口

### 功能设计

**关键资源检测**

```javascript
// 关键资源识别规则
const CRITICAL_PATTERNS = {
  // 关键 CSS（首屏样式）
  css: [/\/css\/main\./i, /\/css\/app\./i, /\/styles\//i, /theme.*\.css$/i],
  // 关键 JS（框架 + 入口）
  js: [
    /react\.production/i,
    /vue\.production/i,
    /angular.*\.min\.js$/i,
    /\/app\./i,
    /\/main\./i,
    /\/vendor\./i,
  ],
  // 关键字体
  font: [/primary/i, /body/i, /heading/i, /roboto/i, /inter/i],
}

function isCriticalResource(url, type) {
  const patterns = CRITICAL_PATTERNS[type] || []
  return patterns.some((p) => p.test(url))
}
```

**优先级队列增强**

```javascript
// 资源优先级：critical > high > normal > low
function getResourcePriority(url, type) {
  if (isCriticalResource(url, type)) return 0 // critical
  if (type === 'css') return 1 // CSS 通常关键
  if (type === 'font') return 1 // 字体通常关键
  if (type === 'js') return 2 // JS 需要判断
  if (type === 'image') return 3 // 图片通常非关键
  return 2
}

// 第三方脚本延迟时考虑优先级
function shouldDeferScript(url) {
  const priority = getResourcePriority(url, 'js')
  if (priority === 0) return false // 关键脚本不延迟
  if (priority === 1) return false // 高优先级不延迟

  // 检查是否匹配延迟规则
  return matchDeferralRules(url)
}
```

**Preload 智能控制**

```javascript
function shouldPreload(url, type) {
  const priority = getResourcePriority(url, type)

  // 关键资源总是 preload
  if (priority === 0) return true

  // 非关键资源检查数量限制
  const maxHints = state.config.maxPreloadHints
  if (state.stats.preloadHints >= maxHints) return false

  // 慢网络减少 preload
  const quality = getNetworkQuality()
  if (quality === 'slow' && priority > 1) return false

  return true
}
```

### 文件变更

| 文件                                      | 变更                                               |
| ----------------------------------------- | -------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增关键资源检测、优先级队列增强、Preload 智能控制 |

### 验收标准

- [ ] 自动识别关键 CSS/JS/字体
- [ ] 关键资源不被延迟或跳过
- [ ] 非关键资源优先级降低
- [ ] Preload 根据关键性智能控制
- [ ] 慢网络减少非关键 Preload

### 风险

| 风险         | 影响               | 缓解                               |
| ------------ | ------------------ | ---------------------------------- |
| 关键资源误判 | 关键脚本被延迟     | 默认不延迟，仅延迟明确的非关键资源 |
| 规则维护成本 | 新网站需要更新规则 | 支持用户自定义关键资源模式         |

---

## 迭代 4: 字体加载优化

**目标**：优化字体加载策略，减少字体对渲染的阻塞

### 问题分析

当前问题：

- 字体替换仅改来源，不处理加载策略
- 无 font-display 控制，可能导致 FOIT（字体不可见闪烁）
- 不支持字体子集化，中文字体加载过大
- 字体预加载无权重/字符集感知

### 功能设计

**font-display 注入**

```javascript
// 检测并注入 font-display: swap
function optimizeFontDisplay(linkEl) {
  // 检查是否已设置 font-display
  const existingDisplay = linkEl.getAttribute('data-font-display')
  if (existingDisplay) return

  // 注入 font-display: swap（避免 FOIT）
  linkEl.setAttribute('data-font-display', 'swap')

  // 对于关键字体使用 font-display: optional（避免布局偏移）
  if (isCriticalFont(linkEl.href)) {
    linkEl.setAttribute('data-font-display', 'optional')
  }
}
```

**字体子集化提示**

```javascript
// 检测中文字体并提示子集化
function detectChineseFont(url) {
  const chinesePatterns = [
    /noto.*sc/i,
    /source.*han/i,
    /思源/i,
    /microsoft.*yahei/i,
    /simhei/i,
    /simsun/i,
  ]
  return chinesePatterns.some((p) => p.test(url))
}

// 中文字体使用 Google Fonts 的 subset 参数
function getSubsetUrl(url, fontName) {
  if (!detectChineseFont(url)) return url

  // 添加 subset 参数，仅加载拉丁字符（常用子集）
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}subset=latin`
}
```

**字体预加载优化**

```javascript
// 基于字体权重的预加载策略
function getFontPreloadPriority(fontUrl) {
  // 检测字体权重
  const weightMatch = fontUrl.match(/(\d{3})/)
  const weight = weightMatch ? parseInt(weightMatch[1]) : 400

  // 400/700 优先预加载
  if (weight === 400 || weight === 700) return 0
  // 300/500 次优先
  if ([300, 500].includes(weight)) return 1
  // 其他权重低优先级
  return 2
}

// 限制同族字体预加载数量
function shouldPreloadFont(fontUrl, family) {
  const familyKey = family || extractFamily(fontUrl)
  const preloaded = state._fontPreloadedByFamily.get(familyKey) || 0

  // 每个字体族最多预加载 2 个权重
  if (preloaded >= 2) return false

  state._fontPreloadedByFamily.set(familyKey, preloaded + 1)
  return true
}
```

### 文件变更

| 文件                                      | 变更                                           |
| ----------------------------------------- | ---------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 font-display 注入、字体子集化、预加载优化 |

### 验收标准

- [ ] 自动注入 font-display: swap
- [ ] 关键字体使用 font-display: optional
- [ ] 中文字体添加 subset 参数
- [ ] 每个字体族最多预加载 2 个权重
- [ ] 字体加载不阻塞首屏渲染

### 风险

| 风险                      | 影响           | 缓解                     |
| ------------------------- | -------------- | ------------------------ |
| font-display 注入影响样式 | 字体闪烁       | 仅对替换的字体注入       |
| subset 参数不兼容         | 字体加载失败   | 检测响应状态，失败时回退 |
| 字体族识别错误            | 预加载数量不准 | 支持用户配置字体族映射   |

---

## 迭代 5: 错误恢复与重试

**目标**：CDN 请求失败时智能重试，提升资源加载成功率

### 问题分析

当前问题：

- CDN 请求失败后直接降级到下一个 CDN，无重试
- 网络抖动导致的临时失败无法恢复
- 无熔断机制，持续请求失败的 CDN

### 功能设计

**重试策略**

```javascript
{
  retry: {
    enabled: true,
    maxRetries: 2,          // 最大重试次数
    retryDelay: 500,        // 基础重试延迟 (ms)
    backoffMultiplier: 2,   // 退避倍数
    retryableErrors: [      // 可重试的错误类型
      'network',
      'timeout',
      '5xx',
    ],
  }
}
```

**智能重试逻辑**

```javascript
async function fetchWithRetry(url, options = {}) {
  const { maxRetries = 2, retryDelay = 500, backoffMultiplier = 2 } = state.config.retry

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000), // 5s 超时
      })

      if (response.ok) return response

      // 5xx 错误可重试
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt)
        await sleep(delay)
        continue
      }

      return response // 4xx 不重试
    } catch (error) {
      // 网络错误/超时可重试
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt)
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}
```

**CDN 熔断机制**

```javascript
// CDN 熔断器
const _circuitBreakers = new Map()

function getCircuitBreaker(cdnId) {
  if (!_circuitBreakers.has(cdnId)) {
    _circuitBreakers.set(cdnId, {
      failures: 0,
      lastFailure: 0,
      state: 'closed', // closed = 正常, open = 熔断, halfOpen = 试探
      threshold: 5, // 连续失败 5 次触发熔断
      cooldown: 60000, // 熔断冷却 60s
    })
  }
  return _circuitBreakers.get(cdnId)
}

function recordCdnFailure(cdnId) {
  const breaker = getCircuitBreaker(cdnId)
  breaker.failures++
  breaker.lastFailure = Date.now()

  if (breaker.failures >= breaker.threshold) {
    breaker.state = 'open'
    addLog('warn', 'cdn', 'circuit-open', {
      cdn: cdnId,
      reason: `连续失败 ${breaker.failures} 次，熔断 ${breaker.cooldown / 1000}s`,
    })
  }
}

function isCdnAvailable(cdnId) {
  const breaker = getCircuitBreaker(cdnId)
  if (breaker.state === 'closed') return true

  if (breaker.state === 'open') {
    // 冷却期过后进入半开状态
    if (Date.now() - breaker.lastFailure > breaker.cooldown) {
      breaker.state = 'halfOpen'
      return true // 允许一次试探请求
    }
    return false
  }

  return true // halfOpen 状态允许请求
}
```

### 文件变更

| 文件                                      | 变更                                 |
| ----------------------------------------- | ------------------------------------ |
| `content/modules/resource-accelerator.js` | 新增重试逻辑、熔断器、CDN 可用性检查 |
| `shared/cdn-mappings.js`                  | 修改 CDN 探测逻辑，集成熔断器        |

### 验收标准

- [ ] CDN 请求失败后自动重试（最多 2 次）
- [ ] 重试使用指数退避策略
- [ ] 5xx 错误触发重试，4xx 不重试
- [ ] 连续失败 5 次触发 CDN 熔断
- [ ] 熔断 60s 后自动恢复试探
- [ ] 熔断状态在日志中可见

### 风险

| 风险         | 影响            | 缓解                        |
| ------------ | --------------- | --------------------------- |
| 重试增加延迟 | 页面加载变慢    | 限制最大重试次数 + 超时控制 |
| 熔断误判     | 可用 CDN 被熔断 | 阈值设置合理 + 半开状态试探 |
| 内存泄漏     | 熔断器状态累积  | 定期清理过期熔断器状态      |

---

## 实施顺序

```
迭代1: Web Worker → 迭代2: 网络感知 → 迭代3: 关键资源 → 迭代4: 字体优化 → 迭代5: 错误恢复
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4 > 迭代 5

**理由**：

- 迭代 1（Web Worker）ROI 最高：直接消除主线程卡顿，用户体验提升最明显
- 迭代 2（网络感知）提升慢网络体验：移动端/弱网场景刚需
- 迭代 3（关键资源）优化首屏加载：对 LCP/FCP 指标提升显著
- 迭代 4（字体优化）减少字体阻塞：中文字体场景收益大
- 迭代 5（错误恢复）提升可靠性：减少资源加载失败率

---

## 风险评估

| 风险                   | 影响              | 缓解措施                        |
| ---------------------- | ----------------- | ------------------------------- |
| OffscreenCanvas 兼容性 | Worker 压缩不可用 | 降级到主线程 Canvas             |
| Connection API 缺失    | 网络感知不可用    | 降级到默认策略                  |
| 关键资源误判           | 关键脚本被延迟    | 默认不延迟 + 用户白名单         |
| font-display 注入冲突  | 字体显示异常      | 仅对替换字体注入 + 检测已有设置 |
| 重试增加延迟           | 页面加载变慢      | 限制次数 + 超时控制             |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 | 迭代4 | 迭代5 |
| ----------------------------------------- | ----- | ----- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    | ✅    | ✅    |
| `shared/cdn-mappings.js`                  | -     | -     | -     | -     | ✅    |
| `popup.html`                              | -     | ✅    | -     | -     | -     |
| `popup.js`                                | -     | ✅    | -     | -     | -     |

---

## 与 v8 的关系

v8 完成了智能调度、日志、可视化、SVG 优化、预加载优先级。v9 在此基础上：

| v8 基础设施        | v9 扩展                    |
| ------------------ | -------------------------- |
| 主线程 Canvas 压缩 | 扩展为 Web Worker 并行压缩 |
| 固定压缩策略       | 扩展为网络自适应策略       |
| 粗放 Preload 控制  | 扩展为关键资源精准识别     |
| 仅替换字体来源     | 扩展为字体加载策略优化     |
| CDN 失败直接降级   | 扩展为重试 + 熔断机制      |

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 新增配置有合理默认值
5. **测试覆盖** — 每个迭代需配套测试用例
6. **不引入可视化** — 不添加图表、可视化面板等 UI 功能
7. **不引入分享** — 不添加配置分享、数据导出分享等功能
8. **不引入插件** — 不添加插件系统、扩展 API 等功能
