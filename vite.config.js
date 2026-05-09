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

// ========== Content script bundles (from build-site-bundles.js) ==========
const CONTENT_BUNDLES = [
  { name: 'core', entry: 'content/entries/core.js', outfile: 'content/core-bundle.js' },
  { name: 'common', entry: 'content/entries/common.js', outfile: 'content/common-bundle.js' },
  { name: 'bili', entry: 'content/entries/bili.js', outfile: 'content/bundled/bili.bundle.js' },
  {
    name: 'douyin',
    entry: 'content/entries/douyin.js',
    outfile: 'content/bundled/douyin.bundle.js',
  },
  { name: '4hu', entry: 'content/entries/4hu.js', outfile: 'content/bundled/4hu.bundle.js' },
  {
    name: 'weread',
    entry: 'content/entries/weread.js',
    outfile: 'content/bundled/weread.bundle.js',
  },
  {
    name: 'youtube',
    entry: 'content/entries/youtube.js',
    outfile: 'content/bundled/youtube.bundle.js',
  },
  {
    name: 'modelscope',
    entry: 'content/entries/modelscope.js',
    outfile: 'content/bundled/modelscope.bundle.js',
  },
  { name: 'quark', entry: 'content/entries/quark.js', outfile: 'content/bundled/quark.bundle.js' },
  {
    name: 'xiaohongshu',
    entry: 'content/entries/xiaohongshu.js',
    outfile: 'content/bundled/xiaohongshu.bundle.js',
  },
  {
    name: 'aliyun',
    entry: 'content/entries/aliyun.js',
    outfile: 'content/bundled/aliyun.bundle.js',
  },
  {
    name: 'baiduPan',
    entry: 'content/entries/baiduPan.js',
    outfile: 'content/bundled/baiduPan.bundle.js',
  },
  { name: 'boss', entry: 'content/entries/boss.js', outfile: 'content/bundled/boss.bundle.js' },
  {
    name: 'dianGong',
    entry: 'content/entries/dianGong.js',
    outfile: 'content/bundled/dianGong.bundle.js',
  },
  {
    name: 'gongkong',
    entry: 'content/entries/gongkong.js',
    outfile: 'content/bundled/gongkong.bundle.js',
  },
  {
    name: 'comic18',
    entry: 'content/entries/comic18.js',
    outfile: 'content/bundled/comic18.bundle.js',
  },
  {
    name: 'github',
    entry: 'content/entries/github.js',
    outfile: 'content/bundled/github.bundle.js',
  },
]

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

const STATIC_DIRS = ['icons', 'devtools', 'shared', 'src']
const SKIP_CONTENT_DIRS = ['entries', 'utils']

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
function copyDir(src, dest, skipDirs = []) {
  if (!existsSync(src)) return
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.includes(entry.name)) continue
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, skipDirs)
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

function copyAllToDist(dist) {
  mkdirSync(dist, { recursive: true })

  for (const f of STATIC_FILES) {
    if (existsSync(f)) copyFileSync(resolve(f), resolve(dist, f))
  }
  for (const m of FILE_MAPPINGS) {
    if (existsSync(m.src)) {
      const dest = resolve(dist, m.dest)
      mkdirSync(resolve(dest, '..'), { recursive: true })
      copyFileSync(resolve(m.src), dest)
    }
  }
  for (const d of STATIC_DIRS) {
    if (existsSync(d)) copyDir(resolve(d), resolve(dist, d))
  }
  if (existsSync('content')) {
    copyDir(resolve('content'), resolve(dist, 'content'), SKIP_CONTENT_DIRS)
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
      sourcemap: true,
      minify: false,
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
      // watch 模式下重新扫描静态文件
      STATIC_FILES = scanStaticFiles()

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
      copyAllToDist(dist)
      await buildContentScripts(dist)

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

    async closeBundle() {
      // 构建完成后通知热重载服务器
      if (ENV_CONFIG.HOT_RELOAD) {
        await notifyHotReloadServer()
      }
    },
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome100',
    minify: false,
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
