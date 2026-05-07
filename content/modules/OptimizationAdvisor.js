/**
 * 选择器优化建议引擎
 * 噪声分析选择器并提供优化建议
 */
;(function () {
  'use strict'

  // 最佳实践规则
  const BEST_PRACTICES = {
    // 推荐的属性
    preferredAttributes: [
      'data-testid',
      'data-test',
      'data-cy',
      'data-automation-id',
      'role',
      'aria-label',
    ],
    // 不稳定的 class 前缀
    unstableClassPatterns: [
      /^css-[a-z0-9]+$/i,
      /^styled-[a-z0-9]+$/i,
      /^sc-[a-z0-9]+$/i,
      /^js-[a-z0-9]+$/i,
      /^_[a-z0-9]+$/i,
      /^__/,
      /^Mui/,
      /^jss/,
      /^css_/,
    ],
    // 语义化的 class 模式
    semanticClassPatterns: [
      /^(btn|button)/i,
      /^(link|anchor)/i,
      /^(nav|navigation|menu)/i,
      /^(card|panel|modal)/i,
      /^(list|item)/i,
      /^(form|input|field)/i,
      /^(container|wrapper)/i,
      /^(header|footer|content|sidebar)/i,
      /^(title|heading|label)/i,
      /^(text|description|content)/i,
      /^(icon|img|image)/i,
      /^(active|selected|disabled|hidden)/i,
    ],
  }

  class OptimizationAdvisor {
    constructor(options = {}) {
      this.options = {
        checkPerformance: true,
        checkStability: true,
        checkBestPractices: true,
        checkAccessibility: true,
        maxSuggestions: 5,
        ...options,
      }

      this.suggestions = []
    }

    /**
     * 分析选择器并生成优化建议
     */
    analyze(selector, element = null) {
      this.suggestions = []

      if (!selector) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'error',
            severity: 'critical',
            message: '选择器为空',
            fix: '请提供有效的选择器',
            impact: '无法匹配任何元素',
          })
        )
        return this._getResult()
      }

      // 1. 基本验证
      this._validateSelector(selector)

      // 2. 性能分析
      if (this.options.checkPerformance) {
        this._analyzePerformance(selector)
      }

      // 3. 稳定性分析
      if (this.options.checkStability) {
        this._analyzeStability(selector, element)
      }

      // 4. 最佳实践检查
      if (this.options.checkBestPractices) {
        this._checkBestPractices(selector, element)
      }

      // 5. 可访问性检查
      if (this.options.checkAccessibility) {
        this._checkAccessibility(selector, element)
      }

      // 6. 生成替代选择器
      if (element) {
        this._generateAlternatives(element, selector)
      }

      return this._getResult()
    }

    /**
     * 验证选择器
     */
    _validateSelector(selector) {
      try {
        const count = document.querySelectorAll(selector).length

        if (count === 0) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'validation',
              severity: 'critical',
              message: '选择器不匹配任何元素',
              fix: '检查选择器语法或确认元素是否存在于页面',
              impact: '无法定位目标元素',
            })
          )
        } else if (count > 1) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'validation',
              severity: 'warning',
              message: `选择器匹配 ${count} 个元素，不是唯一`,
              fix: '添加更多限定条件使其唯一',
              impact: '可能操作错误的元素',
              details: { matchCount: count },
            })
          )
        } else {
          this.suggestions.push(
            this._createSuggestion({
              type: 'validation',
              severity: 'info',
              message: '选择器匹配唯一元素 ✓',
              impact: '正确定位目标元素',
              isPositive: true,
            })
          )
        }
      } catch (e) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'validation',
            severity: 'critical',
            message: '选择器语法错误',
            fix: '修复选择器语法',
            impact: e.message,
            details: { error: e.message },
          })
        )
      }
    }

    /**
     * 分析性能
     */
    _analyzePerformance(selector) {
      // 选择器长度
      if (selector.length > 100) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'performance',
            severity: 'warning',
            message: `选择器过长 (${selector.length} 字符)`,
            fix: '简化选择器，减少不必要的层级',
            impact: '可能影响匹配性能',
          })
        )
      }

      // 层级深度
      const depth = (selector.match(/>/g) || []).length
      if (depth > 4) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'performance',
            severity: 'warning',
            message: `选择器层级过深 (${depth} 层)`,
            fix: '减少选择器层级，使用更直接的选择器',
            impact: '匹配性能下降，DOM 变化时易失效',
          })
        )
      }

      // 通配符使用
      if (selector.includes('*')) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'performance',
            severity: 'info',
            message: '使用了通配符选择器',
            fix: '如果可能，使用具体的标签名',
            impact: '通配符匹配效率较低',
          })
        )
      }

      // 复杂伪类
      const complexPseudo = selector.match(/:not\([^)]+\)/g)
      if (complexPseudo && complexPseudo.length > 1) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'performance',
            severity: 'info',
            message: '使用了多个 :not() 伪类',
            fix: '考虑使用正向选择器代替',
            impact: '复杂伪类影响匹配性能',
          })
        )
      }
    }

    /**
     * 分析稳定性
     */
    _analyzeStability(selector, element) {
      // 位置选择器
      if (/:nth-(child|of-type|last-child|first-child)/.test(selector)) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'stability',
            severity: 'warning',
            message: '使用了位置选择器',
            fix: '使用属性选择器或语义化的 class 替代',
            impact: 'DOM 结构变化时会失效',
            alternatives: element ? this._findNthAlternatives(element) : [],
          })
        )
      }

      // 自动生成的 class
      const unstableClass = selector
        .match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
        ?.find((cls) =>
          BEST_PRACTICES.unstableClassPatterns.some((pattern) => pattern.test(cls.slice(1)))
        )

      if (unstableClass) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'stability',
            severity: 'warning',
            message: `使用了自动生成的 class: ${unstableClass}`,
            fix: '使用语义化的 class 或稳定的属性选择器',
            impact: '框架更新或重新编译时 class 可能会变化',
          })
        )
      }

      // 相邻兄弟选择器
      if (selector.includes('+') || selector.includes('~')) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'stability',
            severity: 'info',
            message: '使用了相邻兄弟选择器',
            fix: '确保相邻关系是稳定的结构特征',
            impact: '插入或删除元素时会影响匹配',
          })
        )
      }
    }

    /**
     * 检查最佳实践
     */
    _checkBestPractices(selector, element) {
      // 检查是否可以使用 data-testid
      if (element) {
        const testId = element.getAttribute('data-testid') || element.getAttribute('data-test')
        if (testId && !selector.includes('data-testid') && !selector.includes('data-test')) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'best-practice',
              severity: 'suggestion',
              message: '元素有 data-testid 属性',
              fix: `使用 [data-testid="${testId}"]`,
              impact: '更稳定且符合测试最佳实践',
              alternatives: [`[data-testid="${testId}"]`],
            })
          )
        }

        // 检查 role 属性
        const role = element.getAttribute('role')
        if (role && !selector.includes('role=')) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'best-practice',
              severity: 'suggestion',
              message: '元素有 role 属性',
              fix: `使用 [role="${role}"]`,
              impact: '语义化更好，符合可访问性标准',
              alternatives: [`[role="${role}"]`],
            })
          )
        }

        // 检查 aria-label
        const ariaLabel = element.getAttribute('aria-label')
        if (ariaLabel && ariaLabel.length < 30 && !selector.includes('aria-label=')) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'best-practice',
              severity: 'info',
              message: '元素有 aria-label 属性',
              fix: `可以考虑使用 [aria-label="${ariaLabel}"]`,
              impact: '提高选择器的语义化程度',
            })
          )
        }
      }

      // ID 选择器
      if (selector.startsWith('#') && !selector.includes(' ')) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'best-practice',
            severity: 'info',
            message: '使用了 ID 选择器',
            impact: '性能最佳，唯一性保证',
            isPositive: true,
          })
        )
      }

      // 检查 class 是否语义化
      const classMatch = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
      if (classMatch) {
        for (const cls of classMatch) {
          const className = cls.slice(1)
          const isSemantic = BEST_PRACTICES.semanticClassPatterns.some((pattern) =>
            pattern.test(className)
          )

          if (isSemantic) {
            this.suggestions.push(
              this._createSuggestion({
                type: 'best-practice',
                severity: 'info',
                message: `使用了语义化的 class: ${className}`,
                impact: '可读性好，相对稳定',
                isPositive: true,
              })
            )
          }
        }
      }
    }

    /**
     * 检查可访问性
     */
    _checkAccessibility(selector, element) {
      if (!element) return

      // 检查交互元素
      const interactiveTags = ['button', 'a', 'input', 'select', 'textarea']
      const tag = element.tagName.toLowerCase()

      if (interactiveTags.includes(tag)) {
        // 检查是否有可访问性属性
        const hasAriaLabel =
          element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')
        const hasRole = element.hasAttribute('role')
        const hasTitle = element.hasAttribute('title')

        if (!hasAriaLabel && !hasRole && !hasTitle && tag !== 'button') {
          // button 通常有文本内容
          const hasText = element.textContent?.trim().length > 0
          if (!hasText) {
            this.suggestions.push(
              this._createSuggestion({
                type: 'accessibility',
                severity: 'warning',
                message: '交互元素缺少可访问性属性',
                fix: '添加 aria-label 或 role 属性',
                impact: '屏幕阅读器可能无法正确识别此元素',
              })
            )
          }
        }
      }

      // 检查图片是否有 alt
      if (tag === 'img' && !element.hasAttribute('alt')) {
        this.suggestions.push(
          this._createSuggestion({
            type: 'accessibility',
            severity: 'warning',
            message: '图片缺少 alt 属性',
            fix: '添加描述性的 alt 属性',
            impact: '屏幕阅读器无法描述图片内容',
          })
        )
      }
    }

    /**
     * 生成替代选择器
     */
    _generateAlternatives(element, currentSelector) {
      const alternatives = []

      // 1. ID 选择器
      if (element.id && !element.id.includes(' ') && !/^\d/.test(element.id)) {
        alternatives.push({
          selector: '#' + CSS.escape(element.id),
          type: 'ID 选择器',
          score: 100,
          reason: '使用唯一 ID，性能最佳',
        })
      }

      // 2. data-testid 选择器
      const testId = element.getAttribute('data-testid') || element.getAttribute('data-test')
      if (testId) {
        alternatives.push({
          selector: `[data-testid="${testId}"]`,
          type: '测试属性选择器',
          score: 95,
          reason: '专门为测试设计的稳定属性',
        })
      }

      // 3. 语义化 class 选择器
      const classes = (element.className || '')
        .split(' ')
        .filter(
          (c) => c && !BEST_PRACTICES.unstableClassPatterns.some((pattern) => pattern.test(c))
        )

      const semanticClass = classes.find((c) =>
        BEST_PRACTICES.semanticClassPatterns.some((pattern) => pattern.test(c))
      )

      if (semanticClass) {
        alternatives.push({
          selector: element.tagName.toLowerCase() + '.' + CSS.escape(semanticClass),
          type: '语义化 Class',
          score: 85,
          reason: '语义化的 class，可读性好',
        })
      }

      // 4. role 属性选择器
      const role = element.getAttribute('role')
      if (role) {
        alternatives.push({
          selector: element.tagName.toLowerCase() + '[role="' + role + '"]',
          type: 'Role 属性选择器',
          score: 80,
          reason: '语义化的角色属性',
        })
      }

      // 5. 组合选择器
      if (classes.length >= 2) {
        const combined = classes
          .slice(0, 2)
          .map((c) => CSS.escape(c))
          .join('.')
        alternatives.push({
          selector: element.tagName.toLowerCase() + '.' + combined,
          type: '组合 Class',
          score: 75,
          reason: '组合多个 class 提高精确度',
        })
      }

      // 按分数排序并添加建议
      alternatives.sort((a, b) => b.score - a.score)

      if (alternatives.length > 0) {
        const best = alternatives[0]
        // 只有当替代选择器更好时才建议
        if (best.score >= 80 && best.selector !== currentSelector) {
          this.suggestions.push(
            this._createSuggestion({
              type: 'alternative',
              severity: 'suggestion',
              message: `推荐使用更好的选择器`,
              fix: `使用 ${best.selector}`,
              impact: best.reason,
              alternatives: alternatives.slice(0, 3).map((a) => ({
                selector: a.selector,
                type: a.type,
                reason: a.reason,
              })),
            })
          )
        }
      }
    }

    /**
     * 查找 nth 选择器的替代方案
     */
    _findNthAlternatives(element) {
      const alternatives = []

      // 检查可用属性
      const attrs = element.attributes
      for (const attr of attrs) {
        if (BEST_PRACTICES.preferredAttributes.includes(attr.name) && attr.value) {
          alternatives.push(`[${attr.name}="${attr.value}"]`)
        }
      }

      // 检查语义化 class
      const classes = (element.className || '')
        .split(' ')
        .filter(
          (c) => c && !BEST_PRACTICES.unstableClassPatterns.some((pattern) => pattern.test(c))
        )

      for (const cls of classes) {
        alternatives.push('.' + CSS.escape(cls))
      }

      return alternatives.slice(0, 3)
    }

    /**
     * 创建建议对象
     */
    _createSuggestion(options) {
      return {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type: options.type,
        severity: options.severity,
        message: options.message,
        fix: options.fix,
        impact: options.impact,
        isPositive: options.isPositive || false,
        alternatives: options.alternatives || [],
        details: options.details || {},
        timestamp: Date.now(),
      }
    }

    /**
     * 获取分析结果
     */
    _getResult() {
      // 按严重程度排序
      const severityOrder = { critical: 0, warning: 1, suggestion: 2, info: 3 }

      this.suggestions.sort((a, b) => {
        const orderDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99)
        if (orderDiff !== 0) return orderDiff
        // 同等严重程度，正向建议放后面
        return (a.isPositive ? 1 : 0) - (b.isPositive ? 1 : 0)
      })

      // 计算总体评分
      const score = this._calculateOverallScore()

      // 限制建议数量
      const limitedSuggestions = this.suggestions.slice(0, this.options.maxSuggestions)

      return {
        score,
        grade: this._getGrade(score),
        suggestions: limitedSuggestions,
        totalIssues: this.suggestions.filter((s) => !s.isPositive && s.severity !== 'info').length,
        summary: this._generateSummary(),
      }
    }

    /**
     * 计算总体评分
     */
    _calculateOverallScore() {
      let score = 100

      for (const suggestion of this.suggestions) {
        if (suggestion.isPositive) {
          continue
        }

        switch (suggestion.severity) {
          case 'critical':
            score -= 30
            break
          case 'warning':
            score -= 15
            break
          case 'suggestion':
            score -= 5
            break
          case 'info':
            score -= 2
            break
        }
      }

      return Math.max(0, Math.min(100, score))
    }

    /**
     * 获取等级
     */
    _getGrade(score) {
      if (score >= 90) return { level: 'A', label: '优秀', color: '#10b981' }
      if (score >= 75) return { level: 'B', label: '良好', color: '#34d399' }
      if (score >= 60) return { level: 'C', label: '一般', color: '#fbbf24' }
      if (score >= 40) return { level: 'D', label: '较差', color: '#f97316' }
      return { level: 'F', label: '差', color: '#ef4444' }
    }

    /**
     * 生成摘要
     */
    _generateSummary() {
      const critical = this.suggestions.filter((s) => s.severity === 'critical').length
      const warnings = this.suggestions.filter((s) => s.severity === 'warning').length
      const suggestions = this.suggestions.filter((s) => s.severity === 'suggestion').length

      const parts = []
      if (critical > 0) parts.push(`${critical} 个严重问题`)
      if (warnings > 0) parts.push(`${warnings} 个警告`)
      if (suggestions > 0) parts.push(`${suggestions} 条建议`)

      return parts.length > 0 ? `发现 ${parts.join('，')}` : '选择器状态良好'
    }

    /**
     * 快速检查（轻量级）
     */
    quickCheck(selector) {
      const issues = []

      // 语法检查
      try {
        const count = document.querySelectorAll(selector).length
        if (count === 0) issues.push('不匹配')
        if (count > 1) issues.push('多个匹配')
      } catch {
        issues.push('语法错误')
      }

      // 长度检查
      if (selector.length > 100) issues.push('过长')

      // 稳定性检查
      if (/:nth-/.test(selector)) issues.push('位置选择器')
      if (/[.#](css-|styled-|sc-)/.test(selector)) issues.push('不稳定class')

      return {
        isValid: issues.length === 0,
        issues,
        score: Math.max(0, 100 - issues.length * 20),
      }
    }

    /**
     * 批量分析
     */
    batchAnalyze(selectors, elements = []) {
      return selectors.map((selector, index) => ({
        selector,
        result: this.analyze(selector, elements[index]),
      }))
    }
  }

  // 导出
  window.OptimizationAdvisor = OptimizationAdvisor
})()
