# 资源加速器 v10 迭代计划

> 基线版本：v9（Web Worker + 网络感知 + 关键资源 + 字体优化 + 错误恢复）
> 创建时间：2026-05-05
> 完成时间：2026-05-05

---

## v10 完成状态 ✅

| 迭代   | 功能           | 状态      |
| ------ | -------------- | --------- |
| 迭代 1 | 资源依赖建模   | ✅ 已完成 |
| 迭代 2 | 内存占用监控   | ✅ 已完成 |
| 迭代 3 | 懒加载视口感知 | ✅ 已完成 |
| 迭代 4 | 配置热更新     | ✅ 已完成 |

---

## 当前状态 (v9 → v10 升级)

| 模块               | 状态 | 说明                                               |
| ------------------ | ---- | -------------------------------------------------- |
| JS库替换           | ✅   | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询  |
| CSS框架替换        | ✅   | 14+ CSS 库，独立开关                               |
| 字体替换           | ✅   | Google Fonts / FontAwesome 镜像 + font-display优化 |
| 图片懒加载         | ✅   | 视口感知懒加载 + 设备适配 + 滚动速度感知           |
| 图片压缩           | ✅   | Web Worker 并行压缩 + 内存压力感知                 |
| 站点级配置         | ✅   | 按域名精确/通配符匹配，功能级开关                  |
| 高级过滤规则       | ✅   | 5 种匹配类型 + 4 种动作类型                        |
| 配置导入导出       | ✅   | JSON 格式，版本号校验 + 配置热更新                 |
| 性能基线对比       | ✅   | 加速前后数据对比                                   |
| 第三方脚本延迟     | ✅   | 自动检测 + 用户规则 + 三级策略                     |
| CDN健康探测        | ✅   | HEAD 探测，5 分钟缓存，RTT 记录                    |
| 智能调度           | ✅   | 优先级队列 + 动态批量 + CDN探测优先级              |
| 实时日志           | ✅   | 环形缓冲区(200条) + 错误持久化 + 筛选              |
| SVG优化            | ✅   | 移除注释/元数据 + 小SVG内联                        |
| 预加载优先级       | ✅   | 字体权重优先 + 最大数量控制                        |
| 网络感知           | ✅   | 自动检测网络质量 + 动态调整策略                    |
| 关键资源识别       | ✅   | 首屏CSS/JS/字体优先加载                            |
| 字体加载优化       | ✅   | font-display注入 + 中文字体子集化                  |
| 错误恢复           | ✅   | CDN重试 + 指数退避 + 熔断机制                      |
| **资源依赖建模**   | ✅   | 依赖检测 + 拓扑排序 + 延迟加载                     |
| **内存监控**       | ✅   | 内存压力感知 + 自动降级 + 缓存清理                 |
| **视口感知懒加载** | ✅   | 设备适配 + 滚动速度感知 + IntersectionObserver     |
| **配置热更新**     | ✅   | 实时生效 + 多标签页同步                            |

---

## 迭代 1: 资源依赖建模

**目标**：识别脚本间的依赖关系，优化加载顺序

### 问题分析

当前问题：

- 不知道脚本A依赖脚本B，可能先加载B导致A失败
- 第三方脚本依赖检测不准确，可能误延迟关键依赖
- 无法根据依赖关系构建加载拓扑图

### 功能设计

**依赖检测规则**

```javascript
// 依赖检测配置
const DEPENDENCY_CONFIG = {
  enabled: true,
  // 常见依赖模式
  patterns: {
    // jQuery 生态
    jquery: [/jquery\.min\.js/i, /jquery-\d/i],
    jqueryPlugins: [/jquery\.\w+\.min\.js/i, /jquery\.ui/i],
    // React 生态
    react: [/react\.production\.min\.js/i, /react\.development/i],
    reactDom: [/react-dom\.production\.min\.js/i],
    reactRouter: [/react-router/i],
    // Vue 生态
    vue: [/vue\.min\.js/i, /vue\.runtime/i],
    vueRouter: [/vue-router/i],
    vuex: [/vuex\.min\.js/i, /pinia/i],
    // 工具库
    lodash: [/lodash\.min\.js/i, /lodash\.core/i],
    moment: [/moment\.min\.js/i, /dayjs/i],
    axios: [/axios\.min\.js/i],
  },
  // 依赖关系定义
  dependencies: {
    jqueryPlugins: ['jquery'],
    reactDom: ['react'],
    reactRouter: ['react', 'reactDom'],
    vueRouter: ['vue'],
    vuex: ['vue'],
  },
  // 强制加载顺序（无法自动检测时使用）
  forceOrder: ['jquery', 'jqueryPlugins', 'react', 'reactDom', 'vue', 'vueRouter', 'vuex'],
}
```

