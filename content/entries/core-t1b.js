/**
 * Core Tier 1b 入口 - 资源加速器主模块（延迟加载）
 * 由 LoadScheduler 在 core-t1a 完成后加载
 *
 * 前置依赖（core-t1a 已提供）：
 * - CDN 映射表（window.CDNMappings）
 * - DOM 变化监听器（window.UnifiedDOMWatcher）
 *
 * 包含内容：
 * - 页面优化检测器
 * - 资源加速器主模块
 * - CSP 绕过集成
 * - HTML/JS 优化器
 */

// 页面优化检测器 - 检测页面已有优化，避免重复执行
import '../core/page-optimizer-detector.js'

// 资源加速器 - 核心拦截逻辑
import '../modules/resource-accelerator.js'
import '../modules/csp-bypass-integration.js'

// HTML/JS 优化器 - 资源优化子模块
import '../modules/html-optimizer.js'
import '../modules/js-optimizer.js'
