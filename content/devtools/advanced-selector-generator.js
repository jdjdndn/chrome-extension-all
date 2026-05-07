/**
 * 高级 CSS 选择器生成器
 * 参考 DEFAULT_HIDE_SELECTORS 的高级模式：
 * - :nth-child(n):not(:nth-child(X)) 选择所有但排除特定位置
 * - [class*="xxx"] 属性包含选择器
 * - +* 兄弟选择器（任意元素）
 * - 多层 :not() 链
 */

;(function () {
  'use strict'

  // ========== 常量定义 ==========
  // 高优先级测试属性
  const TEST_ATTRS = [
    'data-testid',
    'data-test',
    'data-cy',
    'data-test-id',
    'data-qa',
    'data-automation-id',
  ]

  // 稳定属性（可用于选择器）
  const STABLE_ATTRS = new Set([
    'type',
    'role',
    'aria-role',
    'data-type',
    'data-role',
    'data-kind',
    'data-variant',
    'data-size',
    'data-id',
    'name',
    'placeholder',
    'lang',
    'dir',
    'target',
    'rel',
    'colspan',
    'rowspan',
    'scope',
    'disabled',
    'readonly',
    'required',
    'checked',
    'multiple',
    'selected',
  ])

  // 跳过的属性
  const SKIP_ATTRS = new Set([
    'data-ep-selected',
    'data-ep-uid',
    'data-element-picker-uid',
    'class',
    'id',
    'style',
    'aria-label',
    'aria-describedby',
    'aria-labelledby',
    'title',
    'alt',
    'placeholder',
    'value',
    'href',
    'src',
    'data-tooltip',
    'onclick',
    'onchange',
    'onsubmit',
    'onfocus',
    'onblur',
    'onhover',
  ])

  // ========== 辅助函数 ==========

  /**
   * 检查 ID 是否有效
   */
  function hasValidId(node) {
    return node && node.id && !node.id.includes(' ') && !/^\d/.test(node.id)
  }

  /**
   * 获取有效的 class 列表
   */
  function getValidClasses(node) {
    if (!node.className || typeof node.className !== 'string') return []
    return node.className
      .trim()
      .split(' ')
      .filter((c) => {
        if (!c || /^[0-9]/.test(c)) return false
        // 过滤动态生成的 class
        if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_|ng-|React|react|vue-|v-)/.test(c))
          return false
        if (c.length > 40) return false
        return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)
      })
  }

  /**
   * 获取有效属性列表
   */
  function getValidAttributes(node, forMerge = false) {
    if (!node.attributes) return []
    const attrs = []
    for (const attr of node.attributes) {
      if (SKIP_ATTRS.has(attr.name)) continue
      if (!attr.value || attr.value.length > 80) continue
      if (/^\d+$/.test(attr.value)) continue
      // 如果是用于合并，只允许确定性属性
      if (forMerge && !STABLE_ATTRS.has(attr.name) && !TEST_ATTRS.includes(attr.name)) continue
      attrs.push({ name: attr.name, value: attr.value })
    }
    // 按优先级排序：测试属性 > 稳定属性 > 其他
    attrs.sort((a, b) => {
      const aIsTest = TEST_ATTRS.includes(a.name) ? 0 : 1
      const bIsTest = TEST_ATTRS.includes(b.name) ? 0 : 1
      if (aIsTest !== bIsTest) return aIsTest - bIsTest
      const aIsStable = STABLE_ATTRS.has(a.name) ? 0 : 1
      const bIsStable = STABLE_ATTRS.has(b.name) ? 0 : 1
      return aIsStable - bIsStable
    })
    return attrs
  }

  /**
   * 获取 nth-child 索引
   */
  function getNthChild(node) {
    const parent = node.parentElement
    if (!parent) return 0
    const siblings = Array.from(parent.children)
    return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0
  }

  /**
   * 获取 nth-of-type 索引
   */
  function getNthOfType(node) {
    const parent = node.parentElement
    if (!parent) return 0
    const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName)
    return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0
  }

  /**
   * 测试选择器
   */
  function testSelector(sel) {
    try {
      return document.querySelectorAll(sel)
    } catch {
      return []
    }
  }

  /**
   * 检查是否精确匹配
   */
  function isExactMatch(sel, target) {
    const found = testSelector(sel)
    return found.length === 1 && found[0] === target
  }

  /**
   * 测试选择器结果（返回匹配数量和是否包含目标）
   */
  function testSelectorResult(sel, target) {
    try {
      const found = testSelector(sel)
      return { count: found.length, contains: Array.from(found).includes(target) }
    } catch {
      return { count: Infinity, contains: false }
    }
  }

  // ========== 单元素选择器生成 ==========

  /**
   * 为单个元素生成 CSS 选择器
   * 使用多策略 BFS 算法，确保返回最短且精确的选择器
   */
  function generateSelector(element) {
    if (!element || !element.tagName) return ''
    if (element === document.body) return 'body'
    if (element === document.documentElement) return 'html'

    const tag = element.tagName.toLowerCase()
    const classes = getValidClasses(element)
    const attrs = getValidAttributes(element)
    const nthChild = getNthChild(element)
    const nthOfType = getNthOfType(element)

    // === BFS 候选选择器队列 ===
    const candidates = []

    // === Level 1: 最简单的选择器 ===

    // 1.1 测试属性（最高优先级）
    for (const testAttr of TEST_ATTRS) {
      const attr = attrs.find((a) => a.name === testAttr)
      if (attr) {
        candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
        candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
      }
    }

    // 1.2 ID（如果存在且有效）
    if (hasValidId(element)) {
      candidates.push('#' + CSS.escape(element.id))
    }

    // 1.3 role 属性
    const roleAttr = attrs.find((a) => a.name === 'role')
    if (roleAttr) {
      candidates.push(tag + '[role="' + CSS.escape(roleAttr.value) + '"]')
    }

    // 1.4 单个 class
    for (const cls of classes) {
      candidates.push('.' + CSS.escape(cls))
      candidates.push(tag + '.' + CSS.escape(cls))
    }

    // 1.5 其他属性
    for (const attr of attrs.slice(0, 3)) {
      if (!TEST_ATTRS.includes(attr.name) && attr.name !== 'role') {
        candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
        candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
      }
    }

    // 测试 Level 1
    for (const sel of candidates) {
      if (isExactMatch(sel, element)) return sel
    }

    // === Level 2: 双 class 组合 ===
    if (classes.length >= 2) {
      candidates.push(
        tag +
          '.' +
          classes
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join('.')
      )
      candidates.push(
        '.' +
          classes
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join('.')
      )

      for (let i = candidates.length - 2; i < candidates.length; i++) {
        if (isExactMatch(candidates[i], element)) return candidates[i]
      }
    }

    // === Level 3: class + 属性组合 ===
    if (classes.length > 0 && attrs.length > 0) {
      for (const cls of classes.slice(0, 2)) {
        for (const attr of attrs.slice(0, 2)) {
          const sel =
            tag +
            '.' +
            CSS.escape(cls) +
            '[' +
            CSS.escape(attr.name) +
            '="' +
            CSS.escape(attr.value) +
            '"]'
          candidates.push(sel)
          if (isExactMatch(sel, element)) return sel
        }
      }
    }

    // === Level 4: 多 class 组合（3个） ===
    if (classes.length >= 3) {
      const sel =
        tag +
        '.' +
        classes
          .slice(0, 3)
          .map((c) => CSS.escape(c))
          .join('.')
      if (isExactMatch(sel, element)) return sel
    }

    // === Level 5: 带 nth-of-type / nth-child ===
    if (nthOfType > 0) {
      const sel = tag + ':nth-of-type(' + nthOfType + ')'
      candidates.push(sel)
      if (isExactMatch(sel, element)) return sel
    }

    if (nthChild > 0) {
      const sel = tag + ':nth-child(' + nthChild + ')'
      candidates.push(sel)
      if (isExactMatch(sel, element)) return sel
    }

    // class + nth-of-type
    if (classes.length > 0 && nthOfType > 0) {
      const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-of-type(' + nthOfType + ')'
      if (isExactMatch(sel, element)) return sel
    }

    // === Level 6: 构建路径 ===
    const path = buildPath(element, 5)
    const selector = path.join(' > ')
    if (isExactMatch(selector, element)) return selector

    // 尝试增强路径
    const result = testSelectorResult(selector, element)
    if (result.contains && result.count > 1) {
      // 尝试添加更多细节
      const lastPart = path[path.length - 1]
      if (classes.length > 1 && !lastPart.includes(':nth')) {
        const enhancedPath = [...path]
        enhancedPath[enhancedPath.length - 1] =
          tag +
          '.' +
          classes
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join('.')
        const enhancedSel = enhancedPath.join(' > ')
        if (isExactMatch(enhancedSel, element)) return enhancedSel
      }
    }

    return selector
  }

  /**
   * 构建元素路径
   */
  function buildPath(startNode, maxDepth = 6) {
    const path = []
    let cur = startNode
    let depth = 0

    while (cur && depth < maxDepth) {
      const t = cur.tagName.toLowerCase()

      // 遇到有 ID 的祖先就停止
      if (hasValidId(cur) && cur !== startNode) {
        path.unshift('#' + CSS.escape(cur.id))
        break
      }

      const c = getValidClasses(cur)
      const curNth = getNthOfType(cur)
      const curAttrs = cur === startNode ? getValidAttributes(cur) : getValidAttributes(cur, true)

      // 构建当前节点的选择器部分
      let part = t
      if (c.length > 0) {
        part += '.' + CSS.escape(c[0])
      } else if (curAttrs.length > 0) {
        // 优先使用测试属性
        const testAttr = curAttrs.find((a) => TEST_ATTRS.includes(a.name))
        if (testAttr) {
          part += '[' + CSS.escape(testAttr.name) + '="' + CSS.escape(testAttr.value) + '"]'
        } else {
          part += '[' + CSS.escape(curAttrs[0].name) + '="' + CSS.escape(curAttrs[0].value) + '"]'
        }
      } else if (curNth > 0 && cur !== startNode) {
        part += ':nth-of-type(' + curNth + ')'
      }

      path.unshift(part)

      if (cur === document.documentElement) break
      cur = cur.parentElement
      depth++
    }

    return path
  }

  // ========== 批量选择器生成（高级模式） ==========

  /**
   * 为多个元素生成合并选择器
   * 支持 DEFAULT_HIDE_SELECTORS 的高级模式
   */
  function generateBatchSelector(elements) {
    if (!elements || elements.length === 0) return ''
    if (elements.length === 1) return generateSelector(elements[0])

    // 提取共同特征
    const common = findCommonFeatures(elements)

    // 尝试各种高级策略
    const candidates = []

    // 策略 1: 共同 tag + :nth-child(n):not(:nth-child(X))
    const nthChildPattern = tryNthChildPattern(elements, common)
    if (nthChildPattern) candidates.push(nthChildPattern)

    // 策略 2: 共同祖先 + 子选择器 + :not()
    const ancestorNotPattern = tryAncestorNotPattern(elements, common)
    if (ancestorNotPattern) candidates.push(...ancestorNotPattern)

    // 策略 3: 兄弟选择器 + 任意元素 (+*)
    const siblingPattern = trySiblingPattern(elements, common)
    if (siblingPattern) candidates.push(...siblingPattern)

    // 策略 4: 属性包含选择器 [class*="xxx"]
    const attrContainsPattern = tryAttrContainsPattern(elements, common)
    if (attrContainsPattern) candidates.push(...attrContainsPattern)

    // 策略 5: :is() 多选一
    const isPattern = tryIsPattern(elements, common)
    if (isPattern) candidates.push(isPattern)

    // 策略 6: 共同类名组合
    const classPattern = tryClassPattern(elements, common)
    if (classPattern) candidates.push(...classPattern)

    // 按精确度和长度排序
    candidates.sort((a, b) => {
      // 优先精确匹配
      const aExact = a.matchCount === elements.length
      const bExact = b.matchCount === elements.length
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      // 其次按长度
      return a.selector.length - b.selector.length
    })

    // 返回最佳选择器
    if (candidates.length > 0 && candidates[0].matchCount === elements.length) {
      return candidates[0].selector
    }

    // 降级：使用逗号分隔
    return elements.map((el) => generateSelector(el)).join(', ')
  }

  /**
   * 提取共同特征
   */
  function findCommonFeatures(elements) {
    const common = {
      tag: null,
      classes: [],
      attributes: [],
      parent: null,
      ancestor: null,
    }

    // 共同 tag
    const tags = new Set(elements.map((el) => el.tagName.toLowerCase()))
    common.tag = tags.size === 1 ? [...tags][0] : null

    // 共同 class
    const allClasses = elements.map((el) => new Set(getValidClasses(el)))
    if (allClasses.length > 0) {
      common.classes = [...allClasses[0]].filter((cls) => allClasses.every((set) => set.has(cls)))
    }

    // 共同属性
    const allAttrs = elements.map((el) => {
      const attrs = getValidAttributes(el, true)
      return new Map(attrs.map((a) => [a.name, a.value]))
    })
    if (allAttrs.length > 0) {
      for (const [name, value] of allAttrs[0]) {
        if (allAttrs.every((map) => map.get(name) === value)) {
          common.attributes.push({ name, value })
        }
      }
    }

    // 共同父元素
    const parents = new Set(elements.map((el) => el.parentElement))
    common.parent = parents.size === 1 ? [...parents][0] : null

    // 共同祖先（向上查找）
    common.ancestor = findCommonAncestor(elements)

    return common
  }

  /**
   * 找出共同祖先
   */
  function findCommonAncestor(elements) {
    if (elements.length === 0) return null

    // 获取第一个元素的祖先链
    const firstAncestors = []
    let cur = elements[0].parentElement
    while (cur && cur !== document.documentElement) {
      firstAncestors.push(cur)
      cur = cur.parentElement
    }

    // 找出所有元素共有的最深祖先
    for (const ancestor of firstAncestors) {
      if (elements.every((el) => ancestor.contains(el))) {
        return ancestor
      }
    }

    return document.body
  }

  /**
   * 策略 1: :nth-child(n):not(:nth-child(X)) 模式
   * 选择所有子元素但排除特定位置
   */
  function tryNthChildPattern(elements, common) {
    if (!common.parent) return null

    const parent = common.parent
    const allChildren = Array.from(parent.children)
    const elementSet = new Set(elements)

    // 检查是否所有元素都是同一父元素的子元素
    if (!elements.every((el) => el.parentElement === parent)) return null

    // 找出未被选中的子元素索引
    const notSelected = allChildren.filter((c) => !elementSet.has(c))

    // 如果排除的数量少于选中的数量，使用 :not() 模式
    if (notSelected.length === 0 || notSelected.length >= elements.length) return null
    if (notSelected.length > 5) return null // 太多排除项，不划算

    const tag = common.tag
    if (!tag) return null

    // 构建 :not(:nth-child(X)) 链
    const notIndices = notSelected
      .filter((c) => c.tagName.toLowerCase() === tag)
      .map((c) => allChildren.indexOf(c) + 1)
      .sort((a, b) => a - b)

    if (notIndices.length === 0) return null

    const notChain = notIndices.map((i) => ':not(:nth-child(' + i + '))').join('')

    // 构建选择器
    const selectors = []

    // .class:nth-child(n):not(:nth-child(X))
    for (const cls of common.classes.slice(0, 2)) {
      const sel = '.' + CSS.escape(cls) + ':nth-child(n)' + notChain
      const matchCount = testSelector(sel).length
      selectors.push({ selector: sel, matchCount })
    }

    // tag:nth-child(n):not(:nth-child(X))
    const sel = tag + ':nth-child(n)' + notChain
    const matchCount = testSelector(sel).length
    selectors.push({ selector: sel, matchCount })

    // 返回最佳结果
    const exact = selectors.filter((s) => s.matchCount === elements.length)
    if (exact.length > 0) {
      return exact.sort((a, b) => a.selector.length - b.selector.length)[0].selector
    }

    return selectors.sort((a, b) => a.selector.length - b.selector.length)[0].selector
  }

  /**
   * 策略 2: 共同祖先 + 子选择器 + :not()
   */
  function tryAncestorNotPattern(elements, common) {
    const results = []
    const ancestor = common.ancestor
    if (!ancestor || ancestor === document.body) return results

    // 生成祖先选择器
    const ancestorSel = generateSelector(ancestor)
    if (!ancestorSel) return results

    const tag = common.tag || '*'

    // 尝试不同的后代选择器模式
    const patterns = []

    // 模式 1: ancestor > tag:not(:last-child)
    patterns.push(tag + ':not(:last-child)')
    patterns.push(tag + ':not(:first-child)')

    // 模式 2: ancestor > tag:not(.excluded-class)
    if (common.classes.length > 0) {
      const elementClasses = new Set()
      const nonElementClasses = new Set()

      // 收集选中元素的 class
      for (const el of elements) {
        for (const cls of getValidClasses(el)) {
          elementClasses.add(cls)
        }
      }

      // 收集未选中兄弟元素的 class
      const allSiblings = Array.from(ancestor.querySelectorAll(tag))
      for (const sib of allSiblings) {
        if (!elements.includes(sib)) {
          for (const cls of getValidClasses(sib)) {
            if (!elementClasses.has(cls)) {
              nonElementClasses.add(cls)
            }
          }
        }
      }

      // 使用 :not(.class) 排除
      if (nonElementClasses.size > 0 && nonElementClasses.size <= 3) {
        const notClasses = [...nonElementClasses].slice(0, 2)
        for (const commonCls of common.classes) {
          const notChain = notClasses.map((c) => ':not(.' + CSS.escape(c) + ')').join('')
          patterns.push(tag + '.' + CSS.escape(commonCls) + notChain)
        }
      }
    }

    // 测试所有模式
    for (const pattern of patterns) {
      const sel = ancestorSel + ' > ' + pattern
      const matchCount = testSelector(sel).length
      results.push({ selector: sel, matchCount })
    }

    return results
  }

  /**
   * 策略 3: 兄弟选择器 + 任意元素 (+*)
   */
  function trySiblingPattern(elements, common) {
    const results = []

    // 检查元素是否都是某个元素的后一个兄弟
    const prevSiblings = new Set()
    for (const el of elements) {
      const prev = el.previousElementSibling
      if (prev) {
        prevSiblings.add(prev)
      }
    }

    // 如果所有元素都有相同的前一个兄弟模式
    if (prevSiblings.size <= 3) {
      for (const prev of prevSiblings) {
        const prevSel = generateSelector(prev)
        if (!prevSel) continue

        // prev + * (任意下一个兄弟)
        const sel1 = prevSel + ' + *'
        const matchCount1 = testSelector(sel1).length
        results.push({ selector: sel1, matchCount: matchCount1 })

        // prev + tag
        if (common.tag) {
          const sel2 = prevSel + ' + ' + common.tag
          const matchCount2 = testSelector(sel2).length
          results.push({ selector: sel2, matchCount: matchCount2 })
        }

        // prev + .class
        for (const cls of common.classes.slice(0, 2)) {
          const sel3 = prevSel + ' + .' + CSS.escape(cls)
          const matchCount3 = testSelector(sel3).length
          results.push({ selector: sel3, matchCount: matchCount3 })
        }
      }
    }

    return results
  }

  /**
   * 策略 4: 属性包含选择器 [class*="xxx"]
   */
  function tryAttrContainsPattern(elements, common) {
    const results = []

    // 找出所有元素 class 中的共同子串
    const allClasses = elements.map((el) => {
      const classes = getValidClasses(el)
      return classes
    })

    if (allClasses.some((c) => c.length === 0)) return results

    // 找出共同的 class 前缀/后缀/子串
    const firstClasses = allClasses[0]
    for (const cls of firstClasses) {
      // 尝试不同长度的子串
      for (let len = Math.min(cls.length, 6); len >= 3; len--) {
        for (let start = 0; start <= cls.length - len; start++) {
          const substr = cls.substring(start, start + len)

          // 检查是否所有元素都有包含此子串的 class
          const allHave = elements.every((el) => {
            return getValidClasses(el).some((c) => c.includes(substr))
          })

          if (allHave) {
            const sel = '[' + CSS.escape('class') + '*="' + CSS.escape(substr) + '"]'
            const matchCount = testSelector(sel).length
            results.push({ selector: sel, matchCount })

            // 加上 tag
            if (common.tag) {
              const sel2 = common.tag + sel
              const matchCount2 = testSelector(sel2).length
              results.push({ selector: sel2, matchCount: matchCount2 })
            }
          }
        }
      }
    }

    return results
  }

  /**
   * 策略 5: :is() 多选一
   */
  function tryIsPattern(elements, common) {
    if (elements.length > 10) return null // 太多元素，:is() 会太长

    // 为每个元素生成简短选择器
    const sels = []
    for (const el of elements) {
      const sel = generateShortSelector(el)
      if (sel) sels.push(sel)
    }

    if (sels.length !== elements.length) return null

    // 构建 :is() 选择器
    const isSel = ':is(' + sels.join(', ') + ')'
    const matchCount = testSelector(isSel).length

    return { selector: isSel, matchCount }
  }

  /**
   * 生成简短选择器（用于 :is() 内部）
   */
  function generateShortSelector(element) {
    const tag = element.tagName.toLowerCase()
    const classes = getValidClasses(element)

    // 只返回最简形式
    if (classes.length > 0) {
      return tag + '.' + CSS.escape(classes[0])
    }

    const attrs = getValidAttributes(element, true)
    if (attrs.length > 0) {
      return tag + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]'
    }

    return tag
  }

  /**
   * 策略 6: 共同类名组合
   */
  function tryClassPattern(elements, common) {
    const results = []

    if (common.classes.length === 0) return results

    const tag = common.tag || ''

    // 单 class
    for (const cls of common.classes) {
      const sel = tag ? tag + '.' + CSS.escape(cls) : '.' + CSS.escape(cls)
      const matchCount = testSelector(sel).length
      results.push({ selector: sel, matchCount })
    }

    // 双 class
    if (common.classes.length >= 2) {
      const sel =
        tag +
        '.' +
        common.classes
          .slice(0, 2)
          .map((c) => CSS.escape(c))
          .join('.')
      const matchCount = testSelector(sel).length
      results.push({ selector: sel, matchCount })
    }

    // class + 属性
    if (common.classes.length > 0 && common.attributes.length > 0) {
      const sel =
        tag +
        '.' +
        CSS.escape(common.classes[0]) +
        '[' +
        CSS.escape(common.attributes[0].name) +
        '="' +
        CSS.escape(common.attributes[0].value) +
        '"]'
      const matchCount = testSelector(sel).length
      results.push({ selector: sel, matchCount })
    }

    return results
  }

  // ========== 导出 ==========

  window.AdvancedSelectorGenerator = {
    generateSelector,
    generateBatchSelector,
    findCommonFeatures,
    // 辅助函数也导出，方便测试
    getValidClasses,
    getValidAttributes,
    testSelector,
    isExactMatch,
  }
})()
