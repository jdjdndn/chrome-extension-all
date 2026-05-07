/**
 * Console API 注入脚本
 * 注入到页面上下文，提供调试工具函数
 */

;(function () {
  'use strict'

  // 防止重复注入
  if (window.__DevToolsHelperInjected__) {
    console.log('[DevTools Helper] 已注入，跳过')
    return
  }
  window.__DevToolsHelperInjected__ = true

  // ========== DOM 查询工具 ==========

  /**
   * 增强版 CSS 选择器
   * @param {string} selector - CSS 选择器
   * @param {boolean} all - 是否返回所有匹配元素
   */
  window.$selector = function (selector, all = false) {
    try {
      return all ? document.querySelectorAll(selector) : document.querySelector(selector)
    } catch (e) {
      console.error('[DevTools Helper] 选择器错误:', e.message)
      return null
    }
  }

  /**
   * XPath 选择器
   * @param {string} xpath - XPath 表达式
   * @param {Element} context - 上下文元素
   */
  window.$xpath = function (xpath, context = document) {
    try {
      const result = document.evaluate(
        xpath,
        context,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      )
      const elements = []
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i))
      }
      return elements.length === 1 ? elements[0] : elements
    } catch (e) {
      console.error('[DevTools Helper] XPath 错误:', e.message)
      return []
    }
  }

  /**
   * 查找父元素
   * @param {Element} element - 起始元素
   * @param {string} selector - 父元素选择器
   */
  window.$parent = function (element, selector) {
    let el = element?.parentElement
    while (el) {
      if (!selector || el.matches(selector)) return el
      el = el.parentElement
    }
    return null
  }

  /**
   * 获取子元素
   * @param {Element} element - 父元素
   * @param {string} selector - 过滤选择器
   */
  window.$children = function (element, selector = null) {
    if (!element) return []
    const children = Array.from(element.children)
    return selector ? children.filter((c) => c.matches(selector)) : children
  }

  /**
   * 获取兄弟元素
   * @param {Element} element - 元素
   * @param {string} selector - 过滤选择器
   */
  window.$siblings = function (element, selector = null) {
    if (!element?.parentElement) return []
    const siblings = Array.from(element.parentElement.children).filter((c) => c !== element)
    return selector ? siblings.filter((c) => c.matches(selector)) : siblings
  }

  // ========== 数据提取工具 ==========

  /**
   * 提取页面链接
   * @param {string} filter - URL 过滤关键字
   */
  window.extractLinks = function (filter = '') {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => a.href && !a.href.startsWith('javascript:'))
      .filter((a) => !filter || a.href.includes(filter))
      .map((a) => ({
        text: a.textContent.trim().slice(0, 100),
        href: a.href,
      }))
    console.log(`[DevTools Helper] 找到 ${links.length} 个链接`)
    return links
  }

  /**
   * 提取页面图片
   */
  window.extractImages = function () {
    const images = Array.from(document.querySelectorAll('img'))
      .filter((img) => img.src)
      .map((img) => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }))
    console.log(`[DevTools Helper] 找到 ${images.length} 张图片`)
    return images
  }

  /**
   * 提取文本内容
   * @param {string} selector - 选择器
   */
  window.extractText = function (selector = 'body') {
    const el = document.querySelector(selector)
    return el ? el.textContent.trim() : ''
  }

  /**
   * 提取表格数据
   * @param {string} selector - 表格选择器
   */
  window.extractTable = function (selector = 'table') {
    const table = document.querySelector(selector)
    if (!table) {
      console.error('[DevTools Helper] 未找到表格')
      return []
    }

    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent.trim())

    const rows = Array.from(table.querySelectorAll('tbody tr'))
    if (rows.length === 0) {
      // 尝试直接从 table 获取
      const allRows = Array.from(table.querySelectorAll('tr'))
      if (allRows.length > 1) {
        rows.push(...allRows.slice(1))
      }
    }

    const data = rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'))
      const obj = {}
      cells.forEach((cell, i) => {
        const key = headers[i] || `col${i}`
        obj[key] = cell.textContent.trim()
      })
      return obj
    })

    console.log(`[DevTools Helper] 提取 ${data.length} 行表格数据`)
    return data
  }

  /**
   * 提取表单数据
   */
  window.extractForms = function () {
    const forms = Array.from(document.forms).map((form, i) => ({
      index: i,
      action: form.action,
      method: form.method,
      fields: Array.from(form.elements)
        .map((el) => ({
          name: el.name,
          type: el.type,
          value: el.value?.slice(0, 100),
        }))
        .filter((f) => f.name),
    }))
    console.log(`[DevTools Helper] 找到 ${forms.length} 个表单`)
    return forms
  }

  // ========== DOM 操作工具 ==========

  /**
   * 高亮元素
   * @param {string} selector - 选择器
   * @param {string} color - 颜色
   */
  window.highlight = function (selector, color = 'red') {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      el.style.outline = `3px solid ${color}`
      el.style.outlineOffset = '2px'
      el.dataset.devtoolsHighlight = 'true'
    })
    console.log(`[DevTools Helper] 已高亮 ${elements.length} 个元素`)
    return elements
  }

  /**
   * 取消高亮
   * @param {string} selector - 选择器
   */
  window.unhighlight = function (selector = '[data-devtools-highlight="true"]') {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      el.style.outline = ''
      el.style.outlineOffset = ''
      delete el.dataset.devtoolsHighlight
    })
    console.log(`[DevTools Helper] 已取消高亮 ${elements.length} 个元素`)
  }

  /**
   * 隐藏元素
   * @param {string} selector - 选择器
   */
  window.hideElements = function (selector) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      el.dataset.devtoolsDisplay = el.style.display
      el.style.display = 'none'
    })
    console.log(`[DevTools Helper] 已隐藏 ${elements.length} 个元素`)
    return elements.length
  }

  /**
   * 显示元素
   * @param {string} selector - 选择器
   */
  window.showElements = function (selector) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      el.style.display = el.dataset.devtoolsDisplay || ''
      delete el.dataset.devtoolsDisplay
    })
    console.log(`[DevTools Helper] 已显示 ${elements.length} 个元素`)
    return elements.length
  }

  /**
   * 删除元素
   * @param {string} selector - 选择器
   */
  window.removeElements = function (selector) {
    const elements = document.querySelectorAll(selector)
    const count = elements.length
    elements.forEach((el) => el.remove())
    console.log(`[DevTools Helper] 已删除 ${count} 个元素`)
    return count
  }

  /**
   * 点击元素
   * @param {string} selector - 选择器
   * @param {number} delay - 点击间隔
   */
  window.clickElements = async function (selector, delay = 0) {
    const elements = document.querySelectorAll(selector)
    for (const el of elements) {
      el.click()
      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    }
    console.log(`[DevTools Helper] 已点击 ${elements.length} 个元素`)
    return elements.length
  }

  /**
   * 滚动到元素
   * @param {string|Element|number} target - 目标
   * @param {string} behavior - 滚动行为
   */
  window.scrollToElement = function (target, behavior = 'smooth') {
    if (typeof target === 'string') {
      const el = document.querySelector(target)
      if (el) el.scrollIntoView({ behavior, block: 'center' })
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior })
    } else if (target instanceof Element) {
      target.scrollIntoView({ behavior, block: 'center' })
    }
  }

  // ========== 工具函数 ==========

  /**
   * 复制到剪贴板
   * @param {string} text - 文本
   */
  window.copyToClipboard = async function (text) {
    await navigator.clipboard.writeText(text)
    console.log('[DevTools Helper] 已复制到剪贴板')
  }

  /**
   * 下载 JSON
   * @param {any} data - 数据
   * @param {string} filename - 文件名
   */
  window.downloadJSON = function (data, filename = 'data.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    console.log(`[DevTools Helper] 已下载: ${filename}`)
  }

  /**
   * 下载 CSV
   * @param {Array} data - 数据数组
   * @param {string} filename - 文件名
   */
  window.downloadCSV = function (data, filename = 'data.csv') {
    if (!Array.isArray(data) || data.length === 0) {
      console.error('[DevTools Helper] 数据必须是非空数组')
      return
    }
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h] ?? '').replace(/"/g, '""')
            return `"${val}"`
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    console.log(`[DevTools Helper] 已下载: ${filename}`)
  }

  /**
   * 格式化 JSON 输出
   * @param {any} obj - 对象
   */
  window.logJSON = function (obj) {
    console.log(JSON.stringify(obj, null, 2))
  }

  /**
   * 表格输出
   * @param {Array} data - 数据
   * @param {Array} columns - 列名
   */
  window.logTable = function (data, columns = null) {
    if (columns) {
      const filtered = data.map((item) => {
        const obj = {}
        columns.forEach((c) => (obj[c] = item[c]))
        return obj
      })
      console.table(filtered)
    } else {
      console.table(data)
    }
  }

  // ========== 信息获取 ==========

  /**
   * 获取页面信息
   */
  window.getPageInfo = function () {
    return {
      title: document.title,
      url: location.href,
      domain: location.hostname,
      protocol: location.protocol,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentSize: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      elementCount: document.querySelectorAll('*').length,
      scripts: document.querySelectorAll('script').length,
      styles: document.querySelectorAll('link[rel="stylesheet"]').length,
      images: document.querySelectorAll('img').length,
      links: document.querySelectorAll('a').length,
    }
  }

  /**
   * 获取性能数据
   */
  window.getPerformance = function () {
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
    }
  }

  // ========== 异步工具 ==========

  /**
   * 等待元素出现
   * @param {string} selector - 选择器
   * @param {number} timeout - 超时时间
   */
  window.waitFor = function (selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector)
      if (el) return resolve(el)

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`等待元素超时: ${selector}`))
      }, timeout)
    })
  }

  /**
   * 等待指定时间
   * @param {number} ms - 毫秒
   */
  window.wait = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // ========== DevTools Helper 对象 ==========

  window.DevToolsHelper = {
    version: '1.0.0',

    // 所有可用方法
    methods: [
      '$selector',
      '$xpath',
      '$parent',
      '$children',
      '$siblings',
      'extractLinks',
      'extractImages',
      'extractText',
      'extractTable',
      'extractForms',
      'highlight',
      'unhighlight',
      'hideElements',
      'showElements',
      'removeElements',
      'clickElements',
      'scrollToElement',
      'copyToClipboard',
      'downloadJSON',
      'downloadCSV',
      'logJSON',
      'logTable',
      'getPageInfo',
      'getPerformance',
      'waitFor',
      'wait',
    ],

    // 显示帮助
    help() {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  DevTools Helper v${this.version}                      ║
╠══════════════════════════════════════════════════════════════╣
║  DOM 查询:                                                    ║
║    $selector(sel, all)  - CSS 选择器                         ║
║    $xpath(xpath)        - XPath 查询                         ║
║    $parent(el, sel)     - 查找父元素                         ║
║    $children(el, sel)   - 获取子元素                         ║
║    $siblings(el, sel)   - 获取兄弟元素                       ║
║  数据提取:                                                    ║
║    extractLinks(filter) - 提取链接                           ║
║    extractImages()      - 提取图片                           ║
║    extractTable(sel)    - 提取表格数据                       ║
║    extractForms()       - 提取表单数据                       ║
║  DOM 操作:                                                    ║
║    highlight(sel, color)  - 高亮元素                         ║
║    hideElements(sel)    - 隐藏元素                           ║
║    removeElements(sel)  - 删除元素                           ║
║  工具函数:                                                    ║
║    copyToClipboard(text) - 复制到剪贴板                      ║
║    downloadJSON(data)   - 下载 JSON                          ║
║    downloadCSV(data)    - 下载 CSV                           ║
║    waitFor(sel, timeout)- 等待元素出现                       ║
╚══════════════════════════════════════════════════════════════╝
      `)
    },

    // 清理所有修改
    reset() {
      // 取消所有高亮
      this.methods.forEach((method) => {
        if (method === 'unhighlight') {
          window.unhighlight()
        }
      })
      // 显示所有隐藏的元素
      document.querySelectorAll('[data-devtools-display]').forEach((el) => {
        el.style.display = el.dataset.devtoolsDisplay
        delete el.dataset.devtoolsDisplay
      })
      console.log('[DevTools Helper] 已重置所有修改')
    },
  }

  console.log('[DevTools Helper] 已注入，输入 DevToolsHelper.help() 查看帮助')
})()
