// ========== 配置版本迁移模块 ==========
// 自动迁移旧版本配置到新版本

(function () {
  'use strict'

  if (window.ConfigMigrator) {
    console.log('[ConfigMigrator] 已存在，跳过初始化')
    return
  }

  /**
   * ConfigMigrator - 配置版本迁移器
   * 功能：
   * 1. 版本检测
   * 2. 自动迁移
   * 3. 迁移脚本注册
   */
  const ConfigMigrator = {
    // 迁移脚本
    migrations: [],

    // 当前配置版本
    currentVersion: '1.0.0',

    /**
     * 初始化
     */
    async init() {
      // 注册内置迁移
      this._registerBuiltinMigrations()

      console.log(`[ConfigMigrator] 初始化完成，当前版本: ${this.currentVersion}`)
    },

    /**
     * 注册内置迁移
     */
    _registerBuiltinMigrations() {
      // 0.9.0 -> 1.0.0
      this.register({
        version: '1.0.0',
        description: '初始化配置结构',

        up: (config) => {
          // 确保基础结构存在
          const newConfig = {
            version: '1.0.0',
            settings: config.settings || { enabled: true, debugMode: false },
            hideElements: config.hideElements || { enabled: false, selectors: [] },
            domains: config.domains || { blocked: [], allowed: [] },
            keywords: config.keywords || { notInterested: [], groups: {} },
            localServer: config.localServer || {
              enabled: true,
              url: 'http://localhost:3000',
              timeout: 5000,
            },
            ui: config.ui || { theme: 'light', language: 'zh-CN', notifications: true },
          }

          return newConfig
        },

        validate: (config) => {
          return config && typeof config === 'object'
        },
      })
    },

    /**
     * 注册迁移脚本
     * @param {object} migration - 迁移配置
     */
    register(migration) {
      if (!migration.version || !migration.up) {
        console.error('[ConfigMigrator] 无效迁移配置')
        return false
      }

      this.migrations.push(migration)
      this._sortMigrations()

      console.log(`[ConfigMigrator] 注册迁移: v${migration.version}`)
      return true
    },

    /**
     * 排序迁移脚本（按版本升序）
     */
    _sortMigrations() {
      this.migrations.sort((a, b) => {
        return this._compareVersions(a.version, b.version)
      })
    },

    /**
     * 比较版本号
     * @param {string} a - 版本 A
     * @param {string} b - 版本 B
     * @returns {number} - 1, 0, 1
     */
    _compareVersions(a, b) {
      const aParts = a.split('.').map(Number)
      const bParts = b.split('.').map(Number)

      for (let i = 0; i < 3; i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (aVal > bVal) {return 1}
        if (aVal < bVal) {return -1}
      }
      return 0
    },

    /**
     * 迁移配置
     * @param {object} config - 待迁移的配置
     * @returns {object} - 迁移后的配置
     */
    async migrate(config) {
      if (!config || typeof config !== 'object') {
        console.warn('[ConfigMigrator] 无效的配置')
        return null
      }

      // 获取配置版本
      const fromVersion = config.version || '0.0.0'
      const toVersion = this.currentVersion

      // 已经是最新版本
      if (this._compareVersions(fromVersion, toVersion) === 0) {
        console.log('[ConfigMigrator] 配置已是最新版本')
        return config
      }

      console.log(`[ConfigMigrator] 开始迁移: ${fromVersion} -> ${toVersion}`)

      let currentConfig = { ...config }
      const appliedMigrations = []

      // 应用所有需要的迁移
      for (const migration of this.migrations) {
        // 检查是否需要应用此迁移
        if (
          this._compareVersions(fromVersion, migration.version) < 0 &&
          this._compareVersions(migration.version, toVersion) <= 0
        ) {
          // 验证
          if (migration.validate && !migration.validate(currentConfig)) {
            console.warn(`[ConfigMigrator] 迁移 ${migration.version} 验证失败，跳过`)
            continue
          }

          try {
            // 应用迁移
            currentConfig = migration.up(currentConfig)
            currentConfig.version = migration.version
            appliedMigrations.push(migration.version)

            console.log(`[ConfigMigrator] 应用迁移: ${migration.version}`)
          } catch (error) {
            console.error(`[ConfigMigrator] 迁移 ${migration.version} 失败:`, error)
            // 回滚
            return { ...config, migrationError: error.message }
          }
        }
      }

      // 设置最终版本
      currentConfig.version = toVersion

      console.log(`[ConfigMigrator] 迁移完成，应用了 ${appliedMigrations.length} 个迁移`)

      return {
        config: currentConfig,
        appliedMigrations,
        fromVersion,
        toVersion,
      }
    },

    /**
     * 验证迁移后的配置
     * @param {object} config - 配置
     */
    validate(config) {
      const errors = []

      // 检查必需字段
      const requiredFields = ['version']
      for (const field of requiredFields) {
        if (!config[field]) {
          errors.push(`缺少必需字段: ${field}`)
        }
      }

      // 检查配置结构
      if (config.settings && typeof config.settings !== 'object') {
        errors.push('settings 必须是对象')
      }

      if (config.hideElements && typeof config.hideElements !== 'object') {
        errors.push('hideElements 必须是对象')
      }

      if (config.domains && !Array.isArray(config.domains.blocked)) {
        errors.push('domains.blocked 必须是数组')
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    },

    /**
     * 获取迁移历史
     * @param {object} config - 配置
     */
    getMigrationHistory(config) {
      const version = config.version || '0.0.0'
      const history = []

      for (const migration of this.migrations) {
        if (
          this._compareVersions('0.0.0', migration.version) <= 0 &&
          this._compareVersions(migration.version, version) <= 0
        ) {
          history.push({
            version: migration.version,
            description: migration.description,
          })
        }
      }

      return history
    },
  }

  // 导出
  window.ConfigMigrator = ConfigMigrator

  console.log('[ConfigMigrator] 配置迁移模块已加载')
})()
