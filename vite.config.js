import { defineConfig } from 'vite'
import { resolve } from 'path'
import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from 'fs'
import { build as esbuildBuild } from 'esbuild'
import { execSync } from 'child_process'

// 配置生成器 - 从 build-config.json 自动生成 manifest 和 domain-config
import { loadConfig, generateBuildBundles } from './scripts/generate-config.js'

// ========== Build Assertions ==========
// 声明"源码改了什么必须出现在哪个产物里"，构建末尾自动校验
// 失败即构建退出非 0，杜绝"改了源码但 dist 未更新"的静默失败
// 用法：在 BUILD_ASSERTIONS 中追加 { src, needle, dist } 即可
const BUILD_ASSERTIONS = [
  // bili 站点核心
  { src: 'content/bili.js', needle: 'biliSite.init()', dist: 'content/bundled/bili.bundle.js' },
  {
    src: 'content/core/site-base.js',
    needle: 'state.initialized',
    dist: 'content/bundled/bili.bundle.js',
  },
  {
    src: 'content/core/script-loader.js',
    needle: 'Promise.reject',
    dist: 'content/core-t2-bundle.js',
  },
]

// esbuild 默认把非 ASCII 字符转 \uXXXX，grep 字面会假阴性，需双形式比对
function toUnicodeEscape(s) {
  let out = ''
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    out += cp < 128 ? ch : '\\u' + cp.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

function runBuildAssertions(distRoot) {
  const failures = []
  for (const { src, needle, dist } of BUILD_ASSERTIONS) {
    const srcPath = resolve(src)
    const distPath = resolve(distRoot, dist)
    if (!existsSync(srcPath)) {
      failures.push(`源码缺失: ${src}`)
      continue
    }
    if (!existsSync(distPath)) {
      failures.push(`产物缺失: ${dist}（src=${src}）`)
      continue
    }
    const srcMtime = require('fs').statSync(srcPath).mtimeMs
    const distMtime = require('fs').statSync(distPath).mtimeMs
    if (srcMtime > distMtime) {
      failures.push(
        `mtime 失效: ${dist} 旧于 ${src}（缓存吞改动；rm node_modules/.cache/build-cache.json && FULL_BUILD=true npm run build）`
      )
      continue
    }
    const content = readFileSync(distPath, 'utf-8')
    const literal = content.includes(needle)
    const escaped = !literal && content.includes(toUnicodeEscape(needle))
    if (!literal && !escaped) {
      failures.push(`grep 未命中: "${needle}" 应在 ${dist}（src=${src}）`)
    }
  }
  if (failures.length > 0) {
    console.error('[BuildAssert] ❌ 验证失败:')
    for (const f of failures) console.error('  - ' + f)
    throw new Error(`[BuildAssert] ${failures.length} 项断言失败，构建中止`)
  }
  console.log(`[BuildAssert] ✅ ${BUILD_ASSERTIONS.length} 项断言全部通过`)
}

// ========== Environment Variables Auto-Injection ==========
// 支持从命令行参数或环境变量注入配置
// 用法: HOT_RELOAD=true npm run build
// 或者在 .env 文件中设置: HOT_RELOAD=true

const ENV_CONFIG = {
  // 热重载开关（开发模式自动启用）
  HOT_RELOAD: process.env.HOT_RELOAD === 'true' || process.env.NODE_ENV === 'development',

  // 其他可配置项
  DEBUG: process.env.DEBUG === 'true',
  ANALYZE: process.env.ANALYZE === 'true',
}

console.log('[Build] Environment config:', ENV_CONFIG)

// ========== Content script bundles (从 build-config.json 自动生成) ==========
// 新增脚本只需修改 scripts/build-config.json，无需手动维护此数组
let CONTENT_BUNDLES = []
try {
  const buildConfig = loadConfig()
  CONTENT_BUNDLES = generateBuildBundles(buildConfig)
  console.log(`[Build] 从 build-config.json 加载 ${CONTENT_BUNDLES.length} 个 bundle 配置`)
} catch (err) {
  console.error('[Build] 加载 build-config.json 失败:', err.message)
  // 降级为空数组，构建时会报错
  CONTENT_BUNDLES = []
}

// ========== File sync config (自动扫描) ==========

// 需要排除的根目录文件（配置文件、测试文件等）
const EXCLUDED_FILES = new Set([
  'vite.config.js',
  'vitest.config.js',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'jsconfig.json',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.gitignore',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  '.env',
  '.env.example',
  '.editorconfig',
  '.mcp.json',
  'sw.js', // Service Worker 单独处理
])

// 自动扫描根目录的静态文件
function scanStaticFiles() {
  const extensions = ['.js', '.html', '.css', '.json']
  const files = []

  const entries = readdirSync('.', { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) continue
    if (EXCLUDED_FILES.has(entry.name)) continue

    const ext = entry.name.substring(entry.name.lastIndexOf('.'))
    if (extensions.includes(ext)) {
      files.push(entry.name)
    }
  }

  console.log('[Build] 自动扫描到静态文件:', files.length, '个')
  return files
}

// 初始扫描（用于首次构建）
let STATIC_FILES = scanStaticFiles()

const FILE_MAPPINGS = [
  { src: 'eventbus-devtools.html', dest: 'devtools/eventbus-devtools.html' },
  { src: 'eventbus-devtools.js', dest: 'devtools/eventbus-devtools.js' },
]

const STATIC_DIRS = ['icons', 'devtools', 'shared', 'styles', 'popup']
const SKIP_CONTENT_DIRS = ['entries', 'utils']
// content 目录下的旧 bundle 产物，不应复制到 dist（由 esbuild 构建覆盖）
const SKIP_CONTENT_FILES = [/\.bundle\.js$/, /-bundle\.js$/]

// ========== Hot Reload Notification ==========
async function notifyHotReloadServer() {
  const HOT_RELOAD_URL = process.env.HOT_RELOAD_URL || 'http://localhost:8765'
  try {
    await fetch(`${HOT_RELOAD_URL}/reload`, { method: 'POST' })
    console.log('[HotReload] 已通知热重载服务器')
  } catch (err) {
    // 服务器可能未启动，静默失败
  }
}

// ========== Helpers ==========
function copyDir(src, dest, skipDirs = [], skipFiles = []) {
  if (!existsSync(src)) return
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.includes(entry.name)) continue
    if (!entry.isDirectory() && skipFiles.some((pat) => pat.test(entry.name))) continue
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, skipDirs, skipFiles)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function addWatchFilesRecursive(dir, ctx) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      addWatchFilesRecursive(fullPath, ctx)
    } else {
      ctx.addWatchFile(fullPath)
    }
  }
}

