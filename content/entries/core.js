/**
 * 核心模块入口（懒加载）
 * 由 critical.js 通过 LoadScheduler 在浏览器空闲时动态加载
 *
 * 注意：以下模块已由 critical-bundle.js 提供，此处不再重复导入：
 * - load-scheduler.js（LoadScheduler 调度器）
 * - event-bus-v4.6.js（EventBus 通信总线）
 * - domain-config.js（域名检测配置）
 *
 * 加载策略：
 * 1. 关键模块（资源加速器及其依赖）- 立即加载
 * 2. 空闲模块 - 浏览器空闲时加载
 * 3. 延迟模块 - DOMContentLoaded 后加载
 */

// ========== 关键模块（立即加载） ==========
// 资源加速器必须最先加载，以便拦截后续所有资源请求
import '../../shared/cdn-mappings.js'
import '../modules/unified-dom-watcher.js'

// 页面优化检测器 - 必须在资源加速器之前加载，用于检测页面已有优化
import '../core/page-optimizer-detector.js'

// 资源加速器 - 集成页面优化检测
import '../modules/resource-accelerator.js'
import '../modules/csp-bypass-integration.js'

// HTML/JS 优化器 - 资源优化子模块
import '../modules/html-optimizer.js'
import '../modules/js-optimizer.js'

// ========== 空闲模块（浏览器空闲时加载） ==========
// 基础设施模块
import '../utils/logger.js'
import '../core/script-loader.js'

// 工具模块
import '../utils/storage-bridge.js'
import '../utils/storage.js'
import '../utils/dom.js'
import '../utils/messaging.js'
import '../utils/content-bridge.js'

// 核心业务模块
import '../core/store.js'
import '../core/services.js'
import '../core/pipeline.js'
import '../core/site-base.js'
import '../core/site-factory.js'
import '../core/plugin-system.js'
import '../core/config-manager.js'
import '../core/selector-merger.js'
import '../core/keyword-manager.js'
import '../core/rule-manager.js'
import '../core/lazy-loader.js'
import '../core/cache-manager.js'
import '../core/batch.js'
import '../core/history-manager.js'
import '../core/rule-conflict.js'
import '../core/debug-panel.js'
import '../core/input-validator.js'
import '../core/security-manager.js'
import '../core/config-migrator.js'
import '../core/extension-api.js'
import '../core/module-manager.js'
import '../core/lazy-init-manager.js'

// 基类
import '../base/SiteScript.js'

// 通用功能模块
import '../common/script-switch.js'
import '../common/list-link-split-view.js'
import '../common/clipboard-watcher.js'

// ========== 延迟模块（DOMContentLoaded 后加载） ==========
import '../main.js'
import '../../content.js'
