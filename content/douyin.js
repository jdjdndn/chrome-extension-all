/**
 * 抖音自动化脚本
 * 功能：自动展开评论、跳过广告、跳过AI视频、不感兴趣关键词过滤
 * 依赖: EventBus, MessagingUtils, DOMUtils, LoggerUtils
 *
 * 使用 ScriptLoader 进行依赖管理
 */

;(function () {
  'use strict'

  // ========== 日志控制 ==========
  const logger = window.LoggerUtils?.createLogger?.('抖音') || {
    debug: () => {},
    info: () => {},
    warn: console.warn.bind(console, '[抖音]'),
    error: console.error.bind(console, '[抖音]'),
  }

  // ========== 防止重复加载 ==========
  if (window.DouyinScript && window.DouyinScript.isInitialized) {
    logger.debug('已加载，跳过重复初始化')
    return
  }
  if (!window.DouyinScript) {
    window.DouyinScript = { isInitialized: false }
  }

  // ========== 主初始化函数（由 ScriptLoader 调用）==========
  function initDouyinScript() {
    logger.debug(' 依赖已就绪，开始初始化')
    init()
  }

  // ========== 降级初始化函数（兼容旧环境）==========
  function initDouyinScriptLegacy() {
    logger.debug(' ScriptLoader 未加载，直接初始化')
    init()
  }

  // ========== 配置 ==========
  const STYLE_TAG_ID = 'douyin-content-hide-style'
  let currentSelectors = []

  const DEFAULT_HIDE_SELECTORS = [
    '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
    '.ooIf2jbM',
    '._e7lJDCC',
    '#island_076c3',
    '.ai-note-container',
    '.cursorPointer+*',
    'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])',
    '.danmakuContainer',
    '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)',
  ]
  logger.debug(' DEFAULT_HIDE_SELECTORS 已定义，数量:', DEFAULT_HIDE_SELECTORS.length)

  const BLOCKED_DOMAINS = [
    'mcs.zijieapi.com/list',
    'vc-gate-edge.ndcpp.com/sdk/get_peer',
    'security.zijieapi.com/api/metrics/emit',
    'tnc0-aliec2.zijieapi.com/get_domains',
  ]

  const NOT_INTERESTED_KEYWORDS = [
    '抽象',
    '漫画',
    '国漫',
    '修仙',
    '玄幻',
    '系统',
    '动画',
    '动漫',
    '小说',
    '黑神话',
    '解说',
    '好剧',
    '儿童',
    '孩子',
    '观影',
    '案件',
    '国学',
    '狗',
    '猫',
    '宠物',
    '娃',
    '王者荣耀',
    '射手',
    '对抗路',
    '中单',
    '上单',
    '打野',
    '巅峰赛',
    '游戏日常',
    '综艺',
    '游戏',
    '美食',
    '测评',
    '小品',
    '春晚',
    '相亲',
    '恋爱',
    '情侣日常',
    '国服',
    '驾照',
    '考试',
    '结婚',
    '率土之滨',
    '程序员',
    '前端',
    '动物',
    '电商',
    '追剧',
    '军旅',
    '短剧',
    '恐怖',
    '影视',
    '电影',
    '司机',
    '工地',
    '情侣',
    '原生家庭',
    '影娱',
    '好片',
    '亲子',
    '幼儿园',
    '育儿',
    '育婴',
    '宝宝',
    '母婴',
    '妈妈',
    '父母',
    '爸妈',
    '早教',
    '幼教',
    '学前',
    '音乐',
    '热歌',
    '健身',
    '分手',
    '股票',
    '情感',
    '驾驶',
    '街头',
    '手势',
  ]

  const AUTO_FOLLOW_KEYWORDS = ['ootd']

  const AD_SVG_PATHS = [
    // 旧版广告标识（fill-opacity=".5"）
    '<path d="M9.492 2.004L8.22 2.22c.216.336.408.72.588 1.128h-4.38v3.636c-.024 2.34-.348 4.176-.972 5.496l.96.852c.744-1.596 1.128-3.708 1.164-6.348V4.452h8.796V3.348h-4.308a16.717 16.717 0 0 0-.576-1.344zm15.564 6.672h-8.04v4.548h1.152v-.576h5.736v.576h1.152V8.676zm-6.888 2.904V9.756h5.736v1.824h-5.736zm-.276-6.732h2.688v1.656h-5.04V7.62h10.92V6.504h-4.74V4.848h3.828V3.756H21.72V2.148h-1.14v1.608h-2.016c.204-.408.372-.852.516-1.32l-1.128-.144c-.384 1.248-1.104 2.292-2.16 3.144l.684.9a8.301 8.301 0 0 0 1.416-1.488z" fill="#fff" fill-opacity=".5"></path>',
    // 新版广告标识（不感兴趣，fill-opacity=".8"，16.724）
    '<path d="M9.491 2.004L8.22 2.22c.216.336.408.72.588 1.128h-4.38v3.636c-.024 2.34-.348 4.176-.972 5.496l.96.852c.744-1.596 1.128-3.708 1.164-6.348V4.452h8.796V3.348h-4.308a16.724 16.724 0 0 0-.576-1.344zm15.564 6.672h-8.04v4.548h1.152v-.576h5.736v.576h1.152V8.676zm-6.888 2.904V9.756h5.736v1.824h-5.736zm-.276-6.732h2.688v1.656h-5.04V7.62h10.92V6.504h-4.74V4.848h3.828V3.756H21.72V2.148h-1.14v1.608h-2.016c.204-.408.372-.852.516-1.32l-1.128-.144c-.384 1.248-1.104 2.292-2.16 3.144l.684.9a8.301 8.301 0 0 0 1.416-1.488z" fill="#fff" fill-opacity=".8"></path>',
  ]

  const AI_KEYWORDS = ['AI']

  const THROTTLE_CONFIG = {
    SKIP_VIDEO: 400,
    OPEN_COMMENT: 600,
    FOLLOW: 500,
  }

  // ========== 状态管理 ==========
  let processedVideos = new Set()
  let lastActionTime = {}
  let videoHistory = []
  const VIDEO_HISTORY_SIZE = 30 // 保留最近30个视频的历史，支持更长时间的手动返回
  let currentVideoId = null
  let visibilityChangeHandler = null
  let beforeUnloadHandler = null

  // 本次会话中用户返回的视频 - 这些视频不会触发自动下滑，直到用户滑到全新视频
  const returnedVideosThisSession = new Set()

  // 用户导航方向跟踪 - 用于检测上滑返回操作
  let lastNavigationDirection = null

  // ========== 连播控制 ==========
  function findAutoPlaySwitch() {
    // 查找所有候选按钮，筛选可视区域内的
    const buttons = document.querySelectorAll('button.xg-switch')
    for (const btn of buttons) {
      if (isElementInViewportAndVisible(btn)) {
        return btn
      }
    }
    return null
  }

  function isAutoPlayEnabled() {
    const switchBtn = findAutoPlaySwitch()
    return switchBtn && switchBtn.classList.contains('xg-switch-checked')
  }

  function clickSwitch(btn) {
    if (!btn) return false
    const rect = btn.getBoundingClientRect()
    const clientX = rect.left + rect.width / 2
    const clientY = rect.top + rect.height / 2

    // 模拟完整点击事件链
    btn.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 1,
      })
    )
    btn.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 0,
      })
    )
    btn.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        buttons: 0,
      })
    )
    return true
  }

  function enableAutoPlay() {
    const switchBtn = findAutoPlaySwitch()
    if (switchBtn && !switchBtn.classList.contains('xg-switch-checked')) {
      logger.debug('[连播] 当前未开启，点击开启连播', switchBtn)
      clickSwitch(switchBtn)
    }
  }

  function disableAutoPlay() {
    const switchBtn = findAutoPlaySwitch()
    if (switchBtn && switchBtn.classList.contains('xg-switch-checked')) {
      logger.debug('[连播] 当前已开启，点击关闭连播', switchBtn)
      clickSwitch(switchBtn)
    }
  }

  // ========== 视频状态管理器 (WeakMap) ==========
  const VideoStateManager = {
    uuid: new WeakMap(),
    liveHandled: new WeakMap(),
    skipAd: new WeakMap(),
    commentListener: new WeakMap(),

    setUUID(video, uuid) {
      this.uuid.set(video, uuid)
    },
    getUUID(video) {
      if (!video) return generateUUID()
      if (!this.uuid.has(video)) this.uuid.set(video, generateUUID())
      return this.uuid.get(video)
    },
    setLiveHandled(video, value) {
      value ? this.liveHandled.set(video, true) : this.liveHandled.delete(video)
    },
    isLiveHandled(video) {
      return this.liveHandled.has(video)
    },
    setSkipAd(video, value) {
      value ? this.skipAd.set(video, true) : this.skipAd.delete(video)
    },
    isSkipAd(video) {
      return this.skipAd.has(video)
    },
    setCommentListener(element, value) {
      value ? this.commentListener.set(element, true) : this.commentListener.delete(element)
    },
    hasCommentListener(element) {
      return this.commentListener.has(element)
    },
    clear(video) {
      this.uuid.delete(video)
      this.liveHandled.delete(video)
      this.skipAd.delete(video)
      this.commentListener.delete(video)
    },
  }

  // ========== 定时器管理器 ==========
  const TimerManager = {
    timers: [],
    factories: [],
    isRunning: false,

    add(timerId) {
      this.timers.push(timerId)
    },
    register(factory) {
      this.factories.push(factory)
    },
    clearAll() {
      this.timers.forEach((id) => clearInterval(id))
      this.timers = []
      this.isRunning = false
      logger.debug('[定时器管理] 所有定时器已清除')
    },
    start() {
      if (this.isRunning) return
      this.isRunning = true
      this.factories.forEach((factory) => {
        const timerId = factory()
        if (timerId !== undefined) this.add(timerId)
      })
    },
    restart() {
      this.clearAll()
      this.start()
    },
  }

  // ========== 视频变化检测器 ==========
  const VideoChangeChecker = {
    activeChecks: new Map(),

    start(expectedVideoId, reason) {
      this.cancel(expectedVideoId)
      const CHECK_INTERVAL = 2000
      const MAX_CHECKS = 3
      let checkCount = 0

      const checkVideo = () => {
        checkCount++
        const currentVideoBody = findOne('.playerContainer')
        const currentId = currentVideoBody ? getStableVideoId(currentVideoBody) : null

        // 视频已切换、是直播、是广告时，取消检测
        if (
          currentId !== expectedVideoId ||
          VideoStateManager.isLiveHandled(currentVideoBody) ||
          VideoStateManager.isSkipAd(currentVideoBody)
        ) {
          this.cancel(expectedVideoId)
          return
        }

        if (checkCount >= MAX_CHECKS) {
          logger.debug(`[二次检测] 视频${checkCount}次检查未切换，强制再次下滑`)
          this.cancel(expectedVideoId)
          if (canExecuteAction('skip_video_retry', THROTTLE_CONFIG.SKIP_VIDEO)) {
            triggerKeyboardEvent('skip_video_retry', 'keydown', {
              keyCode: 40,
              key: 'ArrowDown',
              code: 'ArrowDown',
            })
            this.start(currentId, reason)
          }
          return
        }
        logger.debug(`[二次检测] 第${checkCount}次检查，视频未切换，等待...`)
      }

      const timerId = setTimeout(() => {
        checkVideo()
        const intervalId = setInterval(checkVideo, CHECK_INTERVAL)
        this.activeChecks.set(expectedVideoId, { intervalId, timeoutId: null })
      }, 1000)
      this.activeChecks.set(expectedVideoId, { intervalId: null, timeoutId: timerId })
    },

    cancel(videoId) {
      const check = this.activeChecks.get(videoId)
      if (check) {
        if (check.intervalId) clearInterval(check.intervalId)
        if (check.timeoutId) clearTimeout(check.timeoutId)
        this.activeChecks.delete(videoId)
      }
    },

    cancelAll() {
      this.activeChecks.forEach((check) => {
        if (check.intervalId) clearInterval(check.intervalId)
        if (check.timeoutId) clearTimeout(check.timeoutId)
      })
      this.activeChecks.clear()
      logger.debug(`[二次检测] 所有检测任务已取消`)
    },
  }

  // ========== 工具函数 ==========
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }

  function getVideoUUID(videoBody) {
    return VideoStateManager.getUUID(videoBody)
  }

  // 从 video 元素的 data-xgplayerid 获取真实视频ID
  function getRealVideoId(videoBody) {
    const container = videoBody || document
    const video = container.querySelector('video')
    if (video) {
      const playerId = video.getAttribute('data-xgplayerid')
      if (playerId) return playerId
    }
    return null
  }

  // 获取稳定的视频ID（优先data-xgplayerid，降级用UUID）
  function getStableVideoId(videoBody) {
    const realId = getRealVideoId(videoBody)
    if (realId) return realId
    return videoBody ? getVideoUUID(videoBody) : generateUUID()
  }

  // 使用 DOMUtils.findOneInViewport 替代本地实现
  function findOne(selector) {
    if (typeof DOMUtils === 'undefined') {
      logger.warn('[抖音脚本] DOMUtils 未就绪，findOne 返回 null')
      return null
    }
    return DOMUtils.findOneInViewport(selector, { checkVisibility: true, checkDimensions: true })
  }

  function findPath(pathStr) {
    if (typeof DOMUtils === 'undefined') {
      logger.warn('[抖音脚本] DOMUtils 未就绪，findPath 返回 undefined')
      return undefined
    }
    return DOMUtils.findAllInViewport('path', {
      checkVisibility: true,
      checkDimensions: true,
    }).find((it) => it.outerHTML === pathStr)
  }

  function canExecuteAction(actionId, delay) {
    const now = Date.now()
    if (now - (lastActionTime[actionId] || 0) >= delay) {
      lastActionTime[actionId] = now
      return true
    }
    return false
  }

  function debounceById(fn, delay = 400) {
    const timerMap = new Map()
    return (id, ...args) => {
      const hasTimer = timerMap.has(id)
      if (hasTimer) clearTimeout(timerMap.get(id))
      if (!id || args.length !== 2) return
      if (!hasTimer) fn.apply(this, args)
      const timer = setTimeout(() => timerMap.delete(id), delay)
      timerMap.set(id, timer)
    }
  }

  // 标记自动触发的键盘事件，防止与用户操作混淆
  let isAutoTriggered = false

  const triggerKeyboardEvent = debounceById(function (eventType, eventData) {
    // 添加 bubbles 和 cancelable 确保事件能冒泡和被正常处理
    const event = new KeyboardEvent(eventType, {
      bubbles: true,
      cancelable: true,
      ...eventData,
    })
    // 优先尝试派发到焦点元素，再冒泡到 document
    isAutoTriggered = true
    const target = document.activeElement || document.body
    target.dispatchEvent(event)
    isAutoTriggered = false
  }, 400)

  function isManualNavigation(videoId) {
    const index = videoHistory.indexOf(videoId)
    return index !== -1 && index < videoHistory.length - 1
  }

  function updateVideoHistory(videoId) {
    if (videoHistory.length > 0 && videoHistory[videoHistory.length - 1] === videoId) return
    videoHistory.push(videoId)
    if (videoHistory.length > VIDEO_HISTORY_SIZE) videoHistory.shift()
  }

  function clearProcessedVideo(videoId) {
    if (!videoId) return
    const keysToDelete = [...processedVideos].filter((key) => key.endsWith(`_${videoId}`))
    keysToDelete.forEach((key) => processedVideos.delete(key))
    if (keysToDelete.length > 0) logger.debug(`[清理] 移除已离开视频的处理记录`)
  }

  // ========== 核心功能 ==========

  // 点击下一个视频按钮（优先按钮，备选键盘）
  function clickNextButton() {
    // 首选：播放器切换按钮
    const nextBtn = findOne('div.xgplayer-playswitch-next')
    if (nextBtn && isElementInViewportAndVisible(nextBtn)) {
      logger.debug('[导航] 点击 xgplayer-playswitch-next 按钮')
      // 尝试多种触发方式
      nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      nextBtn.click()
      return true
    }
    // 备选1：data-e2e 按钮
    const nextBtn2 = findOne('[data-e2e="video-switch-next-arrow"]')
    if (nextBtn2 && isElementInViewportAndVisible(nextBtn2)) {
      logger.debug('[导航] 点击 data-e2e 下一个按钮')
      nextBtn2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      nextBtn2.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      nextBtn2.click()
      return true
    }
    // 备选2：键盘下箭头
    logger.debug('[导航] 使用键盘下箭头')
    triggerKeyboardEvent('skip_video', 'keydown', {
      keyCode: 40,
      key: 'ArrowDown',
      code: 'ArrowDown',
    })
    return false
  }

  // 点击上一个视频按钮
  function clickPrevButton() {
    // 首选：播放器切换按钮
    const prevBtn = findOne('div.xgplayer-playswitch-prev')
    if (prevBtn && isElementInViewportAndVisible(prevBtn)) {
      logger.debug('[导航] 点击 xgplayer-playswitch-prev 按钮')
      prevBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      prevBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      prevBtn.click()
      return true
    }
    // 备选1：data-e2e 按钮
    const prevBtn2 = findOne('[data-e2e="video-switch-prev-arrow"]')
    if (prevBtn2 && isElementInViewportAndVisible(prevBtn2)) {
      logger.debug('[导航] 点击 data-e2e 上一个按钮')
      prevBtn2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      prevBtn2.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      prevBtn2.click()
      return true
    }
    // 备选2：键盘上箭头
    logger.debug('[导航] 使用键盘上箭头')
    triggerKeyboardEvent('prev_video', 'keydown', { keyCode: 38, key: 'ArrowUp', code: 'ArrowUp' })
    return false
  }

  // 点击评论按钮
  function clickCommentButton() {
    // 方法1: 通过收藏按钮定位 (div[data-e2e*=video-player-collect] 上一个兄弟的第一个儿子)
    const collectBtn = findOne('div[data-e2e*="video-player-collect"]')
    if (collectBtn) {
      const parent = collectBtn.parentElement
      if (parent) {
        const prevSibling = collectBtn.previousElementSibling
        if (prevSibling && prevSibling.firstElementChild) {
          const commentBtn = prevSibling.firstElementChild
          if (isElementInViewportAndVisible(commentBtn)) {
            logger.debug('[评论区] 通过收藏按钮定位，点击评论按钮')
            commentBtn.click()
            return checkCommentOpened()
          }
        }
      }
    }

    // 方法2: svg选择器 (必须精确匹配1个)
    const selectors = [
      'div[class]>div:not([class]):not(style):not([data-])>svg',
      'div:not([class]):not(style):not([data-])>svg',
    ]

    for (const selector of selectors) {
      const svgs = [...document.querySelectorAll(selector)].filter((svg) =>
        isElementInViewportAndVisible(svg)
      )

      if (svgs.length === 1) {
        logger.debug(`[评论区] 选择器 "${selector}" 精确匹配1个，点击`)
        svgs[0].click()
        return checkCommentOpened()
      }
    }

    // 方法3: 键盘x
    logger.debug('[评论区] 使用键盘x')
    triggerKeyboardEvent('autoOpenComment', 'keydown', { keyCode: 88, key: 'x', code: 'KeyX' })
    return false
  }

  function checkCommentOpened() {
    setTimeout(() => {
      const panel = findOne('#videoSideCard') || findOne('[class*="comment"]')
      if (panel && panel.offsetWidth > 0) {
        logger.debug('[评论区] 已成功打开')
      } else {
        logger.debug('[评论区] 点击未成功，尝试键盘x')
        triggerKeyboardEvent('autoOpenComment', 'keydown', { keyCode: 88, key: 'x', code: 'KeyX' })
      }
    }, 300)
    return true
  }

  function skipToNextVideo(reason) {
    if (!canExecuteAction('skip_video', THROTTLE_CONFIG.SKIP_VIDEO)) return
    const currentVideoBody = findOne('.playerContainer')
    const currentId = currentVideoBody ? getStableVideoId(currentVideoBody) : null
    logger.debug(`[自动下滑] 原因: ${reason}`)

    // 优先点击按钮，备选键盘
    clickNextButton()

    if (currentId) VideoChangeChecker.start(currentId, reason)
  }

  function isElementInViewportAndVisible(element) {
    if (typeof DOMUtils === 'undefined') return false
    return DOMUtils.isElementInViewport(element, { checkVisibility: true, checkDimensions: true })
  }

  function detectAdSvg() {
    const visiblePaths = [...document.querySelectorAll('path')].filter((item) =>
      isElementInViewportAndVisible(item)
    )

    // 检测新版广告标识（不感兴趣，fill-opacity=".8"）
    const newAdPath = AD_SVG_PATHS.find((adPath) => adPath.includes('fill-opacity=".8"'))
    if (newAdPath && visiblePaths.some((it) => it.outerHTML === newAdPath)) {
      return { detected: true, type: '不感兴趣', path: 'new' }
    }

    // 检测旧版广告标识（fill-opacity=".5"）
    const oldAdPath = AD_SVG_PATHS.find((adPath) => adPath.includes('fill-opacity=".5"'))
    if (oldAdPath && visiblePaths.some((it) => it.outerHTML === oldAdPath)) {
      return { detected: true, type: '广告视频', path: 'old' }
    }

    // 兼容：其他未知的广告标识（如果有）
    if (AD_SVG_PATHS.some((adPath) => visiblePaths.some((it) => it.outerHTML === adPath))) {
      return { detected: true, type: '广告', path: 'unknown' }
    }

    return { detected: false }
  }

  function skipAD(videoBody) {
    if (videoBody && VideoStateManager.isSkipAd(videoBody)) return

    const adResult = detectAdSvg()
    if (adResult.detected) {
      logger.debug(`[广告检测] 检测到${adResult.type}标识 (${adResult.path})`)
      if (videoBody) VideoStateManager.setSkipAd(videoBody, true)
      triggerKeyboardEvent('skipAD_mark', 'keydown', { keyCode: 82, key: 'r', code: 'KeyR' })
      setTimeout(() => skipToNextVideo(adResult.type), 200)
    }
  }

  function detectAIContent(videoBody) {
    if (!videoBody) return false
    const videoId = getStableVideoId(videoBody)
    if (processedVideos.has(`skip_ai_${videoId}`)) return false
    const safetyBar = findOne('.safetyBar')
    if (safetyBar?.innerText.includes('AI')) {
      logger.debug('[AI检测] safetyBar.innerText:', safetyBar.innerText)
      return true
    }
    return false
  }

  function skipAi(videoBody) {
    const videoId = getStableVideoId(videoBody)
    const skipKey = `skip_ai_${videoId}`
    if (detectAIContent(videoBody)) {
      logger.debug('[AI检测] 检测到AI相关内容')
      processedVideos.add(skipKey)
      skipToNextVideo('AI生成内容')
    }
  }

  function checkNotInterestedKeywords(videoBody) {
    if (!videoBody) return null
    let tagList = []

    // 获取所有候选元素并过滤可视区域内的
    const allTagElements1 = [...videoBody.querySelectorAll('span>a>span')].filter((item) =>
      isElementInViewportAndVisible(item)
    )

    const tagElements1 = allTagElements1.filter(
      (item) => item.innerText && item.innerText.startsWith('#')
    )
    tagList.push(...tagElements1.map((it) => it.innerText))

    const allTagElements2 = [...videoBody.querySelectorAll('span>span>span>span>span>span')].filter(
      (item) => isElementInViewportAndVisible(item)
    )

    const tagElements2 = allTagElements2.filter(
      (item) => item.innerText && item.innerText.split('#').length > 1
    )
    tagList.push(...tagElements2.map((it) => it.innerText))

    tagList = [...new Set(tagList)]

    for (const tag of tagList) {
      for (const keyword of NOT_INTERESTED_KEYWORDS) {
        if (tag.includes(keyword)) {
          logger.debug(`[不感兴趣检测] 标签匹配: "${tag}" 包含 "${keyword}"`)
          return keyword
        }
      }
    }
    return null
  }

  function handleNotInterested(videoBody) {
    const videoId = getStableVideoId(videoBody)
    const skipKey = `not_interested_${videoId}`
    if (processedVideos.has(skipKey)) return

    const matchedKeyword = checkNotInterestedKeywords(videoBody)
    if (matchedKeyword) {
      logger.debug(`[不感兴趣] 匹配到关键词: "${matchedKeyword}"，准备下滑`)
      processedVideos.add(skipKey)
      skipToNextVideo(`不感兴趣: ${matchedKeyword}`)
    }
  }

  function isLiveStream(video) {
    if (!video) return false
    const text = video.innerText || ''
    return text.includes('点击或按\n进入直播间') || text.includes('上滑继续看视频')
  }

  function detectAndSkipLive() {
    const videoBody = findOne('.playerContainer')
    if (videoBody) return false // 有普通视频容器，不是直播

    const livePlayer = findOne('.douyin-player')
    if (!livePlayer) return false

    if (VideoStateManager.isLiveHandled(livePlayer)) return true // 已处理过

    if (isLiveStream(livePlayer)) {
      logger.debug('[直播检测] 检测到直播，准备跳过')
      VideoStateManager.setLiveHandled(livePlayer, true)

      // 确保执行下滑
      setTimeout(() => {
        clickNextButton()
      }, 100)

      return true
    }
    return false
  }

  function autoStar() {
    function hasNoStar() {
      return findPath(
        '<path fill-rule="evenodd" clip-rule="evenodd" d="M16 26.7319C22.6274 26.7319 28 21.3594 28 14.7319C28 8.10452 22.6274 2.73193 16 2.73193C9.37258 2.73193 4 8.10452 4 14.7319C4 21.3594 9.37258 26.7319 16 26.7319Z" fill="#FE2C55"></path>'
      )
    }

    // 只获取可视区内的标签元素
    const tagElements = [...document.querySelectorAll('span>a>span')]
      .filter((item) => isElementInViewportAndVisible(item))
      .filter((item) => item.innerText && item.innerText.startsWith('#'))
    const tagList = tagElements.map((it) => it.innerText)

    if (hasNoStar()) {
      for (const tag of tagList) {
        if (AUTO_FOLLOW_KEYWORDS.some((keyword) => tag.includes(keyword))) {
          logger.debug('[自动关注] 匹配到关键词:', tag)
          if (canExecuteAction('auto_follow', THROTTLE_CONFIG.FOLLOW)) {
            triggerKeyboardEvent('autoStar', 'keydown', { keyCode: 71, key: 'g', code: 'KeyG' })
          }
          break
        }
      }
    }
  }

  function autoOpenComment(videoBody) {
    // 检查评论区是否已打开
    const commentPanel = findOne('#videoSideCard') || findOne('[class*="comment"]')
    if (commentPanel && commentPanel.offsetWidth > 0) {
      return // 已打开
    }

    if (!canExecuteAction('open_comment', THROTTLE_CONFIG.OPEN_COMMENT)) {
      return
    }

    // 方法1: 点击评论按钮（使用新选择器）
    if (clickCommentButton()) {
      return
    }

    // 方法2: 触发键盘事件 'x' 打开评论区
    triggerKeyboardEvent('autoOpenComment', 'keydown', { keyCode: 88, key: 'x', code: 'KeyX' })
    logger.debug('[评论区] 触发键盘事件 x')
  }

  // ========== 评论区时间跳转 ==========
  function matchTimeStr(timeStr, offset) {
    const regex =
      /\b((?:(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)|(?:(?:[01]?\d|2[0-3]):[0-5]\d)|(?:[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM))\b/g
    for (const match of timeStr.matchAll(regex)) {
      if (offset >= match.index && offset < match.index + match[0].length) return match[0]
    }
    return null
  }

  function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number)
    return parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : 0
  }

  function setupCommentClickListener(container) {
    VideoStateManager.setCommentListener(container, true)
    container.addEventListener('click', (e) => {
      if (e.target.nodeName !== 'SPAN') return

      let offset
      if (document.caretPositionFromPoint) {
        offset = document.caretPositionFromPoint(e.clientX, e.clientY).offset
      } else if (document.caretRangeFromPoint) {
        offset = document.caretRangeFromPoint(e.clientX, e.clientY).startOffset
      } else {
        return
      }

      const match = matchTimeStr(e.target.innerText, offset)
      if (!match) return

      const currentTime = timeToSeconds(match)
      const video = findOne('video')
      if (video && video.duration >= currentTime) {
        logger.debug(`[时间跳转] 点击时间: ${match} (${currentTime}秒)`)
        video.currentTime = currentTime
      }
    })
    logger.debug('[时间跳转] 评论区时间跳转功能已启用')
  }

  function setVideoTime() {
    logger.debug('[时间跳转] 评论区监听已注册')
    return () =>
      setInterval(() => {
        const commentBody = findOne('#videoSideCard')
        if (commentBody && !VideoStateManager.hasCommentListener(commentBody)) {
          setupCommentClickListener(commentBody)
        }
      }, 500)
  }

  // ========== 主处理循环 ==========
  function processCurrentVideo() {
    const videoBody = findOne('.playerContainer')
    if (!videoBody) {
      // 没有普通视频容器，检查是否是直播
      if (detectAndSkipLive()) {
        return // 检测到直播并已触发跳过
      }
      return
    }

    const videoId = getStableVideoId(videoBody)

    // 检查导航方向 - 用户上滑返回时跳过自动处理
    // 这个检查优先级最高，不依赖 videoId 的稳定性
    if (lastNavigationDirection === 'up') {
      if (currentVideoId !== videoId) {
        currentVideoId = videoId
        logger.debug(`[手动导航] 检测到上滑方向，视频 ${videoId.substring(0, 8)} 跳过自动处理`)
      }
      return
    }

    // 下滑方向时，需要区分新视频和返回的视频
    if (lastNavigationDirection === 'down') {
      if (currentVideoId !== videoId) {
        // 检查是否是返回到之前的视频
        if (isManualNavigation(videoId)) {
          // 返回到之前的视频，记录该视频，不开启连播
          logger.debug(`[手动导航] 检测到下滑返回，视频 ${videoId.substring(0, 8)} 跳过自动处理`)
          currentVideoId = videoId
          updateVideoHistory(videoId)
          returnedVideosThisSession.add(videoId)
        } else {
          // 下滑到新视频，开启连播
          logger.debug(`[手动导航] 检测到下滑方向，新视频 ${videoId.substring(0, 8)} 开启连播`)
          currentVideoId = videoId
          setTimeout(() => enableAutoPlay(), 500)
        }
      }
      // 重置方向，避免后续误判
      lastNavigationDirection = null
      return
    }

    // 重置方向（兜底：方向已设置但未被上述分支处理的情况）
    lastNavigationDirection = null

    // 如果视频在本次会话中被用户返回过，跳过所有自动处理
    if (returnedVideosThisSession.has(videoId)) {
      if (currentVideoId !== videoId) {
        currentVideoId = videoId
        logger.debug(`[手动导航] 视频 ${videoId.substring(0, 8)} 已被返回过，跳过自动处理`)
      }
      return
    }

    if (currentVideoId === videoId) return

    // 判断是否是手动返回（在更新历史之前检查）
    const isGoingBack = isManualNavigation(videoId)

    // 视频切换处理
    if (currentVideoId !== null && currentVideoId !== videoId) {
      logger.debug(` 视频切换: ${currentVideoId.substring(0, 8)} -> ${videoId.substring(0, 8)}`)

      // 检测手动上滑返回
      if (isGoingBack) {
        logger.debug(
          `[手动导航] 检测到上滑返回 (历史位置: ${videoHistory.indexOf(videoId)}/${videoHistory.length - 1})，记录该视频`
        )
        VideoChangeChecker.cancelAll()
        currentVideoId = videoId
        updateVideoHistory(videoId)

        // 将该视频加入返回记录，本次会话不再自动处理
        returnedVideosThisSession.add(videoId)
        // 下滑回到之前的视频，开启连播
        setTimeout(() => enableAutoPlay(), 500)
        return
      }

      // 用户下滑到新视频（不在历史中），清空返回记录，恢复自动处理
      if (!videoHistory.includes(videoId)) {
        if (returnedVideosThisSession.size > 0) {
          logger.debug(
            `[手动导航] 检测到全新视频，清空返回记录 (${returnedVideosThisSession.size} 个)，恢复自动处理`
          )
          returnedVideosThisSession.clear()
        }
        // 下滑到新视频时，自动开启连播
        setTimeout(() => enableAutoPlay(), 500)
      }

      updateVideoHistory(videoId)
      // 只清理超出历史范围的视频记录（保留最近 VIDEO_HISTORY_SIZE 个视频的标记）
      cleanupOldVideoRecords()
    } else {
      updateVideoHistory(videoId)
    }
    currentVideoId = videoId

    // ========== 第二步：先检测视频类型 ==========
    const aiSkipKey = `skip_ai_${videoId}`
    const notInterestedKey = `not_interested_${videoId}`

    // 检测广告
    skipAD(videoBody)

    // 检测AI内容
    const isAI = detectAIContent(videoBody)
    if (isAI) {
      processedVideos.add(aiSkipKey)
      // 如果已经在 processedVideos 中，说明之前看过并跳过过，继续跳过
      logger.debug('[AI检测] 检测到AI相关内容，跳过')
      skipToNextVideo('AI生成内容')
      return
    }

    // 检测不感兴趣关键词
    const matchedKeyword = checkNotInterestedKeywords(videoBody)
    if (matchedKeyword) {
      processedVideos.add(notInterestedKey)
      logger.debug(`[不感兴趣] 匹配到关键词: "${matchedKeyword}"，跳过`)
      skipToNextVideo(`不感兴趣: ${matchedKeyword}`)
      return
    }

    // ========== 第三步：检查历史标记（用于已滑过的视频） ==========
    if (processedVideos.has(aiSkipKey)) {
      logger.debug(`[视频追踪] 已标记为AI视频，跳过: ${videoId.substring(0, 8)}`)
      skipToNextVideo('AI视频(已标记)')
      return
    }

    if (processedVideos.has(notInterestedKey)) {
      logger.debug(`[视频追踪] 已标记为不感兴趣，跳过: ${videoId.substring(0, 8)}`)
      skipToNextVideo('不感兴趣(已标记)')
      return
    }

    // ========== 第四步：其他自动操作 ==========
    autoStar()
    autoOpenComment(videoBody)
  }

  // 清理超出历史范围的视频记录
  function cleanupOldVideoRecords() {
    // 获取当前历史中的视频ID
    const activeVideoIds = new Set(videoHistory)

    // 找出需要清理的记录（不在历史中的视频）
    const keysToDelete = [...processedVideos].filter((key) => {
      // 提取视频ID: "skip_ai_xxx" 或 "not_interested_xxx"
      const videoId = key.split('_').slice(-1)[0]
      return !activeVideoIds.has(videoId)
    })

    if (keysToDelete.length > 0) {
      keysToDelete.forEach((key) => processedVideos.delete(key))
      logger.debug(`[清理] 移除了 ${keysToDelete.length} 条过期视频记录`)
    }
  }

  function loopFunc(fn) {
    logger.debug(' 视频容器监听已注册（心跳模式）')
    TimerManager.register(() => setInterval(fn, 1000))
    TimerManager.register(() => setInterval(() => logger.debug(` 状态运行中`), 30000))
  }

  // ========== 隐藏元素 ==========
  function updateHideElements(selectors) {
    if (typeof DOMUtils === 'undefined') {
      logger.warn('[抖音脚本] DOMUtils 未就绪，跳过隐藏元素更新')
      return
    }
    DOMUtils.removeStyle(STYLE_TAG_ID)
    currentSelectors = selectors?.length > 0 ? selectors : []
    if (currentSelectors.length > 0) {
      DOMUtils.applyHideStyle(STYLE_TAG_ID, currentSelectors)
      logger.debug(' 已隐藏元素:', currentSelectors)
    }
  }

  async function loadDomainHideSettings() {
    if (typeof DOMUtils === 'undefined') {
      logger.warn('[抖音脚本] DOMUtils 未就绪，跳过加载隐藏设置')
      return
    }
    const domain = DOMUtils.getCurrentDomain()
    const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain)

    if (settings?.enabled && settings.selectors?.length > 0) {
      // 合并默认选择器和用户选择器
      const mergedSelectors = [
        ...new Set([...DEFAULT_HIDE_SELECTORS, ...(settings.selectors || [])]),
      ]
      updateHideElements(mergedSelectors)
      logger.debug(' 已加载隐藏设置，合并后:', mergedSelectors.length, '个选择器')
    } else {
      // 使用默认选择器
      updateHideElements(DEFAULT_HIDE_SELECTORS)
      logger.debug(' 使用默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个')
    }
  }

  // ========== 初始化 ==========
  async function registerBlockedDomains() {
    // 增加超时时间到 10 秒，给 background 更多的初始化时间
    const TIMEOUT = 10000

    // 使用 ScriptLoader 等待 MessagingUtils 就绪
    if (window.ScriptLoader) {
      const ready = await ScriptLoader.waitFor(['MessagingUtils'], TIMEOUT)
      if (!ready) {
        logger.warn('[抖音脚本] MessagingUtils 等待超时，跳过注册域名（这是正常的，不影响功能）')
        return
      }
    } else if (
      !window.MessagingUtils ||
      typeof window.MessagingUtils.isExtensionContextValid !== 'function'
    ) {
      logger.warn('[抖音脚本] MessagingUtils 未就绪，跳过注册域名（这是正常的，不影响功能）')
      return
    }

    // 检查扩展上下文是否有效
    if (!MessagingUtils.isExtensionContextValid()) {
      logger.warn('[抖音脚本] 扩展上下文已失效，跳过注册域名')
      return
    }

    try {
      // 增加超时时间
      const result = await Promise.race([
        MessagingUtils.registerBlockedDomains('douyin.com', BLOCKED_DOMAINS),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT)),
      ])

      if (result?.success) {
        logger.debug(' 已向 background 注册 blockedDomains')
      } else {
        // 静默处理，不显示错误日志
        // logger.debug(' 注册域名结果:', result);
      }
    } catch (err) {
      // 静默处理错误，不影响主流程，不显示警告
      // console.warn('[抖音脚本] 注册域名跳过:', err.message);
    }
  }

  // 添加自定义样式
  function injectCustomStyles() {
    const styleId = 'douyin-custom-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `.video-info-detail.isVideoInfoOptimise>div:nth-child(1){ max-width:unset!important; }`
    document.head.appendChild(style)
  }

  // ========== 主初始化函数（由 ScriptLoader 调用）==========
  function init() {
    logger.debug(' init 函数被调用')
    if (window.DouyinScript.isInitialized) {
      logger.debug(' 已经初始化，跳过重复初始化')
      return
    }
    window.DouyinScript.isInitialized = true
    logger.debug(' 脚本初始化完成')

    injectCustomStyles()
    // 异步加载设置，错误时使用默认值
    loadDomainHideSettings().catch((err) => logger.error('加载设置失败:', err))
    registerBlockedDomains().catch((err) => logger.error('注册域名失败:', err))
    TimerManager.register(setVideoTime())
    loopFunc(processCurrentVideo)
    TimerManager.start()

    // 首次立即处理当前视频（等待 DOM 就绪）
    const startFirstVideo = () => {
      // 检查视频容器（普通视频）或直播播放器
      const videoBody = document.querySelector('.playerContainer')
      const livePlayer = document.querySelector('.douyin-player')

      if (videoBody || livePlayer) {
        logger.debug(' 检测到视频/直播容器，开始处理')
        processCurrentVideo()
      } else {
        // 使用 MutationObserver 等待容器出现
        logger.debug(' 等待视频/直播容器出现...')
        let timeoutId = null
        const observer = new MutationObserver((mutations, obs) => {
          const hasVideo = document.querySelector('.playerContainer')
          const hasLive = document.querySelector('.douyin-player')
          if (hasVideo || hasLive) {
            logger.debug(' 视频/直播容器已出现，开始处理')
            obs.disconnect()
            if (timeoutId) clearTimeout(timeoutId)
            processCurrentVideo()
          }
        })
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        })
        // 10秒后超时停止观察（定时器会持续处理，这里只是停止观察）
        timeoutId = setTimeout(() => {
          observer.disconnect()
          logger.debug(' 等待容器超时，依赖定时器继续处理')
        }, 10000)
      }
    }

    // 确保 DOM 就绪后执行
    if (document.body) {
      startFirstVideo()
    } else {
      document.addEventListener('DOMContentLoaded', startFirstVideo)
    }

    // 监听用户上滑操作，取消自动下滑检测
    document.addEventListener('keydown', (e) => {
      // 跳过脚本自动触发的键盘事件，仅响应用户操作
      if (isAutoTriggered) return
      if (e.key === 'ArrowUp' || e.keyCode === 38) {
        logger.debug('[用户操作] 检测到键盘上滑，取消所有自动下滑检测')
        lastNavigationDirection = 'up'
        VideoChangeChecker.cancelAll()
        disableAutoPlay()
      }
      // 用户手动下滑也取消检测（表示用户接管控制）
      if (e.key === 'ArrowDown' || e.keyCode === 40) {
        logger.debug('[用户操作] 检测到键盘下滑，取消自动下滑检测')
        lastNavigationDirection = 'down'
        VideoChangeChecker.cancelAll()
      }
    })

    // 触摸上滑检测（移动端）- 使用捕获阶段确保能捕获到事件
    // 使用 Map 跟踪每个触摸点，避免快速连续滑动时数据覆盖
    const touchTracker = new Map()
    document.addEventListener(
      'touchstart',
      (e) => {
        // 记录每个触摸点的起始位置和时间
        for (const touch of e.changedTouches) {
          touchTracker.set(touch.identifier, {
            startY: touch.clientY,
            startTime: Date.now(),
          })
        }
      },
      { passive: true, capture: true }
    )
    document.addEventListener(
      'touchend',
      (e) => {
        for (const touch of e.changedTouches) {
          const tracker = touchTracker.get(touch.identifier)
          if (!tracker) continue

          const touchEndY = touch.clientY
          const deltaY = touchEndY - tracker.startY
          const deltaTime = Date.now() - tracker.startTime
          // 降低阈值到 30px，并检测快速滑动（速度判断）
          const velocity = deltaTime > 0 ? Math.abs(deltaY) / deltaTime : 0 // px/ms
          // 上滑检测（deltaY > 0 表示手指向上滑动，页面向下滚动）
          if (deltaY > 30 || (deltaY > 10 && velocity > 0.3)) {
            logger.debug(
              `[用户操作] 检测到触摸上滑 (deltaY=${deltaY.toFixed(1)}px, velocity=${velocity.toFixed(2)}px/ms)`
            )
            lastNavigationDirection = 'up'
            VideoChangeChecker.cancelAll()
            disableAutoPlay()
          }
          // 下滑检测（用户主动操作）
          if (deltaY < -30 || (deltaY < -10 && velocity > 0.3)) {
            logger.debug(`[用户操作] 检测到触摸下滑 (deltaY=${deltaY.toFixed(1)}px)`)
            lastNavigationDirection = 'down'
            VideoChangeChecker.cancelAll()
          }
          // 清理已结束的触摸点
          touchTracker.delete(touch.identifier)
        }
      },
      { passive: true, capture: true }
    )
    // 触摸取消时也要清理
    document.addEventListener(
      'touchcancel',
      (e) => {
        for (const touch of e.changedTouches) {
          touchTracker.delete(touch.identifier)
        }
      },
      { passive: true, capture: true }
    )

    // 鼠标滚轮上滑检测（桌面端）
    let wheelTimeout = null
    let wheelDeltaY = 0
    document.addEventListener(
      'wheel',
      (e) => {
        // deltaY < 0 表示向上滚动（上滑返回）
        if (e.deltaY < 0) {
          wheelDeltaY += Math.abs(e.deltaY)
          // 累积滚动量检测
          if (wheelTimeout) clearTimeout(wheelTimeout)
          wheelTimeout = setTimeout(() => {
            if (wheelDeltaY > 50) {
              logger.debug(
                `[用户操作] 检测到滚轮上滑 (累积=${wheelDeltaY.toFixed(1)}px)，取消所有自动下滑检测`
              )
              lastNavigationDirection = 'up'
              VideoChangeChecker.cancelAll()
              disableAutoPlay()
            }
            wheelDeltaY = 0
          }, 100)
        }
        // deltaY > 0 表示向下滚动（手动下滑）
        if (e.deltaY > 0) {
          wheelDeltaY -= e.deltaY
          if (wheelTimeout) clearTimeout(wheelTimeout)
          wheelTimeout = setTimeout(() => {
            if (wheelDeltaY < -50) {
              logger.debug(
                `[用户操作] 检测到滚轮下滑 (累积=${Math.abs(wheelDeltaY).toFixed(1)}px)，取消自动下滑检测`
              )
              lastNavigationDirection = 'down'
              VideoChangeChecker.cancelAll()
            }
            wheelDeltaY = 0
          }, 100)
        }
      },
      { passive: true, capture: true }
    )

    visibilityChangeHandler = () => {
      if (document.hidden) {
        TimerManager.clearAll()
        VideoChangeChecker.cancelAll()
      } else {
        TimerManager.restart()
      }
    }
    beforeUnloadHandler = () => {
      TimerManager.clearAll()
      VideoChangeChecker.cancelAll()
    }

    document.addEventListener('visibilitychange', visibilityChangeHandler)
    window.addEventListener('beforeunload', beforeUnloadHandler)

    // 标记 content script 已就绪
    if (window.ContentBridge) {
      ContentBridge.markReady()
    }
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // ========== 导出配置 ==========
  window.DouyinScriptConfig = {
    NOT_INTERESTED_KEYWORDS,
    AUTO_FOLLOW_KEYWORDS,
    AD_SVG_PATHS,
    AI_KEYWORDS,
    THROTTLE_CONFIG,
    DEFAULT_HIDE_SELECTORS,
    BLOCKED_DOMAINS,
  }

  // ========== 消息处理 ==========
  MessagingUtils.createMessageHandler('douyin_message_handler', {
    UPDATE_KEYWORDS: (message) => {
      const { keywords } = message
      if (keywords.NOT_INTERESTED_KEYWORDS) {
        NOT_INTERESTED_KEYWORDS.length = 0
        NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)])
        logger.debug(' 不感兴趣关键词已更新:', NOT_INTERESTED_KEYWORDS)
        const videoBody = findOne('.playerContainer')
        if (videoBody) {
          processedVideos.delete(`not_interested_${getStableVideoId(videoBody)}`)
          setTimeout(() => handleNotInterested(videoBody), 100)
        }
      }
      if (keywords.AUTO_FOLLOW_KEYWORDS) {
        AUTO_FOLLOW_KEYWORDS.length = 0
        AUTO_FOLLOW_KEYWORDS.push(...[...new Set(keywords.AUTO_FOLLOW_KEYWORDS)])
        logger.debug(' 自动关注关键词已更新:', AUTO_FOLLOW_KEYWORDS)
      }
      return { success: true, message: '关键词已更新' }
    },

    TOGGLE_EXTENSION: (message) => {
      logger.debug(' 扩展状态:', message.enabled ? '启用' : '禁用')
      return { success: true }
    },

    GET_DEFAULT_HIDE_SELECTORS: () => {
      logger.debug(' === GET_DEFAULT_HIDE_SELECTORS 消息接收 ===')
      logger.debug(' DEFAULT_HIDE_SELECTORS 类型:', typeof DEFAULT_HIDE_SELECTORS)
      logger.debug(' DEFAULT_HIDE_SELECTORS 值:', DEFAULT_HIDE_SELECTORS)
      logger.debug(
        ' DEFAULT_HIDE_SELECTORS 长度:',
        DEFAULT_HIDE_SELECTORS ? DEFAULT_HIDE_SELECTORS.length : 'N/A'
      )
      const result = { success: true, selectors: DEFAULT_HIDE_SELECTORS || [] }
      logger.debug(' 返回结果:', result)
      return result
    },
    GET_CURRENT_HIDE_SELECTORS: () => {
      logger.debug(' === GET_CURRENT_HIDE_SELECTORS 消息接收 ===')
      logger.debug(' currentSelectors:', currentSelectors)
      return { success: true, selectors: currentSelectors || [] }
    },

    UPDATE_HIDE_ELEMENTS: (message) => {
      const { enabled, selectors } = message
      if (enabled && selectors?.length > 0) {
        updateHideElements(selectors)
      } else {
        if (typeof DOMUtils !== 'undefined') {
          DOMUtils.removeStyle(STYLE_TAG_ID)
        }
      }
      return { success: true }
    },
  })

  // ========== 使用 ScriptLoader 声明依赖（放在文件末尾，确保所有变量已定义）==========
  if (window.ScriptLoader) {
    ScriptLoader.declare({
      name: 'douyin-script',
      dependencies: ['EventBus', 'MessagingUtils', 'DOMUtils'],
      onReady: initDouyinScript,
    })
  } else {
    // 降级：直接初始化（兼容旧环境）
    initDouyinScriptLegacy()
  }
})()
