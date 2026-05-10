/**
 * 页面JS密集优化验证脚本
 * 在浏览器控制台运行此脚本验证优化效果
 */

(function () {
  console.log('========== 页面优化验证 ==========')

  // 1. 检查JS密集度
  const scriptCount = document.querySelectorAll('script').length
  const isIntensive = scriptCount > 100
  console.log(`✅ JS脚本数量: ${scriptCount} ${isIntensive ? '(密集)' : '(正常)'}`)

  // 2. 检查扩展初始化状态
  const mainLoaded = window._mainScriptLoaded
  const schedulerLoaded = !!window.LoadScheduler
  console.log(`✅ Main脚本已加载: ${mainLoaded}`)
  console.log(`✅ LoadScheduler已加载: ${schedulerLoaded}`)

  // 3. 检查域名配置
  const hostname = window.location.hostname
  let domainConfig = null
  try {
    domainConfig = window.DomainConfig?.getScriptConfig(hostname)
    console.log(`✅ 当前域名: ${hostname}`)
    console.log(`   - 关键域名: ${domainConfig?.runAtStart?.length > 0 ? '是' : '否'}`)
    console.log(`   - document_start脚本: ${domainConfig?.runAtStart?.length || 0} 个`)
    console.log(`   - 域名脚本: ${domainConfig?.domainScripts?.length || 0} 个`)
  } catch (e) {
    console.warn('⚠️  域名配置未加载')
  }

  // 4. 检查优先级执行策略
  const shouldImmediate = isIntensive || (domainConfig?.runAtStart?.length > 0)
  console.log(`✅ 执行策略: ${shouldImmediate ? 'P0立即执行' : 'P1/P2延迟执行'}`)

  // 5. 检查MutationObserver是否生效（抖音）
  if (hostname.includes('douyin.com')) {
    const hiddenElements = document.querySelectorAll('[style*="display: none"]')
    console.log(`✅ 已隐藏元素: ${hiddenElements.length} 个`)
  }

  // 6. 性能标记检查
  const measures = performance.getEntriesByType('measure')
  if (measures.length > 0) {
    console.log('✅ 性能测量:')
    measures.forEach((m) => {
      console.log(`   - ${m.name}: ${m.duration.toFixed(2)}ms`)
    })
  }

  // 7. LoadScheduler状态
  if (window.LoadScheduler) {
    const stats = window.LoadScheduler.getStats()
    console.log('✅ LoadScheduler状态:')
    console.log(`   - 已加载模块: ${stats.loaded.length} 个`)
    console.log(`   - 空闲队列: ${stats.idleQueueLength} 个`)
    console.log(`   - 是否空闲: ${stats.isIdle}`)
  }

  // 8. 关键建议
  console.log('\n========== 优化建议 ==========')
  if (isIntensive) {
    console.log('✅ 已启用JS密集页面优化策略')
    console.log('   - 跳过延迟加载')
    console.log('   - 立即初始化扩展功能')
  }
  if (hostname.includes('douyin.com')) {
    console.log('✅ 抖音专属优化已启用')
    console.log('   - document_start 注入')
    console.log('   - MutationObserver提前介入')
  }

  // 9. 返回验证结果
  return {
    scriptCount,
    isIntensive,
    mainLoaded,
    schedulerLoaded,
    isCriticalDomain: domainConfig?.runAtStart?.length > 0,
    shouldImmediate,
    timestamp: new Date().toISOString(),
  }
})()
