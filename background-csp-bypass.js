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
