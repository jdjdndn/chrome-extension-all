/**
 * 安全执行工具模块
 * 统一错误处理模式，避免静默忽略错误
 */

'use strict'

/**
 * 安全执行同步函数
 * @param {Function} fn - 要执行的函数
 * @param {*} fallback - 出错时返回的默认值
 * @param {string} context - 执行上下文（用于日志）
 * @returns {*} 函数返回值或fallback
 */
export function safeExecute(fn, fallback = null, context = '') {
  try {
    return fn()
  } catch (error) {
    if (context) {
      console.warn(`[${context}] 执行失败:`, error)
    }
    return fallback
  }
}

/**
 * 安全执行异步函数
 * @param {Function} fn - 要执行的异步函数
 * @param {*} fallback - 出错时返回的默认值
 * @param {string} context - 执行上下文（用于日志）
 * @returns {Promise<*>} 函数返回值或fallback
 */
export async function safeExecuteAsync(fn, fallback = null, context = '') {
  try {
    return await fn()
  } catch (error) {
    if (context) {
      console.warn(`[${context}] 执行失败:`, error)
    }
    return fallback
  }
}

/**
 * 安全执行带重试
 * @param {Function} fn - 要执行的函数
 * @param {number} retries - 重试次数
 * @param {number} delay - 重试延迟（毫秒）
 * @param {string} context - 执行上下文
 * @returns {Promise<*>} 函数返回值
 */
export async function safeExecuteWithRetry(fn, retries = 3, delay = 100, context = '') {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) {
        if (context) {
          console.warn(`[${context}] 重试${retries}次后仍失败:`, error)
        }
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

/**
 * 安全执行Promise.allSettled的简化版
 * @param {Array<Function>} fns - 要执行的函数数组
 * @param {string} context - 执行上下文
 * @returns {Array<*>} 结果数组（失败的返回null）
 */
export async function safeParallel(fns, context = '') {
  const results = await Promise.allSettled(fns.map((fn) => fn()))
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    if (context) {
      console.warn(`[${context}] 并行任务${index}失败:`, result.reason)
    }
    return null
  })
}

// 全局注册（兼容旧代码）
if (typeof window !== 'undefined') {
  window.SafeExecute = {
    safe: safeExecute,
    safeAsync: safeExecuteAsync,
    safeWithRetry: safeExecuteWithRetry,
    safeParallel,
  }
}

export default {
  safe: safeExecute,
  safeAsync: safeExecuteAsync,
  safeWithRetry: safeExecuteWithRetry,
  safeParallel,
}
