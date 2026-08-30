#!/usr/bin/env node
/**
 * 配置生成器
 * 从 scripts/build-config.json 自动生成:
 * 1. content/domain-config.js 的 DOMAIN_SCRIPTS 数组
 * 2. manifest.json 的 web_accessible_resources
 *
 * 使用: node scripts/generate-config.js
 * 集成: 构建时自动执行，或手动运行
 */

const { readFileSync, writeFileSync, existsSync } = require('fs')
const { resolve, join } = require('path')

const root = resolve(__dirname, '..')
const CONFIG_PATH = join(__dirname, 'build-config.json')

// ========== 读取配置 ==========
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`配置文件不存在: ${CONFIG_PATH}`)
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

// ========== 生成 domain-config.js ==========
function generateDomainConfigContent(config) {
  const siteBundles = config.siteBundles || []

  // 生成 DOMAIN_SCRIPTS 数组内容
  const domainScriptsEntries = siteBundles.map((site) => {
    const patterns = site.domains.map((d) => `      '${d}'`).join(',\n')
    const scripts = `        '${site.outfile}'`
    let entry = `    {\n      patterns: [\n${patterns}\n      ],\n      scripts: [\n${scripts}\n      ]`
    if (site.runAt) {
      entry += `,\n      runAt: '${site.runAt}'`
    }
    entry += '\n    }'
    return entry
  })

  const domainScripts = `  const DOMAIN_SCRIPTS = [\n${domainScriptsEntries.join(',\n')}\n  ]`

  // 构建完整的 domain-config.js
  return `/**
 * 域名脚本配置
 * 统一管理所有域名的脚本加载配置
 *
 * 由 scripts/generate-config.js 自动生成，请勿手动编辑
 * 生成时间: ${new Date().toISOString()}
 * 源配置: scripts/build-config.json
 */

(function () {
  'use strict'

  // 域名匹配工具
  function matchDomain(pattern, hostname) {
    if (pattern === '*') {return true}
    if (pattern.startsWith('*://')) {
      // *://*.example.com/* -> 匹配 example.com 及其子域名
      const domain = pattern.replace('*://*.', '').replace('*://', '').replace('/*', '')
      return hostname === domain || hostname.endsWith('.' + domain)
    }
    return hostname === pattern || hostname.endsWith('.' + pattern)
  }

  // 通用脚本配置（所有页面加载 - 已打包为单个 bundle）
  const COMMON_SCRIPTS = ['content/common-bundle.js']

  // 域名特定脚本配置（所有站点已打包为自包含 bundle）
${domainScripts}

  /**
   * 获取当前域名需要加载的脚本配置
   * @param {string} hostname - 当前页面主机名
   * @returns {Object} 脚本配置
   */
  function getScriptConfig(hostname) {
    const result = {
      commonScripts: [...COMMON_SCRIPTS],
      domainScripts: [],
      runAtStart: [],
      eventbusIntegration: false,
      eventbusScript: 'content/eventbus-integration.js',
    }

    // 查找匹配的域名配置
    for (const config of DOMAIN_SCRIPTS) {
      const matched = config.patterns.some((pattern) => matchDomain(pattern, hostname))
      if (matched) {
        // 分离 document_start 和默认脚本
        if (config.runAt === 'document_start') {
          result.runAtStart.push(...config.scripts)
        } else {
          result.domainScripts.push(...config.scripts)
        }
        if (config.eventbusIntegration) {
          result.eventbusIntegration = true
        }
        if (config.eventbusScript) {
          result.eventbusScript = config.eventbusScript
        }
      }
    }

    return result
  }

  // 导出配置
  window.DomainConfig = {
    getScriptConfig,
    COMMON_SCRIPTS,
    DOMAIN_SCRIPTS,
    matchDomain,
  }

  console.log('[DomainConfig] 域名配置模块已加载')
})()
`
}

