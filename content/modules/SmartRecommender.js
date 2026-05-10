/**
 * 智能推荐增强模块
 * 基于元素特征和历史数据提供选择器推荐
 */
(function () {
  'use strict'

  class SmartRecommender {
    constructor() {
      this.history = [] // 选择历史
      this.patterns = new Map() // 选择模式统计
      this.selectorEngine = window.SelectorEngine ? new window.SelectorEngine() : null
    }

    /**
     * 分析元素并生成推荐
     */
    analyze(element) {
      const recommendations = []

      if (!element || !element.tagName) {
        return recommendations
      }

      // 1. 基础分析
      const basicAnalysis = this._analyzeBasic(element)
      recommendations.push(...basicAnalysis)

      // 2. 上下文分析
      const contextAnalysis = this._analyzeContext(element)
      recommendations.push(...contextAnalysis)

      // 3. 历史模式分析
      const patternAnalysis = this._analyzePatterns(element)
      recommendations.push(...patternAnalysis)

      // 4. 智能优化建议
      const optimizationAnalysis = this._analyzeOptimizations(element)
      recommendations.push(...optimizationAnalysis)

      // 按优先级排序
      recommendations.sort((a, b) => (b.score || 0) - (a.score || 0))

      return recommendations.slice(0, 5) // 返回前5个推荐
    }

    /**
     * 基础分析
     */
    _analyzeBasic(element) {
      const recommendations = []
      const tag = element.tagName.toLowerCase()

      // ID 推荐
      if (element.id && !element.id.includes(' ') && !/^\d/.test(element.id)) {
        recommendations.push({
          type: 'ID 选择器',
          selector: '#' + CSS.escape(element.id),
          score: 100,
          description: '使用唯一 ID，性能最佳且最稳定',
          pros: ['唯一性强', '性能最好', '不受 DOM 变化影响'],
          cons: ['ID 可能被修改'],
        })
      }

      // 语义化 Class 推荐
      if (element.className && typeof element.className === 'string') {
        const classes = element.className
          .split(' ')
          .filter((c) => c && !/^(css-|styled-|sc-|js-|_|__|Mui|jss|ep-)/.test(c))

        const semanticClasses = classes.filter((c) =>
          /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper|header|footer|content|title|text|icon|active|disabled|selected|hidden|show|fade|slide|modal|dropdown|tooltip|badge|label|error|success|warning)/i.test(
            c
          )
        )

        if (semanticClasses.length > 0) {
          recommendations.push({
            type: '语义化 Class',
            selector: tag + '.' + CSS.escape(semanticClasses[0]),
            score: 85,
            description: '使用语义化的 class 名称，可读性好',
            pros: ['可读性好', '相对稳定', '便于维护'],
            cons: ['可能匹配多个元素'],
          })
        }

        // 组合 Class
        if (classes.length >= 2) {
          const combined = classes
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join('.')
          recommendations.push({
            type: '组合 Class',
            selector: tag + '.' + combined,
            score: 80,
            description: '组合多个 class 提高精确度',
            pros: ['精确度较高', '减少误匹配'],
            cons: ['选择器较长'],
          })
        }
      }

      // 属性推荐
      const stableAttrs = [
        'type',
        'role',
        'data-type',
        'data-role',
        'data-testid',
        'data-test',
        'name',
      ]
      for (const attr of stableAttrs) {
        const value = element.getAttribute(attr)
        if (value && value.length < 50) {
          recommendations.push({
            type: '属性选择器',
            selector: tag + '[' + CSS.escape(attr) + '="' + CSS.escape(value) + '"]',
            score: 75,
            description: `使用 ${attr} 属性定位`,
            pros: ['属性通常较稳定', '语义明确'],
            cons: ['属性可能被移除'],
          })
        }
      }

      return recommendations
    }

    /**
     * 上下文分析
     */
    _analyzeContext(element) {
      const recommendations = []
      const parent = element.parentElement
      if (!parent) {return recommendations}

      const tag = element.tagName.toLowerCase()
      const parentTag = parent.tagName.toLowerCase()

      // 父级限定
      if (parent.id && !parent.id.includes(' ')) {
        recommendations.push({
          type: '父级 ID 限定',
          selector: '#' + CSS.escape(parent.id) + ' > ' + tag,
          score: 70,
          description: '通过父级 ID 缩小范围',
          pros: ['缩小搜索范围', '结构清晰'],
          cons: ['依赖父级结构'],
        })
      }

      // 父级 Class 限定
      if (parent.className && typeof parent.className === 'string') {
        const parentClass = parent.className
          .split(' ')
          .find((c) => c && !/^(css-|styled-|sc-|js-|_|__|Mui|jss|ep-)/.test(c))
        if (parentClass) {
          recommendations.push({
            type: '父级 Class 限定',
            selector: parentTag + '.' + CSS.escape(parentClass) + ' > ' + tag,
            score: 65,
            description: '通过父级 class 缩小范围',
            pros: ['结构化选择', '相对稳定'],
            cons: ['依赖 DOM 结构'],
          })
        }
      }

      // 兄弟元素分析
      const siblings = Array.from(parent.children)
      const sameTagSiblings = siblings.filter((s) => s.tagName === element.tagName)
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(element) + 1

        // 检查是否是首/尾元素
        if (index === 1) {
          recommendations.push({
            type: '首元素选择器',
            selector: tag + ':first-child',
            score: 55,
            description: '选择第一个同类型元素',
            pros: ['简洁'],
            cons: ['位置敏感', '新增元素时会失效'],
          })
        } else if (index === sameTagSiblings.length) {
          recommendations.push({
            type: '尾元素选择器',
            selector: tag + ':last-child',
            score: 55,
            description: '选择最后一个同类型元素',
            pros: ['简洁'],
            cons: ['位置敏感', '删除元素时会失效'],
          })
        }

        // 奇偶位置
        if (sameTagSiblings.length > 2) {
          const isOdd = index % 2 === 1
          recommendations.push({
            type: isOdd ? '奇数位置' : '偶数位置',
            selector: tag + ':nth-child(' + (isOdd ? 'odd' : 'even') + ')',
            score: 45,
            description: `选择${isOdd ? '奇数' : '偶数'}位置的元素`,
            pros: ['批量选择'],
            cons: ['可能匹配多个元素', '位置敏感'],
          })
        }
      }

      return recommendations
    }

    /**
     * 历史模式分析
     */
    _analyzePatterns(element) {
      const recommendations = []

      // 分析选择历史中的模式
      // 例如：如果用户经常选择带有 data-testid 的元素，可以推荐使用这个属性
      // 这里可以根据实际需求扩展更复杂的模式识别

      return recommendations
    }

    /**
     * 优化建议分析
     */
    _analyzeOptimizations(element) {
      const recommendations = []
      const currentSelector = this.selectorEngine?.generateSelector(element)

      if (!currentSelector) {return recommendations}

      // 检查选择器质量问题
      const quality = this.selectorEngine?.analyzeSelectorQuality(currentSelector)

      if (quality?.issues?.length > 0) {
        // 生成优化建议
        recommendations.push({
          type: '优化建议',
          selector: currentSelector,
          score: 60,
          description: '当前选择器存在问题',
          issues: quality.issues,
          suggestions: quality.suggestions,
          warning: true,
        })
      }

      return recommendations
    }

    /**
     * 记录选择历史
     */
    recordSelection(element, selector) {
      const entry = {
        selector,
        tag: element.tagName.toLowerCase(),
        hasId: !!element.id,
        hasClass: !!element.className,
        timestamp: Date.now(),
      }

      this.history.push(entry)

      // 限制历史记录数量
      if (this.history.length > 100) {
        this.history.shift()
      }

      // 更新模式统计
      this._updatePatterns(entry)
    }

    /**
     * 更新选择模式
     */
    _updatePatterns(entry) {
      // 统计选择器类型使用频率
      if (entry.selector.startsWith('#')) {
        const count = this.patterns.get('id') || 0
        this.patterns.set('id', count + 1)
      } else if (entry.selector.includes('[data-')) {
        const count = this.patterns.get('data-attr') || 0
        this.patterns.set('data-attr', count + 1)
      } else if (entry.selector.includes('.')) {
        const count = this.patterns.get('class') || 0
        this.patterns.set('class', count + 1)
      }
    }

    /**
     * 获取推荐策略
     */
    getRecommendedStrategy() {
      let maxType = 'prefer-class'
      let maxCount = 0

      for (const [type, count] of this.patterns) {
        if (count > maxCount) {
          maxCount = count
          maxType = type
        }
      }

      switch (maxType) {
        case 'id':
          return 'prefer-id'
        case 'data-attr':
          return 'prefer-attribute'
        default:
          return 'prefer-class'
      }
    }

    /**
     * 清除历史
     */
    clearHistory() {
      this.history = []
      this.patterns.clear()
    }
  }

  // 导出
  window.SmartRecommender = SmartRecommender
})()
