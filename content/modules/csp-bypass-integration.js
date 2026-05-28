/**
 * CSP Bypass Integration Module
 * Handles CSP blocked JS resources by fetching via background and injecting via scripting API
 */

(function () {
  'use strict'

  const LOG_PREFIX = '[ResourceAccelerator]'

  // State
  const state = {
    initialized: false,
    blockedScripts: new Set(),
    retryQueue: [],
    _spvHandler: null,
    _perfObserver: null,
  }

  /**
   * Initialize CSP blocked resource handler
   */
  function init() {
    if (state.initialized) {
      return
    }
    state.initialized = true

    // Monitor resource loading via PerformanceObserver
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            if (entry.initiatorType === 'script') {
              const url = entry.name
              if (url.startsWith('data:') || url.startsWith('blob:')) {
                continue
              }
              if (state.blockedScripts.has(url)) {
                continue
              }

              // 排除缓存命中：transferSize=0 但有内容
              if (entry.transferSize === 0 && entry.encodedBodySize > 0) {
                continue
              }

              // 排除有效的跨域资源（有 Timing-Allow-Origin）
              if (entry.transferSize > 0 || entry.encodedBodySize > 0) {
                continue
              }

              // 只处理真正的 CSP 阻止：transferSize=0, encodedBodySize=0, decodedBodySize=0
              // 且 responseStatus 为 0（网络层阻止）或 200（CSP 阻止但 HTTP 正常）
              if (entry.encodedBodySize === 0 && entry.decodedBodySize === 0) {
                // 进一步验证：必须是同源或有明确的阻止标记
                try {
                  const urlObj = new URL(url, location.href)
                  const isSameOrigin = urlObj.origin === location.origin
                  // 只有同源才通过 PerformanceObserver 处理
                  // 跨域 CSP 阻止由 securitypolicyviolation 事件处理
                  if (!isSameOrigin) {
                    continue
                  }
                } catch {
                  continue
                }

                state.blockedScripts.add(url)
                console.log(
                  `${LOG_PREFIX} [CSPBypass] Detected CSP blocked script: ${url.substring(0, 80)}`
                )
                handleCSPBlockedScript(url)
              }
            }
          }
        })
        observer.observe({ type: 'resource', buffered: true })
        state._perfObserver = observer
      } catch (e) {
        console.warn(`${LOG_PREFIX} PerformanceObserver for CSP not supported`)
      }
    }

    // Listen for securitypolicyviolation events
    state._spvHandler = (e) => {
      if (e.violatedDirective === 'script-src' || e.violatedDirective === 'script-src-elem') {
        const url = e.blockedURI
        if (
          url &&
          !url.startsWith('data:') &&
          !url.startsWith('blob:') &&
          !state.blockedScripts.has(url)
        ) {
          state.blockedScripts.add(url)
          console.log(`${LOG_PREFIX} [CSPBypass] CSP violation detected: ${url.substring(0, 80)}`)
          handleCSPBlockedScript(url)
        }
      }
    }
    window.addEventListener('securitypolicyviolation', state._spvHandler)

    console.log(`${LOG_PREFIX} [CSPBypass] Handler initialized`)
  }

  /**
   * Handle CSP blocked script
   */
  async function handleCSPBlockedScript(url) {
    const key = `csp_retry_${url}`
    if (state.retryQueue.includes(key)) {
      return
    }
    state.retryQueue.push(key)

    if (state.retryQueue.length > 50) {
      state.retryQueue.shift()
    }

    try {
      console.log(`${LOG_PREFIX} [CSPBypass] Fetching via background: ${url.substring(0, 80)}...`)

      // Fetch via background
      const response = await chrome.runtime.sendMessage({
        type: 'CSP_BYPASS_FETCH',
        url,
        resourceType: 'js',
      })

      if (!response?.success) {
        throw new Error(response?.error || 'Background fetch failed')
      }

      console.log(`${LOG_PREFIX} [CSPBypass] Fetch succeeded: ${response.size} bytes`)

      // Inject via scripting API
      const injectResponse = await chrome.runtime.sendMessage({
        type: 'CSP_BYPASS_SCRIPTING',
        url,
        code: response.code,
        resourceType: 'js',
      })

      if (injectResponse?.success) {
        console.log(`${LOG_PREFIX} [CSPBypass] Script injection succeeded`)
      } else {
        throw new Error(injectResponse?.error || 'Scripting injection failed')
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} [CSPBypass] Bypass failed:`, error.message)
    }
  }

  // Export
  window.CSPBypassHandler = {
    init,
    handleCSPBlockedScript,
    destroy() {
      if (state._spvHandler) {
        window.removeEventListener('securitypolicyviolation', state._spvHandler)
        state._spvHandler = null
      }
      if (state._perfObserver) {
        state._perfObserver.disconnect()
        state._perfObserver = null
      }
      state.initialized = false
      state.blockedScripts.clear()
      state.retryQueue = []
    },
  }

  // Auto init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
