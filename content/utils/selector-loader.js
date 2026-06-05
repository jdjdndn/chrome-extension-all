/**
 * 选择器加载器工具
 * 从JSON文件加载站点选择器数据
 */

'use strict'

// 选择器数据缓存
const selectorCache = new Map()

/**
 * 加载站点选择器数据
 * @param {string} domain - 站点域名
 * @returns {Promise<Object>} 选择器数据
 */
export async function loadSelectors(domain) {
  // 检查缓存
  if (selectorCache.has(domain)) {
    return selectorCache.get(domain)
  }

  try {
    // 动态导入JSON文件
    const selectors = await import(`../data/selectors/${domain}.json`)
    selectorCache.set(domain, selectors.default || selectors)
    return selectors.default || selectors
  } catch (error) {
    console.warn(`[SelectorLoader] 无法加载 ${domain} 的选择器数据:`, error)
    return null
  }
}

/**
 * 同步获取已缓存的选择器数据
 * @param {string} domain - 站点域名
 * @returns {Object|null} 选择器数据或null
 */
export function getSelectors(domain) {
  return selectorCache.get(domain) || null
}

/**
 * 预加载选择器数据
 * @param {string[]} domains - 站点域名数组
 */
export async function preloadSelectors(domains) {
  const promises = domains.map((domain) => loadSelectors(domain))
  await Promise.allSettled(promises)
}

/**
 * 清除选择器缓存
 */
export function clearSelectorCache() {
  selectorCache.clear()
}

// 全局注册
if (typeof window !== 'undefined') {
  window.SelectorLoader = {
    load: loadSelectors,
    get: getSelectors,
    preload: preloadSelectors,
    clear: clearSelectorCache,
  }
}

export default {
  load: loadSelectors,
  get: getSelectors,
  preload: preloadSelectors,
  clear: clearSelectorCache,
}
