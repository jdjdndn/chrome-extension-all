/**
 * 主入口脚本
 * 统一脚本加载入口，根据域名配置动态加载所需脚本
 *
 * 加载策略：
 * 1. 核心模块（manifest document_start）- 已完成
 * 2. 域名脚本（document_start 类型）- 立即加载
 * 3. DOM 就绪后：
 *    - 通用脚本
 *    - 域名脚本（默认类型）
 *    - EventBus 集成
 * 4. 浏览器空闲时：
 *    - 非关键模块
 *
 * 优先级策略：
 * - P0（立即）：关键域名、隐藏元素、拦截请求
 * - P1（DOMContentLoaded）：自动化操作
 * - P2（空闲）：统计、日志
 */

;(function () {
  'use strict'

  // 防止重复注入
  if (window._mainScriptLoaded) {
    console.log('[Main] 主脚本已加载，跳过')
    return
  }
  window._mainScriptLoaded = true

  const hostname = window.location.hostname

  // ========== 建议1：监控JS密集页面 ==========
  const checkJSIntensity = () => {
    const scriptCount = document.querySelectorAll('script').length
    if (scriptCount > 100) {
      console.warn(`[Main] JS密集页面检测：${scriptCount} 个脚本，跳过延迟加载`)
      return true
    }
    return false
  }

  // ========== 建议2：MutationObserver提前介入 ==========
  const setupEarlyIntervention = () => {
    // 关键域名配置
    const criticalDomains = ['douyin.com', 'youtube.com', 'github.com']
    const isCritical = criticalDomains.some((domain) => hostname.includes(domain))

    if (!isCritical) return

    // 提前处理关键元素（隐藏、拦截）
    const processCriticalElements = () => {
      // 抖音特定处理
      if (hostname.includes('douyin.com')) {
        // 隐藏广告元素
        const hideSelectors = [
          '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
          '.ooIf2jbM',
          '._e7lJDCC',
          '#island_076c3',
        ]
        hideSelectors.forEach((selector) => {
          try {
            document.querySelectorAll(selector).forEach((el) => {
              el.style.display = 'none'
            })
          } catch (e) {}
        })
      }
    }

    // 立即执行一次
    processCriticalElements()

    // 监听后续DOM变化
    const observer = new MutationObserver(() => {
      processCriticalElements()
    })

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    })

    // 3秒后停止监听（页面稳定后）
    setTimeout(() => {
      observer.disconnect()
      console.log('[Main] 提前介入监听已停止')
    }, 3000)
  }

  /**
   * 动态加载脚本
   * @param {string} src - 脚本路径
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve) => {
      if (!chrome?.runtime?.getURL) {
        console.warn('[Main] 非 Chrome 扩展环境，跳过加载:', src)
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = chrome.runtime.getURL(src)
      script.onload = () => {
        script.remove()
        resolve()
      }
      script.onerror = (e) => {
        console.warn(`[Main] 脚本加载失败: ${src}`, e)
        script.remove()
        resolve() // 失败也继续，不阻塞后续脚本
      }
      ;(document.head || document.documentElement).appendChild(script)
    })
  }

  /**
   * 批量加载脚本（并行）
   * @param {string[]} scripts - 脚本路径数组
   * @returns {Promise<void>}
   */
  async function loadScriptsParallel(scripts) {
    await Promise.all(scripts.map((src) => loadScript(src)))
  }

  /**
   * 批量加载脚本（顺序）
   * @param {string[]} scripts - 脚本路径数组
   * @returns {Promise<void>}
   */
  async function loadScriptsSequential(scripts) {
    for (const src of scripts) {
      await loadScript(src)
    }
  }

  /**
   * 主初始化函数
   */
  async function init() {
    console.log(`[Main] 开始初始化，当前域名: ${hostname}, readyState: ${document.readyState}`)

    // 获取域名配置
    const config = window.DomainConfig.getScriptConfig(hostname)
    console.log('[Main] 脚本配置:', {
      commonScripts: config.commonScripts.length,
      domainScripts: config.domainScripts.length,
      runAtStart: config.runAtStart.length,
      eventbusIntegration: config.eventbusIntegration,
    })

    // 阶段1: 立即加载 document_start 类型的域名脚本
    if (config.runAtStart.length > 0) {
      console.log('[Main] 加载 document_start 脚本:', config.runAtStart)
      await loadScriptsSequential(config.runAtStart)
    }

    // 阶段2: DOM 就绪后加载其他脚本
    const loadRemainingScripts = async () => {
      console.log('[Main] DOM 就绪，开始加载剩余脚本')

      // 加载通用脚本（并行加载提高效率）
      if (config.commonScripts.length > 0) {
        console.log('[Main] 加载通用脚本:', config.commonScripts.length, '个')
        await loadScriptsParallel(config.commonScripts)
      }

      // 加载域名脚本（顺序加载保持兼容性）
      if (config.domainScripts.length > 0) {
        console.log('[Main] 加载域名脚本:', config.domainScripts)
        await loadScriptsSequential(config.domainScripts)
      }

      // 加载 EventBus 集成
      if (config.eventbusIntegration) {
        console.log('[Main] 加载 EventBus 集成')
        await loadScript(config.eventbusScript)
      }

      // content.js 已打包到 core-bundle.js，无需动态加载
      console.log('[Main] 所有脚本加载完成')
    }

    // 根据文档状态决定加载时机
    if (document.readyState === 'loading') {
      // DOM 未就绪，等待 DOMContentLoaded
      document.addEventListener('DOMContentLoaded', loadRemainingScripts)
    } else if (document.readyState === 'interactive') {
      // DOM 正在解析，可以开始加载
      await loadRemainingScripts()
    } else {
      // complete - DOM 已完全加载
      await loadRemainingScripts()
    }
  }

  // ========== 建议3：分优先级执行 ==========
  const executeByPriority = () => {
    const config = window.DomainConfig?.getScriptConfig(hostname)
    const isCriticalDomain = config && config.runAtStart.length > 0
    const isJSIntensive = checkJSIntensity()

    // P0: 关键域名立即执行（避免空白）
    if (isCriticalDomain || isJSIntensive) {
      console.log('[Main] P0优先级：立即执行')
      setupEarlyIntervention()
      init().catch((err) => {
        console.error('[Main] 初始化失败:', err)
      })
      return
    }

    // P1: DOMContentLoaded 后执行
    const loadP1 = () => {
      console.log('[Main] P1优先级：DOMContentLoaded 后执行')
      init().catch((err) => {
        console.error('[Main] 初始化失败:', err)
      })
    }

    // P2: 空闲时执行
    const loadP2 = () => {
      if (window.LoadScheduler) {
        console.log('[Main] P2优先级：空闲时执行')
        window.LoadScheduler.registerIdle(
          'main-init',
          () => {
            init().catch((err) => {
              console.error('[Main] 初始化失败:', err)
            })
          },
          { priority: 10 }
        )
      } else {
        loadP1()
      }
    }

    // 根据页面状态决定
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadP1)
    } else if (document.readyState === 'interactive') {
      loadP1()
    } else {
      loadP2()
    }
  }

  // 启动
  executeByPriority()
})()
