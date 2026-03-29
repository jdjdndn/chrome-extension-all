/**
 * 通用脚本入口
 * 将所有通用脚本合并为单个 bundle
 */

// 核心依赖（side effects: 注册 window 全局变量）
import '../../event-bus-v4.6.js';
import '../core/script-loader.js';

// 工具模块
import '../utils/dom.js';

// 通用脚本（按依赖顺序）
import '../common/script-switch.js';
import '../common/panel-position-manager.js';
import '../common/redirect-links.js';
import '../common/text-to-link.js';
import '../common/link-blank.js';
import '../common/add-title.js';
import '../common/doc-generator.js';
import '../common/text-collector.js';
import '../common/keyboard-pagination.js';
import '../common/keyboard-click.js';
import '../common/lang-to-zh.js';
