/**
 * CDN URL 验证脚本
 * 验证替换后的 CDN URL 是否能正常加载 JS 库
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')

// CDN 源配置
const CDN_SOURCES = [
  { id: 'bootcdn', name: 'BootCDN', baseUrl: 'https://cdn.bootcdn.net/ajax/libs/' },
  { id: 'staticfile', name: '七牛云', baseUrl: 'https://cdn.staticfile.org/' },
  {
    id: 'bytecdntp',
    name: '字节CDN',
    baseUrl: 'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/',
  },
  { id: 'jsdelivr', name: 'jsDelivr', baseUrl: 'https://cdn.jsdelivr.net/npm/' },
  { id: 'cdnjs', name: 'cdnjs', baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/' },
  { id: 'unpkg', name: 'unpkg', baseUrl: 'https://unpkg.com/' },
]

// 测试库列表 - 为不同 CDN 格式指定不同路径
const TEST_LIBRARIES = [
  {
    name: 'jquery',
    package: 'jquery',
    version: '3.7.1',
    // bootcdn 格式用 jquery.min.js，npm 格式用 dist/jquery.min.js
    bootcdnFile: 'jquery.min.js',
    npmFile: 'dist/jquery.min.js',
  },
  {
    name: 'react',
    package: 'react',
    version: '18.2.0',
    bootcdnFile: 'umd/react.production.min.js',
    npmFile: 'umd/react.production.min.js',
  },
  {
    name: 'vue',
    package: 'vue',
    version: '3.4.21',
    bootcdnFile: 'vue.global.prod.min.js',
    npmFile: 'dist/vue.global.js', // unpkg 上没有压缩版
  },
  {
    name: 'lodash',
    package: 'lodash',
    version: '4.17.21',
    bootcdnFile: 'lodash.min.js',
    npmFile: 'lodash.min.js',
    // 七牛云的包名是 lodash.js
    bootcdnPackage: 'lodash.js',
  },
  {
    name: 'axios',
    package: 'axios',
    version: '1.6.7',
    bootcdnFile: 'axios.min.js',
    npmFile: 'dist/axios.min.js',
  },
  {
    name: 'echarts',
    package: 'echarts',
    version: '5.5.0',
    bootcdnFile: 'echarts.min.js',
    npmFile: 'dist/echarts.min.js',
  },
  {
    name: 'dayjs',
    package: 'dayjs',
    version: '1.11.10',
    bootcdnFile: 'dayjs.min.js',
    npmFile: 'dayjs.min.js',
  },
]

// 结果收集
const results = {
  cdnHealth: {},
  libraryTests: [],
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
}

/**
 * 测试 CDN 源可访问性
 */
async function testCDNHealth(cdn) {
  const start = Date.now()
  try {
    const response = await fetch(cdn.baseUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    const rtt = Date.now() - start
    return {
      id: cdn.id,
      name: cdn.name,
      healthy: response.ok || response.type === 'opaque',
      rtt,
      status: response.status,
    }
  } catch (error) {
    return {
      id: cdn.id,
      name: cdn.name,
      healthy: false,
      rtt: Infinity,
      error: error.message,
    }
  }
}

/**
 * 构建库 URL - 根据不同 CDN 格式使用不同文件路径和包名
 */
function buildLibUrl(cdn, lib) {
  // 根据 CDN 格式选择正确的文件路径
  const file = cdn.id === 'jsdelivr' || cdn.id === 'unpkg' ? lib.npmFile : lib.bootcdnFile

  // 某些 CDN 上的包名可能不同
  const packageName =
    cdn.id === 'jsdelivr' || cdn.id === 'unpkg' ? lib.package : lib.bootcdnPackage || lib.package

  if (cdn.id === 'jsdelivr' || cdn.id === 'unpkg') {
    return `${cdn.baseUrl}${packageName}@${lib.version}/${file}`
  }
  // bootcdn, staticfile, cdnjs 格式
  return `${cdn.baseUrl}${packageName}/${lib.version}/${file}`
}

/**
 * 测试库加载
 */
async function testLibraryLoad(cdn, lib) {
  const url = buildLibUrl(cdn, lib)
  const start = Date.now()

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    const rtt = Date.now() - start
    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type')

    if (!response.ok) {
      return {
        cdn: cdn.name,
        cdnId: cdn.id,
        library: lib.name,
        url,
        success: false,
        status: response.status,
        rtt,
        error: `HTTP ${response.status}`,
      }
    }

    // 检查是否为 JS 文件
    const isJS = contentType?.includes('javascript') || url.endsWith('.js')

    return {
      cdn: cdn.name,
      cdnId: cdn.id,
      library: lib.name,
      url,
      success: true,
      rtt,
      size: contentLength ? parseInt(contentLength) : null,
      contentType,
      isJS,
    }
  } catch (error) {
    return {
      cdn: cdn.name,
      cdnId: cdn.id,
      library: lib.name,
      url,
      success: false,
      rtt: Date.now() - start,
      error: error.message,
    }
  }
}