**依赖图构建**

```javascript
// 构建资源依赖图
class DependencyGraph {
  constructor() {
    this.nodes = new Map() // url -> { url, type, deps: Set, loadOrder }
    this.loadOrder = 0
  }

  addNode(url, type) {
    if (!this.nodes.has(url)) {
      this.nodes.set(url, {
        url,
        type,
        deps: new Set(),
        loadOrder: this.loadOrder++,
      })
    }
    return this.nodes.get(url)
  }

  addDependency(fromUrl, toUrl) {
    const from = this.addNode(fromUrl)
    const to = this.addNode(toUrl)
    from.deps.add(toUrl)
  }

  // 检测依赖关系
  detectDependencies(url, scriptType) {
    const config = DEPENDENCY_CONFIG
    const detectedDeps = []

    for (const [key, patterns] of Object.entries(config.patterns)) {
      if (patterns.some((p) => p.test(url))) {
        // 找到匹配的依赖
        const deps = config.dependencies[key] || []
        detectedDeps.push(...deps)
      }
    }

    return detectedDeps
  }

  // 拓扑排序获取加载顺序
  getLoadOrder() {
    const visited = new Set()
    const order = []

    function dfs(url) {
      if (visited.has(url)) return
      visited.add(url)

      const node = this.nodes.get(url)
      if (node) {
        for (const dep of node.deps) {
          dfs(dep)
        }
        order.push(url)
      }
    }

    for (const [url] of this.nodes) {
      dfs(url)
    }

    return order
  }
}
```

**加载顺序优化**

```javascript
// 在 processScript 中集成依赖检测
function processScript(script) {
  const url = script.src

  // 检测依赖
  const deps = dependencyGraph.detectDependencies(url, 'js')
  if (deps.length > 0) {
    // 确保依赖已加载或正在加载
    for (const depUrl of deps) {
      const depScript = findScriptBySrc(depUrl)
      if (depScript && !depScript.dataset._raProcessed) {
        // 依赖未处理，延迟当前脚本
        _deferScriptUntilDeps(script, deps)
        return
      }
    }
  }

  // 继续正常处理
  // ...
}

// 延迟脚本直到依赖加载完成
function _deferScriptUntilDeps(script, deps) {
  const checkInterval = setInterval(() => {
    const allLoaded = deps.every((depUrl) => {
      const depScript = findScriptBySrc(depUrl)
      return depScript && depScript.dataset._raProcessed
    })

    if (allLoaded) {
      clearInterval(checkInterval)
      processScript(script)
    }
  }, 50)

  // 超时保护
  setTimeout(() => {
    clearInterval(checkInterval)
    processScript(script)
  }, 5000)
}
```

### 文件变更

| 文件                                      | 变更                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 DependencyGraph 类、依赖检测、加载顺序优化 |

### 验收标准

- [ ] 自动检测常见框架依赖（jQuery/React/Vue）
- [ ] 构建资源依赖图并拓扑排序
- [ ] 依赖未加载时延迟脚本执行
- [ ] 依赖检测有超时保护
- [ ] 不影响无依赖脚本的加载

### 风险

| 风险     | 影响         | 缓解               |
| -------- | ------------ | ------------------ |
| 依赖误判 | 脚本加载延迟 | 提供用户白名单机制 |
| 循环依赖 | 无限循环检测 | 检测循环并跳出     |
| 性能开销 | 依赖检测耗时 | 缓存检测结果       |

---

## 迭代 2: 内存占用监控

**目标**：监控压缩过程中的内存使用，防止内存溢出

### 问题分析

当前问题：

- 大量图片压缩时内存持续增长
- 无内存阈值告警
- 内存压力大时无法自动降级

### 功能设计

**内存监控配置**

```javascript
const MEMORY_CONFIG = {
  enabled: true,
  // 内存阈值 (MB)
  thresholds: {
    warning: 100, // 警告阈值
    critical: 200, // 危险阈值，停止新压缩
  },
  // 监控间隔 (ms)
  checkInterval: 5000,
  // 压缩缓存最大数量
  maxCacheSize: 100,
  // 内存压力时降级策略
  pressureStrategy: {
    warning: {
      imageMaxConcurrency: 1,
      maxCompressQueueSize: 20,
    },
    critical: {
      imageCompress: false, // 停止压缩
      svgOptimize: false,
    },
  },
}
```

