// ========== 安全管理模块 ==========
// 加密存储敏感数据（如 Token）

;(function () {
  'use strict'

  if (window.SecurityManager) {
    console.log('[SecurityManager] 已存在，跳过初始化')
    return
  }

  /**
   * SecurityManager - 安全管理器
   * 功能：
   * 1. 数据加密
   * 2. Token 管理
   * 3. 安全审计
   */
  const SecurityManager = {
    // 加密配置
    config: {
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12,
      saltLength: 16,
      iterations: 100000,
    },

    // 加密密钥（运行时生成）
    _encryptionKey: null,

    // 安全审计日志
    auditLog: [],

    /**
     * 初始化
     * @param {object} options - 选项
     */
    async init(options = {}) {
      this.config = { ...this.config, ...options }

      // 生成或加载加密密钥
      this._encryptionKey = await this._getOrGenerateKey()

      console.log('[SecurityManager] 初始化完成')
    },

    /**
     * 获取或生成加密密钥
     */
    async _getOrGenerateKey() {
      const keyName = 'encryption_key'

      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(keyName, resolve)
          })

          if (result?.[keyName]) {
            return result[keyName]
          }

          // 生成新密钥
          const key = this._generateKey()
          await new Promise((resolve) => {
            chrome.storage.local.set({ [keyName]: key }, resolve)
          })
          return key
        }
      } catch (error) {
        console.error('[SecurityManager] 获取密钥失败:', error)
      }

      // 回退：使用固定密钥（不推荐，但确保功能可用）
      return 'fallback-key-do-not-use-in-production'
    },

    /**
     * 生成加密密钥
     */
    _generateKey() {
      const array = new Uint8Array(this.config.keyLength / 8)
      crypto.getRandom(array)
      return Array.from(array)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    },

    /**
     * 加密数据
     * @param {string} data - 待加密数据
     * @returns {object} - 加密后的数据
     */
    async encrypt(data) {
      if (!this._encryptionKey) {
        console.warn('[SecurityManager] 加密密钥未初始化')
        return null
      }

      try {
        const encoder = new TextEncoder()
        const dataBytes = encoder.encode(JSON.stringify(data))

        // 生成 IV 和盐
        const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength))
        const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength))

        // 从密钥派生子密钥
        const keyMaterial = await crypto.subtle.importKey(
          new TextEncoder().encode(this._encryptionKey),
          { name: 'PBKDF2' },
          'raw',
          false,
          ['deriveBits']
        )

        const key = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt,
            iterations: this.config.iterations,
            hash: 'SHA-256',
          },
          keyMaterial,
          this.config.keyLength
        )

        // 导入加密密钥
        const cryptoKey = await crypto.subtle.importKey(key, { name: 'AES-GCM' }, 'raw', false, [
          'encrypt',
          'decrypt',
        ])

        // 加密
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, dataBytes)

        // 返回加密数据
        return {
          iv: Array.from(iv)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
          salt: Array.from(salt)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
          data: Array.from(new Uint8Array(encrypted))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        }
      } catch (error) {
        console.error('[SecurityManager] 加密失败:', error)
        this._logAudit('ENCRYPTION_FAILED', { error: error.message })
        return null
      }
    },

    /**
     * 解密数据
     * @param {object} encryptedData - 加密数据
     * @returns {any} - 解密后的数据
     */
    async decrypt(encryptedData) {
      if (!this._encryptionKey) {
        console.warn('[SecurityManager] 加密密钥未初始化')
        return null
      }

      try {
        const { iv, salt, data } = encryptedData

        // 解析 IV、盐和数据
        const ivBytes = new Uint8Array(iv.match(/.{2}/g).map((b) => parseInt(b, 16)))
        const saltBytes = new Uint8Array(salt.match(/.{2}/g).map((b) => parseInt(b, 16)))
        const dataBytes = new Uint8Array(data.match(/.{2}/g).map((b) => parseInt(b, 16)))

        // 从密钥派生子密钥
        const keyMaterial = await crypto.subtle.importKey(
          new TextEncoder().encode(this._encryptionKey),
          { name: 'PBKDF2' },
          'raw',
          false,
          ['deriveBits']
        )

        const key = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: this.config.iterations,
            hash: 'SHA-256',
          },
          keyMaterial,
          this.config.keyLength
        )

        // 导入解密密钥
        const cryptoKey = await crypto.subtle.importKey(key, { name: 'AES-GCM' }, 'raw', false, [
          'encrypt',
          'decrypt',
        ])

        // 解密
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivBytes },
          cryptoKey,
          dataBytes
        )

        // 解析数据
        const text = new TextDecoder().decode(decrypted)
        return JSON.parse(text)
      } catch (error) {
        console.error('[SecurityManager] 解密失败:', error)
        this._logAudit('DECRYPTION_FAILED', { error: error.message })
        return null
      }
    },

    /**
     * 安全存储敏感数据
     * @param {string} key - 存储键
     * @param {any} value - 值
     */
    async storeSecure(key, value) {
      const encrypted = await this.encrypt(value)
      if (!encrypted) {
        return false
      }

      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setLocal({ [key]: encrypted })
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          await new Promise((resolve) => {
            chrome.storage.local.set({ [key]: encrypted }, resolve)
          })
        }

        this._logAudit('SECURE_STORE', { key })
        return true
      } catch (error) {
        console.error('[SecurityManager] 安全存储失败:', error)
        return false
      }
    },

    /**
     * 获取敏感数据
     * @param {string} key - 存储键
     */
    async getSecure(key) {
      try {
        let encrypted
        if (typeof StorageUtils !== 'undefined') {
          const result = await StorageUtils.getLocal(key)
          encrypted = result?.[key]
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          encrypted = await new Promise((resolve) => {
            chrome.storage.local.get(key, resolve)
          })
          encrypted = encrypted?.[key]
        }

        if (!encrypted) {
          return null
        }

        const decrypted = await this.decrypt(encrypted)
        this._logAudit('SECURE_RETRIEVE', { key, success: !!decrypted })
        return decrypted
      } catch (error) {
        console.error('[SecurityManager] 获取敏感数据失败:', error)
        return null
      }
    },

    /**
     * 删除敏感数据
     * @param {string} key - 存储键
     */
    async deleteSecure(key) {
      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.remove(key)
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          await new Promise((resolve) => {
            chrome.storage.local.remove(key, resolve)
          })
        }

        this._logAudit('SECURE_DELETE', { key })
        return true
      } catch (error) {
        console.error('[DebugPanel] 删除敏感数据失败:', error)
        return false
      }
    },

    /**
     * 记录安全审计
     * @param {string} action - 操作
     * @param {object} details - 详情
     */
    _logAudit(action, details) {
      const entry = {
        timestamp: Date.now(),
        action,
        details,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      }

      this.auditLog.push(entry)

      // 限制日志大小
      while (this.auditLog.length > 100) {
        this.auditLog.shift()
      }
    },

    /**
     * 获取审计日志
     */
    getAuditLog() {
      return [...this.auditLog]
    },

    /**
     * 清除审计日志
     */
    clearAuditLog() {
      this.auditLog = []
    },
  }

  // 导出
  window.SecurityManager = SecurityManager

  console.log('[SecurityManager] 安全管理模块已加载')
})()
