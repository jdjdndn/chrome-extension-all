/**
 * 增量构建模块
 * 通过文件 hash 和依赖图实现增量构建
 * 仅重新构建变化的文件，跳过未变化的部分
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(root, 'node_modules', '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'build-cache.json')

// ========== 路径工具函数 ==========
// 处理可能是绝对路径的情况（vite.config.js 可能传入绝对路径）
function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
}

// ========== 缓存结构 ==========
const BuildCache = {
  // 文件 hash: filePath → hash
  fileHashes: new Map(),

  // bundle 依赖: bundleName → Set<filePath>
  bundleDependencies: new Map(),

  // bundle 输出 hash: bundleName → hash
  bundleOutputHashes: new Map(),

  // 上次构建时间戳
  lastBuildTime: 0,

  // 统计
  stats: {
    hits: 0,
    misses: 0,
    totalBuilds: 0,
    totalSkips: 0,
  },
}

// ========== 配置 ==========
const CONFIG = {
  // 是否启用增量构建
  enabled: process.env.NODE_ENV === 'development' || process.env.INCREMENTAL_BUILD !== 'false',

  // 缓存过期时间（毫秒）
  cacheTTL: 24 * 60 * 60 * 1000, // 24 小时

  // 最大缓存条目
  maxCacheSize: 1000,

  // 是否强制全量构建
  forceFull: process.env.FULL_BUILD === 'true',

  // 调试模式
  debug: process.env.DEBUG_BUILD === 'true',
}

// ========== Hash 计算 ==========
function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  } catch (err) {
    return null
  }
}

function computeBufferHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

// ========== 缓存持久化 ==========
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return false
    }

    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))

    // 检查缓存是否过期
    if (Date.now() - data.lastBuildTime > CONFIG.cacheTTL) {
      console.log('[Incremental] 缓存已过期，将执行全量构建')
      return false
    }

    // 恢复缓存
    BuildCache.fileHashes = new Map(Object.entries(data.fileHashes || {}))
    BuildCache.bundleDependencies = new Map(
      Object.entries(data.bundleDependencies || {}).map(([k, v]) => [k, new Set(v)])
    )
    BuildCache.bundleOutputHashes = new Map(Object.entries(data.bundleOutputHashes || {}))
    BuildCache.lastBuildTime = data.lastBuildTime || 0
    BuildCache.stats = data.stats || BuildCache.stats

    console.log(
      `[Incremental] 加载缓存: ${BuildCache.fileHashes.size} 个文件, ${BuildCache.bundleDependencies.size} 个 bundle`
    )
    return true
  } catch (err) {
    console.warn('[Incremental] 缓存加载失败:', err.message)
    return false
  }
}

function saveCache() {
  try {
    // 确保缓存目录存在
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }

    const data = {
      fileHashes: Object.fromEntries(BuildCache.fileHashes),
      bundleDependencies: Object.fromEntries(
        Array.from(BuildCache.bundleDependencies.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      bundleOutputHashes: Object.fromEntries(BuildCache.bundleOutputHashes),
      lastBuildTime: Date.now(),
      stats: BuildCache.stats,
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2))
    console.log(`[Incremental] 保存缓存: ${BuildCache.fileHashes.size} 个文件`)
  } catch (err) {
    console.warn('[Incremental] 缓存保存失败:', err.message)
  }
}

function clearCache() {
  BuildCache.fileHashes.clear()
  BuildCache.bundleDependencies.clear()
  BuildCache.bundleOutputHashes.clear()
  BuildCache.lastBuildTime = 0

  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE)
  }
  console.log('[Incremental] 缓存已清除')
}

// ========== 依赖分析 ==========
function analyzeBundleDependencies(entryFile, builtFiles) {
  const dependencies = new Set()

  // 从 esbuild metafile 获取依赖（如果有的话）
  // 这里简化处理：直接使用构建时传入的文件列表
  for (const file of builtFiles) {
    const absolutePath = resolvePath(file)
    if (fs.existsSync(absolutePath)) {
      dependencies.add(absolutePath)
    }
  }

  // 添加入口文件
  const entryPath = resolvePath(entryFile)
  if (fs.existsSync(entryPath)) {
    dependencies.add(entryPath)
  }

  return dependencies
}

// ========== 变化检测 ==========
function detectChangedFiles(files) {
  const changed = []
  const unchanged = []

  for (const file of files) {
    const absolutePath = resolvePath(file)

    if (!fs.existsSync(absolutePath)) {
      continue
    }

    const newHash = computeFileHash(absolutePath)
    const oldHash = BuildCache.fileHashes.get(absolutePath)

    if (!oldHash || newHash !== oldHash) {
      changed.push(absolutePath)
      BuildCache.fileHashes.set(absolutePath, newHash)
    } else {
      unchanged.push(absolutePath)
    }
  }

  return { changed, unchanged }
}

function findAffectedBundles(changedFiles) {
  const affected = new Set()

  for (const [bundleName, dependencies] of BuildCache.bundleDependencies) {
    for (const changedFile of changedFiles) {
      if (dependencies.has(changedFile)) {
        affected.add(bundleName)
        break
      }
    }
  }

  return Array.from(affected)
}

// ========== 增量构建逻辑 ==========
async function incrementalBuild(bundles, buildFn) {
  const results = {
    rebuilt: [],
    skipped: [],
    errors: [],
    duration: 0,
  }

  const startTime = Date.now()

  // 检查是否启用增量构建
  if (!CONFIG.enabled || CONFIG.forceFull) {
    console.log('[Incremental] 执行全量构建')
    return await fullBuild(bundles, buildFn, results)
  }

  // 加载缓存
  const cacheLoaded = loadCache()

  if (!cacheLoaded) {
    console.log('[Incremental] 无有效缓存，执行全量构建')
    return await fullBuild(bundles, buildFn, results)
  }

  // 收集所有源文件
  const allSourceFiles = new Set()

  // 为每个 bundle 收集依赖（首次构建时）
  const needAnalyzeDependencies = new Set()

  for (const bundle of bundles) {
    const entryPath = resolvePath(bundle.entry)
    if (fs.existsSync(entryPath)) {
      allSourceFiles.add(entryPath)

      // 如果 bundle 没有依赖信息，需要重新分析
      if (!BuildCache.bundleDependencies.has(bundle.name)) {
        needAnalyzeDependencies.add(bundle.name)
      }
    }
  }

  // 检测变化的文件
  const { changed, unchanged } = detectChangedFiles(Array.from(allSourceFiles))

  if (CONFIG.debug) {
    console.log(`[Incremental] 变化文件: ${changed.length}, 未变化: ${unchanged.length}`)
  }

  // 如果没有变化，检查输出文件是否存在
  if (changed.length === 0) {
    let allOutputExist = true
    for (const bundle of bundles) {
      const outPath = resolvePath(bundle.outfile)
      if (!fs.existsSync(outPath)) {
        allOutputExist = false
        break
      }
    }

    if (allOutputExist) {
      console.log('[Incremental] 无变化，跳过构建')
      results.skipped = bundles.map((b) => b.name)
      results.duration = Date.now() - startTime
      BuildCache.stats.totalSkips++
      return results
    }
  }

  // 找到受影响的 bundle
  const affectedBundles = findAffectedBundles(changed)

  // 收集输出文件不存在的 bundle
  const missingOutputBundles = new Set()
  for (const bundle of bundles) {
    const outPath = resolvePath(bundle.outfile)
    if (!fs.existsSync(outPath)) {
      missingOutputBundles.add(bundle.name)
    }
  }

  // 如果有输出文件缺失，输出日志
  if (missingOutputBundles.size > 0) {
    console.log(`[Incremental] 输出文件缺失: ${Array.from(missingOutputBundles).join(', ')}`)
  }

  // 如果有变化文件但没有找到受影响的 bundle，可能是新增文件
  // 这种情况下需要重新构建所有相关 bundle
  if (changed.length > 0 && affectedBundles.length === 0) {
    // 简化处理：重新构建所有 bundle
    console.log('[Incremental] 检测到新文件，执行全量构建')
    return await fullBuild(bundles, buildFn, results)
  }

  // 构建受影响的 bundle
  for (const bundle of bundles) {
    // 检查是否需要构建：有变化 或 输出缺失 或 需要分析依赖
    const needsBuild =
      affectedBundles.includes(bundle.name) ||
      needAnalyzeDependencies.has(bundle.name) ||
      missingOutputBundles.has(bundle.name)

    if (needsBuild) {
      try {
        const buildStart = Date.now()
        await buildFn(bundle)
        const buildDuration = Date.now() - buildStart

        results.rebuilt.push(bundle.name)

        // 更新 bundle 依赖
        const entryPath = resolvePath(bundle.entry)
        const dependencies = new Set([entryPath])
        BuildCache.bundleDependencies.set(bundle.name, dependencies)

        // 更新输出 hash
        const outPath = resolvePath(bundle.outfile)
        if (fs.existsSync(outPath)) {
          const outContent = fs.readFileSync(outPath)
          BuildCache.bundleOutputHashes.set(bundle.name, computeBufferHash(outContent))
        }

        if (CONFIG.debug) {
          console.log(`[Incremental] 构建完成: ${bundle.name} (${buildDuration}ms)`)
        }
      } catch (err) {
        results.errors.push({ bundle: bundle.name, error: err.message })
        console.error(`[Incremental] 构建失败: ${bundle.name}`, err.message)
      }
    } else {
      results.skipped.push(bundle.name)
    }
  }

  results.duration = Date.now() - startTime
  BuildCache.stats.totalBuilds++
  BuildCache.stats.hits += results.skipped.length
  BuildCache.stats.misses += results.rebuilt.length

  // 保存缓存
  saveCache()

  console.log(
    `[Incremental] 构建完成: ${results.rebuilt.length} 个重建, ${results.skipped.length} 个跳过 (${results.duration}ms)`
  )

  return results
}

// ========== 全量构建 ==========
async function fullBuild(bundles, buildFn, results) {
  const startTime = Date.now()

  // 清除旧缓存
  BuildCache.fileHashes.clear()
  BuildCache.bundleDependencies.clear()
  BuildCache.bundleOutputHashes.clear()

  for (const bundle of bundles) {
    try {
      const buildStart = Date.now()
      await buildFn(bundle)
      const buildDuration = Date.now() - buildStart

      results.rebuilt.push(bundle.name)

      // 记录文件 hash
      const entryPath = resolvePath(bundle.entry)
      if (fs.existsSync(entryPath)) {
        BuildCache.fileHashes.set(entryPath, computeFileHash(entryPath))
      }

      // 记录依赖
      const dependencies = new Set([entryPath])
      BuildCache.bundleDependencies.set(bundle.name, dependencies)

      // 记录输出 hash
      const outPath = resolvePath(bundle.outfile)
      if (fs.existsSync(outPath)) {
        const outContent = fs.readFileSync(outPath)
        BuildCache.bundleOutputHashes.set(bundle.name, computeBufferHash(outContent))
      }

      if (CONFIG.debug) {
        console.log(`[Incremental] 全量构建: ${bundle.name} (${buildDuration}ms)`)
      }
    } catch (err) {
      results.errors.push({ bundle: bundle.name, error: err.message })
      console.error(`[Incremental] 构建失败: ${bundle.name}`, err.message)
    }
  }

  results.duration = Date.now() - startTime
  BuildCache.stats.totalBuilds++
  BuildCache.stats.misses += results.rebuilt.length

  // 保存缓存
  saveCache()

  console.log(
    `[Incremental] 全量构建完成: ${results.rebuilt.length} 个 bundle (${results.duration}ms)`
  )

  return results
}

// ========== 统计信息 ==========
function getStats() {
  const hitRate =
    BuildCache.stats.totalBuilds > 0
      ? ((BuildCache.stats.hits / (BuildCache.stats.hits + BuildCache.stats.misses)) * 100).toFixed(
          1
        )
      : 0

  return {
    ...BuildCache.stats,
    hitRate: `${hitRate}%`,
    cacheSize: BuildCache.fileHashes.size,
    bundleCount: BuildCache.bundleDependencies.size,
  }
}

// ========== 导出 ==========
module.exports = {
  incrementalBuild,
  clearCache,
  loadCache,
  saveCache,
  getStats,
  computeFileHash,
  BuildCache,
  CONFIG,
}
