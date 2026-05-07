/**
 * 核心模块入口
 * 将 manifest.json 中的 content_scripts 合并为单个 bundle
 *
 * 加载策略：
 * 1. 关键模块（资源加速器及其依赖）- document_start 时立即加载
 * 2. 空闲模块 - 浏览器空闲时加载
 * 3. 延迟模块 - DOMContentLoaded 后加载
 */

import '../core/load-scheduler.js'

// ========== 关键模块（立即加载） ==========
// 资源加速器必须最先加载，以便拦截后续所有资源请求
import '../../shared/cdn-mappings.js'
import '../modules/resource-accelerator.js'

// ========== 空闲模块（浏览器空闲时加载） ==========
// 基础设施模块
import '../../event-bus-v4.6.js'
import '../utils/logger.js'
import '../core/script-loader.js'
import '../domain-config.js'

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
