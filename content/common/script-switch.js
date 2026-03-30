// 通用脚本：脚本开关管理
// 提供统一的脚本启用/禁用检查机制

'use strict';

(function() {
  // 脚本配置 key
  const STORAGE_KEY = 'scriptSwitches';

  // 默认开关状态（全部启用）
  const DEFAULT_SWITCHES = {
    'redirect-links': true,    // 重定向链接替换
    'text-to-link': true,      // 文本转链接
    'link-blank': true,        // 非同源链接新页面打开
    'add-title': true,         // 添加 title
    'doc-generator': true,     // 文档生成器
    'text-collector': true,    // 文本收集器
    'keyboard-pagination': true, // 键盘翻页
    'keyboard-click': true,     // 键盘快捷点击
    'panel-position-manager': true, // 面板位置管理
    'widen-page': false,           // 页面宽度扩展（默认关闭）
    'tab-focus': true              // Tab激活时自动focus
  };

  // 缓存的开关状态
  let cachedSwitches = null;
  let cacheExpiry = 0;
  const CACHE_TTL = 5000; // 5秒缓存

  // 获取开关状态（同步，使用缓存）
  window.getScriptSwitch = function(scriptName) {
    // 如果有缓存且未过期，使用缓存
    if (cachedSwitches && Date.now() < cacheExpiry) {
      const result = cachedSwitches[scriptName];
      return result !== undefined ? result : (DEFAULT_SWITCHES[scriptName] !== false);
    }

    // 从 localStorage 快速读取（同步）
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        cachedSwitches = JSON.parse(stored);
        cacheExpiry = Date.now() + CACHE_TTL;
        const result = cachedSwitches[scriptName];
        return result !== undefined ? result : (DEFAULT_SWITCHES[scriptName] !== false);
      }
    } catch (e) {
      // 忽略错误
    }

    // 返回默认值
    return DEFAULT_SWITCHES[scriptName] !== false;
  };

  // 异步获取开关状态（从 chrome.storage）
  window.getScriptSwitchAsync = async function(scriptName) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const switches = result[STORAGE_KEY] || DEFAULT_SWITCHES;
      cachedSwitches = switches;
      cacheExpiry = Date.now() + CACHE_TTL;

      // 同时更新 localStorage 作为快速缓存
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(switches));
      } catch (e) {}

      const enabled = switches[scriptName];
      return enabled !== undefined ? enabled : (DEFAULT_SWITCHES[scriptName] !== false);
    } catch (e) {
      return DEFAULT_SWITCHES[scriptName] !== false;
    }
  };

  // 设置开关状态
  window.setScriptSwitch = async function(scriptName, enabled) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const switches = result[STORAGE_KEY] || { ...DEFAULT_SWITCHES };
      switches[scriptName] = enabled;

      await chrome.storage.local.set({ [STORAGE_KEY]: switches });

      // 更新缓存
      cachedSwitches = switches;
      cacheExpiry = Date.now() + CACHE_TTL;

      // 同时更新 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(switches));
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('[ScriptSwitch] 设置开关失败:', e);
      return false;
    }
  };

  // 获取所有开关状态
  window.getAllScriptSwitches = async function() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const switches = result[STORAGE_KEY] || { ...DEFAULT_SWITCHES };
      cachedSwitches = switches;
      cacheExpiry = Date.now() + CACHE_TTL;
      return switches;
    } catch (e) {
      return { ...DEFAULT_SWITCHES };
    }
  };

  // 获取默认开关配置
  window.getDefaultScriptSwitches = function() {
    return { ...DEFAULT_SWITCHES };
  };

  // 脚本名称映射（用于 UI 显示）
  window.SCRIPT_SWITCH_LABELS = {
    'redirect-links': '重定向链接替换',
    'text-to-link': '文本转链接',
    'link-blank': '非同源链接新窗口打开',
    'add-title': '添加 title 属性',
    'doc-generator': '文档生成器',
    'text-collector': '文本收集器',
    'keyboard-pagination': '键盘翻页',
    'keyboard-click': '键盘快捷点击',
    'panel-position-manager': '面板位置管理',
    'widen-page': '页面宽度扩展',
    'tab-focus': 'Tab激活自动聚焦'
  };

  console.log('[ScriptSwitch] 脚本开关模块已加载');
})();
