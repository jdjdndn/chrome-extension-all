/**
 * 主入口脚本
 * 统一脚本加载入口，根据域名配置动态加载所需脚本
 *
 * 加载顺序：
 * 1. 核心模块（manifest document_start）- 已完成
 * 2. 域名脚本（document_start 类型）
 * 3. DOM 就绪后：
 *    - 通用脚本
 *    - 域名脚本（默认类型）
 *    - EventBus 集成
 *    - content.js
 */

(function () {
  'use strict';

  // 防止重复注入
  if (window._mainScriptLoaded) {
    console.log('[Main] 主脚本已加载，跳过');
    return;
  }
  window._mainScriptLoaded = true;

  const hostname = window.location.hostname;

  /**
   * 动态加载脚本
   * @param {string} src - 脚本路径
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = (e) => {
        console.warn(`[Main] 脚本加载失败: ${src}`, e);
        script.remove();
        resolve(); // 失败也继续，不阻塞后续脚本
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  /**
   * 批量加载脚本（并行）
   * @param {string[]} scripts - 脚本路径数组
   * @returns {Promise<void>}
   */
  async function loadScriptsParallel(scripts) {
    await Promise.all(scripts.map(src => loadScript(src)));
  }

  /**
   * 批量加载脚本（顺序）
   * @param {string[]} scripts - 脚本路径数组
   * @returns {Promise<void>}
   */
  async function loadScriptsSequential(scripts) {
    for (const src of scripts) {
      await loadScript(src);
    }
  }

  /**
   * 主初始化函数
   */
  async function init() {
    console.log(`[Main] 开始初始化，当前域名: ${hostname}, readyState: ${document.readyState}`);

    // 获取域名配置
    const config = window.DomainConfig.getScriptConfig(hostname);
    console.log('[Main] 脚本配置:', {
      commonScripts: config.commonScripts.length,
      domainScripts: config.domainScripts.length,
      runAtStart: config.runAtStart.length,
      eventbusIntegration: config.eventbusIntegration
    });

    // 阶段1: 立即加载 document_start 类型的域名脚本
    if (config.runAtStart.length > 0) {
      console.log('[Main] 加载 document_start 脚本:', config.runAtStart);
      await loadScriptsSequential(config.runAtStart);
    }

    // 阶段2: DOM 就绪后加载其他脚本
    const loadRemainingScripts = async () => {
      console.log('[Main] DOM 就绪，开始加载剩余脚本');

      // 加载通用脚本（并行加载提高效率）
      if (config.commonScripts.length > 0) {
        console.log('[Main] 加载通用脚本:', config.commonScripts.length, '个');
        await loadScriptsParallel(config.commonScripts);
      }

      // 加载域名脚本（顺序加载保持兼容性）
      if (config.domainScripts.length > 0) {
        console.log('[Main] 加载域名脚本:', config.domainScripts);
        await loadScriptsSequential(config.domainScripts);
      }

      // 加载 EventBus 集成
      if (config.eventbusIntegration) {
        console.log('[Main] 加载 EventBus 集成');
        await loadScript(config.eventbusScript);
      }

      // 加载主 content.js
      await loadScript('content.js');

      console.log('[Main] 所有脚本加载完成');
    };

    // 根据文档状态决定加载时机
    if (document.readyState === 'loading') {
      // DOM 未就绪，等待 DOMContentLoaded
      document.addEventListener('DOMContentLoaded', loadRemainingScripts);
    } else if (document.readyState === 'interactive') {
      // DOM 正在解析，可以开始加载
      await loadRemainingScripts();
    } else {
      // complete - DOM 已完全加载
      await loadRemainingScripts();
    }
  }

  // 启动初始化
  init().catch(err => {
    console.error('[Main] 初始化失败:', err);
  });

})();
