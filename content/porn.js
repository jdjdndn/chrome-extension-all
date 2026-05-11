// Content script for pornhub.com
// 使用公共模块重构

'use strict'

import { createScriptGuard } from './utils/script-guard.js'
import { createStyleInjector } from './utils/style-injector.js'

// 防重复加载
const guard = createScriptGuard('Porn')
if (guard.check()) {
  throw new Error('脚本已加载')
}

// ========== 配置 ==========
const STYLE_TAG_ID = 'porn-content-hide-style'
const styleInjector = createStyleInjector(STYLE_TAG_ID)
let currentSelectors = []

const DEFAULT_HIDE_SELECTORS = [
  '.cnhmmcccai',
  '.alpha',
  '#dbdcdkcbbd',
  '#countryRedirectMessage',
  '.video-wrapper>.hd.clear.original',
  '#welcome',
]

const BLOCKED_DOMAINS = []

// ========== 安全检查 ==========
function getDOMUtils() {
  if (typeof DOMUtils === 'undefined') {
    console.error('[Pornhub脚本] DOMUtils 未加载')
    return null
  }
  return DOMUtils
}

function getStorageUtils() {
  if (typeof StorageUtils === 'undefined') {
    console.error('[Pornhub脚本] StorageUtils 未加载')
    return null
  }
  return StorageUtils
}

function getMessagingUtils() {
  if (typeof MessagingUtils === 'undefined') {
    console.error('[Pornhub脚本] MessagingUtils 未加载')
    return null
  }
  return MessagingUtils
}

// ========== 工具函数 ==========
// 使用 DOMUtils.findOneInViewport 替代本地实现
function findOne(selector) {
  const utils = getDOMUtils()
  if (!utils) {
    return null
  }
  return utils.findOneInViewport(selector, { checkVisibility: true, checkDimensions: true })
}

// ========== 隐藏元素 ==========
function updateHideElements(selectors) {
  styleInjector.remove()
  currentSelectors = selectors?.length > 0 ? selectors : []

  if (currentSelectors.length > 0) {
    const hideCSS = currentSelectors.map((sel) => `${sel} { display: none !important; }`).join('\n')
    styleInjector.inject(hideCSS)
    console.log('[Pornhub脚本] 已隐藏元素:', currentSelectors)
  }
}

function injectHideStyle() {
  updateHideElements(DEFAULT_HIDE_SELECTORS)
}

// ========== 自动点击 ==========
function clickOver18Button() {
  const button = findOne('.buttonOver18')
  if (button) {
    button.click()
    console.log('[Pornhub脚本] 已点击 18+ 按钮')
  }
}

function cleanup() {
  console.log('[Pornhub脚本] 清理状态...')
  styleInjector.remove()
  guard.reset()
}

// ========== 存储 ==========
async function loadDomainHideSettings() {
  const domUtils = getDOMUtils()
  if (!domUtils) {
    return
  }

  const domain = domUtils.getCurrentDomain()
  if (!domain) {
    return
  }

  // 尝试从本地服务器加载选择器
  let serverSelectors = []
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000),
    })
    const data = await response.json()
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        serverSelectors = data.data
      } else if (typeof data.data === 'string' && data.data.trim()) {
        serverSelectors = data.data
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
      }
      if (serverSelectors.length > 0) {
        console.log('[Pornhub脚本] 从本地服务器加载选择器:', serverSelectors.length, '个')
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  // 从存储获取用户选择器
  const storageUtils = getStorageUtils()
  let userSelectors = []
  if (storageUtils) {
    try {
      const settings = await storageUtils.getDomainSettings('hideElementsSettings', domain)
      userSelectors = settings?.selectors || []
    } catch (error) {
      console.warn('[Pornhub脚本] 加载用户设置失败:', error)
    }
  }

  // 合并：默认 + 本地服务器 + 用户添加
  const mergedSelectors = [
    ...new Set([...DEFAULT_HIDE_SELECTORS, ...serverSelectors, ...userSelectors]),
  ]

  updateHideElements(mergedSelectors)
  console.log(
    '[Pornhub脚本] 合并后选择器:',
    mergedSelectors.length,
    '个 (默认:',
    DEFAULT_HIDE_SELECTORS.length,
    ', 服务器:',
    serverSelectors.length,
    ', 用户:',
    userSelectors.length,
    ')'
  )
}

// ========== 初始化 ==========
async function registerBlockedDomains() {
  const messagingUtils = getMessagingUtils()
  if (!messagingUtils) {
    return
  }

  try {
    const result = await messagingUtils.registerBlockedDomains('pornhub.com', BLOCKED_DOMAINS)
    if (result?.success) {
      console.log('[Pornhub脚本] 已向 background 注册 blockedDomains')
    }
  } catch (error) {
    console.warn('[Pornhub脚本] 注册域名失败:', error)
  }
}

// ========== 链接点击处理 ==========
function handleLinkClick(event) {
  const link = event.target.closest('a')
  if (!link || !link.href) {
    return
  }

  // 只处理 target="_blank" 的链接
  if (link.target !== '_blank') {
    return
  }

  // 阻止其他监听器
  event.preventDefault()
  event.stopImmediatePropagation()

  // 在新标签页打开
  window.open(link.href, '_blank')
  console.log('[Pornhub脚本] 新标签页打开:', link.href)
}

// ========== 初始化 ==========
function init() {
  // 异步加载设置，错误时使用默认值
  loadDomainHideSettings().catch((err) => console.error('[Pornhub脚本] 加载设置失败:', err))
  registerBlockedDomains().catch((err) => console.error('[Pornhub脚本] 注册域名失败:', err))

  // 在捕获阶段处理链接点击
  document.addEventListener('click', handleLinkClick, true)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', clickOver18Button)
  } else {
    clickOver18Button()
  }

  // 标记 content script 已就绪
  if (typeof ContentBridge !== 'undefined') {
    ContentBridge.markReady()
  }

  guard.markInitialized()
  console.log('[Pornhub脚本] 脚本已加载')
}

// ========== 导出配置 ==========
// 配置通过消息处理器提供，不再直接导出到window

// ========== 消息处理设置 ==========
setupMessageHandler()

// ========== 启动 ==========
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
