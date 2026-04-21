/**
 * 日志工具模块
 * 支持日志级别控制和模块过滤
 */

'use strict';

// 日志级别
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

// 默认配置
let config = {
  level: LOG_LEVELS.INFO,
  enabledModules: new Set(),
  disabledModules: new Set()
};

/**
 * 设置日志级别
 * @param {number} level - LOG_LEVELS 中的级别
 */
export function setLogLevel(level) {
  if (Object.values(LOG_LEVELS).includes(level)) {
    config.level = level;
  }
}

/**
 * 启用模块日志
 * @param {string} module - 模块名
 */
export function enableModule(module) {
  config.disabledModules.delete(module);
  config.enabledModules.add(module);
}

/**
 * 禁用模块日志
 * @param {string} module - 模块名
 */
export function disableModule(module) {
  config.enabledModules.delete(module);
  config.disabledModules.add(module);
}

/**
 * 检查是否应该输出日志
 * @param {number} level - 日志级别
 * @param {string} module - 模块名
 */
function shouldLog(level, module) {
  // 级别过滤
  if (level < config.level) return false;

  // 模块过滤
  if (config.disabledModules.has(module)) return false;
  if (config.enabledModules.size > 0 && !config.enabledModules.has(module)) return false;

  return true;
}

/**
 * 创建带模块名的日志器
 * @param {string} module - 模块名
 * @returns {Object} 日志方法
 */
export function createLogger(module) {
  return {
    debug(...args) {
      if (shouldLog(LOG_LEVELS.DEBUG, module)) {
        console.log(`[${module}]`, ...args);
      }
    },
    info(...args) {
      if (shouldLog(LOG_LEVELS.INFO, module)) {
        console.info(`[${module}]`, ...args);
      }
    },
    warn(...args) {
      if (shouldLog(LOG_LEVELS.WARN, module)) {
        console.warn(`[${module}]`, ...args);
      }
    },
    error(...args) {
      if (shouldLog(LOG_LEVELS.ERROR, module)) {
        console.error(`[${module}]`, ...args);
      }
    }
  };
}

// 兼容旧 API
export const log = console.log.bind(console);
export const error = console.error.bind(console);
export const warn = console.warn.bind(console);
export const info = console.info.bind(console);

const LoggerUtils = {
  log, error, warn, info,
  setLogLevel, enableModule, disableModule, createLogger,
  LOG_LEVELS
};
export default LoggerUtils;

// 避免重复初始化
if (typeof window !== 'undefined' && !window.LoggerUtils) {
  window.LoggerUtils = LoggerUtils;
  if (window.ScriptLoader) ScriptLoader.markReady('LoggerUtils');
  console.log('[Logger] 日志模块已加载');
}
