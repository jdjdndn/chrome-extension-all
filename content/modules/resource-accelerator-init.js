/**
 * 资源加速器初始化
 * 注册插件、降级策略、启动加速器
 */

import { ResourceAcceleratorCore } from './core/ResourceAcceleratorCore.js'
import { WorkerPlugin } from './plugins/WorkerPlugin.js'
import { CachePlugin } from './plugins/CachePlugin.js'
import { ImagePlugin } from './plugins/ImagePlugin.js'
import { CDNPlugin } from './plugins/CDNPlugin.js'
import { MonitorPlugin } from './plugins/MonitorPlugin.js'
import { toast, toastWarning, toastError } from '../utils/toast.js'

/**
 * 创建并初始化资源加速器
 */
export async function createResourceAccelerator(config = {}) {
  const core = new ResourceAcceleratorCore(config)

  // 注册降级策略
  core.registerFallback('imageCompress', (error, context) => {
    console.warn('[ResourceAccelerator] imageCompress degraded, using skip')
    toastWarning('图片压缩功能已降级', { detail: error.message })
    return { skip: true }
  })

  core.registerFallback('workerCompress', (error, context) => {
    console.warn('[ResourceAccelerator] workerCompress degraded, falling back to main thread')
    toastWarning('Worker压缩已降级为主线程处理', { detail: error.message })
    return { useMainThread: true }
  })

  core.registerFallback('cacheService', (error, context) => {
    console.warn('[ResourceAccelerator] cacheService degraded, using memory only')
    return { memoryOnly: true }
  })

  core.registerFallback('cdnReplace', (error, context) => {
    console.warn('[ResourceAccelerator] cdnReplace degraded, using passthrough')
    return { passthrough: true }
  })

  // 注册插件
  core.registerPlugin(WorkerPlugin, config.workerCompress)
  core.registerPlugin(CachePlugin, config.cache)
  core.registerPlugin(ImagePlugin, config.image)
  core.registerPlugin(CDNPlugin, config.cdn)
  core.registerPlugin(MonitorPlugin, config.monitor)

  // 监听模块降级事件
  core.on('module:degraded', ({ module }) => {
    toastWarning(`功能降级: ${module}`, { duration: 5000 })
  })

  // 监听模块禁用事件
  core.on('module:disabled', ({ module }) => {
    toastError(`功能已禁用: ${module}`, { duration: 0, detail: '点击查看详情' })
  })

  // 初始化
  await core.init()

  // 暴露到全局
  if (typeof window !== 'undefined') {
    window.__resourceAccelerator = core
  }

  return core
}

/**
 * 获取全局加速器实例
 */
export function getResourceAccelerator() {
  return window.__resourceAccelerator || null
}

export { ResourceAcceleratorCore }
