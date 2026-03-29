// DevTools panels registration
'use strict';

/**
 * 激活 content script 的 DevTools 功能
 */
async function activateContentScript() {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  console.log('[DevTools] 激活 content script, tabId:', tabId);

  try {
    await chrome.runtime.sendMessage({
      type: 'DEVTOOLS_ACTIVATE',
      tabId: tabId
    });
    console.log('[DevTools] 激活成功');
  } catch (error) {
    console.warn('[DevTools] 激活失败:', error);
  }
}

// DevTools 打开时立即激活
activateContentScript();

// Create Console panel
chrome.devtools.panels.create(
  'Tool-info',
  null, // Use default icon
  'devtools/console.html',
  function (panel) {
    console.log('Console panel created');
  }
);

// Create DevTools Tools panel (自定义通用调试方法)
chrome.devtools.panels.create(
  'DevTools Tools',
  null, // Use default icon
  'devtools/tools-panel.html',
  function (panel) {
    console.log('DevTools Tools panel created');
  }
);
