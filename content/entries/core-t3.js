/**
 * Core Tier 3 入口 - 辅助功能模块（延迟加载）
 * 由 LoadScheduler 在 DOMContentLoaded 后加载
 *
 * 包含内容：
 * - 规则冲突检测
 * - 调试面板
 * - 输入验证
 * - 安全管理
 * - 配置迁移
 * - 扩展 API
 * - 模块管理
 * - 基类
 * - 通用功能模块（脚本切换/键盘翻页/剪贴板监听等）
 */

// ========== 辅助核心模块 ==========

// 规则冲突检测
import '../core/rule-conflict.js'

// 调试面板
import '../core/debug-panel.js'

// 输入验证
import '../core/input-validator.js'

// 安全管理
import '../core/security-manager.js'

// 配置迁移
import '../core/config-migrator.js'

// 扩展 API
import '../core/extension-api.js'

// 模块管理
import '../core/module-manager.js'

// 懒初始化管理
import '../core/lazy-init-manager.js'

// 基类
import '../base/SiteScript.js'

// ========== 通用功能模块 ==========

// 脚本切换
import '../common/script-switch.js'

// 键盘翻页（用户高频使用，提前加载）
import '../common/keyboard-pagination.js'

// 列表链接分屏
import '../common/list-link-split-view.js'

// 剪贴板监听
import '../common/clipboard-watcher.js'

// ========== 延迟入口 ==========
import '../main.js'
import '../../content.js'
