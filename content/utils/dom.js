// ========== DOM 工具模块 ==========
// 提供 DOM 操作相关的通用功能

'use strict'

/**
 * 获取当前域名
 * @returns {string|null}
 */
function getCurrentDomain() {
  try {
    return window.location.hostname
  } catch (error) {
    console.error('[DOM] 获取域名失败:', error)
    return null
  }
}

/**
 * 创建或更新样式标签
 * @param {string} id - 样式标签 ID
 * @param {string} css - CSS 内容
 * @returns {HTMLStyleElement|null}
 */
function upsertStyle(id, css) {
  // 移除已存在的样式标签
  const existing = document.getElementById(id)
  if (existing) {
    existing.remove()
  }

  if (!css || !css.trim()) {
    return null
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  ;(document.head || document.documentElement).appendChild(style)
  return style
}

/**
 * 移除样式标签
 * @param {string} id - 样式标签 ID
 * @returns {boolean} 是否成功移除
 */
function removeStyle(id) {
  const style = document.getElementById(id)
  if (style) {
    style.remove()
    return true
  }
  return false
}

/**
 * 生成隐藏元素的 CSS
 * @param {string[]} selectors - CSS 选择器数组
 * @returns {string} CSS 字符串
 */
function generateHideCSS(selectors) {
  return selectors
    .filter((s) => s && s.trim())
    .map((selector) => `${selector} { display: none !important; }`)
    .join('\n')
}

/**
 * 应用隐藏元素样式
 * @param {string} styleId - 样式标签 ID
 * @param {string[]} selectors - 要隐藏的选择器数组
 */
function applyHideStyle(styleId, selectors) {
  if (!selectors || selectors.length === 0) {
    removeStyle(styleId)
    return
  }

  const css = generateHideCSS(selectors)
  upsertStyle(styleId, css)
  console.log(`[DOM] 已应用隐藏样式，共 ${selectors.length} 个选择器`)
}

/**
 * 等待 DOM 元素出现
 * @param {string} selector - CSS 选择器
 * @param {number} timeout - 超时时间（毫秒）
 * @param {Element} parent - 父元素，默认 document
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, timeout = 10000, parent = document) {
  return new Promise((resolve) => {
    const element = parent.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(parent === document ? document.body : parent, {
      childList: true,
      subtree: true,
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * 批量等待多个元素
 * @param {string[]} selectors - CSS 选择器数组
 * @param {number} timeout - 超时时间
 * @returns {Promise<Element[]>}
 */
async function waitForElements(selectors, timeout = 10000) {
  const results = await Promise.all(selectors.map((s) => waitForElement(s, timeout)))
  return results.filter(Boolean)
}

/**
 * 防抖执行的 DOM 观察器
 * @param {function} callback - 回调函数
 * @param {number} debounceMs - 防抖延迟
 * @returns {MutationObserver}
 */
function createDebouncedObserver(callback, debounceMs = 300) {
  let timer = null
  const observer = new MutationObserver(() => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(callback, debounceMs)
  })
  return observer
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function}
 */
function debounce(func, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => func.apply(this, args), delay)
  }
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 间隔时间（毫秒）
 * @returns {Function}
 */
function throttle(func, delay = 300) {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func.apply(this, args)
    }
  }
}

/**
 * 创建带状态的节流函数（适用于需要即时执行首次调用的场景）
 * @returns {{ check: function, reset: function }}
 */
function createThrottleState(delay = 500) {
  let lastExecutionTime = 0
  return {
    check() {
      const now = Date.now()
      if (now - lastExecutionTime >= delay) {
        lastExecutionTime = now
        return true
      }
      return false
    },
    reset() {
      lastExecutionTime = 0
    },
  }
}

/**
 * 安全地等待 DOM body 就绪后执行回调
 * @param {Function} callback - 回调函数
 */
function onBodyReady(callback) {
  if (document.body) {
    callback()
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback)
  } else {
    setTimeout(() => onBodyReady(callback), 50)
  }
}

/**
 * 检查元素是否在视口内
 * @param {Element} element - DOM 元素
 * @param {Object} options - 选项
 * @param {boolean} options.checkVisibility - 是否检查元素可见性（display !== none）
 * @param {boolean} options.checkDimensions - 是否检查元素尺寸（width/height > 0）
 * @returns {boolean}
 */
function isElementInViewport(element, options = {}) {
  if (!element) {
    return false
  }

  const { checkVisibility = false, checkDimensions = false } = options

  try {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const windowWidth = window.innerWidth || document.documentElement.clientWidth

    // 基本视口检查
    let inViewport =
      rect.top >= 0 && rect.left >= 0 && rect.bottom <= windowHeight && rect.right <= windowWidth

    // 可选：检查元素尺寸
    if (inViewport && checkDimensions) {
      inViewport = rect.width > 0 && rect.height > 0
    }

    // 可选：检查元素可见性
    if (inViewport && checkVisibility) {
      const style = window.getComputedStyle(element)
      inViewport =
        style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    }

    return inViewport
  } catch (error) {
    return false
  }
}

/**
 * 查找视口内唯一匹配的元素
 * @param {string} selector - CSS 选择器
 * @param {Object} options - isElementInViewport 的选项
 * @returns {Element|null}
 */
function findOneInViewport(selector, options = {}) {
  const elements = [...document.querySelectorAll(selector)].filter((el) =>
    isElementInViewport(el, options)
  )
  return elements.length === 1 ? elements[0] : null
}

/**
 * 查找所有在视口内的元素
 * @param {string} selector - CSS 选择器
 * @param {Object} options - isElementInViewport 的选项
 * @returns {Element[]}
 */
function findAllInViewport(selector, options = {}) {
  return [...document.querySelectorAll(selector)].filter((el) => isElementInViewport(el, options))
}

// 命名导出所有公共方法
export {
  getCurrentDomain,
  upsertStyle,
  removeStyle,
  generateHideCSS,
  applyHideStyle,
  waitForElement,
  waitForElements,
  createDebouncedObserver,
  debounce,
  throttle,
  createThrottleState,
  onBodyReady,
  isElementInViewport,
  findOneInViewport,
  findAllInViewport,
}

const DOMUtils = {
  getCurrentDomain,
  upsertStyle,
  removeStyle,
  generateHideCSS,
  applyHideStyle,
  waitForElement,
  waitForElements,
  createDebouncedObserver,
  debounce,
  throttle,
  createThrottleState,
  onBodyReady,
  isElementInViewport,
  findOneInViewport,
  findAllInViewport,
}
export default DOMUtils

// 避免重复初始化
if (typeof window !== 'undefined' && !window.DOMUtils) {
  window.DOMUtils = DOMUtils
  // 通知 ScriptLoader：DOMUtils 已就绪
  if (window.ScriptLoader) {
    ScriptLoader.markReady('DOMUtils')
  }
  console.log('[DOM] DOM工具模块已加载')
}
