/**
 * 虚拟列表渲染模块
 * 用于高效渲染大量选中元素列表
 */
(function () {
  'use strict'

  class VirtualList {
    constructor(options = {}) {
      this.container = options.container
      this.itemHeight = options.itemHeight || 30
      this.buffer = options.buffer || 5 // 上下缓冲数量
      this.renderItem = options.renderItem || ((item) => `<div>${item}</div>`)

      this.items = []
      this.visibleItems = []
      this.scrollTop = 0
      this.startIndex = 0
      this.endIndex = 0

      this._onScroll = this._onScroll.bind(this)
      this.container?.addEventListener('scroll', this._onScroll)
    }

    /**
     * 设置数据
     */
    setItems(items) {
      this.items = items
      this._update()
    }

    /**
     * 添加项目
     */
    addItem(item) {
      this.items.push(item)
      this._update()
    }

    /**
     * 移除项目
     */
    removeItem(index) {
      if (index >= 0 && index < this.items.length) {
        this.items.splice(index, 1)
        this._update()
      }
    }

    /**
     * 清空
     */
    clear() {
      this.items = []
      this.visibleItems = []
      this._update()
    }

    /**
     * 滚动到指定项
     */
    scrollToItem(index) {
      if (this.container) {
        this.container.scrollTop = index * this.itemHeight
      }
    }

    /**
     * 滚动处理
     */
    _onScroll() {
      const newScrollTop = this.container.scrollTop
      if (Math.abs(newScrollTop - this.scrollTop) >= this.itemHeight / 2) {
        this.scrollTop = newScrollTop
        this._update()
      }
    }

    /**
     * 更新可见项目
     */
    _update() {
      if (!this.container || this.items.length === 0) {
        this.visibleItems = []
        return
      }

      const containerHeight = this.container.clientHeight
      const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer)
      const visibleCount = Math.ceil(containerHeight / this.itemHeight) + this.buffer * 2
      const endIndex = Math.min(this.items.length, startIndex + visibleCount)

      // 检查是否需要更新
      if (startIndex !== this.startIndex || endIndex !== this.endIndex) {
        this.startIndex = startIndex
        this.endIndex = endIndex
        this.visibleItems = this.items.slice(startIndex, endIndex)
        this._render()
      }
    }

    /**
     * 渲染可见项目
     */
    _render() {
      if (!this.container) {return}

      // 创建占位容器
      const wrapper = document.createElement('div')
      wrapper.style.height = this.items.length * this.itemHeight + 'px'
      wrapper.style.position = 'relative'

      // 渲染可见项目
      const fragment = document.createDocumentFragment()
      this.visibleItems.forEach((item, i) => {
        const el = document.createElement('div')
        el.style.position = 'absolute'
        el.style.top = (this.startIndex + i) * this.itemHeight + 'px'
        el.style.width = '100%'
        el.style.height = this.itemHeight + 'px'
        el.innerHTML = this.renderItem(item, this.startIndex + i)
        fragment.appendChild(el)
      })

      wrapper.appendChild(fragment)

      // 替换内容
      this.container.innerHTML = ''
      this.container.appendChild(wrapper)
    }

    /**
     * 销毁
     */
    destroy() {
      this.container?.removeEventListener('scroll', this._onScroll)
      this.items = []
      this.visibleItems = []
    }

    /**
     * 获取当前可见范围
     */
    getVisibleRange() {
      return {
        start: this.startIndex,
        end: this.endIndex,
        total: this.items.length,
      }
    }
  }

  // 导出
  window.VirtualList = VirtualList
})()
