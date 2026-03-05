/**
 * EventBus 测试文件
 * 用于验证 EventBus 通信是否正常工作
 */

console.log('========================================');
console.log('EventBus 测试工具');
console.log('========================================');

/**
 * 测试 1: 检查 EventBus 是否加载
 */
function testEventBusLoaded() {
  console.log('\n[Test 1] 检查 EventBus 加载状态...');
  if (typeof EventBus !== 'undefined') {
    console.log('✅ EventBus 已加载');
    const state = EventBus.getState();
    console.log('   环境:', state.env);
    console.log('   实例ID:', state.instanceId);
    console.log('   就绪状态:', state.isReady);
    return true;
  } else {
    console.log('❌ EventBus 未加载');
    console.log('   请检查 event-bus.js 是否正确引入');
    return false;
  }
}

/**
 * 测试 2: 测试订阅功能
 */
function testSubscribe() {
  console.log('\n[Test 2] 测试订阅功能...');

  const unsubscribe = EventBus.subscribe('TEST_EVENT', (data) => {
    console.log('✅ 收到测试事件:', data);
  });

  console.log('✅ 已订阅 TEST_EVENT 事件');
  return unsubscribe;
}

/**
 * 测试 3: 测试发布功能
 */
async function testPublish() {
  console.log('\n[Test 3] 测试发布功能...');

  await EventBus.publish('TEST_EVENT', { message: 'Hello EventBus!', timestamp: Date.now() });
  console.log('✅ 已发布 TEST_EVENT 事件');
}

/**
 * 测试 4: 测试请求-响应功能
 */
async function testRequestResponse() {
  console.log('\n[Test 4] 测试请求-响应功能...');

  // 注册处理器
  EventBus.on('TEST_ECHO', (data) => {
    console.log('   收到 ECHO 请求:', data);
    return { echo: data.input, timestamp: Date.now() };
  });

  // 发送请求
  try {
    const response = await EventBus.request('TEST_ECHO', { input: 'Hello' }, { timeout: 3000 });
    console.log('✅ 收到响应:', response);
    return true;
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    return false;
  }
}

/**
 * 测试 5: 测试跨组件通信
 */
async function testCrossComponent() {
  console.log('\n[Test 5] 测试跨组件通信...');

  // 广播测试消息
  await EventBus.publish('CROSS_COMPONENT_TEST', {
    from: window.location.href,
    message: '测试跨组件通信'
  });

  console.log('✅ 已发送跨组件测试消息');
  console.log('   请在其他组件的控制台中查看是否收到此消息');
}

/**
 * 测试 6: 检查连接状态
 */
function testConnections() {
  console.log('\n[Test 6] 检查连接状态...');

  const state = EventBus.getState();
  console.log('已连接的组件数量:', state.connections.length);

  if (state.connections.length > 0) {
    console.log('✅ 已连接的组件:');
    for (const [id, conn] of state.connections) {
      console.log(`   - ${id} (${conn.env})`);
    }
  } else {
    console.log('⚠️  暂无其他组件连接');
    console.log('   请在其他组件中打开控制台');
  }

  return state.connections.length;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('\n🚀 开始运行所有测试...\n');

  const results = {
    loaded: false,
    subscribe: false,
    publish: false,
    request: false,
    connections: 0
  };

  // Test 1: 加载状态
  results.loaded = testEventBusLoaded();
  if (!results.loaded) {
    console.log('\n❌ EventBus 未加载，停止测试');
    return;
  }

  // 等待就绪
  if (!EventBus.getState().isReady) {
    console.log('⏳ 等待 EventBus 就绪...');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Test 2: 订阅
  const unsubscribe = testSubscribe();
  results.subscribe = true;

  // 等待一下再发布
  await new Promise(r => setTimeout(r, 500));

  // Test 3: 发布
  await testPublish();
  results.publish = true;

  // 等待一下再测试请求
  await new Promise(r => setTimeout(r, 500));

  // Test 4: 请求-响应
  results.request = await testRequestResponse();

  // Test 5: 跨组件
  await testCrossComponent();

  // Test 6: 连接状态
  results.connections = testConnections();

  // 输出测试结果
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log('EventBus 加载:', results.loaded ? '✅' : '❌');
  console.log('订阅功能:', results.subscribe ? '✅' : '❌');
  console.log('发布功能:', results.publish ? '✅' : '❌');
  console.log('请求响应:', results.request ? '✅' : '❌');
  console.log('连接组件数:', results.connections);
  console.log('========================================\n');

  // 提供快速测试命令
  console.log('📝 快速测试命令:');
  console.log('// 检查状态');
  console.log('EventBus.getState()');
  console.log('');
  console.log('// 发送测试消息');
  console.log('EventBus.publish("TEST", { data: "hello" })');
  console.log('');
  console.log('// 订阅事件');
  console.log('EventBus.subscribe("TEST", (data) => console.log(data))');
  console.log('');
  console.log('// 向 content script 发送请求');
  console.log('EventBus.request("GET_DEFAULT_HIDE_SELECTORS", {})');
  console.log('========================================\n');
}

// 自动运行测试
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runAllTests, 1000);
  });
} else {
  setTimeout(runAllTests, 1000);
}

// 导出测试函数到全局，方便手动调用
window.EventBusTest = {
  runAllTests,
  testEventBusLoaded,
  testSubscribe,
  testPublish,
  testRequestResponse,
  testCrossComponent,
  testConnections
};

console.log('✅ 测试工具已加载，运行 EventBusTest.runAllTests() 开始测试');
