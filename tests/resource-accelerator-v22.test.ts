/**
 * ResourceAccelerator v22 新功能测试 - 简化版
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('ResourceAcceleratorCore - 错误边界', () => {
  it('应该捕获错误并执行降级策略', async () => {
    const { ResourceAcceleratorCore } =
      await import('../content/modules/core/ResourceAcceleratorCore.js')

    const core = new ResourceAcceleratorCore()

    let fallbackCalled = false
    core.registerFallback('testModule', (error) => {
      fallbackCalled = true
      return { degraded: true }
    })

    core.handleError(new Error('test error'), 'testModule')

    expect(fallbackCalled).toBe(true)
    expect(core.isModuleAvailable('testModule')).toBe(false)
  })

  it('safeExecute应该在错误时返回降级结果', async () => {
    const { ResourceAcceleratorCore } =
      await import('../content/modules/core/ResourceAcceleratorCore.js')

    const core = new ResourceAcceleratorCore()

    core.registerFallback('testModule', () => ({ fallback: true }))

    const result = await core.safeExecute('testModule', () => {
      throw new Error('intentional error')
    })

    expect(result).toEqual({ fallback: true })
  })
})

describe('CachePlugin - LRU淘汰', () => {
  it('应该淘汰最久未使用的条目', async () => {
    const { CachePlugin } = await import('../content/modules/plugins/CachePlugin.js')
    const { ResourceAcceleratorCore } =
      await import('../content/modules/core/ResourceAcceleratorCore.js')

    const core = new ResourceAcceleratorCore()
    const cachePlugin = core.registerPlugin(CachePlugin, {
      maxSize: 1000,
      evictionPolicy: 'lru',
    })

    await core.init()

    const cache = cachePlugin.createCache('test', { maxSize: 500 })

    cache.set('key1', 'value1', 200)
    cache.set('key2', 'value2', 200)
    cache.set('key3', 'value3', 200)

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBe('value2')

    await core.destroy()
  })

  it('保护列表中的资源不应被淘汰', async () => {
    const { CachePlugin } = await import('../content/modules/plugins/CachePlugin.js')
    const { ResourceAcceleratorCore } =
      await import('../content/modules/core/ResourceAcceleratorCore.js')

    const core = new ResourceAcceleratorCore()
    const cachePlugin = core.registerPlugin(CachePlugin, {
      maxSize: 1000,
      evictionPolicy: 'lru',
      protectList: ['favicon.ico'],
    })

    await core.init()

    const cache = cachePlugin.createCache('test', { maxSize: 500 })

    cache.set('https://example.com/favicon.ico', 'favicon', 200)
    cache.set('key2', 'value2', 200)
    cache.set('key3', 'value3', 200)

    expect(cache.get('https://example.com/favicon.ico')).toBe('favicon')

    await core.destroy()
  })
})
