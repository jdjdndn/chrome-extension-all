/**
 * 模块入口文件
 * 整合所有模块并导出
 */
(function () {
  'use strict'

  // 检查依赖
  const dependencies = {
    SelectorEngine: 'content/modules/SelectorEngine.js',
    Highlighter: 'content/modules/Highlighter.js',
    VirtualList: 'content/modules/VirtualList.js',
    StorageManager: 'content/modules/StorageManager.js',
    SmartRecommender: 'content/modules/SmartRecommender.js',
    DOMWatcher: 'content/modules/DOMWatcher.js',
    SelectorWorker: 'content/modules/SelectorWorker.js',
    IncrementalUpdater: 'content/modules/IncrementalUpdater.js',
    SelectorPathVisualizer: 'content/modules/SelectorPathVisualizer.js',
    OptimizationAdvisor: 'content/modules/OptimizationAdvisor.js',
    // 资源加速器模块
    CDNMappings: 'shared/cdn-mappings.js',
    ResourceAccelerator: 'content/modules/resource-accelerator.js',
  }

  // 模块加载器
  class ModuleLoader {
    constructor() {
      this.loaded = new Map()
    }

    /**
     * 加载模块
     */
    async load(name) {
      if (this.loaded.has(name)) {
        return this.loaded.get(name)
      }

      if (!window[name]) {
        const path = dependencies[name]
        if (path) {
          await this._loadScript(path)
        }
      }

      this.loaded.set(name, window[name])
      return window[name]
    }

    /**
     * 加载脚本
     */
    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = chrome.runtime.getURL(src)
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    /**
     * 加载所有模块
     */
    async loadAll() {
      const names = Object.keys(dependencies)
      await Promise.all(names.map((name) => this.load(name)))
      return true
    }
  }

  // 模块管理器
  class ModuleManager {
    constructor() {
      this.loader = new ModuleLoader()
      this.modules = {}
      this.initialized = false
    }

    /**
     * 初始化所有模块
     */
    async init() {
      if (this.initialized) {return}

      try {
        await this.loader.loadAll()

        // 实例化模块
        if (window.SelectorEngine) {
          this.modules.selectorEngine = new window.SelectorEngine({
            strategy: 'prefer-class',
            cacheEnabled: true,
          })
        }

        if (window.Highlighter) {
          this.modules.highlighter = new window.Highlighter()
        }

        if (window.StorageManager) {
          this.modules.storage = new window.StorageManager()
        }

        if (window.SmartRecommender) {
          this.modules.recommender = new window.SmartRecommender()
        }

        if (window.DOMWatcher) {
          this.modules.domWatcher = new window.DOMWatcher({
            onElementAdded: (element) => {
              // 处理新元素添加
            },
            onElementRemoved: (element) => {
              // 处理元素移除
            },
            onAttributeChanged: (element, attr, oldVal, newVal) => {
              // 处理属性变化
            },
          })
        }

        if (window.SelectorWorker) {
          this.modules.selectorWorker = new window.SelectorWorker()
        }

        if (window.IncrementalUpdater) {
          this.modules.incrementalUpdater = new window.IncrementalUpdater({
            batchSize: 10,
            frameDelay: 1,
            onUpdate: (batch) => {
              // 批量更新完成
            },
            onComplete: (stats) => {
              // 所有更新完成
            },
          })
        }

        if (window.SelectorPathVisualizer) {
          this.modules.pathVisualizer = new window.SelectorPathVisualizer()
        }

        if (window.OptimizationAdvisor) {
          this.modules.optimizationAdvisor = new window.OptimizationAdvisor({
            checkPerformance: true,
            checkStability: true,
            checkBestPractices: true,
            checkAccessibility: true,
            maxSuggestions: 5,
          })
        }

        this.initialized = true
        return true
      } catch (error) {
        console.error('[ModuleManager] 初始化失败:', error)
        return false
      }
    }

    /**
     * 获取模块
     */
    get(name) {
      return this.modules[name]
    }

    /**
     * 销毁所有模块
     */
    destroy() {
      Object.values(this.modules).forEach((module) => {
        if (module && typeof module.destroy === 'function') {
          module.destroy()
        }
      })
      this.modules = {}
      this.initialized = false
    }
  }

  // 创建全局实例
  window.moduleManager = new ModuleManager()

  // 导出
  window.ModuleManager = ModuleManager
})()
