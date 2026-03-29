// ========== 日志工具模块 ==========
// 提供简单的日志标记功能

'use strict';

export const log = console.log.bind(console);
export const error = console.error.bind(console);
export const warn = console.warn.bind(console);
export const info = console.info.bind(console);

const LoggerUtils = { log, error, warn, info };
export default LoggerUtils;

// 避免重复初始化
if (typeof window !== 'undefined' && !window.LoggerUtils) {
  window.LoggerUtils = LoggerUtils;
  if (window.ScriptLoader) ScriptLoader.markReady('LoggerUtils');
  console.log('[Logger] 日志模块已加载');
}
