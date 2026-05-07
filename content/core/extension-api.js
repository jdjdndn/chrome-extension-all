// ========== 扩展 API 模块 ==========
// 提供更丰富的扩展点供第三方使用

;(function () {
  'use strict'

  if (window.ExtensionAPI) {
    console.log('[ExtensionAPI] 已存在，跳过初始化')
    return
  }

  /**
   * ExtensionAPI - 扩展 API
   * 功能：
   * 1. 扩展注册
   * 2. 扩展间通信
   * 3. 共享资源
   */
  const ExtensionAPI = {
    // 注册的扩展
    extensions: new Map(),

    // 事件监听器
    listeners: new Map(),

    // API 版本
    version: '1.0.0',

    /**
     * 注册扩展
     * @param {object} extension - 扩展定义
     * @returns {object} - 扩展实例
     */
    register(extension) {
      if (!extension || !extension.id || !extension.name) {
        console.error('[ExtensionAPI] 无效的扩展定义')
        return null
      }

      if (this.extensions.has(extension.id)) {
        console.warn(`[ExtensionAPI] 扩展已存在: ${extension.id}`)
        return null
      }

      const instance = {
        ...extension,
        state: {
          initialized: false,
          enabled: true,
        },
        hooks: {},
        storage: {},
      }

      this.extensions.set(extension.id, instance)
      console.log(`[ExtensionAPI] 注册扩展: ${extension.name} (${extension.id})`)

      return this._createExtensionInterface(instance)
    },

    /**
     * 创建扩展接口
     */
    _createExtensionInterface(extension) {
      const self = this

      return {
        // 获取扩展信息
        getInfo() {
          return {
            id: extension.id,
            name: extension.name,
            version: extension.version,
            author: extension.author,
            description: extension.description,
            state: extension.state,
          }
        },

        // 初始化扩展
        async init(options = {}) {
          if (extension.state.initialized) {
            return true
          }

          try {
            if (extension.init) {
              await extension.init.call(extension, options)
            }
            extension.state.initialized = true
            console.log(`[ExtensionAPI] 扩展初始化完成: ${extension.name}`)
            return true
          } catch (error) {
            console.error(`[ExtensionAPI] 扩展初始化失败: ${extension.name}`, error)
            return false
          }
        },

        // 销毁扩展
        async destroy() {
          try {
            if (extension.destroy) {
              await extension.destroy.call(extension)
            }
            self.extensions.delete(extension.id)
            console.log(`[ExtensionAPI] 扩展已销毁: ${extension.name}`)
            return true
          } catch (error) {
            console.error(`[ExtensionAPI] 扩展销毁失败: ${extension.name}`, error)
            return false
          }
        },

        // 获取存储
        getStorage() {
          return extension.storage
        },

        // 设置存储
        setStorage(data) {
          extension.storage = { ...extension.storage, ...data }
        },

        // 发送消息到其他扩展
        async emit(event, data) {
          return await self._dispatchEvent(extension.id, event, data)
        },

        // 监听其他扩展的消息
        on(event, handler) {
          if (!extension.hooks[event]) {
            extension.hooks[event] = []
          }
          extension.hooks[event].push(handler)
        },

        // 移除监听
        off(event, handler) {
          if (extension.hooks[event]) {
            const index = extension.hooks[event].indexOf(handler)
            if (index > -1) {
              extension.hooks[event].splice(index, 1)
            }
          }
        },
      }
    },

    /**
     * 分发事件
     */
    async _dispatchEvent(fromId, event, data) {
      const results = []

      for (const [extId, extension] of this.extensions) {
        if (extId === fromId) continue

        const handlers = extension.hooks[event]
        if (!handlers || handlers.length === 0) continue

        for (const handler of handlers) {
          try {
            const result = await handler(data)
            results.push({ extensionId: extId, result })
          } catch (error) {
            console.error(`[ExtensionAPI] 事件处理错误: ${extId}`, error)
          }
        }
      }

      return results
    },

    /**
     * 获取扩展
     * @param {string} extensionId - 扩展ID
     */
    getExtension(extensionId) {
      return this.extensions.get(extensionId) || null
    },

    /**
     * 获取所有扩展
     */
    getAllExtensions() {
      return Array.from(this.extensions.entries()).map(([id, ext]) => ({
        id,
        name: ext.name,
        version: ext.version,
        state: ext.state,
      }))
    },

    /**
     * 获取扩展数量
     */
    getExtensionCount() {
      return this.extensions.size
    },

    /**
     * 获取 API 版本
     */
    getVersion() {
      return this.version
    },

    /**
     * 提供共享服务
     */
    services: {
      /**
       * 获取服务
       */
      get(name) {
        const services = {
          store: window.AppStore,
          eventBus: window.EventBus,
          pipeline: window.Pipeline,
          config: window.ConfigManager,
          rules: window.RuleManager,
          keywords: window.KeywordManager,
          selectors: window.SelectorMerger,
          debug: window.DebugPanel,
        }

        return services[name] || null
      },

      /**
       * 检查服务是否可用
       */
      isAvailable(name) {
        const service = this.get(name)
        return service !== null && service !== undefined
      },
    },

    /**
     * 提供共享工具
     */
    utils: {
      // 生成唯一 ID
      generateId() {
        return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },

      // 深度合并
      deepMerge(target, source) {
        const output = Object.assign({}, target)
        for (const key of Object.keys(source)) {
          if (source[key] instanceof Object && key in target) {
            output[key] = this.deepMerge(target[key], source[key])
          } else {
            output[key] = source[key]
          }
        }
        return output
      },

      // 深度克隆
      deepClone(obj) {
        return JSON.parse(JSON.stringify(obj))
      },
    },
  }

  // 导出
  window.ExtensionAPI = ExtensionAPI

  console.log('[ExtensionAPI] 扩展 API 已加载')
})()
