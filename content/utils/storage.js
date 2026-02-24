// ========== 存储工具模块 ==========
// 封装 Chrome Storage API 的常用操作

(function () {
  'use strict';

  // 避免重复初始化
  if (window.StorageUtils) return;

  /**
   * 检查是否在扩展环境中
   * @returns {boolean}
   */
  function isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.storage;
  }

  /**
   * 从 sync storage 获取数据
   * @param {string|string[]} keys - 要获取的键
   * @returns {Promise<object>}
   */
  async function getSync(keys) {
    if (!isExtensionContext()) {
      return {};
    }
    try {
      return await chrome.storage.sync.get(keys);
    } catch (error) {
      console.error('[Storage] sync.get 失败:', error);
      return {};
    }
  }

  /**
   * 保存数据到 sync storage
   * @param {object} data - 要保存的数据
   * @returns {Promise<boolean>}
   */
  async function setSync(data) {
    if (!isExtensionContext()) {
      return false;
    }
    try {
      await chrome.storage.sync.set(data);
      return true;
    } catch (error) {
      console.error('[Storage] sync.set 失败:', error);
      return false;
    }
  }

  /**
   * 从 local storage 获取数据
   * @param {string|string[]} keys - 要获取的键
   * @returns {Promise<object>}
   */
  async function getLocal(keys) {
    if (!isExtensionContext()) {
      return {};
    }
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('[Storage] local.get 失败:', error);
      return {};
    }
  }

  /**
   * 保存数据到 local storage
   * @param {object} data - 要保存的数据
   * @returns {Promise<boolean>}
   */
  async function setLocal(data) {
    if (!isExtensionContext()) {
      return false;
    }
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('[Storage] local.set 失败:', error);
      return false;
    }
  }

  /**
   * 获取域名特定的设置
   * @param {string} storageKey - 存储键名
   * @param {string} domain - 域名
   * @returns {Promise<object|null>}
   */
  async function getDomainSettings(storageKey, domain) {
    const result = await getLocal([storageKey]);
    const allSettings = result[storageKey] || {};
    return allSettings[domain] || null;
  }

  /**
   * 保存域名特定的设置
   * @param {string} storageKey - 存储键名
   * @param {string} domain - 域名
   * @param {object} settings - 设置对象
   * @returns {Promise<boolean>}
   */
  async function setDomainSettings(storageKey, domain, settings) {
    const result = await getLocal([storageKey]);
    const allSettings = result[storageKey] || {};
    allSettings[domain] = settings;
    return setLocal({ [storageKey]: allSettings });
  }

  /**
   * 监听 storage 变化
   * @param {function} callback - 回调函数 (changes, areaName) => void
   * @param {string} area - 监听的存储区域 'sync' | 'local' | 'all'
   */
  function onChanged(callback, area = 'all') {
    if (!isExtensionContext()) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (area === 'all' || area === areaName) {
        callback(changes, areaName);
      }
    });
  }

  // 导出工具函数
  window.StorageUtils = {
    isExtensionContext,
    getSync,
    setSync,
    getLocal,
    setLocal,
    getDomainSettings,
    setDomainSettings,
    onChanged,
  };

  console.log('[Storage] 存储模块已加载');
})();
