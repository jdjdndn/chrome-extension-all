/**
 * Popup 隐藏元素管理模块
 * 负责隐藏元素设置的加载、保存和编辑
 * 按需加载：仅在 page tab 使用
 */

import { escapeHtml, getCurrentDomain, sendMessageToContentScript } from '../popup-core.js'

// 默认隐藏选择器（备用数据）
const DEFAULT_SELECTORS_BY_DOMAIN = {
  'douyin.com': [
    '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
    '.ooIf2jbM',
    '._e7lJDCC',
    '#island_076c3',
    '.ai-note-container',
    '.cursorPointer+*',
    'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])',
    '.danmakuContainer',
    '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)',
  ],
  'www.douyin.com': [
    '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
    '.ooIf2jbM',
    '._e7lJDCC',
    '#island_076c3',
    '.ai-note-container',
    '.cursorPointer+*',
    'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])',
    '.danmakuContainer',
    '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)',
  ],
  'bilibili.com': [
    '.left-entry>.v-popover-wrap:nth-child(n+2)',
    '.floor-single-card:has(.living)',
    '.bili-feed-card:has(.bili-live-card)',
    '.floor-single-card:has(.floor-title)',
    '.bili-feed-card:not(:has(a))',
    '.feed-card:not(:has(a))',
  ],
  'www.bilibili.com': [
    '.left-entry>.v-popover-wrap:nth-child(n+2)',
    '.floor-single-card:has(.living)',
    '.bili-feed-card:has(.bili-live-card)',
    '.floor-single-card:has(.floor-title)',
    '.bili-feed-card:not(:has(a))',
    '.feed-card:not(:has(a))',
  ],
  'pornhub.com': [
    '.cnhmmcccai',
    '.alpha',
    '#dbdcdkcbbd',
    '#countryRedirectMessage',
    '.video-wrapper>.hd.clear.original',
    '#welcome',
  ],
  'www.pornhub.com': [
    '.cnhmmcccai',
    '.alpha',
    '#dbdcdkcbbd',
    '#countryRedirectMessage',
    '.video-wrapper>.hd.clear.original',
    '#welcome',
  ],
  '4hu.tv': ['.kkm-content'],
  'www.4hu.tv': ['.kkm-content'],
}

// DOM elements
let hideElementsEnabledCheckbox = null
let hideElementsEditor = null
let selectorsEditor = null
let selectorsCount = null
let currentDomainName = null
let saveSelectorsBtn = null
let batchAddPanel = null
let batchSelectorsInput = null
let batchAddBtn = null
let closeBatchPanelBtn = null
let confirmBatchAddBtn = null

/**
 * 初始化隐藏元素管理模块
 */
export async function initHideElementsManager() {
  console.log('[HideElementsManager] 初始化')

  // 获取 DOM 元素
  hideElementsEnabledCheckbox = document.getElementById('hide-elements-enabled')
  hideElementsEditor = document.getElementById('hide-elements-editor')
  selectorsEditor = document.getElementById('selectors-editor')
  selectorsCount = document.getElementById('selectors-count')
  currentDomainName = document.getElementById('current-domain-name')
  saveSelectorsBtn = document.getElementById('save-selectors-btn')
  batchAddPanel = document.getElementById('batch-add-panel')
  batchSelectorsInput = document.getElementById('batch-selectors-input')
  batchAddBtn = document.getElementById('batch-add-selectors-btn')
  closeBatchPanelBtn = document.getElementById('close-batch-panel-btn')
  confirmBatchAddBtn = document.getElementById('confirm-batch-add-btn')

  // 绑定事件
  bindHideElementsEvents()

  // 加载设置
  await loadHideElementsSettings()
}

/**
 * 绑定隐藏元素事件
 */
