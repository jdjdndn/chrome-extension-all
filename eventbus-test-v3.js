/**
 * EventBus V3 测试工具
 */

(function () {
  'use strict';

  window.EventBusTestV3 = {
    /**
     * 运行所有测试
     */
    async runAllTests() {
      console.log('====================');
      console.log('EventBus V3 测试套件');
      console.log('====================\n');

      const results = [];

      // 基础测试
      results.push(await this.testBasicState());
      results.push(await this.testSubscribe());
      results.push(await this.testPublish());
      results.push(await this.testRequestResponse());
      results.push(await this.testOnce());

      // V3 新功能测试
      results.push(await this.testNamespaces());
      results.push(await this.testBatch());
      results.push(await this.testMiddleware());
      results.push(await this.testDeduplication());
      results.push(await this.testRetryPolicy());
      results.push(await this.testPriorityQueue());
      results.push(await this.testPerformanceMonitoring());

      // 汇总结果
      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;

      console.log('\n====================');
      console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
      console.log('====================');

      return { passed, failed, results };
    },

    /**
     * 测试基础状态
     */
    async testBasicState() {
      console.log('[Test 1] 基础状态检查...');
      try {
        const state = EventBus.getState();
        console.log('  环境:', state.env);
        console.log('  命名空间数:', state.namespaces.length);
        console.log('  队列大小:', state.queueSize);
        console.log('  性能:', state.performance);
        return { name: '基础状态', passed: true };
      } catch (error) {
        return { name: '基础状态', passed: false, error: error.message };
      }
    },

    /**
     * 测试订阅功能
     */
    async testSubscribe() {
      console.log('[Test 2] 订阅功能...');
      try {
        let received = false;
        const unsubscribe = EventBus.subscribe('TEST_SUBSCRIBE_V3', (data) => {
          received = true;
        });
        await EventBus.publish('TEST_SUBSCRIBE_V3', {});
        await new Promise(resolve => setTimeout(resolve, 100));
        unsubscribe();
        return { name: '订阅功能', passed: received };
      } catch (error) {
        return { name: '订阅功能', passed: false, error: error.message };
      }
    },

    /**
     * 测试发布功能
     */
    async testPublish() {
      console.log('[Test 3] 发布功能...');
      try {
        await EventBus.publish('TEST_PUBLISH_V3', {});
        return { name: '发布功能', passed: true };
      } catch (error) {
        return { name: '发布功能', passed: false, error: error.message };
      }
    },

    /**
     * 测试请求-响应
     */
    async testRequestResponse() {
      console.log('[Test 4] 请求-响应功能...');
      try {
        EventBus.on('TEST_ECHO_V3', (data) => {
          return { success: true, echo: data };
        });
        const response = await EventBus.request('TEST_ECHO_V3', { test: 'data' });
        return { name: '请求-响应', passed: response?.success === true };
      } catch (error) {
        return { name: '请求-响应', passed: false, error: error.message };
      }
    },

    /**
     * 测试 Once 订阅
     */
    async testOnce() {
      console.log('[Test 5] Once 订阅...');
      try {
        let count = 0;
        EventBus.once('TEST_ONCE_V3', () => { count++; });
        await EventBus.publish('TEST_ONCE_V3', {});
        await new Promise(resolve => setTimeout(resolve, 50));
        await EventBus.publish('TEST_ONCE_V3', {});
        await new Promise(resolve => setTimeout(resolve, 50));
        return { name: 'Once 订阅', passed: count === 1 };
      } catch (error) {
        return { name: 'Once 订阅', passed: false, error: error.message };
      }
    },

    /**
     * 测试命名空间
     */
    async testNamespaces() {
      console.log('[Test 6] 命名空间...');
      try {
        const api = EventBus.namespace('test');
        let received = false;

        api.subscribe('NS_EVENT', () => { received = true; });
        await api.publish('NS_EVENT', {});
        await new Promise(resolve => setTimeout(resolve, 100));

        return { name: '命名空间', passed: received };
      } catch (error) {
        return { name: '命名空间', passed: false, error: error.message };
      }
    },

    /**
     * 测试批量消息
     */
    async testBatch() {
      console.log('[Test 7] 批量消息...');
      try {
        const messages = [
          { type: 'BATCH_1', data: { id: 1 } },
          { type: 'BATCH_2', data: { id: 2 } },
          { type: 'BATCH_3', data: { id: 3 } }
        ];

        await EventBus.batch(messages);
        return { name: '批量消息', passed: true };
      } catch (error) {
        return { name: '批量消息', passed: false, error: error.message };
      }
    },

    /**
     * 测试中间件
     */
    async testMiddleware() {
      console.log('[Test 8] 中间件...');
      try {
        let called = false;

        EventBus.use((message, next) => {
          called = true;
          return next();
        });

        await EventBus.publish('MIDDLEWARE_TEST', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        return { name: '中间件', passed: called };
      } catch (error) {
        return { name: '中间件', passed: false, error: error.message };
      }
    },

    /**
     * 测试消息去重
     */
    async testDeduplication() {
      console.log('[Test 9] 消息去重...');
      try {
        let count = 0;
        EventBus.subscribe('DEDUP_TEST', () => { count++; });

        // 快速发送相同消息
        await EventBus.publish('DEDUP_TEST', { value: 1 });
        await EventBus.publish('DEDUP_TEST', { value: 1 });
        await new Promise(resolve => setTimeout(resolve, 100));

        // 第二条消息应该被去重
        return { name: '消息去重', passed: count === 1 };
      } catch (error) {
        return { name: '消息去重', passed: false, error: error.message };
      }
    },

    /**
     * 测试重试策略
     */
    async testRetryPolicy() {
      console.log('[Test 10] 重试策略...');
      try {
        let attempts = 0;

        EventBus.setRetryPolicy('RETRY_TEST', {
          maxRetries: 2,
          retryDelay: 100,
          shouldRetry: () => true
        });

        EventBus.on('RETRY_TEST', () => {
          attempts++;
          if (attempts < 2) throw new Error('Not ready');
          return { success: true };
        });

        const result = await EventBus.request('RETRY_TEST', {});
        return { name: '重试策略', passed: result?.success === true && attempts >= 2 };
      } catch (error) {
        return { name: '重试策略', passed: false, error: error.message };
      }
    },

    /**
     * 测试优先级队列
     */
    async testPriorityQueue() {
      console.log('[Test 11] 优先级队列...');
      try {
        const state = EventBus.getState();
        // 检查队列大小是否可用
        return { name: '优先级队列', passed: typeof state.queueSize === 'number' };
      } catch (error) {
        return { name: '优先级队列', passed: false, error: error.message };
      }
    },

    /**
     * 测试性能监控
     */
    async testPerformanceMonitoring() {
      console.log('[Test 12] 性能监控...');
      try {
        // 发送一些消息以收集性能数据
        for (let i = 0; i < 10; i++) {
          await EventBus.publish('PERF_TEST', { index: i });
        }

        const stats = EventBus.getStats();
        return { name: '性能监控', passed: typeof stats.performance === 'object' };
      } catch (error) {
        return { name: '性能监控', passed: false, error: error.message };
      }
    },

    /**
     * 显示状态面板
     */
    showStatusPanel() {
      const state = EventBus.getState();
      const stats = EventBus.getStats();

      console.log('\n====================');
      console.log('EventBus V3 状态面板');
      console.log('====================');
      console.log('环境:', state.env);
      console.log('实例ID:', state.instanceId);
      console.log('就绪:', state.isReady);
      console.log('运行时间:', Math.floor(state.uptime / 1000), '秒');
      console.log('消息计数:', state.messageCount);
      console.log('连接数:', state.connections.length);
      console.log('订阅数:', state.subscriptions.length);
      console.log('处理器数:', state.handlers.length);
      console.log('命名空间数:', state.namespaces.length);
      console.log('队列大小:', state.queueSize);
      console.log('\n统计信息:');
      console.log('  已发送:', stats.sent);
      console.log('  已接收:', stats.received);
      console.log('  失败:', stats.failed);
      console.log('  超时:', stats.timeout);
      console.log('  重试:', stats.retried);
      console.log('  追踪记录:', stats.trackedMessages);
      console.log('\n性能指标:');
      console.log('  平均延迟:', stats.performance.avgLatency, 'ms');
      console.log('  P99 延迟:', stats.performance.p99Latency, 'ms');
      console.log('  平均处理时间:', stats.performance.avgHandlerTime, 'ms');
      console.log('  P99 处理时间:', stats.performance.p99HandlerTime, 'ms');
      console.log('====================\n');
    },

    /**
     * 显示性能指标
     */
    showPerformanceMetrics() {
      const perf = EventBus.getState().performance;

      console.log('\n====================');
      console.log('性能指标');
      console.log('====================');
      console.log('消息延迟:');
      console.log('  平均:', perf.avgLatency, 'ms');
      console.log('  P99:', perf.p99Latency, 'ms');
      console.log('处理器执行时间:');
      console.log('  平均:', perf.avgHandlerTime, 'ms');
      console.log('  P99:', perf.p99HandlerTime, 'ms');
      console.log('总计:');
      console.log('  消息数:', perf.totalMessages);
      console.log('  处理器调用:', perf.totalHandlers);
      console.log('====================\n');
    },

    /**
     * 显示最近消息
     */
    showRecentMessages(count = 10) {
      const history = EventBus.getHistory({ limit: count });

      console.log('\n====================');
      console.log(`最近 ${count} 条消息`);
      console.log('====================');

      history.forEach((msg, i) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        let line = `${i + 1}. [${time}] ${msg.type} ${msg.messageType || ''}`;
        if (msg.namespace) line += ` (${msg.namespace})`;
        console.log(line);
        if (msg.from) console.log(`   来自: ${msg.from}`);
        if (msg.priority !== undefined) console.log(`   优先级: ${msg.priority}`);
      });

      console.log('====================\n');
    },

    /**
     * 显示命名空间
     */
    showNamespaces() {
      const state = EventBus.getState();

      console.log('\n====================');
      console.log('命名空间');
      console.log('====================');
      console.log('注册的命名空间:', state.namespaces);
      console.log('====================\n');
    },

    /**
     * 启用调试模式
     */
    enableDebugMode() {
      EventBus.setDebugMode(true);
      console.log('✓ EventBus V3 调试模式已启用');
    },

    /**
     * 禁用调试模式
     */
    disableDebugMode() {
      EventBus.setDebugMode(false);
      console.log('✓ EventBus V3 调试模式已禁用');
    },

    /**
     * 运行性能基准测试
     */
    async runBenchmark() {
      console.log('\n====================');
      console.log('EventBus 性能基准测试');
      console.log('====================\n');

      const iterations = 1000;
      const testData = { test: 'data', value: 123 };

      // 注册处理器
      EventBus.on('BENCHMARK_ECHO', (data) => data);

      console.log(`发送 ${iterations} 条消息...`);

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await EventBus.request('BENCHMARK_ECHO', testData);
      }

      const end = performance.now();
      const duration = end - start;
      const throughput = (iterations / duration) * 1000;

      console.log(`完成: ${duration.toFixed(2)}ms`);
      console.log(`吞吐量: ${Math.round(throughput)} 消息/秒`);
      console.log(`平均延迟: ${(duration / iterations).toFixed(2)}ms`);
      console.log('====================\n');

      return {
        duration,
        throughput: Math.round(throughput),
        avgLatency: duration / iterations
      };
    }
  };

  console.log('[EventBusTestV3] 测试工具已加载');
  console.log('可用命令:');
  console.log('  EventBusTestV3.runAllTests()          - 运行所有测试');
  console.log('  EventBusTestV3.showStatusPanel()      - 显示状态面板');
  console.log('  EventBusTestV3.showPerformanceMetrics() - 显示性能指标');
  console.log('  EventBusTestV3.showRecentMessages(10)  - 显示最近消息');
  console.log('  EventBusTestV3.showNamespaces()        - 显示命名空间');
  console.log('  EventBusTestV3.runBenchmark()         - 运行性能测试');
  console.log('  EventBusTestV3.enableDebugMode()      - 启用调试模式');

})();
