// 等待 StorageBridge module 加载完成后再加载 console.js
// 超时 3 秒后无论如何加载 console.js，避免 StorageBridge 加载失败导致整个面板不可用
(function waitStorageBridge() {
  console.log('[ConsoleLoader] 开始执行')
  var startTime = Date.now()
  function check() {
    console.log('[ConsoleLoader] 检查 StorageBridge, 已等待:', Date.now() - startTime, 'ms')
    if (window.StorageBridge) {
      console.log('[ConsoleLoader] StorageBridge 已就绪')
      loadConsoleJs()
    } else if (Date.now() - startTime > 3000) {
      console.warn('[ConsoleLoader] StorageBridge 加载超时，直接加载 console.js')
      loadConsoleJs()
    } else {
      setTimeout(check, 50)
    }
  }
  function loadConsoleJs() {
    if (window._consoleJsLoaded) {
      console.log('[ConsoleLoader] console.js 已加载过，跳过')
      return
    }
    window._consoleJsLoaded = true
    console.log('[ConsoleLoader] 开始加载 console.js')
    var s = document.createElement('script')
    s.src = 'console.js'
    s.onload = function() {
      console.log('[ConsoleLoader] console.js 加载完成')
    }
    s.onerror = function(e) {
      console.error('[ConsoleLoader] console.js 加载失败:', e)
    }
    document.body.appendChild(s)
  }
  check()
})()