function bindHideElementsEvents() {
  if (hideElementsEnabledCheckbox) {
    hideElementsEnabledCheckbox.addEventListener('change', () => {
      saveHideElementsSettings()
    })
  }

  async function saveSelectors() {
    const userSelectors = parseSelectorsFromEditor()
    await saveHideElementsSettings(userSelectors)
  }

  if (saveSelectorsBtn) {
    saveSelectorsBtn.addEventListener('click', saveSelectors)
  }

  // 批量添加面板事件
  if (batchAddBtn) {
    batchAddBtn.addEventListener('click', () => {
      if (batchAddPanel) {
        batchAddPanel.style.display = batchAddPanel.style.display === 'none' ? 'block' : 'none'
        if (batchSelectorsInput) {
          batchSelectorsInput.focus()
        }
      }
    })
  }

  if (closeBatchPanelBtn) {
    closeBatchPanelBtn.addEventListener('click', () => {
      if (batchAddPanel) {
        batchAddPanel.style.display = 'none'
        if (batchSelectorsInput) {
          batchSelectorsInput.value = ''
        }
      }
    })
  }

  if (confirmBatchAddBtn) {
    confirmBatchAddBtn.addEventListener('click', async () => {
      if (!batchSelectorsInput) {
        return
      }
      const inputText = batchSelectorsInput.value.trim()
      if (!inputText) {
        return
      }

      const newSelectors = parseSelectors(inputText)
      if (newSelectors.length === 0) {
        return
      }

      const domain = await getCurrentDomain()
      const result = await chrome.storage.local.get(['hideElementsSettings'])
      const allSettings = result.hideElementsSettings || {}
      const domainSettings = allSettings[domain] || { enabled: false, selectors: [] }
      const existingSelectors = domainSettings.selectors || []

      const mergedSelectors = [...new Set([...existingSelectors, ...newSelectors])]
      await saveHideElementsSettings(mergedSelectors)

      batchSelectorsInput.value = ''
      batchAddPanel.style.display = 'none'
      await renderHideSelectorsList()
    })
  }
}

/**
 * 解析 CSS 选择器
 */
function parseSelectors(text) {
  if (!text) {
    return []
  }

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l)
  if (lines.length > 1) {
    const result = []
    for (const line of lines) {
      if (
        (line.startsWith('"') && line.endsWith('"')) ||
        (line.startsWith("'") && line.endsWith("'"))
      ) {
        result.push(line.slice(1, -1))
      } else {
        result.push(line)
      }
    }
    return [...new Set(result)]
  }

  const result = []
  let current = ''
  let depth = 0
  let inQuote = null

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if ((char === '"' || char === "'") && depth === 0) {
      if (inQuote === char) {
        inQuote = null
        if (current.trim()) {
          result.push(current.trim())
        }
        current = ''
        continue
      } else if (!inQuote) {
        inQuote = char
        continue
      }
    }

    if (inQuote) {
      current += char
      continue
    }

    if (char === '(' || char === '[') {
      depth++
      current += char
    } else if (char === ')' || char === ']') {
      depth--
      current += char
    } else if (/\s/.test(char) && depth === 0) {
      if (current.trim()) {
        result.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    result.push(current.trim())
  }

  return [...new Set(result)]
}

/**
 * 获取默认隐藏选择器
 */
async function getDefaultHideSelectors() {
  try {
    const response = await sendMessageToContentScript({
      type: 'GET_DEFAULT_HIDE_SELECTORS',
    })
    if (response && response.success && response.selectors && response.selectors.length > 0) {
      return response.selectors
    }
  } catch (error) {
    console.log('[隐藏元素] 获取失败:', error.message)
  }

  const domain = await getCurrentDomain()
  if (domain && DEFAULT_SELECTORS_BY_DOMAIN[domain]) {
    return DEFAULT_SELECTORS_BY_DOMAIN[domain]
  }

  return []
}

/**
 * 加载隐藏元素设置
 */
