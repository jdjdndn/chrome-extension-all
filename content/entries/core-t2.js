/**
 * Core Tier 2 入口 - 基础设施模块（空闲加载）
 * 由 LoadScheduler 在浏览器空闲时动态加载
 *
 * 包含内容：
 * - 日志工具
 * - 脚本加载器
 * - 存储桥接/存储工具
 * - DOM 工具
 * - 消息通信
 * - 核心业务模块（store/pipeline/site-base/plugin-system 等）
 */

// ========== 基础设施模块 ==========

// 日志工具
import '../utils/logger.js'

// 脚本加载器
import '../core/script-loader.js'

// ========== 工具模块 ==========

// 存储桥接（content ↔ background 通信）
import '../utils/storage-bridge.js'

// 存储工具
import '../utils/storage.js'

// DOM 工具
import '../utils/dom.js'

// 消息通信
import '../utils/messaging.js'

// Content Bridge
import '../utils/content-bridge.js'

// ========== 核心业务模块 ==========

// 状态管理
import '../core/store.js'

// 服务层
import '../core/services.js'

// 处理管线
import '../core/pipeline.js'

// 站点基类
import '../core/site-base.js'

// 站点工厂
import '../core/site-factory.js'

// 插件系统
import '../core/plugin-system.js'

// 配置管理
import '../core/config-manager.js'

// 选择器合并
import '../core/selector-merger.js'

// 关键词管理
import '../core/keyword-manager.js'

// 规则管理
import '../core/rule-manager.js'

// 懒加载器
import '../core/lazy-loader.js'

// 缓存管理
import '../core/cache-manager.js'

// 批处理
import '../core/batch.js'

// 历史管理
import '../core/history-manager.js'