/**
 * 主验证流程
 */
async function verifyCDNUrls() {
  console.log('='.repeat(60))
  console.log('CDN URL 验证工具')
  console.log('='.repeat(60))
  console.log()

  // 1. 测试 CDN 源健康状态
  console.log('[阶段 1] 测试 CDN 源可访问性...')
  console.log('-'.repeat(60))

  for (const cdn of CDN_SOURCES) {
    const result = await testCDNHealth(cdn)
    results.cdnHealth[cdn.id] = result
    const status = result.healthy ? '✅' : '❌'
    const rtt = result.rtt === Infinity ? '超时' : `${result.rtt}ms`
    console.log(`  ${status} ${cdn.name.padEnd(12)} | RTT: ${rtt}`)
  }

  console.log()

  // 2. 测试库加载
  console.log('[阶段 2] 测试库文件加载...')
  console.log('-'.repeat(60))

  const healthyCDNs = Object.values(results.cdnHealth)
    .filter((c) => c.healthy)
    .map((c) => CDN_SOURCES.find((s) => s.id === c.id))

  if (healthyCDNs.length === 0) {
    console.error('❌ 没有可用的 CDN 源')
    return false
  }

  for (const lib of TEST_LIBRARIES) {
    console.log(`\n📦 测试 ${lib.name}@${lib.version}:`)

    for (const cdn of healthyCDNs) {
      const result = await testLibraryLoad(cdn, lib)
      results.libraryTests.push(result)

      const status = result.success ? '✅' : '❌'
      const size = result.size ? `${(result.size / 1024).toFixed(1)}KB` : 'N/A'
      const rtt = `${result.rtt}ms`

      if (result.success) {
        console.log(`  ${status} ${cdn.name.padEnd(12)} | ${size.padEnd(8)} | ${rtt}`)
      } else {
        console.log(`  ${status} ${cdn.name.padEnd(12)} | 错误: ${result.error}`)
      }

      // 统计
      results.summary.total++
      if (result.success) {
        results.summary.passed++
      } else {
        results.summary.failed++
      }

      // 节流：避免请求过快
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log('验证结果汇总')
  console.log('='.repeat(60))
  console.log(`  总计测试: ${results.summary.total}`)
  console.log(`  ✅ 成功: ${results.summary.passed}`)
  console.log(`  ❌ 失败: ${results.summary.failed}`)
  console.log()

  // 3. 生成报告
  const reportPath = resolve(ROOT, 'scripts/cdn-verify-report.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`📄 详细报告: ${reportPath}`)

  // 4. 输出推荐 CDN
  console.log()
  console.log('推荐 CDN 优先级:')
  const cdnPerformance = {}
  for (const test of results.libraryTests.filter((t) => t.success)) {
    if (!cdnPerformance[test.cdnId]) {
      cdnPerformance[test.cdnId] = { total: 0, rttSum: 0 }
    }
    cdnPerformance[test.cdnId].total++
    cdnPerformance[test.cdnId].rttSum += test.rtt
  }

  const ranked = Object.entries(cdnPerformance)
    .map(([id, data]) => ({
      id,
      name: CDN_SOURCES.find((c) => c.id === id)?.name || id,
      avgRtt: Math.round(data.rttSum / data.total),
      successRate: data.total / TEST_LIBRARIES.length,
    }))
    .sort((a, b) => a.avgRtt - b.avgRtt)

  ranked.forEach((c, i) => {
    console.log(
      `  ${i + 1}. ${c.name} | 平均 RTT: ${c.avgRtt}ms | 成功率: ${(c.successRate * 100).toFixed(0)}%`
    )
  })

  return results.summary.failed === 0
}

// 执行验证
verifyCDNUrls()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('验证失败:', error)
    process.exit(1)
  })
