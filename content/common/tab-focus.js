// 通用脚本：Tab 激活时自动 focus document
// 解决切换 tab 后键盘事件不响应的问题，无需用户先点击页面
// 使用 visibilitychange API，无需 background 消息
// @match *://*/*

'use strict'

if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'tab-focus',
    dependencies: [],
    onReady: () => initTabFocus(),
  })
} else {
  initTabFocus()
}

function initTabFocus() {
  if (window.TabFocusLoaded) {
    return
  }

  const handler = () => {
    if (document.visibilityState === 'visible') {
      window.focus()
    }
  }

  function enable() {
    if (window._ycTabFocusActive) {
      return
    }
    document.addEventListener('visibilitychange', handler)
    window._ycTabFocusActive = true
  }
  function disable() {
    if (!window._ycTabFocusActive) {
      return
    }
    document.removeEventListener('visibilitychange', handler)
    window._ycTabFocusActive = false
  }

  window.TabFocusLoaded = true

  if (!window.getScriptSwitch || !window.getScriptSwitch('tab-focus')) {
    console.log('[通用脚本] Tab焦点激活已禁用')
  } else {
    enable()
    console.log('[通用脚本] Tab焦点激活已加载')
  }

  // 运行时热切换
  const onStorageChange = (changes, area) => {
    if (area !== 'local' || !changes.scriptSwitches) {
      return
    }
    const next = changes.scriptSwitches.newValue || {}
    if (next['tab-focus'] === false) {
      disable()
    } else {
      enable()
    }
  }
  try {
    chrome.storage.onChanged.addListener(onStorageChange)
  } catch {
    /* empty */
  }

  window.TabFocusDestroy = () => {
    disable()
    try {
      chrome.storage.onChanged.removeListener(onStorageChange)
    } catch {
      /* empty */
    }
    window.TabFocusLoaded = false
  }
}