async function minifyJsFile(src, dest) {
  await esbuildBuild({
    entryPoints: [src],
    bundle: false,
    format: 'iife',
    outfile: dest,
    target: ['chrome100'],
    sourcemap: false,
    minify: true,
  })
}

async function copyAllToDist(dist) {
  mkdirSync(dist, { recursive: true })

  for (const f of STATIC_FILES) {
    if (!existsSync(f)) continue
    const dest = resolve(dist, f)
    if (f.endsWith('.js')) {
      await minifyJsFile(resolve(f), dest)
    } else {
      copyFileSync(resolve(f), dest)
    }
  }
  for (const m of FILE_MAPPINGS) {
    if (existsSync(m.src)) {
      const dest = resolve(dist, m.dest)
      mkdirSync(resolve(dest, '..'), { recursive: true })
      if (m.src.endsWith('.js')) {
        await minifyJsFile(resolve(m.src), dest)
      } else {
        copyFileSync(resolve(m.src), dest)
      }
    }
  }
  for (const d of STATIC_DIRS) {
    if (existsSync(d)) copyDir(resolve(d), resolve(dist, d))
  }
  if (existsSync('content')) {
    copyDir(resolve('content'), resolve(dist, 'content'), SKIP_CONTENT_DIRS, SKIP_CONTENT_FILES)
  }
}

async function buildContentScripts(dist) {
  for (const bundle of CONTENT_BUNDLES) {
    const entry = resolve(bundle.entry)
    if (!existsSync(entry)) continue

    const outfile = resolve(dist, bundle.outfile)
    mkdirSync(resolve(outfile, '..'), { recursive: true })

    await esbuildBuild({
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      outfile,
      target: ['chrome100'],
      sourcemap: false,
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
    })
  }
}