**内存监控实现**

```javascript
class MemoryMonitor {
  constructor(config) {
    this.config = config
    this.currentPressure = 'normal' // normal | warning | critical
    this.checkTimer = null
    this.originalConfig = null
  }

  start() {
    if (!this.config.enabled) return

    this.checkTimer = setInterval(() => {
      this.checkMemory()
    }, this.config.checkInterval)

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => this.stop())
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  async checkMemory() {
    // 使用 performance.memory (Chrome only)
    if (!performance.memory) return

    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024
    const pressure = this.getPressureLevel(usedMB)

    if (pressure !== this.currentPressure) {
      this.currentPressure = pressure
      this.applyPressureStrategy(pressure)

      addLog('warn', 'system', 'memory', {
        reason: `内存压力: ${pressure}`,
        details: {
          usedMB: Math.round(usedMB),
          threshold: this.config.thresholds[pressure] || 'normal',
        },
      })
    }
  }

  getPressureLevel(usedMB) {
    if (usedMB >= this.config.thresholds.critical) return 'critical'
    if (usedMB >= this.config.thresholds.warning) return 'warning'
    return 'normal'
  }

  applyPressureStrategy(pressure) {
    if (!this.originalConfig) {
      this.originalConfig = { ...state.config }
    }

    if (pressure === 'normal') {
      // 恢复原始配置
      Object.assign(state.config, this.originalConfig)
      this.originalConfig = null
      return
    }

    const strategy = this.config.pressureStrategy[pressure]
    if (!strategy) return

    // 应用降级策略
    Object.assign(state.config, strategy)
  }
}
```

**压缩缓存管理**

```javascript
// 增强的压缩缓存管理
function _manageCompressCache() {
  const maxSize = MEMORY_CONFIG.maxCacheSize

  if (state._compressCache.size > maxSize) {
    // 删除最旧的缓存
    const entries = Array.from(state._compressCache.entries())
    const toDelete = entries.slice(0, Math.floor(maxSize * 0.3)) // 删除 30%

    toDelete.forEach(([url, cached]) => {
      // 释放 Blob URL
      if (cached.result && cached.result.startsWith('blob:')) {
        URL.revokeObjectURL(cached.result)
      }
      state._compressCache.delete(url)
    })

    addLog('info', 'system', 'memory', {
      reason: '压缩缓存清理',
      details: { deleted: toDelete.length, remaining: state._compressCache.size },
    })
  }
}
```

### 文件变更

| 文件                                      | 变更                                      |
| ----------------------------------------- | ----------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 MemoryMonitor 类、内存监控、缓存管理 |

### 验收标准

- [ ] 监控 JS 堆内存使用量
- [ ] 内存超过警告阈值时降低并发
- [ ] 内存超过危险阈值时停止压缩
- [ ] 自动清理过期压缩缓存
- [ ] 内存恢复正常时自动恢复策略

### 风险

| 风险                      | 影响                 | 缓解         |
| ------------------------- | -------------------- | ------------ |
| performance.memory 兼容性 | 非Chrome浏览器不可用 | 降级到不监控 |
| 监控本身开销              | 定时器占用资源       | 降低检查频率 |
| 策略切换影响体验          | 功能突然降级         | 平滑过渡策略 |

---

## 迭代 3: 懒加载视口感知

**目标**：根据实际视口位置优化图片懒加载阈值

### 问题分析

当前问题：

- 懒加载阈值固定（200px），不感知实际视口
- 不同设备（桌面/移动）使用相同阈值
- 滚动速度快时图片加载不及时

### 功能设计

**视口感知配置**

```javascript
const LAZYLOAD_CONFIG = {
  enabled: true,
  // 基础阈值 (px)
  baseThreshold: 200,
  // 设备适配
  deviceAdaptive: {
    desktop: { threshold: 200, scrollMultiplier: 1.5 },
    mobile: { threshold: 100, scrollMultiplier: 1.0 },
  },
  // 滚动速度感知
  scrollAware: {
    enabled: true,
    fastScrollThreshold: 1000, // 快速滚动阈值 (px/s)
    fastScrollMultiplier: 2.0, // 快速滚动时增加阈值
  },
  // IntersectionObserver 配置
  observerConfig: {
    rootMargin: '200px 0px', // 提前 200px 开始加载
    threshold: 0,
  },
}
```

