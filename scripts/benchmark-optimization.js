/**
 * 性能基准测试脚本
 * 对比优化前后的加载时间
 */

;(function () {
  console.log('========== 性能基准测试 ==========\n')

  // 测试函数：模拟JS密集页面
  function simulateJSIntensivePage() {
    console.log('📊 模拟JS密集页面（192个脚本）...')

    // 记录开始时间
    const startTime = performance.now()

    // 模拟脚本加载
    const scripts = []
    for (let i = 0; i < 192; i++) {
      scripts.push({
        src: `script-${i}.js`,
        loadTime: Math.random() * 50,
      })
    }

    // 计算总时间
    const totalTime = scripts.reduce((sum, s) => sum + s.loadTime, 0)
    const endTime = performance.now()

    console.log(`   脚本数量: ${scripts.length}`)
    console.log(`   模拟加载时间: ${totalTime.toFixed(2)}ms`)
    console.log(`   实际耗时: ${(endTime - startTime).toFixed(2)}ms\n`)

    return { scriptCount: scripts.length, totalTime, actualTime: endTime - startTime }
  }

  // 测试优化策略执行时间
  function testOptimizationStrategies() {
    console.log('📊 测试优化策略执行时间...\n')

    const tests = [
      {
        name: 'P0立即执行',
        test: () => {
          const scriptCount = document.querySelectorAll('script').length
          return scriptCount > 100
        },
      },
      {
        name: 'MutationObserver介入',
        test: () => {
          const observer = new MutationObserver(() => {})
          observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
          })
          const time = performance.now()
          observer.disconnect()
          return performance.now() - time
        },
      },
      {
        name: '域名配置检查',
        test: () => {
          const hostname = window.location.hostname
          return window.DomainConfig?.getScriptConfig(hostname)
        },
      },
    ]

    const results = []
    tests.forEach(({ name, test }) => {
      const start = performance.now()
      const result = test()
      const duration = performance.now() - start
      console.log(`   ${name}: ${duration.toFixed(2)}ms`)
      results.push({ name, duration, result })
    })

    console.log('')
    return results
  }

  // 测试空闲检测
  function testIdleDetection() {
    console.log('📊 测试空闲检测机制...\n')

    // 测试 requestIdleCallback
    if (typeof requestIdleCallback !== 'undefined') {
      console.log('   ✅ requestIdleCallback 可用')

      const start = performance.now()
      requestIdleCallback((deadline) => {
        const duration = performance.now() - start
        console.log(`   空闲回调触发时间: ${duration.toFixed(2)}ms`)
        console.log(`   剩余时间: ${deadline.timeRemaining().toFixed(2)}ms\n`)
      })
    } else {
      console.log('   ⚠️  requestIdleCallback 不可用，使用降级方案\n')
    }

    // 测试 scheduler.postTask
    if (typeof scheduler !== 'undefined' && scheduler.postTask) {
      console.log('   ✅ scheduler.postTask 可用')

      const start = performance.now()
      scheduler
        .postTask(() => {
          const duration = performance.now() - start
          console.log(`   postTask触发时间: ${duration.toFixed(2)}ms\n`)
        })
        .catch(() => {
          console.log('   ⚠️  postTask失败，使用降级\n')
        })
    } else {
      console.log('   ⚠️  scheduler.postTask 不可用\n')
    }
  }

  // 执行所有测试
  const jsTest = simulateJSIntensivePage()
  const strategyTests = testOptimizationStrategies()
  testIdleDetection()

  // 汇总结果
  console.log('========== 测试结果汇总 ==========\n')
  console.log('JS密集页面模拟:', jsTest)
  console.log('\n策略测试结果:')
  strategyTests.forEach(({ name, duration }) => {
    console.log(`  ${name}: ${duration.toFixed(2)}ms`)
  })

  console.log('\n========== 测试完成 ==========')

  return {
    jsTest,
    strategyTests,
    timestamp: new Date().toISOString(),
  }
})()
