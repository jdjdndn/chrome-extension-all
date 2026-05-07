// ========== 输入验证模块 ==========
// 对用户输入进行严格验证和转义

;(function () {
  'use strict'

  if (window.InputValidator) {
    console.log('[InputValidator] 已存在，跳过初始化')
    return
  }

  /**
   * InputValidator - 输入验证器
   * 功能：
   * 1. 类型验证
   * 2. 格式验证
   * 3. 输入净化
   */
  const InputValidator = {
    // 验证规则
    rules: {
      // 域名验证
      domain: {
        pattern: /^[a-zA-Z0-9][-a-zA-Z0-9.]{0,62}[a-zA-Z0-9]$/,
        maxLength: 253,
        sanitize: (value) => value.trim().toLowerCase(),
      },

      // 选择器验证
      selector: {
        maxLength: 500,
        forbidden: ['script', 'javascript:', 'data:', 'vbscript:'],
        validate: (value) => {
          // 检查是否包含危险内容
          const lower = value.toLowerCase()
          for (const forbidden of InputValidator.rules.selector.forbidden) {
            if (lower.includes(forbidden)) {
              return { valid: false, error: `包含禁止的内容: ${forbidden}` }
            }
          }

          // 检查是否是有效的 CSS 选择器
          try {
            document.querySelector(value)
            return { valid: true }
          } catch {
            return { valid: false, error: '无效的 CSS 选择器' }
          }
        },
        sanitize: (value) => value.trim(),
      },

      // 关键词验证
      keyword: {
        maxLength: 100,
        minLength: 1,
        pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/,
        sanitize: (value) => value.trim(),
      },

      // URL 验证
      url: {
        maxLength: 2048,
        allowedProtocols: ['http:', 'https:'],
        sanitize: (value) => {
          try {
            const url = new URL(value)
            return url.toString()
          } catch {
            return value.trim()
          }
        },
      },

      // 颜色值验证
      color: {
        pattern:
          /^(#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)\s*)$/,
        sanitize: (value) => value.trim(),
      },
    },

    /**
     * 验证输入
     * @param {any} value - 输入值
     * @param {string} type - 验证类型
     * @param {object} options - 选项
     * @returns {object}
     */
    validate(value, type, options = {}) {
      const rule = this.rules[type]
      if (!rule) {
        console.warn(`[InputValidator] 未知的验证类型: ${type}`)
        return { valid: false, error: '未知的验证类型' }
      }

      const result = {
        valid: true,
        value,
        errors: [],
      }

      // 空值检查
      if (value === null || value === undefined) {
        if (options.required) {
          return { valid: false, error: '值不能为空' }
        }
        return { valid: true, value: null }
      }

      // 类型检查
      if (typeof value === 'string') {
        // 长度检查
        if (rule.maxLength && value.length > rule.maxLength) {
          result.errors.push(`长度超过限制 (${value.length}/${rule.maxLength})`)
          result.valid = false
        }

        if (rule.minLength && value.length < rule.minLength) {
          result.errors.push(`长度不足 (${value.length}/${rule.minLength})`)
          result.valid = false
        }

        // 正则检查
        if (rule.pattern && !rule.pattern.test(value)) {
          result.errors.push('格式不正确')
          result.valid = false
        }

        // 自定义验证
        if (rule.validate) {
          const customResult = rule.validate(value)
          if (!customResult.valid) {
            result.errors.push(customResult.error)
            result.valid = false
          }
        }

        // 净化
        if (rule.sanitize && options.sanitize !== false) {
          result.value = rule.sanitize(value)
        }
      } else if (Array.isArray(value)) {
        // 数组验证
        result.value = []
        for (const item of value) {
          const itemResult = this.validate(item, type, options)
          if (!itemResult.valid) {
            result.valid = false
            result.errors.push(...itemResult.errors)
          } else {
            result.value.push(itemResult.value)
          }
        }
      } else if (typeof value === 'object') {
        // 对象验证
        if (options.schema) {
          const schemaResult = this.validateObject(value, options.schema)
          if (!schemaResult.valid) {
            return schemaResult
          }
          result.value = schemaResult.value
        }
      }

      return result
    },

    /**
     * 验证对象
     * @param {object} obj - 对象
     * @param {object} schema - 模式
     */
    validateObject(obj, schema) {
      const result = {
        valid: true,
        value: {},
        errors: [],
      }

      for (const [key, config] of Object.entries(schema)) {
        const fieldResult = this.validate(obj[key], config.type, {
          required: config.required,
          sanitize: config.sanitize,
        })

        if (!fieldResult.valid && config.required) {
          result.valid = false
          result.errors.push(`${key}: ${fieldResult.errors.join(', ')}`)
        } else if (fieldResult.valid) {
          result.value[key] = fieldResult.value
        } else {
          result.value[key] = config.default
        }
      }

      return result
    },

    /**
     * 批量验证
     * @param {array} items - 待验证项
     * @param {string} type - 验证类型
     */
    batchValidate(items, type) {
      const results = {
        valid: [],
        invalid: [],
      }

      for (const item of items) {
        const result = this.validate(item, type)
        if (result.valid) {
          results.valid.push(result.value)
        } else {
          results.invalid.push({ value: item, errors: result.errors })
        }
      }

      return results
    },

    /**
     * 添加自定义验证规则
     * @param {string} type - 类型名称
     * @param {object} config - 配置
     */
    addRule(type, config) {
      this.rules[type] = config
      console.log(`[InputValidator] 添加验证规则: ${type}`)
    },

    /**
     * 转义 HTML
     * @param {string} str - 原始字符串
     */
    escapeHtml(str) {
      const div = document.createElement('div')
      div.textContent = str
      return div.innerHTML
    },

    /**
     * 移除危险字符
     * @param {string} str - 原始字符串
     * @param {string} pattern - 要移除的正则
     */
    removeDangerous(str, pattern) {
      return str.replace(new RegExp(pattern, 'gi'), '')
    },

    /**
     * 检查 XSS
     * @param {string} str - 检查内容
     */
    checkXss(str) {
      const patterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /onerror\s*=/gi,
        /onload\s*=/gi,
      ]

      for (const pattern of patterns) {
        if (pattern.test(str)) {
          return { hasXss: true, pattern }
        }
      }

      return { hasXss: false }
    },

    /**
     * 净化 HTML
     * @param {string} html - HTML 内容
     */
    sanitizeHtml(html) {
      const xssCheck = this.checkXss(html)
      if (xssCheck.hasXss) {
        console.warn(`[InputValidator] 检测到潜在 XSS: ${xssCheck.pattern}`)
        // 移除脚本标签
        let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        cleaned = cleaned.replace(/on\w+\s*=/gi, 'data-removed-')
        cleaned = cleaned.replace(/javascript:/gi, '')
        return cleaned
      }
      return html
    },
  }

  // 导出
  window.InputValidator = InputValidator

  console.log('[InputValidator] 输入验证模块已加载')
})()
