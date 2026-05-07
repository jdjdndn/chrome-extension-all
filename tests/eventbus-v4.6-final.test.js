/**
 * EventBus V4.6 最终测试
 * 在浏览器控制台中运行此测试
 */

;(function () {
  'use strict'

  const EventBusV46Test = {
    results: [],
    passed: 0,
    failed: 0,

    assert(condition, message) {
      this.results.push({
        pass: condition,
        message,
        timestamp: Date.now(),
      })
      if (condition) {
        this.passed++
        console.log(`✅ ${message}`)
      } else {
        this.failed++
        console.log(`❌ ${message}`)
      }
    },

    async runAll() {
      console.log('========== EventBus V4.6 测试 ==========')
      this.results = []
      this.passed = 0
      this.failed = 0

      // 测试 1: 检查 EventBus 加载
      const state = EventBus.getState()
      this.assert(typeof EventBus !== 'undefined', 'EventBus 全局对象存在')
      this.assert(state.version === '4.6.0', `版本正确: ${state.version}`)
      this.assert(state.isReady, 'EventBus 已初始化')

      // 测试 2: 检查 Transport 层
      this.assert(typeof EventBus.Transport !== 'undefined', 'Transport 已暴露')
      this.assert(typeof EventBus.Transport.send === 'function', 'Transport.send 方法存在')
      this.assert(
        typeof EventBus.Transport.registerPort === 'function',
        'Transport.registerPort 方法存在'
      )
      this.assert(
        typeof EventBus.Transport.broadcast === 'function',
        'Transport.broadcast 方法存在'
      )
      this.assert(EventBus.Chrome !== undefined, 'Chrome API 已暴露')
      this.assert(typeof EventBus.Chrome.getEnv === 'function', 'Chrome.getEnv 方法存在')
      this.assert(
        typeof EventBus.Chrome.isExtensionContext === 'function',
        'Chrome.isExtensionContext 方法存在'
      )
      this.assert(
        typeof EventBus.Chrome.sendToActiveTab === 'function',
        'Chrome.sendToActiveTab 方法存在'
      )
      this.assert(
        typeof EventBus.Chrome.sendToContent === 'function',
        'Chrome.sendToContent 方法存在'
      )
      this.assert(typeof EventBus.Chrome.broadcast === 'function', 'Chrome.broadcast 方法存在')
      this.assert(
        typeof EventBus.Chrome.getCurrentTabId === 'function',
        'Chrome.getCurrentTabId 方法存在'
      )

      // 测试 3: 测试订阅/发布
      let received = false
      const unsub = EventBus.subscribe('TEST_MESSAGE', (data) => {
        received = true
      })

      // 发布消息
      await EventBus.publish('TEST_MESSAGE', { test: true })
      await new Promise((r) => setTimeout(r, 100))

      this.assert(received, '发布/订阅工作正常')
      unsub()

      // 测试 4: Request/Response 模式
      EventBus.on('TEST_REQUEST', (data) => {
        return { echo: data, timestamp: Date.now() }
      })

      try {
        const response = await EventBus.request('TEST_REQUEST', { ping: 'pong' }, { timeout: 2000 })
        this.assert(response && response.echo, 'Request/Response 工作正常')
        this.assert(response.echo.ping === 'pong', '响应数据正确')
      } catch (error) {
        this.assert(false, `Request/Response 失败: ${error.message}`)
      }

      // 测试 5: MessagingUtils 集成
      this.assert(typeof MessagingUtils !== 'undefined', 'MessagingUtils 存在')
      this.assert(
        typeof MessagingUtils.sendToBackground === 'function',
        'MessagingUtils.sendToBackground 已定义'
      )
      this.assert(typeof MessagingUtils.subscribe === 'function', 'MessagingUtils.subscribe 已定义')
      this.assert(typeof MessagingUtils.publish === 'function', 'MessagingUtils.publish 已定义')
      this.assert(
        typeof MessagingUtils.waitForEventBus === 'function',
        'MessagingUtils.waitForEventBus 已定义'
      )

      try {
        await MessagingUtils.waitForEventBus()
        this.assert(MessagingUtils.isEventBusReady(), 'MessagingUtils 等待 EventBus 成功')
      } catch (e) {
        this.assert(false, 'MessagingUtils 等待 EventBus 失败: ' + e.message)
      }

      // 测试 6: ContentBridge 集成
      this.assert(typeof ContentBridge !== 'undefined', 'ContentBridge 存在')
      this.assert(typeof ContentBridge.markReady === 'function', 'ContentBridge.markReady 已定义')
      this.assert(typeof ContentBridge.isReady === 'function', 'ContentBridge.isReady 已定义')
      this.assert(typeof ContentBridge.getState === 'function', 'ContentBridge.getState 已定义')
      this.assert(
        typeof ContentBridge.sendMessage === 'function',
        'ContentBridge.sendMessage 已定义'
      )

      try {
        await ContentBridge.sendMessage('TEST_BRIDGE', { test: true })
      } catch (e) {
        // 预期可能失败
      }

      // 测试 7: 断路器功能
      EventBus.resetCircuitBreaker('TEST_REQUEST')
      this.assert(EventBus.getCircuitBreakerState('TEST_REQUEST') === 'closed', '断路器重置成功')

      // 测试 8: 测试清理
      EventBus.clear()
      const stateAfter = EventBus.getState()
      this.assert(stateAfter.handlers.length === 0, '清理后无处理器')

      console.log('========== 测试完成 ==========')
      console.log(`通过: ${this.passed}`)
      console.log(`失败: ${this.failed}`)

      return this.results
    },
  }

  // 暴露测试
  window.EventBusV46Test = EventBusV46Test

  console.log('测试脚本已加载。运行 EventBusV46Test.runAll() 开始测试。')
})()
