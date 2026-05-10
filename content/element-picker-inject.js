// ========== 元素拾取器注入脚本 ==========
// 在页面中运行的元素选择交互脚本
// 支持批量选择、高亮预览、选择器生成

// 注意：不要在生成的选择器中使用脚本添加的自定义属性（如 data-element-picker-uid）

(function () {
  'use strict'

  // 如果已存在实例，先清理旧实例
  if (window.ElementPickerInject) {
    try {
      // 尝试停止旧实例
      if (typeof window.ElementPickerInject.stop === 'function') {
        window.ElementPickerInject.stop()
      }
      // 尝试清理高亮
      if (typeof window.ElementPickerInject.cleanup === 'function') {
        window.ElementPickerInject.cleanup()
      }
      // 移除所有高亮元素
      document.querySelectorAll('[data-ep-selected]').forEach((el) => {
        el.removeAttribute('data-ep-selected')
        el.removeAttribute('data-ep-uid')
      })
      // 移除样式
      const oldStyle = document.getElementById('element-picker-styles')
      if (oldStyle) {oldStyle.remove()}
      // 移除高亮层
      const oldOverlay = document.getElementById('element-picker-highlight')
      if (oldOverlay) {oldOverlay.remove()}
    } catch (e) {
      // 忽略清理错误
    }
    window.ElementPickerInject = null
  }

  /**
   * 元素拾取器类
   */
  class ElementPicker {
    constructor() {
      this.isActive = false
      this.selectedElements = [] // 已选中的元素信息 { pickerUid, xpath, selector, tagName }
      this.highlightOverlay = null
      this.sizeTooltip = null
      this.breadcrumbEl = null // 元素路径面包屑
      // statsEl 已移除 - 批量选择统计信息现在只在 DevTools 面板中显示
      this.levelIndicator = null // 智能选择层级指示器
      this.currentHoveredElement = null
      this.multiSelectMode = false // 多选模式（Ctrl/Cmd 按下时）
      this.smartSelectLevel = 0 // 当前智能选择层级
      this._uidCounter = 0 // 唯一 ID 计数器
      this.singleSelectMode = false // 单选模式（只选择一个元素）

      // ========== 新增：短期优化功能 ==========
      this.selectionHistory = [] // 选择历史（用于撤销）
      this.historyIndex = -1 // 当前历史位置
      this.maxHistorySize = 50 // 最大历史记录数
      this.isBoxSelecting = false // 是否正在框选
      this.boxSelectStart = null // 框选起点
      this.boxSelectOverlay = null // 框选覆盖层
      this.previewOverlay = null // 选择器预览覆盖层容器
      this.previewElements = [] // 当前预览的元素

      // 绑定方法以保持 this 上下文
      this.onHover = this.onHover.bind(this)
      this.onMouseOut = this.onMouseOut.bind(this)
      this.onMouseLeave = this.onMouseLeave.bind(this)
      this.onClick = this.onClick.bind(this)
      this.onKeyDown = this.onKeyDown.bind(this)
      this.onKeyUp = this.onKeyUp.bind(this)
      this.onScroll = this.onScroll.bind(this)
      this.onResize = this.onResize.bind(this)
      this.onDoubleClick = this.onDoubleClick.bind(this) // 双击批量选择相同元素
      this.onMouseDown = this.onMouseDown.bind(this) // 框选开始
      this.onMouseMove = this.onMouseMove.bind(this) // 框选中
      this.onMouseUp = this.onMouseUp.bind(this) // 框选结束

      this.createHighlightOverlay()
    }

    /**
     * 智能选择元素 - 自动向上选择有效父级
     * 当父元素只有一个可见子元素且大小相近时，自动选中父级
     * @param {Element} target - 初始点击的元素
     * @returns {Element} - 最终选中的元素
     */
    smartSelectElement(target) {
      const SIZE_THRESHOLD = 0.95 // 相似度阈值 95%
      const MAX_LEVEL = 10

      let current = target
      let level = 0

      while (current.parentElement && level < MAX_LEVEL) {
        const parent = current.parentElement

        if (parent === document.body) {break}

        // 获取可见且占位置的子元素
        const visibleChildren = Array.from(parent.children).filter((child) => {
          const style = window.getComputedStyle(child)
          // display: none - 完全不显示
          if (style.display === 'none') {return false}
          // position: absolute/fixed - 脱离文档流，不占位置
          if (style.position === 'absolute' || style.position === 'fixed') {return false}
          return true
        })

        // 父元素只有一个可见子元素才继续
        if (visibleChildren.length !== 1) {break}

        // 检查大小是否相近
        const currentRect = current.getBoundingClientRect()
        const parentRect = parent.getBoundingClientRect()

        const widthRatio =
          Math.min(currentRect.width, parentRect.width) /
          Math.max(currentRect.width, parentRect.width)
        const heightRatio =
          Math.min(currentRect.height, parentRect.height) /
          Math.max(currentRect.height, parentRect.height)

        if (widthRatio < SIZE_THRESHOLD || heightRatio < SIZE_THRESHOLD) {break}

        current = parent
        level++
      }

      return current
    }

    /**
     * 生成唯一 ID
     */
    generatePickerUid() {
      return 'ep-' + Date.now().toString(36) + '-' + (++this._uidCounter).toString(36)
    }

    /**
     * 创建高亮覆盖层和尺寸提示
     */
    createHighlightOverlay() {
      if (this.highlightOverlay) {return}

      // 高亮框
      this.highlightOverlay = document.createElement('div')
      this.highlightOverlay.id = 'element-picker-highlight-overlay'
      this.highlightOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid #007acc;
        background: rgba(0, 122, 204, 0.15);
        border-radius: 3px;
        display: none;
        transition: all 0.1s ease-out;
      `
      document.body.appendChild(this.highlightOverlay)

      // 尺寸提示
      this.sizeTooltip = document.createElement('div')
      this.sizeTooltip.id = 'element-picker-size-tooltip'
      this.sizeTooltip.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-family: 'Consolas', 'Monaco', monospace;
        white-space: nowrap;
        display: none;
      `
      document.body.appendChild(this.sizeTooltip)

      // 元素路径面包屑
      this.breadcrumbEl = document.createElement('div')
      this.breadcrumbEl.id = 'element-picker-breadcrumb'
      this.breadcrumbEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.85);
        color: #9ca3af;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 10px;
        font-family: 'Consolas', 'Monaco', monospace;
        white-space: nowrap;
        max-width: 80%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: none;
      `
      document.body.appendChild(this.breadcrumbEl)

      // 注意：批量选择统计浮层(statsEl)已移除
      // 选择器信息现在只在 DevTools 面板中显示，不再遮挡页面

      // 智能选择层级指示器
      this.levelIndicator = document.createElement('div')
      this.levelIndicator.id = 'element-picker-level-indicator'
      this.levelIndicator.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-family: 'Consolas', 'Monaco', monospace;
        display: none;
      `
      document.body.appendChild(this.levelIndicator)

      // ========== 框选覆盖层 ==========
      this.boxSelectOverlay = document.createElement('div')
      this.boxSelectOverlay.id = 'element-picker-box-select'
      this.boxSelectOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px dashed #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        display: none;
      `
      document.body.appendChild(this.boxSelectOverlay)

      // ========== 预览覆盖层容器 ==========
      this.previewOverlay = document.createElement('div')
      this.previewOverlay.id = 'element-picker-preview-container'
      this.previewOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483645;
      `
      document.body.appendChild(this.previewOverlay)
    }

    /**
     * 进入选择模式
     */
    start() {
      // 无论当前状态如何，都重新启动（强制重启）
      if (this.isActive) {
        this._removeEventListeners()
      }

      this.isActive = true
      this.selectedElements = []
      this.currentHoveredElement = null

      // 添加事件监听器
      this._addEventListeners()

      // 设置页面样式
      document.body.style.cursor = 'crosshair'

      // 通知 content script 选择模式已启动
      this.sendMessage({ type: 'ELEMENT_PICKER_STARTED' })
    }

    /**
     * 停止选择模式
     */
    stop() {
      // 无论当前状态如何，都执行清理（确保状态一致）
      const wasActive = this.isActive

      this.isActive = false
      this.multiSelectMode = false
      this.currentHoveredElement = null

      // 移除事件监听器
      this._removeEventListeners()

      // 恢复页面样式
      document.body.style.cursor = ''

      // 隐藏高亮层
      this.hideHighlight()

      // 通知 content script 选择模式已停止（即使之前不是活动状态也发送，确保同步）
      this.sendMessage({ type: 'ELEMENT_PICKER_STOPPED' })
    }

    /**
     * 切换选择模式
     */
    toggle() {
      if (this.isActive) {
        this.stop()
      } else {
        this.start()
      }
    }

    /**
     * 添加事件监听器
     */
    _addEventListeners() {
      document.addEventListener('mouseover', this.onHover, true)
      document.addEventListener('mouseout', this.onMouseOut, true)
      document.addEventListener('click', this.onClick, true)
      document.addEventListener('dblclick', this.onDoubleClick, true)
      document.addEventListener('keydown', this.onKeyDown, true)
      document.addEventListener('keyup', this.onKeyUp, true)
      document.addEventListener('mouseleave', this.onMouseLeave, true)
      document.addEventListener('mousedown', this.onMouseDown, true)
      document.addEventListener('mousemove', this.onMouseMove, true)
      document.addEventListener('mouseup', this.onMouseUp, true)
      window.addEventListener('scroll', this.onScroll, true)
      window.addEventListener('resize', this.onResize, true)
    }

    /**
     * 移除事件监听器
     */
    _removeEventListeners() {
      document.removeEventListener('mouseover', this.onHover, true)
      document.removeEventListener('mouseout', this.onMouseOut, true)
      document.removeEventListener('click', this.onClick, true)
      document.removeEventListener('dblclick', this.onDoubleClick, true)
      document.removeEventListener('keydown', this.onKeyDown, true)
      document.removeEventListener('keyup', this.onKeyUp, true)
      document.removeEventListener('mouseleave', this.onMouseLeave, true)
      document.removeEventListener('mousedown', this.onMouseDown, true)
      document.removeEventListener('mousemove', this.onMouseMove, true)
      document.removeEventListener('mouseup', this.onMouseUp, true)
      window.removeEventListener('scroll', this.onScroll, true)
      window.removeEventListener('resize', this.onResize, true)
    }

    /**
     * 鼠标悬停处理
     */
    onHover(event) {
      if (!this.isActive) {return}

      event.stopPropagation()
      const element = event.target

      // 忽略高亮层自身
      if (element === this.highlightOverlay || element === this.sizeTooltip) {return}
      if (element === this.breadcrumbEl || element === this.levelIndicator) {return}

      this.currentHoveredElement = element
      this.smartSelectLevel = 0 // 重置智能选择层级
      this.showHighlight(element)
    }

    /**
     * 鼠标移出处理
     */
    onMouseOut(event) {
      if (!this.isActive) {return}

      const element = event.target
      const relatedTarget = event.relatedTarget

      // 如果移到了高亮层或尺寸提示上，忽略
      if (relatedTarget === this.highlightOverlay || relatedTarget === this.sizeTooltip) {
        return
      }

      // 如果移出了当前悬停元素， 隐藏高亮
      if (element === this.currentHoveredElement) {
        this.hideHighlight()
        this.currentHoveredElement = null
      }
    }

    /**
     * 鼠标离开文档处理
     */
    onMouseLeave(event) {
      if (!this.isActive) {return}

      // 鼠标离开文档时隐藏高亮
      if (event.target === document || event.target === document.body) {
        this.hideHighlight()
        this.currentHoveredElement = null
      }
    }

    /**
     * 鼠标按下 - 开始框选
     */
    onMouseDown(event) {
      if (!this.isActive) {return}
      // 只响应左键 + Shift（框选模式）
      if (event.button !== 0 || !event.shiftKey) {return}
      // 忽略高亮层自身
      if (event.target === this.highlightOverlay || event.target === this.sizeTooltip) {return}

      this.isBoxSelecting = true
      this.boxSelectStart = { x: event.clientX, y: event.clientY }

      // 初始化框选覆盖层
      if (this.boxSelectOverlay) {
        this.boxSelectOverlay.style.display = 'block'
        this.boxSelectOverlay.style.left = `${event.clientX}px`
        this.boxSelectOverlay.style.top = `${event.clientY}px`
        this.boxSelectOverlay.style.width = '0'
        this.boxSelectOverlay.style.height = '0'
      }

      event.preventDefault()
      event.stopPropagation()
    }

    /**
     * 鼠标移动 - 更新框选区域
     */
    onMouseMove(event) {
      if (!this.isActive || !this.isBoxSelecting) {return}

      const startX = this.boxSelectStart.x
      const startY = this.boxSelectStart.y
      const currentX = event.clientX
      const currentY = event.clientY

      // 计算矩形区域
      const left = Math.min(startX, currentX)
      const top = Math.min(startY, currentY)
      const width = Math.abs(currentX - startX)
      const height = Math.abs(currentY - startY)

      // 更新框选覆盖层
      if (this.boxSelectOverlay) {
        this.boxSelectOverlay.style.left = `${left}px`
        this.boxSelectOverlay.style.top = `${top}px`
        this.boxSelectOverlay.style.width = `${width}px`
        this.boxSelectOverlay.style.height = `${height}px`
      }

      // 实时预览框选范围内的元素
      this.previewBoxSelection(left, top, width, height)
    }

    /**
     * 鼠标释放 - 完成框选
     */
    onMouseUp(event) {
      if (!this.isBoxSelecting) {return}

      this.isBoxSelecting = false

      // 隐藏框选覆盖层
      if (this.boxSelectOverlay) {
        this.boxSelectOverlay.style.display = 'none'
      }

      // 清除预览
      this.clearPreview()

      const startX = this.boxSelectStart.x
      const startY = this.boxSelectStart.y
      const currentX = event.clientX
      const currentY = event.clientY

      // 如果框选区域太小（<5px），视为误操作，忽略
      if (Math.abs(currentX - startX) < 5 && Math.abs(currentY - startY) < 5) {
        return
      }

      // 计算选择区域
      const left = Math.min(startX, currentX)
      const top = Math.min(startY, currentY)
      const right = Math.max(startX, currentX)
      const bottom = Math.max(startY, currentY)

      // 获取框选范围内的元素
      this.selectElementsInRect(left, top, right, bottom)
    }

    /**
     * 预览框选范围内的元素
     */
    previewBoxSelection(left, top, width, height) {
      this.clearPreview()

      const right = left + width
      const bottom = top + height

      // 找出框选范围内的元素
      const allElements = document.querySelectorAll('*')
      const inRangeElements = []

      allElements.forEach((el) => {
        // 忽略高亮层和工具层
        if (
          el === this.highlightOverlay ||
          el === this.sizeTooltip ||
          el === this.breadcrumbEl ||
          el === this.levelIndicator ||
          el === this.boxSelectOverlay ||
          el === this.previewOverlay
        )
          {return}

        const rect = el.getBoundingClientRect()

        // 检查元素是否与框选区域相交
        if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
          inRangeElements.push(el)
        }
      })

      // 过滤掉已被选中的元素
      const newElements = inRangeElements.filter((el) => {
        const xpath = this.getXPath(el)
        return !this.selectedElements.some((item) => item.xpath === xpath)
      })

      // 显示预览高亮
      this.previewElements = newElements
      this.showPreviewHighlights(newElements)
    }

    /**
     * 显示预览高亮
     */
    showPreviewHighlights(elements) {
      elements.forEach((el, index) => {
        const previewEl = document.createElement('div')
        previewEl.className = 'element-picker-preview-item'
        previewEl.dataset.epPreviewIndex = index
        previewEl.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: 2147483644;
          border: 1px dashed rgba(59, 130, 246, 0.8);
          background: rgba(59, 130, 246, 0.1);
          border-radius: 2px;
        `

        const rect = el.getBoundingClientRect()
        previewEl.style.left = `${rect.left}px`
        previewEl.style.top = `${rect.top}px`
        previewEl.style.width = `${rect.width}px`
        previewEl.style.height = `${rect.height}px`

        this.previewOverlay.appendChild(previewEl)
      })

      // 预览数量通过 DevTools 面板显示，不再在页面上显示浮层
    }

    /**
     * 清除预览高亮
     */
    clearPreview() {
      if (this.previewOverlay) {
        this.previewOverlay.innerHTML = ''
      }
      this.previewElements = []
    }

    /**
     * 选择框选范围内的元素
     */
    selectElementsInRect(left, top, right, bottom) {
      // 保存历史（用于撤销）
      this.saveHistory()

      const allElements = document.querySelectorAll('*')
      let addedCount = 0

      allElements.forEach((el) => {
        // 忽略高亮层和工具层
        if (
          el === this.highlightOverlay ||
          el === this.sizeTooltip ||
          el === this.breadcrumbEl ||
          el === this.levelIndicator ||
          el === this.boxSelectOverlay ||
          el === this.previewOverlay
        )
          {return}

        const rect = el.getBoundingClientRect()

        // 检查元素中心点是否在框选区域内
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        if (centerX >= left && centerX <= right && centerY >= top && centerY <= bottom) {
          // 智能选择：如果元素太小（<10px），可能只是内部元素，选择其父级
          let targetEl = el
          if (rect.width < 10 && rect.height < 10 && el.parentElement) {
            targetEl = this.smartSelectElement(el)
          }

          const xpath = this.getXPath(targetEl)
          const exists = this.selectedElements.some((item) => item.xpath === xpath)

          if (!exists) {
            const pickerUid = this.generatePickerUid()
            const selector = this.generateSelector(targetEl)
            const elementInfo = {
              pickerUid,
              xpath,
              selector,
              tagName: targetEl.tagName.toLowerCase(),
              id: targetEl.id || '',
              className: typeof targetEl.className === 'string' ? targetEl.className : '',
            }
            this.selectedElements.push(elementInfo)
            this.addSelectedHighlight(targetEl, pickerUid)
            addedCount++
          }
        }
      })

      this.updateStats()
      this.notifySelectionChanged()

      // 显示提示
      if (addedCount > 0) {
        this.showToast(`已添加 ${addedCount} 个元素`)
      }
    }

    /**
     * 保存历史记录（用于撤销/重做）
     */
    saveHistory() {
      // 删除当前位置之后的历史
      this.selectionHistory = this.selectionHistory.slice(0, this.historyIndex + 1)

      // 深拷贝当前选中状态
      const snapshot = JSON.parse(JSON.stringify(this.selectedElements))
      this.selectionHistory.push(snapshot)

      // 限制历史记录数量
      if (this.selectionHistory.length > this.maxHistorySize) {
        this.selectionHistory.shift()
      } else {
        this.historyIndex++
      }
    }

    /**
     * 撤销
     */
    undo() {
      if (this.historyIndex <= 0) {
        this.showToast('没有可撤销的操作', true)
        return
      }

      this.historyIndex--
      this.restoreFromHistory()
    }

    /**
     * 重做
     */
    redo() {
      if (this.historyIndex >= this.selectionHistory.length - 1) {
        this.showToast('没有可重做的操作', true)
        return
      }

      this.historyIndex++
      this.restoreFromHistory()
    }

    /**
     * 从历史记录恢复选中状态
     */
    restoreFromHistory() {
      // 清除当前选中
      this.clearSelectedHighlights()
      this.selectedElements = []

      // 恢复历史状态
      const snapshot = this.selectionHistory[this.historyIndex]
      if (!snapshot) {return}

      snapshot.forEach((item) => {
        const element = this.getElementByXPath(item.xpath)
        if (element) {
          this.selectedElements.push({ ...item })
          this.addSelectedHighlight(element, item.pickerUid)
        }
      })

      this.updateStats()
      this.notifySelectionChanged()
      this.showToast(`已恢复 (${this.historyIndex + 1}/${this.selectionHistory.length})`)
    }

    /**
     * 显示轻提示
     */
    showToast(message, isError = false) {
      // 创建或复用 toast 元素
      let toast = document.getElementById('element-picker-toast')
      if (!toast) {
        toast = document.createElement('div')
        toast.id = 'element-picker-toast'
        toast.style.cssText = `
          position: fixed;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isError ? '#ef4444' : '#10b981'};
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Consolas', 'Monaco', monospace;
          z-index: 2147483647;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
        `
        document.body.appendChild(toast)
      }

      toast.textContent = message
      toast.style.background = isError ? '#ef4444' : '#10b981'
      toast.style.opacity = '1'

      setTimeout(() => {
        toast.style.opacity = '0'
      }, 1500)
    }

    /**
     * 预览选择器匹配结果
     * @param {string} selector - 要预览的选择器
     */
    previewSelector(selector) {
      this.clearPreview()

      if (!selector) {return 0}

      try {
        const elements = document.querySelectorAll(selector)
        this.previewElements = Array.from(elements)

        // 显示预览高亮
        this.showPreviewHighlights(this.previewElements)

        return elements.length
      } catch (e) {
        return 0
      }
    }

    /**
     * 滚动处理
     */
    onScroll(event) {
      if (!this.isActive) {return}

      // 更新高亮框位置
      if (this.currentHoveredElement) {
        this.showHighlight(this.currentHoveredElement)
      }
    }

    /**
     * 窗口大小变化处理
     */
    onResize(event) {
      if (!this.isActive) {return}

      // 更新高亮框位置
      if (this.currentHoveredElement) {
        this.showHighlight(this.currentHoveredElement)
      }
    }

    /**
     * 点击选择处理
     */
    onClick(event) {
      if (!this.isActive) {return}

      // 防止重复处理（使用 stopImmediatePropagation 阻止其他监听器）
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      const element = event.target

      // 忽略高亮层自身
      if (element === this.highlightOverlay || element === this.sizeTooltip) {return}

      // 智能选择：自动向上查找有效父级
      const smartElement = this.smartSelectElement(element)

      // 单选模式处理
      if (this.singleSelectMode) {
        this.selectSingleElement(smartElement)
        return
      }

      // 防抖：检查是否是重复点击（500ms 内同一元素）
      const now = Date.now()
      const xpath = this.getXPath(smartElement)
      if (
        this._lastClickTime &&
        this._lastClickXpath === xpath &&
        now - this._lastClickTime < 500
      ) {
        return
      }
      this._lastClickTime = now
      this._lastClickXpath = xpath

      // 检查是否在已选中列表中（通过 XPath 比较）
      const existingIndex = this.selectedElements.findIndex((item) => item.xpath === xpath)

      // 保存历史（用于撤销）
      this.saveHistory()

      if (existingIndex > -1) {
        // 已选中，取消选中
        this.selectedElements.splice(existingIndex, 1)
        this.removeSelectedHighlight(smartElement)
      } else {
        // 未选中，添加选中
        const pickerUid = this.generatePickerUid()
        const selector = this.generateSelector(smartElement)

        // 验证选择器并获取匹配数量
        const finalSelector = selector
        let matchCount = 1
        try {
          const found = document.querySelectorAll(selector)
          matchCount = found.length
        } catch (e) {
          matchCount = 0
        }

        const elementInfo = {
          pickerUid,
          xpath,
          selector: finalSelector,
          matchCount,
          tagName: smartElement.tagName.toLowerCase(),
          id: smartElement.id || '',
          className: typeof smartElement.className === 'string' ? smartElement.className : '',
        }
        this.selectedElements.push(elementInfo)
        this.addSelectedHighlight(smartElement, pickerUid)
      }

      // 通知选中状态变化
      this.updateStats()
      this.notifySelectionChanged()
    }

    /**
     * 单选模式：选择单个元素
     * @param {Element} element - 要选择的元素
     */
    selectSingleElement(element) {
      if (!element || !element.tagName) {return}

      const xpath = this.getXPath(element)
      const selector = this.generateSelector(element)

      // 验证选择器并获取匹配数量
      let matchCount = 1
      try {
        const found = document.querySelectorAll(selector)
        matchCount = found.length
      } catch (e) {
        matchCount = 0
      }

      // 获取元素路径信息
      const path = []
      let current = element
      while (current && current !== document.documentElement) {
        path.push({
          tagName: current.tagName.toLowerCase(),
          id: current.id || '',
          className: typeof current.className === 'string' ? current.className : '',
        })
        current = current.parentElement
      }

      // 检查是否有父级/子级
      const hasParent = element.parentElement && element.parentElement !== document.documentElement
      const hasChild = element.firstElementChild !== null

      const elementInfo = {
        xpath,
        selector,
        matchCount,
        tagName: element.tagName.toLowerCase(),
        id: element.id || '',
        className: typeof element.className === 'string' ? element.className : '',
        path,
        hasParent,
        hasChild,
      }

      // 发送单选消息
      this.sendMessage({
        type: 'SINGLE_ELEMENT_SELECTED',
        element: elementInfo,
      })

      // 显示选中提示
      this.showToast(`已选择: ${elementInfo.tagName}${elementInfo.id ? '#' + elementInfo.id : ''}`)

      // 高亮显示选中的元素（短暂显示）
      this.showHighlight(element)
      setTimeout(() => {
        this.hideHighlight()
      }, 1000)
    }

    /**
     * 获取元素的 XPath（唯一标识）
     */
    getXPath(element) {
      if (!element || element === document.body) {return '/html/body'}
      if (element === document.documentElement) {return '/html'}

      // 如果元素有 ID，使用 ID
      if (element.id && !element.id.includes(' ') && !/^\d/.test(element.id)) {
        return '//*[@id="' + element.id + '"]'
      }

      // 否则构建路径
      const parts = []
      let current = element

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1
        let sibling = current.previousSibling

        // 计算同类型兄弟元素中的位置
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
            index++
          }
          sibling = sibling.previousSibling
        }

        const tagName = current.tagName.toLowerCase()
        const part = tagName + '[' + index + ']'
        parts.unshift(part)

        if (current === document.body) {break}
        current = current.parentNode
      }

      return '/' + parts.join('/')
    }

    /**
     * 通过 XPath 获取元素
     */
    getElementByXPath(xpath) {
      try {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        )
        return result.singleNodeValue
      } catch (e) {
        return null
      }
    }

    /**
     * 键盘按下处理
     */
    onKeyDown(event) {
      if (!this.isActive) {return}

      // Ctrl/Cmd 按下进入多选模式
      if (event.ctrlKey || event.metaKey) {
        this.multiSelectMode = true
      }

      // Esc 退出选择模式
      if (event.key === 'Escape') {
        this.stop()
        return
      }

      // 撤销: Ctrl+Z
      if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault()
        this.undo()
        return
      }

      // 重做: Ctrl+Y 或 Ctrl+Shift+Z
      if (
        (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey)
      ) {
        event.preventDefault()
        this.redo()
        return
      }

      // 上下键调整智能选择层级
      if (event.key === 'ArrowUp' && this.currentHoveredElement) {
        event.preventDefault()
        this.adjustSmartSelectLevel(1)
      }

      if (event.key === 'ArrowDown' && this.currentHoveredElement) {
        event.preventDefault()
        this.adjustSmartSelectLevel(-1)
      }

      // 数字键 1-9 快速选择同类型元素
      if (event.key >= '1' && event.key <= '9' && event.shiftKey) {
        event.preventDefault()
        this.selectSimilarElements(parseInt(event.key))
      }

      // A 键全选当前高亮元素的同级元素
      if (event.key === 'a' && event.ctrlKey) {
        event.preventDefault()
        this.selectAllSiblings()
      }

      // Delete / Space 键清除所有选中
      if (event.key === 'Delete' || event.key === ' ') {
        event.preventDefault()
        this.clearSelection()
        this.showToast('已清除所有选中')
      }

      // ? 键显示帮助
      if (event.key === '?') {
        event.preventDefault()
        this.showHelp()
      }
    }

    /**
     * 键盘释放处理
     */
    onKeyUp(event) {
      if (!this.isActive) {return}

      // Ctrl/Cmd 释放退出多选模式
      if (!event.ctrlKey && !event.metaKey) {
        this.multiSelectMode = false
      }
    }

    /**
     * 调整智能选择层级
     * @param {number} delta - 层级变化（正数向上，负数向下）
     */
    adjustSmartSelectLevel(delta) {
      if (!this.currentHoveredElement) {return}

      const maxLevel = 10
      this.smartSelectLevel = Math.max(0, Math.min(maxLevel, this.smartSelectLevel + delta))

      // 根据层级向上选择父元素
      let targetElement = this.currentHoveredElement
      for (let i = 0; i < this.smartSelectLevel && targetElement.parentElement; i++) {
        if (targetElement.parentElement === document.body) {break}
        targetElement = targetElement.parentElement
      }

      // 显示层级指示器
      this.showLevelIndicator(this.smartSelectLevel)
      this.showHighlight(targetElement)
    }

    /**
     * 显示智能选择层级指示器
     */
    showLevelIndicator(level) {
      if (!this.levelIndicator) {return}

      if (level > 0) {
        this.levelIndicator.textContent = `↑${level}`
        this.levelIndicator.style.display = 'block'

        // 定位到高亮框右上角
        if (this.highlightOverlay && this.highlightOverlay.style.display !== 'none') {
          const rect = this.highlightOverlay.getBoundingClientRect()
          this.levelIndicator.style.left = `${rect.right + 5}px`
          this.levelIndicator.style.top = `${rect.top}px`
        }
      } else {
        this.levelIndicator.style.display = 'none'
      }
    }

    /**
     * 双击批量选择相同元素
     */
    onDoubleClick(event) {
      if (!this.isActive) {return}

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      const element = event.target

      // 忽略高亮层自身
      if (element === this.highlightOverlay || element === this.sizeTooltip) {return}
      if (element === this.breadcrumbEl) {return}

      // 选择所有相同标签名的同级元素
      this.selectSimilarElements(0)
    }

    /**
     * 选择相似元素
     * @param {number} mode - 0: 同级同标签, 1-9: 限制数量
     */
    selectSimilarElements(mode) {
      if (!this.currentHoveredElement) {return}

      const element =
        this.smartSelectLevel > 0
          ? this.getAncestorAtLevel(this.currentHoveredElement, this.smartSelectLevel)
          : this.currentHoveredElement

      if (!element) {return}

      const parent = element.parentElement
      if (!parent) {return}

      const tag = element.tagName
      const classes =
        element.className && typeof element.className === 'string'
          ? element.className
              .trim()
              .split(' ')
              .filter((c) => c && !/^(css-|styled-|sc-|js-|_)/.test(c))
          : []

      // 找到同级相似元素
      let siblings = Array.from(parent.children).filter((child) => {
        if (child === element) {return true}
        if (child.tagName !== tag) {return false}

        // 如果有共同的 class，优先选择有相同 class 的
        if (classes.length > 0) {
          const childClasses =
            child.className && typeof child.className === 'string'
              ? child.className.trim().split(' ')
              : []
          const hasCommonClass = classes.some((c) => childClasses.includes(c))
          if (!hasCommonClass) {return false}
        }

        return true
      })

      // 限制数量
      if (mode > 0 && mode < siblings.length) {
        const elementIndex = siblings.indexOf(element)
        const half = Math.floor(mode / 2)
        const start = Math.max(0, elementIndex - half)
        siblings = siblings.slice(start, start + mode)
      }

      // 批量添加选中
      siblings.forEach((el) => {
        const xpath = this.getXPath(el)
        const exists = this.selectedElements.some((item) => item.xpath === xpath)

        if (!exists) {
          const pickerUid = this.generatePickerUid()
          const selector = this.generateSelector(el)
          const elementInfo = {
            pickerUid,
            xpath,
            selector,
            tagName: el.tagName.toLowerCase(),
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className : '',
          }
          this.selectedElements.push(elementInfo)
          this.addSelectedHighlight(el, pickerUid)
        }
      })

      this.updateStats()
      this.notifySelectionChanged()
    }

    /**
     * 全选当前高亮元素的同级元素
     */
    selectAllSiblings() {
      if (!this.currentHoveredElement) {return}

      const element =
        this.smartSelectLevel > 0
          ? this.getAncestorAtLevel(this.currentHoveredElement, this.smartSelectLevel)
          : this.currentHoveredElement

      if (!element || !element.parentElement) {return}

      const parent = element.parentElement
      const tag = element.tagName

      // 选择所有同标签的同级元素
      Array.from(parent.children)
        .filter((child) => child.tagName === tag)
        .forEach((child) => {
          const xpath = this.getXPath(child)
          const exists = this.selectedElements.some((item) => item.xpath === xpath)

          if (!exists) {
            const pickerUid = this.generatePickerUid()
            const selector = this.generateSelector(child)
            const elementInfo = {
              pickerUid,
              xpath,
              selector,
              tagName: child.tagName.toLowerCase(),
              id: child.id || '',
              className: typeof child.className === 'string' ? child.className : '',
            }
            this.selectedElements.push(elementInfo)
            this.addSelectedHighlight(child, pickerUid)
          }
        })

      this.updateStats()
      this.notifySelectionChanged()
    }

    /**
     * 获取指定层级的祖先元素
     */
    getAncestorAtLevel(element, level) {
      let current = element
      for (let i = 0; i < level && current.parentElement; i++) {
        if (current.parentElement === document.body) {break}
        current = current.parentElement
      }
      return current
    }

    /**
     * 通知选中状态变化（支持异步计算合并选择器）
     */
    notifySelectionChanged() {
      const elements = this.selectedElements.map((item, index) => ({
        pickerUid: item.pickerUid,
        selector: item.selector,
        matchCount: item.matchCount || 1,
        tagName: item.tagName,
        id: item.id,
        className: item.className,
        index: index + 1,
      }))

      // 立即发送 loading 状态
      this.sendMessage({
        type: 'ELEMENT_SELECTION_CHANGED',
        elements,
        mergedSelector: null,
        computing: true,
      })

      // 异步计算最佳合并选择器
      if (this.selectedElements.length >= 2) {
        const actualElements = this.selectedElements
          .map((item) => this.getElementByXPath(item.xpath))
          .filter((el) => el)
        if (actualElements.length >= 2) {
          this._computeBestSelector(actualElements).then((mergedSelector) => {
            let mergedMatchCount = 0
            try {
              mergedMatchCount = document.querySelectorAll(mergedSelector).length
            } catch (e) {}
            this.sendMessage({
              type: 'ELEMENT_SELECTION_CHANGED',
              elements,
              mergedSelector,
              mergedMatchCount,
              computing: false,
            })
          })
          return
        }
      }

      // 单元素或无元素：直接发送结果
      const mergedSelector =
        this.selectedElements.length === 1 ? this.selectedElements[0].selector : ''
      let mergedMatchCount = 0
      try {
        mergedMatchCount = mergedSelector ? document.querySelectorAll(mergedSelector).length : 0
      } catch (e) {}
      this.sendMessage({
        type: 'ELEMENT_SELECTION_CHANGED',
        elements,
        mergedSelector,
        mergedMatchCount,
        computing: false,
      })
    }

    /**
     * 显示高亮和尺寸信息
     */
    showHighlight(element) {
      if (!this.highlightOverlay) {return}

      const rect = element.getBoundingClientRect()

      // 检查元素是否在视口内
      const isInViewport =
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0

      if (!isInViewport) {
        this.hideHighlight()
        return
      }

      // 更新高亮框
      this.highlightOverlay.style.display = 'block'
      this.highlightOverlay.style.left = `${rect.left}px`
      this.highlightOverlay.style.top = `${rect.top}px`
      this.highlightOverlay.style.width = `${rect.width}px`
      this.highlightOverlay.style.height = `${rect.height}px`

      // 更新尺寸提示
      if (this.sizeTooltip) {
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        const tagName = element.tagName.toLowerCase()
        const idStr = element.id ? `#${element.id}` : ''
        const classStr =
          element.className && typeof element.className === 'string'
            ? element.className
                .trim()
                .split(' ')
                .slice(0, 2)
                .map((c) => `.${c}`)
                .join('')
            : ''

        // 使用 textContent 避免 TrustedHTML 错误
        const strongEl = document.createElement('strong')
        strongEl.textContent = `${tagName}${idStr}`
        this.sizeTooltip.textContent = ''
        this.sizeTooltip.appendChild(strongEl)
        this.sizeTooltip.appendChild(document.createTextNode(` ${width} × ${height}`))

        // 显示匹配数量
        const selector = this.generateSelector(element)
        try {
          const matches = document.querySelectorAll(selector)
          if (matches.length > 1) {
            const matchInfo = document.createElement('span')
            matchInfo.style.cssText = 'color: #fbbf24; margin-left: 8px;'
            matchInfo.textContent = `(${matches.length} 匹配)`
            this.sizeTooltip.appendChild(matchInfo)
          }
        } catch (e) {}

        this.sizeTooltip.style.display = 'block'

        // 定位尺寸提示（在高亮框上方或下方）
        const tooltipHeight = 24
        let tooltipTop = rect.top - tooltipHeight - 4
        let tooltipLeft = rect.left

        // 如果上方空间不够，放到下方
        if (tooltipTop < 0) {
          tooltipTop = rect.bottom + 4
        }

        // 确保不超出右边界
        const tooltipWidth = this.sizeTooltip.offsetWidth || 150
        if (tooltipLeft + tooltipWidth > window.innerWidth) {
          tooltipLeft = window.innerWidth - tooltipWidth - 10
        }

        this.sizeTooltip.style.top = `${tooltipTop}px`
        this.sizeTooltip.style.left = `${tooltipLeft}px`
      }

      // 更新面包屑（元素路径）
      this.showBreadcrumb(element, rect)
    }

    /**
     * 显示元素路径面包屑
     */
    showBreadcrumb(element, rect) {
      if (!this.breadcrumbEl) {return}

      const path = []
      let current = element
      const maxDepth = 5

      while (current && current.nodeType === Node.ELEMENT_NODE && path.length < maxDepth) {
        const tag = current.tagName.toLowerCase()
        let part = `<span class="tag">${tag}</span>`

        if (current.id && !current.id.includes(' ')) {
          part += `<span class="id">#${current.id}</span>`
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className
            .trim()
            .split(' ')
            .filter((c) => c && !/^(css-|styled-|sc-|js-|_|data-)/.test(c))
            .slice(0, 2)
          if (classes.length > 0) {
            part += classes.map((c) => `<span class="class">.${c}</span>`).join('')
          }
        }

        path.unshift(part)

        if (current === document.body) {break}
        current = current.parentElement
      }

      this.breadcrumbEl.innerHTML = path.join('<span class="sep">›</span>')
      this.breadcrumbEl.style.display = 'block'

      // 定位面包屑
      const breadcrumbHeight = 24
      let breadcrumbTop = rect.bottom + 4
      let breadcrumbLeft = rect.left

      // 确保不超出视口
      if (breadcrumbTop + breadcrumbHeight > window.innerHeight) {
        breadcrumbTop = rect.top - breadcrumbHeight - 4
      }

      const breadcrumbWidth = this.breadcrumbEl.offsetWidth || 200
      if (breadcrumbLeft + breadcrumbWidth > window.innerWidth) {
        breadcrumbLeft = window.innerWidth - breadcrumbWidth - 10
      }

      this.breadcrumbEl.style.top = `${breadcrumbTop}px`
      this.breadcrumbEl.style.left = `${breadcrumbLeft}px`
    }

    /**
     * 隐藏高亮和尺寸信息
     */
    hideHighlight() {
      if (this.highlightOverlay) {
        this.highlightOverlay.style.display = 'none'
      }
      if (this.sizeTooltip) {
        this.sizeTooltip.style.display = 'none'
      }
      if (this.breadcrumbEl) {
        this.breadcrumbEl.style.display = 'none'
      }
      if (this.levelIndicator) {
        this.levelIndicator.style.display = 'none'
      }
    }

    /**
     * 添加选中高亮样式
     */
    addSelectedHighlight(element, pickerUid) {
      // 确保元素有定位，以便编号标签能正确显示
      const computedStyle = window.getComputedStyle(element)
      if (computedStyle.position === 'static') {
        element.dataset.epOriginalPosition = 'static'
        element.style.position = 'relative'
      }

      element.setAttribute('data-ep-selected', 'true')
      element.setAttribute('data-ep-uid', pickerUid)

      // 添加索引号
      const index = this.selectedElements.length
      element.setAttribute('data-ep-index', index)

      // 强制重绘
      void element.offsetHeight

      // 更新统计浮层
      this.updateStats()
    }

    /**
     * 更新批量选择统计（通过消息发送到 DevTools）
     */
    updateStats() {
      // 统计信息现在通过 notifySelectionChanged 发送到 DevTools
      // 不再在页面上显示浮层
      this.notifySelectionChanged()
    }

    /**
     * 在页面上显示简短提示
     */
    showPageToast(message, color = '#10b981') {
      // 移除旧的 toast
      const oldToast = document.getElementById('element-picker-toast')
      if (oldToast) {oldToast.remove()}

      // 创建新 toast
      const toast = document.createElement('div')
      toast.id = 'element-picker-toast'
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-family: 'Consolas', 'Monaco', monospace;
        white-space: pre-line;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: ep-toast-in 0.3s ease-out;
        max-width: 300px;
        text-align: center;
      `
      toast.textContent = message
      document.body.appendChild(toast)

      // 添加动画样式
      if (!document.getElementById('element-picker-toast-styles')) {
        const style = document.createElement('style')
        style.id = 'element-picker-toast-styles'
        style.textContent = `
          @keyframes ep-toast-in {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
          @keyframes ep-toast-out {
            from {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
            to {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
          }
        `
        document.head.appendChild(style)
      }

      // 2秒后自动消失
      setTimeout(() => {
        toast.style.animation = 'ep-toast-out 0.3s ease-out forwards'
        setTimeout(() => toast.remove(), 300)
      }, 2000)
    }

    /**
     * 移除选中高亮样式（通过唯一 ID）
     */
    removeSelectedHighlight(element) {
      // 恢复原始 position
      if (element.dataset.epOriginalPosition === 'static') {
        element.style.position = ''
        delete element.dataset.epOriginalPosition
      }

      element.removeAttribute('data-ep-selected')
      element.removeAttribute('data-ep-uid')
      element.removeAttribute('data-ep-index')
      // 强制重绘
      void element.offsetHeight

      // 更新所有元素的索引
      this.updateAllIndices()
      this.updateStats()
    }

    /**
     * 更新所有选中元素的索引
     */
    updateAllIndices() {
      this.selectedElements.forEach((item, index) => {
        const element = this.getElementByXPath(item.xpath)
        if (element) {
          element.setAttribute('data-ep-index', index + 1)
        }
      })
    }

    /**
     * 通过唯一 ID 移除元素高亮
     */
    removeHighlightByUid(pickerUid) {
      if (!pickerUid) {return false}

      // 通过唯一 ID 属性查找元素
      const element = document.querySelector(`[data-ep-uid="${pickerUid}"]`)
      if (element) {
        // 恢复原始 position
        if (element.dataset.epOriginalPosition === 'static') {
          element.style.position = ''
          delete element.dataset.epOriginalPosition
        }

        element.removeAttribute('data-ep-selected')
        element.removeAttribute('data-ep-uid')
        element.removeAttribute('data-ep-index')

        return true
      }
      return false
    }

    /**
     * 清除所有选中高亮
     */
    clearSelectedHighlights() {
      // 通过属性选择器找到所有标记的元素
      document.querySelectorAll('[data-ep-uid]').forEach((el) => {
        // 恢复原始 position
        if (el.dataset.epOriginalPosition === 'static') {
          el.style.position = ''
          delete el.dataset.epOriginalPosition
        }
        el.removeAttribute('data-ep-selected')
        el.removeAttribute('data-ep-uid')
        el.removeAttribute('data-ep-index')
      })

      // 统计信息已通过 DevTools 面板显示
    }

    /**
     * 清除所有选中
     */
    clearSelection() {
      this.clearSelectedHighlights()
      this.selectedElements = []
      this.currentHoveredElement = null

      // 隐藏高亮框
      this.hideHighlight()

      this.sendMessage({
        type: 'ELEMENT_SELECTION_CHANGED',
        elements: [],
      })
    }

    /**
     * 生成 CSS 选择器
     * 使用多策略 BFS 算法，确保返回最短且精确的选择器
     */
    generateSelector(element) {
      if (!element || !element.tagName) {return ''}
      if (element === document.body) {return 'body'}
      if (element === document.documentElement) {return 'html'}

      // === Helper Functions ===
      const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\d/.test(node.id)

      const getValidClasses = (node) => {
        if (!node.className || typeof node.className !== 'string') {return []}
        return node.className
          .trim()
          .split(' ')
          .filter((c) => {
            if (!c || /^[0-9]/.test(c)) {return false}
            // 过滤动态生成的 class
            if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_|ng-|React|react|vue-|v-)/.test(c))
              {return false}
            if (c.length > 40) {return false}
            return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)
          })
      }

      // 高优先级测试属性（这些属性通常唯一标识元素）
      const TEST_ATTRS = [
        'data-testid',
        'data-test',
        'data-cy',
        'data-test-id',
        'data-qa',
        'data-automation-id',
      ]

      // 稳定属性（可用于选择器）
      const STABLE_ATTRS = [
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
      ]

      // 特殊元素属性（对特定元素很有用）
      const ELEMENT_SPECIFIC_ATTRS = {
        a: ['href'],
        img: ['src', 'alt'],
        input: ['type', 'name', 'placeholder'],
        button: ['type'],
        form: ['action', 'method'],
        select: ['name', 'multiple'],
        textarea: ['name', 'placeholder'],
        video: ['src', 'poster'],
        audio: ['src'],
        iframe: ['src'],
        meta: ['name', 'property', 'content'],
        link: ['rel', 'href'],
      }

      const getValidAttributes = (node, forMerge = false) => {
        if (!node.attributes) {return []}
        const skipAttrs = new Set([
          'data-ep-selected',
          'data-ep-uid',
          'class',
          'id',
          'style',
          'aria-label',
          'aria-describedby',
          'aria-labelledby',
          'title',
          'data-tooltip',
          'onclick',
          'onchange',
          'onsubmit',
        ])
        const attrs = []
        for (const attr of node.attributes) {
          if (skipAttrs.has(attr.name)) {continue}
          if (!attr.value || attr.value.length > 80) {continue}
          if (/^\d+$/.test(attr.value)) {continue}
          if (forMerge && !STABLE_ATTRS.includes(attr.name) && !TEST_ATTRS.includes(attr.name))
            {continue}
          attrs.push({ name: attr.name, value: attr.value })
        }
        // 按优先级排序：测试属性 > 稳定属性 > 其他
        attrs.sort((a, b) => {
          const aIsTest = TEST_ATTRS.includes(a.name) ? 0 : 1
          const bIsTest = TEST_ATTRS.includes(b.name) ? 0 : 1
          if (aIsTest !== bIsTest) {return aIsTest - bIsTest}
          const aIsStable = STABLE_ATTRS.includes(a.name) ? 0 : 1
          const bIsStable = STABLE_ATTRS.includes(b.name) ? 0 : 1
          return aIsStable - bIsStable
        })
        return attrs
      }

      // 获取元素在所有兄弟中的索引（用于 nth-child）
      const getNthChild = (node) => {
        const parent = node.parentElement
        if (!parent) {return 0}
        const siblings = Array.from(parent.children)
        return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0
      }

      // 获取元素在同类兄弟中的索引（用于 nth-of-type）
      const getNthOfType = (node) => {
        const parent = node.parentElement
        if (!parent) {return 0}
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName)
        return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0
      }

      const testSelector = (sel) => {
        try {
          return document.querySelectorAll(sel)
        } catch {
          return []
        }
      }

      const isExactMatch = (sel, target) => {
        const found = testSelector(sel)
        return found.length === 1 && found[0] === target
      }

      // 返回匹配数量和是否包含目标
      const testSelectorResult = (sel, target) => {
        try {
          const found = document.querySelectorAll(sel)
          return { count: found.length, contains: Array.from(found).includes(target) }
        } catch {
          return { count: Infinity, contains: false }
        }
      }

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

      // 1.5 元素特定属性
      const elementAttrs = ELEMENT_SPECIFIC_ATTRS[tag] || []
      for (const attrName of elementAttrs) {
        const attr = attrs.find((a) => a.name === attrName)
        if (attr) {
          candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
        }
      }

      // 1.6 其他属性
      for (const attr of attrs.slice(0, 3)) {
        if (!TEST_ATTRS.includes(attr.name) && attr.name !== 'role') {
          candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
          candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')
        }
      }

      // 测试 Level 1
      for (const sel of candidates) {
        if (isExactMatch(sel, element)) {return sel}
      }

      // === Level 2: 双 class 组合 ===
      if (classes.length >= 2) {
        // 尝试前两个 class 组合
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

        // 测试
        for (let i = candidates.length - 2; i < candidates.length; i++) {
          if (isExactMatch(candidates[i], element)) {return candidates[i]}
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
            if (isExactMatch(sel, element)) {return sel}
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
        if (isExactMatch(sel, element)) {return sel}
      }

      // === Level 5: 带 nth-of-type / nth-child ===
      if (nthOfType > 0) {
        const sel = tag + ':nth-of-type(' + nthOfType + ')'
        candidates.push(sel)
        if (isExactMatch(sel, element)) {return sel}
      }

      if (nthChild > 0) {
        const sel = tag + ':nth-child(' + nthChild + ')'
        candidates.push(sel)
        if (isExactMatch(sel, element)) {return sel}
      }

      // class + nth-of-type
      if (classes.length > 0 && nthOfType > 0) {
        const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-of-type(' + nthOfType + ')'
        if (isExactMatch(sel, element)) {return sel}
      }

      // === Level 6: 构建路径（从元素到有 ID 的祖先或 body） ===
      const buildPath = (startNode, maxDepth = 6) => {
        const path = []
        let cur = startNode
        let depth = 0

        while (cur && depth < maxDepth) {
          const t = cur.tagName.toLowerCase()

          // 遇到有 ID 的祖先就停止
          if (hasValidId(cur) && cur !== element) {
            path.unshift('#' + CSS.escape(cur.id))
            break
          }

          const c = getValidClasses(cur)
          const curNth = getNthOfType(cur)
          const curAttrs = cur === element ? attrs : getValidAttributes(cur)

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
              part +=
                '[' + CSS.escape(curAttrs[0].name) + '="' + CSS.escape(curAttrs[0].value) + '"]'
            }
          } else if (curNth > 0 && cur !== element) {
            part += ':nth-of-type(' + curNth + ')'
          }

          path.unshift(part)

          if (cur === document.documentElement) {break}
          cur = cur.parentElement
          depth++
        }

        return path
      }

      // 尝试不同深度的路径
      for (let depth = 2; depth <= 5; depth++) {
        const path = buildPath(element, depth)
        if (path.length < 2) {continue}

        const selector = path.join(' > ')
        if (isExactMatch(selector, element)) {return selector}

        // 如果匹配多个，尝试添加更多细节到最后一层
        const result = testSelectorResult(selector, element)
        if (result.contains && result.count > 1 && result.count <= 5) {
          // 尝试在最后一层添加更多 class
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
            if (isExactMatch(enhancedSel, element)) {return enhancedSel}
          }

          // 尝试添加属性
          if (attrs.length > 0 && !lastPart.includes('[')) {
            const enhancedPath = [...path]
            enhancedPath[enhancedPath.length - 1] =
              lastPart + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]'
            const enhancedSel = enhancedPath.join(' > ')
            if (isExactMatch(enhancedSel, element)) {return enhancedSel}
          }

          // 尝试添加 nth-of-type
          if (nthOfType > 0 && !lastPart.includes(':nth')) {
            const enhancedPath = [...path]
            enhancedPath[enhancedPath.length - 1] = lastPart + ':nth-of-type(' + nthOfType + ')'
            const enhancedSel = enhancedPath.join(' > ')
            if (isExactMatch(enhancedSel, element)) {return enhancedSel}
          }
        }
      }

      // === 最后回退：完整路径 ===
      const fullPath = buildPath(element, 10)
      return fullPath.join(' > ')
    }

    /**
     * 获取合并后的选择器（异步版本）
     */
    async getMergedSelector() {
      if (this.selectedElements.length === 0) {return ''}
      if (this.selectedElements.length === 1) {return this.selectedElements[0].selector}

      const elements = this.selectedElements
        .map((item) => this.getElementByXPath(item.xpath))
        .filter((el) => el)
      if (elements.length === 0)
        {return this.selectedElements.map((item) => item.selector).join(', ')}
      if (elements.length === 1) {return this.generateSelector(elements[0])}

      return this._computeBestSelector(elements)
    }

    /**
     * 异步分块计算最佳合并选择器
     * 使用 Generator 惰性生成候选，每块测试50个，超时返回兜底
     * @param {Element[]} elements - 目标元素数组
     * @param {number} timeout - 超时时间(ms)
     * @returns {Promise<string>} - 最佳选择器
     */
    async _computeBestSelector(elements, timeout = 3000) {
      if (elements.length === 0) {return ''}
      if (elements.length === 1) {return this.generateSelector(elements[0])}

      // 提取特征
      const oldFeatures = elements.map((el) => this._extractElementFeatures(el))
      const common = this._findCommonFeatures(oldFeatures)
      const allFeatures = elements.map((el) => this._decomposeFeatures(el))

      // 创建 Generator
      const gen = this.generateCandidates(common, allFeatures, elements)
      const startTime = performance.now()
      const fallback = elements.map((el) => this.generateSelector(el)).join(', ')

      return new Promise((resolve) => {
        const processChunk = () => {
          for (let i = 0; i < 50; i++) {
            const result = gen.next()
            if (result.done) {
              resolve(fallback)
              return
            }
            if (this._isExactMatchForAll(result.value, elements)) {
              resolve(result.value)
              return
            }
          }
          if (performance.now() - startTime > timeout) {
            resolve(fallback)
            return
          }
          setTimeout(processChunk, 0)
        }
        processChunk()
      })
    }

    /**
     * 提取元素的所有可用特征
     */
    _extractElementFeatures(element) {
      const getValidClasses = (node) => {
        if (!node.className || typeof node.className !== 'string') {return []}
        return node.className
          .trim()
          .split(' ')
          .filter((c) => {
            if (!c || /^[0-9]/.test(c)) {return false}
            if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_)/.test(c) || c.length > 30) {return false}
            return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)
          })
      }

      // 确定性属性白名单（用于合并）
      const STABLE_ATTRS = new Set([
        'type',
        'role',
        'data-type',
        'data-role',
        'data-kind',
        'data-variant',
        'data-size',
        'data-testid',
        'data-test',
        'data-id',
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
      ])

      const getValidAttributes = (node, forMerge = false) => {
        if (!node.attributes) {return []}
        const skipAttrs = new Set([
          'data-ep-selected',
          'data-ep-uid',
          'data-element-picker-uid',
          'class',
          'id',
          'style',
          'title',
          'alt',
          'aria-label',
          'aria-describedby',
          'aria-labelledby',
          'placeholder',
          'value',
          'name',
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
        const attrs = []
        for (const attr of node.attributes) {
          // 如果是用于合并，只允许确定性属性
          if (forMerge && !STABLE_ATTRS.has(attr.name)) {continue}
          if (
            skipAttrs.has(attr.name) ||
            !attr.value ||
            attr.value.length > 50 ||
            /^\d+$/.test(attr.value)
          )
            {continue}
          attrs.push({ name: attr.name, value: attr.value })
        }
        return attrs
      }

      // 获取元素的伪类信息（用于智能合并）
      const getPseudoInfo = (node) => {
        const parent = node.parentElement
        if (!parent) {return { nthOfType: 0, isFirst: false, isLast: false, isOnly: false }}

        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName)
        const index = siblings.indexOf(node)
        const count = siblings.length

        return {
          nthOfType: count > 1 ? index + 1 : 0,
          isFirst: index === 0 && count > 1,
          isLast: index === count - 1 && count > 1,
          isOnly: count === 1,
        }
      }

      const getPath = (node) => {
        const path = []
        let current = node
        while (current && current !== document.body) {
          const tag = current.tagName.toLowerCase()
          const id =
            current.id && !current.id.includes(' ') && !/^\d/.test(current.id)
              ? '#' + CSS.escape(current.id)
              : ''
          const classes = getValidClasses(current)
          const cls = classes.length > 0 ? '.' + CSS.escape(classes[0]) : ''
          const pseudo = getPseudoInfo(current)

          let selector = tag + id + cls
          // 添加伪类信息（用于后续合并）
          if (pseudo.isFirst) {selector += ':first-child'}
          else if (pseudo.isLast) {selector += ':last-child'}
          else if (pseudo.isOnly) {selector += ':only-child'}
          else if (pseudo.nthOfType > 0) {selector += `:nth-child(${pseudo.nthOfType})`}

          path.unshift(selector)
          current = current.parentElement
          if (path.length >= 6) {break} // 限制路径深度
        }
        return path
      }

      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || '',
        classes: getValidClasses(element),
        attributes: getValidAttributes(element, false), // 单元素选择器可以用更多属性
        stableAttributes: getValidAttributes(element, true), // 合并时只允许确定性属性
        path: getPath(element),
        pseudoInfo: getPseudoInfo(element),
      }
    }

    /**
     * 找出所有元素的共同特征
     */
    _findCommonFeatures(featuresList) {
      const common = {
        tag: null,
        classes: [],
        attributes: [],
        stableAttributes: [], // 确定性属性（用于合并）
        commonPathPrefix: [],
      }

      // 找出共同的 tag
      const tags = new Set(featuresList.map((f) => f.tag))
      common.tag = tags.size === 1 ? [...tags][0] : null

      // 找出共同的 class
      const allClasses = featuresList.map((f) => new Set(f.classes))
      common.classes = [...allClasses[0]].filter((cls) => allClasses.every((set) => set.has(cls)))

      // 找出共同的属性（名称和值都相同）
      const allAttrs = featuresList.map((f) => new Map(f.attributes.map((a) => [a.name, a.value])))
      if (allAttrs.length > 0) {
        for (const [name, value] of allAttrs[0]) {
          if (allAttrs.every((map) => map.get(name) === value)) {
            common.attributes.push({ name, value })
          }
        }
      }

      // 找出共同的确定性属性
      const allStableAttrs = featuresList.map(
        (f) => new Map((f.stableAttributes || []).map((a) => [a.name, a.value]))
      )
      if (allStableAttrs.length > 0 && allStableAttrs[0].size > 0) {
        for (const [name, value] of allStableAttrs[0]) {
          if (allStableAttrs.every((map) => map.get(name) === value)) {
            common.stableAttributes.push({ name, value })
          }
        }
      }

      // 找出共同的路径前缀（移除伪类后比较）
      if (featuresList.length > 0) {
        const firstPath = featuresList[0].path
        for (let i = 0; i < firstPath.length; i++) {
          // 移除伪类后比较
          const segment = firstPath[i].replace(/:[a-z-]+\([^)]*\)|:[a-z-]+/gi, '')
          const allMatch = featuresList.every((f) => {
            const fSegment = (f.path[i] || '').replace(/:[a-z-]+\([^)]*\)|:[a-z-]+/gi, '')
            return fSegment === segment
          })
          if (allMatch) {
            // 使用不带伪类的基础选择器
            common.commonPathPrefix.push(segment)
          } else {
            break
          }
        }
      }

      return common
    }

    /**
     * 内联获取有效 class 列表（用于 generateCandidates 中的 :not(.class) 排除）
     */
    _getValidClassesInline(node) {
      if (!node.className || typeof node.className !== 'string') {return []}
      return node.className
        .trim()
        .split(' ')
        .filter((c) => {
          if (!c || /^[0-9]/.test(c)) {return false}
          if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_)/.test(c) || c.length > 30) {return false}
          return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)
        })
    }

    /**
     * 分解元素特征（用于 Generator 选择器生成）
     */
    _decomposeFeatures(element) {
      const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\d/.test(node.id)
      const getClasses = (node) => this._getValidClassesInline(node)

      const STABLE_ATTRS = new Set([
        'type',
        'role',
        'data-type',
        'data-role',
        'data-kind',
        'data-variant',
        'data-size',
        'data-testid',
        'data-test',
        'data-id',
        'name',
        'placeholder',
        'disabled',
        'readonly',
        'required',
        'checked',
      ])
      const SKIP_ATTRS = new Set([
        'data-ep-selected',
        'data-ep-uid',
        'data-ep-index',
        'data-ep-original-position',
        'class',
        'id',
        'style',
        'aria-label',
        'title',
        'data-tooltip',
        'onclick',
        'onchange',
        'onsubmit',
      ])

      const getAttrs = (node) => {
        if (!node.attributes) {return []}
        const attrs = []
        for (const attr of node.attributes) {
          if (SKIP_ATTRS.has(attr.name)) {continue}
          if (!attr.value || attr.value.length > 80 || /^\d+$/.test(attr.value)) {continue}
          attrs.push({ name: attr.name, value: attr.value })
        }
        attrs.sort((a, b) => {
          const aS = STABLE_ATTRS.has(a.name) ? 0 : 1
          const bS = STABLE_ATTRS.has(b.name) ? 0 : 1
          return aS - bS
        })
        return attrs
      }

      const getPseudos = (node) => {
        const parent = node.parentElement
        if (!parent) {return []}
        const pseudos = []
        const siblings = Array.from(parent.children)
        const sameType = siblings.filter((c) => c.tagName === node.tagName)
        const idx = sameType.indexOf(node)
        const allIdx = siblings.indexOf(node)
        if (sameType.length > 1) {
          if (idx === 0) {pseudos.push(':first-of-type')}
          if (idx === sameType.length - 1) {pseudos.push(':last-of-type')}
          if (idx > 0) {pseudos.push(':nth-of-type(' + (idx + 1) + ')')}
        }
        if (siblings.length > 1) {
          if (allIdx === 0) {pseudos.push(':first-child')}
          if (allIdx === siblings.length - 1) {pseudos.push(':last-child')}
          if (allIdx > 0) {pseudos.push(':nth-child(' + (allIdx + 1) + ')')}
        }
        if (node.children.length === 0 && node.textContent.trim() === '') {pseudos.push(':empty')}
        try {
          if (node.matches(':checked')) {pseudos.push(':checked')}
          if (node.matches(':disabled')) {pseudos.push(':disabled')}
        } catch (e) {}
        return pseudos
      }

      const ancestors = []
      let cur = element.parentElement
      while (cur && cur !== document.documentElement && ancestors.length < 6) {
        ancestors.push({
          tag: cur.tagName.toLowerCase(),
          id: hasValidId(cur) ? cur.id : null,
          classes: getClasses(cur).slice(0, 5),
          attrs: getAttrs(cur).slice(0, 5),
          pseudos: getPseudos(cur).slice(0, 3),
        })
        cur = cur.parentElement
      }

      const prevEl = element.previousElementSibling
      const nextEl = element.nextElementSibling

      return {
        tag: element.tagName.toLowerCase(),
        id: hasValidId(element) ? element.id : null,
        classes: getClasses(element).slice(0, 8),
        attrs: getAttrs(element).slice(0, 8),
        pseudos: getPseudos(element),
        ancestors,
        prevSibling: prevEl
          ? { tag: prevEl.tagName.toLowerCase(), classes: getClasses(prevEl).slice(0, 3) }
          : null,
        nextSibling: nextEl
          ? { tag: nextEl.tagName.toLowerCase(), classes: getClasses(nextEl).slice(0, 3) }
          : null,
      }
    }

    /**
     * 从特征对象生成单层复合选择器列表
     */
    _compoundCandidates(feat, maxParts) {
      const tag = feat.tag || ''
      const results = []
      const yielded = new Set()
      const add = (sel) => {
        if (sel && !yielded.has(sel)) {
          yielded.add(sel)
          results.push(sel)
        }
      }
      const classes = (feat.classes || []).slice(0, 6)
      const attrs = (feat.attrs || []).slice(0, 5)
      const pseudos = (feat.pseudos || []).slice(0, 4)

      // === 1 part ===
      if (tag) {add(tag)}
      if (feat.id) {add('#' + CSS.escape(feat.id))}
      for (const cls of classes) {add('.' + CSS.escape(cls))}
      for (const attr of attrs)
        {add('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')}
      for (const pseudo of pseudos) {add(tag ? tag + pseudo : pseudo)}

      if (maxParts < 2) {return results.sort((a, b) => a.length - b.length)}

      // === 2 parts ===
      if (tag) {
        if (feat.id) {add(tag + '#' + CSS.escape(feat.id))}
        for (const cls of classes) {add(tag + '.' + CSS.escape(cls))}
        for (const attr of attrs)
          {add(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]')}
        for (const pseudo of pseudos) {add(tag + pseudo)}
      }
      for (let i = 0; i < classes.length; i++) {
        for (let j = i + 1; j < classes.length; j++) {
          add('.' + CSS.escape(classes[i]) + '.' + CSS.escape(classes[j]))
          if (tag) {add(tag + '.' + CSS.escape(classes[i]) + '.' + CSS.escape(classes[j]))}
        }
      }
      for (const cls of classes) {
        for (const attr of attrs) {
          add(
            '.' +
              CSS.escape(cls) +
              '[' +
              CSS.escape(attr.name) +
              '="' +
              CSS.escape(attr.value) +
              '"]'
          )
          if (tag)
            {add(
              tag +
                '.' +
                CSS.escape(cls) +
                '[' +
                CSS.escape(attr.name) +
                '="' +
                CSS.escape(attr.value) +
                '"]'
            )}
        }
      }
      for (const cls of classes) {
        for (const pseudo of pseudos) {
          add('.' + CSS.escape(cls) + pseudo)
          if (tag) {add(tag + '.' + CSS.escape(cls) + pseudo)}
        }
      }
      for (const attr of attrs) {
        for (const pseudo of pseudos) {
          add('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]' + pseudo)
          if (tag)
            {add(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]' + pseudo)}
        }
      }

      if (maxParts < 3) {return results.sort((a, b) => a.length - b.length)}

      // === 3 parts ===
      if (tag) {
        for (let i = 0; i < classes.length; i++) {
          for (let j = i + 1; j < classes.length; j++) {
            add(tag + '.' + CSS.escape(classes[i]) + '.' + CSS.escape(classes[j]))
            for (const attr of attrs.slice(0, 2)) {
              add(
                tag +
                  '.' +
                  CSS.escape(classes[i]) +
                  '.' +
                  CSS.escape(classes[j]) +
                  '[' +
                  CSS.escape(attr.name) +
                  '="' +
                  CSS.escape(attr.value) +
                  '"]'
              )
            }
          }
        }
        for (const cls of classes) {
          for (const attr of attrs)
            {add(
              tag +
                '.' +
                CSS.escape(cls) +
                '[' +
                CSS.escape(attr.name) +
                '="' +
                CSS.escape(attr.value) +
                '"]'
            )}
          for (const pseudo of pseudos) {add(tag + '.' + CSS.escape(cls) + pseudo)}
        }
        for (const attr of attrs) {
          for (const pseudo of pseudos)
            {add(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]' + pseudo)}
        }
      }
      for (let i = 0; i < Math.min(classes.length, 3); i++) {
        for (let j = i + 1; j < Math.min(classes.length, 4); j++) {
          for (const attr of attrs.slice(0, 2))
            {add(
              '.' +
                CSS.escape(classes[i]) +
                '.' +
                CSS.escape(classes[j]) +
                '[' +
                CSS.escape(attr.name) +
                '="' +
                CSS.escape(attr.value) +
                '"]'
            )}
          for (const pseudo of pseudos.slice(0, 2))
            {add('.' + CSS.escape(classes[i]) + '.' + CSS.escape(classes[j]) + pseudo)}
        }
      }

      if (maxParts < 4) {return results.sort((a, b) => a.length - b.length)}

      // === 4 parts ===
      if (tag) {
        for (let i = 0; i < Math.min(classes.length, 3); i++) {
          for (let j = i + 1; j < Math.min(classes.length, 4); j++) {
            for (const attr of attrs.slice(0, 2))
              {add(
                tag +
                  '.' +
                  CSS.escape(classes[i]) +
                  '.' +
                  CSS.escape(classes[j]) +
                  '[' +
                  CSS.escape(attr.name) +
                  '="' +
                  CSS.escape(attr.value) +
                  '"]'
              )}
          }
        }
        for (const cls of classes.slice(0, 2)) {
          for (const pseudo of pseudos.slice(0, 2)) {
            for (const attr of attrs.slice(0, 2))
              {add(
                tag +
                  '.' +
                  CSS.escape(cls) +
                  pseudo +
                  '[' +
                  CSS.escape(attr.name) +
                  '="' +
                  CSS.escape(attr.value) +
                  '"]'
              )}
          }
        }
      }

      return results.sort((a, b) => a.length - b.length)
    }

    /**
     * 分阶段惰性生成所有候选选择器（Generator）
     * Phase 0-2 单层复合，Phase 3 :not()/:is()，Phase 4 祖先/兄弟
     * 自由交叉组合 + Phase 6 三级路径 + Phase 7 兜底
     */
    *generateCandidates(common, allFeatures, elements) {
      const tag = common.tag || ''
      const commonClasses = (common.classes || []).slice(0, 5)
      const commonAttrs = (common.stableAttributes || common.attributes || []).slice(0, 5)

      const commonFeat = {
        tag,
        id: null,
        classes: commonClasses,
        attrs: commonAttrs,
        pseudos: [],
        ancestors: allFeatures[0]?.ancestors || [],
        prevSibling: null,
        nextSibling: null,
      }

      // ========== 片段池 ==========
      const fragments = []
      const yielded = new Set()

      // safeYield 不能用闭包+yield，改为内联模式
      const tryYield = (sel) => {
        if (sel && !yielded.has(sel)) {
          yielded.add(sel)
          return true
        }
        return false
      }

      // ========== Phase 0-2: 单层复合选择器 ==========
      const compoundAll = this._compoundCandidates(commonFeat, 4)
      const targetParts = this._compoundCandidates(commonFeat, 2)
      for (const sel of compoundAll) {
        fragments.push({ type: 'target', sel })
        if (tryYield(sel)) {yield sel}
      }
      for (const sel of targetParts) {
        if (!fragments.some((f) => f.sel === sel)) {fragments.push({ type: 'target', sel })}
      }

      // ========== Phase 3: :not() 修饰符 ==========
      if (elements.length >= 2) {
        const parents = elements.map((el) => el.parentElement)
        const parentSet = new Set(parents)
        if (parentSet.size === 1) {
          const parent = parents[0]
          const allChildren = Array.from(parent.children)
          const elementSet = new Set(elements)
          const notSelected = allChildren.filter((c) => !elementSet.has(c))

          if (
            notSelected.length > 0 &&
            notSelected.length <= 5 &&
            notSelected.length < elements.length
          ) {
            const sameType = elements.every((el) => el.tagName.toLowerCase() === tag)
            if (sameType && tag) {
              const notIdx = notSelected
                .filter((c) => c.tagName.toLowerCase() === tag)
                .map((c) => allChildren.indexOf(c) + 1)
                .sort((a, b) => a - b)
              if (notIdx.length > 0) {
                const notNth =
                  notIdx.length === 1
                    ? ':not(:nth-child(' + notIdx[0] + '))'
                    : notIdx.map((i) => ':not(:nth-child(' + i + '))').join('')
                fragments.push({ type: 'modifier', sel: notNth })
                let s = tag + notNth
                if (tryYield(s)) {yield s}
                if (commonClasses.length > 0) {
                  s = tag + '.' + CSS.escape(commonClasses[0]) + notNth
                  if (tryYield(s)) {yield s}
                }
              }
            }
            // :not(.class)
            const selectedClassSet = new Set(commonClasses)
            const notClasses = new Set()
            for (const ns of notSelected) {
              for (const cls of this._getValidClassesInline(ns)) {
                if (!selectedClassSet.has(cls)) {notClasses.add(cls)}
              }
            }
            if (notClasses.size > 0 && notClasses.size <= 3) {
              const clsArr = [...notClasses]
              const notCls =
                clsArr.length === 1
                  ? ':not(.' + CSS.escape(clsArr[0]) + ')'
                  : ':not(' + clsArr.map((c) => '.' + CSS.escape(c)).join(', ') + ')'
              fragments.push({ type: 'modifier', sel: notCls })
              if (tag) {
                const s = tag + notCls
                if (tryYield(s)) {yield s}
              }
            }
          }
        }
      }

      // ========== Phase 3b: :is() 修饰符 ==========
      if (elements.length >= 2 && elements.length <= 10) {
        const perEl = elements.map((el) => this._compoundCandidates(this._decomposeFeatures(el), 2))
        const flat = perEl.map((sels) => sels[0]).filter(Boolean)
        if (flat.length === elements.length) {
          const isFull = ':is(' + flat.join(', ') + ')'
          fragments.push({ type: 'modifier', sel: isFull })
          let s
          if (tag) {
            s = tag + isFull
            if (tryYield(s)) {yield s}
          }
          s = isFull
          if (tryYield(s)) {yield s}
        }
      }

      // ========== Phase 4: 祖先片段 ==========
      for (let ai = 0; ai < (commonFeat.ancestors || []).length && ai < 3; ai++) {
        const anc = commonFeat.ancestors[ai]
        const ancSels = this._compoundCandidates(anc, 2)
        for (const aSel of ancSels) {
          fragments.push({ type: 'ancestor', sel: aSel })
          for (const tSel of targetParts) {
            let s = aSel + ' ' + tSel
            if (tryYield(s)) {yield s}
            s = aSel + ' > ' + tSel
            if (tryYield(s)) {yield s}
          }
        }
      }

      // ========== Phase 4b: 兄弟片段 ==========
      for (const feat of allFeatures) {
        if (feat.prevSibling) {
          const sibSels = this._compoundCandidates(feat.prevSibling, 2)
          for (const sSel of sibSels) {
            fragments.push({ type: 'sibling', sel: sSel })
            for (const tSel of targetParts.slice(0, 5)) {
              let s = sSel + ' + ' + tSel
              if (tryYield(s)) {yield s}
              s = sSel + ' ~ ' + tSel
              if (tryYield(s)) {yield s}
            }
          }
        }
      }

      // ========== 自由交叉组合阶段 ==========
      const ancestorPool = fragments.filter((f) => f.type === 'ancestor').map((f) => f.sel)
      const siblingPool = fragments.filter((f) => f.type === 'sibling').map((f) => f.sel)
      const targetPool = fragments.filter((f) => f.type === 'target').map((f) => f.sel)
      const modifierPool = fragments.filter((f) => f.type === 'modifier').map((f) => f.sel)

      const targetVariants = []
      for (const tSel of targetPool.slice(0, 5)) {
        targetVariants.push(tSel)
        for (const mod of modifierPool) {
          if (tSel === tag || tSel.startsWith(tag + '.')) {targetVariants.push(tSel + mod)}
        }
      }

      const sibVariants = [...siblingPool.slice(0, 3)]
      for (const sSel of siblingPool.slice(0, 3)) {
        for (const mod of modifierPool.slice(0, 2)) {sibVariants.push(sSel + mod)}
      }

      const crossCombos = []

      // ancestor × targetVariants
      for (const aSel of ancestorPool.slice(0, 5)) {
        for (const tSel of targetVariants.slice(0, 5)) {
          crossCombos.push(aSel + ' > ' + tSel, aSel + ' ' + tSel)
        }
      }
      // sibling × targetVariants
      for (const sSel of sibVariants.slice(0, 3)) {
        for (const tSel of targetVariants.slice(0, 5)) {
          crossCombos.push(sSel + ' + ' + tSel, sSel + ' ~ ' + tSel)
        }
      }
      // ancestor × sibling × target
      for (const aSel of ancestorPool.slice(0, 3)) {
        for (const sSel of sibVariants.slice(0, 2)) {
          for (const tSel of targetVariants.slice(0, 3)) {
            crossCombos.push(aSel + ' > ' + sSel + ' + ' + tSel)
            crossCombos.push(aSel + ' ' + sSel + ' ~ ' + tSel)
            crossCombos.push(aSel + ' > ' + sSel + ' ~ ' + tSel)
          }
        }
      }
      // 双 ancestor × target
      if (ancestorPool.length >= 2) {
        for (const a1 of ancestorPool.slice(0, 3)) {
          for (const a2 of ancestorPool.slice(0, 3)) {
            if (a1 === a2) {continue}
            for (const tSel of targetVariants.slice(0, 3)) {
              crossCombos.push(a1 + ' > ' + a2 + ' > ' + tSel, a1 + ' ' + a2 + ' ' + tSel)
            }
          }
        }
      }
      // 双 ancestor × sibling × target
      if (ancestorPool.length >= 2 && sibVariants.length > 0) {
        for (const a1 of ancestorPool.slice(0, 2)) {
          for (const a2 of ancestorPool.slice(0, 2)) {
            if (a1 === a2) {continue}
            for (const sSel of sibVariants.slice(0, 2)) {
              for (const tSel of targetPool.slice(0, 2)) {
                crossCombos.push(a1 + ' ' + a2 + ' > ' + sSel + ' + ' + tSel)
              }
            }
          }
        }
      }

      // 去重 + 按长度排序
      const uniqueCombos = [...new Set(crossCombos)].filter((s) => !yielded.has(s))
      uniqueCombos.sort((a, b) => a.length - b.length)
      for (const sel of uniqueCombos) {
        if (tryYield(sel)) {yield sel}
      }

      // ========== Phase 6: 三级路径 ==========
      for (let ai = 0; ai < (commonFeat.ancestors || []).length && ai < 3; ai++) {
        const anc1 = commonFeat.ancestors[ai]
        const anc1Sels = this._compoundCandidates(anc1, 2)
        for (let aj = ai + 1; aj < Math.min(commonFeat.ancestors.length, ai + 3); aj++) {
          const anc2 = commonFeat.ancestors[aj]
          const anc2Sels = this._compoundCandidates(anc2, 2)
          for (const s1 of anc1Sels.slice(0, 3)) {
            for (const s2 of anc2Sels.slice(0, 3)) {
              for (const tSel of targetParts.slice(0, 3)) {
                let s = s1 + ' > ' + s2 + ' > ' + tSel
                if (tryYield(s)) {yield s}
                s = s1 + ' ' + s2 + ' ' + tSel
                if (tryYield(s)) {yield s}
              }
            }
          }
        }
      }

      // ========== Phase 7: 绝对路径兜底 ==========
      if (elements.length >= 2) {
        const parents = elements.map((el) => el.parentElement)
        const parentSet = new Set(parents)
        if (parentSet.size === 1 && tag) {
          const parent = parents[0]
          const allChildren = Array.from(parent.children)
          const indices = elements.map((el) => allChildren.indexOf(el) + 1).sort((a, b) => a - b)
          const start = indices[0]
          const end = indices[indices.length - 1]
          const consecutive = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1)
          let s
          if (consecutive && start === 1 && end === allChildren.length) {
            s = tag
            if (tryYield(s)) {yield s}
          } else if (consecutive) {
            if (start === 1) {
              s = tag + ':nth-child(-n+' + end + ')'
              if (tryYield(s)) {yield s}
            } else if (end === allChildren.length) {
              s = tag + ':nth-child(n+' + start + ')'
              if (tryYield(s)) {yield s}
            } else {
              s = tag + ':nth-child(n+' + start + '):nth-child(-n+' + end + ')'
              if (tryYield(s)) {yield s}
            }
          }
          if (indices.every((i) => i % 2 === 1) && indices.length > 2) {
            s = tag + ':nth-child(odd)'
            if (tryYield(s)) {yield s}
          }
          if (indices.every((i) => i % 2 === 0) && indices.length > 2) {
            s = tag + ':nth-child(even)'
            if (tryYield(s)) {yield s}
          }
        }
      }
      if (elements.length === 1) {
        const el = elements[0]
        const path = []
        let cur = el
        while (cur && cur !== document.documentElement) {
          const p = cur.parentElement
          if (!p) {break}
          const idx = Array.from(p.children).indexOf(cur) + 1
          path.unshift(cur.tagName.toLowerCase() + ':nth-child(' + idx + ')')
          cur = p
        }
        if (path.length > 0) {
          const s = path.join(' > ')
          if (tryYield(s)) {yield s}
        }
      }
    }

    /**
     * 验证选择器是否精确匹配所有目标元素（不多不少）
     */
    _isExactMatchForAll(selector, targetElements) {
      try {
        const found = document.querySelectorAll(selector)
        if (found.length !== targetElements.length) {return false}

        // 检查是否所有目标元素都被匹配
        const targetSet = new Set(targetElements)
        for (const el of found) {
          if (!targetSet.has(el)) {return false}
        }
        return true
      } catch (e) {
        return false
      }
    }

    /**
     * 发送消息到 content script
     */
    sendMessage(message) {
      // 通过 DOM 事件传递消息到 content script
      const event = new CustomEvent('element-picker-message', {
        detail: message,
        bubbles: true,
      })
      document.dispatchEvent(event)
    }

    /**
     * 获取当前选中元素数量
     */
    getSelectedCount() {
      return this.selectedElements.length
    }

    /**
     * 清理资源（扩展重新加载时调用）
     */
    cleanup() {
      this.stop()
      this.clearSelectedHighlights()
      this.selectedElements = []
      // 移除事件监听器
      document.removeEventListener('element-picker-command', this._commandHandler)
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
      // 创建或更新帮助浮层
      let helpEl = document.getElementById('element-picker-help')
      if (helpEl) {
        helpEl.remove()
        return
      }

      helpEl = document.createElement('div')
      helpEl.id = 'element-picker-help'
      helpEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: #e5e7eb;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 12px;
        font-family: 'Consolas', 'Monaco', monospace;
        z-index: 2147483647;
        min-width: 320px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        border: 1px solid #374151;
      `

      helpEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">
          <span style="color: #60a5fa; font-weight: bold; font-size: 14px;">⌨️ 快捷键帮助</span>
          <span style="cursor: pointer; color: #9ca3af;" onclick="this.parentElement.parentElement.remove()">✕</span>
        </div>
        <div style="display: grid; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">点击</span>
            <span style="color: #10b981;">选择/取消选择元素</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">双击</span>
            <span style="color: #10b981;">批量选择同级相似元素</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Shift + 拖拽</span>
            <span style="color: #10b981;">框选区域内元素</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">↑ / ↓</span>
            <span style="color: #10b981;">调整选择层级</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Ctrl + A</span>
            <span style="color: #10b981;">全选同级元素</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Ctrl + Z</span>
            <span style="color: #10b981;">撤销</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Ctrl + Y</span>
            <span style="color: #10b981;">重做</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Delete / Space</span>
            <span style="color: #10b981;">清除所有选中</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Esc</span>
            <span style="color: #10b981;">退出选择模式</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9ca3af;">Shift + 1-9</span>
            <span style="color: #10b981;">选择 N 个相似元素</span>
          </div>
        </div>
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #374151; color: #6b7280; font-size: 10px; text-align: center;">
          按 ? 或点击外部关闭此帮助
        </div>
      `

      document.body.appendChild(helpEl)

      // 点击外部关闭
      const closeHelp = (e) => {
        if (!helpEl.contains(e.target)) {
          helpEl.remove()
          document.removeEventListener('click', closeHelp, true)
        }
      }
      setTimeout(() => {
        document.addEventListener('click', closeHelp, true)
      }, 100)
    }

    /**
     * 从 DevTools 更新选中状态（同步页面样式）
     */
    updateSelectionFromDevTools(elements) {
      // 清除所有高亮样式（通过属性选择器找到所有标记的元素）
      this.clearSelectedHighlights()

      // 重新设置高亮
      this.selectedElements = []

      for (const item of elements) {
        try {
          // 优先通过 pickerUid 查找（如果页面上已有标记）
          let element = null
          if (item.pickerUid) {
            element = document.querySelector(`[data-ep-uid="${item.pickerUid}"]`)
          }

          // 如果没找到，通过选择器查找
          if (!element && item.selector) {
            const found = document.querySelectorAll(item.selector)
            if (found.length > 0) {
              element = found[0]
            }
          }

          if (element) {
            // 使用传入的 pickerUid 或生成新的
            const pickerUid = item.pickerUid || this.generatePickerUid()
            this.selectedElements.push({
              pickerUid,
              xpath: this.getXPath(element),
              selector: item.selector,
              tagName: item.tagName,
              id: item.id,
              className: item.className,
            })
            this.addSelectedHighlight(element, pickerUid)
          }
        } catch (e) {
          // 选择器无效，跳过
        }
      }
    }

    /**
     * 根据选择器移除单个元素的高亮（通过唯一 ID 精确定位）
     */
    removeElementBySelector(selector) {
      // 通过选择器找到对应的 pickerUid
      const item = this.selectedElements.find((el) => el.selector === selector)
      if (item) {
        this.removeElementByUid(item.pickerUid)
      } else {
      }
    }

    /**
     * 根据唯一 ID 移除单个元素（精确删除）
     */
    removeElementByUid(pickerUid) {
      if (!pickerUid) {
        return
      }

      // 从选中列表中移除
      const index = this.selectedElements.findIndex((item) => item.pickerUid === pickerUid)
      if (index > -1) {
        this.selectedElements.splice(index, 1)
      }

      // 通过唯一 ID 精确移除页面上对应元素的高亮样式
      this.removeHighlightByUid(pickerUid)
    }

    /**
     * 通过选择器查找元素（优先用 XPath，其次用 CSS）
     */
    findElementBySelector(selector) {
      // 先尝试用 XPath（如果存储了的话）
      // 否则用 CSS 选择器
      try {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          return elements[0]
        }
      } catch (e) {
        // CSS 选择器无效
      }
      return null
    }
  }

  // 创建全局实例
  const picker = new ElementPicker()

  // 添加全局样式
  const style = document.createElement('style')
  style.id = 'element-picker-styles'
  style.textContent = `
    /* 选中元素高亮 - 添加动画效果增强可见性 */
    [data-ep-selected="true"] {
      outline: 2px solid #10b981 !important;
      outline-offset: 1px !important;
      animation: ep-pulse 2s ease-in-out infinite;
    }

    /* 选中元素编号标签 */
    [data-ep-selected="true"]::before {
      content: attr(data-ep-index);
      position: absolute;
      top: -18px;
      left: -2px;
      background: #10b981;
      color: white;
      font-size: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-weight: bold;
      padding: 1px 5px;
      border-radius: 3px;
      z-index: 2147483646;
      pointer-events: none;
      white-space: nowrap;
    }

    /* 脉冲动画 - 增强选中元素的可见性 */
    @keyframes ep-pulse {
      0%, 100% { outline-color: #10b981; }
      50% { outline-color: #34d399; }
    }

    /* 悬停高亮层样式优化 */
    #element-picker-highlight-overlay {
      transition: all 0.1s ease-out;
    }

    /* 悬停时的元素路径面包屑 */
    #element-picker-breadcrumb {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.85);
      color: #9ca3af;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      white-space: nowrap;
      max-width: 80%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #element-picker-breadcrumb .tag {
      color: #60a5fa;
    }

    #element-picker-breadcrumb .id {
      color: #fbbf24;
    }

    #element-picker-breadcrumb .class {
      color: #34d399;
    }

    #element-picker-breadcrumb .sep {
      color: #6b7280;
      margin: 0 2px;
    }

    /* 批量选择统计信息现在只在 DevTools 面板中显示 */

    /* 智能选择层级指示器 */
    #element-picker-level-indicator {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    /* 框选覆盖层增强样式 */
    #element-picker-box-select {
      border-width: 2px !important;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3);
    }

    /* 预览元素样式 */
    .element-picker-preview-item {
      transition: all 0.1s ease-out;
    }

    /* Toast 提示动画 */
    @keyframes ep-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `
  document.head.appendChild(style)

  // 监听来自 content script 的消息
  document.addEventListener('element-picker-command', (event) => {
    const { action, data } = event.detail || {}

    switch (action) {
      case 'START':
        picker.start()
        break
      case 'STOP':
        picker.stop()
        break
      case 'TOGGLE':
        picker.toggle()
        break
      case 'CLEAR':
        picker.clearSelection()
        break
      case 'REMOVE_ELEMENT_HIGHLIGHT':
        // 优先使用 pickerUid，其次使用 selector（向后兼容）
        if (data?.pickerUid) {
          picker.removeElementByUid(data.pickerUid)
        } else if (data?.selector) {
          picker.removeElementBySelector(data.selector)
        }
        break
      case 'UPDATE_SELECTION':
        // 从 DevTools 更新选中状态
        picker.updateSelectionFromDevTools(data?.elements || [])
        break
      case 'GET_STATE':
        picker.sendMessage({
          type: 'ELEMENT_PICKER_STATE',
          isActive: picker.isActive,
          elements: picker.selectedElements.map((item) => ({
            pickerUid: item.pickerUid,
            selector: item.selector,
            tagName: item.tagName,
            id: item.id,
            className: item.className,
          })),
        })
        break
    }
  })

  // 导出全局实例
  window.ElementPickerInject = picker
})()
