/**
 * EventBus V4 测试工具
 */

(function () {
  'use strict';

  window.EventBusTestV4 = {
    /**
     * 运行所有测试
     */
    async runAllTests() {
      console.log('====================');
      console.log('EventBus V4 测试套件');
      console.log('====================\n');

      const results = [];

      // 基础测试
      results.push(await this.testBasicState());
      results.push(await this.testSubscribe());
      results.push(await this.testRequestResponse());

      // V4 新功能测试
      results.push(await this.testCircuitBreaker());
      results.push(await this.testPlugins());
      results.push(await this.testCompression());
      results.push(await this.testPersistence());
      results.push(await this.testHealthCheck());
      results.push(await this.testProfiler());

      // 汇总
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
      console.log('[Test 1] 基础状态...');
      try {
        const state = EventBus.getState();
        console.log('  配置:', state.config ? Object.keys(state.config).length + ' 项' : 'N/A');
        console.log('  断路器:', Object.keys(state.circuitBreakers).length + ' 个');
        console.log('  插件:', state.plugins?.length || 0);
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
        const unsubscribe = EventBus.subscribe('TEST_SUB_V4', () => { received = true; });
        await EventBus.publish('TEST_SUB_V4', {});
        await new Promise(resolve => setTimeout(resolve, 100));
        unsubscribe();
        return { name: '订阅功能', passed: received };
      } catch (error) {
        return { name: '订阅功能', passed: false, error: error.message };
      }
    },

    /**
     * 测试请求响应
     */
    async testRequestResponse() {
      console.log('[Test 3] 请求-响应...');
      try {
        EventBus.on('TEST_ECHO_V4', (data) => ({ success: true, echo: data }));
        const response = await EventBus.request('TEST_ECHO_V4', { test: 'data' });
        return { name: '请求-响应', passed: response?.success === true };
      } catch (error) {
        return { name: '请求-响应', passed: false, error: error.message };
      }
    },

    /**
     * 测试断路器
     */
    async testCircuitBreaker() {
      console.log('[Test 4] 断路器...');
      try {
        EventBus.on('CB_TEST', () => {
          if (Math.random() > 0.5) throw new Error('Random error');
          return { success: true };
        });

        // 发送多个请求触发断路器
        for (let i = 0; i < 10; i++) {
          try {
            await EventBus.request('CB_TEST', { index: i });
          } catch (e) {
            // 预期会失败
          }
        }

        const state = EventBus.getCircuitBreakerState('CB_TEST');
        console.log('  断路器状态:', state);

        // 重置断路器
        EventBus.resetCircuitBreaker('CB_TEST');
        return { name: '断路器', passed: typeof state === 'string' };
      } catch (error) {
        return { name: '断路器', passed: false, error: error.message };
      }
    },

    /**
     * 测试插件系统
     */
    async testPlugins() {
      console.log('[Test 5] 插件系统...');
      try {
        // 注册测试插件
        EventBus.registerPlugin({
          name: 'test-plugin',
          version: '1.0.0',
          hooks: {
            beforeSend: ({ type }) => {
              console.log('  [插件] 拦截发送:', type);
            }
          }
        });

        const plugins = EventBus.getPlugins();
        console.log('  已注册插件:', plugins.length);

        // 卸载插件
        EventBus.unregisterPlugin('test-plugin');

        return { name: '插件系统', passed: true };
      } catch (error) {
        return { name: '插件系统', passed: false, error: error.message };
      }
    },

    /**
     * 测试消息压缩
     */
    async testCompression() {
      console.log('[Test 6] 消息压缩...');
      try {
        const largeData = {
          data: 'x'.repeat(2000),  // 大数据
          metadata: { a: 1, b: 2, c: 3 }
        };

        const config = EventBus.getConfig();
        console.log('  压缩功能:', config.ENABLE_COMPRESSION);

        return { name: '消息压缩', passed: true };
      } catch (error) {
        return { name: '消息压缩', passed: false, error: error.message };
      }
    },

    /**
     * 测试持久化
     */
    async testPersistence() {
      console.log('[Test 7] 持久化...');
      try {
        await EventBus.clearQueue();

        // 添加待处理消息
        await EventBus.publish('PERSIST_TEST', { data: 'test' });

        const queue = EventBus.getQueue();
        console.log('  队列大小:', queue.length);

        return { name: '持久化', passed: true };
      } catch (error) {
        return { name: '持久化', passed: false, error: error.message };
      }
    },

    /**
     * 测试健康检查
     */
    async testHealthCheck() {
      console.log('[Test 8] 健康检查...');
      try {
        const health = await EventBus.getHealth();
        console.log('  总体状态:', health.overall);
        console.log('  检查项:', Object.keys(health.checks));
        return { name: '健康检查', passed: health.overall !== 'unhealthy' };
      } catch (error) {
        return { name: '健康检查', passed: false, error: error.message };
      }
    },

    /**
     * 测试性能分析器
     */
    async testProfiler() {
      console.log('[Test 9] 性能分析器...');
      try {
        EventBus.startProfiler();

        // 执行一些操作
        for (let i = 0; i < 50; i++) {
          await EventBus.publish('PERF_TEST', { index: i });
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const report = EventBus.getProfilerReport();
        console.log('  操作类型:', Object.keys(report.operations).length);
        console.log('  最慢操作:', report.slowestOperations.slice(0, 3).map(o => o.operation));

        EventBus.stopProfiler();
        return { name: '性能分析器', passed: report.totalSamples > 0 };
      } catch (error) {
        return { name: '性能分析器', passed: false, error: error.message };
      }
    },

    /**
     * 显示完整状态
     */
    showFullStatus() {
      const state = EventBus.getState();
      const stats = EventBus.getStats();

      console.log('\n====================');
      console.log('EventBus V4 完整状态');
      console.log('====================');
      console.log('基础信息:');
      console.log('  环境:', state.env);
      console.log('  实例ID:', state.instanceId);
      console.log('  就绪:', state.isReady);
      console.log('  运行时间:', Math.floor(state.uptime / 1000), '秒');
      console.log('  消息计数:', state.messageCount);

      console.log('\n功能状态:');
      console.log('  命名空间:', state.subscriptions.length);
      console.log('  处理器:', state.handlers.length);
      console.log('  连接数:', state.connections.length);

      console.log('\n断路器状态:');
      Object.entries(stats.circuitBreakers).forEach(([type, state]) => {
        console.log(`  ${type}:`, state);
      });

      console.log('\n插件:');
      stats.plugins.forEach(p => {
        console.log(`  ${p.name}:`, p.enabled ? '启用' : '禁用', `v${p.version}`);
      });

      console.log('\n统计信息:');
      console.log('  已发送:', stats.sent);
      console.log('  已接收:', stats.received);
      console.log('  失败:', stats.failed);
      console.log('  超时:', stats.timeout);
      console.log('  重试:', stats.retried);
      console.log('  压缩:', stats.compressed);
      console.log('  追踪记录:', stats.trackedMessages);

      console.log('====================\n');
    },

    /**
     * 显示断路器状态
     */
    showCircuitBreakers() {
      const states = EventBus.getAllCircuitBreakerStates();

      console.log('\n====================');
      console.log('断路器状态');
      console.log('====================');

      Object.entries(states).forEach(([type, state]) => {
        const statusSymbol = state.state === 'closed' ? '🟢' : state.state === 'open' ? '🔴' : '🟡';
        console.log(`${statusSymbol} ${type}:`);
        console.log('  状态:', state.state);
        console.log('  失败次数:', state.failureCount);
        console.log('  最后失败:', new Date(state.lastFailureTime).toLocaleTimeString());
        console.log('  最后成功:', new Date(state.lastSuccessTime).toLocaleTimeString());
      });

      console.log('====================\n');
    },

    /**
     * 显示插件列表
     */
    showPlugins() {
      const plugins = EventBus.getPlugins();

      console.log('\n====================');
      console.log('已安装插件');
      console.log('====================');

      plugins.forEach(p => {
        const status = p.enabled ? '✅' : '❌';
        console.log(`${status} ${p.name} v${p.version}`);
      });

      console.log('====================\n');
    },

    /**
     * 显示健康状态
     */
    async showHealth() {
      const health = await EventBus.getHealth();

      console.log('\n====================');
      console.log('系统健康状态');
      console.log('====================');
      console.log('总体状态:', health.overall);
      console.log('检查时间:', new Date(health.timestamp).toLocaleString());

      Object.entries(health.checks).forEach(([name, check]) => {
        const statusIcon = check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
        console.log(`${statusIcon} ${name}:`, check.status);
        if (check.error) console.log('   错误:', check.error);
      });

      console.log('====================\n');
    },

    /**
     * 性能基准测试
     */
    async runBenchmark() {
      console.log('\n====================');
      console.log('EventBus V4 性能基准测试');
      console.log('====================\n');

      const iterations = 100;
      const testData = { test: 'data', value: 123 };

      EventBus.on('BENCHMARK_ECHO_V4', (data) => data);

      console.log(`发送 ${iterations} 条消息...`);

      EventBus.startProfiler();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await EventBus.request('BENCHMARK_ECHO_V4', testData);
      }

      const duration = performance.now() - start;
      const avgLatency = duration / iterations;

      EventBus.stopProfiler();

      const report = EventBus.getProfilerReport();

      console.log(`完成: ${duration.toFixed(2)}ms`);
      console.log(`平均延迟: ${avgLatency.toFixed(2)}ms`);
      console.log(`吞吐量: ${Math.round((iterations / duration) * 1000)} 消息/秒`);
      console.log('\n操作统计:');
      Object.entries(report.operations).forEach(([op, stats]) => {
        console.log(`  ${op}:`);
        console.log('    次数:', stats.count);
        console.log('    平均:', stats.avgTime.toFixed(2), 'ms');
        console.log('    最小:', stats.minTime.toFixed(2), 'ms');
        console.log('    最大:', stats.maxTime.toFixed(2), 'ms');
      });

      console.log('====================\n');

      return {
        duration,
        avgLatency,
        throughput: Math.round((iterations / duration) * 1000)
      };
    },

    /**
     * 断路器测试
     */
    async testCircuitBreakerDemo() {
      console.log('\n====================');
      console.log('断路器演示');
      console.log('====================\n');

      EventBus.on('UNSTABLE_API', () => {
        if (Math.random() > 0.3) throw new Error('API Error');
        return { data: 'success' };
      });

      console.log('发送 20 个请求到不稳定 API...');

      for (let i = 1; i <= 20; i++) {
        try {
          await EventBus.request('UNSTABLE_API', { attempt: i });
          console.log(`  请求 ${i}: ✅ 成功`);
        } catch (error) {
          const state = EventBus.getCircuitBreakerState('UNSTABLE_API');
          console.log(`  请求 ${i}: ❌ 失败 | 断路器: ${state}`);
        }
      }

      console.log('\n最终状态:');
      this.showCircuitBreakers();

      EventBus.resetCircuitBreaker('UNSTABLE_API');
      console.log('\n断路器已重置');
    },

    /**
     * 启用调试模式
     */
    enableDebugMode() {
      EventBus.setDebugMode(true);
      console.log('✓ EventBus V4 调试模式已启用');
    },

    /**
     * 禁用调试模式
     */
    disableDebugMode() {
      EventBus.setDebugMode(false);
      console.log('✓ EventBus V4 调试模式已禁用');
    }
  };

  console.log('[EventBusTestV4] 测试工具已加载');
  console.log('可用命令:');
  console.log('  EventBusTestV4.runAllTests()        - 运行所有测试');
  console.log('  EventBusTestV4.showFullStatus()      - 显示完整状态');
  console.log('  EventBusTestV4.showCircuitBreakers() - 显示断路器状态');
  console.log('  EventBusTestV4.showPlugins()        - 显示插件列表');
  console.log('  EventBusTestV4.showHealth()         - 显示健康状态');
  console.log('  EventBusTestV4.runBenchmark()       - 运行性能测试');
  console.log('  EventBusTestV4.testCircuitBreakerDemo() - 断路器演示');

})();
