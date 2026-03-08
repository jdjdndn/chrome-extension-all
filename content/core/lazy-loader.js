// ========== 延迟加载模块 ==========
// 按需加载核心模块，减少初始加载时间

(function () {
  'use strict';

  if (window.LazyLoader) {
    console.log('[LazyLoader] 已存在，跳过初始化');
    return;
  }

  /**
   * LazyLoader - 延迟加载器
   * 功能：
   * 1. 按需加载模块
   * 2. 模块依赖管理
   * 3. 加载状态追踪
   */
  const LazyLoader = {
    // 已加载模块
    loaded: new Set(),

    // 正在加载的模块
    loading: new Map(),

    // 模块依赖关系
    dependencies: {
      'site-factory': ['site-base'],
      'plugin-system': [],
      'config-manager': [],
      'selector-merger': [],
      'keyword-manager': [],
      'rule-manager': ['keyword-manager', 'selector-merger']
    },

    // 模块路径映射
    modulePaths: {
      'site-base': 'content/core/site-base.js',
      'site-factory': 'content/core/site-factory.js',
      'plugin-system': 'content/core/plugin-system.js',
      'config-manager': 'content/core/config-manager.js',
      'selector-merger': 'content/core/selector-merger.js',
      'keyword-manager': 'content/core/keyword-manager.js',
      'rule-manager': 'content/core/rule-manager.js',
      'store': 'content/core/store.js',
      'services': 'content/core/services.js',
      'pipeline': 'content/core/pipeline.js'
    },

    // 配置
    config: {
      timeout: 10000,
      retryCount: 2,
      debug: false
    },

    /**
     * 加载模块
     * @param {string|array} modules - 模块名称
     * @param {object} options - 加载选项
     * @returns {Promise<boolean>}
     */
    async load(modules, options = {}) {
      const moduleList = Array.isArray(modules) ? modules : [modules];
      const results = {};

      for (const moduleName of moduleList) {
        results[moduleName] = await this._loadModule(moduleName, options);
      }

      const allSuccess = Object.values(results).every(v => v);

      if (this.config.debug) {
        console.log('[LazyLoader] 加载结果:', results);
      }

      return allSuccess;
    },

    /**
     * 加载单个模块
     */
    async _loadModule(moduleName, options = {}) {
      // 已加载
      if (this.loaded.has(moduleName)) {
        return true;
      }

      // 正在加载
      if (this.loading.has(moduleName)) {
        return this.loading.get(moduleName);
      }

      // 创建加载 Promise
      const loadPromise = this._createLoadPromise(moduleName, options);
      this.loading.set(moduleName, loadPromise);

      try {
        const result = await loadPromise;
        if (result) {
          this.loaded.add(moduleName);
        }
        return result;
      } finally {
        this.loading.delete(moduleName);
      }
    },

    /**
     * 创建加载 Promise
     */
    async _createLoadPromise(moduleName, options) {
      const { timeout = this.config.timeout, retry = this.config.retryCount } = options;

      // 1. 加载依赖
      const deps = this.dependencies[moduleName] || [];
      for (const dep of deps) {
        const depLoaded = await this._loadModule(dep, options);
        if (!depLoaded) {
          console.error(`[LazyLoader] 依赖加载失败: ${dep}`);
          return false;
        }
      }

      // 2. 检查是否已通过 script 标签加载
      if (this._checkModuleReady(moduleName)) {
        this.loaded.add(moduleName);
        return true;
      }

      // 3. 动态加载脚本
      const path = this.modulePaths[moduleName];
      if (!path) {
        console.error(`[LazyLoader] 未知模块: ${moduleName}`);
        return false;
      }

      // 4. 执行加载
      for (let i = 0; i <= retry; i++) {
        try {
          const result = await this._loadScript(path, timeout);
          if (result) {
            // 验证模块是否正确加载
            if (this._checkModuleReady(moduleName)) {
              return true;
            }
          }
        } catch (error) {
          if (i < retry) {
            console.warn(`[LazyLoader] 重试加载: ${moduleName}`);
            await new Promise(r => setTimeout(r, 100));
          } else {
            console.error(`[LazyLoader] 加载失败: ${moduleName}`, error);
            return false;
          }
        }
      }

      return false;
    },

    /**
     * 检查模块是否已就绪
     */
    _checkModuleReady(moduleName) {
      const globalNames = {
        'site-base': 'SiteBase',
        'site-factory': 'SiteFactory',
        'plugin-system': 'PluginSystem',
        'config-manager': 'ConfigManager',
        'selector-merger': 'SelectorMerger',
        'keyword-manager': 'KeywordManager',
        'rule-manager': 'RuleManager',
        'store': 'AppStore',
        'services': 'Services',
        'pipeline': 'Pipeline'
      };

      const globalName = globalNames[moduleName];
      return globalName && typeof window[globalName] !== 'undefined';
    },

    /**
     * 加载脚本文件
     */
    async _loadScript(path, timeout) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`加载超时: ${path}`));
        }, timeout);

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(path);
        script.onload = () => {
          clearTimeout(timer);
          script.remove();
          resolve(true);
        };
        script.onerror = () => {
          clearTimeout(timer);
          reject(new Error(`加载失败: ${path}`));
        };

        (document.head || document.documentElement).appendChild(script);
      });
    },

    /**
     * 预加载模块
     * @param {array} modules - 模块列表
     */
    async preload(modules) {
      console.log(`[LazyLoader] 预加载模块: ${modules.join(', ')}`);
      await this.load(modules);
    },

    /**
     * 检查模块是否已加载
     * @param {string} moduleName - 模块名称
     */
    isLoaded(moduleName) {
      return this.loaded.has(moduleName);
    },

    /**
     * 获取已加载模块列表
     */
    getLoadedModules() {
      return Array.from(this.loaded);
    },

    /**
     * 设置调试模式
     */
    setDebug(enabled) {
      this.config.debug = enabled;
    },

    /**
     * 注册自定义模块
     * @param {string} name - 模块名称
     * @param {object} config - 模块配置
     */
    registerModule(name, config) {
      const { path, dependencies = [], globalName } = config;

      this.modulePaths[name] = path;
      this.dependencies[name] = dependencies;

      if (globalName) {
        // 更新检查函数
        const originalChecker = this._checkModuleReady.bind(this);
        this._checkModuleReady = (moduleName) => {
          if (moduleName === name) {
            return typeof window[globalName] !== 'undefined';
          }
          return originalChecker(moduleName);
        };
      }

      console.log(`[LazyLoader] 注册模块: ${name}`);
    },

    /**
     * 获取加载统计
     */
    getStats() {
      return {
        loaded: this.loaded.size,
        loading: this.loading.size,
        totalModules: Object.keys(this.modulePaths).length
      };
    }
  };

  // 导出
  window.LazyLoader = LazyLoader;

  console.log('[LazyLoader] 延迟加载器已加载');
})();
