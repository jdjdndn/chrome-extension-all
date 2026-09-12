/**
 * Core Tier 1a 入口 - 资源拦截基础设施（立即加载）
 * 由 LoadScheduler 在浏览器空闲时首先加载
 *
 * 包含内容（轻量级，仅为资源拦截提供基础设施）：
 * - CDN 映射表（743行，库匹配规则）
 * - DOM 变化监听器（统一 MutationObserver）
 *
 * 不包含：
 * - 资源加速器主模块（由 core-t1b 加载）
 * - 页面优化检测器（由 core-t1b 加载）
 * - CSP 绕过/HTML/JS 优化器（由 core-t1b 加载）
 */

// CDN 映射表 - 库匹配规则，必须最先加载
import '../../shared/cdn-mappings.js'

// DOM 变化监听器 - 统一 MutationObserver，资源加速器依赖此模块
import '../modules/unified-dom-watcher.js'
