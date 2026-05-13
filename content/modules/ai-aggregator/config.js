// content/modules/ai-aggregator/config.js
/**
 * AI 聚合问答 - 网站配置模块
 */

// 默认 AI 网站配置
const DEFAULT_AI_SITES = [
  {
    id: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    enabled: true,
    selectors: {
      input: "textarea, [contenteditable='true']",
      sendButton: "button[type='submit'], [aria-label*='发送']",
      responseContainer: "[class*='message'], [class*='chat']",
      loginIndicator: "[class*='avatar'], [class*='user']",
    },
    options: {
      deepThink: {
        label: '深度思考',
        type: 'boolean',
        default: false,
        selector: "[class*='deep-think'] input, [class*='reasoning'] input",
      },
    },
  },
  {
    id: 'tongyi',
    name: '通义千问',
    url: 'https://tongyi.aliyun.com/qianwen/',
    enabled: true,
    selectors: {
      input: "textarea, [contenteditable='true']",
      sendButton: "button[class*='send']",
      responseContainer: "[class*='message'], [class*='response']",
      loginIndicator: "[class*='avatar'], [class*='user']",
    },
    options: {
      deepThink: {
        label: '深度思考',
        type: 'boolean',
        default: false,
        selector: "[class*='thinking'] input",
      },
      webSearch: {
        label: '联网搜索',
        type: 'boolean',
        default: false,
        selector: "[class*='web-search'] input",
      },
    },
  },
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn/',
    enabled: true,
    selectors: {
      input: "textarea, [contenteditable='true']",
      sendButton: "button[class*='send']",
      responseContainer: "[class*='message'], [class*='chat']",
      loginIndicator: "[class*='avatar'], [class*='user']",
    },
    options: {
      deepThink: {
        label: '长思考',
        type: 'boolean',
        default: false,
        selector: "[class*='thinking'] input",
      },
    },
  },
  {
    id: 'yiyan',
    name: '文心一言',
    url: 'https://yiyan.baidu.com/',
    enabled: true,
    selectors: {
      input: "textarea, [contenteditable='true']",
      sendButton: "button[class*='send']",
      responseContainer: "[class*='message'], [class*='response']",
      loginIndicator: "[class*='avatar'], [class*='user']",
    },
    options: {},
  },
  {
    id: 'chatglm',
    name: '智谱清言',
    url: 'https://chatglm.cn/',
    enabled: true,
    selectors: {
      input: "textarea, [contenteditable='true']",
      sendButton: "button[class*='send']",
      responseContainer: "[class*='message'], [class*='chat']",
      loginIndicator: "[class*='avatar'], [class*='user']",
    },
    options: {
      deepThink: {
        label: '深度思考',
        type: 'boolean',
        default: false,
        selector: "[class*='thinking'] input",
      },
    },
  },
]

// 全局配置
const AGGREGATOR_CONFIG = {
  maxConcurrent: 3, // 最大并发标签页数
  autoCloseTabs: true, // 完成后自动关闭 AI 标签页
  pageLoadTimeout: 15000,
  responseTimeout: 60000,
  retryCount: 2,
  pollingInterval: 500, // 轮询间隔(ms)
}

// 存储键
const STORAGE_KEY = 'ai_aggregator_settings'

/**
 * 获取 AI 网站配置
 */
async function getAISites() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    if (result[STORAGE_KEY]?.sites) {
      return result[STORAGE_KEY].sites
    }
    return DEFAULT_AI_SITES
  } catch (error) {
    console.error('[AI Aggregator] 获取配置失败:', error)
    return DEFAULT_AI_SITES
  }
}

/**
 * 保存 AI 网站配置
 */
async function saveAISites(sites) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        ...result[STORAGE_KEY],
        sites: sites,
      },
    })
  } catch (error) {
    console.error('[AI Aggregator] 保存配置失败:', error)
  }
}

/**
 * 获取启用的 AI 网站列表
 */
async function getEnabledAISites() {
  const sites = await getAISites()
  return sites.filter((site) => site.enabled)
}

/**
 * 更新单个 AI 网站配置
 */
async function updateAISite(siteId, updates) {
  const sites = await getAISites()
  const index = sites.findIndex((s) => s.id === siteId)
  if (index !== -1) {
    sites[index] = { ...sites[index], ...updates }
    await saveAISites(sites)
    return true
  }
  return false
}

/**
 * 获取全局配置
 */
function getAggregatorConfig() {
  return { ...AGGREGATOR_CONFIG }
}

// 导出（支持 ES Module 和全局变量）
if (typeof window !== 'undefined') {
  window.AIAggregatorConfig = {
    DEFAULT_AI_SITES,
    AGGREGATOR_CONFIG,
    getAISites,
    saveAISites,
    getEnabledAISites,
    updateAISite,
    getAggregatorConfig,
  }
}

export {
  DEFAULT_AI_SITES,
  AGGREGATOR_CONFIG,
  getAISites,
  saveAISites,
  getEnabledAISites,
  updateAISite,
  getAggregatorConfig,
}
