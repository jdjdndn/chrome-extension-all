/**
 * 插件基类
 * 所有资源处理插件都需要继承此类
 */

export class Plugin {
  constructor(core, options = {}) {
    this.core = core
    this.options = options
    this.name = this.constructor.name
    this.enabled = true
  }

  /**
   * 插件元数据（子类必须覆盖）
   */
  static get meta() {
    return {
      name: 'Plugin',
      version: '1.0.0',
      description: 'Base plugin class',
      author: 'ResourceAccelerator',
      dependencies: []
    }
  }

  /**
   * 插件默认配置（子类可覆盖）
   */
  static get defaultConfig() {
    return {}
  }

  /**
   * 初始化插件（子类必须实现）
   */
  async init() {
    throw new Error('Plugin.init() must be implemented by subclass')
  }

  /**
   * 销毁插件（子类可选实现）
   */
  async destroy() {
    // 默认实现：清理资源
    this.enabled = false
  }

  /**
   * 启用插件
   */
  enable() {
    this.enabled = true
    this.core?.emit('plugin:enabled', { name: this.name })
  }

  /**
   * 禁用插件
   */
  disable() {
    this.enabled = false
    this.core?.emit('plugin:disabled', { name: this.name })
  }

  /**
   * 处理资源（子类可覆盖）
   * @param {Element} element - DOM元素
   * @param {Object} resourceInfo - 资源信息
   * @returns {Promise<any>} 处理结果
   */
  async handle(element, resourceInfo) {
    if (!this.enabled) return null
    // 子类实现具体逻辑
    return null
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  emit(event, data) {
    this.core?.emit(event, data)
  }

  /**
   * 监听事件
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消监听函数
   */
  on(event, handler) {
    return this.core?.on(event, handler)
  }

  /**
   * 获取其他插件
   * @param {string} name - 插件名称
   * @returns {Object|null} 插件实例
   */
  getPlugin(name) {
    return this.core?.getPlugin(name)
  }

  /**
   * 创建缓存
   * @param {string} name - 缓存名称
   * @param {Object} options - 缓存配置
   * @returns {Object} 缓存接口
   */
  createCache(name, options = {}) {
    return this.core?.createCache(`${this.name}:${name}`, options)
  }

  /**
   * 获取缓存
   * @param {string} name - 缓存名称
   * @returns {Object|null} 缓存接口
   */
  getCache(name) {
    return this.core?.getCache(`${this.name}:${name}`)
  }

  /**
   * 日志记录
   * @param {string} level - 日志级别
   * @param {string} action - 操作
   * @param {Object} details - 详情
   */
  log(level, action, details = {}) {
    console.log(`[${this.name}] [${level}] ${action}`, details)
  }
}