**视口感知实现**

```javascript
class ViewportAwareLazyLoad {
  constructor(config) {
    this.config = config
    this.observer = null
    this.scrollSpeed = 0
    this.lastScrollY = 0
    this.lastScrollTime = Date.now()
    this.deviceType = this.detectDevice()
  }

  detectDevice() {
    const width = window.innerWidth
    if (width <= 768) return 'mobile'
    if (width <= 1024) return 'tablet'
    return 'desktop'
  }

  init() {
    // 初始化 IntersectionObserver
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      this.getObserverOptions()
    )

    // 监听滚动事件（用于速度检测）
    if (this.config.scrollAware.enabled) {
      window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true })
    }
  }

  getObserverOptions() {
    const deviceConfig = this.config.deviceAdaptive[this.deviceType]
    const margin = this.calculateDynamicMargin()

    return {
      rootMargin: `${margin}px 0px`,
      threshold: this.config.observerConfig.threshold,
    }
  }

  calculateDynamicMargin() {
    let margin = this.config.baseThreshold

    // 设备适配
    const deviceConfig = this.config.deviceAdaptive[this.deviceType]
    margin = deviceConfig.threshold

    // 滚动速度适配
    if (
      this.config.scrollAware.enabled &&
      this.scrollSpeed > this.config.scrollAware.fastScrollThreshold
    ) {
      margin *= deviceConfig.scrollMultiplier * this.config.scrollAware.fastScrollMultiplier
    }

    return Math.min(margin, 1000) // 最大 1000px
  }

  handleScroll() {
    const now = Date.now()
    const deltaY = Math.abs(window.scrollY - this.lastScrollY)
    const deltaTime = now - this.lastScrollTime

    if (deltaTime > 0) {
      this.scrollSpeed = (deltaY / deltaTime) * 1000 // px/s
    }

    this.lastScrollY = window.scrollY
    this.lastScrollTime = now

    // 更新 Observer 配置
    if (this.observer) {
      this.observer.disconnect()
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        this.getObserverOptions()
      )
      // 重新观察所有图片
      this.reobserveAll()
    }
  }

  handleIntersection(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const img = entry.target
        this.loadImage(img)
        this.observer.unobserve(img)
      }
    }
  }

  loadImage(img) {
    if (img.dataset.src) {
      img.src = img.dataset.src
      img.removeAttribute('data-src')
    }
  }

  observe(img) {
    if (this.observer) {
      this.observer.observe(img)
    }
  }

  reobserveAll() {
    document.querySelectorAll('img[data-src]').forEach((img) => {
      this.observer.observe(img)
    })
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}
```

### 文件变更

| 文件                                      | 变更                                          |
| ----------------------------------------- | --------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 ViewportAwareLazyLoad 类、视口感知懒加载 |

### 验收标准

- [ ] 根据设备类型调整懒加载阈值
- [ ] 快速滚动时增加预加载距离
- [ ] 使用 IntersectionObserver 替代固定阈值
- [ ] 不影响已加载图片的显示
- [ ] 移动端和桌面端表现一致

### 风险

| 风险               | 影响             | 缓解               |
| ------------------ | ---------------- | ------------------ |
| 频繁更新 Observer  | 性能开销         | 防抖处理           |
| 设备检测不准确     | 阈值不合适       | 支持用户手动配置   |
| 快速滚动时内存压力 | 同时加载太多图片 | 限制最大并发加载数 |

---

## 迭代 4: 配置热更新

**目标**：配置修改后无需刷新页面即可生效

### 问题分析

当前问题：

- 配置修改后需刷新页面才能生效
- 无法实时调整压缩策略
- 多标签页配置不同步

### 功能设计

**配置监听**

