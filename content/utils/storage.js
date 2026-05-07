// ========== 存储工具模块 ==========
// 封装 Chrome Storage API 的常用操作（集成 StorageBridge）

'use strict'

/**
 * 检查是否在扩展环境中
 * @returns {boolean}
 */
export function isExtensionContext() {
  return typeof chrome !== 'undefined' && chrome.storage
}

/**
 * 检查 StorageBridge 是否可用
 * @returns {boolean}
 */
export function isStorageBridgeReady() {
  return typeof StorageBridge !== 'undefined'
}

/**
 * 从 sync storage 获取数据
 * 优先使用 StorageBridge
 * @param {string|string[]} keys - 要获取的键
 * @returns {Promise<object>}
 */
export async function getSync(keys) {
  if (!isExtensionContext()) {
    return {}
  }

  // 优先使用 StorageBridge
  if (isStorageBridgeReady()) {
    const result = await window.StorageBridge.get(keys, 'sync')
    return result || {}
  }

  // 降级到原生 API
  try {
    return await chrome.storage.sync.get(keys)
  } catch (error) {
    console.error('[Storage] sync.get 失败:', error)
    return {}
  }
}

/**
 * 保存数据到 sync storage
 * 优先使用 StorageBridge
 * @param {object} data - 要保存的数据
 * @returns {Promise<boolean>}
 */
export async function setSync(data) {
  if (!isExtensionContext()) {
    return false
  }

  // 优先使用 StorageBridge
  if (isStorageBridgeReady()) {
    return await window.StorageBridge.set(data, 'sync')
  }

  // 降级到原生 API
  try {
    await chrome.storage.sync.set(data)
    return true
  } catch (error) {
    console.error('[Storage] sync.set 失败:', error)
    return false
  }
}

/**
 * 从 local storage 获取数据
 * @param {string|string[]} keys - 要获取的键
 * @returns {Promise<object>}
 */
export async function getLocal(keys) {
  if (!isExtensionContext()) {
    return {}
  }

  // 优先使用 StorageBridge
  if (isStorageBridgeReady()) {
    const result = await window.StorageBridge.get(keys, 'local')
    return result || {}
  }

  try {
    return await chrome.storage.local.get(keys)
  } catch (error) {
    console.error('[Storage] local.get 失败:', error)
    return {}
  }
}

/**
 * 保存数据到 local storage
 * @param {object} data - 要保存的数据
 * @returns {Promise<boolean>}
 */
export async function setLocal(data) {
  if (!isExtensionContext()) {
    return false
  }

  // 优先使用 StorageBridge
  if (isStorageBridgeReady()) {
    return await window.StorageBridge.set(data, 'local')
  }

  try {
    await chrome.storage.local.set(data)
    return true
  } catch (error) {
    console.error('[Storage] local.set 失败:', error)
    return false
  }
}

/**
 * 删除 storage 数据
 * @param {string|string[]} keys - 要删除的键
 * @param {string} area - 存储区域 (sync/local)
 * @returns {Promise<boolean>}
 */
export async function remove(keys, area = 'local') {
  if (!isExtensionContext()) {
    return false
  }

  // 优先使用 StorageBridge
  if (isStorageBridgeReady()) {
    return await window.StorageBridge.remove(keys, area)
  }

  try {
    await chrome.storage[area].remove(keys)
    return true
  } catch (error) {
    console.error('[Storage] remove 失败:', error)
    return false
  }
}

/**
 * 监听存储变化（通过 StorageBridge）
 * @param {string} key - 监听的键
 * @param {function} callback - 回调函数
 * @param {string} area - 存储区域
 * @returns {function} 取消监听函数
 */
