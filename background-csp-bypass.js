// ========== CSP绕过支持 ==========
// 处理来自content script的CSP绕过请求

/**
 * 策略2：Background Fetch
 * 在background中fetch资源，通过消息传递给content script
 */
async function handleCSPBypassFetch(message, sender, sendResponse) {
  const { url, resourceType } = message

  try {
    console.log(`[CSPBypass] Background fetching: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: resourceType === 'css' ? 'text/css' : 'application/javascript',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const code = await response.text()

    console.log(`[CSPBypass] Background fetch succeeded: ${code.length} bytes`)

    sendResponse({
      success: true,
      code,
      size: code.length,
    })
  } catch (error) {
    console.error(`[CSPBypass] Background fetch failed:`, error)
    sendResponse({
      success: false,
      error: error.message,
    })
  }

  return true // 保持消息通道开启
}

/**
 * 策略3：chrome.scripting.executeScript
 * 使用官方API注入脚本到页面
 */
async function handleCSPBypassScripting(message, sender, sendResponse) {
  const { code, resourceType } = message
  const tabId = sender.tab?.id

  if (!tabId) {
    sendResponse({
      success: false,
      error: 'No tab ID',
    })
    return true
  }

  try {
    console.log(`[CSPBypass] Scripting injecting to tab ${tabId}`)

    if (resourceType === 'js') {
      // 注入JS代码到MAIN世界
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (scriptCode) => {
          const script = document.createElement('script')
          script.textContent = scriptCode
          ;(document.head || document.documentElement).appendChild(script)
        },
        args: [code],
        injectImmediately: true,
      })
    } else if (resourceType === 'css') {
      // 注入CSS
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: code,
      })
    }

    console.log(`[CSPBypass] Scripting injection succeeded`)

    sendResponse({
      success: true,
      size: code.length,
    })
  } catch (error) {
    console.error(`[CSPBypass] Scripting injection failed:`, error)
    sendResponse({
      success: false,
      error: error.message,
    })
  }

  return true // 保持消息通道开启
}

// 注册消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // CSP绕过 - Background Fetch
  if (message.type === 'CSP_BYPASS_FETCH') {
    handleCSPBypassFetch(message, sender, sendResponse)
    return true
  }

  // CSP绕过 - Scripting注入
  if (message.type === 'CSP_BYPASS_SCRIPTING') {
    handleCSPBypassScripting(message, sender, sendResponse)
    return true
  }
})

console.log('[Background] CSP bypass handlers registered')

// ========== JS资源DNR重定向规则 (ID 4000-4999) ==========
/**
 * 注册JS重定向规则
 * 策略：只注册 regexFilter 规则，保留原始版本号，避免 API 不兼容
 */
let _rulesRegistering = false

async function registerJSRedirectRules() {
  // 防止并发注册
  if (_rulesRegistering) {
    console.log('[Background] 规则正在注册中，跳过重复调用')
    return
  }

  _rulesRegistering = true
  try {
    // 移除所有现有的 JS 重定向规则 (ID 4000-5000)
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const oldIds = existingRules
      .filter((rule) => rule.id >= 4000 && rule.id < 5000)
      .map((rule) => rule.id)

    if (oldIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds })
      console.log(`[Background] 移除旧的 JS 重定向规则 ${oldIds.length} 条`)
    }

    // 只注册 regexFilter 规则（保留版本号）
    if (!self.AUTO_GENERATED_JS_REDIRECT_RULES) {
      console.log('[Background] 无自动生成规则，跳过注册')
      return
    }

    const regexRules = self.AUTO_GENERATED_JS_REDIRECT_RULES.filter((r) => r.condition.regexFilter)

    if (regexRules.length === 0) {
      console.log('[Background] 无 regexFilter 规则，跳过注册')
      return
    }

    // 限制规则数量（Chrome DNR 限制 5000 条动态规则）
    const maxRules = Math.min(regexRules.length, 4500)
    const rulesToRegister = regexRules.slice(0, maxRules)

    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rulesToRegister })
    console.log(
      `[Background] 已注册 ${rulesToRegister.length} 条 regexFilter JS 重定向规则（保留版本号）`
    )

    if (regexRules.length > maxRules) {
      console.warn(
        `[Background] 规则超限，仅注册前 ${maxRules} 条，跳过 ${regexRules.length - maxRules} 条`
      )
    }
  } catch (error) {
    console.error('[Background] 注册 JS 重定向规则失败:', error)
  } finally {
    _rulesRegistering = false
  }
}

// 在扩展启动时注册规则
chrome.runtime.onStartup.addListener(() => {
  registerJSRedirectRules()
})

// 在安装时也注册
chrome.runtime.onInstalled.addListener(() => {
  registerJSRedirectRules()
})

// 暴露到全局，供 background.js 初始化时调用
self.registerJSRedirectRules = registerJSRedirectRules
