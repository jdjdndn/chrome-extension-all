/**
 * JS 资源优化器
 *
 * 功能：
 * 1. defer/async 智能策略优化
 * 2. 动态 import 代码分割支持
 * 3. 脚本执行顺序和优先级管理
 * 4. 脚本压缩和缓存策略
 * 5. 第三方脚本加载优化
 */

const LOG_PREFIX = '[JS-Optimizer]'

// ========== 类型定义
/**
 * @typedef {'critical'|'high'|'medium'|'low'} ScriptPriority
 * 脚本优先级：critical 阻塞渲染，high 首屏必需，medium 交互相关，low 非关键
 */

/**
 * @typedef {'auto'|'defer'|'async'|'module'|'lazy'} LoadStrategy
 * 加载策略：auto 自动检测，defer 延迟到DOM解析后，async 异步加载，module ES模块，lazy 空闲时加载
 */

/**
 * @typedef {Object} ScriptMetadata
 * @property {string} url
 * @property {ScriptPriority} priority
 * @property {LoadStrategy} strategy
 * @property {boolean} isThirdParty
 * @property {boolean} isAnalytics
 * @property {boolean} isCritical
 * @property {Set<string>} dependencies
 * @property {number} size
 */

// ========== 状态管理
const state = {
  // 脚本元数据缓存
  metadataCache: new Map(),

  // 已处理的脚本 URL
  processedUrls: new Set(),

  // 脚本加载队列
  loadQueue: [],

  // 动态 import 缓存
  importCache: new Map(),

  // 优先级阈值
  priorityThresholds: {
    critical: { head: true, size: 50 * 1024 }, // 50KB
    high: { firstPaint: true },
    medium: { interaction: true },
    low: { idle: true },
  },

  // 第三方脚本分类规则
  thirdPartyPatterns: {
    analytics: [
      /google-analytics\.com/,
      /googletagmanager\.com/,
      /baidu\.com\/hm\.js/,
      /cnzz\.com/,
      /umeng\.com/,
    ],
    ads: [/doubleclick\.net/, /googleadservices\.com/, /adroll\.com/],
    social: [/facebook\.net/, /twitter\.com/, /linkedin\.com/],
    widget: [/widget/, /embed/, /player/],
  },

  // 核心库白名单（不做延迟处理）
  criticalLibraries: [
    /react/,
    /vue/,
    /angular/,
    /jquery/,
    /lodash/,
    /core-js/,
    /regenerator-runtime/,
  ],

  // 性能统计
  stats: {
    optimized: 0,
    deferred: 0,
    codeSplit: 0,
    cacheHit: 0,
  },
}

// ========== 工具函数

/**
 * 判断是否为第三方脚本
 */
function isThirdPartyScript(url) {
  try {
    const scriptOrigin = new URL(url, window.location.href).origin
    return scriptOrigin !== window.location.origin
  } catch {
    return true
  }
}

/**
 * 判断是否为分析脚本
 */
function isAnalyticsScript(url) {
  return state.thirdPartyPatterns.analytics.some((p) => p.test(url))
}

/**
 * 判断是否为广告脚本
 */
function isAdScript(url) {
  return state.thirdPartyPatterns.ads.some((p) => p.test(url))
}

/**
 * 判断是否为核心库
 */
function isCriticalLibrary(url) {
  return state.criticalLibraries.some((p) => p.test(url))
}

/**
 * 分析脚本元数据
 */
function analyzeScriptMetadata(script, url) {
  const cached = state.metadataCache.get(url)
  if (cached) {
    return cached
  }

  const isThirdParty = isThirdPartyScript(url)
  const isAnalytics = isAnalyticsScript(url)
  const isAd = isAdScript(url)
  const isCriticalLib = isCriticalLibrary(url)

  // 确定优先级
  let priority = 'medium'
  let strategy = 'auto'

  if (isCriticalLib || !isThirdParty) {
    // 第一方核心库：critical
    const inHead = script.closest('head') !== null
    priority = inHead ? 'critical' : 'high'
    strategy = inHead ? 'defer' : 'async'
  } else if (isAnalytics || isAd) {
    // 分析/广告脚本：最低优先级
    priority = 'low'
    strategy = 'lazy'
  } else if (isThirdParty) {
    // 其他第三方脚本：中低优先级
    priority = 'low'
    strategy = 'async'
  }

  // 保留原始属性
  const hasAsync = script.hasAttribute('async')
  const hasDefer = script.hasAttribute('defer')
  const hasModule = script.type === 'module'

  // 如果已有明确的加载属性，尊重原有策略
  if (hasModule) {
    strategy = 'module'
  } else if (hasAsync) {
    strategy = 'async'
  } else if (hasDefer) {
    strategy = 'defer'
  }

  const metadata = {
    url,
    priority,
    strategy,
    isThirdParty,
    isAnalytics,
    isAd,
    isCritical: isCriticalLib,
    hasAsync,
    hasDefer,
    hasModule,
    dependencies: new Set(),
    size: 0,
    analyzedAt: Date.now(),
  }

  state.metadataCache.set(url, metadata)
  return metadata
}