export async function loadHideElementsSettings() {
  const domain = await getCurrentDomain()
  const result = await chrome.storage.local.get(['hideElementsSettings'])
  const allSettings = result.hideElementsSettings || {}

  const defaultSelectors = await getDefaultHideSelectors()

  let localServerSelectors = []
  if (domain) {
    try {
      const domainsToTry = [domain]
      if (domain.startsWith('www.')) {
        domainsToTry.push(domain.slice(4))
      } else {
        domainsToTry.push('www.' + domain)
      }

      for (const tryDomain of domainsToTry) {
        const response = await fetch(`http://localhost:3000/api/data/selectors/${tryDomain}`, {
          signal: AbortSignal.timeout(2000),
        })
        const data = await response.json()
        if (
          data.success &&
          data.data &&
          (Array.isArray(data.data) || typeof data.data === 'string')
        ) {
          if (Array.isArray(data.data)) {
            localServerSelectors = data.data
          } else if (typeof data.data === 'string' && data.data.trim()) {
            localServerSelectors = data.data
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s)
          }
          break
        }
      }
    } catch (e) {
      console.log('[隐藏元素] 本地服务器加载失败:', e.message)
    }
  }

  const hasCustomSettings = domain && allSettings[domain]
  let settings
  if (hasCustomSettings) {
    settings = allSettings[domain]
    const mergedSelectors = [
      ...new Set([...defaultSelectors, ...(settings.selectors || []), ...localServerSelectors]),
    ]
    settings.selectors = mergedSelectors
  } else if (localServerSelectors.length > 0) {
    settings = {
      enabled: true,
      selectors: [...new Set([...defaultSelectors, ...localServerSelectors])],
    }
  } else {
    settings = {
      enabled: false,
      selectors: defaultSelectors,
    }
  }

  if (hideElementsEnabledCheckbox) {
    hideElementsEnabledCheckbox.checked = settings.enabled
  }

  await loadSelectorsEditor()

  const shouldShowManager =
    settings.enabled || (settings.selectors && settings.selectors.length > 0)
  const manager = document.getElementById('hide-elements-manager')
  if (manager) {
    manager.style.display = shouldShowManager ? 'block' : 'none'
  }
}

/**
 * 保存隐藏元素设置
 */
export async function saveHideElementsSettings(userSelectors = null) {
  const enabled = hideElementsEnabledCheckbox ? hideElementsEnabledCheckbox.checked : false
  const domain = await getCurrentDomain()

  if (!domain) {
    console.error('Failed to save hide elements settings: unable to get current domain')
    return
  }

  const defaultSelectors = await getDefaultHideSelectors()

  let localServerSelectors = []
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000),
    })
    const data = await response.json()
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  if (userSelectors === null) {
    userSelectors = parseSelectorsFromEditor()
  }

  userSelectors = [...new Set(userSelectors)]

  const mergedSelectors = [
    ...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors]),
  ]

  const result = await chrome.storage.local.get(['hideElementsSettings'])
  const allSettings = result.hideElementsSettings || {}
  allSettings[domain] = { enabled, selectors: userSelectors }

  await chrome.storage.local.set({ hideElementsSettings: allSettings })

  // 同步用户选择器到本地服务器
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
    await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userSelectors),
    })
  } catch (e) {
    // 忽略
  }

  await loadSelectorsEditor()

  // 通知 content script
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: 'UPDATE_HIDE_ELEMENTS',
          enabled,
          selectors: mergedSelectors,
        })
        .catch(() => {})
    }
  } catch (error) {
    console.error('Failed to notify content script:', error)
  }
}

/**
 * 加载选择器编辑器
 */
async function loadSelectorsEditor() {
  const domain = await getCurrentDomain()
  if (!domain) {
    return
  }

  if (currentDomainName) {
    currentDomainName.textContent = domain
  }

  const defaultSelectors = await getDefaultHideSelectors()

  let localServerSelectors = []
  try {
    const domainsToTry = [domain]
    if (domain.startsWith('www.')) {
      domainsToTry.push(domain.slice(4))
    } else {
      domainsToTry.push('www.' + domain)
    }

    for (const tryDomain of domainsToTry) {
      const response = await fetch(`http://localhost:3000/api/data/selectors/${tryDomain}`, {
        signal: AbortSignal.timeout(2000),
      })
      const data = await response.json()
      if (data.success && data.data && Array.isArray(data.data)) {
        localServerSelectors = data.data
        break
      }
    }
  } catch (e) {
    // 忽略
  }

  const result = await chrome.storage.local.get(['hideElementsSettings'])
  const allSettings = result.hideElementsSettings || {}
  const domainSettings = allSettings[domain] || { selectors: [] }
  const userSelectors = domainSettings.selectors || []

  if (selectorsEditor) {
    selectorsEditor.value = userSelectors.join('\n')
  }

  const totalSelectors = [
    ...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors]),
  ]
  updateSelectorsCount(
    totalSelectors.length,
    defaultSelectors.length,
    localServerSelectors.length,
    userSelectors.length
  )

  await renderHideSelectorsList()
}

