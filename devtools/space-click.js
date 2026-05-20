// 键盘快捷操作（devtools 面板）
// Space(短按): 点击 | Space(长按): 选文本 | X: 右击
(function () {
  'use strict'
  let mouseX = 0,
    mouseY = 0
  let spaceHeld = false
  let spaceDownTime = 0
  let spaceTimer = null
  let selectAnchor = null
  let selectTooltip = null
  const LONG_PRESS_THRESHOLD = 700

  document.body.setAttribute('tabindex', '-1')
  document.body.style.outline = 'none'

  // 鼠标追踪
  document.addEventListener(
    'mousemove',
    (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      if (spaceHeld) {
        extendSelection(e.clientX, e.clientY)
      }
    },
    true
  )

  // 键盘
  window.addEventListener(
    'keydown',
    (e) => {
      const active = document.activeElement
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          // 空格按下时禁用默认事件（防止页面滚动）
          e.preventDefault()
          e.stopPropagation()
          if (!spaceHeld && !spaceTimer) {
            spaceDownTime = Date.now()
            // 设置长按定时器，超时后进入选择模式
            spaceTimer = setTimeout(() => {
              startTextSelection()
              spaceTimer = null
            }, LONG_PRESS_THRESHOLD)
          }
          break
        case 'x':
        case 'X':
          if (!spaceHeld) {
            doRightClick(e)
          }
          break
        case 'Escape':
          if (spaceHeld) {
            cancelSelect()
          }
          break
      }
    },
    true
  )

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === ' ') {
        onSpaceUp(e)
      }
    },
    true
  )

  function onSpaceUp(e) {
    // 清除长按定时器
    if (spaceTimer) {
      clearTimeout(spaceTimer)
      spaceTimer = null
      // 定时器未触发 = 短按，执行点击
      // 先清除之前的选择
      window.getSelection().removeAllRanges()
      doClick(e)
      return
    }

    if (spaceHeld) {
      spaceHeld = false
      const text = window.getSelection().toString().trim()
      if (text) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            showHint('已复制 ' + text.length + ' 字')
            setTimeout(hideHint, 1200)
          })
          .catch(hideHint)
      } else {
        window.getSelection().removeAllRanges()
        hideHint()
      }
      selectAnchor = null
    }
  }

  function startTextSelection() {
    const anchor = rangeFromPoint(mouseX, mouseY)
    if (!anchor) {
      return
    } // 鼠标下没有文本，不进入选择模式

    spaceHeld = true
    selectAnchor = anchor
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(anchor.cloneRange())
    showHint('Space:按住移动选文本')
  }

  // 递归穿透 shadow root，获取坐标处最深层元素
  function deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y)
    if (!el) {
      return null
    }
    let maxDepth = 20
    while (el && el.shadowRoot && maxDepth-- > 0) {
      const inner = el.shadowRoot.elementFromPoint(x, y)
      if (!inner || inner === el) {
        break
      }
      el = inner
    }
    return el
  }

  /** 查找真正的点击目标：优先选择被覆盖层遮挡的媒体元素 */
  function findClickTarget(x, y) {
    const all = document.elementsFromPoint(x, y)
    if (all.length === 0) {
      return null
    }

    const topEl = all[0]

    // 检测是否在图片预览模态框内：无论是图片还是遮罩层都适用
    // 传入坐标校验，防止误触发画中画等小尺寸固定层
    const inPreview = isInImagePreviewModal(topEl, x, y)

    // 如果在预览内，优先找可关闭的父遮罩层（解决空格点击非图片区域无法关闭预览的问题）
    if (inPreview) {
      const mask = findParentMask(topEl, x, y)
      if (mask) {
        return mask
      }
    }

    // 图片预览遮罩检测：如果在预览内，找到可关闭的父容器
    if (topEl.tagName === 'IMG' && inPreview) {
      return findParentMask(topEl, x, y) || topEl
    }

    // 遮罩层本身直接返回（不穿透）- 传入坐标校验
    if (isOverlayOrMask(topEl, x, y)) {
      return topEl
    }

    if (topEl.tagName === 'VIDEO' || topEl.tagName === 'AUDIO') {
      return topEl
    }

    for (const candidate of all) {
      if (candidate.tagName === 'VIDEO' || candidate.tagName === 'AUDIO') {
        if (!isInteractiveElement(topEl)) {
          return candidate
        }
        break
      }
    }
    return deepElementFromPoint(x, y) || topEl
  }

  /** 判断元素是否在图片预览/模态框内（带坐标校验，排除画中画等小窗） */
  function isInImagePreviewModal(el, x, y) {
    if (!el) {
      return false
    }
    const patterns = [
      /modal/i,
      /dialog/i,
      /lightbox/i,
      /preview/i,
      /gallery/i,
      /viewer/i,
      /mask/i,
      /overlay/i,
    ]

    let current = el
    for (let i = 0; i < 6 && current && current !== document.body; i++) {
      // 先快速检查 class 和 id（字符串匹配比 getComputedStyle 快得多）
      if (current.className && patterns.some((p) => p.test(current.className))) {
        return true
      }
      if (current.id && patterns.some((p) => p.test(current.id))) {
        return true
      }

      try {
        const style = getComputedStyle(current)
        // 高 z-index 过滤（> 1000 才是真正的遮罩层，排除画中画等）
        const zIndex = parseInt(style.zIndex, 10) || 0
        if (style.position === 'fixed' && zIndex > 1000) {
          const rect = current.getBoundingClientRect()
          // 坐标校验：确保 (x, y) 真正在元素边界内
          // 尺寸过滤：接近全屏才是真正的遮罩（排除小尺寸画中画）
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom &&
            rect.width >= window.innerWidth * 0.5 &&
            rect.height >= window.innerHeight * 0.5
          ) {
            return true
          }
        }
      } catch {
        /* getComputedStyle 可能失败 */
      }

      current = current.parentElement
    }
    return false
  }

  /** 查找元素的父遮罩层（带坐标校验，防止误触发画中画等层） */
  function findParentMask(el, x, y) {
    if (!el) {
      return null
    }

    const patterns = [
      /mask/i,
      /overlay/i,
      /backdrop/i,
      /modal/i,
      /dialog/i,
      /lightbox/i,
      /preview/i,
    ]
    const candidates = []
    let current = el.parentElement

    for (let i = 0; i < 8 && current && current !== document.body; i++) {
      let matched = false

      if (current.className && patterns.some((p) => p.test(current.className))) {
        matched = true
      } else if (current.id && patterns.some((p) => p.test(current.id))) {
        matched = true
      }

      // 坐标校验：确保 (x, y) 真正在元素边界内
      try {
        const rect = current.getBoundingClientRect()
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          current = current.parentElement
          continue
        }

        const style = getComputedStyle(current)
        // 高 z-index 优先（> 1000 通常是真正的遮罩层）
        const zIndex = parseInt(style.zIndex, 10) || 0
        const isHighZ = zIndex > 1000

        if (style.cursor === 'pointer' || matched || current.hasAttribute?.('onclick')) {
          const priority = isHighZ ? -1 : matched ? 1 : 2
          candidates.push({ el: current, priority, zIndex })
        }

        // fixed 全屏容器 + 高 z-index = 高优先级遮罩
        if (style.position === 'fixed' && isHighZ) {
          if (rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8) {
            candidates.push({ el: current, priority: -2, zIndex })
          }
        }
      } catch {
        /* getComputedStyle 可能失败 */
      }

      current = current.parentElement
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.priority - b.priority || b.zIndex - a.zIndex)
      return candidates[0].el
    }
    return null
  }

  /** 判断元素是否为遮罩/覆盖层（带坐标校验，排除画中画等小窗） */
  function isOverlayOrMask(el, x, y) {
    if (!el) {
      return false
    }
    const patterns = [
      /mask/i,
      /overlay/i,
      /backdrop/i,
      /modal/i,
      /dialog/i,
      /lightbox/i,
      /preview/i,
      /^modal-/i,
      /^overlay-/i,
    ]

    let current = el
    for (let i = 0; i < 5 && current && current !== document.body; i++) {
      // 先快速检查 class 和 id
      if (current.className && patterns.some((p) => p.test(current.className))) {
        return true
      }
      if (current.id && patterns.some((p) => p.test(current.id))) {
        return true
      }

      try {
        const style = getComputedStyle(current)
        // 高 z-index 过滤（> 1000 才是真正的遮罩层）
        const zIndex = parseInt(style.zIndex, 10) || 0
        if ((style.position === 'fixed' || style.position === 'absolute') && zIndex > 1000) {
          const bg = style.backgroundColor
          // 半透明黑色背景 + 坐标在校 + 大尺寸 = 真正的遮罩
          if (bg.includes('rgba(0, 0, 0') || bg.includes('rgba(0,0,0')) {
            const rect = current.getBoundingClientRect()
            if (
              x >= rect.left &&
              x <= rect.right &&
              y >= rect.top &&
              y <= rect.bottom &&
              rect.width >= window.innerWidth * 0.5 &&
              rect.height >= window.innerHeight * 0.5
            ) {
              return true
            }
          }
        }
      } catch {
        /* getComputedStyle 可能失败 */
      }

      current = current.parentElement
    }
    return false
  }

  function isInteractiveElement(el) {
    const tags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']
    if (tags.includes(el.tagName)) {
      return true
    }
    if (el.isContentEditable) {
      return true
    }
    const role = el.getAttribute('role')
    if (['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch'].includes(role)) {
      return true
    }
    return false
  }

  function doClick(e) {
    const el = findClickTarget(mouseX, mouseY)
    if (!el || !el.isConnected) {
      return
    }
    e.preventDefault()
    e.stopPropagation()

    // 使用鼠标实际位置（而非元素中心），确保点击精确位置
    // 这对于进度条等需要精确点击的场景很重要
    const clientX = mouseX
    const clientY = mouseY

    el.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 1,
      })
    )
    el.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 0,
      })
    )
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 0,
      })
    )
  }

  function doRightClick(e) {
    const el = findClickTarget(mouseX, mouseY)
    if (!el || !el.isConnected) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    el.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: mouseX,
        clientY: mouseY,
        button: 2,
        buttons: 2,
      })
    )
  }

  function extendSelection(cx, cy) {
    if (!selectAnchor) {
      return
    }
    const focus = rangeFromPoint(cx, cy)
    if (!focus) {
      return
    }
    try {
      const range = document.createRange()
      const a = selectAnchor
      const cmp = a.startContainer.compareDocumentPosition(focus.startContainer)
      if (cmp & Node.DOCUMENT_POSITION_FOLLOWING || (!cmp && a.startOffset < focus.startOffset)) {
        range.setStart(a.startContainer, a.startOffset)
        range.setEnd(focus.startContainer, focus.startOffset)
      } else {
        range.setStart(focus.startContainer, focus.startOffset)
        range.setEnd(a.startContainer, a.startOffset)
      }
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    } catch (_) {}
  }

  function rangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y)
    }
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y)
      if (pos) {
        const r = document.createRange()
        r.setStart(pos.offsetNode, pos.offset)
        r.collapse(true)
        return r
      }
    }
    return null
  }

  function cancelSelect() {
    window.getSelection().removeAllRanges()
    spaceHeld = false
    selectAnchor = null
    hideHint()
  }

  function showHint(text) {
    hideHint()
    const tip = document.createElement('div')
    tip.textContent = text
    tip.style.cssText =
      'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.8);color:#fff;padding:4px 12px;border-radius:4px;' +
      'font:12px monospace;z-index:2147483647;pointer-events:none;'
    document.body.appendChild(tip)
    selectTooltip = tip
  }

  function hideHint() {
    if (selectTooltip) {
      selectTooltip.remove()
      selectTooltip = null
    }
  }
})()
