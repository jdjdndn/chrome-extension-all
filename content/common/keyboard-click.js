// 通用脚本：键盘快捷操作
// @match *://*/*
// 功能：
//   Space(短按) — 点击悬停元素
//   Space(长按) — 从鼠标位置开始选文本，移动鼠标扩展，松开确认复制
//   X      — 右击悬停元素

'use strict'

if (window.KeyboardClickLoaded) {
  console.log('[键盘操作] 已加载，跳过')
} else if (!window.getScriptSwitch || !window.getScriptSwitch('keyboard-click')) {
  console.log('[键盘操作] 已禁用')
} else {
  window.KeyboardClickLoaded = true

  class KeyboardClicker {
    constructor() {
      this.hoveredEl = null
      this.observer = null
      // 鼠标精确坐标（用于文本选择）
      this.mouseX = 0
      this.mouseY = 0
      // 空格键文本选择
      this.spaceHeld = false
      this.spaceDownTime = 0
      this.selectAnchor = null // Range：按住空格时的起始位置
      this.selectTooltip = null
      this.spaceTimer = null // 长按定时器
      // 长按阈值（毫秒）
      this.LONG_PRESS_THRESHOLD = 300

      // 保存事件监听器引用，用于 destroy 时移除
      this._boundMouseOver = (e) => {
        this.hoveredEl = e.target
      }
      this._boundMouseOut = (e) => {
        if (!e.relatedTarget) {
          this.hoveredEl = null
        }
      }
      this._boundMouseMove = (e) => {
        this.mouseX = e.clientX
        this.mouseY = e.clientY
        if (this.spaceHeld) {
          this._extendSelectionTo(e.clientX, e.clientY)
        }
      }
      this._boundKeyDown = (e) => this._handleKeyDown(e)
      this._boundKeyUp = (e) => this._handleKeyUp(e)

      this._init()
    }

    _init() {
      this._bindMouse()
      this._bindKeyboard()
      this._startObserver()
      console.log('[键盘操作] 已初始化 — Space(短按):点击, Space(长按):选文本, X:右击')
    }

    // ========== 深度元素查找（穿透 Shadow DOM）==========
    /**
     * 递归穿透 shadow root，获取 (x, y) 坐标处最深层的元素。
     * document.elementFromPoint 只返回 shadow host，不会深入 shadow root 内部。
     */
    _deepElementFromPoint(x, y) {
      let el = document.elementFromPoint(x, y)
      if (!el) {
        return null
      }
      // 递归穿透所有嵌套 shadow root
      let maxDepth = 20 // 防止无限循环
      while (el && el.shadowRoot && maxDepth-- > 0) {
        const inner = el.shadowRoot.elementFromPoint(x, y)
        if (!inner || inner === el) {
          break
        }
        el = inner
      }
      return el
    }

    // ========== 鼠标追踪 ==========
    _bindMouse() {
      document.addEventListener('mouseover', this._boundMouseOver, true)
      document.addEventListener('mouseout', this._boundMouseOut, true)
      document.addEventListener('mousemove', this._boundMouseMove, true)
    }

    // ========== 键盘 ==========
    _bindKeyboard() {
      document.addEventListener('keydown', this._boundKeyDown, true)
      document.addEventListener('keyup', this._boundKeyUp, true)
    }

    _handleKeyDown(e) {
      if (this._isComboKey(e)) {
        return
      }
      if (this._isInputFocused()) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          e.stopImmediatePropagation()
          if (!this.spaceHeld && !this.spaceTimer) {
            this.spaceDownTime = Date.now()
            this.spaceTimer = setTimeout(() => {
              this._startTextSelection()
              this.spaceTimer = null
            }, this.LONG_PRESS_THRESHOLD)
          }
          break

        case 'x':
        case 'X':
          if (!this.spaceHeld) {
            this._doRightClick(e)
          }
          break

        case 'Escape':
          if (this.spaceHeld) {
            this._cancelSelect()
          }
          break
      }
    }

    _handleKeyUp(e) {
      if (e.key === ' ' && !this._isComboKey(e)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        this._onSpaceUp(e)
      }
    }

    _isInputFocused() {
      const el = document.activeElement
      if (!el) {
        return false
      }
      const tag = el.tagName

      // 基本表单元素
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true
      }

      // contentEditable
      if (el.isContentEditable) {
        return true
      }

      // ARIA 文本框 / 编辑器
      const role = el.getAttribute('role')
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox' || role === 'editor') {
        return true
      }

      // 代码编辑器常见容器（CodeMirror, Monaco, ACE 等）
      if (
        el.closest(
          '.CodeMirror, .monaco-editor, .ace_editor, .cm-editor, .CodeMirror-code, [class*="editor"]'
        )
      ) {
        return true
      }

      // 某些 input type 不拦截（checkbox, radio, submit, button 等）
      if (tag === 'INPUT') {
        const type = (el.type || '').toLowerCase()
        const nonTextTypes = [
          'checkbox',
          'radio',
          'submit',
          'button',
          'reset',
          'image',
          'color',
          'range',
          'file',
        ]
        if (nonTextTypes.includes(type)) {
          return false
        }
        // 文本类 INPUT（text/email/password 等）视为输入焦点
        return true
      }

      return false
    }

    /** 是否为组合键（Ctrl/Cmd/Alt + 字母），这些应该交给浏览器/页面处理 */
    _isComboKey(e) {
      return e.ctrlKey || e.metaKey || e.altKey
    }

    _onSpaceUp(e) {
      // 清除长按定时器
      if (this.spaceTimer) {
        clearTimeout(this.spaceTimer)
        this.spaceTimer = null
        // 定时器未触发 = 短按，执行点击
        // 先清除之前的选择
        window.getSelection().removeAllRanges()
        this._doClick(e)
        return
      }

      if (this.spaceHeld) {
        // 长按松开：复制选中文本
        this.spaceHeld = false
        const sel = window.getSelection()
        const text = sel.toString().trim()

        if (text) {
          navigator.clipboard
            .writeText(text)
            .then(() => {
              this._showHint(`已复制 ${text.length} 字`)
              setTimeout(() => this._hideHint(), 1200)
            })
            .catch(() => {
              this._hideHint()
            })
        } else {
          sel.removeAllRanges()
          this._hideHint()
        }

        this.selectAnchor = null
      }
    }

    _startTextSelection() {
      // 用 caretRangeFromPoint 获取鼠标处的精确文本位置
      const anchor = this._rangeFromPoint(this.mouseX, this.mouseY)
      if (!anchor) {
        // 鼠标下没有文本，不进入选择模式
        return
      }

      this.spaceHeld = true
      this.selectAnchor = anchor

      // 初始选中（光标位置，零宽度）
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(anchor.cloneRange())

      this._showHint('Space:按住移动选文本')
    }

    _extendSelectionTo(clientX, clientY) {
      if (!this.selectAnchor) {
        return
      }

      const focus = this._rangeFromPoint(clientX, clientY)
      if (!focus) {
        return
      }

      try {
        const range = document.createRange()
        const anchor = this.selectAnchor

        // 比较 anchor 和 focus 的文档位置，确保 start < end
        const cmp = anchor.startContainer.compareDocumentPosition(focus.startContainer)
        if (
          cmp & Node.DOCUMENT_POSITION_FOLLOWING ||
          (!cmp && anchor.startOffset < focus.startOffset)
        ) {
          // focus 在 anchor 后面（正常方向）
          range.setStart(anchor.startContainer, anchor.startOffset)
          range.setEnd(focus.startContainer, focus.startOffset)
        } else {
          // focus 在 anchor 前面（反向选择）
          range.setStart(focus.startContainer, focus.startOffset)
          range.setEnd(anchor.startContainer, anchor.startOffset)
        }

        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      } catch (_) {
        // 跨容器等异常，忽略
      }
    }

    /** 用 caretRangeFromPoint 获取像素坐标处的文本 Range */
    _rangeFromPoint(x, y) {
      // Chrome / Edge
      if (document.caretRangeFromPoint) {
        return document.caretRangeFromPoint(x, y)
      }
      // Firefox
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y)
        if (pos) {
          const range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
          range.collapse(true)
          return range
        }
      }
      return null
    }

    _cancelSelect() {
      window.getSelection().removeAllRanges()
      this.spaceHeld = false
      this.selectAnchor = null
      this._hideHint()
    }

    // ========== 查找点击目标 ==========
    /**
     * 查找真正的点击目标：优先选择被覆盖层遮挡的媒体元素（video/audio）。
     * 很多视频播放器在 video 上方覆盖透明 div，elementFromPoint 会返回覆盖层。
     * 这里用 elementsFromPoint 检测是否有媒体元素被遮挡，仅在当前元素非交互元素时切换。
     */
    _findClickTarget(x, y) {
      // 一次获取元素栈，避免多次重复调用 elementsFromPoint
      const elements = document.elementsFromPoint(x, y)
      if (elements.length === 0) {
        return null
      }

      const topEl = elements[0]

      // 核心规则：检查顶层元素是否在预览模态框内
      // 只要在预览内，就禁止穿透到下方的 video，确保空格点击能关闭遮罩
      // 传入坐标校验，防止误触发画中画等小尺寸固定层
      const inPreview = this._isInImagePreviewModal(topEl, x, y)

      // 如果在预览内（无论是图片还是遮罩层），优先找可关闭的父遮罩层
      // 解决空格点击非图片区域无法关闭预览的问题
      // 传入坐标校验，防止误触发画中画等不相关的层
      if (inPreview) {
        const mask = this._findParentMask(topEl, x, y)
        if (mask) {
          return mask
        }
      }

      if (topEl.tagName === 'IMG' && inPreview) {
        // 尝试找到可点击的遮罩父容器，找不到就返回图片本身
        return this._findParentMask(topEl, x, y) || topEl
      }

      // 如果顶层是遮罩/覆盖层，直接返回不穿透（传入坐标校验）
      if (this._isOverlayOrMask(topEl, x, y)) {
        return topEl
      }

      // 已经是媒体元素，直接返回
      if (topEl.tagName === 'VIDEO' || topEl.tagName === 'AUDIO') {
        return topEl
      }

      // 非交互元素 + 下方有被遮挡的媒体元素 → 切换到媒体元素
      if (!this._isInteractiveElement(topEl)) {
        for (let i = 1; i < elements.length; i++) {
          const candidate = elements[i]
          if (candidate.tagName === 'VIDEO' || candidate.tagName === 'AUDIO') {
            return candidate
          }
        }
        // 兜底：elementsFromPoint 无法找到 pointer-events:none 或 shadow DOM 内的 video
        const shadowMedia = this._findMediaByRect(x, y)
        if (shadowMedia) {
          return shadowMedia
        }
      }

      // 返回最上层元素（通过 shadow DOM 穿透后的）
      return this._deepElementFromPoint(x, y) || topEl
    }

    /** 判断元素是否在图片预览/模态框内（带缓存优化 + 坐标校验，排除画中画等小窗） */
    _isInImagePreviewModal(el, x, y) {
      if (!el) {
        return false
      }

      // 模式缓存，避免每次重复创建正则
      if (!this._modalPatterns) {
        this._modalPatterns = [
          /modal/i,
          /dialog/i,
          /lightbox/i,
          /preview/i,
          /gallery/i,
          /viewer/i,
          /mask/i,
          /overlay/i,
        ]
      }

      // 向上查找，检查父元素是否有预览/模态框特征
      let current = el
      for (let i = 0; i < 6 && current && current !== document.body; i++) {
        // 先快速检查 class 和 id（字符串匹配比 getComputedStyle 快得多）
        if (current.className && this._modalPatterns.some((p) => p.test(current.className))) {
          return true
        }
        if (current.id && this._modalPatterns.some((p) => p.test(current.id))) {
          return true
        }

        try {
          const style = getComputedStyle(current)
          // 高 z-index 过滤（> 1000 才是真正的遮罩层，排除画中画等）
          const zIndex = parseInt(style.zIndex, 10) || 0
          if (style.position === 'fixed' && zIndex > 1000) {
            const rect = current.getBoundingClientRect()
            // 坐标校验 + 大尺寸过滤：接近全屏才是真正的遮罩
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
    _findParentMask(el, x, y) {
      if (!el) {
        return null
      }

      let current = el.parentElement
      const maskPatterns = [
        /mask/i,
        /overlay/i,
        /backdrop/i,
        /modal/i,
        /dialog/i,
        /lightbox/i,
        /preview/i,
      ]

      // 收集所有候选父元素，优先返回最匹配的
      const candidates = []

      for (let i = 0; i < 8 && current && current !== document.body; i++) {
        let matched = false

        // 检查 class 和 id
        if (current.className && maskPatterns.some((p) => p.test(current.className))) {
          matched = true
        } else if (current.id && maskPatterns.some((p) => p.test(current.id))) {
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

          // cursor: pointer 或有 onclick 或 匹配模式
          if (style.cursor === 'pointer' || matched || current.hasAttribute?.('onclick')) {
            const priority = isHighZ ? -1 : matched ? 1 : 2
            candidates.push({ el: current, priority, zIndex })
          }

          // fixed 全屏容器 + 高 z-index = 最高优先级遮罩
          if (style.position === 'fixed' && isHighZ) {
            // 接近全屏的固定元素很可能是遮罩容器
            if (rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8) {
              candidates.push({ el: current, priority: -2, zIndex })
            }
          }
        } catch {
          /* getComputedStyle 可能失败 */
        }

        current = current.parentElement
      }

      // 按优先级排序，返回最高优先级的元素
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.priority - b.priority || b.zIndex - a.zIndex)
        return candidates[0].el
      }

      return null
    }

    /** 判断元素是否为遮罩/覆盖层（带坐标校验，排除画中画等小窗），这类元素不应被穿透 */
    _isOverlayOrMask(el, x, y) {
      if (!el) {
        return false
      }

      // 检查常见的遮罩类名/ID
      const maskPatterns = [
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

      // 检查元素本身（最多向上5层）
      let current = el
      for (let i = 0; i < 5 && current && current !== document.body; i++) {
        // 检查 class 和 id
        if (current.className && maskPatterns.some((p) => p.test(current.className))) {
          return true
        }
        if (current.id && maskPatterns.some((p) => p.test(current.id))) {
          return true
        }

        // 检查是否为固定/绝对定位的半透明全屏覆盖层
        const style = getComputedStyle(current)
        // 高 z-index 过滤（> 1000 才是真正的遮罩层，排除画中画等）
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

        current = current.parentElement
      }

      return false
    }

    /**
     * 通过 bounding rect 查找坐标处的媒体元素（兜底方案）。
     * 处理 video/audio 设置了 pointer-events:none 或位于 shadow DOM 内，
     * 导致 elementsFromPoint 无法检测到的情况。
     */
    _findMediaByRect(x, y) {
      const check = (video) => {
        const rect = video.getBoundingClientRect()
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom ? video : null
      }

      // 文档级 video/audio
      for (const media of document.querySelectorAll('video, audio')) {
        const found = check(media)
        if (found) {
          return found
        }
      }

      // shadow DOM 内的 video/audio
      for (const host of document.querySelectorAll('*')) {
        if (host.shadowRoot) {
          for (const media of host.shadowRoot.querySelectorAll('video, audio')) {
            const found = check(media)
            if (found) {
              return found
            }
          }
        }
      }

      return null
    }

    /** 判断元素是否为交互元素（按钮/链接等），交互元素应保留原始点击目标 */
    _isInteractiveElement(el) {
      if (!el) {
        return false
      }

      // 检查元素本身及其祖先元素（向上查找5层）
      let current = el
      const maxDepth = 5
      const tags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']
      const roles = ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch']

      for (let i = 0; i < maxDepth && current && current !== document.body; i++) {
        // 检查标签
        if (tags.includes(current.tagName)) {
          return true
        }
        // 检查 contentEditable
        if (current.isContentEditable) {
          return true
        }
        // 检查 role 属性
        const role = current.getAttribute('role')
        if (role && roles.includes(role)) {
          return true
        }
        // 检查 SVG 内部元素
        if (current.tagName === 'SVG' || current.closest?.('svg')) {
          return true
        }
        // 检查常见的可点击 CSS 类
        if (current.classList?.toString().match(/(btn|button|close|cancel|dismiss|icon)/i)) {
          return true
        }
        // 检查 onclick 属性
        if (current.hasAttribute?.('onclick')) {
          return true
        }
        // 检查 tabindex（可聚焦元素通常可交互）
        if (current.hasAttribute?.('tabindex') && current.getAttribute('tabindex') !== '-1') {
          return true
        }

        current = current.parentElement
      }
      return false
    }

    /** 判断元素是否在 Shadow DOM 内部 */
    _isInShadowDOM(el) {
      let current = el
      while (current && current !== document.body) {
        if (current.parentNode?.host) {
          return true
        } // parentNode.host 表示当前元素在 shadow root 内
        current = current.parentNode
      }
      return false
    }

    // ========== Space 短按点击 ==========
    _doClick(e) {
      // 使用 _findClickTarget 查找真实点击目标（穿透覆盖层找到被遮挡的媒体元素）
      const el = this._findClickTarget(this.mouseX, this.mouseY)
      if (!el || !el.isConnected) {
        return
      }
      e.preventDefault()
      e.stopPropagation()

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

      const clientX = this.mouseX
      const clientY = this.mouseY

      // 完整的标准鼠标事件属性，行为与真实点击完全一致
      const eventProps = {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: clientX + window.screenX,
        screenY: clientY + window.screenY,
        clientX,
        clientY,
        offsetX: clientX - el.getBoundingClientRect().left,
        offsetY: clientY - el.getBoundingClientRect().top,
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

    // ========== X 右击 ==========
    _doRightClick(e) {
      const el = this._findClickTarget(this.mouseX, this.mouseY)
      if (!el || !el.isConnected) {
        return
      }
      e.preventDefault()
      e.stopPropagation()

      // 完整的标准右键事件属性，行为与真实点击完全一致
      const eventProps = {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: this.mouseX + window.screenX,
        screenY: this.mouseY + window.screenY,
        clientX: this.mouseX,
        clientY: this.mouseY,
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

    // ========== 提示 ==========
    _showHint(text) {
      this._hideHint()
      const tip = document.createElement('div')
      tip.textContent = text
      tip.style.cssText =
        'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
        'background:rgba(0,0,0,0.8);color:#fff;padding:4px 12px;border-radius:4px;' +
        'font:12px monospace;z-index:2147483647;pointer-events:none;transition:opacity 0.3s;'
      document.body.appendChild(tip)
      this.selectTooltip = tip
    }

    _hideHint() {
      if (this.selectTooltip) {
        this.selectTooltip.remove()
        this.selectTooltip = null
      }
    }

    // ========== DOM 变化 ==========
    _startObserver() {
      if (typeof DOMUtils === 'undefined') {
        return
      }
      this.observer = DOMUtils.createDebouncedObserver(() => {
        if (this.hoveredEl && !document.body.contains(this.hoveredEl)) {
          this.hoveredEl = null
        }
      }, 300)
      DOMUtils.onBodyReady(() => {
        this.observer.observe(document.body, { childList: true, subtree: true })
      })
    }

    // ========== 销毁 ==========
    destroy() {
      document.removeEventListener('mouseover', this._boundMouseOver, true)
      document.removeEventListener('mouseout', this._boundMouseOut, true)
      document.removeEventListener('mousemove', this._boundMouseMove, true)
      document.removeEventListener('keydown', this._boundKeyDown, true)
      document.removeEventListener('keyup', this._boundKeyUp, true)
      if (this.observer) {
        this.observer.disconnect()
      }
      if (this.spaceTimer) {
        clearTimeout(this.spaceTimer)
        this.spaceTimer = null
      }
      this._cancelSelect()
      this.hoveredEl = null
      window.KeyboardClickLoaded = false
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.keyboardClicker = new KeyboardClicker()
    })
  } else {
    window.keyboardClicker = new KeyboardClicker()
  }
}
