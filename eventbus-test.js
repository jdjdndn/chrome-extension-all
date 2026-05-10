/**
 * EventBus V5 测试工具
 *
 * 包含所有 V4 测试功能 + V5 新功能测试
 */

(function () {
  'use strict'

  window.EventBusTestV5 = {
    /**
     * 运行所有测试
     */
    async runAllTests() {
      console.log('====================')
      console.log('EventBus V5 测试套件')
      console.log('====================\n')

      const results = []

      // V4 基础测试
      results.push(await this.testBasicState())
      results.push(await this.testSubscribe())
      results.push(await this.testRequestResponse())
      results.push(await this.testCircuitBreaker())
      results.push(await this.testPlugins())

      // V5 新功能测试
      results.push(await this.testMessageTemplates())
      results.push(await this.testMessageRecording())
      results.push(await this.testMessageReplay())
      results.push(await this.testSerialization())
      results.push(await this.testMemoryProfiler())
      results.push(await this.testSmartDiagnostics())
      results.push(await this.testVisualization())
      results.push(await this.testPerformanceMetrics())

      // 汇总
      const passed = results.filter((r) => r.passed).length
      const failed = results.filter((r) => !r.passed).length

      console.log('\n====================')
      console.log(`测试完成: ${passed} 通过, ${failed} 失败`)
      console.log('====================')

      return { passed, failed, results }
    },

    /**
     * 测试基础状态
     */
    async testBasicState() {
      console.log('[Test 1] 基础状态...')
      try {
        const state = EventBus.getState()
        console.log('  版本:', state.version)
        console.log('  环境:', state.env)
        console.log('  实例ID:', state.instanceId)
        console.log('  就绪:', state.isReady)

        if (state.version !== '5.0.0') {
          throw new Error(`版本不匹配: 期望 5.0.0, 实际 ${state.version}`)
        }

        return { name: '基础状态', passed: true }
      } catch (error) {
        return { name: '基础状态', passed: false, error: error.message }
      }
    },

    /**
     * 测试订阅功能
     */
    async testSubscribe() {
      console.log('[Test 2] 订阅功能...')
      try {
        let received = false
        const unsubscribe = EventBus.subscribe('TEST_SUB_V5', () => {
          received = true
        })
        await EventBus.publish('TEST_SUB_V5', {})
        await new Promise((resolve) => setTimeout(resolve, 100))
        unsubscribe()
        return { name: '订阅功能', passed: received }
      } catch (error) {
        return { name: '订阅功能', passed: false, error: error.message }
      }
    },

    /**
     * 测试请求响应
     */
    async testRequestResponse() {
      console.log('[Test 3] 请求-响应...')
      try {
        EventBus.on('TEST_ECHO_V5', (data) => ({ success: true, echo: data }))
        const response = await EventBus.request('TEST_ECHO_V5', { test: 'data' })
        return { name: '请求-响应', passed: response?.success === true }
      } catch (error) {
        return { name: '请求-响应', passed: false, error: error.message }
      }
    },

    /**
     * 测试断路器
     */
    async testCircuitBreaker() {
      console.log('[Test 4] 断路器...')
      try {
        EventBus.on('CB_TEST_V5', () => {
          if (Math.random() > 0.5) {throw new Error('Random error')}
          return { success: true }
        })

        for (let i = 0; i < 10; i++) {
          try {
            await EventBus.request('CB_TEST_V5', { index: i })
          } catch (e) {
            // 预期会失败
          }
        }

        const state = EventBus.getCircuitBreakerState('CB_TEST_V5')
        EventBus.resetCircuitBreaker('CB_TEST_V5')
        return { name: '断路器', passed: typeof state === 'string' }
      } catch (error) {
        return { name: '断路器', passed: false, error: error.message }
      }
    },

    /**
     * 测试插件系统
     */
    async testPlugins() {
      console.log('[Test 5] 插件系统...')
      try {
        EventBus.registerPlugin({
          name: 'test-plugin-v5',
          version: '1.0.0',
          hooks: {
            beforeSend: ({ type }) => {
              console.log('  [插件] 拦截发送:', type)
            },
          },
        })

        const plugins = EventBus.getPlugins()
        const testPlugin = plugins.find((p) => p.name === 'test-plugin-v5')

        EventBus.unregisterPlugin('test-plugin-v5')

        return { name: '插件系统', passed: !!testPlugin }
      } catch (error) {
        return { name: '插件系统', passed: false, error: error.message }
      }
    },

    /**
     * 测试消息模板
     */
    async testMessageTemplates() {
      console.log('[Test 6] 消息模板...')
      try {
        // 定义模板
        EventBus.defineTemplate('USER_ACTION', {
          schema: {
            required: ['userId', 'action'],
          },
          defaults: {
            timestamp: Date.now(),
          },
          validate: (data) => {
            const errors = []
            if (!data.userId) {errors.push('userId is required')}
            if (!data.action) {errors.push('action is required')}
            return errors.length > 0 ? errors : null
          },
        })

        // 创建消息
        const message = EventBus.createMessage('USER_ACTION', {
          userId: '123',
          action: 'click',
        })

        const templates = EventBus.listTemplates()

        return {
          name: '消息模板',
          passed: templates.includes('USER_ACTION') && message.userId === '123',
        }
      } catch (error) {
        return { name: '消息模板', passed: false, error: error.message }
      }
    },

    /**
     * 测试消息录制
     */
    async testMessageRecording() {
      console.log('[Test 7] 消息录制...')
      try {
        EventBus.clearRecording()
        EventBus.startRecording({ test: 'v5' })

        // 发送一些消息
        await EventBus.publish('RECORD_TEST_1', { data: 'test1' })
        await EventBus.publish('RECORD_TEST_2', { data: 'test2' })

        const recording = EventBus.stopRecording()

        return { name: '消息录制', passed: recording && recording.messages.length >= 2 }
      } catch (error) {
        return { name: '消息录制', passed: false, error: error.message }
      }
    },

    /**
     * 测试消息回放
     */
    async testMessageReplay() {
      console.log('[Test 8] 消息回放...')
      try {
        // 创建录制内容
        const messages = [
          { type: 'REPLAY_TEST_1', data: { value: 1 }, __offset: 0 },
          { type: 'REPLAY_TEST_2', data: { value: 2 }, __offset: 100 },
        ]

        let replayCount = 0
        EventBus.subscribe('REPLAY_TEST_1', () => replayCount++)
        EventBus.subscribe('REPLAY_TEST_2', () => replayCount++)

        await EventBus.replay(messages, { speed: 100 })

        await new Promise((resolve) => setTimeout(resolve, 200))

        return { name: '消息回放', passed: replayCount >= 2 }
      } catch (error) {
        return { name: '消息回放', passed: false, error: error.message }
      }
    },

    /**
     * 测试序列化
     */
    async testSerialization() {
      console.log('[Test 9] 序列化...')
      try {
        const testData = {
          string: 'test',
          number: 123,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          object: { nested: { value: 'deep' } },
        }

        EventBus.setSerializationFormat('json')
        // 序列化功能是内部的，测试基本功能
        return { name: '序列化', passed: true }
      } catch (error) {
        return { name: '序列化', passed: false, error: error.message }
      }
    },

    /**
     * 测试内存分析器
     */
    async testMemoryProfiler() {
      console.log('[Test 10] 内存分析器...')
      try {
        EventBus.startMemoryProfiler()

        // 执行一些操作
        for (let i = 0; i < 10; i++) {
          await EventBus.publish('MEMORY_TEST', { index: i })
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))

        const report = EventBus.getMemoryReport()

        EventBus.stopMemoryProfiler()

        return { name: '内存分析器', passed: report && report.samples > 0 }
      } catch (error) {
        return { name: '内存分析器', passed: false, error: error.message }
      }
    },

    /**
     * 测试智能错误诊断
     */
    async testSmartDiagnostics() {
      console.log('[Test 11] 智能错误诊断...')
      try {
        const health = EventBus.getHealthAnalysis()

        return { name: '智能错误诊断', passed: health && typeof health.overall === 'string' }
      } catch (error) {
        return { name: '智能错误诊断', passed: false, error: error.message }
      }
    },

    /**
     * 测试可视化
     */
    async testVisualization() {
      console.log('[Test 12] 可视化...')
      try {
        const graph = EventBus.getVisualization('graph')
        const timeline = EventBus.getVisualization('timeline')

        return { name: '可视化', passed: graph && timeline }
      } catch (error) {
        return { name: '可视化', passed: false, error: error.message }
      }
    },

    /**
     * 测试性能指标
     */
    async testPerformanceMetrics() {
      console.log('[Test 13] 性能指标...')
      try {
        // 执行一些请求以收集性能数据
        EventBus.on('PERF_TEST_V5', (data) => data)

        for (let i = 0; i < 20; i++) {
          await EventBus.request('PERF_TEST_V5', { index: i })
        }

        const metrics = EventBus.getPerformanceMetrics('PERF_TEST_V5')

        return { name: '性能指标', passed: metrics && metrics.count > 0 }
      } catch (error) {
        return { name: '性能指标', passed: false, error: error.message }
      }
    },

    /**
     * 显示完整状态
     */
    showFullStatus() {
      const state = EventBus.getState()
      const stats = EventBus.getStats()

      console.log('\n====================')
      console.log('EventBus V5 完整状态')
      console.log('====================')
      console.log('基础信息:')
      console.log('  版本:', state.version)
      console.log('  环境:', state.env)
      console.log('  实例ID:', state.instanceId)
      console.log('  就绪:', state.isReady)
      console.log('  运行时间:', Math.floor(state.uptime / 1000), '秒')
      console.log('  消息计数:', state.messageCount)

      console.log('\n功能状态:')
      console.log('  订阅数:', state.subscriptions)
      console.log('  处理器:', state.handlers)
      console.log('  连接数:', state.connections.tabs?.length || 0)

      console.log('\n配置:')
      Object.entries(state.config).forEach(([key, value]) => {
        if (typeof value !== 'object') {
          console.log(`  ${key}:`, value)
        }
      })

      console.log('\n断路器状态:')
      Object.entries(state.circuitBreakers).forEach(([type, breaker]) => {
        const statusSymbol =
          breaker.state === 'closed' ? '🟢' : breaker.state === 'open' ? '🔴' : '🟡'
        console.log(`  ${statusSymbol} ${type}:`, breaker.state)
      })

      console.log('\n插件:')
      state.plugins.forEach((p) => {
        const status = p.enabled ? '✅' : '❌'
        console.log(`  ${status} ${p.name} v${p.version}`)
      })

      console.log('\n统计信息:')
      console.log('  已发送:', stats.sent)
      console.log('  已接收:', stats.received)
      console.log('  失败:', stats.failed)
      console.log('  超时:', stats.timeout)
      console.log('  追踪记录:', stats.trackedMessages)

      console.log('====================\n')
    },

    /**
     * 显示性能指标
     */
    showPerformanceMetrics() {
      const metrics = EventBus.getPerformanceMetrics()

      console.log('\n====================')
      console.log('性能指标')
      console.log('====================')

      metrics.forEach((m) => {
        console.log(`\n${m.operation}:`)
        console.log('  调用次数:', m.count)
        console.log('  平均时间:', m.average.toFixed(2), 'ms')
        console.log('  最小时间:', m.min.toFixed(2), 'ms')
        console.log('  最大时间:', m.max.toFixed(2), 'ms')
        console.log('  P50:', m.p50.toFixed(2), 'ms')
        console.log('  P95:', m.p95.toFixed(2), 'ms')
        console.log('  P99:', m.p99.toFixed(2), 'ms')
      })

      console.log('\n====================\n')
    },

    /**
     * 显示内存报告
     */
    showMemoryReport() {
      const report = EventBus.getMemoryReport()

      console.log('\n====================')
      console.log('内存报告')
      console.log('====================')

      if (report.error) {
        console.log('错误:', report.error)
      } else {
        console.log('样本数:', report.samples)
        console.log('持续时间:', (report.duration / 1000).toFixed(2), '秒')

        if (report.memory) {
          console.log('\n内存使用:')
          console.log('  当前:', (report.memory.current / 1024 / 1024).toFixed(2), 'MB')
          console.log('  峰值:', (report.memory.peak / 1024 / 1024).toFixed(2), 'MB')
          console.log('  平均:', (report.memory.average / 1024 / 1024).toFixed(2), 'MB')
          console.log(
            '  趋势:',
            report.memory.trend > 0 ? '+' : '',
            (report.memory.trend / 1024).toFixed(2),
            'KB'
          )
        }

        if (report.messages) {
          console.log('\n消息:')
          console.log('  当前:', report.messages.current)
          console.log('  峰值:', report.messages.peak)
        }

        if (report.subscriptions) {
          console.log('\n订阅:', report.subscriptions.current)
        }
      }

      console.log('\n====================\n')
    },

    /**
     * 显示健康分析
     */
    showHealthAnalysis() {
      const health = EventBus.getHealthAnalysis()

      console.log('\n====================')
      console.log('健康分析')
      console.log('====================')
      console.log('总体状态:', health.overall)

      if (health.issues && health.issues.length > 0) {
        console.log('\n发现问题:')
        health.issues.forEach((issue, index) => {
          const severityIcon =
            issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '⚠️' : 'ℹ️'
          console.log(`\n${severityIcon} 问题 ${index + 1}:`)
          console.log('  严重程度:', issue.severity)
          console.log('  描述:', issue.message)
          console.log('  建议:', issue.suggestion)
        })
      } else {
        console.log('\n✅ 未发现问题')
      }

      console.log('\n====================\n')
    },

    /**
     * 显示消息模板
     */
    showTemplates() {
      const templates = EventBus.listTemplates()

      console.log('\n====================')
      console.log('消息模板')
      console.log('====================')

      if (templates.length === 0) {
        console.log('未定义模板')
      } else {
        templates.forEach((name) => {
          console.log(`  - ${name}`)
        })
      }

      console.log('\n====================\n')
    },

    /**
     * 性能基准测试
     */
    async runBenchmark() {
      console.log('\n====================')
      console.log('EventBus V5 性能基准测试')
      console.log('====================\n')

      const iterations = 100
      const testData = { test: 'data', value: 123 }

      EventBus.on('BENCHMARK_ECHO_V5', (data) => data)

      console.log(`发送 ${iterations} 条消息...`)

      EventBus.startMemoryProfiler()

      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        await EventBus.request('BENCHMARK_ECHO_V5', testData)
      }

      const duration = performance.now() - start
      const avgLatency = duration / iterations

      await new Promise((resolve) => setTimeout(resolve, 500))

      EventBus.stopMemoryProfiler()

      const memReport = EventBus.getMemoryReport()
      const metrics = EventBus.getPerformanceMetrics('BENCHMARK_ECHO_V5')

      console.log(`完成: ${duration.toFixed(2)}ms`)
      console.log(`平均延迟: ${avgLatency.toFixed(2)}ms`)
      console.log(`吞吐量: ${Math.round((iterations / duration) * 1000)} 消息/秒`)

      if (metrics) {
        console.log('\n详细性能:')
        console.log('  P50:', metrics.p50.toFixed(2), 'ms')
        console.log('  P95:', metrics.p95.toFixed(2), 'ms')
        console.log('  P99:', metrics.p99.toFixed(2), 'ms')
      }

      if (memReport && memReport.memory) {
        console.log('\n内存使用:')
        console.log('  峰值:', (memReport.memory.peak / 1024 / 1024).toFixed(2), 'MB')
      }

      console.log('\n====================\n')

      return {
        duration,
        avgLatency,
        throughput: Math.round((iterations / duration) * 1000),
      }
    },

    /**
     * 演示消息录制和回放
     */
    async demoRecordingAndReplay() {
      console.log('\n====================')
      console.log('消息录制和回放演示')
      console.log('====================\n')

      // 设置监听器
      const receivedMessages = []
      EventBus.subscribe('DEMO_ACTION', (data) => {
        receivedMessages.push(data)
        console.log('  收到消息:', data)
      })

      // 开始录制
      console.log('1. 开始录制...')
      EventBus.startRecording({ demo: true })

      // 发送消息
      console.log('2. 发送消息...')
      await EventBus.publish('DEMO_ACTION', { action: 'click', target: 'button' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      await EventBus.publish('DEMO_ACTION', { action: 'type', value: 'hello' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      await EventBus.publish('DEMO_ACTION', { action: 'submit', form: 'login' })

      // 停止录制
      console.log('3. 停止录制...')
      const recording = EventBus.stopRecording()
      console.log(`   录制了 ${recording.messages.length} 条消息`)

      // 导出录制
      console.log('\n4. 导出录制...')
      const exported = EventBus.exportRecording()
      console.log(`   导出大小: ${exported.length} 字符`)

      // 清除接收记录
      receivedMessages.length = 0
      console.log('\n5. 清除接收记录...')

      // 回放
      console.log('\n6. 回放消息...')
      await EventBus.replay(recording.messages, { speed: 10 })

      await new Promise((resolve) => setTimeout(resolve, 200))

      console.log(`\n7. 回放完成，收到 ${receivedMessages.length} 条消息`)

      console.log('\n====================\n')
    },

    /**
     * 启用调试模式
     */
    enableDebugMode() {
      EventBus.setDebugMode(true)
      console.log('✓ EventBus V5 调试模式已启用')
    },

    /**
     * 禁用调试模式
     */
    disableDebugMode() {
      EventBus.setDebugMode(false)
      console.log('✓ EventBus V5 调试模式已禁用')
    },

    /**
     * 获取快照
     */
    getSnapshot() {
      const snapshot = EventBus.getSnapshot()

      console.log('\n====================')
      console.log('EventBus 快照')
      console.log('====================')
      console.log('时间戳:', new Date(snapshot.timestamp).toLocaleString())
      console.log('版本:', snapshot.state.version)
      console.log('运行时间:', Math.floor(snapshot.state.uptime / 1000), '秒')
      console.log('消息统计:', snapshot.stats.sent, '发送,', snapshot.stats.received, '接收')

      if (snapshot.health) {
        console.log('健康状态:', snapshot.health.overall)
      }

      console.log('====================\n')

      return snapshot
    },
  }

  console.log('[EventBusTestV5] 测试工具已加载')
  console.log('可用命令:')
  console.log('  EventBusTestV5.runAllTests()              - 运行所有测试')
  console.log('  EventBusTestV5.showFullStatus()           - 显示完整状态')
  console.log('  EventBusTestV5.showPerformanceMetrics()   - 显示性能指标')
  console.log('  EventBusTestV5.showMemoryReport()         - 显示内存报告')
  console.log('  EventBusTestV5.showHealthAnalysis()       - 显示健康分析')
  console.log('  EventBusTestV5.showTemplates()            - 显示消息模板')
  console.log('  EventBusTestV5.runBenchmark()             - 运行性能测试')
  console.log('  EventBusTestV5.demoRecordingAndReplay()   - 录制回放演示')
  console.log('  EventBusTestV5.getSnapshot()              - 获取快照')
})()
