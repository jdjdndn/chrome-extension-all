/**
 * StorageBridge - Chrome Storage 与 EventBus V4.6 集成
 *
 * 功能：
 * 1. Storage 变化自动发布 EventBus 事件
 * 2. 通过 EventBus API 操作 Storage
 * 3. 跨上下文同步 Storage 状态
 * 4. 响应式数据绑定
 */

'use strict';

const isExtensionContext = typeof chrome !== 'undefined' && chrome.storage;

// 存储的键前缀
const KEY_PREFIX = '__sb__';
const STORAGE_CHANGED_EVENT = 'STORAGE_CHANGED';
const STORAGE_READY_EVENT = 'STORAGE_READY';

// 缓存
const cache = new Map();
const watchers = new Map();

/**
 * 处理 storage 变化
 */
export function _handleStorageChange(changes, areaName) {
  const eventData = {
    area: areaName,
    changes: {},
    timestamp: Date.now()
  };

  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    eventData.changes[key] = { oldValue, newValue };

    // 更新缓存
    if (newValue !== undefined) {
      cache.set(`${areaName}:${key}`, newValue);
    } else {
      cache.delete(`${areaName}:${key}`);
    }

    // 触发监听器
    const watchers_key = `${areaName}:${key}`;
    if (watchers.has(watchers_key)) {
      watchers.get(watchers_key).forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (e) {
          console.error('[StorageBridge] watcher error:', e);
        }
      });
    }
  }

  // 通过 EventBus 发布变化事件
  if (typeof EventBus !== 'undefined' && EventBus.publish) {
    EventBus.publish(STORAGE_CHANGED_EVENT, eventData);
  }
}

/**
 * 注册 EventBus 处理器
 */