// ========== 加载策略优化

/**
 * 优化脚本加载策略
 */
function optimizeLoadStrategy(script, metadata) {
  // 如果已经优化过
  if (script.dataset._jsOptimized) {
    return
  }

  script.dataset._jsOptimized = '1'

  const { strategy, priority } = metadata

  // 移除可能冲突的属性
  script.removeAttribute('async')
  script.removeAttribute('defer')

  switch (strategy) {
    case 'defer':
      script.defer = true
      script.fetchPriority = priority === 'critical' ? 'high' : 'auto'
      break

    case 'async':
      script.async = true
      script.fetchPriority = priority === 'high' ? 'high' : 'low'
      break

    case 'module':
      script.type = 'module'
      break

    case 'lazy':
      // 延迟到空闲时加载
      deferToIdle(script)
      break

    case 'auto':
    default:
      // 智能决策
      applyAutoStrategy(script, metadata)
      break
  }

  state.stats.optimized++
  console.log(
    `${LOG_PREFIX} 优化策略: ${metadata.url.substring(0, 50)}... priority=${priority}, strategy=${strategy}`
  )
}

/**
 * 自动策略应用
 */
function applyAutoStrategy(script, metadata) {
  const { isThirdParty, isAnalytics, priority } = metadata

  if (isAnalytics) {
    deferToIdle(script)
    return
  }

  if (isThirdParty) {
    // 第三方脚本默认 async + low priority
    script.async = true
    script.fetchPriority = 'low'
    return
  }

  // 第一方脚本
  if (priority === 'critical') {
    script.defer = true
    script.fetchPriority = 'high'
  } else {
    script.async = true
  }
}

/**
 * 延迟到空闲时加载
 */
function deferToIdle(script) {
  const src = script.src
  script.removeAttribute('src')
  script.dataset._deferredSrc = src
  script.dataset._deferralTime = Date.now().toString()

  const loadFn = () => {
    // 检查元素是否仍在 DOM 中
    if (!script.isConnected) {
      return
    }
    if (script.dataset._loaded) {
      return
    }
    script.src = src
    script.dataset._loaded = 'true'
    state.stats.deferred++
  }

  // 最大延迟 5 秒
  const forceLoadTimer = setTimeout(loadFn, 5000)

  script.onload = () => {
    clearTimeout(forceLoadTimer)
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadFn, { timeout: 3000 })
  } else {
    // 页面加载完成后延迟 1 秒
    if (document.readyState === 'complete') {
      setTimeout(loadFn, 1000)
    } else {
      window.addEventListener('load', () => setTimeout(loadFn, 1000), { once: true })
    }
  }
}

// ========== 动态 import 代码分割

/**
 * 判断是否适合动态 import
 */
function canUseDynamicImport(script) {
  // 不是 module 类型
  if (script.type && script.type !== 'module') {
    return false
  }

  const src = script.src
  if (!src) {
    return false
  }

  // 非第三方脚本才考虑
  if (isThirdPartyScript(src)) {
    return false
  }

  // 检查是否有 nomodule（兼容标记）
  if (script.hasAttribute('nomodule')) {
    return false
  }

  return true
}

/**
 * 转换为动态 import
 */
