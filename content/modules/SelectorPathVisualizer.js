/**
 * 选择器路径可视化模块
 * 在页面上显示选择器的匹配路径
 */
;(function () {
  'use strict'

  class SelectorPathVisualizer {
    constructor() {
      this.container = null
      this.style = null
      this.currentPath = null
      this.isVisible = false
      this._init()
    }

    _init() {
      // 创建容器
      this.container = document.createElement('div')
      this.container.id = 'ep-selector-path-container'
      this.container.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 1, 1, 1, 0.95);
      color: #d4d4d4;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
      max-width: 90%;
      overflow-x: auto;
      box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.3);
    `

      // 添加样式
      this.style = document.createElement('style')
      this.style.id = 'ep-selector-path-styles'
      this.style.textContent = `
      .ep-path-wrapper {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
      }

      .ep-path-segment {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px 8px;
        background: #2d2d2d;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .ep-path-segment:hover {
        background: #3d3d3d;
      }

      .ep-path-segment.tag {
        color: #4ec9b0;
      }

      .ep-path-segment.id {
        color: #fbbf24;
      }

      .ep-path-segment.class {
        color: #34d399;
      }

      .ep-path-segment.attr {
        color: #60a5fa;
      }

      .ep-path-segment.nth {
        color: #dcdcaa;
      }

      .ep-path-segment.current {
        background: #007acc;
        color: white;
        font-weight: bold;
      }

      .ep-path-separator {
        color: #666;
        margin: 0 2px;
      }

      .ep-path-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #444;
        font-size: 10px;
        color: #888;
      }

      .ep-path-stats {
        display: flex;
        gap: 12px;
      }

      .ep-path-stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .ep-path-stat-value {
        color: #4ec9b0;
        font-weight: bold;
      }

      /* 动画 */
      @keyframes ep-path-fade-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .ep-path-animate {
        animation: ep-path-fade-in 0.3s ease-out;
      }

      /* 路径节点高亮 */
      .ep-path-node-highlight {
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        border-radius: 4px;
        transition: all 0.2s ease-out;
      }
    `

      document.body.appendChild(this.container)
      document.head.appendChild(this.style)

      // 绑定滚动事件，更新位置
      window.addEventListener(
        'scroll',
        () => {
          if (this.isVisible) {
            this.updatePosition()
          }
        },
        true
      )

      window.addEventListener('resize', () => {
        if (this.isVisible) {
          this.updatePosition()
        }
      })
    }

    /**
     * 显示选择器路径
     */
    show(element, selector, options = {}) {
      if (!element || !selector) return

      this.currentPath = this._parseSelector(selector)
      this.currentElement = element

      // 构建路径显示
      const html = this._buildPathHtml(this.currentPath, options)

      this.container.innerHTML = html
      this.container.style.display = 'block'
      this.container.classList.add('ep-path-animate')
      this.isVisible = true

      // 如果需要，显示路径节点高亮
      if (options.showNodeHighlights) {
        this._showNodeHighlights(element)
      }
    }

    /**
     * 隐藏路径
     */
    hide() {
      this.container.style.display = 'none'
      this.isVisible = false
      this._clearNodeHighlights()
    }

    /**
     * 更新位置
     */
    updatePosition() {
      if (!this.isVisible || !this.currentElement) return

      // 可以根据需要更新位置
      const rect = this.currentElement.getBoundingClientRect()
      // 位置调整逻辑...
    }

    /**
     * 解析选择器
     */
    _parseSelector(selector) {
      const segments = []
      const parts = selector.split(/\s*>\s*/)

      for (const part of parts) {
        const segment = {
          raw: part,
          tag: '',
          id: null,
          classes: [],
          attributes: [],
          nth: null,
          type: 'tag',
        }

        // 提取标签
        const tagMatch = part.match(/^[a-z][a-z0-9-]*/i)
        if (tagMatch) {
          segment.tag = tagMatch[0].toLowerCase()
        }

        // 提取 ID
        const idMatch = part.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/)
        if (idMatch) {
          segment.id = idMatch[1]
          segment.type = 'id'
        }

        // 提取 class
        const classMatches = part.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
        if (classMatches) {
          segment.classes = classMatches.map((m) => m.slice(1))
          if (!segment.id) segment.type = 'class'
        }

        // 提取属性
        const attrMatches = part.match(/\[([^\]=]+)(?:=([^\]]+))?\]/g)
        if (attrMatches) {
          segment.attributes = attrMatches
            .map((m) => {
              const match = m.match(/\[([^\]=]+)(?:="?([^"]+)"?)?\]/)
              return match ? { name: match[1], value: match[2] || '' } : null
            })
            .filter(Boolean)
          if (!segment.id && segment.classes.length === 0) segment.type = 'attr'
        }

        // 提取 nth
        const nthMatch = part.match(/:nth-(?:child|of-type)\((\d+n?|\d+|odd|even)\)/)
        if (nthMatch) {
          segment.nth = nthMatch[1]
          segment.type = 'nth'
        }

        segments.push(segment)
      }

      return segments
    }

    /**
     * 构建路径 HTML
     */
    _buildPathHtml(path, options) {
      if (!path || path.length === 0) return ''

      const segments = path.map((seg, index) => {
        const isLast = index === path.length - 1
        let displayText = ''
        let className = 'ep-path-segment ' + seg.type

        if (isLast) className += ' current'

        // 构建显示文本
        if (seg.id) {
          displayText = `<span class="tag">${seg.tag || '*'}</span><span class="id">#${seg.id}</span>`
        } else if (seg.classes.length > 0) {
          displayText = `<span class="tag">${seg.tag || '*'}</span><span class="class">.${seg.classes[0]}</span>`
        } else if (seg.attributes.length > 0) {
          const attr = seg.attributes[0]
          displayText = `<span class="tag">${seg.tag || '*'}</span><span class="attr">[${attr.name}="${attr.value}"]</span>`
        } else if (seg.nth) {
          displayText = `<span class="tag">${seg.tag || '*'}</span><span class="nth">:nth-child(${seg.nth})</span>`
        } else {
          displayText = `<span class="tag">${seg.tag || '*'}</span>`
        }

        return `<div class="${className}" data-index="${index}">${displayText}</div>`
      })

      // 添加信息区域
      const infoHtml = `
      <div class="ep-path-info">
        <div class="ep-path-stats">
          <div class="ep-path-stat">
            <span>层级:</span>
            <span class="ep-path-stat-value">${path.length}</span>
          </div>
          <div class="ep-path-stat">
            <span>长度:</span>
            <span class="ep-path-stat-value">${path.map((s) => s.raw).join(' > ').length}</span>
          </div>
        </div>
      </div>
    `

      return `
      <div class="ep-path-wrapper">
        ${segments.join('<span class="ep-path-separator">→</span>')}
      </div>
      ${infoHtml}
    `
    }

    /**
     * 显示路径节点高亮
     */
    _showNodeHighlights(element) {
      this._clearNodeHighlights()

      // 高亮当前元素及其父级路径
      let current = element
      let depth = 0

      while (current && current !== document.body && depth < 5) {
        const rect = current.getBoundingClientRect()
        const highlight = document.createElement('div')
        highlight.className = 'ep-path-node-highlight'
        highlight.style.cssText = `
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        opacity: ${1 - depth * 0.15};
      `

        document.body.appendChild(highlight)
        if (!this._nodeHighlights) this._nodeHighlights = []
        this._nodeHighlights.push(highlight)

        current = current.parentElement
        depth++
      }
    }

    /**
     * 清除节点高亮
     */
    _clearNodeHighlights() {
      if (this._nodeHighlights) {
        this._nodeHighlights.forEach((el) => el.remove())
        this._nodeHighlights = []
      }
    }

    /**
     * 销毁
     */
    destroy() {
      this.hide()
      if (this.container) this.container.remove()
      if (this.style) this.style.remove()
    }
  }

  // 导出
  window.SelectorPathVisualizer = SelectorPathVisualizer
})()
