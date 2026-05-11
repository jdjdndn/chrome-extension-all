// ========== 选择器智能合并模块 ==========
// 提供选择器冲突检测、去重、智能合并功能

(function () {
  'use strict'

  if (window.SelectorMerger) {
    console.log('[SelectorMerger] 已存在，跳过初始化')
    return
  }

  /**
   * SelectorMerger - 选择器智能合并
   * 功能：
   * 1. 选择器去重和标准化
   * 2. 冲突检测和解决
   * 3. 智能合并策略
   * 4. 选择器优先级管理
   */
  const SelectorMerger = {
    // 合并策略
    strategies: {
      // 保留所有（默认）
      keepAll: (selectors) => selectors,
      // 只保留最短
      keepShortest: (selectors) => {
        const grouped = SelectorMerger._groupByTarget(selectors)
        return Object.values(grouped).map((group) => group.sort((a, b) => a.length - b.length)[0])
      },
      // 只保留最具体
      keepMostSpecific: (selectors) => {
        const grouped = SelectorMerger._groupByTarget(selectors)
        return Object.values(grouped).map((group) => {
          return group.sort((a, b) => {
            const aScore = SelectorMerger._calculateSpecificity(a)
            const bScore = SelectorMerger._calculateSpecificity(b)
            return bScore - aScore
          })[0]
        })
      },
      // 按优先级保留
      keepByPriority: (selectors) => {
        return selectors.filter((s, i, arr) => {
          // 保留高优先级选择器
          return !arr.some((other, j) => j !== i && SelectorMerger._isMoreSpecific(other, s))
        })
      },
    },

    // 当前策略
    currentStrategy: 'keepByPriority',

    /**
     * 合并选择器列表
     * @param {array} sources - 选择器来源数组 [{ selectors, priority, source }]
     * @param {object} options - 合并选项
     * @returns {array}
     */
    merge(sources, options = {}) {
      const { strategy = this.currentStrategy, removeInvalid = true, normalize = true } = options

      // 收集所有选择器
      let allSelectors = []
      for (const source of sources) {
        const { selectors = [], priority = 0, source: srcName = 'unknown' } = source
        for (const selector of selectors) {
          allSelectors.push({
            selector,
            priority,
            source: srcName,
          })
        }
      }

      // 标准化
      if (normalize) {
        allSelectors = allSelectors
          .map((s) => ({
            ...s,
            selector: this.normalize(s.selector),
          }))
          .filter((s) => s.selector)
      }

      // 移除无效选择器
      if (removeInvalid) {
        allSelectors = allSelectors.filter((s) => this.validate(s.selector))
      }

      // 去重
      allSelectors = this._deduplicate(allSelectors)

      // 按优先级排序
      allSelectors.sort((a, b) => b.priority - a.priority)

      // 应用合并策略
      const strategyFn = this.strategies[strategy] || this.strategies.keepAll
      const merged = strategyFn(allSelectors.map((s) => s.selector))

      // 记录合并信息
      const result = {
        selectors: merged,
        stats: {
          total: allSelectors.length,
          merged: merged.length,
          removed: allSelectors.length - merged.length,
          sources: sources.map((s) => ({ source: s.source, count: s.selectors?.length || 0 })),
        },
      }

      console.log(`[SelectorMerger] 合并完成: ${result.stats.total} -> ${result.stats.merged}`)
      return result
    },

    /**
     * 标准化选择器
     * @param {string} selector - 选择器
     * @returns {string}
     */
    normalize(selector) {
      if (!selector || typeof selector !== 'string') {
        return ''
      }

      // 去除多余空格
      const normalized = selector
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*([>+~,])\s*/g, '$1')
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')

      return normalized
    },

    /**
     * 验证选择器
     * @param {string} selector - 选择器
     * @returns {boolean}
     */
    validate(selector) {
      if (!selector || typeof selector !== 'string') {
        return false
      }

      try {
        document.querySelector(selector)
        return true
      } catch {
        return false
      }
    },

    /**
     * 检测选择器冲突
     * @param {array} selectors - 选择器数组
     * @returns {array} 冲突列表
     */
    detectConflicts(selectors) {
      const conflicts = []
      const normalized = selectors.map((s) => this.normalize(s)).filter((s) => s)

      for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
          const conflict = this._checkConflict(normalized[i], normalized[j])
          if (conflict) {
            conflicts.push({
              selector1: normalized[i],
              selector2: normalized[j],
              type: conflict.type,
              suggestion: conflict.suggestion,
            })
          }
        }
      }

      return conflicts
    },

    /**
     * 检查两个选择器是否冲突
     */
    _checkConflict(a, b) {
      // 完全相同
      if (a === b) {
        return { type: 'duplicate', suggestion: '删除重复项' }
      }

      // 包含关系
      if (a.includes(b) || b.includes(a)) {
        const longer = a.length > b.length ? a : b
        return {
          type: 'redundant',
          suggestion: `保留更具体的: ${longer}`,
        }
      }

      // 相同目标元素
      try {
        const targetsA = document.querySelectorAll(a)
        const targetsB = document.querySelectorAll(b)
        const setA = new Set(targetsA)
        const setB = new Set(targetsB)

        // 检查交集
        const intersection = [...setA].filter((el) => setB.has(el))
        if (intersection.length > 0) {
          return {
            type: 'overlap',
            overlap: intersection.length,
            suggestion: '可能选择相同元素',
          }
        }
      } catch {
        // 忽略无效选择器
      }

      return null
    },

    /**
     * 解决冲突
     * @param {array} selectors - 选择器数组
     * @param {array} conflicts - 冲突列表
     * @returns {array} 解决后的选择器
     */
    resolveConflicts(selectors, conflicts) {
      const toRemove = new Set()

      for (const conflict of conflicts) {
        switch (conflict.type) {
          case 'duplicate':
            toRemove.add(conflict.selector2)
            break
          case 'redundant':
            // 保留更短/更简单的
            if (conflict.selector1.length <= conflict.selector2.length) {
              toRemove.add(conflict.selector2)
            } else {
              toRemove.add(conflict.selector1)
            }
            break
          case 'overlap':
            // 保留优先级更高的（这里简单保留第一个）
            toRemove.add(conflict.selector2)
            break
        }
      }

      return selectors.filter((s) => !toRemove.has(this.normalize(s)))
    },

    /**
     * 去重
     */
    _deduplicate(selectors) {
      const seen = new Map()
      return selectors.filter((item) => {
        const key = item.selector
        if (seen.has(key)) {
          // 保留更高优先级的
          const existing = seen.get(key)
          if (item.priority > existing.priority) {
            seen.set(key, item)
            return true
          }
          return false
        }
        seen.set(key, item)
        return true
      })
    },

    /**
     * 按目标元素分组
     */
    _groupByTarget(selectors) {
      const groups = new Map()

      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector)
          const key = [...elements].map((el) => el.tagName + el.className).join(',')

          if (!groups.has(key)) {
            groups.set(key, [])
          }
          groups.get(key).push(selector)
        } catch {
          // 无效选择器单独分组
          const key = `invalid_${selector}`
          if (!groups.has(key)) {
            groups.set(key, [])
          }
          groups.get(key).push(selector)
        }
      }

      return Object.fromEntries(groups)
    },

    /**
     * 计算选择器特异性（CSS Specificity）
     */
    _calculateSpecificity(selector) {
      let score = 0

      // ID 选择器 (#id)
      score += (selector.match(/#[\w-]+/g) || []).length * 100

      // 类选择器 (.class)、属性选择器 ([attr])、伪类 (:hover)
      score += (selector.match(/\.[\w-]+/g) || []).length * 10
      score += (selector.match(/\[[^\]]+\]/g) || []).length * 10
      score += (selector.match(/:[\w-]+/g) || []).length * 10

      // 元素选择器 (div)、伪元素 (::before)
      score += (selector.match(/^[a-z]+|[\s>~+][a-z]+/gi) || []).length
      score += (selector.match(/::[\w-]+/g) || []).length

      return score
    },

    /**
     * 判断选择器 a 是否比 b 更具体
     */
    _isMoreSpecific(a, b) {
      return this._calculateSpecificity(a) > this._calculateSpecificity(b)
    },

    /**
     * 智能合并多个来源的选择器
     * @param {object} config - 配置对象
     * @returns {object}
     */
    smartMerge(config) {
      const {
        defaultSelectors = [],
        serverSelectors = [],
        userSelectors = [],
        customSelectors = [],
      } = config

      const sources = [
        { selectors: defaultSelectors, priority: 10, source: 'default' },
        { selectors: serverSelectors, priority: 20, source: 'server' },
        { selectors: userSelectors, priority: 30, source: 'user' },
        { selectors: customSelectors, priority: 40, source: 'custom' },
      ]

      const result = this.merge(sources, {
        strategy: 'keepByPriority',
        removeInvalid: true,
        normalize: true,
      })

      // 检测并解决冲突
      const conflicts = this.detectConflicts(result.selectors)
      if (conflicts.length > 0) {
        console.log(`[SelectorMerger] 检测到 ${conflicts.length} 个冲突，正在解决...`)
        result.selectors = this.resolveConflicts(result.selectors, conflicts)
        result.stats.conflicts = conflicts.length
        result.stats.afterConflictResolution = result.selectors.length
      }

      return result
    },

    /**
     * 设置合并策略
     * @param {string} strategy - 策略名称
     */
    setStrategy(strategy) {
      if (this.strategies[strategy]) {
        this.currentStrategy = strategy
        console.log(`[SelectorMerger] 策略已设置: ${strategy}`)
        return true
      }
      console.warn(`[SelectorMerger] 未知策略: ${strategy}`)
      return false
    },

    /**
     * 获取可用策略列表
     */
    getStrategies() {
      return Object.keys(this.strategies)
    },

    /**
     * 导出合并报告
     */
    exportReport(result) {
      return {
        timestamp: Date.now(),
        selectors: result.selectors,
        stats: result.stats,
        strategy: this.currentStrategy,
      }
    },
  }

  // 导出
  window.SelectorMerger = SelectorMerger

  console.log('[SelectorMerger] 选择器合并模块已加载')
})()
