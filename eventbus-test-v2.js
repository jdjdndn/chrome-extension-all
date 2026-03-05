/**
 * EventBus V2 测试工具
 */

(function () {
  'use strict';

  window.EventBusTestV2 = {
    /**
     * 运行所有测试
     */
    async runAllTests() {
      console.log('====================');
      console.log('EventBus V2 测试套件');
      console.log('====================\n');

      const results = [];

      // 1. 基础状态检查
      results.push(await this.testBasicState());

      // 2. 订阅功能
      results.push(await this.testSubscribe());

      // 3. 发布功能
      results.push(await this.testPublish());

      // 4. 请求-响应
      results.push(await this.testRequestResponse());

      // 5. Once 订阅
      results.push(await this.testOnce());

      // 6. 消息追踪
      results.push(await this.testTracking());

      // 7. 连接事件
      results.push(await this.testConnectionEvents());

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
        console.log('  实例ID:', state.instanceId);
        console.log('  就绪状态:', state.isReady);
        console.log('  运行时间:', Math.floor(state.uptime / 1000), '秒');

        return { name: '基础状态', passed: true };
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
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

        const unsubscribe = EventBus.subscribe('TEST_SUBSCRIBE', (data) => {
          received = true;
          console.log('  ✓ 收到订阅消息:', data);
        });

        // 发布测试消息
        await EventBus.publish('TEST_SUBSCRIBE', { test: true });

        await new Promise(resolve => setTimeout(resolve, 100));

        unsubscribe();

        if (received) {
          console.log('  ✓ 订阅功能正常');
          return { name: '订阅功能', passed: true };
        } else {
          console.log('  ❌ 未收到订阅消息');
          return { name: '订阅功能', passed: false };
        }
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
        return { name: '订阅功能', passed: false, error: error.message };
      }
    },

    /**
     * 测试发布功能
     */
    async testPublish() {
      console.log('[Test 3] 发布功能...');

      try {
        await EventBus.publish('TEST_PUBLISH', { message: 'Hello World' });
        console.log('  ✓ 发布成功');
        return { name: '发布功能', passed: true };
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
        return { name: '发布功能', passed: false, error: error.message };
      }
    },

    /**
     * 测试请求-响应
     */
    async testRequestResponse() {
      console.log('[Test 4] 请求-响应功能...');

      try {
        // 注册测试处理器
        EventBus.on('TEST_ECHO_V2', (data) => {
          console.log('  收到请求:', data);
          return { success: true, echo: data };
        });

        // 发送请求
        const response = await EventBus.request('TEST_ECHO_V2', { test: 'data' }, { timeout: 3000 });

        if (response && response.success) {
          console.log('  ✓ 收到响应:', response);
          return { name: '请求-响应', passed: true };
        } else {
          console.log('  ❌ 响应无效');
          return { name: '请求-响应', passed: false };
        }
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
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

        EventBus.once('TEST_ONCE', () => {
          count++;
          console.log('  Once 回调被调用, count =', count);
        });

        // 发布两次
        await EventBus.publish('TEST_ONCE', {});
        await new Promise(resolve => setTimeout(resolve, 50));
        await EventBus.publish('TEST_ONCE', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        if (count === 1) {
          console.log('  ✓ Once 订阅只触发一次');
          return { name: 'Once 订阅', passed: true };
        } else {
          console.log('  ❌ Once 订阅触发', count, '次');
          return { name: 'Once 订阅', passed: false };
        }
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
        return { name: 'Once 订阅', passed: false, error: error.message };
      }
    },

    /**
     * 测试消息追踪
     */
    async testTracking() {
      console.log('[Test 6] 消息追踪...');

      try {
        // 清空追踪记录
        EventBus.clear();

        // 发送一些消息
        await EventBus.publish('TEST_TRACKING_1', {});
        await EventBus.publish('TEST_TRACKING_2', {});

        // 获取统计
        const stats = EventBus.getStats();
        console.log('  统计:', stats);

        // 获取历史
        const history = EventBus.getHistory({ limit: 5 });
        console.log('  历史记录数:', history.length);

        if (stats.sent >= 2) {
          console.log('  ✓ 消息追踪正常');
          return { name: '消息追踪', passed: true };
        } else {
          console.log('  ❌ 消息追踪计数不正确');
          return { name: '消息追踪', passed: false };
        }
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
        return { name: '消息追踪', passed: false, error: error.message };
      }
    },

    /**
     * 测试连接事件
     */
    async testConnectionEvents() {
      console.log('[Test 7] 连接事件...');

      try {
        let eventReceived = false;

        const unsubscribe = EventBus.onConnectionChange((id, status) => {
          eventReceived = true;
          console.log('  连接事件:', id, status);
        });

        // 等待一下看是否有连接事件
        await new Promise(resolve => setTimeout(resolve, 500));

        unsubscribe();

        console.log('  连接监听器已注册');
        return { name: '连接事件', passed: true };
      } catch (error) {
        console.error('  ❌ 失败:', error.message);
        return { name: '连接事件', passed: false, error: error.message };
      }
    },

    /**
     * 显示状态面板
     */
    showStatusPanel() {
      const state = EventBus.getState();
      const stats = EventBus.getStats();

      console.log('\n====================');
      console.log('EventBus 状态面板');
      console.log('====================');
      console.log('环境:', state.env);
      console.log('实例ID:', state.instanceId);
      console.log('就绪:', state.isReady);
      console.log('运行时间:', Math.floor(state.uptime / 1000), '秒');
      console.log('消息计数:', state.messageCount);
      console.log('连接数:', state.connections.length);
      console.log('订阅数:', state.subscriptions.length);
      console.log('处理器数:', state.handlers.length);
      console.log('\n统计信息:');
      console.log('  已发送:', stats.sent);
      console.log('  已接收:', stats.received);
      console.log('  失败:', stats.failed);
      console.log('  超时:', stats.timeout);
      console.log('  追踪记录:', stats.trackedMessages);
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
        console.log(`${i + 1}. [${time}] ${msg.type} ${msg.messageType || ''}`);
        if (msg.from) console.log(`   来自: ${msg.from}`);
        if (msg.to) console.log(`   到: ${msg.to}`);
      });

      console.log('====================\n');
    },

    /**
     * 启用调试模式
     */
    enableDebugMode() {
      EventBus.setDebugMode(true);
      console.log('✓ EventBus 调试模式已启用');
    },

    /**
     * 禁用调试模式
     */
    disableDebugMode() {
      EventBus.setDebugMode(false);
      console.log('✓ EventBus 调试模式已禁用');
    }
  };

  console.log('[EventBusTestV2] 测试工具已加载');
  console.log('可用命令:');
  console.log('  EventBusTestV2.runAllTests()      - 运行所有测试');
  console.log('  EventBusTestV2.showStatusPanel()  - 显示状态面板');
  console.log('  EventBusTestV2.showRecentMessages(10) - 显示最近消息');
  console.log('  EventBusTestV2.enableDebugMode()  - 启用调试模式');
  console.log('  EventBusTestV2.disableDebugMode() - 禁用调试模式');

})();
