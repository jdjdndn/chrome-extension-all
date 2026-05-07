/**
 * 抖音脚本入口
 * 将依赖和站点脚本合并为自包含 bundle
 */

// EventBus + ScriptLoader (side effects: set window globals)
import '../../event-bus-v4.6.js'
import '../core/script-loader.js'

// Utilities
import '../utils/logger.js'
import '../utils/storage-bridge.js'
import '../utils/storage.js'
import '../utils/dom.js'
import '../utils/messaging.js'
import '../utils/localServer.js'

// Site scripts
import '../douyin.js'
import '../eventbus-integration-douyin.js'