function convertToDynamicImport(script) {
  if (!canUseDynamicImport(script)) {
    return false
  }

  const src = script.src
  if (!src || state.importCache.has(src)) {
    return false
  }

  // 只有非关键路径
  const metadata = analyzeScriptMetadata(script, src)
  if (metadata.priority === 'critical' || metadata.priority === 'high') {
    return false
  }

  // 移除原脚本
  script.remove()

  // 创建动态 import 包装
  const importScript = document.createElement('script')
  importScript.type = 'module'
  // 转义 URL 以防止 XSS
  const escapedSrc = src.replace(/'/g, "\\'").replace(/`/g, '\\`').replace(/\$/g, '\\$')
  importScript.textContent = `
    // Dynamic import injected by Resource Accelerator
    (function() {
      const loadModule = function() {
        import('${escapedSrc}')
          .then(m => { console.log('[JS-Optimizer] Loaded:', '${escapedSrc.substring(0, 50)}'); })
          .catch(e => { console.error('[JS-Optimizer] Failed:', e); });
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadModule, { timeout: 5000 });
      } else {
        setTimeout(loadModule, 1000);
      }
    })();
  `

  document.head.appendChild(importScript)

  state.importCache.set(src, true)
  state.stats.codeSplit++

  console.log(`${LOG_PREFIX} 动态 import: ${src.substring(0, 50)}...`)
  return true
}

// ========== 脚本执行顺序管理

/**
 * 脚本依赖管理
 */
class ScriptDependencyManager {
  constructor() {
    this.dependencyGraph = new Map()
    this.loadedScripts = new Set()
    this.waitingScripts = new Map()
  }

  /**
   * 添加依赖关系
   */
  addDependency(scriptUrl, dependencyUrl) {
    if (!this.dependencyGraph.has(scriptUrl)) {
      this.dependencyGraph.set(scriptUrl, new Set())
    }
    this.dependencyGraph.get(scriptUrl).add(dependencyUrl)
  }

  /**
   * 检查依赖是否满足
   */
  checkDependencies(scriptUrl) {
    const dependencies = this.dependencyGraph.get(scriptUrl)
    if (!dependencies) {
      return true
    }
    return Array.from(dependencies).every((dep) => this.loadedScripts.has(dep))
  }

  /**
   * 标记脚本已加载
   */
  markLoaded(scriptUrl) {
    this.loadedScripts.add(scriptUrl)

    // 检查等待的脚本
    for (const [url, script] of this.waitingScripts.entries()) {
      if (this.checkDependencies(url)) {
        this.waitingScripts.delete(url)
        this.loadScript(script)
      }
    }
  }

  /**
   * 加载脚本（依赖满足时）
   */
  loadScript(script) {
    const src = script.dataset._deferredSrc
    if (src) {
      script.src = src
    }
  }
}

const dependencyManager = new ScriptDependencyManager()

// ========== 预加载优化

/**
 * 预加载关键脚本
 */
function preloadCriticalScript(url) {
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) {
    return
  }

  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'script'
  link.href = url
  link.fetchPriority = 'high'

  document.head.appendChild(link)
}

// ========== 缓存策略

/**
 * 缓存已优化的脚本
 */
const optimizedScriptCache = {
  cache: new Map(),
  maxSize: 100,

  get(url) {
    const item = this.cache.get(url)
    if (item) {
      state.stats.cacheHit++
      return item
    }
    return null
  },

  set(url, metadata) {
    if (this.cache.size >= this.maxSize) {
      // LRU: 删除最旧的
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    this.cache.set(url, { ...metadata, cachedAt: Date.now() })
  },
}

// ========== 主处理函数

/**
 * 优化脚本
 */
function optimizeScript(script) {
  const url = script.src
  if (!url || state.processedUrls.has(url)) {
    return
  }

  state.processedUrls.add(url)

  // 分析元数据
  const metadata = analyzeScriptMetadata(script, url)

  // 缓存元数据
  optimizedScriptCache.set(url, metadata)

  // 优化加载策略
  optimizeLoadStrategy(script, metadata)

  // 尝试动态 import（仅对合适的脚本）
  if (metadata.priority === 'low' || metadata.priority === 'medium') {
    convertToDynamicImport(script)
  }

  // 关键脚本预加载
  if (metadata.priority === 'critical') {
    preloadCriticalScript(url)
  }

  return metadata
}

/**
 * 批量优化脚本
 */
function batchOptimizeScripts(scripts) {
  const results = []

  for (const script of scripts) {
    const result = optimizeScript(script)
    if (result) {
      results.push(result)
    }
  }

  return results
}

/**
 * 获取统计信息
 */
function getStats() {
  return {
    ...state.stats,
    metadataCacheSize: state.metadataCache.size,
    processedCount: state.processedUrls.size,
    importCacheSize: state.importCache.size,
  }
}

/**
 * 重置状态（用于测试）
 */
function reset() {
  state.metadataCache.clear()
  state.processedUrls.clear()
  state.importCache.clear()
  state.stats = {
    optimized: 0,
    deferred: 0,
    codeSplit: 0,
    cacheHit: 0,
  }
}

// ========== 导出

window.JSOptimizer = {
  optimizeScript,
  batchOptimizeScripts,
  analyzeScriptMetadata,
  getStats,
  reset,
  isThirdPartyScript,
  isAnalyticsScript,
}

export {
  optimizeScript,
  batchOptimizeScripts,
  analyzeScriptMetadata,
  getStats,
  reset,
  isThirdPartyScript,
  isAnalyticsScript,
}
