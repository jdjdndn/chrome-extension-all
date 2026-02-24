// ========== 彩色日志工具模块 ==========
// 提供带标签的彩色控制台日志功能

(function () {
  'use strict';

  // 避免重复初始化
  if (window.LoggerUtils) return;

  // 生成随机颜色（避开白色/浅色）
  function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 40);
    const lightness = 30 + Math.floor(Math.random() * 30);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // 彩色日志输出
  function coloredLog(tag, message, ...args) {
    const tagStyle = `color: ${getRandomColor()}; font-weight: bold;`;
    const styledArgs = args
      .map((arg) => [`%c${String(arg)}`, `color: ${getRandomColor()}`])
      .flat();
    if (styledArgs.length > 0) {
      console.log(`%c${tag} ${message}`, tagStyle, ...styledArgs);
    } else {
      console.log(`%c${tag} ${message}`, tagStyle);
    }
  }

  // 保存原始 console 方法
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
  };

  // 重写 console.log 支持标签彩色输出
  console.log = function (...args) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
      if (tagMatch) {
        const tag = `[${tagMatch[1]}]`;
        const message = firstArg.slice(tag.length).trim() || '';
        coloredLog(tag, message, ...args.slice(1));
        return;
      }
    }
    originalConsole.log(...args);
  };

  // 重写 console.error 支持标签
  console.error = function (...args) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
      if (tagMatch) {
        const tag = `[${tagMatch[1]}]`;
        originalConsole.error(
          `%c${tag} ${firstArg.slice(tag.length).trim()}`,
          'color: #F44336; font-weight: bold;',
          ...args.slice(1)
        );
        return;
      }
    }
    originalConsole.error(...args);
  };

  // 重写 console.warn 支持标签
  console.warn = function (...args) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
      if (tagMatch) {
        const tag = `[${tagMatch[1]}]`;
        originalConsole.warn(
          `%c${tag} ${firstArg.slice(tag.length).trim()}`,
          'color: #FF9800; font-weight: bold;',
          ...args.slice(1)
        );
        return;
      }
    }
    originalConsole.warn(...args);
  };

  // 导出工具函数
  window.LoggerUtils = {
    getRandomColor,
    coloredLog,
    originalConsole,
  };

  console.log('[Logger] 日志模块已加载');
})();
