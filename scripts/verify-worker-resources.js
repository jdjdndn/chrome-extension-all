/**
 * 构建时验证 Worker 资源声明
 * 检查所有 Worker 文件是否在 manifest.json 的 web_accessible_resources 中声明
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, relative } from 'path'

const ROOT = resolve('.')

function findWorkerFiles(dir) {
  const workers = []
  if (!existsSync(dir)) {
    return workers
  }

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      workers.push(...findWorkerFiles(fullPath))
    } else if (entry.name.endsWith('.worker.js') || entry.name.endsWith('.worker.ts')) {
      workers.push(relative(ROOT, fullPath).replace(/\\/g, '/'))
    }
  }
  return workers
}

function verifyWorkerResources() {
  console.log('[WorkerVerify] 检查 Worker 资源声明...')

  // 1. 查找所有 Worker 文件
  const workerFiles = [
    ...findWorkerFiles(resolve(ROOT, 'content/workers')),
    ...findWorkerFiles(resolve(ROOT, 'src/workers')),
  ]

  console.log(`[WorkerVerify] 发现 ${workerFiles.length} 个 Worker 文件:`)
  workerFiles.forEach((f) => console.log(`  - ${f}`))

  if (workerFiles.length === 0) {
    console.log('[WorkerVerify] ✅ 未发现 Worker 文件，跳过验证')
    return true
  }

  // 2. 读取 manifest.json
  const manifestPath = resolve(ROOT, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.warn('[WorkerVerify] ⚠️ manifest.json 不存在')
    return false
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const war = manifest.web_accessible_resources || []

  // 3. 提取已声明的资源模式
  const declaredPatterns = []
  for (const item of war) {
    if (item.resources) {
      declaredPatterns.push(...item.resources)
    }
  }

  console.log('[WorkerVerify] 已声明的资源模式:')
  declaredPatterns.forEach((p) => console.log(`  - ${p}`))

  // 4. 验证每个 Worker 文件是否匹配声明
  const errors = []
  for (const workerFile of workerFiles) {
    const isDeclared = declaredPatterns.some((pattern) => {
      // 处理通配符模式
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        return regex.test(workerFile)
      }
      return pattern === workerFile
    })

    if (!isDeclared) {
      errors.push(workerFile)
    }
  }

  // 5. 输出结果
  if (errors.length > 0) {
    console.error('[WorkerVerify] ❌ 以下 Worker 文件未在 web_accessible_resources 中声明:')
    errors.forEach((f) => console.error(`  - ${f}`))
    console.error('[WorkerVerify] 请在 manifest.json 中添加相应的资源声明')
    return false
  }

  console.log('[WorkerVerify] ✅ 所有 Worker 文件已正确声明')
  return true
}

// 执行验证
const success = verifyWorkerResources()
process.exit(success ? 0 : 1)