// ========== 更新 domain-config.js ==========
function updateDomainConfig(config) {
  const domainConfigPath = join(root, 'content', 'domain-config.js')

  const content = generateDomainConfigContent(config)

  // 比较内容，避免无变化时写入导致无限重建
  if (existsSync(domainConfigPath)) {
    const existing = readFileSync(domainConfigPath, 'utf-8')
    // 忽略时间戳行进行比较（第5行: * 生成时间: ...）
    const normalize = (str) => str.replace(/生成时间: .+/, '生成时间: skip')
    if (normalize(existing) === normalize(content)) {
      console.log('[GenerateConfig] domain-config.js 无需更新')
      return true
    }
  }

  writeFileSync(domainConfigPath, content, 'utf-8')
  console.log('[GenerateConfig] ✅ domain-config.js 已更新')
  return true
}

// ========== 生成 manifest.json web_accessible_resources ==========
function generateWebAccessibleResources(config) {
  const patterns = config.webAccessiblePatterns || []
  return [
    {
      resources: patterns,
      matches: ['<all_urls>'],
    },
  ]
}

// ========== 更新 manifest.json ==========
function updateManifest(config) {
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error('[GenerateConfig] manifest.json 不存在')
    return false
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const newResources = generateWebAccessibleResources(config)

  // 检查是否需要更新
  const oldResources = JSON.stringify(manifest.web_accessible_resources)
  const newResourcesStr = JSON.stringify(newResources)
  if (oldResources === newResourcesStr) {
    console.log('[GenerateConfig] manifest.json 无需更新')
    return true
  }

  manifest.web_accessible_resources = newResources
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
  console.log('[GenerateConfig] ✅ manifest.json 已更新')
  return true
}

// ========== 生成构建配置（供 vite.config.js 使用）==========
function generateBuildBundles(config) {
  const allBundles = [...(config.layers || []), ...(config.siteBundles || [])]
  return allBundles.map((b) => ({
    name: b.name,
    entry: b.entry,
    outfile: b.outfile,
  }))
}

// ========== 验证配置一致性 ==========
function verifyConfig() {
  const config = loadConfig()
  const issues = []

  // 检查 entry 文件是否存在
  const allBundles = [...(config.layers || []), ...(config.siteBundles || [])]
  for (const bundle of allBundles) {
    const entryPath = join(root, bundle.entry)
    if (!existsSync(entryPath)) {
      issues.push({
        type: 'MISSING_ENTRY',
        severity: 'ERROR',
        message: `entry 文件不存在: ${bundle.entry} (${bundle.name})`,
      })
    }
  }

  // 检查 domains 是否有重复
  const domainMap = new Map()
  for (const site of config.siteBundles || []) {
    for (const domain of site.domains) {
      if (domainMap.has(domain)) {
        issues.push({
          type: 'DUPLICATE_DOMAIN',
          severity: 'WARN',
          message: `域名 ${domain} 被多个 bundle 使用: ${domainMap.get(domain)} 和 ${site.name}`,
        })
      }
      domainMap.set(domain, site.name)
    }
  }

  return issues
}

// ========== 主函数 ==========
function main() {
  console.log('[GenerateConfig] 开始生成配置...')

  const config = loadConfig()

  // 验证配置
  const issues = verifyConfig()
  if (issues.some((i) => i.severity === 'ERROR')) {
    console.error('[GenerateConfig] ❌ 配置验证失败:')
    issues
      .filter((i) => i.severity === 'ERROR')
      .forEach((i) => {
        console.error(`  - ${i.message}`)
      })
    process.exit(1)
  }

  // 更新文件
  const success = updateDomainConfig(config) && updateManifest(config)

  if (success) {
    console.log('[GenerateConfig] ✅ 配置生成完成')
  } else {
    console.error('[GenerateConfig] ❌ 配置生成失败')
    process.exit(1)
  }
}

// ========== 导出 ==========
module.exports = {
  loadConfig,
  generateBuildBundles,
  generateWebAccessibleResources,
  verifyConfig,
  updateDomainConfig,
  updateManifest,
}

// 直接运行
if (require.main === module) {
  main()
}
