#!/usr/bin/env node
/**
 * Dataset 选择器一致性检查
 * 检测 dataset.camelCase 与选择器 data-camelCase 不匹配问题
 */

const fs = require('fs')
const path = require('path')

// 扫描目录
const SCAN_DIRS = ['content', 'shared', 'devtools', 'background.js', 'popup.js', 'newtab.js']

// 问题收集
const issues = []

/**
 * 将 camelCase 转为 kebab-case（HTML 属性形式）
 * 例如: lazySrc → lazy-src, _raLazyLoad → -ra-lazy-load
 */
function camelToKebab(str) {
  // 处理前导大写或下划线
  let result = str.replace(/^([A-Z_])/, (match) => {
    if (match === '_') {return '-'}
    return `-${match.toLowerCase()}`
  })
  // 处理中间的大写字母
  result = result.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
  return result
}

/**
 * 从选择器中提取 data 属性名
 */
function extractDataAttributes(selector) {
  const regex = /\[data-([a-zA-Z0-9_-]+)(?:[=~|^$*]?=["'][^"']*["'])?\]/g
  const attrs = []
  let match
  while ((match = regex.exec(selector)) !== null) {
    attrs.push(match[1])
  }
  return attrs
}

/**
 * 检查文件
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relativePath = path.relative(process.cwd(), filePath)

  lines.forEach((line, lineNum) => {
    // 1. 检测 querySelector/querySelectorAll 中的选择器
    const queryMatches = line.matchAll(/querySelector(?:All)?\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)
    for (const match of queryMatches) {
      const selector = match[1]
      const dataAttrs = extractDataAttributes(selector)

      dataAttrs.forEach(attr => {
        // 如果属性名包含大写字母，说明是错误形式
        if (/[A-Z]/.test(attr)) {
          const correct = camelToKebab(attr)
          issues.push({
            file: relativePath,
            line: lineNum + 1,
            type: 'selector-case',
            message: `选择器 [data-${attr}] 应为 [data-${correct}]`,
            suggestion: correct,
            code: line.trim()
          })
        }
      })
    }

    // 2. 检测 closest 中的选择器
    const closestMatches = line.matchAll(/\.closest\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)
    for (const match of closestMatches) {
      const selector = match[1]
      const dataAttrs = extractDataAttributes(selector)

      dataAttrs.forEach(attr => {
        if (/[A-Z]/.test(attr)) {
          const correct = camelToKebab(attr)
          issues.push({
            file: relativePath,
            line: lineNum + 1,
            type: 'selector-case',
            message: `选择器 [data-${attr}] 应为 [data-${correct}]`,
            suggestion: correct,
            code: line.trim()
          })
        }
      })
    }
  })
}

/**
 * 递归扫描目录
 */
function scanDir(dir) {
  const stat = fs.statSync(dir)

  if (stat.isFile()) {
    if (dir.endsWith('.js') || dir.endsWith('.ts')) {
      checkFile(dir)
    }
    return
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // 跳过 node_modules, dist, coverage
      if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) {continue}
      scanDir(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      checkFile(fullPath)
    }
  }
}

// 执行扫描
console.log('🔍 检测 dataset 选择器一致性...\n')

SCAN_DIRS.forEach(target => {
  const fullPath = path.resolve(process.cwd(), target)
  if (fs.existsSync(fullPath)) {
    scanDir(fullPath)
  }
})

// 输出结果
if (issues.length === 0) {
  console.log('✅ 未发现问题\n')
  process.exit(0)
}

console.log(`❌ 发现 ${issues.length} 个问题:\n`)

issues.forEach((issue, index) => {
  console.log(`${index + 1}. ${issue.file}:${issue.line}`)
  console.log(`   ${issue.message}`)
  console.log(`   代码: ${issue.code.slice(0, 80)}${issue.code.length > 80 ? '...' : ''}`)
  console.log()
})

// 分组统计
const byType = issues.reduce((acc, issue) => {
  acc[issue.type] = (acc[issue.type] || 0) + 1
  return acc
}, {})

console.log('问题统计:')
Object.entries(byType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`)
})

process.exit(1)
