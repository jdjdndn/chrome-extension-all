/**
 * Popup 域名管理模块
 * 负责加载/添加/删除阻断域名
 * 按需加载：仅在 page tab 使用
 */

import { sendMessage, escapeHtml } from '../popup-core.js'

// Blocked domains UI elements (按需获取)
let blockedDomainsList = null
let blockedResponseDomainsList = null
let domainInput = null
let responseDomainInput = null
let addDomainBtn = null
let addResponseDomainBtn = null
let clearDomainsBtn = null
let clearResponseDomainsBtn = null

/**
 * 初始化域名管理模块
 */
export async function initDomainManager() {
  console.log('[DomainManager] 初始化')

  // 获取 DOM 元素（按需）
  blockedDomainsList = document.getElementById('blocked-domains-list')
  blockedResponseDomainsList = document.getElementById('blocked-response-domains-list')
  domainInput = document.getElementById('domain-input')
  responseDomainInput = document.getElementById('response-domain-input')
  addDomainBtn = document.getElementById('add-domain-btn')
  addResponseDomainBtn = document.getElementById('add-response-domain-btn')
  clearDomainsBtn = document.getElementById('clear-domains-btn')
  clearResponseDomainsBtn = document.getElementById('clear-response-domains-btn')

  // 绑定事件
  bindDomainEvents()
}

/**
 * 绑定域名管理事件
 */
function bindDomainEvents() {
  if (addDomainBtn) {
    addDomainBtn.addEventListener('click', () => {
      const input = domainInput.value.trim()
      const domains = parseDomainInput(input)
      if (domains.length === 0) {
        showToast('请输入有效的域名（例如: tracking.example.com 或 "api1.com, api2.com"）', 'warning')
        return
      }
      addDomains(domains)
    })
  }

  if (domainInput) {
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addDomainBtn.click()
      }
    })
  }

  if (addResponseDomainBtn) {
    addResponseDomainBtn.addEventListener('click', () => {
      const input = responseDomainInput.value.trim()
      const domains = parseDomainInput(input)
      if (domains.length === 0) {
        showToast('请输入有效的域名（例如: api.example.com 或 "api1.com, api2.com"）', 'warning')
        return
      }
      addResponseDomains(domains)
    })
  }

  if (responseDomainInput) {
    responseDomainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addResponseDomainBtn.click()
      }
    })
  }

  if (clearDomainsBtn) {
    clearDomainsBtn.addEventListener('click', clearAllDomains)
  }

  if (clearResponseDomainsBtn) {
    clearResponseDomainsBtn.addEventListener('click', clearAllResponseDomains)
  }
}

/**
 * 解析域名输入 - 支持单个和逗号分隔的多个域名
 */
