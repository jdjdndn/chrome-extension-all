// 通用脚本：Tab 激活时自动 focus document
// 解决切换 tab 后键盘事件不响应的问题，无需用户先点击页面
// 使用 visibilitychange API，无需 background 消息
// @match *://*/*

'use strict';

if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'tab-focus',
    dependencies: [],
    onReady: () => initTabFocus()
  });
} else {
  initTabFocus();
}

function initTabFocus() {
  if (window.TabFocusLoaded) {
    console.log('[通用脚本] Tab焦点激活已加载，跳过');
    return;
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('tab-focus')) {
    console.log('[通用脚本] Tab焦点激活已禁用');
    return;
  }

  window.TabFocusLoaded = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      window.focus();
    }
  });

  console.log('[通用脚本] Tab焦点激活已加载');
}
