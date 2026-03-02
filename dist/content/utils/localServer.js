/**
 * 本地服务客户端 - 通用模块
 * 用于各站点脚本与 local-data-server 通信
 */

(function () {
  'use strict';

  const LOCAL_SERVER_URL = 'http://localhost:3000';

  // 状态
  let _isAvailable = false;
  let _lastCheckTime = 0;
  const CHECK_INTERVAL = 30000; // 30秒检查一次

  /**
   * 通过 background script 发送请求到本地服务
   */
  async function fetch(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('请求超时'));
      }, 5000);

      chrome.runtime.sendMessage({
        type: 'LOCAL_SERVER_FETCH',
        url: `${LOCAL_SERVER_URL}${endpoint}`,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '请求失败'));
        }
      });
    });
  }

  /**
   * 检查本地服务是否可用（带缓存）
   */
  async function checkAvailable() {
    const now = Date.now();
    if (now - _lastCheckTime < CHECK_INTERVAL) {
      return _isAvailable;
    }
    _lastCheckTime = now;

    try {
      const result = await fetch('/api/health');
      _isAvailable = result.status === 'ok';
    } catch (error) {
      _isAvailable = false;
    }
    return _isAvailable;
  }

  /**
   * 获取关键词数据
   */
  async function getKeywords(domain) {
    if (!_isAvailable) return null;
    try {
      const result = await fetch(`/api/data/keywords/${domain}`);
      return result;
    } catch (error) {
      console.log(`[LocalServer] 获取关键词失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 保存关键词数据
   */
  async function saveKeywords(domain, keywords) {
    if (!_isAvailable) return false;
    try {
      await fetch(`/api/data/keywords/${domain}`, {
        method: 'POST',
        body: { notInterested: keywords }
      });
      return true;
    } catch (error) {
      console.log(`[LocalServer] 保存关键词失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取选择器数据
   */
  async function getSelectors(domain) {
    if (!_isAvailable) return null;
    try {
      const result = await fetch(`/api/data/selectors/${domain}`);
      return result;
    } catch (error) {
      console.log(`[LocalServer] 获取选择器失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 保存选择器数据
   */
  async function saveSelectors(domain, selectors) {
    if (!_isAvailable) return false;
    try {
      await fetch(`/api/data/selectors/${domain}`, {
        method: 'POST',
        body: selectors
      });
      return true;
    } catch (error) {
      console.log(`[LocalServer] 保存选择器失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 更新页面配置（通过 meta 标签，CSP 安全）
   */
  function updatePageMeta(name, config) {
    let meta = document.getElementById(`${name}-config-meta`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = `${name}-config-meta`;
      meta.name = `${name}-config`;
      document.head.appendChild(meta);
    }
    meta.content = JSON.stringify(config);
  }

  /**
   * 读取页面配置
   */
  function readPageMeta(name) {
    const meta = document.querySelector(`meta[name="${name}-config"]`);
    if (meta?.content) {
      try {
        return JSON.parse(meta.content);
      } catch (e) {}
    }
    return null;
  }

  // 导出
  window.LocalServer = {
    get isAvailable() { return _isAvailable; },
    checkAvailable,
    fetch,
    getKeywords,
    saveKeywords,
    getSelectors,
    saveSelectors,
    updatePageMeta,
    readPageMeta,
    URL: LOCAL_SERVER_URL
  };

  console.log('[LocalServer] 模块已加载');
})();