function parseDomainInput(input) {
  if (!input) {
    return []
  }
  const cleaned = input.replace(/['"]/g, '').trim()
  if (!cleaned) {
    return []
  }
  return cleaned
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d)
}

/**
 * 加载阻断域名
 */
export async function loadBlockedDomains() {
  try {
    const result = await sendMessage('GET_BLOCKED_DOMAINS')
    console.log('[Blocked Domains] Response:', result)
    if (result) {
      renderBlockedDomains(result.blockedDomains || [])
      renderBlockedResponseDomains(result.blockedResponseDomains || [])
    } else {
      renderBlockedDomains([])
      renderBlockedResponseDomains([])
    }
  } catch (error) {
    console.error('[Blocked Domains] Error loading:', error)
    renderBlockedDomains([])
    renderBlockedResponseDomains([])
  }
}

/**
 * 渲染阻断域名列表
 */
function renderBlockedDomains(domains) {
  if (!blockedDomainsList) {
    return
  }

  if (!domains || domains.length === 0) {
    blockedDomainsList.innerHTML = '<div class="empty-state">暂无阻止的域名</div>'
    if (clearDomainsBtn) {
      clearDomainsBtn.disabled = true
    }
    return
  }

  blockedDomainsList.innerHTML = domains
    .map(
      (domain) => `
      <div class="domain-list-item">
        <span class="domain-text" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
        <button class="domain-remove-btn remove-domain" data-domain="${escapeHtml(domain)}">删除</button>
      </div>
    `
    )
    .join('')

  document.querySelectorAll('.remove-domain').forEach((btn) => {
    btn.addEventListener('click', () => removeDomain(btn.dataset.domain))
  })

  if (clearDomainsBtn) {
    clearDomainsBtn.disabled = false
  }
}

/**
 * 渲染阻断响应域名列表
 */
function renderBlockedResponseDomains(domains) {
  if (!blockedResponseDomainsList) {
    return
  }

  if (!domains || domains.length === 0) {
    blockedResponseDomainsList.innerHTML = '<div class="empty-state">暂无阻止的域名</div>'
    if (clearResponseDomainsBtn) {
      clearResponseDomainsBtn.disabled = true
    }
    return
  }

  blockedResponseDomainsList.innerHTML = domains
    .map(
      (domain) => `
      <div class="domain-list-item">
        <span class="domain-text" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
        <button class="domain-remove-btn remove-response-domain" data-domain="${escapeHtml(domain)}" style="background-color: #e0a800;">删除</button>
      </div>
    `
    )
    .join('')

  document.querySelectorAll('.remove-response-domain').forEach((btn) => {
    btn.addEventListener('click', () => removeResponseDomain(btn.dataset.domain))
  })

  if (clearResponseDomainsBtn) {
    clearResponseDomainsBtn.disabled = false
  }
}

/**
 * 添加阻断域名
 */
async function addDomains(domains) {
  let addedCount = 0
  let failedCount = 0

  for (const domain of domains) {
    const result = await sendMessage('ADD_BLOCKED_DOMAIN', { domain })
    if (result?.success) {
      addedCount++
    } else {
      failedCount++
    }
  }

  if (addedCount > 0) {
    domainInput.value = ''
    await loadBlockedDomains()
  }

  if (failedCount > 0) {
    showToast(`成功添加 ${addedCount} 个域名，失败 ${failedCount} 个`, 'warning')
  }
}

/**
 * 移除阻断域名
 */
async function removeDomain(domain) {
  const result = await sendMessage('REMOVE_BLOCKED_DOMAIN', { domain })
  if (result?.success) {
    const updatedResult = await sendMessage('GET_BLOCKED_DOMAINS')
    renderBlockedDomains(updatedResult?.blockedDomains || [])
  } else {
    showToast('Failed to remove domain', 'error')
  }
}

/**
 * 添加阻断响应域名
 */
async function addResponseDomains(domains) {
  let addedCount = 0
  let failedCount = 0

  for (const domain of domains) {
    const result = await sendMessage('ADD_BLOCKED_RESPONSE_DOMAIN', { domain })
    if (result?.success) {
      addedCount++
    } else {
      failedCount++
    }
  }

  if (addedCount > 0) {
    responseDomainInput.value = ''
    await loadBlockedDomains()
  }

  if (failedCount > 0) {
    showToast(`成功添加 ${addedCount} 个域名，失败 ${failedCount} 个`, 'warning')
  }
}

/**
 * 移除阻断响应域名
 */
async function removeResponseDomain(domain) {
  const result = await sendMessage('REMOVE_BLOCKED_RESPONSE_DOMAIN', { domain })
  if (result?.success) {
    const updatedResult = await sendMessage('GET_BLOCKED_DOMAINS')
    renderBlockedResponseDomains(updatedResult?.blockedResponseDomains || [])
  } else {
    showToast('Failed to remove response domain', 'error')
  }
}

/**
 * 清空所有阻断域名
 */
async function clearAllDomains() {
  const result = await sendMessage('GET_BLOCKED_DOMAINS')
  if (!result || !result.blockedDomains || result.blockedDomains.length === 0) {
    return
  }

  for (const domain of result.blockedDomains) {
    await sendMessage('REMOVE_BLOCKED_DOMAIN', { domain })
  }
  await loadBlockedDomains()
}

/**
 * 清空所有阻断响应域名
 */
async function clearAllResponseDomains() {
  const result = await sendMessage('GET_BLOCKED_DOMAINS')
  if (!result || !result.blockedResponseDomains || result.blockedResponseDomains.length === 0) {
    return
  }

  for (const domain of result.blockedResponseDomains) {
    await sendMessage('REMOVE_BLOCKED_RESPONSE_DOMAIN', { domain })
  }
  await loadBlockedDomains()
}
