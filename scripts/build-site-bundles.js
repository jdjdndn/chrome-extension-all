#!/usr/bin/env node
/**
 * 站点脚本打包工具
 * 使用 esbuild 将入口文件打包为自包含 bundle
 * 支持依赖解析、tree shaking、source map
 * 支持增量构建，仅重新构建变化的文件
 *
 * 使用: node scripts/build-site-bundles.js
 * 或:   npm run bundle
 * 监听: npm run watch (自动重建)
 * 清理: npm run clean:cache
 */

const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const root = path.resolve(__dirname, '..')

// 增量构建模块
let incrementalBuild = null
let getStats = null

try {
  const incrementalModule = require('./incremental-build.js')
  incrementalBuild = incrementalModule.incrementalBuild
  getStats = incrementalModule.getStats
} catch (err) {
  console.warn('[Build] 增量构建模块加载失败，使用全量构建')
}

// ========== 打包配置 ==========
const BUNDLES = [
  // 核心模块（manifest 加载）
  {
    name: 'core',
    entry: 'content/entries/core.js',
    outfile: 'dist/content/core-bundle.js',
  },
  // 通用脚本（所有页面）
  {
    name: 'common',
    entry: 'content/entries/common.js',
    outfile: 'dist/content/common-bundle.js',
  },
  // 站点脚本
  {
    name: 'bili',
    entry: 'content/entries/bili.js',
    outfile: 'dist/content/bundled/bili.bundle.js',
  },
  {
    name: 'douyin',
    entry: 'content/entries/douyin.js',
    outfile: 'dist/content/bundled/douyin.bundle.js',
  },
  { name: '4hu', entry: 'content/entries/4hu.js', outfile: 'dist/content/bundled/4hu.bundle.js' },
  {
    name: 'weread',
    entry: 'content/entries/weread.js',
    outfile: 'dist/content/bundled/weread.bundle.js',
  },
  {
    name: 'youtube',
    entry: 'content/entries/youtube.js',
    outfile: 'dist/content/bundled/youtube.bundle.js',
  },
  {
    name: 'modelscope',
    entry: 'content/entries/modelscope.js',
    outfile: 'dist/content/bundled/modelscope.bundle.js',
  },
  {
    name: 'quark',
    entry: 'content/entries/quark.js',
    outfile: 'dist/content/bundled/quark.bundle.js',
  },
  {
    name: 'xiaohongshu',
    entry: 'content/entries/xiaohongshu.js',
    outfile: 'dist/content/bundled/xiaohongshu.bundle.js',
  },
  {
    name: 'aliyun',
    entry: 'content/entries/aliyun.js',
    outfile: 'dist/content/bundled/aliyun.bundle.js',
  },
  {
    name: 'baiduPan',
    entry: 'content/entries/baiduPan.js',
    outfile: 'dist/content/bundled/baiduPan.bundle.js',
  },
  {
    name: 'boss',
    entry: 'content/entries/boss.js',
    outfile: 'dist/content/bundled/boss.bundle.js',
  },
  {
    name: 'dianGong',
    entry: 'content/entries/dianGong.js',
    outfile: 'dist/content/bundled/dianGong.bundle.js',
  },
  {
    name: 'gongkong',
    entry: 'content/entries/gongkong.js',
    outfile: 'dist/content/bundled/gongkong.bundle.js',
  },
  {
    name: 'comic18',
    entry: 'content/entries/comic18.js',
    outfile: 'dist/content/bundled/comic18.bundle.js',
  },
  {
    name: 'github',
    entry: 'content/entries/github.js',
    outfile: 'dist/content/bundled/github.bundle.js',
  },
]

// ========== esbuild 公共配置 ==========
function createBuildOptions(bundle) {
  return {
    entryPoints: [path.join(root, bundle.entry)],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    platform: 'browser',
    treeShaking: true,
    minify: false,
    sourcemap: true,
    outfile: path.join(root, bundle.outfile),
    logLevel: 'info',
    // 忽略 chrome 扩展 API 的导入
    external: [],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  }
}

// ========== 单次构建 ==========
async function buildAll() {
  console.log('\n📦 开始打包...\n')

  // 构建函数
  const buildFn = async (bundle) => {
    await esbuild.build(createBuildOptions(bundle))
  }

  // 尝试使用增量构建
  if (incrementalBuild) {
    const results = await incrementalBuild(BUNDLES, buildFn)

    // 输出详情
    if (results.rebuilt.length > 0) {
      console.log(`\n✓ 已构建: ${results.rebuilt.join(', ')}`)
    }
    if (results.skipped.length > 0) {
      console.log(`○ 已跳过: ${results.skipped.join(', ')}`)
    }
    if (results.errors.length > 0) {
      console.log(`\n✗ 错误:`)
      results.errors.forEach((e) => console.log(`  - ${e.bundle}: ${e.error}`))
    }

    console.log(`\n✅ 打包完成 (${results.duration}ms)`)

    // 显示统计
    if (getStats) {
      const stats = getStats()
      console.log(`   缓存命中率: ${stats.hitRate}`)
    }
  } else {
    // 降级到全量构建
    for (const bundle of BUNDLES) {
      try {
        const startTime = Date.now()
        await esbuild.build(createBuildOptions(bundle))
        const duration = Date.now() - startTime

        const outPath = path.join(root, bundle.outfile)
        const size = fs.existsSync(outPath)
          ? `(${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`
          : ''
        console.log(`✓ ${bundle.name}: ${bundle.outfile} ${size} ${duration}ms`)
      } catch (err) {
        console.error(`✗ ${bundle.name}: ${err.message}`)
      }
    }

    console.log('\n✅ 打包完成')
  }
}

// ========== Watch 模式 ==========
async function watchAll() {
  console.log('\n👀 启动 watch 模式...\n')

  const contexts = []
  for (const bundle of BUNDLES) {
    try {
      const ctx = await esbuild.context(createBuildOptions(bundle))
      await ctx.watch()
      contexts.push(ctx)
      console.log(`👀 监听: ${bundle.entry} → ${bundle.outfile}`)
    } catch (err) {
      console.error(`✗ ${bundle.name}: ${err.message}`)
    }
  }

  console.log(`\n👀 正在监听 ${contexts.length} 个 bundle (Ctrl+C 停止)\n`)

  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n🛑 停止监听...')
    for (const ctx of contexts) {
      await ctx.dispose()
    }
    process.exit(0)
  })
}

module.exports = { buildAll, watchAll }

// 直接运行
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--watch')) {
    watchAll()
  } else {
    buildAll()
  }
}
