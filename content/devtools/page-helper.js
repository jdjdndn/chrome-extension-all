/**
 * 页面调试助手
 * 通过 EventBus 处理来自 DevTools 面板的操作请求
 */

(function () {
  'use strict'

  // 防止重复初始化
  if (window.__PageHelperInitialized__) {
    console.log('[PageHelper] 已初始化，跳过')
    return
  }
  window.__PageHelperInitialized__ = true

  // ========== 工具函数 ==========

  /**
   * 安全执行代码
   */
  function safeExecute(code, timeout = 5000) {
    return new Promise((resolve) => {
      try {
        const result = eval(code)
        if (result instanceof Promise) {
          const timer = setTimeout(() => resolve({ error: '执行超时' }), timeout)
          result
            .then((r) => {
              clearTimeout(timer)
              resolve({ result: r })
            })
            .catch((e) => {
              clearTimeout(timer)
              resolve({ error: e.message })
            })
        } else {
          resolve({ result })
        }
      } catch (e) {
        resolve({ error: e.message })
      }
    })
  }

  /**
   * 元素选择器（支持多种格式）
   */
  function selectElements(selector) {
    if (!selector) {return []}

    // XPath 格式 (以 // 或 ./ 开头)
    if (selector.startsWith('//') || selector.startsWith('./')) {
      const result = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      )
      const elements = []
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i))
      }
      return elements
    }

    // CSS 选择器
    try {
      return Array.from(document.querySelectorAll(selector))
    } catch (e) {
      return []
    }
  }

  /**
   * 获取元素信息
   */
  function getElementInfo(el) {
    if (!el || !(el instanceof Element)) {return null}

    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)

    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      className: el.className || null,
      text: el.textContent?.trim().slice(0, 100),
      attributes: Array.from(el.attributes).reduce((obj, attr) => {
        obj[attr.name] = attr.value
        return obj
      }, {}),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      visible:
        rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0',
      styles: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
      },
    }
  }

  // ========== DOM 操作处理器 ==========

  const DOMHandlers = {
    /**
     * 高亮元素
     */
    highlight(data) {
      const { selector, color = '#ff0000', duration = 0 } = data
      const elements = selectElements(selector)

      elements.forEach((el) => {
        const oldOutline = el.style.outline
        const oldOutlineOffset = el.style.outlineOffset
        const oldBackground = el.style.backgroundColor

        el.style.outline = `3px solid ${color}`
        el.style.outlineOffset = '2px'
        el.style.backgroundColor = color + '20'

        if (duration > 0) {
          setTimeout(() => {
            el.style.outline = oldOutline
            el.style.outlineOffset = oldOutlineOffset
            el.style.backgroundColor = oldBackground
          }, duration)
        }
      })

      return { count: elements.length, selector }
    },

    /**
     * 取消高亮
     */
    unhighlight(data) {
      const { selector = '*' } = data
      const elements = selectElements(selector)

      elements.forEach((el) => {
        el.style.outline = ''
        el.style.outlineOffset = ''
        if (el.dataset.highlightBg) {
          el.style.backgroundColor = el.dataset.highlightBg
          delete el.dataset.highlightBg
        }
      })

      return { count: elements.length }
    },

    /**
     * 隐藏元素
     */
    hide(data) {
      const { selector } = data
      const elements = selectElements(selector)

      elements.forEach((el) => {
        el.dataset.pageHelperDisplay = el.style.display || ''
        el.style.display = 'none'
      })

      return { count: elements.length, selector }
    },

    /**
     * 显示元素
     */
    show(data) {
      const { selector } = data
      const elements = selectElements(selector)

      elements.forEach((el) => {
        el.style.display = el.dataset.pageHelperDisplay || ''
        delete el.dataset.pageHelperDisplay
      })

      return { count: elements.length, selector }
    },

    /**
     * 删除元素
     */
    remove(data) {
      const { selector } = data
      const elements = selectElements(selector)
      const count = elements.length
      elements.forEach((el) => el.remove())
      return { count, selector }
    },

    /**
     * 点击元素
     */
    click(data) {
      const { selector, index = 0 } = data
      const elements = selectElements(selector)

      if (elements[index]) {
        elements[index].click()
        return { success: true, count: 1 }
      }

      return { success: false, error: '元素不存在' }
    },

    /**
     * 获取元素信息
     */
    getInfo(data) {
      const { selector, index } = data
      const elements = selectElements(selector)

      if (index !== undefined) {
        return { element: getElementInfo(elements[index]) }
      }

      return {
        count: elements.length,
        elements: elements.slice(0, 50).map(getElementInfo),
      }
    },

    /**
     * 滚动到元素
     */
    scrollTo(data) {
      const { selector, behavior = 'smooth' } = data
      const elements = selectElements(selector)

      if (elements[0]) {
        elements[0].scrollIntoView({ behavior, block: 'center' })
        return { success: true }
      }

      return { success: false, error: '元素不存在' }
    },
  }

  // ========== 数据提取处理器 ==========

  const ExtractHandlers = {
    /**
     * 提取链接
     */
    links(data = {}) {
      const { filter = '' } = data
      const links = Array.from(document.querySelectorAll('a[href]'))
        .filter((a) => a.href && !a.href.startsWith('javascript:'))
        .filter((a) => !filter || a.href.includes(filter) || a.textContent.includes(filter))
        .map((a) => ({
          text: a.textContent.trim().slice(0, 100),
          href: a.href,
          target: a.target,
        }))
      return { count: links.length, data: links }
    },

    /**
     * 提取图片
     */
    images(data = {}) {
      const { minSize = 0 } = data
      const images = Array.from(document.querySelectorAll('img'))
        .filter((img) => img.src)
        .filter(
          (img) => minSize === 0 || img.naturalWidth >= minSize || img.naturalHeight >= minSize
        )
        .map((img) => ({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight,
          loading: img.loading,
        }))
      return { count: images.length, data: images }
    },

    /**
     * 提取文本
     */
    text(data = {}) {
      const { selector = 'body' } = data
      const el = document.querySelector(selector)
      if (!el) {return { error: '元素不存在' }}

      return {
        selector,
        text: el.textContent.trim(),
        html: el.innerHTML.slice(0, 10000),
      }
    },

    /**
     * 提取表格
     */
    table(data = {}) {
      const { selector = 'table' } = data
      const table = document.querySelector(selector)
      if (!table) {return { error: '表格不存在', data: [] }}

      const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent.trim())

      let rows = Array.from(table.querySelectorAll('tbody tr'))
      if (rows.length === 0) {
        rows = Array.from(table.querySelectorAll('tr')).slice(1)
      }

      const result = rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('td'))
        const obj = {}
        cells.forEach((cell, i) => {
          obj[headers[i] || `col${i}`] = cell.textContent.trim()
        })
        return obj
      })

      return { count: result.length, data: result }
    },

    /**
     * 提取表单
     */
    forms() {
      const forms = Array.from(document.forms).map((form, i) => ({
        index: i,
        action: form.action,
        method: form.method,
        name: form.name,
        fields: Array.from(form.elements)
          .filter((el) => el.name)
          .map((el) => ({
            name: el.name,
            type: el.type,
            value: el.value?.slice(0, 100),
            required: el.required,
          })),
      }))
      return { count: forms.length, data: forms }
    },

    /**
     * 提取脚本
     */
    scripts() {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map((s) => s.src)
      const inline = document.querySelectorAll('script:not([src])').length
      return { external: scripts, inlineCount: inline }
    },

    /**
     * 提取样式表
     */
    styles() {
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
        (l) => l.href
      )
      const inline = document.querySelectorAll('style').length
      return { external: styles, inlineCount: inline }
    },

    /**
     * 提取 Meta 信息
     */
    meta() {
      const metas = Array.from(document.querySelectorAll('meta'))
        .filter((m) => m.name || m.property || m.getAttribute('itemprop'))
        .map((m) => ({
          name: m.name || m.property || m.getAttribute('itemprop'),
          content: m.content,
        }))
      return { data: metas }
    },

    /**
     * 提取 Storage
     */
    storage(data = {}) {
      const { type = 'localStorage' } = data
      const storage = type === 'sessionStorage' ? sessionStorage : localStorage
      const items = Object.entries(storage).map(([key, value]) => ({
        key,
        value: value?.slice(0, 500),
        size: new Blob([value]).size,
      }))
      const totalSize = items.reduce((a, b) => a + b.size, 0)
      return { count: items.length, totalSize, data: items }
    },

    /**
     * 提取 Cookies
     */
    cookies() {
      const cookies = document.cookie
        .split('; ')
        .filter((c) => c)
        .map((c) => {
          const [name, ...values] = c.split('=')
          return { name, value: values.join('=') }
        })
      return { count: cookies.length, data: cookies }
    },
  }

  // ========== 页面信息处理器 ==========

  const InfoHandlers = {
    /**
     * 获取页面信息
     */
    page() {
      return {
        title: document.title,
        url: location.href,
        domain: location.hostname,
        protocol: location.protocol,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
        elementCount: document.querySelectorAll('*').length,
        readyState: document.readyState,
      }
    },

    /**
     * 获取性能信息
     */
    performance() {
      const nav = performance.getEntriesByType('navigation')[0]
      const resources = performance.getEntriesByType('resource')

      return {
        navigation: nav
          ? {
              dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
              tcp: Math.round(nav.connectEnd - nav.connectStart),
              request: Math.round(nav.responseEnd - nav.requestStart),
              dom: Math.round(nav.domComplete - nav.domInteractive),
              total: Math.round(nav.loadEventEnd - nav.fetchStart),
            }
          : null,
        resourceCount: resources.length,
        resourceSize:
          Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024) + 'KB',
        memory: performance.memory
          ? {
              used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
              total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            }
          : null,
      }
    },
  }

  // ========== EventBus 消息处理 ==========

  function setupEventBusHandlers() {
    if (typeof EventBus === 'undefined') {
      console.warn('[PageHelper] EventBus 未加载，延迟初始化')
      setTimeout(setupEventBusHandlers, 500)
      return
    }

    // 注册 DOM 操作处理器
    EventBus.on('PAGE_HELPER_DOM', async (data) => {
      const { action, ...params } = data
      const handler = DOMHandlers[action]

      if (!handler) {
        return { error: `未知操作: ${action}` }
      }

      try {
        return await handler(params)
      } catch (e) {
        return { error: e.message }
      }
    })

    // 注册数据提取处理器
    EventBus.on('PAGE_HELPER_EXTRACT', async (data) => {
      const { type, ...params } = data
      const handler = ExtractHandlers[type]

      if (!handler) {
        return { error: `未知提取类型: ${type}` }
      }

      try {
        return await handler(params)
      } catch (e) {
        return { error: e.message }
      }
    })

    // 注册页面信息处理器
    EventBus.on('PAGE_HELPER_INFO', async (data) => {
      const { type } = data
      const handler = InfoHandlers[type] || InfoHandlers.page

      try {
        return await handler()
      } catch (e) {
        return { error: e.message }
      }
    })

    // 代码执行处理器
    EventBus.on('PAGE_HELPER_EXEC', async (data) => {
      const { code, timeout = 5000 } = data
      return await safeExecute(code, timeout)
    })

    console.log('[PageHelper] EventBus 处理器已注册')
  }

  // ========== 初始化 ==========

  function init() {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventBusHandlers)
    } else {
      setupEventBusHandlers()
    }
  }

  init()

  // 暴露调试接口
  window.__PageHelper__ = {
    DOMHandlers,
    ExtractHandlers,
    InfoHandlers,
    selectElements,
    getElementInfo,
  }
})()
