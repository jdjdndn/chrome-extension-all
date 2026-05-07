import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, copyFileSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { build as esbuildBuild } from 'esbuild'

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

// ========== File sync config (from watch-and-sync.js) ==========
const STATIC_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'inject.js',
  'popup.html',
  'popup.js',
  'newtab.html',
  'newtab.js',
  'styles.css',
  'rules.json',
  'welcome.html',
  'event-bus-v4.6.js',
  'eventbus-test.js',
]

const FILE_MAPPINGS = [
  { src: 'eventbus-devtools.html', dest: 'devtools/eventbus-devtools.html' },
  { src: 'eventbus-devtools.js', dest: 'devtools/eventbus-devtools.js' },
]

const STATIC_DIRS = ['icons', 'devtools', 'shared', 'src']
const SKIP_CONTENT_DIRS = ['entries', 'utils']

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
    },

    async generateBundle() {
      const dist = resolve('dist')
      copyAllToDist(dist)
      await buildContentScripts(dist)
    },

    writeBundle() {
      // Remove the dummy output file
      const dummy = resolve('dist/dummy.js')
      if (existsSync(dummy)) unlinkSync(dummy)
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
