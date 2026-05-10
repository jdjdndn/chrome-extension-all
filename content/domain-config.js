/**
 * 域名脚本配置
 * 统一管理所有域名的脚本加载配置
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
  const DOMAIN_SCRIPTS = [
    {
      patterns: ['*://*.bilibili.com/*'],
      scripts: ['content/bundled/bili.bundle.js'],
    },
    {
      patterns: ['*://*.douyin.com/*'],
      scripts: ['content/bundled/douyin.bundle.js'],
      runAt: 'document_start',
    },
    {
      patterns: ['*://*.4hu.tv/*'],
      scripts: ['content/bundled/4hu.bundle.js'],
    },
    {
      patterns: ['*://*.weread.qq.com/*'],
      scripts: ['content/bundled/weread.bundle.js'],
    },
    {
      patterns: ['*://*.quark.cn/*'],
      scripts: ['content/bundled/quark.bundle.js'],
    },
    {
      patterns: ['*://*.18comic.vip/*'],
      scripts: ['content/bundled/comic18.bundle.js'],
    },
    {
      patterns: ['*://*.aliyundrive.com/*'],
      scripts: ['content/bundled/aliyun.bundle.js'],
    },
    {
      patterns: ['*://*.baidu.com/*'],
      scripts: ['content/bundled/baiduPan.bundle.js'],
    },
    {
      patterns: ['*://*.zhipin.com/*'],
      scripts: ['content/bundled/boss.bundle.js'],
    },
    {
      patterns: ['*://*.xiaohongshu.com/*'],
      scripts: ['content/bundled/xiaohongshu.bundle.js'],
    },
    {
      patterns: ['*://*.wyaqpx.com/*'],
      scripts: ['content/bundled/dianGong.bundle.js'],
    },
    {
      patterns: ['*://*.ymmfa.com/*'],
      scripts: ['content/bundled/gongkong.bundle.js'],
    },
    {
      patterns: ['*://*.youtube.com/*'],
      scripts: ['content/bundled/youtube.bundle.js'],
      runAt: 'document_start',
    },
    {
      patterns: ['*://github.com/*', '*://*.github.com/*'],
      scripts: ['content/bundled/github.bundle.js'],
      runAt: 'document_start',
    },
    {
      patterns: ['*://modelscope.cn/models*', '*://*.modelscope.cn/models*'],
      scripts: ['content/bundled/modelscope.bundle.js'],
    },
  ]

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
