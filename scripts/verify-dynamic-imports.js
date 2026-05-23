/**
 * 构建时校验 dynamic import 路径
 *
 * 扫描指定根目录下的 JS 文件，提取 import(<字面量>) 或 import(chrome.runtime.getURL('<字面量>'))
 * 中的字面量路径，对照 dist 目录验证目标文件是否存在。
 *
 * 仅校验字面量路径（含模板字符串中静态拼接的目录部分）。
 * 完全动态拼接（如 ${url}）的 import 会被标记为 SKIP。
 *
 * 失败时 exit(1)，供 vite generateBundle 钩子调用。
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, relative, dirname, join } from 'path'

const ROOT = resolve('.')
const DIST = resolve(ROOT, 'dist')

const SCAN_ROOTS = ['popup.js', 'newtab.js', 'background.js', 'content.js', 'inject.js']
const SCAN_DIRS = ['popup', 'content', 'shared', 'devtools']

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /[\\/]dist[\\/]/,
  /[\\/]coverage[\\/]/,
  /\.test\.js$/,
  /\.spec\.js$/,
]

function walkJsFiles(target, out = []) {
  const full = resolve(ROOT, target)
  if (!existsSync(full)) {return out}
  const st = statSync(full)
  if (st.isFile()) {
    if (full.endsWith('.js') && !EXCLUDE_PATTERNS.some((p) => p.test(full))) {out.push(full)}
    return out
  }
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const childRel = join(target, entry.name)
    const childFull = resolve(ROOT, childRel)
    if (EXCLUDE_PATTERNS.some((p) => p.test(childFull))) {continue}
    if (entry.isDirectory()) {walkJsFiles(childRel, out)}
    else if (entry.name.endsWith('.js')) {out.push(childFull)}
  }
  return out
}

// 匹配 import(...) 字面量参数
// 形态 1: import('./a.js') / import("./a.js") / import(`./a.js`)
// 形态 2: import(chrome.runtime.getURL('popup/x.js'))
// 形态 3: import(`./a/${name}.js`) - 模板带变量，只校验目录部分
const RE_IMPORT_STRING = /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g
const RE_IMPORT_GETURL = /\bimport\s*\(\s*chrome\.runtime\.getURL\s*\(\s*(['"`])([^'"`]+)\1/g
const RE_IMPORT_TEMPLATE_DIR = /\bimport\s*\(\s*`([^`$]*\/)\$\{[^}]+\}([^`]*)`\s*\)/g

function extractImports(file) {
  const src = readFileSync(file, 'utf-8')
  const found = []

  for (const m of src.matchAll(RE_IMPORT_GETURL)) {
    found.push({ kind: 'getURL', literal: m[2], idx: m.index, scope: 'extension-root' })
  }

  for (const m of src.matchAll(RE_IMPORT_STRING)) {
    // 跳过 chrome.runtime.getURL 内部已被上面捕获的字符串字面量
    const before = src.slice(Math.max(0, m.index - 30), m.index)
    if (/chrome\.runtime\.getURL\s*\(\s*$/.test(before)) {continue}
    found.push({ kind: 'literal', literal: m[2], idx: m.index, scope: 'relative' })
  }

  for (const m of src.matchAll(RE_IMPORT_TEMPLATE_DIR)) {
    found.push({
      kind: 'template-dir',
      literal: m[1],
      suffix: m[2],
      idx: m.index,
      scope: 'relative',
    })
  }

  return found
}

function resolveTarget(file, item) {
  if (item.scope === 'extension-root') {
    return resolve(DIST, item.literal.replace(/^\//, ''))
  }
  // 相对路径：相对 popup.js 等顶层 JS 时，基准是宿主 HTML 目录（即扩展根/dist）
  // 这里采用宽松策略：先相对 JS 文件所在目录解析；再 fallback 到 dist 根
  const fromFileDir = resolve(dirname(file).replace(ROOT, DIST), item.literal)
  if (existsSync(fromFileDir)) {return fromFileDir}
  return resolve(DIST, item.literal.replace(/^\.\/?/, ''))
}

function checkExists(file, item) {
  // 字面量内含 ${...} 占位符：降级为校验"占位符前的目录"存在
  if (item.literal.includes('${')) {
    const before = item.literal.split('${')[0]
    const dirPart = before.endsWith('/') ? before : before.slice(0, before.lastIndexOf('/') + 1)
    if (!dirPart) {return { ok: true, target: '(dynamic, no static prefix — skip)' }}
    const candidates = []
    if (item.scope === 'extension-root') {
      candidates.push(resolve(DIST, dirPart.replace(/^\//, '')))
    } else {
      candidates.push(resolve(dirname(file).replace(ROOT, DIST), dirPart))
      candidates.push(resolve(DIST, dirPart.replace(/^\.\/?/, '')))
    }
    const hit = candidates.find((c) => existsSync(c))
    return { ok: !!hit, target: hit || candidates.join(' OR ') }
  }

  if (item.kind === 'template-dir') {
    const dir = resolve(dirname(file).replace(ROOT, DIST), item.literal)
    const distDir = resolve(DIST, item.literal.replace(/^\.\/?/, ''))
    const exists = existsSync(dir) || existsSync(distDir)
    return {
      ok: exists,
      target: exists ? (existsSync(dir) ? dir : distDir) : `${dir} OR ${distDir}`,
    }
  }
  const target = resolveTarget(file, item)
  return { ok: existsSync(target), target }
}

function main() {
  if (!existsSync(DIST)) {
    console.error('[VerifyDynamicImports] ❌ dist/ 不存在，请先运行构建')
    process.exit(1)
  }

  const allFiles = []
  for (const f of SCAN_ROOTS) {walkJsFiles(f, allFiles)}
  for (const d of SCAN_DIRS) {walkJsFiles(d, allFiles)}

  const problems = []
  const stats = { files: allFiles.length, imports: 0, ok: 0, fail: 0, skip: 0 }

  for (const file of allFiles) {
    const items = extractImports(file)
    if (items.length === 0) {continue}
    for (const item of items) {
      stats.imports++
      // 跳过 http(s) / data / blob
      if (/^(https?:|data:|blob:)/.test(item.literal)) {
        stats.skip++
        continue
      }
      const { ok, target } = checkExists(file, item)
      if (ok) {
        stats.ok++
      } else {
        stats.fail++
        problems.push({
          file: relative(ROOT, file),
          literal: item.literal,
          kind: item.kind,
          target: relative(ROOT, target),
        })
      }
    }
  }

  console.log(
    `[VerifyDynamicImports] 扫描 ${stats.files} 个文件，共 ${stats.imports} 处 dynamic import（OK ${stats.ok} / FAIL ${stats.fail} / SKIP ${stats.skip}）`
  )

  if (problems.length > 0) {
    console.error('[VerifyDynamicImports] ❌ 以下 dynamic import 目标在 dist 中找不到:')
    for (const p of problems) {
      console.error(`  - ${p.file}  →  ${p.literal}  (kind=${p.kind})`)
      console.error(`      期望存在: dist/${p.target.replace(/^dist[\\/]/, '')}`)
    }
    process.exit(1)
  }

  console.log('[VerifyDynamicImports] ✅ 所有 dynamic import 目标均已部署到 dist')
}

main()