// ========== Vite Plugin ==========
const DUMMY_ID = '\0chrome-ext-dummy'

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',

    // Provide a virtual module as entry so Vite doesn't process real files
    resolveId(id) {
      if (id === DUMMY_ID) return DUMMY_ID
    },
    load(id) {
      if (id === DUMMY_ID) return '// chrome extension build dummy'
    },

    buildStart() {
      // 从 build-config.json 生成配置（确保 manifest.json 和 domain-config.js 同步）
      try {
        execSync('node scripts/generate-config.js', { stdio: 'inherit' })
      } catch {
        console.warn('[Build] 配置生成失败，请检查 scripts/build-config.json')
      }

      // watch 模式下重新扫描静态文件
      STATIC_FILES = scanStaticFiles()

      // 关键：添加要监听的所有源文件，让 Vite watch 保持运行
      const watchPatterns = [
        'content/**/*.js',
        'content/**/*.ts',
        'popup/**/*.js',
        'popup/**/*.html',
        'styles/**/*.css',
        'shared/**/*.js',
        '*.html',
        '*.js',
        'manifest.json',
      ]

      for (const pattern of watchPatterns) {
        const fullPattern = resolve(pattern)
        // 使用 glob 匹配或简单模式
        this.addWatchFile(fullPattern)
      }

      for (const f of STATIC_FILES) {
        if (existsSync(f)) this.addWatchFile(resolve(f))
      }
      for (const m of FILE_MAPPINGS) {
        if (existsSync(m.src)) this.addWatchFile(resolve(m.src))
      }
      for (const d of STATIC_DIRS) {
        addWatchFilesRecursive(d, this)
      }
      addWatchFilesRecursive('content', this)

      // 监视根目录本身，以便检测新增的静态文件
      this.addWatchFile(resolve('.'))

      // 验证 Worker 资源声明
      try {
        execSync('node scripts/verify-worker-resources.js', { stdio: 'inherit' })
      } catch {
        console.warn('[Build] Worker 资源验证失败，请检查 manifest.json')
      }
    },

    async generateBundle() {
      const dist = resolve('dist')
      await copyAllToDist(dist)
      await buildContentScripts(dist)

      // 校验构建配置完整性
      try {
        execSync('node scripts/verify-build-config.js', { stdio: 'inherit' })
      } catch {
        throw new Error('[Build] 构建配置校验失败，构建中止')
      }

      // 校验所有 dynamic import 目标已部署到 dist
      try {
        execSync('node scripts/verify-dynamic-imports.js', { stdio: 'inherit' })
      } catch {
        throw new Error('[Build] dynamic import 校验失败，构建中止')
      }

      // 热重载支持（根据环境变量自动注入）
      if (ENV_CONFIG.HOT_RELOAD) {
        const manifestPath = resolve(dist, 'manifest.json')
        if (existsSync(manifestPath)) {
          const manifestContent = readFileSync(manifestPath, 'utf-8')
          const manifest = JSON.parse(manifestContent)

          // 为content_scripts添加热重载客户端
          if (manifest.content_scripts) {
            manifest.content_scripts = manifest.content_scripts.map((cs) => ({
              ...cs,
              js: ['content/hot-reload-client.js', ...(cs.js || [])],
            }))
          }

          // 复制热重载后台脚本到dist
          const hotReloadBg = resolve('hot-reload-background.js')
          if (existsSync(hotReloadBg)) {
            copyFileSync(hotReloadBg, resolve(dist, 'hot-reload-background.js'))
          }

          // 复制热重载客户端到dist，并注入开发环境标记
          const hotReloadClient = resolve('content/hot-reload-client.js')
          const distClientDir = resolve(dist, 'content')
          if (!existsSync(distClientDir)) {
            mkdirSync(distClientDir, { recursive: true })
          }
          if (existsSync(hotReloadClient)) {
            // 读取源文件
            let clientCode = readFileSync(hotReloadClient, 'utf-8')
            // 注入开发环境标记
            clientCode = 'const __HOT_RELOAD__ = true;\n' + clientCode
            // 写入到 dist
            writeFileSync(resolve(distClientDir, 'hot-reload-client.js'), clientCode)
          }

          // 写回manifest
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
          console.log('[HotReload] manifest.json已更新，添加热重载支持')
        }
      }
    },

    writeBundle() {
      // Remove the dummy output file
      const dummy = resolve('dist/dummy.js')
      if (existsSync(dummy)) unlinkSync(dummy)
    },

    closeBundle() {
      // Build Assertions：产物必含关键源码字符串 + mtime 新于源码
      // 失败即抛错让 vite build 退出非 0
      try {
        runBuildAssertions(resolve('dist'))
      } catch (err) {
        console.error(err.message)
        throw err
      }

      // 构建完成后通知热重载服务器（非阻塞，不影响 Vite watch 模式）
      if (ENV_CONFIG.HOT_RELOAD) {
        notifyHotReloadServer().catch(() => {})
      }
    },
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome100',
    minify: true,
    sourcemap: false,
    rollupOptions: {
      input: { dummy: DUMMY_ID },
      output: {
        entryFileNames: 'dummy.js',
      },
    },
  },
  plugins: [chromeExtensionPlugin()],
})
