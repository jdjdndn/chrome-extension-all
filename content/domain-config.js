/**
 * 域名脚本配置
 * 统一管理所有域名的脚本加载配置
 */

(function () {
  'use strict';

  // 域名匹配工具
  function matchDomain(pattern, hostname) {
    if (pattern === '*') return true;
    if (pattern.startsWith('*://')) {
      // *://*.example.com/* -> 匹配 example.com 及其子域名
      const domain = pattern.replace('*://*.', '').replace('*://', '').replace('/*', '');
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    return hostname === pattern || hostname.endsWith('.' + pattern);
  }

  // 通用脚本配置（所有页面加载）
  const COMMON_SCRIPTS = [
    'content/common/script-switch.js',
    'content/common/redirect-links.js',
    'content/common/text-to-link.js',
    'content/common/link-blank.js',
    'content/common/add-title.js',
    'content/common/panel-position-manager.js',
    'content/common/doc-generator.js',
    'content/common/text-collector.js',
    'content/common/keyboard-pagination.js'
  ];

  // 域名特定脚本配置
  const DOMAIN_SCRIPTS = [
    // Bilibili
    {
      patterns: ['*://*.bilibili.com/*'],
      scripts: ['content/bili.js'],
      runAt: 'document_start',
      eventbusIntegration: true
    },
    // Douyin
    {
      patterns: ['*://*.douyin.com/*'],
      scripts: ['content/utils/localServer.js', 'content/douyin.js'],
      eventbusIntegration: true,
      eventbusScript: 'content/eventbus-integration-douyin.js'
    },
    // 4hu
    {
      patterns: ['*://*.4hu.tv/*'],
      scripts: ['content/4hu.js'],
      eventbusIntegration: true
    },
    // Weread
    {
      patterns: ['*://*.weread.qq.com/*'],
      scripts: ['content/weread.js'],
      eventbusIntegration: true
    },
    // Quark
    {
      patterns: ['*://*.quark.cn/*'],
      scripts: ['content/quark.js'],
      eventbusIntegration: true
    },
    // 18comic
    {
      patterns: ['*://*.18comic.vip/*'],
      scripts: ['content/comic18.js'],
      eventbusIntegration: true
    },
    // Aliyun
    {
      patterns: ['*://*.aliyundrive.com/*'],
      scripts: ['content/aliyun.js'],
      eventbusIntegration: true
    },
    // Baidu
    {
      patterns: ['*://*.baidu.com/*'],
      scripts: ['content/baiduPan.js'],
      eventbusIntegration: true
    },
    // Boss
    {
      patterns: ['*://*.zhipin.com/*'],
      scripts: ['content/boss.js'],
      eventbusIntegration: true
    },
    // Xiaohongshu
    {
      patterns: ['*://*.xiaohongshu.com/*'],
      scripts: ['content/xiaohongshu.js'],
      eventbusIntegration: true
    },
    // DianGong
    {
      patterns: ['*://*.wyaqpx.com/*'],
      scripts: ['content/dianGong.js'],
      eventbusIntegration: true
    },
    // Gongkong
    {
      patterns: ['*://*.ymmfa.com/*'],
      scripts: ['content/gongkong.js'],
      eventbusIntegration: true
    },
    // YouTube
    {
      patterns: ['*://*.youtube.com/*'],
      scripts: ['content/base/SiteScript.js', 'content/youtube.js'],
      runAt: 'document_start'
    },
    // GitHub
    {
      patterns: ['*://github.com/*', '*://*.github.com/*'],
      scripts: ['content/github.js'],
      runAt: 'document_start'
    },
    // Modelscope
    {
      patterns: ['*://modelscope.cn/models*', '*://*.modelscope.cn/models*'],
      scripts: ['content/modelscope.js'],
      eventbusIntegration: true
    }
  ];

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
      eventbusScript: 'content/eventbus-integration.js'
    };

    // 查找匹配的域名配置
    for (const config of DOMAIN_SCRIPTS) {
      const matched = config.patterns.some(pattern => matchDomain(pattern, hostname));
      if (matched) {
        // 分离 document_start 和默认脚本
        if (config.runAt === 'document_start') {
          result.runAtStart.push(...config.scripts);
        } else {
          result.domainScripts.push(...config.scripts);
        }
        if (config.eventbusIntegration) {
          result.eventbusIntegration = true;
        }
        if (config.eventbusScript) {
          result.eventbusScript = config.eventbusScript;
        }
      }
    }

    return result;
  }

  // 导出配置
  window.DomainConfig = {
    getScriptConfig,
    COMMON_SCRIPTS,
    DOMAIN_SCRIPTS,
    matchDomain
  };

  console.log('[DomainConfig] 域名配置模块已加载');
})();