export function _registerEventBusHandlers() {
  if (typeof EventBus === 'undefined') {
    console.warn('[StorageBridge] EventBus 未就绪');
    return;
  }

  // 获取数据
  EventBus.on('STORAGE_GET', async ({ keys, area = 'local' }) => {
    try {
      const result = await chrome.storage[area].get(keys);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 设置数据
  EventBus.on('STORAGE_SET', async ({ data, area = 'local' }) => {
    try {
      await chrome.storage[area].set(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 删除数据
  EventBus.on('STORAGE_REMOVE', async ({ keys, area = 'local' }) => {
    try {
      await chrome.storage[area].remove(keys);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 清空数据
  EventBus.on('STORAGE_CLEAR', async ({ area = 'local' }) => {
    try {
      await chrome.storage[area].clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('[StorageBridge] EventBus 处理器已注册');
}

/**
 * 初始化 - 监听 storage 变化
 */
export function init() {
  if (!isExtensionContext) {
    console.warn('[StorageBridge] 非 Chrome 扩展环境');
    return;
  }

  // 监听 storage 变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    _handleStorageChange(changes, areaName);
  });

  // 注册 EventBus 处理器
  _registerEventBusHandlers();

  // 发布就绪事件
  if (typeof EventBus !== 'undefined' && EventBus.publish) {
    setTimeout(() => {
      EventBus.publish(STORAGE_READY_EVENT, { timestamp: Date.now() });
    }, 100);
  }

  console.log('[StorageBridge] 初始化完成');
}

/**
 * 获取存储数据
 * @param {string|string[]} keys - 键名
 * @param {string} area - 存储区域 (local, sync, managed)
 * @returns {Promise<object>}
 */
export async function get(keys, area = 'local') {
  if (!isExtensionContext) return null;

  // 检查缓存
  if (typeof keys === 'string') {
    const cacheKey = `${area}:${keys}`;
    if (cache.has(cacheKey)) {
      return { [keys]: cache.get(cacheKey) };
    }
  }

  try {
    const result = await chrome.storage[area].get(keys);
    // 更新缓存
    for (const [key, value] of Object.entries(result)) {
      cache.set(`${area}:${key}`, value);
    }
    return result;
  } catch (error) {
    console.error('[StorageBridge] get error:', error);
    return null;
  }
}

/**
 * 设置存储数据
 * @param {object} data - 键值对
 * @param {string} area - 存储区域
 * @returns {Promise<boolean>}
 */
export async function set(data, area = 'local') {
  if (!isExtensionContext) return false;

  try {
    await chrome.storage[area].set(data);
    return true;
  } catch (error) {
    console.error('[StorageBridge] set error:', error);
    return false;
  }
}

/**
 * 删除存储数据
 * @param {string|string[]} keys - 键名
 * @param {string} area - 存储区域
 * @returns {Promise<boolean>}
 */
export async function remove(keys, area = 'local') {
  if (!isExtensionContext) return false;

  try {
    await chrome.storage[area].remove(keys);
    return true;
  } catch (error) {
    console.error('[StorageBridge] remove error:', error);
    return false;
  }
}

/**
 * 监听特定键的变化
 * @param {string} key - 键名
 * @param {function} callback - 回调 (newValue, oldValue)
 * @param {string} area - 存储区域
 * @returns {function} 取消监听函数
 */
export function watch(key, callback, area = 'local') {
  const watchKey = `${area}:${key}`;

  if (!watchers.has(watchKey)) {
    watchers.set(watchKey, []);
  }

  watchers.get(watchKey).push(callback);

  // 返回取消监听函数
  return () => {
    const callbacks = watchers.get(watchKey);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  };
}

/**
 * 通过 EventBus 订阅存储变化
 * @param {function} callback - 回调
 * @returns {function} 取消订阅函数
 */
export function subscribe(callback) {
  if (typeof EventBus === 'undefined') {
    console.warn('[StorageBridge] EventBus 未就绪');
    return () => {};
  }

  return EventBus.subscribe(STORAGE_CHANGED_EVENT, callback);
}

/**
 * 创建响应式存储对象
 * @param {string} key - 存储键
 * @param {any} defaultValue - 默认值
 * @param {string} area - 存储区域
 * @returns {object} 响应式对象
 */
export async function reactive(key, defaultValue = null, area = 'local') {
  // 获取初始值
  const result = await get(key, area);
  let value = result?.[key] ?? defaultValue;

  // 创建响应式对象
  const reactiveObj = {
    _value: value,
    _key: key,
    _area: area,
    _listeners: [],

    get value() {
      return this._value;
    },

    set value(newValue) {
      if (this._value === newValue) return;
      const oldValue = this._value;
      this._value = newValue;
      // 异步保存，不等待结果
      StorageBridge.set({ [this._key]: newValue }, this._area);
      this._listeners.forEach(cb => cb(newValue, oldValue));
    },

    // 添加监听器
    onChange(callback) {
      this._listeners.push(callback);
      return () => {
        const index = this._listeners.indexOf(callback);
        if (index > -1) this._listeners.splice(index, 1);
      };
    },

    // 重新加载
    async reload() {
      const result = await StorageBridge.get(this._key, this._area);
      this._value = result?.[this._key] ?? defaultValue;
      return this._value;
    }
  };

  // 监听外部变化
  watch(key, (newValue) => {
    if (newValue !== reactiveObj._value) {
      const oldValue = reactiveObj._value;
      reactiveObj._value = newValue;
      reactiveObj._listeners.forEach(cb => cb(newValue, oldValue));
    }
  }, area);

  return reactiveObj;
}

/**
 * 获取缓存状态
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: [...cache.keys()]
  };
}

/**
 * 清空缓存
 */
export function clearCache() {
  cache.clear();
  console.log('[StorageBridge] 缓存已清空');
}

/**
 * StorageBridge 主对象
 */
const StorageBridge = {
  init,
  _handleStorageChange,
  _registerEventBusHandlers,
  get,
  set,
  remove,
  watch,
  subscribe,
  reactive,
  getCacheStats,
  clearCache
};

export default StorageBridge;

if (typeof window !== 'undefined' && !window.StorageBridge) {
  window.StorageBridge = StorageBridge;

  // 自动初始化
  if (typeof EventBus !== 'undefined' && EventBus.getState?.().isReady) {
    StorageBridge.init();
  } else if (typeof EventBus !== 'undefined') {
    // 等待 EventBus 就绪
    const checkReady = setInterval(() => {
      if (EventBus.getState?.().isReady) {
        clearInterval(checkReady);
        StorageBridge.init();
      }
    }, 100);

    setTimeout(() => clearInterval(checkReady), 5000);
  } else {
    // 没有 EventBus 也初始化基本功能
    StorageBridge.init();
  }
}

console.log('[StorageBridge] 模块已加载');
