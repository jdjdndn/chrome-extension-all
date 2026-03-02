/**
 * 本地服务客户端
 * 用于与 local-data-server 通信
 */

(function () {
  'use strict';

  // 默认配置
  const DEFAULT_CONFIG = {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retryCount: 2,
    retryDelay: 1000
  };

  // 当前配置
  let config = { ...DEFAULT_CONFIG };

  /**
   * 设置配置
   */
  function setConfig(newConfig) {
    config = { ...config, ...newConfig };
  }

  /**
   * 获取配置
   */
  function getConfig() {
    return { ...config };
  }

  /**
   * 发送请求（带重试）
   */
  async function request(endpoint, options = {}, retry = 0) {
    const url = `${config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // 重试逻辑
      if (retry < config.retryCount && !error.name === 'AbortError') {
        console.log(`[LocalServer] 请求失败，${config.retryDelay}ms 后重试 (${retry + 1}/${config.retryCount})`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        return request(endpoint, options, retry + 1);
      }

      console.error('[LocalServer] 请求失败:', error.message);
      throw error;
    }
  }

  /**
   * 检查服务是否可用
   */
  async function checkHealth() {
    try {
      const result = await request('/api/health');
      return result.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取数据
   */
  async function getData(type, key = null) {
    const endpoint = key ? `/api/data/${type}/${key}` : `/api/data/${type}`;
    const result = await request(endpoint);
    return result.data;
  }

  /**
   * 保存数据
   */
  async function saveData(type, data, key = null) {
    const endpoint = key ? `/api/data/${type}/${key}` : `/api/data/${type}`;
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 删除数据
   */
  async function deleteData(type, key) {
    return request(`/api/data/${type}/${key}`, {
      method: 'DELETE'
    });
  }

  /**
   * 获取域名数据
   */
  async function getDomainData(domain) {
    const result = await request(`/api/sync/${domain}`);
    return result.data;
  }

  /**
   * 同步域名数据
   */
  async function syncDomainData(domain, data) {
    return request(`/api/sync/${domain}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * 批量获取数据
   */
  async function getBatchData(types) {
    const result = await request('/api/data/batch', {
      method: 'POST',
      body: JSON.stringify({ types })
    });
    return result.data;
  }

  // 导出
  window.LocalServerClient = {
    setConfig,
    getConfig,
    checkHealth,
    getData,
    saveData,
    deleteData,
    getDomainData,
    syncDomainData,
    getBatchData,
    // 常量
    DEFAULT_CONFIG
  };

  console.log('[LocalServerClient] 本地服务客户端已加载');
})();
