/**
 * ScriptGuard - 防止脚本重复加载
 * 统一的脚本初始化保护机制
 */

'use strict'

/**
 * 创建脚本守卫
 * @param {string} scriptName - 脚本名称
 * @returns {{ check: function, markInitialized: function, isInitialized: function }}
 */
export function createScriptGuard(scriptName) {
  const globalKey = `__${scriptName}ScriptLoaded`
  const initKey = `__${scriptName}ScriptInitialized`

  return {
    /**
     * 检查是否已加载，如果已加载则返回true
     */
    check() {
      if (window[globalKey]) {
        console.log(`[${scriptName}] 脚本已加载，跳过`)
        return true
      }
      window[globalKey] = true
      return false
    },

    /**
     * 标记脚本已初始化完成
     */
    markInitialized() {
      window[initKey] = true
      console.log(`[${scriptName}] 脚本初始化完成`)
    },

    /**
     * 检查是否已初始化
     */
    isInitialized() {
      return !!window[initKey]
    },
  }
}

/**
 * 装饰器：为脚本函数添加防重复加载保护
 * @param {string} scriptName - 脚本名称
 * @param {Function} initFn - 初始化函数
 * @returns {Function} 受保护的初始化函数
 */
export function withScriptGuard(scriptName, initFn) {
  const guard = createScriptGuard(scriptName)
  return function (...args) {
    if (guard.check()) {
      return
    }
    const result = initFn.apply(this, args)
    guard.markInitialized()
    return result
  }
}

const ScriptGuard = {
  create: createScriptGuard,
  with: withScriptGuard,
}

export default ScriptGuard

// 全局暴露
if (typeof window !== 'undefined' && !window.ScriptGuard) {
  window.ScriptGuard = ScriptGuard
  console.log('[ScriptGuard] 模块已加载')
}
