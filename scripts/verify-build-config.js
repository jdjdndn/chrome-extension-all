#!/usr/bin/env node
/**
 * 构建配置验证脚本
 * 防止 STATIC_DIRS 遗漏目录导致构建产物与源码不同步
 *
 * 使用: node scripts/verify-build-config.js
 * 集成到 vite.config.js 的 generateBundle 钩子
 */

const { existsSync, statSync, readdirSync } = require('fs')
const { resolve, join } = require('path')

const root = resolve(__dirname, '..')

// 从 vite.config.js 同步配置
const STATIC_DIRS = ['icons', 'devtools', 'shared', 'styles', 'popup']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '_metadata', '.claude'])

// 需要复制到 dist 的目录特征
// 包含 .js, .html, .css 等静态资源的目录
const DIST_DIR_PATTERNS = /\.(js|html|css|json)$/i

// 排除目录（有特殊处理或不需要复制）
const EXCLUDED_DIRS = new Set([
  'content', // 有专门的 buildContentScripts 处理
  'scripts', // 构建脚本，不需要到 dist
  'tests', // 测试文件
  'data', // 数据文件
  'docs', // 文档
  'memory', // 记忆文件
  'output', // 输出文件
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '_metadata',
  '.claude', // Claude 配置目录
  '.vscode', // VS Code 配置目录
])

/**
 * 扫描根目录下所有需要构建的目录
 */
function scanSourceDirs() {
  const dirs = []
  const entries = readdirSync(root, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (EXCLUDED_DIRS.has(entry.name)) {
      continue
    }

    const dirPath = join(root, entry.name)
    const hasStaticFiles = hasTargetFiles(dirPath)

    if (hasStaticFiles) {
      dirs.push(entry.name)
    }
  }

  return dirs
}

/**
 * 递归检查目录是否包含目标文件类型
 */
function hasTargetFiles(dir, depth = 0) {
  if (depth > 3) {
    return false
  } // 限制递归深度

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue
      }
      if (hasTargetFiles(join(dir, entry.name), depth + 1)) {
        return true
      }
    } else if (DIST_DIR_PATTERNS.test(entry.name)) {
      return true
    }
  }

  return false
}

/**
 * 验证配置覆盖完整性
 */
function verifyConfigCoverage() {
  const sourceDirs = scanSourceDirs()
  const staticDirsSet = new Set(STATIC_DIRS)

  const missing = sourceDirs.filter((d) => !staticDirsSet.has(d))
  const extra = [...staticDirsSet].filter((d) => !existsSync(join(root, d)))

  const issues = []

  if (missing.length > 0) {
    issues.push({
      type: 'MISSING_DIR',
      severity: 'ERROR',
      message: `STATIC_DIRS 遗漏目录: ${missing.join(', ')}`,
      hint: '将这些目录添加到 vite.config.js 的 STATIC_DIRS 数组中',
    })
  }

  if (extra.length > 0) {
    issues.push({
      type: 'EXTRA_DIR',
      severity: 'WARN',
      message: `STATIC_DIRS 包含不存在的目录: ${extra.join(', ')}`,
      hint: '从 STATIC_DIRS 中移除这些目录',
    })
  }

  return { sourceDirs, missing, extra, issues }
}

/**
 * 验证产物与源码同步性
 */
function verifyDistSync() {
  const distDir = join(root, 'dist')
  if (!existsSync(distDir)) {
    return { issues: [] }
  }

  const issues = []

  for (const dir of STATIC_DIRS) {
    const srcDir = join(root, dir)
    const distPath = join(distDir, dir)

    if (!existsSync(srcDir)) {
      continue
    }
    if (!existsSync(distPath)) {
      issues.push({
        type: 'MISSING_DIST',
        severity: 'ERROR',
        message: `产物目录缺失: dist/${dir}`,
        hint: '运行 npm run build 重新构建',
      })
      continue
    }

    // 检查关键文件 mtime
    const srcMtime = getLatestMtime(srcDir)
    const distMtime = getLatestMtime(distPath)

    if (srcMtime > distMtime) {
      issues.push({
        type: 'OUTDATED_DIST',
        severity: 'WARN',
        message: `产物目录过期: dist/${dir}（源码更新但产物未同步）`,
        hint: '运行 rm -rf node_modules/.cache/build-cache.json && FULL_BUILD=true npm run build',
      })
    }
  }

  return { issues }
}

/**
 * 获取目录最新 mtime
 */
function getLatestMtime(dir, maxDepth = 2) {
  let latest = 0

  function scan(d, depth) {
    if (depth > maxDepth) {
      return
    }

    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          scan(path, depth + 1)
        }
      } else {
        try {
          const mtime = statSync(path).mtimeMs
          if (mtime > latest) {
            latest = mtime
          }
        } catch {}
      }
    }
  }

  scan(dir, 0)
  return latest
}

/**
 * 主验证函数
 */
function verify() {
  console.log('[BuildConfig] 验证构建配置...')

  const coverage = verifyConfigCoverage()
  const sync = verifyDistSync()

  const allIssues = [...coverage.issues, ...sync.issues]

  // 输出结果
  if (allIssues.length === 0) {
    console.log('[BuildConfig] ✅ 配置验证通过')
    return { success: true, issues: [] }
  }

  // 分类输出
  const errors = allIssues.filter((i) => i.severity === 'ERROR')
  const warns = allIssues.filter((i) => i.severity === 'WARN')

  if (errors.length > 0) {
    console.error('[BuildConfig] ❌ 发现错误:')
    errors.forEach((i) => {
      console.error(`  - ${i.message}`)
      console.error(`    → ${i.hint}`)
    })
  }

  if (warns.length > 0) {
    console.warn('[BuildConfig] ⚠️ 警告:')
    warns.forEach((i) => {
      console.warn(`  - ${i.message}`)
      console.warn(`    → ${i.hint}`)
    })
  }

  // 错误时抛出，中断构建
  if (errors.length > 0) {
    throw new Error(`[BuildConfig] ${errors.length} 项配置错误，构建中止`)
  }

  return { success: true, issues: allIssues }
}

module.exports = { verify, verifyConfigCoverage, verifyDistSync }

// 直接运行
if (require.main === module) {
  try {
    verify()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
