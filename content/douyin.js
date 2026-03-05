/**
 * 抖音自动化脚本
 * 功能：自动展开评论、跳过广告、跳过AI视频、不感兴趣关键词过滤
 * 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
 */

(function () {
  'use strict';

  // ========== 防止重复加载 ==========
  if (window.DouyinScript && window.DouyinScript.isInitialized) {
    console.log('[抖音脚本] 已加载，跳过重复初始化');
    return;
  }
  if (!window.DouyinScript) {
    window.DouyinScript = { isInitialized: false };
  }

  // ========== 配置 ==========
  const STYLE_TAG_ID = 'douyin-content-hide-style';
  let currentSelectors = [];

const DEFAULT_HIDE_SELECTORS = ['.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
  '.ooIf2jbM', '._e7lJDCC', '#island_076c3', '.ai-note-container', '.cursorPointer+*', 'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])', '.danmakuContainer', '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)'
];

const BLOCKED_DOMAINS = [
  'mcs.zijieapi.com/list',
  'vc-gate-edge.ndcpp.com/sdk/get_peer',
  'security.zijieapi.com/api/metrics/emit',
  'tnc0-aliec2.zijieapi.com/get_domains'
];

const NOT_INTERESTED_KEYWORDS = [
  "抽象", "漫画", "国漫", "修仙", "玄幻", "系统", "动画", "动漫", "小说",
  "黑神话", "解说", "好剧", "儿童", "孩子", "观影", "案件", "国学",
  "狗", "猫", "宠物", "娃", "王者荣耀", "射手", "对抗路", "中单", "上单",
  "打野", "巅峰赛", "游戏日常", "综艺", "游戏", "美食", "测评", "小品",
  "春晚", "相亲", "恋爱", "情侣日常", "国服", "驾照", "考试", "结婚",
  "率土之滨", "程序员", "前端", "动物", "电商", "追剧", "军旅", "短剧",
  "恐怖", "影视", "电影", "司机", "工地", "情侣", "原生家庭", "影娱",
  "好片", "亲子", "幼儿园", "育儿", "育婴", "宝宝", "母婴", "妈妈",
  "父母", "爸妈", "早教", "幼教", "学前", "音乐", "热歌", "健身",
  "分手", "股票", "情感", "驾驶", "街头", "手势"
];

const AUTO_FOLLOW_KEYWORDS = ['ootd'];

const AD_SVG_PATHS = [
  '<path d="M9.492 2.004L8.22 2.22c.216.336.408.72.588 1.128h-4.38v3.636c-.024 2.34-.348 4.176-.972 5.496l.96.852c.744-1.596 1.128-3.708 1.164-6.348V4.452h8.796V3.348h-4.308a16.717 16.717 0 0 0-.576-1.344zm15.564 6.672h-8.04v4.548h1.152v-.576h5.736v.576h1.152V8.676zm-6.888 2.904V9.756h5.736v1.824h-5.736zm-.276-6.732h2.688v1.656h-5.04V7.62h10.92V6.504h-4.74V4.848h3.828V3.756H21.72V2.148h-1.14v1.608h-2.016c.204-.408.372-.852.516-1.32l-1.128-.144c-.384 1.248-1.104 2.292-2.16 3.144l.684.9a8.301 8.301 0 0 0 1.416-1.488z" fill="#fff" fill-opacity=".5"></path>',
];

const AI_KEYWORDS = ['AI'];

const THROTTLE_CONFIG = {
  SKIP_VIDEO: 400,
  OPEN_COMMENT: 600,
  FOLLOW: 500
};

// ========== 状态管理 ==========
let processedVideos = new Set();
let lastActionTime = {};
let videoHistory = [];
const VIDEO_HISTORY_SIZE = 5;
let currentVideoId = null;
let visibilityChangeHandler = null;
let beforeUnloadHandler = null;

// ========== 视频状态管理器 (WeakMap) ==========
const VideoStateManager = {
  uuid: new WeakMap(),
  liveHandled: new WeakMap(),
  skipAd: new WeakMap(),
  commentListener: new WeakMap(),

  setUUID(video, uuid) { this.uuid.set(video, uuid); },
  getUUID(video) {
    if (!video) return generateUUID();
    if (!this.uuid.has(video)) this.uuid.set(video, generateUUID());
    return this.uuid.get(video);
  },
  setLiveHandled(video, value) { value ? this.liveHandled.set(video, true) : this.liveHandled.delete(video); },
  isLiveHandled(video) { return this.liveHandled.has(video); },
  setSkipAd(video, value) { value ? this.skipAd.set(video, true) : this.skipAd.delete(video); },
  isSkipAd(video) { return this.skipAd.has(video); },
  setCommentListener(element, value) { value ? this.commentListener.set(element, true) : this.commentListener.delete(element); },
  hasCommentListener(element) { return this.commentListener.has(element); },
  clear(video) {
    this.uuid.delete(video);
    this.liveHandled.delete(video);
    this.skipAd.delete(video);
    this.commentListener.delete(video);
  }
};

// ========== 定时器管理器 ==========
const TimerManager = {
  timers: [],
  factories: [],
  isRunning: false,

  add(timerId) { this.timers.push(timerId); },
  register(factory) { this.factories.push(factory); },
  clearAll() {
    this.timers.forEach(id => clearInterval(id));
    this.timers = [];
    this.isRunning = false;
    console.log('[定时器管理] 所有定时器已清除');
  },
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.factories.forEach(factory => {
      const timerId = factory();
      if (timerId !== undefined) this.add(timerId);
    });
  },
  restart() { this.clearAll(); this.start(); }
};

// ========== 视频变化检测器 ==========
const VideoChangeChecker = {
  activeChecks: new Map(),

  start(expectedVideoId, reason) {
    this.cancel(expectedVideoId);
    const CHECK_INTERVAL = 2000;
    const MAX_CHECKS = 3;
    let checkCount = 0;

    const checkVideo = () => {
      checkCount++;
      const currentVideoBody = findOne('.playerContainer');
      const currentId = currentVideoBody ? getVideoUUID(currentVideoBody) : null;

      // 视频已切换、是直播、是广告时，取消检测
      if (currentId !== expectedVideoId || VideoStateManager.isLiveHandled(currentVideoBody) || VideoStateManager.isSkipAd(currentVideoBody)) {
        this.cancel(expectedVideoId);
        return;
      }

      if (checkCount >= MAX_CHECKS) {
        console.log(`[二次检测] 视频${checkCount}次检查未切换，强制再次下滑`);
        this.cancel(expectedVideoId);
        if (canExecuteAction('skip_video_retry', THROTTLE_CONFIG.SKIP_VIDEO)) {
          triggerKeyboardEvent("skip_video_retry", "keydown", { keyCode: 40, key: "ArrowDown", code: "ArrowDown" });
          this.start(currentId, reason);
        }
        return;
      }
      console.log(`[二次检测] 第${checkCount}次检查，视频未切换，等待...`);
    };

    const timerId = setTimeout(() => {
      checkVideo();
      const intervalId = setInterval(checkVideo, CHECK_INTERVAL);
      this.activeChecks.set(expectedVideoId, { intervalId, timeoutId: null });
    }, 1000);
    this.activeChecks.set(expectedVideoId, { intervalId: null, timeoutId: timerId });
  },

  cancel(videoId) {
    const check = this.activeChecks.get(videoId);
    if (check) {
      if (check.intervalId) clearInterval(check.intervalId);
      if (check.timeoutId) clearTimeout(check.timeoutId);
      this.activeChecks.delete(videoId);
    }
  },

  cancelAll() {
    this.activeChecks.forEach(check => {
      if (check.intervalId) clearInterval(check.intervalId);
      if (check.timeoutId) clearTimeout(check.timeoutId);
    });
    this.activeChecks.clear();
    console.log(`[二次检测] 所有检测任务已取消`);
  }
};

// ========== 工具函数 ==========
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getVideoUUID(videoBody) { return VideoStateManager.getUUID(videoBody); }

// 使用 DOMUtils.findOneInViewport 替代本地实现
function findOne(selector) {
  return DOMUtils.findOneInViewport(selector, { checkVisibility: true, checkDimensions: true });
}

function findPath(pathStr) {
  return DOMUtils.findAllInViewport('path', { checkVisibility: true, checkDimensions: true })
    .find(it => it.outerHTML === pathStr);
}

function canExecuteAction(actionId, delay) {
  const now = Date.now();
  if (now - (lastActionTime[actionId] || 0) >= delay) {
    lastActionTime[actionId] = now;
    return true;
  }
  return false;
}

function debounceById(fn, delay = 400) {
  const timerMap = new Map();
  return (id, ...args) => {
    const hasTimer = timerMap.has(id);
    if (hasTimer) clearTimeout(timerMap.get(id));
    if (!id || args.length !== 2) return;
    if (!hasTimer) fn.apply(this, args);
    const timer = setTimeout(() => timerMap.delete(id), delay);
    timerMap.set(id, timer);
  };
}

const triggerKeyboardEvent = debounceById(function (eventType, eventData) {
  document.dispatchEvent(new KeyboardEvent(eventType, eventData));
}, 400);

function isManualNavigation(videoId) {
  const index = videoHistory.indexOf(videoId);
  return index !== -1 && index < videoHistory.length - 1;
}

function updateVideoHistory(videoId) {
  if (videoHistory.length > 0 && videoHistory[videoHistory.length - 1] === videoId) return;
  videoHistory.push(videoId);
  if (videoHistory.length > VIDEO_HISTORY_SIZE) videoHistory.shift();
}

function clearProcessedVideo(videoId) {
  if (!videoId) return;
  const keysToDelete = [...processedVideos].filter(key => key.endsWith(`_${videoId}`));
  keysToDelete.forEach(key => processedVideos.delete(key));
  if (keysToDelete.length > 0) console.log(`[清理] 移除已离开视频的处理记录`);
}

// ========== 核心功能 ==========
function skipToNextVideo(reason) {
  if (!canExecuteAction('skip_video', THROTTLE_CONFIG.SKIP_VIDEO)) return;
  const currentVideoBody = findOne('.playerContainer');
  const currentId = currentVideoBody ? getVideoUUID(currentVideoBody) : null;
  console.log(`[自动下滑] 原因: ${reason}`);
  triggerKeyboardEvent("skip_video", "keydown", { keyCode: 40, key: "ArrowDown", code: "ArrowDown" });
  if (currentId) VideoChangeChecker.start(currentId, reason);
}

function isElementInViewportAndVisible(element) {
  return DOMUtils.isElementInViewport(element, { checkVisibility: true, checkDimensions: true });
}

function detectAdSvg() {
  const visiblePaths = [...document.querySelectorAll('path')].filter(item => isElementInViewportAndVisible(item));
  return AD_SVG_PATHS.some(adPath => visiblePaths.some(it => it.outerHTML === adPath));
}

function skipAD(videoBody) {
  if (videoBody && VideoStateManager.isSkipAd(videoBody)) return;
  if (detectAdSvg()) {
    console.log('[广告检测] 检测到广告标识');
    if (videoBody) VideoStateManager.setSkipAd(videoBody, true);
    triggerKeyboardEvent("skipAD_mark", "keydown", { keyCode: 82, key: "r", code: "KeyR" });
    setTimeout(() => skipToNextVideo('广告视频'), 200);
  }
}

function detectAIContent(videoBody) {
  if (!videoBody) return false;
  const videoId = getVideoUUID(videoBody);
  if (processedVideos.has(`skip_ai_${videoId}`)) return false;
  const safetyBar = findOne('.safetyBar');
  if (safetyBar?.innerText.includes('AI')) {
    console.log('[AI检测] safetyBar.innerText:', safetyBar.innerText);
    return true;
  }
  return false;
}

function skipAi(videoBody) {
  const videoId = getVideoUUID(videoBody);
  const skipKey = `skip_ai_${videoId}`;
  if (detectAIContent(videoBody)) {
    console.log('[AI检测] 检测到AI相关内容');
    processedVideos.add(skipKey);
    skipToNextVideo('AI生成内容');
  }
}

function checkNotInterestedKeywords(videoBody) {
  if (!videoBody) return null;
  let tagList = [];

  // 获取所有候选元素并过滤可视区域内的
  const allTagElements1 = [...videoBody.querySelectorAll('span>a>span')]
    .filter(item => isElementInViewportAndVisible(item));

  const tagElements1 = allTagElements1.filter(item => item.innerText && item.innerText.startsWith('#'));
  tagList.push(...tagElements1.map(it => it.innerText));

  const allTagElements2 = [...videoBody.querySelectorAll('span>span>span>span>span>span')]
    .filter(item => isElementInViewportAndVisible(item));

  const tagElements2 = allTagElements2.filter(item => item.innerText && item.innerText.split('#').length > 1);
  tagList.push(...tagElements2.map(it => it.innerText));

  tagList = [...new Set(tagList)];

  for (const tag of tagList) {
    for (const keyword of NOT_INTERESTED_KEYWORDS) {
      if (tag.includes(keyword)) {
        console.log(`[不感兴趣检测] 标签匹配: "${tag}" 包含 "${keyword}"`);
        return keyword;
      }
    }
  }
  return null;
}

function handleNotInterested(videoBody) {
  const videoId = getVideoUUID(videoBody);
  const skipKey = `not_interested_${videoId}`;
  if (processedVideos.has(skipKey)) return;

  const matchedKeyword = checkNotInterestedKeywords(videoBody);
  if (matchedKeyword) {
    console.log(`[不感兴趣] 匹配到关键词: "${matchedKeyword}"，准备下滑`);
    processedVideos.add(skipKey);
    skipToNextVideo(`不感兴趣: ${matchedKeyword}`);
  }
}

function isVideoing(video) {
  const text = video.innerText;
  return text.includes('点击或按\n进入直播间') || text.includes('上滑继续看视频');
}

function autoSkip(videoBody) {
  if (videoBody) return;
  const video = findOne('.douyin-player');
  if (!video || VideoStateManager.isLiveHandled(video)) return;
  if (isVideoing(video)) {
    console.log('[直播检测] 检测到直播，准备跳过');
    VideoStateManager.setLiveHandled(video, true);
    skipToNextVideo('检测到直播');
  }
}

function autoStar() {
  function hasNoStar() {
    return findPath('<path fill-rule="evenodd" clip-rule="evenodd" d="M16 26.7319C22.6274 26.7319 28 21.3594 28 14.7319C28 8.10452 22.6274 2.73193 16 2.73193C9.37258 2.73193 4 8.10452 4 14.7319C4 21.3594 9.37258 26.7319 16 26.7319Z" fill="#FE2C55"></path>');
  }

  // 只获取可视区内的标签元素
  const tagElements = [...document.querySelectorAll('span>a>span')]
    .filter(item => isElementInViewportAndVisible(item))
    .filter(item => item.innerText && item.innerText.startsWith('#'));
  const tagList = tagElements.map(it => it.innerText);

  if (hasNoStar()) {
    for (const tag of tagList) {
      if (AUTO_FOLLOW_KEYWORDS.some(keyword => tag.includes(keyword))) {
        console.log('[自动关注] 匹配到关键词:', tag);
        if (canExecuteAction('auto_follow', THROTTLE_CONFIG.FOLLOW)) {
          triggerKeyboardEvent("autoStar", "keydown", { keyCode: 71, key: "g", code: "KeyG" });
        }
        break;
      }
    }
  }
}

function autoOpenComment(videoBody) {
  // 检查评论区是否已打开
  const commentPanel = findOne('#videoSideCard') || findOne('[class*="comment"]');
  if (commentPanel && commentPanel.offsetWidth > 0) {
    return; // 已打开
  }

  if (!canExecuteAction('open_comment', THROTTLE_CONFIG.OPEN_COMMENT)) {
    return;
  }

  // 方法1: 通过 SVG 路径签名查找评论按钮
  const signature = "M-4.644999980926514,4.482999801635742";
  const visiblePaths = DOMUtils.findAllInViewport('path', { checkVisibility: true, checkDimensions: true });

  for (const path of visiblePaths) {
    const d = path.getAttribute('d') || '';
    if (d.includes(signature)) {
      const button = path.closest('button') || path.closest('div[role="button"]');
      if (button && isElementInViewportAndVisible(button)) {
        button.click();
        console.log('[评论区] 通过SVG签名找到并点击评论按钮');
        return;
      }
    }
  }

  // 方法2: 查找包含"评论"文字的按钮
  const possibleSelectors = [
    'xg-icon[class*="comment"]',
    '[class*="right-grid"] xg-icon',
    'button[aria-label*="评论"]',
    'button[aria-label*="Comment"]'
  ];

  for (const sel of possibleSelectors) {
    try {
      const elements = DOMUtils.findAllInViewport(sel, { checkVisibility: true, checkDimensions: true });
      for (const el of elements) {
        const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        if (ariaLabel.includes('评论') || ariaLabel.includes('Comment')) {
          el.click();
          console.log('[评论区] 通过选择器找到并点击:', sel);
          return;
        }
      }
    } catch (e) {}
  }

  // 方法3: 查找右侧栏所有图标按钮（通常第3个是评论）
  const rightBarButtons = DOMUtils.findAllInViewport('.xg-right-grid xg-icon, [class*="right"] xg-icon', { checkVisibility: true, checkDimensions: true });
  if (rightBarButtons.length >= 3) {
    rightBarButtons[2].click();
    console.log('[评论区] 通过右侧栏位置找到并点击（第3个按钮）');
    return;
  }
}

// ========== 评论区时间跳转 ==========
function matchTimeStr(timeStr, offset) {
  const regex = /\b((?:(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)|(?:(?:[01]?\d|2[0-3]):[0-5]\d)|(?:[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM))\b/g;
  for (const match of timeStr.matchAll(regex)) {
    if (offset >= match.index && offset < match.index + match[0].length) return match[0];
  }
  return null;
}

function timeToSeconds(timeStr) {
  const parts = timeStr.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
}

function setupCommentClickListener(container) {
  VideoStateManager.setCommentListener(container, true);
  container.addEventListener('click', (e) => {
    if (e.target.nodeName !== 'SPAN') return;

    let offset;
    if (document.caretPositionFromPoint) {
      offset = document.caretPositionFromPoint(e.clientX, e.clientY).offset;
    } else if (document.caretRangeFromPoint) {
      offset = document.caretRangeFromPoint(e.clientX, e.clientY).startOffset;
    } else {
      return;
    }

    const match = matchTimeStr(e.target.innerText, offset);
    if (!match) return;

    const currentTime = timeToSeconds(match);
    const video = findOne('video');
    if (video && video.duration >= currentTime) {
      console.log(`[时间跳转] 点击时间: ${match} (${currentTime}秒)`);
      video.currentTime = currentTime;
    }
  });
  console.log('[时间跳转] 评论区时间跳转功能已启用');
}

function setVideoTime() {
  console.log('[时间跳转] 评论区监听已注册');
  return () => setInterval(() => {
    const commentBody = findOne('#videoSideCard');
    if (commentBody && !VideoStateManager.hasCommentListener(commentBody)) {
      setupCommentClickListener(commentBody);
    }
  }, 500);
}

// ========== 主处理循环 ==========
function processCurrentVideo() {
  const videoBody = findOne('.playerContainer');

  // 直播检测：只有在没有普通视频容器时才检查直播
  autoSkip(videoBody);

  if (!videoBody) return;

  const videoId = getVideoUUID(videoBody);
  if (currentVideoId === videoId) return;

  if (currentVideoId !== null && currentVideoId !== videoId) {
    console.log(`[抖音脚本] 视频切换`);
    updateVideoHistory(videoId);
    if (isManualNavigation(videoId)) {
      console.log(`[手动导航] 检测到手动上滑返回，暂停自动处理`);
      VideoChangeChecker.cancelAll();
      currentVideoId = videoId;
      return;
    }
    clearProcessedVideo(currentVideoId);
  } else {
    updateVideoHistory(videoId);
  }
  currentVideoId = videoId;

  skipAD(videoBody);
  skipAi(videoBody);
  handleNotInterested(videoBody);
  autoStar();
  autoOpenComment(videoBody);
}

function loopFunc(fn) {
  console.log('[抖音脚本] 视频容器监听已注册（心跳模式）');
  TimerManager.register(() => setInterval(fn, 1000));
  TimerManager.register(() => setInterval(() => console.log(`[抖音脚本] 状态运行中`), 30000));
}

// ========== 隐藏元素 ==========
function updateHideElements(selectors) {
  DOMUtils.removeStyle(STYLE_TAG_ID);
  currentSelectors = selectors?.length > 0 ? selectors : [];
  if (currentSelectors.length > 0) {
    DOMUtils.applyHideStyle(STYLE_TAG_ID, currentSelectors);
    console.log('[抖音脚本] 已隐藏元素:', currentSelectors);
  }
}

async function loadDomainHideSettings() {
  const domain = DOMUtils.getCurrentDomain();
  const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

  if (settings?.enabled && settings.selectors?.length > 0) {
    // 合并默认选择器和用户选择器
    const mergedSelectors = [...new Set([...DEFAULT_HIDE_SELECTORS, ...(settings.selectors || [])])];
    updateHideElements(mergedSelectors);
    console.log('[抖音脚本] 已加载隐藏设置，合并后:', mergedSelectors.length, '个选择器');
  } else {
    // 使用默认选择器
    updateHideElements(DEFAULT_HIDE_SELECTORS);
    console.log('[抖音脚本] 使用默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个');
  }
}

// ========== 初始化 ==========
async function registerBlockedDomains() {
  const result = await MessagingUtils.registerBlockedDomains('douyin.com', BLOCKED_DOMAINS);
  if (result?.success) console.log('[抖音脚本] 已向 background 注册 blockedDomains');
}

// 添加自定义样式
function injectCustomStyles() {
  const styleId = 'douyin-custom-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.video-info-detail.isVideoInfoOptimise>div:nth-child(1){ max-width:unset!important; }`;
  document.head.appendChild(style);
}

function init() {
  if (window.DouyinScript.isInitialized) {
    console.log('[抖音脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.DouyinScript.isInitialized = true;

  injectCustomStyles();
  // 异步加载设置，错误时使用默认值
  loadDomainHideSettings().catch(err => console.error('[抖音脚本] 加载设置失败:', err));
  registerBlockedDomains().catch(err => console.error('[抖音脚本] 注册域名失败:', err));
  TimerManager.register(setVideoTime());
  loopFunc(processCurrentVideo);
  TimerManager.start();

  // 首次立即处理当前视频（等待 DOM 就绪）
  const startFirstVideo = () => {
    // 检查视频容器（普通视频）或直播播放器
    const videoBody = document.querySelector('.playerContainer');
    const livePlayer = document.querySelector('.douyin-player');

    if (videoBody || livePlayer) {
      console.log('[抖音脚本] 检测到视频/直播容器，开始处理');
      processCurrentVideo();
    } else {
      // 使用 MutationObserver 等待容器出现
      console.log('[抖音脚本] 等待视频/直播容器出现...');
      let timeoutId = null;
      const observer = new MutationObserver((mutations, obs) => {
        const hasVideo = document.querySelector('.playerContainer');
        const hasLive = document.querySelector('.douyin-player');
        if (hasVideo || hasLive) {
          console.log('[抖音脚本] 视频/直播容器已出现，开始处理');
          obs.disconnect();
          if (timeoutId) clearTimeout(timeoutId);
          processCurrentVideo();
        }
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      // 10秒后超时停止观察（定时器会持续处理，这里只是停止观察）
      timeoutId = setTimeout(() => {
        observer.disconnect();
        console.log('[抖音脚本] 等待容器超时，依赖定时器继续处理');
      }, 10000);
    }
  };

  // 确保 DOM 就绪后执行
  if (document.body) {
    startFirstVideo();
  } else {
    document.addEventListener('DOMContentLoaded', startFirstVideo);
  }

  // 监听用户上滑操作，取消自动下滑检测
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.keyCode === 38) {
      console.log('[用户操作] 检测到上滑，取消所有自动下滑检测');
      VideoChangeChecker.cancelAll();
    }
  });

  // 触摸上滑检测（移动端）
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    if (touchEndY - touchStartY > 50) {  // 上滑距离超过 50px
      console.log('[用户操作] 检测到触摸上滑，取消所有自动下滑检测');
      VideoChangeChecker.cancelAll();
    }
  }, { passive: true });

  visibilityChangeHandler = () => {
    if (document.hidden) {
      TimerManager.clearAll();
      VideoChangeChecker.cancelAll();
    } else {
      TimerManager.restart();
    }
  };
  beforeUnloadHandler = () => {
    TimerManager.clearAll();
    VideoChangeChecker.cancelAll();
  };

  document.addEventListener('visibilitychange', visibilityChangeHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

// ========== 启动 ==========
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ========== 导出配置 ==========
window.DouyinScriptConfig = {
  NOT_INTERESTED_KEYWORDS,
  AUTO_FOLLOW_KEYWORDS,
  AD_SVG_PATHS,
  AI_KEYWORDS,
  THROTTLE_CONFIG,
  DEFAULT_HIDE_SELECTORS,
  BLOCKED_DOMAINS
};

// ========== 消息处理 ==========
MessagingUtils.createMessageHandler('douyin_message_handler', {
  'UPDATE_KEYWORDS': (message) => {
    const { keywords } = message;
    if (keywords.NOT_INTERESTED_KEYWORDS) {
      NOT_INTERESTED_KEYWORDS.length = 0;
      NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)]);
      console.log('[抖音脚本] 不感兴趣关键词已更新:', NOT_INTERESTED_KEYWORDS);
      const videoBody = findOne('.playerContainer');
      if (videoBody) {
        processedVideos.delete(`not_interested_${getVideoUUID(videoBody)}`);
        setTimeout(() => handleNotInterested(videoBody), 100);
      }
    }
    if (keywords.AUTO_FOLLOW_KEYWORDS) {
      AUTO_FOLLOW_KEYWORDS.length = 0;
      AUTO_FOLLOW_KEYWORDS.push(...[...new Set(keywords.AUTO_FOLLOW_KEYWORDS)]);
      console.log('[抖音脚本] 自动关注关键词已更新:', AUTO_FOLLOW_KEYWORDS);
    }
    return { success: true, message: '关键词已更新' };
  },

  'TOGGLE_EXTENSION': (message) => {
    console.log('[抖音脚本] 扩展状态:', message.enabled ? '启用' : '禁用');
    return { success: true };
  },

  'GET_DEFAULT_HIDE_SELECTORS': () => ({ success: true, selectors: DEFAULT_HIDE_SELECTORS }),
  'GET_CURRENT_HIDE_SELECTORS': () => ({ success: true, selectors: currentSelectors }),

  'UPDATE_HIDE_ELEMENTS': (message) => {
    const { enabled, selectors } = message;
    if (enabled && selectors?.length > 0) {
      updateHideElements(selectors);
    } else {
      DOMUtils.removeStyle(STYLE_TAG_ID);
    }
    return { success: true };
  }
});

})();
