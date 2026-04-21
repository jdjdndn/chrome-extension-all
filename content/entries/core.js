/**
 * 核心模块入口
 * 将 manifest.json 中的 content_scripts 合并为单个 bundle
 * 加载顺序与原 manifest 保持一致
 */

// 1. EventBus
import '../../event-bus-v4.6.js';

// 2. Logger
import '../utils/logger.js';

// 3. ScriptLoader
import '../core/script-loader.js';

// 4. DomainConfig
import '../domain-config.js';

// 5. StorageBridge
import '../utils/storage-bridge.js';

// 6. StorageUtils
import '../utils/storage.js';

// 7. DOMUtils
import '../utils/dom.js';

// 8. MessagingUtils
import '../utils/messaging.js';

// 9. ContentBridge
import '../utils/content-bridge.js';

// 10. Core modules
import '../core/store.js';
import '../core/services.js';
import '../core/pipeline.js';
import '../core/site-base.js';
import '../core/site-factory.js';
import '../core/plugin-system.js';
import '../core/config-manager.js';
import '../core/selector-merger.js';
import '../core/keyword-manager.js';
import '../core/rule-manager.js';
import '../core/lazy-loader.js';
import '../core/cache-manager.js';
import '../core/batch.js';
import '../core/history-manager.js';
import '../core/rule-conflict.js';
import '../core/debug-panel.js';
import '../core/input-validator.js';
import '../core/security-manager.js';
import '../core/config-migrator.js';
import '../core/extension-api.js';
import '../core/module-manager.js';
import '../core/lazy-init-manager.js';

// 11. Base classes
import '../base/SiteScript.js';

// 12. 通用功能模块
import '../common/script-switch.js';
import '../common/list-link-split-view.js';

// 13. Main entry
import '../main.js';
