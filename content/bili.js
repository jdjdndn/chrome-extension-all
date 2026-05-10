// Content script for bilibili.com
// 使用 SiteBase 基类重构，集成关键词过滤功能
// 使用 ScriptLoader 进行依赖管理

(function () {
  'use strict'

  if (window.BiliScriptLoaded) {
    console.log('[Bilibili脚本] 已加载，跳过')
    return
  }

  // ========== 主初始化函数（由 ScriptLoader 调用）==========
  async function initBiliScript() {
    console.log('[Bilibili脚本] 依赖已就绪，开始初始化')
    await runBiliScript()
  }

  // ========== 降级初始化函数（兼容旧环境）==========
  async function initBiliScriptLegacy() {
    console.log('[Bilibili脚本] ScriptLoader 未加载，使用降级模式')

    // 等待依赖加载（带重试机制）
    async function waitForDependencies(maxRetries = 10, interval = 100) {
      for (let i = 0; i < maxRetries; i++) {
        // 优先使用 LazyLoader
        if (typeof LazyLoader !== 'undefined') {
          await LazyLoader.load('site-base')
          return true
        }
        // 直接检查 SiteBase
        if (typeof SiteBase !== 'undefined') {
          return true
        }
        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, interval))
      }
      return false
    }

    const depsLoaded = await waitForDependencies()
    if (!depsLoaded) {
      console.error('[Bilibili脚本] 依赖加载超时 (LazyLoader/SiteBase)')
      return
    }

    await runBiliScript()
  }

  // ========== 主脚本逻辑 ==========
  async function runBiliScript() {
    window.BiliScriptLoaded = true

    // ========== Bilibili 站点脚本类 ==========
    class BiliSite extends SiteBase {
      constructor() {
        super({
          domain: 'bilibili.com',
          styleTagId: 'bili-content-hide-style',
          defaultSelectors: [],
          blockedDomains: [],
          localServerEnabled: true,
          localServerUrl: 'http://localhost:3000',
        })

        // Bilibili 特有的配置
        this.keywords = {
          notInterested: [],
          defaultNotInterested: [],
        }

        // Feed 卡片选择器
        this.feedCardSelectors = [
          '.bili-feed-card',
          '.feed-card',
          '.recommend-list__item',
          '.bili-video-card',
          '.video-card',
          '.rank-item',
          '.bili-rank-list-video',
          '.popular-video-card',
          '.history-video-card',
          '.bili-dyn-video-card',
          '.floor-single-card',
        ]

        // 基础隐藏选择器
        this.baseHideSelectors = [
          '.left-entry>.v-popover-wrap:nth-child(n+2)',
          '.floor-single-card:has(.living)',
          '.bili-feed-card:has(.bili-live-card)',
          '.floor-single-card:has(.floor-title)',
          '.bili-feed-card:not(:has(a))',
          '.feed-card:not(:has(a))',
        ]
      }

      /**
       * 自定义初始化
       */
      async customInit() {
        // 加载关键词
        await this.loadKeywords()

        // 生成选择器
        this.refreshHideSelectors()

        // 更新页面配置
        this.updatePageConfig()

        console.log('[Bilibili脚本] 自定义初始化完成')
      }

      /**
       * 加载设置（覆盖父类方法）
       */
      async loadSettings() {
        // 重新生成选择器
        this.refreshHideSelectors()

        // 调用父类方法
        const selectors = await this.loadSelectors()
        this.state.currentSelectors = selectors
      }

      /**
       * 生成关键词相关的隐藏选择器
       */
      generateKeywordSelectors() {
        const keywordSelectors = []
        for (const keyword of this.keywords.notInterested) {
          for (const cardSelector of this.feedCardSelectors) {
            keywordSelectors.push(`${cardSelector}:has(h3[title*="${keyword}"])`)
            keywordSelectors.push(`${cardSelector}:has(img:nth-child(1))`)
          }
        }
        return keywordSelectors
      }

      /**
       * 刷新隐藏选择器
       */
      refreshHideSelectors() {
        const keywordSelectors = this.generateKeywordSelectors()
        this.defaultSelectors = [...this.baseHideSelectors, ...keywordSelectors]
        console.log(
          '[Bilibili脚本] 已生成隐藏选择器，关键词数量:',
          this.keywords.notInterested.length
        )
      }

      /**
       * 加载关键词
       */
      async loadKeywords() {
        // 优先从本地服务加载
        if (this.state.localServerAvailable) {
          const serverData = await this.loadKeywordsFromServer()
          if (serverData?.notInterested?.length > 0) {
            this.keywords.notInterested = [...serverData.notInterested]
            console.log(
              '[Bilibili脚本] 从本地服务加载关键词:',
              this.keywords.notInterested.length,
              '个'
            )
            return
          }
        }

        // 回退到 Chrome 存储
        const result = await StorageUtils.getLocal(['biliKeywords'])
        if (result.biliKeywords?.notInterested) {
          this.keywords.notInterested = [...result.biliKeywords.notInterested]
          console.log(
            '[Bilibili脚本] 从Chrome存储加载关键词:',
            this.keywords.notInterested.length,
            '个'
          )
        }
      }

      /**
       * 从本地服务加载关键词
       */
      async loadKeywordsFromServer() {
        try {
          const result = await this.localServerFetch(`/api/data/keywords/${this.domain}`)
          if (result && result.success && result.data) {
            return result.data
          }
        } catch (error) {
          console.log('[Bilibili脚本] 从本地服务获取关键词失败:', error.message)
        }
        return null
      }

      /**
       * 保存关键词
       */
      async saveKeywords() {
        // 保存到 Chrome 存储
        await StorageUtils.setLocal({
          biliKeywords: { notInterested: this.keywords.notInterested },
        })

        // 同时保存到本地服务
        if (this.state.localServerAvailable) {
          await this.saveKeywordsToServer(this.keywords.notInterested)
        }

        console.log('[Bilibili脚本] 已保存关键词设置')
      }

      /**
       * 保存关键词到本地服务
       */
      async saveKeywordsToServer(keywords) {
        if (!this.state.localServerAvailable) {return false}
        try {
          await this.localServerFetch(`/api/data/keywords/${this.domain}`, {
            method: 'POST',
            body: { notInterested: keywords },
          })
          return true
        } catch (error) {
          console.log('[Bilibili脚本] 保存关键词到本地服务失败:', error.message)
          return false
        }
      }

      /**
       * 本地服务请求封装
       */
      async localServerFetch(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('请求超时'))
          }, 5000)

          chrome.runtime.sendMessage(
            {
              type: 'LOCAL_SERVER_FETCH',
              url: `${this.localServerUrl}${endpoint}`,
              method: options.method || 'GET',
              headers: options.headers,
              body: options.body,
            },
            (response) => {
              clearTimeout(timeout)
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else if (response && response.success) {
                resolve(response.data)
              } else {
                reject(new Error(response?.error || '请求失败'))
              }
            }
          )
        })
      }

      /**
       * 从本地服务加载选择器（覆盖父类方法）
       */
      async loadFromServer(path) {
        if (!this.state.localServerAvailable) {return null}

        try {
          const result = await this.localServerFetch(`/api/data/${path}/${this.domain}`)
          if (result && result.success && result.data) {
            const selectors = result.data
            if (Array.isArray(selectors) && selectors.length > 0) {
              return selectors
            }
          }
        } catch (error) {
          console.log('[Bilibili脚本] 从本地服务获取选择器失败:', error.message)
        }
        return null
      }

      /**
       * 保存选择器到本地服务（覆盖父类方法）
       */
      async saveToServer(path, data) {
        if (!this.state.localServerAvailable) {return false}

        try {
          await this.localServerFetch(`/api/data/${path}/${this.domain}`, {
            method: 'POST',
            body: data,
          })
          return true
        } catch (error) {
          console.log('[Bilibili脚本] 保存到本地服务失败:', error.message)
          return false
        }
      }

      /**
       * 更新页面配置（CSP 安全方式）
       */
      updatePageConfig() {
        const config = {
          localServerAvailable: this.state.localServerAvailable,
          keywordsCount: this.keywords.notInterested.length,
          selectorsCount: this.defaultSelectors.length,
        }
        console.log('[Bilibili脚本] 配置已更新:', JSON.stringify(config))

        // 通过 meta 标签存储配置
        let meta = document.getElementById('bili-config-meta')
        if (!meta) {
          meta = document.createElement('meta')
          meta.id = 'bili-config-meta'
          meta.name = 'bili-config'
          document.head.appendChild(meta)
        }
        meta.content = JSON.stringify(config)
      }

      /**
       * 导出配置
       */
      exportConfig() {
        return {
          ...super.exportConfig(),
          keywords: this.keywords,
          feedCardSelectors: this.feedCardSelectors,
        }
      }
    }

    // ========== 实例化 ==========
    const biliSite = new BiliSite()

    // ========== 配置导出 ==========
    window.BiliScriptConfig = {
      get DEFAULT_HIDE_SELECTORS() {
        return biliSite.defaultSelectors
      },
      BLOCKED_DOMAINS: [],
      get NOT_INTERESTED_KEYWORDS() {
        return biliSite.keywords.notInterested
      },
      DEFAULT_NOT_INTERESTED_KEYWORDS: [],
      FEED_CARD_SELECTORS: biliSite.feedCardSelectors,
      get localServerAvailable() {
        return biliSite.state.localServerAvailable
      },
    }

    // ========== 消息处理器 ==========
    biliSite.createMessageHandler({
      UPDATE_KEYWORDS: (message) => {
        const { keywords } = message
        let updated = false

        if (keywords.NOT_INTERESTED_KEYWORDS) {
          biliSite.keywords.notInterested = [...new Set(keywords.NOT_INTERESTED_KEYWORDS)]
          console.log(
            '[Bilibili脚本] 不感兴趣关键词已更新:',
            biliSite.keywords.notInterested.length,
            '个'
          )
          updated = true
        }

        if (updated) {
          biliSite.saveKeywords()
          biliSite.refreshHideSelectors()
          // 重新应用选择器
          biliSite.applyHideElements()
        }

        return { success: true, message: '关键词已更新' }
      },

      GET_KEYWORDS: () => ({
        success: true,
        keywords: {
          NOT_INTERESTED_KEYWORDS: [...biliSite.keywords.notInterested],
          DEFAULT_NOT_INTERESTED_KEYWORDS: [...biliSite.keywords.defaultNotInterested],
        },
      }),

      RESET_KEYWORDS: () => {
        biliSite.keywords.notInterested = [...biliSite.keywords.defaultNotInterested]
        biliSite.saveKeywords()
        biliSite.refreshHideSelectors()
        biliSite.applyHideElements()
        console.log('[Bilibili脚本] 关键词已重置为默认值')
        return { success: true, keywords: [...biliSite.keywords.notInterested] }
      },

      // 同步数据到本地服务
      SYNC_TO_SERVER: async () => {
        if (!biliSite.state.localServerAvailable) {
          return { success: false, message: '本地服务不可用' }
        }
        const keywordsSaved = await biliSite.saveKeywordsToServer(biliSite.keywords.notInterested)
        const selectorsSaved = await biliSite.saveToServer(
          'selectors',
          biliSite.state.currentSelectors
        )
        return {
          success: keywordsSaved && selectorsSaved,
          message: keywordsSaved && selectorsSaved ? '同步成功' : '同步失败',
        }
      },

      // 从本地服务同步数据
      SYNC_FROM_SERVER: async () => {
        if (!biliSite.state.localServerAvailable) {
          return { success: false, message: '本地服务不可用' }
        }
        await biliSite.loadKeywords()
        biliSite.refreshHideSelectors()
        await biliSite.loadSettings()
        biliSite.applyHideElements()
        return { success: true, message: '同步成功' }
      },
    })
  } // runBiliScript 函数结束

  // ========== 启动 ==========
  async function init() {
    await biliSite.init()

    console.log(
      '[Bilibili脚本] 初始化完成，本地服务:',
      biliSite.state.localServerAvailable ? '已连接' : '未连接'
    )

    // 标记 content script 已就绪
    if (window.ContentBridge) {
      ContentBridge.markReady()
    }
  }

  // ========== 使用 ScriptLoader 声明依赖（放在文件末尾，确保所有变量已定义）==========
  if (window.ScriptLoader) {
    ScriptLoader.declare({
      name: 'bili-script',
      dependencies: ['EventBus', 'MessagingUtils', 'SiteBase'],
      onReady: initBiliScript,
    })
  } else {
    // 降级：使用旧的等待机制
    initBiliScriptLegacy()
  }

  console.log('[Bilibili脚本] 已加载')
})()