export function watch(key, callback, area = 'local') {
  if (isStorageBridgeReady()) {
    return window.StorageBridge.watch(key, callback, area)
  }

  // 降级：使用原生监听
  if (!isExtensionContext()) {
    return () => {}
  }

  const listener = (changes, areaName) => {
    if (areaName === area && changes[key]) {
      callback(changes[key].newValue, changes[key].oldValue)
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

/**
 * 订阅所有存储变化（通过 EventBus）
 * @param {function} callback - 回调函数
 * @returns {function} 取消订阅函数
 */
export function subscribe(callback) {
  if (isStorageBridgeReady()) {
    return window.StorageBridge.subscribe(callback)
  }

  if (!isExtensionContext()) {
    return () => {}
  }

  const listener = (changes, areaName) => {
    callback({ area: areaName, changes, timestamp: Date.now() })
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

/**
 * 监听存储变化（别名，兼容旧代码）
 * @param {function} callback - 回调函数 (changes, areaName)
 * @returns {function} 取消监听函数
 */
export function onChanged(callback) {
  if (!isExtensionContext()) {
    return () => {}
  }

  const listener = (changes, areaName) => {
    callback(changes, areaName)
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

/**
 * 获取域名设置
 * @param {string} settingsKey - 设置键
 * @param {string} domain - 域名
 * @returns {Promise<object|null>}
 */
export async function getDomainSettings(settingsKey, domain) {
  if (!domain) return null

  try {
    const result = await getLocal(settingsKey)
    const allSettings = result?.[settingsKey] || {}
    return allSettings[domain] || null
  } catch (error) {
    console.error('[Storage] getDomainSettings 失败:', error)
    return null
  }
}

/**
 * 设置域名设置
 * @param {string} settingsKey - 设置键
 * @param {string} domain - 域名
 * @param {object} settings - 设置对象
 * @returns {Promise<boolean>}
 */
export async function setDomainSettings(settingsKey, domain, settings) {
  if (!domain) return false

  try {
    const result = await getLocal(settingsKey)
    const allSettings = result?.[settingsKey] || {}
    allSettings[domain] = settings
    return await setLocal({ [settingsKey]: allSettings })
  } catch (error) {
    console.error('[Storage] setDomainSettings 失败:', error)
    return false
  }
}

/**
 * 创建响应式存储对象
 * @param {string} key - 存储键
 * @param {any} defaultValue - 默认值
 * @param {string} area - 存储区域
 * @returns {Promise<object>}
 */
export async function reactive(key, defaultValue = null, area = 'local') {
  if (isStorageBridgeReady()) {
    return await window.StorageBridge.reactive(key, defaultValue, area)
  }

  // 降级：简单实现
  const result = await (area === 'sync' ? getSync(key) : getLocal(key))
  const value = result?.[key] ?? defaultValue

  const reactiveObj = {
    _value: value,
    _key: key,
    _area: area,

    get value() {
      return this._value
    },

    set value(newValue) {
      this._value = newValue
      // 异步保存（不等待）
      if (area === 'sync') {
        setSync({ [this._key]: newValue }).catch((e) =>
          console.error('[Storage] setSync failed:', e)
        )
      } else {
        setLocal({ [this._key]: newValue }).catch((e) =>
          console.error('[Storage] setLocal failed:', e)
        )
      }
    },

    // 提供异步保存方法
    async save() {
      if (area === 'sync') {
        return await setSync({ [this._key]: this._value })
      } else {
        return await setLocal({ [this._key]: this._value })
      }
    },
  }

  return reactiveObj
}

/**
 * StorageUtils 工具对象
 */
const StorageUtils = {
  isExtensionContext,
  isStorageBridgeReady,
  getSync,
  setSync,
  getLocal,
  setLocal,
  remove,
  watch,
  subscribe,
  reactive,
  onChanged,
  getDomainSettings,
  setDomainSettings,
}

export default StorageUtils

if (typeof window !== 'undefined' && !window.StorageUtils) {
  window.StorageUtils = StorageUtils
}

console.log('[Storage] 存储模块已加载 (StorageBridge 增强版)')
