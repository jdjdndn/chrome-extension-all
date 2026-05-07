// 通用脚本：页面宽度扩展（智能检测版）
// 不依赖固定选择器，而是自动检测页面上约束宽度的容器并覆盖
// 策略：遍历 DOM，找到有 max-width 且居中显示的元素，将 max-width 调整为目标宽度
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict'

if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'widen-page',
    dependencies: ['DOMUtils'],
    onReady: () => initWidenPage(),
  })
} else {
  initWidenPage()
}

function initWidenPage() {
  if (window.WidenPageLoaded) {
    return
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('widen-page')) {
    return
  }

  window.WidenPageLoaded = true

  const DEFAULT_WIDTH = 80
  const STYLE_ID = 'yc-widen-page-style'
  const STORAGE_KEY = 'widenPageWidth'

  // 需要排除的元素（导航栏、页脚、侧边栏等）
  const EXCLUDE_TAGS = new Set([
    'NAV',
    'HEADER',
    'FOOTER',
    'ASIDE',
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'SVG',
    'IFRAME',
  ])
  // 排除的选择器
  const EXCLUDE_SELECTORS = [
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="search"]',
    '.nav',
    '.navbar',
    '.navigation',
    '.sidebar',
    '.side-bar',
    '.header',
    '.footer',
    '.toolbar',
    '.breadcrumb',
    '.menu',
    '.tabs',
    '.pagination',
  ]

  /**
   * 检测页面上的宽度约束容器
   * 策略：
   * 1. 遍历 body 下的可见块级元素
   * 2. 检查 computedStyle 中是否有 max-width 且值 < 视口宽度
   * 3. 检查是否居中（margin: auto 或 text-align: center 等）
   * 4. 排除导航、页脚、侧边栏等非主体元素
   */
  function detectConstrainingElements() {
    const results = []
    const vw = window.innerWidth

    // 递归遍历，最多 3 层深度（body > div > div > div）
    function scan(root, depth) {
      if (depth > 3) return
      for (const el of root.children) {
        if (el.id === STYLE_ID) continue
        if (EXCLUDE_TAGS.has(el.tagName)) continue
        if (el.offsetParent === null && el.style.position !== 'fixed') continue // 不可见
        if (EXCLUDE_SELECTORS.some((sel) => el.matches(sel))) continue

        const style = getComputedStyle(el)
        const maxWidth = style.maxWidth
        const width = style.width

        // 跳过 display:inline 元素
        if (style.display === 'inline' || style.display === 'none') continue

        // 检查是否有宽度约束
        let hasMaxWidthConstraint = false
        let constraintPx = 0

        if (maxWidth && maxWidth !== 'none') {
          constraintPx = parseFloat(maxWidth)
          if (constraintPx > 0 && constraintPx < vw * 0.95) {
            hasMaxWidthConstraint = true
          }
        }

        // 也检查固定 width 的容器（常见的如 width: 1200px）
        let hasFixedWidth = false
        if (!hasMaxWidthConstraint && width && width !== 'auto') {
          const wPx = parseFloat(width)
          // 固定宽度在 600px~95vw 之间，且居中
          if (wPx > 600 && wPx < vw * 0.95) {
            hasFixedWidth = true
            constraintPx = wPx
          }
        }

        if (hasMaxWidthConstraint || hasFixedWidth) {
          // 检查是否居中
          const isCentered =
            (style.marginLeft === 'auto' && style.marginRight === 'auto') ||
            style.marginLeft === style.marginRight ||
            style.textAlign === 'center'

          // 元素足够宽（至少占视口 40%）说明是主体容器
          const elWidth = el.getBoundingClientRect().width
          const isWideEnough = elWidth > vw * 0.4

          if (isWideEnough) {
            results.push({
              el: el,
              maxWidth: hasMaxWidthConstraint ? maxWidth : null,
              width: hasFixedWidth ? width : null,
              centered: isCentered,
              constraintPx: constraintPx,
              // 用唯一选择器标记
              selector: buildSelector(el),
            })
          }
        }

        // 继续扫描子元素
        scan(el, depth + 1)
      }
    }

    scan(document.body, 0)
    return results
  }

  /**
   * 为元素生成一个简短的唯一选择器
   */
  function buildSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id)
    let path = el.tagName.toLowerCase()
    if (el.className && typeof el.className === 'string') {
      const cls = el.className
        .trim()
        .split(/\s+/)
        .find((c) => c && c.length < 30)
      if (cls) path += '.' + CSS.escape(cls)
    }
    return path
  }

  /**
   * 注入 CSS，覆盖检测到的约束容器
   */
  function inject(width) {
    const elements = detectConstrainingElements()

    if (elements.length === 0) {
      console.log('[通用脚本] 页面宽度扩展：未检测到宽度约束容器')
      return
    }

    // 按 constraintPx 从大到小排序，优先处理最宽的容器（最外层）
    elements.sort((a, b) => b.constraintPx - a.constraintPx)

    // 去重并生成 CSS 规则
    const seen = new Set()
    const rules = []
    for (const item of elements) {
      if (seen.has(item.selector)) continue
      seen.add(item.selector)

      const w = width + 'vw'
      let rule = item.selector + ' { max-width:' + w + '!important;'
      // 如果元素原本有固定 width（非 auto），也覆盖
      if (item.width) {
        rule += 'width:' + w + '!important;'
      }
      // 如果未居中，强制居中
      if (!item.centered) {
        rule += 'margin-left:auto!important;margin-right:auto!important;'
      }
      rule += ' }'
      rules.push(rule)
    }

    const css = rules.join('\n')
    let styleEl = document.getElementById(STYLE_ID)
    if (styleEl) {
      styleEl.textContent = css
    } else {
      styleEl = document.createElement('style')
      styleEl.id = STYLE_ID
      styleEl.textContent = css
      ;(document.head || document.documentElement).appendChild(styleEl)
    }

    console.log(
      '[通用脚本] 页面宽度扩展已生效 (' + width + 'vw)，覆盖 ' + elements.length + ' 个容器:',
      elements.map((e) => e.selector).join(', ')
    )
  }

  function remove() {
    const el = document.getElementById(STYLE_ID)
    if (el) el.remove()
  }

  // 监听来自 popup 的实时宽度更新
  window.addEventListener('yc-widen-page-update', (e) => {
    if (e.detail && e.detail.width) {
      inject(e.detail.width)
    }
  })

  // 监听开关变化
  window.addEventListener('yc-widen-page-toggle', (e) => {
    if (e.detail && e.detail.enabled) {
      loadAndInject()
    } else {
      remove()
    }
  })

  // 清理
  window.addEventListener('beforeunload', remove)

  // 初始注入
  function loadAndInject() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        inject(parseInt(cached, 10) || DEFAULT_WIDTH)
        return
      }
    } catch (e) {}

    if (window.__widenPageWidth) {
      inject(window.__widenPageWidth)
      return
    }

    inject(DEFAULT_WIDTH)
  }

  if (document.head) {
    loadAndInject()
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndInject)
  } else {
    setTimeout(loadAndInject, 50)
  }
}