```javascript
class ConfigManager {
  constructor() {
    this.watchers = new Map()
    this.lastConfig = null
  }

  init() {
    // 监听 storage 变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[CONFIG_KEY]) {
        const newConfig = changes[CONFIG_KEY].newValue
        if (JSON.stringify(newConfig) !== JSON.stringify(this.lastConfig)) {
          this.applyConfig(newConfig)
          this.lastConfig = newConfig
          this.notifyWatchers(newConfig)
        }
      }
    })

    // 初始加载
    this.lastConfig = { ...state.config }
  }

  applyConfig(newConfig) {
    const oldConfig = { ...state.config }
    state.config = { ...DEFAULT_CONFIG, ...newConfig }

    // 处理需要重新初始化的功能
    this.handleConfigChanges(oldConfig, state.config)
  }

  handleConfigChanges(oldConfig, newConfig) {
    // Worker 池配置变化
    if (JSON.stringify(oldConfig.workerPool) !== JSON.stringify(newConfig.workerPool)) {
      _terminateWorkerPool()
      _initWorkerPool()
    }

    // 网络感知配置变化
    if (JSON.stringify(oldConfig.networkAdaptive) !== JSON.stringify(newConfig.networkAdaptive)) {
      _initNetworkListener()
    }

    // 日志配置变化
    if (newConfig.enabled === false && oldConfig.enabled === true) {
      _observer.disconnect()
    } else if (newConfig.enabled === true && oldConfig.enabled === false) {
      _observer.observe(document.documentElement, { childList: true, subtree: true })
    }
  }

  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set())
    }
    this.watchers.get(key).add(callback)
  }

  notifyWatchers(newConfig) {
    for (const [key, callbacks] of this.watchers) {
      if (JSON.stringify(newConfig[key]) !== JSON.stringify(this.lastConfig?.[key])) {
        callbacks.forEach((cb) => cb(newConfig[key]))
      }
    }
  }
}
```

**多标签页同步**

```javascript
// 跨标签页配置同步
function syncConfigAcrossTabs() {
  chrome.runtime?.onMessage?.addListener((message) => {
    if (message.type === 'CONFIG_SYNC') {
      const newConfig = message.config
      if (JSON.stringify(newConfig) !== JSON.stringify(state.config)) {
        state.config = { ...DEFAULT_CONFIG, ...newConfig }
        addLog('info', 'system', 'config-sync', {
          reason: '配置同步',
          details: { source: 'other-tab' },
        })
      }
    }
  })
}

// 配置变更时广播
function broadcastConfigChange(newConfig) {
  chrome.runtime?.sendMessage?.({
    type: 'CONFIG_SYNC',
    config: newConfig,
  })
}
```

### 文件变更

| 文件                                      | 变更                                    |
| ----------------------------------------- | --------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 ConfigManager 类、配置监听、热更新 |
| `background.js`                           | 新增配置同步消息转发                    |

### 验收标准

- [ ] 配置修改后立即生效
- [ ] 无需刷新页面
- [ ] 多标签页配置同步
- [ ] 配置变更日志记录
- [ ] 不影响正在执行的压缩任务

### 风险

| 风险           | 影响             | 缓解         |
| -------------- | ---------------- | ------------ |
| 配置冲突       | 多标签页同时修改 | 最后写入优先 |
| 热更新影响性能 | 频繁重新初始化   | 防抖处理     |
| 状态不一致     | 部分更新失败     | 原子性更新   |

---

## 实施顺序

```
迭代1: 资源依赖 → 迭代2: 内存监控 → 迭代3: 视口感知 → 迭代4: 配置热更新
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4

**理由**：

- 迭代 1（资源依赖）ROI 最高：解决脚本加载顺序问题，提升页面稳定性
- 迭代 2（内存监控）安全优先：防止内存溢出导致页面崩溃
- 迭代 3（视口感知）体验优化：提升懒加载精准度
- 迭代 4（配置热更新）便利性：提升配置管理效率

---

## 风险评估

| 风险         | 影响           | 缓解措施                |
| ------------ | -------------- | ----------------------- |
| 依赖误判     | 脚本加载延迟   | 用户白名单 + 超时保护   |
| 内存监控开销 | 性能下降       | 降低检查频率            |
| 视口计算错误 | 图片加载不及时 | 提供手动配置选项        |
| 配置同步冲突 | 状态不一致     | 最后写入优先 + 日志记录 |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 | 迭代4 |
| ----------------------------------------- | ----- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    | ✅    |
| `background.js`                           | -     | -     | -     | ✅    |

---

## 与 v9 的关系

v9 完成了 Web Worker 压缩、网络感知、关键资源、字体优化、错误恢复。v10 在此基础上：

| v9 基础设施    | v10 扩展           |
| -------------- | ------------------ |
| 独立脚本处理   | 扩展为依赖关系建模 |
| 无内存监控     | 扩展为内存压力感知 |
| 固定懒加载阈值 | 扩展为视口感知阈值 |
| 配置需刷新生效 | 扩展为配置热更新   |

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
