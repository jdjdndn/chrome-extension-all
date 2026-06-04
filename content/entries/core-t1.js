/**
 * Core Tier 1 入口 - 资源加速器核心（立即加载）
 * 由 critical.js 通过 LoadScheduler 在浏览器空闲时动态加载
 *
 * 包含内容（必须最先加载的资源拦截模块）：
 * - CDN 映射表
 * - DOM 变化监听器
 * - 页面优化检测器
 * - 资源加速器
 * - CSP 绕过集成
 * - HTML/JS 优化器
 */

// ========== 资源拦截核心（立即加载） ==========
// CDN 映射表 - 必须最先加载
import '../../shared/cdn-mappings.js'

// DOM 变化监听器 - 监听动态资源
import '../modules/unified-dom-watcher.js'

// 页面优化检测器 - 必须在资源加速器之前加载
import '../core/page-optimizer-detector.js'

// 资源加速器 - 核心拦截逻辑
import '../modules/resource-accelerator.js'
import '../modules/csp-bypass-integration.js'

// HTML/JS 优化器 - 资源优化子模块
import '../modules/html-optimizer.js'
import '../modules/js-optimizer.js'
