// ========== 规则冲突检测模块 ==========
// 在导入规则时检测并提示冲突

;(function () {
  'use strict'

  if (window.RuleConflictDetector) {
    console.log('[RuleConflictDetector] 已存在，跳过初始化')
    return
  }

  /**
   * RuleConflictDetector - 规则冲突检测器
   * 功能：
   * 1. 检测选择器冲突
   * 2. 检测关键词冲突
   * 3. 检测域名规则冲突
   */
  const RuleConflictDetector = {
    // 冲突类型
    conflictTypes: {
      SELECTOR_OVERLAP: '选择器重叠',
      SELECTOR_CONFLICT: '选择器冲突',
      KEYWORD_DUPLICATE: '关键词重复',
      DOMAIN_CONFLICT: '域名规则冲突',
      RULE_MERGE: '规则合并冲突',
    },

    /**
     * 检测选择器冲突
     * @param {array} existingSelectors - 现有选择器
     * @param {array} newSelectors - 新选择器
     * @returns {array}
     */
    detectSelectorConflicts(existingSelectors, newSelectors) {
      const conflicts = []

      for (const newSelector of newSelectors) {
        if (!newSelector || typeof newSelector !== 'string') continue

        const normalized = newSelector.trim()

        for (const existing of existingSelectors) {
          if (!existing || typeof existing !== 'string') continue

          const normalizedExisting = existing.trim()

          // 完全相同
          if (normalized === normalizedExisting) {
            conflicts.push({
              type: this.conflictTypes.SELECTOR_DUPLICATE,
              existing: existing,
              new: newSelector,
              message: '选择器完全相同',
            })
            continue
          }

          // 选择器重叠
          if (normalized.includes(normalizedExisting) || normalizedExisting.includes(normalized)) {
            conflicts.push({
              type: this.conflictTypes.SELECTOR_OVERLAP,
              existing: existing,
              new: newSelector,
              message: '选择器存在包含关系',
            })
          }

          // 目标元素冲突（两个选择器可能选择相同元素）
          if (this._wouldSelectSameElements(normalized, normalizedExisting)) {
            conflicts.push({
              type: this.conflictTypes.SELECTOR_CONFLICT,
              existing: existing,
              new: newSelector,
              message: '选择器可能选择相同元素',
            })
          }
        }
      }

      return conflicts
    },

    /**
     * 判断两个选择器是否会选择相同元素
     */
    _wouldSelectSameElements(selector1, selector2) {
      // 简单的启发式判断
      // 检查是否有相同的基础选择器
      const base1 = selector1.split(/[.#\[:\]>+~+]/)[0]
      const base2 = selector2.split(/[.#\[:\]>+~+]/)[0]

      if (base1 === base2) {
        return true
      }

      // 检查是否有父子关系
      if (selector1.includes('>') || selector1.includes(' ')) {
        const parent = selector1.split(/[>\s]/)[0]
        const child = selector1.split(/[>\s]/)[1]
        if (selector2.includes(parent) && selector2.includes(child)) {
          return true
        }
      }

      return false
    },

    /**
     * 检测关键词冲突
     * @param {object} existingKeywords - 现有关键词
     * @param {object} newKeywords - 新关键词
     * @returns {array}
     */
    detectKeywordConflicts(existingKeywords, newKeywords) {
      const conflicts = []

      for (const [group, newWords] of Object.entries(newKeywords)) {
        const existingWords = existingKeywords[group] || []

        for (const word of newWords) {
          // 完全重复
          if (existingWords.includes(word)) {
            conflicts.push({
              type: this.conflictTypes.KEYWORD_DUPLICATE,
              group,
              keyword: word,
              message: '关键词已存在',
            })
          }

          // 包含关系
          for (const existingWord of existingWords) {
            if (word.includes(existingWord) || existingWord.includes(word)) {
              conflicts.push({
                type: this.conflictTypes.KEYWORD_DUPLICATE,
                group,
                keyword: word,
                relatedTo: existingWord,
                message: '关键词存在包含关系',
              })
            }
          }
        }
      }

      return conflicts
    },

    /**
     * 检测规则合并冲突
     * @param {object} existingRules - 现有规则
     * @param {object} newRules - 新规则
     * @returns {array}
     */
    detectRuleMergeConflicts(existingRules, newRules) {
      const conflicts = []

      // 检测选择器冲突
      if (existingRules.selectors && newRules.selectors) {
        const selectorConflicts = this.detectSelectorConflicts(
          existingRules.selectors,
          newRules.selectors
        )
        conflicts.push(...selectorConflicts)
      }

      // 检测关键词冲突
      if (existingRules.keywords && newRules.keywords) {
        const keywordConflicts = this.detectKeywordConflicts(
          existingRules.keywords,
          newRules.keywords
        )
        conflicts.push(...keywordConflicts)
      }

      return conflicts
    },

    /**
     * 分析冲突影响
     * @param {array} conflicts - 冲突列表
     * @returns {object}
     */
    analyzeImpact(conflicts) {
      const impact = {
        total: conflicts.length,
        critical: 0,
        warnings: 0,
        info: 0,
        affectedElements: 0,
      }

      for (const conflict of conflicts) {
        switch (conflict.type) {
          case this.conflictTypes.SELECTOR_DUPLICATE:
            impact.info++
            break
          case this.conflictTypes.SELECTOR_OVERLAP:
            impact.warnings++
            break
          case this.conflictTypes.SELECTOR_CONFLICT:
            impact.warnings++
            break
          case this.conflictTypes.KEYWORD_DUPLICATE:
            impact.info++
            break
          case this.conflictTypes.DOMAIN_CONFLICT:
            impact.critical++
            break
          case this.conflictTypes.RULE_MERGE:
            impact.warnings++
            break
        }
      }

      return impact
    },

    /**
     * 生成冲突报告
     * @param {array} conflicts - 冲突列表
     * @returns {string}
     */
    generateReport(conflicts) {
      if (conflicts.length === 0) {
        return '未检测到冲突'
      }

      const impact = this.analyzeImpact(conflicts)
      let report = `检测到 ${conflicts.length} 个潜在冲突\n`
      report += `严重: ${impact.critical}, 警告: ${impact.warnings}, 信息: ${impact.info}\n`
      report += '\n'

      // 按类型分组
      const grouped = {}
      for (const conflict of conflicts) {
        const type = conflict.type
        if (!grouped[type]) {
          grouped[type] = []
        }
        grouped[type].push(conflict)
      }

      // 详细报告
      for (const [type, items] of Object.entries(grouped)) {
        report += `\n${type}:\n`
        for (const item of items) {
          report += `  - ${item.message}\n`
          if (item.existing) {
            report += `    现有: ${item.existing}\n`
          }
          if (item.new) {
            report += `    新增: ${item.new}\n`
          }
        }
      }

      return report
    },

    /**
     * 建议解决方案
     * @param {array} conflicts - 冲突列表
     * @returns {array}
     */
    suggestResolutions(conflicts) {
      const suggestions = []

      for (const conflict of conflicts) {
        switch (conflict.type) {
          case this.conflictTypes.SELECTOR_DUPLICATE:
            suggestions.push({
              conflict,
              action: 'skip',
              reason: '选择器已存在，跳过导入',
            })
            break
          case this.conflictTypes.SELECTOR_OVERLAP:
            suggestions.push({
              conflict,
              action: 'keep_specific',
              reason: '保留更具体的选择器',
            })
            break
          case this.conflictTypes.KEYWORD_DUPLICATE:
            suggestions.push({
              conflict,
              action: 'merge',
              reason: '合并到现有分组',
            })
            break
          default:
            suggestions.push({
              conflict,
              action: 'review',
              reason: '需要人工审核',
            })
        }
      }

      return suggestions
    },
  }

  // 导出
  window.RuleConflictDetector = RuleConflictDetector

  console.log('[RuleConflictDetector] 规则冲突检测器已加载')
})()
