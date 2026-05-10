/**
 * 高亮管理模块
 * 负责元素高亮显示和管理
 */
(function () {
  'use strict'

  class Highlighter {
    constructor() {
      this.overlays = new Map() // pickerUid -> overlay element
      this.container = null
      this.style = null
      this._init()
    }

    _init() {
      // 创建容器
      this.container = document.createElement('div')
      this.container.id = 'ep-highlighter-container'
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483644;
      `
      document.body.appendChild(this.container)

      // 添加样式
      this.style = document.createElement('style')
      this.style.id = 'ep-highlighter-styles'
      this.style.textContent = `
        .ep-highlight-overlay {
          position: absolute;
          pointer-events: none;
          border: 2px solid;
          border-radius: 3px;
          transition: all 0.15s ease-out;
          box-sizing: border-box;
        }

        .ep-highlight-overlay.hover {
          border-color: #007acc;
          background: rgba(0, 122, 204, 0.1);
        }

        .ep-highlight-overlay.selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          animation: ep-pulse 2s ease-in-out infinite;
        }

        .ep-highlight-overlay.preview {
          border-color: #f59e0b;
          border-style: dashed;
          background: rgba(245, 158, 11, 0.1);
        }

        .ep-highlight-label {
          position: absolute;
          top: -18px;
          left: -2px;
          background: #10b981;
          color: white;
          font-size: 10px;
          font-family: 'Consolas', monospace;
          font-weight: bold;
          padding: 1px 5px;
          border-radius: 3px;
          white-space: nowrap;
        }

        .ep-highlight-overlay.selected .ep-highlight-label {
          background: #10b981;
        }

        .ep-highlight-overlay.hover .ep-highlight-label {
          background: #007acc;
        }

        @keyframes ep-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `
      document.head.appendChild(this.style)
    }

    /**
     * 显示悬停高亮
     */
    showHover(element) {
      this._removeHover()

      if (!element) {return}

      const rect = element.getBoundingClientRect()
      const overlay = this._createOverlay(rect, 'hover')
      this.container.appendChild(overlay)
      this._hoverOverlay = overlay
    }

    /**
     * 移除悬停高亮
     */
    hideHover() {
      if (this._hoverOverlay) {
        this._hoverOverlay.remove()
        this._hoverOverlay = null
      }
    }

    /**
     * 添加选中高亮
     */
    addSelected(element, pickerUid, index) {
      if (this.overlays.has(pickerUid)) {return}

      const rect = element.getBoundingClientRect()
      const overlay = this._createOverlay(rect, 'selected')
      const label = document.createElement('div')
      label.className = 'ep-highlight-label'
      label.textContent = index
      overlay.appendChild(label)

      this.container.appendChild(overlay)
      this.overlays.set(pickerUid, overlay)

      // 监听元素位置变化
      this._observeElement(element, pickerUid)
    }

    /**
     * 移除选中高亮
     */
    removeSelected(pickerUid) {
      const overlay = this.overlays.get(pickerUid)
      if (overlay) {
        overlay.remove()
        this.overlays.delete(pickerUid)
      }
    }

    /**
     * 更新高亮位置
     */
    updatePosition(pickerUid, element) {
      const overlay = this.overlays.get(pickerUid)
      if (overlay && element) {
        const rect = element.getBoundingClientRect()
        overlay.style.left = rect.left + 'px'
        overlay.style.top = rect.top + 'px'
        overlay.style.width = rect.width + 'px'
        overlay.style.height = rect.height + 'px'
      }
    }

    /**
     * 清除所有选中高亮
     */
    clearAll() {
      this.overlays.forEach((overlay) => overlay.remove())
      this.overlays.clear()
    }

    /**
     * 显示预览高亮
     */
    showPreview(elements) {
      this.clearPreview()

      elements.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        const overlay = this._createOverlay(rect, 'preview')
        this.container.appendChild(overlay)
        if (!this._previews) {this._previews = []}
        this._previews.push(overlay)
      })
    }

    /**
     * 清除预览高亮
     */
    clearPreview() {
      if (this._previews) {
        this._previews.forEach((o) => o.remove())
        this._previews = []
      }
    }

    /**
     * 创建高亮覆盖层
     */
    _createOverlay(rect, type) {
      const overlay = document.createElement('div')
      overlay.className = `ep-highlight-overlay ${type}`
      overlay.style.cssText = `
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
      `
      return overlay
    }

    /**
     * 监听元素位置变化
     */
    _observeElement(element, pickerUid) {
      // 使用 ResizeObserver 监听大小变化
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => {
          this.updatePosition(pickerUid, element)
        })
        observer.observe(element)
      }
    }

    /**
     * 销毁
     */
    destroy() {
      this.clearAll()
      this.clearPreview()
      this.hideHover()
      if (this.container) {this.container.remove()}
      if (this.style) {this.style.remove()}
    }
  }

  // 导出
  window.Highlighter = Highlighter
})()
