// 通用脚本：非中文网站转中文
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict'

if (window.LangToZhLoaded) {
  console.log('[通用脚本] 语言转换脚本已加载，跳过')
} else {
  window.LangToZhLoaded = true

  const TARGET_LANG = 'zh-cn'
  const LANG_PATTERNS = ['en-us', 'en', 'fr', 'de', 'ja', 'ko', 'pt', 'es', 'ru', 'zh-tw']

  function needsConversion(url) {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const origin = urlObj.origin

      for (const lang of LANG_PATTERNS) {
        const pattern = new RegExp(`\/${lang}\/`, 'i')
        if (pattern.test(pathname)) {
          return origin + pathname.replace(pattern, `/${TARGET_LANG}/`)
        }
      }
      return false
    } catch {
      return false
    }
  }

  function convertLangInURL() {
    const newUrl = needsConversion(window.location.href)
    if (newUrl) {
      console.log('[通用脚本] 语言转换:', window.location.href, '->', newUrl)
      location.href = newUrl
    }
  }

  // 监听 history 变化（SPA 应用）
  const originalPushState = history.pushState
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    convertLangInURL()
  }

  window.addEventListener('popstate', convertLangInURL)

  // 页面加载时执行
  convertLangInURL()

  console.log('[通用脚本] 语言转换脚本已加载')
}
