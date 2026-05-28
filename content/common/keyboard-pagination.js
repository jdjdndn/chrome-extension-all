// 通用脚本：键盘翻页
// @match *://*/*
// 功能：自动检测页面分页按钮，支持键盘快捷键切换上下页

'use strict'

if (window.KeyboardPaginationLoaded) {
  console.log('[键盘翻页] 已加载，跳过')
} else if (!window.getScriptSwitch || !window.getScriptSwitch('keyboard-pagination')) {
  console.log('[键盘翻页] 已禁用')
} else {
  window.KeyboardPaginationLoaded = true

  class KeyboardPagination {
    constructor() {
      this.prevButton = null
      this.nextButton = null
      this.hintVisible = false
      this.config = {
        // 键盘映射
        prevKeys: ['ArrowLeft', 'a', 'A'],
        nextKeys: ['ArrowRight', 'd', 'D'],
        // 是否需要 Alt 键
        requireAlt: false,
        // 是否需要 Ctrl 键
        requireCtrl: false,
        // 显示提示
        showHint: true,
        // 提示持续时间
        hintDuration: 2000,
      }

      // 常见分页按钮选择器（仅保留语义明确的"分页/章节"标识，避免误把
      // 普通"下一个/上一个"按钮当成翻页）
      this.selectors = {
        prev: [
          // 标准语义
          'a[rel="prev"]',
          'link[rel="prev"]',
          '[class*="prev"]:not([class*="preview"])',
          '[class*="Prev"]:not([class*="Preview"])',
          '[class*="previous"]',
          '[class*="Previous"]',
          '[class*="pre-page"]',
          '[class*="prePage"]',
          '[aria-label*="上一页"]',
          '[aria-label*="Previous"]',
          '[title*="上一页"]',
          '[title*="Previous"]',
          'a:has(.arrow-left)',
          'button:has(.arrow-left)',
          '.pagination-prev',
          '.pager-prev',
          '.page-prev',
          '.prev-page',
          '.prevPage',
          '#prev-page',
          '#prevPage',
          '.ant-pagination-prev',
          '.el-pagination .prev',
          '[data-page="prev"]',
          'nav[aria-label*="pagination"] a:first-child',
          '.layui-laypage-prev',
          '.laypage-prev',
          '.page-pre',
          '.pre',
          '.pre-btn',
          '.btn-pre',
          '.btn-prev',
          '.prev-btn',
          'a.prev',
          'button.prev',
          '.layui-laypage-prev',
          '.laypage-prev',

          // 明确含 "btn" 后缀（class 名而非任意元素）
          '.btn-prev',
          '.prev-btn',

          // 漫画/小说/阅读器章节类
          '.comic-prev',
          '.chapter-prev',
          '.manga-prev',
          '.read-prev',
          '#prevChapter',
          '#prev_chapter',
          '.chapter-nav-prev',
          '.reader-prev',
          '.btn-prev-chapter',
          '.btn-prev-page',

          // 电商
          '.j-prev',
          '.ui-page-prev',
          '.pager .prev',

          // 社交媒体（明确 testid）
          '[data-testid="prev-button"]',
          '[data-testid="pagination-prev"]',
        ],
        next: [
          // 标准语义
          'a[rel="next"]',
          'link[rel="next"]',
          '[aria-label*="下一页"]',
          '[aria-label*="Next"]',
          '[title*="下一页"]',
          '[title*="Next"]',
          '[class*="next"]:not([class*="textarea"])',
          '[class*="Next"]:not([class*="Textarea"])',
          '[class*="next-page"]',
          '[class*="nextPage"]',
          'a:has(.arrow-right)',
          'button:has(.arrow-right)',
          '.pagination-next',
          '.pager-next',
          '.page-next',
          '.next-page',
          '.nextPage',
          '#next-page',
          '#nextPage',
          '.ant-pagination-next',
          '.el-pagination .next',
          '[data-page="next"]',
          'nav[aria-label*="pagination"] a:last-child',
          '.layui-laypage-next',
          '.laypage-next',
          // 中文网站
          '.page-next',
          '.next',
          '.next-btn',
          '.btn-next',
          'a.next',
          'button.next',

          // 明确含 "btn" 后缀
          '.btn-next',
          '.next-btn',

          // 漫画/小说/阅读器章节类
          '.comic-next',
          '.chapter-next',
          '.manga-next',
          '.read-next',
          '#nextChapter',
          '#next_chapter',
          '.chapter-nav-next',
          '.reader-next',
          '.btn-next-chapter',
          '.btn-next-page',

          // 电商
          '.j-next',
          '.ui-page-next',
          '.pager .next',

          // 社交媒体
          '[data-testid="next-button"]',
          '[data-testid="pagination-next"]',
        ],
      }

      // 文本匹配模式
      this.textPatterns = {
        prev: [
          '上一页',
          '上一章',
          '上一节',
          '上一篇',
          '上一张',
          '上一幅',
          '上一集',
          '上一期',
          'previous',
          'prev',
          '«',
          '‹',
          '←',
          '<',
          'back',
          'before',
        ],
        next: [
          '下一页',
          '下一章',
          '下一节',
          '下一篇',
          '下一张',
          '下一幅',
          '下一集',
          '下一期',
          'next',
          '»',
          '›',
          '→',
          '>',
          'forward',
        ],
      }

      this.init()
    }

    init() {
      // 分页容器存在性闸：页面上完全没有"分页语义"节点 → 不绑定任何事件、不注入样式。
      // SPA 场景由轻量 popstate/hashchange 兜底（仅重新探测+按需绑定，初次不绑）。
      if (!this.hasPaginationSemantics()) {
        this._setupSPAReinitGuard()
        return
      }

      this.detectPagination()

      // 探测后若仍未找到任一按钮 → 同样不绑全局 keydown。
      if (!this.prevButton && !this.nextButton) {
        this._setupSPAReinitGuard()
        return
      }

      this.bindEvents()
      this.createHint()
      this.injectStyles()

      console.log('[键盘翻页] 检测到分页按钮', {
        prev: this.prevButton ? this.getButtonInfo(this.prevButton) : null,
        next: this.nextButton ? this.getButtonInfo(this.nextButton) : null,
      })
    }

    // 单源真相：闸用 this.selectors 的并集，避免与 detectPagination 出现死路径
    hasPaginationSemantics() {
      try {
        const all = this.selectors.prev.concat(this.selectors.next).join(',')
        if (document.querySelector(all)) {
          return true
        }
      } catch (_e) {
        // 个别站点带不支持的伪类，降级到逐条尝试
        for (const selector of this.selectors.prev.concat(this.selectors.next)) {
          try {
            if (document.querySelector(selector)) {
              return true
            }
          } catch (_e2) {
            /* ignore */
          }
        }
      }
      // 额外探：明确的分页容器（容器存在即视作语义命中）
      const containers = [
        '.pagination',
        '.pager',
        '.fanye', // 中文"翻页"拼音
        '.page-nav',
        '.pagenavi',
        '.ant-pagination',
        '.el-pagination',
        '.layui-laypage',
        'nav[aria-label*="pagination"]',
        'nav[aria-label*="分页"]',
      ]
      for (const selector of containers) {
        try {
          if (document.querySelector(selector)) {
            return true
          }
        } catch (_e) {
          /* ignore */
        }
      }
      return false
    }

    // SPA 兜底：URL 变化 + 一次性 DOM 注入观察（命中即解绑），覆盖
    // "切 Tab 不改 URL，仅注入分页 DOM" 的场景（B站动态、知乎评论分页等）。
    _setupSPAReinitGuard() {
      if (this._spaGuardBound) {
        return
      }
      this._spaGuardBound = true

      const tryReinit = () => {
        if (this._eventsBound) {
          return // 已经绑过事件，无需再走 init
        }
        if (!this.hasPaginationSemantics()) {
          return
        }
        this.detectPagination()
        if (this.prevButton || this.nextButton) {
          this.bindEvents()
          this.createHint()
          this.injectStyles()
          console.log('[键盘翻页] 兜底激活：检测到分页按钮')
        }
      }

      const debounced = () => {
        clearTimeout(this._spaReinitTimer)
        this._spaReinitTimer = setTimeout(tryReinit, 1500)
      }

      this._spaDebounced = debounced
      window.addEventListener('popstate', this._spaDebounced)
      window.addEventListener('hashchange', this._spaDebounced)

      // 一次性 DOM 注入观察：30s TTL，命中 nav/分页类即解绑
      const domTtl = 30000
      const filter = (mutation) => {
        if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
          return false
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) {
            continue
          }
          if (node.tagName === 'NAV') {
            return true
          }
          const cls = node.className && typeof node.className === 'string' ? node.className : ''
          if (/pagination|pager|chapter|reader|laypage/i.test(cls)) {
            return true
          }
          if (node.querySelector?.('nav, [class*="pagination"], [class*="pager"]')) {
            return true
          }
        }
        return false
      }

      const onDOMChange = () => {
        clearTimeout(this._spaReinitTimer)
        this._spaReinitTimer = setTimeout(tryReinit, 800)
      }

      if (window.UnifiedDOMWatcher) {
        this._spaUnsubscribe = window.UnifiedDOMWatcher.subscribe(onDOMChange, {
          priority: window.UnifiedDOMWatcher.Priority.LOW,
          name: 'KeyboardPagination-SPA',
          filter,
        })
      } else {
        this._spaObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (filter(m)) {
              onDOMChange()
              return
            }
          }
        })
        this._spaObserver.observe(document.body, { childList: true, subtree: true })
      }

      // TTL 到期解绑兜底（永驻 MutationObserver 是性能负担）
      setTimeout(() => {
        if (this._spaUnsubscribe) {
          this._spaUnsubscribe()
          this._spaUnsubscribe = null
        }
        if (this._spaObserver) {
          this._spaObserver.disconnect()
          this._spaObserver = null
        }
      }, domTtl)
    }

    detectPagination() {
      // 1) 语义明确的选择器
      this.prevButton = this.findElement('prev')
      this.nextButton = this.findElement('next')

      // 2) 在明确的分页容器内推断（容器本身就是分页语义，可放宽到首/末元素）
      if (!this.prevButton || !this.nextButton) {
        this.detectInPaginationContainer()
      }
      // 已移除：detectByText —— 全站 a/button 文本扫描会把任意"next/上一个"
      // 按钮误判为翻页按钮，导致没有分页组件的页面也响应左右键。
    }

    findElement(type) {
      const selectors = this.selectors[type]
      for (const selector of selectors) {
        try {
          // :has() 选择器 Chrome 105+ 已支持，不再跳过

          const elements = document.querySelectorAll(selector)
          for (const el of elements) {
            if (this.isValidButton(el, type)) {
              return el
            }
          }
        } catch (e) {
          // 选择器不支持，跳过
        }
      }
      return null
    }

    detectInPaginationContainer() {
      // 常见分页容器
      const containerSelectors = [
        '.pagination',
        '.pager',
        '.fanye', // 中文"翻页"拼音
        '.page-nav',
        '.pagenavi',
        '.layui-laypage',
        '.ant-pagination',
        '.el-pagination',
        '[class*="pagination"]',
        '[class*="pager"]',
        'nav[aria-label*="pagination"]',
        'nav[aria-label*="分页"]',
      ]

      for (const selector of containerSelectors) {
        try {
          const container = document.querySelector(selector)
          if (!container) {
            continue
          }

          const links = container.querySelectorAll('a, button')
          const validLinks = Array.from(links).filter(
            (link) =>
              !link.classList.contains('active') &&
              !link.classList.contains('current') &&
              !link.getAttribute('aria-current')
          )

          if (validLinks.length >= 2) {
            // 第一个有效链接通常是上一页
            if (!this.prevButton && validLinks[0]) {
              const first = validLinks[0]
              if (this.looksLikeNavButton(first, 'prev')) {
                this.prevButton = first
              }
            }
            // 最后一个有效链接通常是下一页
            if (!this.nextButton && validLinks[validLinks.length - 1]) {
              const last = validLinks[validLinks.length - 1]
              if (this.looksLikeNavButton(last, 'next')) {
                this.nextButton = last
              }
            }
          }
        } catch (e) {
          // 忽略
        }
      }
    }

    isValidButton(el, _type) {
      if (!el) {
        return false
      }

      // 检查是否可见
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        return false
      }

      // 检查是否禁用
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
        return false
      }
      if (el.classList.contains('disabled') || el.classList.contains('is-disabled')) {
        return false
      }

      // 检查是否有 href 或 onclick
      const hasHref = el.tagName === 'A' && el.href
      const hasOnClick = el.hasAttribute('onclick')
      const isButton = el.tagName === 'BUTTON'
      const hasRole = el.getAttribute('role') === 'button'

      return hasHref || hasOnClick || isButton || hasRole
    }

    looksLikeNavButton(el, type) {
      const text = (el.textContent || '').trim().toLowerCase()
      const patterns = this.textPatterns[type]

      // 检查文本
      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          return true
        }
      }

      // 检查箭头图标
      const html = el.innerHTML.toLowerCase()
      if (
        type === 'prev' &&
        (html.includes('arrow-left') || html.includes('chevron-left') || html.includes('«'))
      ) {
        return true
      }
      if (
        type === 'next' &&
        (html.includes('arrow-right') || html.includes('chevron-right') || html.includes('»'))
      ) {
        return true
      }

      return false
    }

    getButtonInfo(el) {
      return {
        tag: el.tagName,
        text: (el.textContent || '').trim().substring(0, 30),
        class: el.className.substring(0, 50),
      }
    }

    bindEvents() {
      // SPA 兜底场景会二次调用 init() → bindEvents()，必须幂等
      if (this._eventsBound) {
        return
      }
      this._eventsBound = true
      this._keydownHandler = (e) => {
        // 忽略输入框中的按键
        if (this.isInputFocused()) {
          return
        }

        // 检查修饰键
        if (this.config.requireAlt && !e.altKey) {
          return
        }
        if (this.config.requireCtrl && !e.ctrlKey) {
          return
        }

        const key = e.key

        // 如果焦点在视频元素上，不拦截左右键（让视频播放器处理快进/快退）
        if ((key === 'ArrowLeft' || key === 'ArrowRight') && this.isVideoFocused()) {
          return
        }

        // 上一页
        if (this.config.prevKeys.includes(key)) {
          if (this.prevButton) {
            e.preventDefault()
            this.clickButton(this.prevButton, 'prev')
          }
        }

        // 下一页
        if (this.config.nextKeys.includes(key)) {
          if (this.nextButton) {
            e.preventDefault()
            this.clickButton(this.nextButton, 'next')
          }
        }

        // ? 键显示帮助
        if (key === '?' && e.shiftKey) {
          e.preventDefault()
          this.showHelp()
        }
      }
      document.addEventListener('keydown', this._keydownHandler, true)

      // 监听 DOM 变化，重新检测分页按钮
      this._setupDOMWatch()

      // SPA URL/DOM 兜底统一交给 _setupSPAReinitGuard（init 路径会调用一次）
      // 此处不再绑 popstate/hashchange，避免与兜底重复双绑。
    }

    /**
     * 设置 DOM 变更监听
     * 优先使用 UnifiedDOMWatcher LOW 优先级 + 严格 filter
     * 仅当 addedNodes 包含 a/button/nav 元素时才重新检测
     */
    _setupDOMWatch() {
      const scheduleDetect = () => {
        clearTimeout(this._detectTimer)
        this._detectTimer = setTimeout(() => {
          // prev+next 都在 DOM 中且未 disabled → 跳过扫描
          if (
            this.prevButton &&
            this.nextButton &&
            document.body.contains(this.prevButton) &&
            document.body.contains(this.nextButton) &&
            !this.prevButton.disabled &&
            !this.nextButton.disabled
          ) {
            return
          }
          this.detectPagination()
        }, 1500)
      }

      if (window.UnifiedDOMWatcher) {
        this._unsubscribe = window.UnifiedDOMWatcher.subscribe(scheduleDetect, {
          priority: window.UnifiedDOMWatcher.Priority.LOW,
          name: 'KeyboardPagination',
          filter: (mutation) => {
            if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
              return false
            }
            for (const node of mutation.addedNodes) {
              if (node.nodeType !== 1) {
                continue
              }
              const tag = node.tagName
              if (tag === 'A' || tag === 'BUTTON' || tag === 'NAV') {
                return true
              }
              if (node.querySelector?.('a, button, nav')) {
                return true
              }
            }
            return false
          },
        })
      } else {
        // 降级：独立 MutationObserver + 防抖
        this._observer = new MutationObserver(scheduleDetect)
        this._observer.observe(document.body, { childList: true, subtree: true })
      }
    }

    isInputFocused() {
      const active = document.activeElement
      if (!active) {
        return false
      }

      // 1. 输入框检测
      const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT']
      if (inputTypes.includes(active.tagName)) {
        return true
      }

      // 2. 可编辑元素检测
      if (active.isContentEditable) {
        return true
      }

      // 3. 代码编辑器检测
      const editors = ['.CodeMirror', '.ace_editor', '.monaco-editor', '[contenteditable="true"]']
      for (const selector of editors) {
        if (active.closest(selector)) {
          return true
        }
      }

      // 4. 视频/音频元素检测（只匹配元素本身，不匹配播放器容器避免误判）
      if (active.matches?.('video, audio') || active.closest?.('video, audio')) {
        return true
      }

      // 5. 进度条/滑块检测（视频进度条、音量条等）
      const sliderSelectors = [
        '[role="slider"]', // ARIA 滑块
        'input[type="range"]', // range 输入
        '[class*="progress"][class*="bar"]', // 通用进度条
        '[class*="seekbar"]', // 通用 seekbar
        '[class*="timeline"]', // 通用时间线
      ]
      for (const selector of sliderSelectors) {
        try {
          if (active.matches?.(selector) || active.closest?.(selector)) {
            return true
          }
        } catch (e) {
          // 选择器不支持，跳过
        }
      }

      return false
    }

    // 检测焦点是否在视频元素上（替代旧的 hasVisibleVideo，避免页面有视频就禁用翻页）
    isVideoFocused() {
      const active = document.activeElement
      if (!active) {
        return false
      }
      return !!(active.matches?.('video, audio') || active.closest?.('video, audio'))
    }

    clickButton(button, type) {
      // 检查按钮是否仍在 DOM 中（SPA 路由切换后引用可能失效）
      if (!document.body.contains(button)) {
        this.detectPagination()
        button = type === 'prev' ? this.prevButton : this.nextButton
        if (!button) {
          return
        }
      }

      // 高亮按钮
      this.highlightButton(button)

      // 显示提示
      const text = type === 'prev' ? '← 上一页' : '下一页 →'
      this.showHint(text)

      // 延迟点击，让用户看到效果
      setTimeout(() => {
        if (document.body.contains(button)) {
          button.click()
        }
      }, 100)
    }

    highlightButton(button) {
      const originalOutline = button.style.outline
      const originalBackground = button.style.backgroundColor

      button.style.outline = '3px solid #11998e'
      button.style.backgroundColor = 'rgba(17, 153, 142, 0.2)'

      setTimeout(() => {
        button.style.outline = originalOutline
        button.style.backgroundColor = originalBackground
      }, 300)
    }

    createHint() {
      if (document.getElementById('yc-pagination-hint')) {
        return
      }

      const hint = document.createElement('div')
      hint.id = 'yc-pagination-hint'
      hint.className = 'yc-pagination-hint yc-hidden'
      hint.innerHTML = `
        <span class="yc-hint-text"></span>
      `
      document.body.appendChild(hint)
    }

    showHint(text) {
      if (!this.config.showHint) {
        return
      }

      const hint = document.getElementById('yc-pagination-hint')
      if (!hint) {
        return
      }

      const textEl = hint.querySelector('.yc-hint-text')
      if (textEl) {
        textEl.textContent = text
      }

      hint.classList.remove('yc-hidden')

      clearTimeout(this.hintTimer)
      this.hintTimer = setTimeout(() => {
        hint.classList.add('yc-hidden')
      }, this.config.hintDuration)
    }

    showHelp() {
      const existing = document.querySelector('.yc-pagination-help')
      if (existing) {
        existing.remove()
        return
      }

      const help = document.createElement('div')
      help.className = 'yc-pagination-help'
      help.innerHTML = `
        <div class="yc-help-content">
          <h3>⌨️ 键盘翻页</h3>
          <div class="yc-help-row">
            <kbd>←</kbd> 或 <kbd>A</kbd>
            <span>${this.prevButton ? '上一页' : '未检测到上一页按钮'}</span>
          </div>
          <div class="yc-help-row">
            <kbd>→</kbd> 或 <kbd>D</kbd>
            <span>${this.nextButton ? '下一页' : '未检测到下一页按钮'}</span>
          </div>
          <div class="yc-help-row">
            <kbd>Shift</kbd> + <kbd>?</kbd>
            <span>显示/隐藏帮助</span>
          </div>
          <p class="yc-help-note">在输入框中时快捷键不生效</p>
        </div>
      `

      document.body.appendChild(help)
      help.addEventListener('click', () => help.remove())

      setTimeout(() => help.remove(), 5000)
    }

    injectStyles() {
      if (document.getElementById('yc-pagination-styles')) {
        return
      }

      const style = document.createElement('style')
      style.id = 'yc-pagination-styles'
      style.textContent = `
        .yc-pagination-hint {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 18px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          z-index: 2147483647;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .yc-pagination-hint.yc-hidden {
          opacity: 0;
        }

        .yc-pagination-help {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          cursor: pointer;
        }

        .yc-help-content {
          background: white;
          padding: 24px 32px;
          border-radius: 16px;
          max-width: 320px;
          cursor: default;
        }

        .yc-help-content h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          color: #333;
        }

        .yc-help-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 12px 0;
        }

        .yc-help-row kbd {
          display: inline-block;
          padding: 4px 10px;
          background: #f1f3f4;
          border: 1px solid #dadce0;
          border-radius: 4px;
          font-family: monospace;
          font-size: 14px;
          color: #333;
          min-width: 28px;
          text-align: center;
        }

        .yc-help-row span {
          color: #666;
          font-size: 14px;
        }

        .yc-help-note {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #999;
        }

        /* 浮动指示器 */
        .yc-pagination-indicator {
          position: fixed;
          bottom: 20px;
          left: 20px;
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          z-index: 2147483640;
          box-shadow: 0 2px 10px rgba(17, 153, 142, 0.3);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .yc-pagination-indicator:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
        }

        .yc-pagination-indicator .yc-indicator-arrow {
          font-size: 14px;
        }

        .yc-pagination-indicator .yc-indicator-disabled {
          opacity: 0.4;
        }
      `
      document.head.appendChild(style)

      // 创建浮动指示器
      if (this.prevButton || this.nextButton) {
        this.createIndicator()
      }
    }

    createIndicator() {
      if (document.querySelector('.yc-pagination-indicator')) {
        return
      }

      const indicator = document.createElement('div')
      indicator.className = 'yc-pagination-indicator'
      indicator.innerHTML = `
        <span class="yc-indicator-arrow ${this.prevButton ? '' : 'yc-indicator-disabled'}">←</span>
        <span>键盘翻页</span>
        <span class="yc-indicator-arrow ${this.nextButton ? '' : 'yc-indicator-disabled'}">→</span>
      `
      indicator.addEventListener('click', () => this.showHelp())
      document.body.appendChild(indicator)

      // 3秒后隐藏
      setTimeout(() => {
        indicator.style.opacity = '0'
        indicator.style.pointerEvents = 'none'
      }, 3000)

      // 鼠标移到底部时显示（保存引用以便销毁时清理）
      this._indicatorMouseMove = (e) => {
        if (e.clientY > window.innerHeight - 50) {
          indicator.style.opacity = '1'
          indicator.style.pointerEvents = 'auto'
        } else {
          indicator.style.opacity = '0'
          indicator.style.pointerEvents = 'none'
        }
      }
      document.addEventListener('mousemove', this._indicatorMouseMove)
    }

    destroy() {
      if (this._keydownHandler) {
        document.removeEventListener('keydown', this._keydownHandler, true)
        this._keydownHandler = null
      }
      if (this._detectTimer) {
        clearTimeout(this._detectTimer)
      }
      if (this._spaDebounced) {
        window.removeEventListener('popstate', this._spaDebounced)
        window.removeEventListener('hashchange', this._spaDebounced)
        this._spaDebounced = null
      }
      if (this._spaReinitTimer) {
        clearTimeout(this._spaReinitTimer)
      }
      if (this._unsubscribe) {
        this._unsubscribe()
        this._unsubscribe = null
      }
      if (this._spaUnsubscribe) {
        this._spaUnsubscribe()
        this._spaUnsubscribe = null
      }
      if (this._spaObserver) {
        this._spaObserver.disconnect()
        this._spaObserver = null
      }
      if (this._observer) {
        this._observer.disconnect()
        this._observer = null
      }
      if (this._indicatorMouseMove) {
        document.removeEventListener('mousemove', this._indicatorMouseMove)
        this._indicatorMouseMove = null
      }
      if (this.hintTimer) {
        clearTimeout(this.hintTimer)
      }
      const hint = document.getElementById('yc-pagination-hint')
      if (hint) {
        hint.remove()
      }
      const styles = document.getElementById('yc-pagination-styles')
      if (styles) {
        styles.remove()
      }
      const indicator = document.querySelector('.yc-pagination-indicator')
      if (indicator) {
        indicator.remove()
      }
      const help = document.querySelector('.yc-pagination-help')
      if (help) {
        help.remove()
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.keyboardPagination = new KeyboardPagination()
    })
  } else {
    window.keyboardPagination = new KeyboardPagination()
  }
}
