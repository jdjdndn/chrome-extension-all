// 键盘快捷操作（devtools 面板）
// Space(短按): 点击 | Space(长按): 选文本 | X: 右击
(function () {
  'use strict'
  let mouseX = 0,
    mouseY = 0
  let spaceHeld = false
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
          e.stopImmediatePropagation()
          if (!spaceHeld && !spaceTimer) {
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
    let current = el
    for (let i = 0; i < 6 && current && current !== document.body; i++) {
      try {
        const style = getComputedStyle(current)
        const zIndex = parseInt(style.zIndex, 10) || 0
        const isFixed = style.position === 'fixed'

        if (isFixed && zIndex > 1000) {
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

        // 非 fixed 定位的元素：class 名匹配不足以判定为预览模态框
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
      // 坐标校验：确保 (x, y) 真正在元素边界内
      try {
        const rect = current.getBoundingClientRect()
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          current = current.parentElement
          continue
        }

        const style = getComputedStyle(current)
        const zIndex = parseInt(style.zIndex, 10) || 0
        const isHighZ = zIndex > 1000
        const pos = style.position
        const isFixedOrAbsolute = pos === 'fixed' || pos === 'absolute'

        // class/id 匹配仅在 fixed/absolute 定位下作为有效信号
        const className =
          current.className && typeof current.className === 'string' ? current.className : ''
        const id = current.id || ''
        const classNameMatch =
          isFixedOrAbsolute && patterns.some((p) => p.test(className) || p.test(id))

        // fixed 全屏容器 + 高 z-index = 最高优先级遮罩
        if (style.position === 'fixed' && isHighZ) {
          if (rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8) {
            candidates.push({ el: current, priority: -2, zIndex })
            current = current.parentElement
            continue
          }
        }

        const isClickable = style.cursor === 'pointer' || current.hasAttribute?.('onclick')

        if (classNameMatch || isClickable) {
          const priority = isHighZ ? -1 : classNameMatch ? 1 : 2
          candidates.push({ el: current, priority, zIndex })
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

    let current = el
    for (let i = 0; i < 5 && current && current !== document.body; i++) {
      try {
        const style = getComputedStyle(current)
        const zIndex = parseInt(style.zIndex, 10) || 0
        const pos = style.position
        const isFixedOrAbsolute = pos === 'fixed' || pos === 'absolute'

        if (isFixedOrAbsolute && zIndex > 1000) {
          const bg = style.backgroundColor
          const hasDarkBg = bg.includes('rgba(0, 0, 0') || bg.includes('rgba(0,0,0')
          const rect = current.getBoundingClientRect()
          const inBounds = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
          const isLarge =
            rect.width >= window.innerWidth * 0.5 && rect.height >= window.innerHeight * 0.5

          if (hasDarkBg && inBounds && isLarge) {
            return true
          }

          // class/id 匹配仅在 fixed/absolute + 高 z-index 下作辅助信号
          const patterns = [
            /mask/i,
            /overlay/i,
            /backdrop/i,
            /modal/i,
            /dialog/i,
            /lightbox/i,
            /preview/i,
          ]
          const className =
            current.className && typeof current.className === 'string' ? current.className : ''
          const id = current.id || ''
          if (patterns.some((p) => p.test(className) || p.test(id))) {
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
    e.stopImmediatePropagation()

    // 优先使用原生 click() 方法（行为最接近真实点击）
    // 对于某些特殊元素（如 video controls、shadow dom 内部），原生方法更可靠
    if (typeof el.click === 'function') {
      try {
        el.click()
        return
      } catch (_) {
        // 原生方法失败时回退到合成事件
      }
    }

    // 完整的标准鼠标事件属性，行为与真实点击完全一致
    const eventProps = {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      screenX: mouseX + window.screenX,
      screenY: mouseY + window.screenY,
      clientX: mouseX,
      clientY: mouseY,
      button: 0,
      buttons: 1,
      ctrlKey: e.ctrlKey || false,
      altKey: e.altKey || false,
      shiftKey: e.shiftKey || false,
      metaKey: e.metaKey || false,
      relatedTarget: null,
    }

    // 指针事件（现代网站依赖）
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(
        new PointerEvent('pointerover', {
          ...eventProps,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        })
      )
      el.dispatchEvent(
        new PointerEvent('pointerenter', {
          ...eventProps,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        })
      )
      el.dispatchEvent(
        new PointerEvent('pointerdown', {
          ...eventProps,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        })
      )
    }

    // 标准鼠标事件
    el.dispatchEvent(new MouseEvent('mouseover', eventProps))
    el.dispatchEvent(new MouseEvent('mouseenter', eventProps))
    el.dispatchEvent(new MouseEvent('mousedown', eventProps))

    // 模拟真实点击的时间间隔（避免某些网站的防机器人检测）
    setTimeout(() => {
      if (!el.isConnected) {
        return
      }

      const upProps = { ...eventProps, buttons: 0 }

      el.dispatchEvent(new MouseEvent('mouseup', upProps))
      el.dispatchEvent(new MouseEvent('click', upProps))

      if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(
          new PointerEvent('pointerup', {
            ...upProps,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          })
        )
      }
    }, 10)
  }

  function doRightClick(e) {
    const el = findClickTarget(mouseX, mouseY)
    if (!el || !el.isConnected) {
      return
    }
    e.preventDefault()
    e.stopImmediatePropagation()

    // 完整的标准右键事件属性，行为与真实点击完全一致
    const eventProps = {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      screenX: mouseX + window.screenX,
      screenY: mouseY + window.screenY,
      clientX: mouseX,
      clientY: mouseY,
      button: 2,
      buttons: 2,
      ctrlKey: e.ctrlKey || false,
      altKey: e.altKey || false,
      shiftKey: e.shiftKey || false,
      metaKey: e.metaKey || false,
      relatedTarget: null,
    }

    el.dispatchEvent(new MouseEvent('contextmenu', eventProps))
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
    } catch (_) {
      /* empty */
    }
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
