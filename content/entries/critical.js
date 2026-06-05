/**
 * Critical Bundle 入口
 * 仅包含最小化的关键模块，在 document_start 时立即加载
 *
 * 包含内容：
 * 1. LoadScheduler - 脚本加载调度器
 * 2. EventBus - 基础通信
 * 3. 域名检测 - DomainConfig 域名脚本配置
 * 4. inject.js 注入逻辑
 *
 * 不包含：
 * - 资源加速器（lazy load）
 * - 核心业务模块（lazy load）
 * - 工具模块（lazy load）
 */

// ========== 关键模块（立即加载） ==========

// 安全执行工具 - 统一错误处理
import '../utils/safe-execute.js'

// 选择器加载器 - 从JSON文件加载站点选择器数据
import '../utils/selector-loader.js'

// 加载调度器 - 提供 loadCoreBundle 触发能力
import '../core/load-scheduler.js'

// EventBus Lite - 精简版通信总线（document_start阶段）
import '../utils/eventbus-lite.js'

// 域名检测 - 域名脚本配置
import '../domain-config.js'

// ========== inject.js 注入 ==========
// 在 document_start 阶段注入页面上下文脚本
;(function injectPageScript() {
  if (!chrome?.runtime?.getURL) {
    return
  }
  if (window._injectScriptInjected) {
    return
  }
  window._injectScriptInjected = true

  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject.js')
  script.onload = function () {
    this.remove()
  }

  // document_start 阶段 DOM 可能未就绪，找到第一个可用的父节点
  const target =
    document.head ||
    document.documentElement ||
    document.querySelector('head') ||
    document.querySelector('html')
  if (target) {
    target.appendChild(script)
  } else {
    // DOM 完全未就绪，使用 document 监听到有元素后重试
    const observer = new MutationObserver(() => {
      const newTarget = document.head || document.documentElement
      if (newTarget) {
        observer.disconnect()
        newTarget.appendChild(script)
      }
    })
    observer.observe(document, { childList: true, subtree: true })
  }
})()

// ========== 初始化 EventBus Lite ==========
if (window.EventBusLite) {
  const eventBus = window.EventBusLite()
  window.EventBus = eventBus
  eventBus.init()
}

// ========== 触发懒加载 ==========
// 使用 LoadScheduler 在浏览器空闲时加载分层 bundle
if (window.LoadScheduler) {
  window.LoadScheduler.triggerLazyLoad()
}
