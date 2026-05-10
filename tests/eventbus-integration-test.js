/**
 * EventBus V4.5 Chrome Extension 集成测试
 * 在浏览器控制台中运行此测试
 */

(function () {
  'use strict'

  const EventBusTest = {
    results: [],
    passed: 0,
    failed: 0,

    log(message, type = 'info') {
      const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️'
      console.log(`${prefix} [EventBus测试] ${message}`)
    },

    assert(condition, message) {
      if (condition) {
        this.passed++
        this.results.push({ status: 'pass', message })
        this.log(message, 'pass')
        return true
      } else {
        this.failed++
        this.results.push({ status: 'fail', message })
        this.log(message, 'fail')
        return false
      }
    },

    // 测试 1: EventBus 加载和初始化
    async testEventBusLoaded() {
      this.log('测试 1: EventBus 加载和初始化')

      // 检查 EventBus 是否存在
      this.assert(typeof EventBus !== 'undefined', 'EventBus 全局对象存在')

      // 检查 EventBus 版本
      if (typeof EventBus !== 'undefined') {
        const state = EventBus.getState()
        this.assert(state.version === '4.5.5', `EventBus 版本正确: ${state.version}`)
        this.assert(state.isReady, 'EventBus 已初始化')
      }

      return true
    },

    // 测试 2: Transport 层功能
    async testTransportLayer() {
      this.log('测试 2: Transport 层功能')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过 Transport 测试')
        return false
      }

      // 检查 Transport 是否暴露
      this.assert(typeof EventBus.Transport !== 'undefined', 'Transport 已暴露')

      // 检查 Transport 方法
      if (EventBus.Transport) {
        this.assert(typeof EventBus.Transport.send === 'function', 'Transport.send 方法存在')
        this.assert(
          typeof EventBus.Transport.broadcast === 'function',
          'Transport.broadcast 方法存在'
        )
        this.assert(
          typeof EventBus.Transport.registerPort === 'function',
          'Transport.registerPort 方法存在'
        )
        this.assert(
          typeof EventBus.Transport.sendViaPort === 'function',
          'Transport.sendViaPort 方法存在'
        )
      }

      return true
    },

    // 测试 3: 消息发送和接收
    async testMessageSendReceive() {
      this.log('测试 3: 消息发送和接收')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过消息测试')
        return false
      }

      // 注册测试处理器
      let received = false
      const unsubscribe = EventBus.subscribe('TEST_MESSAGE', (data) => {
        received = true
      })

      // 发布消息
      await EventBus.publish('TEST_MESSAGE', { test: true })
      await new Promise((r) => setTimeout(r, 100))

      this.assert(received, '消息发布/订阅工作正常')

      // 取消订阅
      unsubscribe()

      return true
    },

    // 测试 4: Request/Response 模式
    async testRequestResponse() {
      this.log('测试 4: Request/Response 模式')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过 Request 测试')
        return false
      }

      // 注册响应处理器
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

      return true
    },

    // 测试 5: MessagingUtils 集成
    async testMessagingUtilsIntegration() {
      this.log('测试 5: MessagingUtils 集成')

      // 检查 MessagingUtils 是否存在
      this.assert(typeof MessagingUtils !== 'undefined', 'MessagingUtils 存在')

      if (typeof MessagingUtils !== 'undefined') {
        this.assert(
          typeof MessagingUtils.sendToBackground === 'function',
          'sendToBackground 方法存在'
        )
        this.assert(
          typeof MessagingUtils.isEventBusReady === 'function',
          'isEventBusReady 方法存在'
        )
        this.assert(
          typeof MessagingUtils.waitForEventBus === 'function',
          'waitForEventBus 方法存在'
        )
        this.assert(typeof MessagingUtils.subscribe === 'function', 'subscribe 方法存在')
        this.assert(typeof MessagingUtils.publish === 'function', 'publish 方法存在')
      }

      return true
    },

    // 测试 6: ContentBridge 集成
    async testContentBridgeIntegration() {
      this.log('测试 6: ContentBridge 集成')

      // 检查 ContentBridge 是否存在
      this.assert(typeof ContentBridge !== 'undefined', 'ContentBridge 存在')

      if (typeof ContentBridge !== 'undefined') {
        this.assert(typeof ContentBridge.markReady === 'function', 'markReady 方法存在')
        this.assert(typeof ContentBridge.isReady === 'function', 'isReady 方法存在')
        this.assert(typeof ContentBridge.getState === 'function', 'getState 方法存在')
        this.assert(typeof ContentBridge.sendMessage === 'function', 'sendMessage 方法存在')
      }

      return true
    },

    // 测试 7: 断路器功能
    async testCircuitBreaker() {
      this.log('测试 7: 断路器功能')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过断路器测试')
        return false
      }

      const state = EventBus.getState()
      this.assert(state.circuitBreakers !== undefined, '断路器状态可访问')

      return true
    },

    // 测试 8: 健康检查
    async testHealthCheck() {
      this.log('测试 8: 健康检查')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过健康检查测试')
        return false
      }

      try {
        const health = EventBus.getHealthAnalysis()
        this.assert(health !== undefined, '健康检查返回结果')
      } catch (error) {
        this.assert(false, `健康检查失败: ${error.message}`)
      }

      return true
    },

    // 测试 9: 性能指标
    async testPerformanceMetrics() {
      this.log('测试 9: 性能指标')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过性能指标测试')
        return false
      }

      try {
        const metrics = EventBus.getPerformanceMetrics()
        this.assert(metrics !== undefined, '性能指标返回结果')
      } catch (error) {
        this.assert(false, `性能指标失败: ${error.message}`)
      }

      return true
    },

    // 测试 10: 快照功能
    async testSnapshot() {
      this.log('测试 10: 快照功能')

      if (typeof EventBus === 'undefined') {
        this.assert(false, 'EventBus 不存在，跳过快照测试')
        return false
      }

      try {
        const snapshot = EventBus.getSnapshot()
        this.assert(snapshot !== undefined, '快照返回结果')
        this.assert(snapshot.timestamp !== undefined, '快照包含时间戳')
        this.assert(snapshot.state !== undefined, '快照包含状态')
      } catch (error) {
        this.assert(false, `快照失败: ${error.message}`)
      }

      return true
    },

    // 运行所有测试
    async runAllTests() {
      this.log('========== 开始 EventBus 集成测试 ==========')

      await this.testEventBusLoaded()
      await this.testTransportLayer()
      await this.testMessageSendReceive()
      await this.testRequestResponse()
      await this.testMessagingUtilsIntegration()
      await this.testContentBridgeIntegration()
      await this.testCircuitBreaker()
      await this.testHealthCheck()
      await this.testPerformanceMetrics()
      await this.testSnapshot()

      this.log('========== 测试完成 ==========')
      this.log(`通过: ${this.passed}, 失败: ${this.failed}`)

      return {
        passed: this.passed,
        failed: this.failed,
        results: this.results,
      }
    },
  }

  // 导出到全局
  window.EventBusIntegrationTest = EventBusTest

  console.log(
    '[EventBus集成测试] 测试脚本已加载。运行 EventBusIntegrationTest.runAllTests() 开始测试。'
  )
})()