/**
 * 更新选择器计数
 */
function updateSelectorsCount(total, defaultCount, localServerCount, userCount) {
  if (selectorsCount) {
    if (
      total !== null &&
      defaultCount !== null &&
      localServerCount !== null &&
      userCount !== null
    ) {
      selectorsCount.textContent = `(${total}个 - 默认${defaultCount}+服务器${localServerCount}+用户${userCount})`
    } else if (selectorsEditor) {
      const selectors = parseSelectorsFromEditor()
      selectorsCount.textContent = `(${selectors.length}个用户选择器)`
    }
  }
}

/**
 * 从编辑器解析选择器
 */
function parseSelectorsFromEditor() {
  if (!selectorsEditor) {
    return []
  }
  const text = selectorsEditor.value.trim()
  if (!text) {
    return []
  }
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)
  return [...new Set(lines)]
}

/**
 * 渲染隐藏选择器列表
 */
export async function renderHideSelectorsList() {
  const domain = await getCurrentDomain()
  if (!domain) {
    return
  }

  const defaultSelectors = await getDefaultHideSelectors()

  const result = await chrome.storage.local.get(['hideElementsSettings'])
  const allSettings = result.hideElementsSettings || {}
  const domainSettings = allSettings[domain] || {}
  const userSelectors = domainSettings.selectors || []

  let localServerSelectors = []
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000),
    })
    const data = await response.json()
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
      }
    }
  } catch (e) {
    // 忽略
  }

  const allSelectors = [
    ...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors]),
  ]

  const editor = document.getElementById('hide-elements-editor')
  if (!editor) {
    return
  }

  editor.innerHTML = ''

  allSelectors.forEach((selector) => {
    const item = document.createElement('div')
    item.className = 'selector-item'

    let source = '用户添加'
    if (defaultSelectors.includes(selector)) {
      source = '默认'
      item.classList.add('default-selector')
    } else if (localServerSelectors.includes(selector)) {
      source = '本地服务器'
      item.classList.add('local-server-selector')
    }

    item.innerHTML = `
      <span class="selector-text">${escapeHtml(selector)}</span>
      <span class="selector-source">${source}</span>
      <button class="selector-delete" data-selector="${escapeHtml(selector)}" title="删除">×</button>
    `

    editor.appendChild(item)
  })

  editor.querySelectorAll('.selector-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const selectorToDelete = btn.getAttribute('data-selector')
      await deleteSelector(selectorToDelete)
    })
  })
}

/**
 * 删除选择器
 */
async function deleteSelector(selector) {
  const domain = await getCurrentDomain()
  if (!domain) {
    return
  }

  const result = await chrome.storage.local.get(['hideElementsSettings'])
  const allSettings = result.hideElementsSettings || {}
  const domainSettings = allSettings[domain] || {}
  const currentSelectors = domainSettings.selectors || []

  const defaultSelectors = await getDefaultHideSelectors()
  let localServerSelectors = []
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000),
    })
    const data = await response.json()
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
      }
    }
  } catch (e) {
    // 忽略
  }

  if (defaultSelectors.includes(selector) || localServerSelectors.includes(selector)) {
    return
  }

  const newSelectors = currentSelectors.filter((s) => s !== selector)
  await saveHideElementsSettings(newSelectors)
  await renderHideSelectorsList()
}
