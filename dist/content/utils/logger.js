// ========== 日志工具模块 ==========
// 提供简单的日志标记功能

(function () {
  'use strict';

  // 避免重复初始化
  if (window.LoggerUtils) return;

  // 导出工具函数（保持接口兼容）
  window.LoggerUtils = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
  };

  console.log('[Logger] 日志模块已加载');
})();
