/**
 * EventBus V4.6 阶段测试
 * 在浏览器控制台中运行此测试
 */

(function () {
  'use strict';

  const Test = {
    results: [],

    assert(condition, message) {
    this.results.push({
      pass: condition,
      message,
      timestamp: Date.now()
    });
    console.log(condition ? `✅ ${message}` : `❌ ${message}`);
  },

    async runAll() {
    console.log('========== EventBus V4.6 测试 ==========');

    // 测试 1: 检查 EventBus 加载
    this.assert(typeof EventBus !== 'undefined', 'EventBus 已加载');
    this.assert(typeof EventBus.Chrome !== 'undefined', 'Chrome API 存在');

    // 测试 2: 检查版本
    const state = EventBus.getState();
    this.assert(state.version === '4.6.0', `版本正确: ${state.version}`);

    // 测试 3: 检查环境检测
    this.assert(state.env !== undefined, '环境已检测');

    // 测试 4: 测试订阅/发布
    let received = false;
    const unsub = EventBus.subscribe('TEST_EVENT', (data) => {
      received = true;
      this.assert(data.value === 'hello', '订阅数据正确');
    });

    await EventBus.publish('TEST_EVENT', { value: 'hello' });
    await new Promise(r => setTimeout(r, 100));

    this.assert(received, '发布/订阅工作');
    unsub();

    // 测试 5: 测试 request/response
    EventBus.on('TEST_REQUEST', (data) => {
      return { echo: data };
    });

    try {
      const response = await EventBus.request('TEST_REQUEST', { test: true }, { timeout: 2000 });
      this.assert(response?.echo?.test === true, 'Request/Response 工作');
    } catch (e) {
      this.assert(false, `Request/Response 失败: ${e.message}`);
    }

    // 测试 6: 检查 Transport
    this.assert(typeof EventBus.Transport !== 'undefined', 'Transport 已暴露');
    this.assert(typeof EventBus.Transport.send === 'function', 'Transport.send 存在');
    this.assert(typeof EventBus.Transport.broadcast === 'function', 'Transport.broadcast 存在');

    // 测试 7: 检查 Chrome API
    this.assert(typeof EventBus.Chrome.getEnv === 'function', 'Chrome.getEnv 存在');
    this.assert(typeof EventBus.Chrome.isExtensionContext === 'function', 'Chrome.isExtensionContext 存在');

    // 测试 8: 测试断路器
    EventBus.resetCircuitBreaker('TEST_REQUEST');
    this.assert(EventBus.getCircuitBreakerState('TEST_REQUEST') === 'closed', '断路器重置成功');

    // 测试 9: 测试清理
    EventBus.clear();
    const stateAfter = EventBus.getState();
    this.assert(stateAfter.handlers.length === 0, '清理后无处理器');

    console.log('========== 测试完成 ==========');
    console.log(`通过: ${this.results.filter(r => r.pass).length}`);
    console.log(`失败: ${this.results.filter(r => !r.pass).length}`);

    return this.results;
  }
};

  // 暴露测试
  window.EventBusV46Test = Test;

  console.log('测试脚本已加载。运行 EventBusV46Test.runAll() 开始测试。');
})();
