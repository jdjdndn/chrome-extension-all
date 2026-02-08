/**
 * 抖音自动化脚本
 * 功能：自动展开评论、跳过广告、跳过AI视频、不感兴趣关键词过滤
 * 元素选择器：
 * - .dySwiperSlide.page-recommend-container: 视频列表容器
 * - .playerContainer: 视频播放元素
 * - #videoSideCard: 评论区元素
 * 快捷键：
 * - 上下键: 切换视频
 * - x键: 展开评论
 * - g键: 关注
 * - r键: 不感兴趣
 */

"use strict";

// ========== 全局命名空间 ==========
// 使用 window 对象存储初始化状态，防止重复初始化
if (!window.DouyinScript) {
  window.DouyinScript = {};
}
if (!window.DouyinScript.isInitialized) {
  window.DouyinScript.isInitialized = false;
}

// ========== 配置区 ==========
// Style tag ID for identification
const STYLE_TAG_ID = 'douyin-content-hide-style';

// Current hide selectors state
let currentSelectors = [];

// ========== Hide Elements Default Selectors ==========
// 默认隐藏元素选择器列表（抖音域名专用）
const DEFAULT_HIDE_SELECTORS = [
  // 可以添加抖音网站默认需要隐藏的选择器
];

// 不感兴趣关键词列表 - 包含这些关键词的视频会自动下滑
const NOT_INTERESTED_KEYWORDS = [
  '抽象', '漫画', '国漫', '修仙', '玄幻', '系统', '动画', '动漫', '小说', '黑神话',
  '解说', '好剧', '儿童', '孩子', '观影', '案件', '国学', '狗', '猫', '宠物', '娃',
  '王者荣耀', '射手', '对抗路', '中单', '上单', '打野', '巅峰赛', '游戏日常', '综艺', '游戏',
  '美食', '测评', '小品', '春晚', '相亲', '恋爱', '情侣日常', '国服', '驾照', '考试', '结婚',
  '率土之滨', '程序员', '前端', '动物', '电商', '追剧', '军旅', '短剧', '小说', '恐怖',
  '影视', '电影', '司机', '工地', '情侣', '原生家庭', '影娱', '好片', '亲子', '幼儿园',
  '育儿', '育婴', '宝宝', '母婴', '妈妈', '父母', '爸妈', '早教', '幼教', '学前',
  '儿童', '音乐', '热歌', '电视剧'
];

// 自动关注关键词列表
const AUTO_FOLLOW_KEYWORDS = ['ootd'];

// 广告SVG特征路径列表
const AD_SVG_PATHS = [
  '<path d="M9.492 2.004L8.22 2.22c.216.336.408.72.588 1.128h-4.38v3.636c-.024 2.34-.348 4.176-.972 5.496l.96.852c.744-1.596 1.128-3.708 1.164-6.348V4.452h8.796V3.348h-4.308a16.717 16.717 0 0 0-.576-1.344zm15.564 6.672h-8.04v4.548h1.152v-.576h5.736v.576h1.152V8.676zm-6.888 2.904V9.756h5.736v1.824h-5.736zm-.276-6.732h2.688v1.656h-5.04V7.62h10.92V6.504h-4.74V4.848h3.828V3.756H21.72V2.148h-1.14v1.608h-2.016c.204-.408.372-.852.516-1.32l-1.128-.144c-.384 1.248-1.104 2.292-2.16 3.144l.684.9a8.301 8.301 0 0 0 1.416-1.488z" fill="#fff" fill-opacity=".5"></path>',
  // 可添加更多广告SVG特征
];

// AI相关关键词 - 标题或区域包含这些字样会自动下滑
const AI_KEYWORDS = ['AI'];

// 节流配置（毫秒）
const THROTTLE_CONFIG = {
  SKIP_VIDEO: 400,    // 切换视频节流时间
  OPEN_COMMENT: 600,  // 展开评论节流时间
  FOLLOW: 500         // 关注操作节流时间
};

// ========== 状态管理 ==========
let processedVideos = new Set(); // 已处理的视频集合
let lastActionTime = {}; // 上次操作时间记录

// 视频历史记录（用于检测手动上滑）
const VIDEO_HISTORY_SIZE = 5; // 保留最近5个视频
let videoHistory = []; // 视频UUID历史，最新在末尾

// 初始化状态管理
const isInitialized = window.DouyinScript.isInitialized;

let visibilityChangeHandler = null; // 保存 visibilitychange 监听器引用
let beforeUnloadHandler = null; // 保存 beforeunload 监听器引用

/**
 * Update hide elements by creating/updating style tag
 * @param {string[]} selectors - Array of CSS selectors to hide
 */
function updateHideElements(selectors) {
  // Remove existing style tag if present
  const existingStyle = document.getElementById(STYLE_TAG_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  // Update current selectors
  currentSelectors = selectors && selectors.length > 0 ? selectors : [];

  // Create and insert new style tag with all selectors
  if (currentSelectors.length > 0) {
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    // Generate CSS rules for all selectors
    const cssRules = currentSelectors
      .map(selector => `${selector} { display: none !important; }`)
      .join('\n');
    style.textContent = cssRules;
    document.head.appendChild(style);
    console.log('[抖音脚本] 已隐藏元素:', currentSelectors);
  }
}

/**
 * Get current domain's hide elements settings from storage
 */
async function loadDomainHideSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Fallback to default if not in extension context
    currentSelectors = DEFAULT_HIDE_SELECTORS.slice();
    return;
  }

  try {
    const hostname = window.location.hostname;
    const result = await chrome.storage.local.get(['hideElementsSettings']);
    const allSettings = result.hideElementsSettings || {};

    if (allSettings[hostname] && allSettings[hostname].enabled) {
      const selectors = allSettings[hostname].selectors || DEFAULT_HIDE_SELECTORS;
      updateHideElements(selectors);
      console.log('[抖音脚本] 已加载域名隐藏设置:', hostname, selectors);
    } else {
      // Use default selectors if no custom settings
      currentSelectors = DEFAULT_HIDE_SELECTORS.slice();
    }
  } catch (error) {
    console.log('[抖音脚本] 加载设置失败，使用默认设置:', error);
    currentSelectors = DEFAULT_HIDE_SELECTORS.slice();
  }
}

/**
 * 检查是否为手动导航（返回到之前的视频）
 * @param {string} videoId - 当前视频ID
 * @returns {boolean} 是否为手动导航
 */
function isManualNavigation(videoId) {
  // 检查当前视频是否在历史记录中（排除最新的，因为最新的就是当前视频）
  const index = videoHistory.indexOf(videoId);
  // 如果在历史记录中找到，且不是最新的，说明是手动返回
  return index !== -1 && index < videoHistory.length - 1;
}

/**
 * 更新视频历史记录
 * @param {string} videoId - 视频ID
 */
function updateVideoHistory(videoId) {
  // 如果视频已在历史末尾，无需更新
  if (videoHistory.length > 0 && videoHistory[videoHistory.length - 1] === videoId) {
    return;
  }

  // 添加到历史
  videoHistory.push(videoId);

  // 限制历史大小
  if (videoHistory.length > VIDEO_HISTORY_SIZE) {
    videoHistory.shift(); // 移除最旧的记录
  }
}

/**
 * 定时器管理器
 * 管理所有定时器，支持页面可见性控制
 */
const TimerManager = {
  timers: [], // 存储所有定时器ID
  factories: [], // 存储定时器工厂函数
  isRunning: false, // 定时器是否正在运行

  /**
   * 添加定时器
   * @param {number} timerId - 定时器ID
   */
  add(timerId) {
    this.timers.push(timerId);
  },

  /**
   * 注册定时器工厂函数
   * @param {Function} factory - 定时器工厂函数，返回定时器ID
   */
  register(factory) {
    this.factories.push(factory);
  },

  /**
   * 清除所有定时器
   */
  clearAll() {
    this.timers.forEach(id => clearInterval(id));
    this.timers = [];
    this.isRunning = false;
    console.log('[定时器管理] 所有定时器已清除');
  },

  /**
   * 启动所有定时器
   */
  start() {
    if (this.isRunning) {
      console.log('[定时器管理] 定时器已在运行中');
      return;
    }
    this.isRunning = true;
    console.log('[定时器管理] 定时器已启动');
    // 执行所有工厂函数，创建定时器
    this.factories.forEach(factory => {
      const timerId = factory();
      if (timerId !== undefined) {
        this.add(timerId);
      }
    });
  },

  /**
   * 重启所有定时器
   */
  restart() {
    this.clearAll();
    this.start();
  }
};

/**
 * 视频状态管理器 - 使用 WeakMap 实现高性能状态存储
 * 优势：
 * 1. O(1) 查找速度，比 getAttribute/setAttribute 快得多
 * 2. 无 DOM 操作开销
 * 3. 元素被移除时自动清理内存
 */
const VideoStateManager = {
  // 使用 WeakMap 存储各种状态
  uuid: new WeakMap(),
  liveHandled: new WeakMap(),
  skipAd: new WeakMap(),
  commentListener: new WeakMap(),

  /**
   * 设置视频 UUID
   * @param {Element} video - 视频元素
   * @param {string} uuid - UUID 值
   */
  setUUID(video, uuid) {
    this.uuid.set(video, uuid);
  },

  /**
   * 获取视频 UUID，如果不存在则生成并存储
   * @param {Element} video - 视频元素
   * @returns {string} UUID
   */
  getUUID(video) {
    if (!video) return generateUUID();
    if (!this.uuid.has(video)) {
      const uuid = generateUUID();
      this.uuid.set(video, uuid);
    }
    return this.uuid.get(video);
  },

  /**
   * 设置直播已处理状态
   * @param {Element} video - 视频元素
   * @param {boolean} value - 是否已处理
   */
  setLiveHandled(video, value) {
    if (value) {
      this.liveHandled.set(video, true);
    } else {
      this.liveHandled.delete(video);
    }
  },

  /**
   * 检查直播是否已处理
   * @param {Element} video - 视频元素
   * @returns {boolean} 是否已处理
   */
  isLiveHandled(video) {
    return this.liveHandled.has(video);
  },

  /**
   * 设置广告跳过状态
   * @param {Element} video - 视频元素
   * @param {boolean} value - 是否已标记为广告
   */
  setSkipAd(video, value) {
    if (value) {
      this.skipAd.set(video, true);
    } else {
      this.skipAd.delete(video);
    }
  },

  /**
   * 检查是否已标记为广告
   * @param {Element} video - 视频元素
   * @returns {boolean} 是否已标记
   */
  isSkipAd(video) {
    return this.skipAd.has(video);
  },

  /**
   * 设置评论监听器已绑定状态
   * @param {Element} element - 评论容器元素
   * @param {boolean} value - 是否已绑定
   */
  setCommentListener(element, value) {
    if (value) {
      this.commentListener.set(element, true);
    } else {
      this.commentListener.delete(element);
    }
  },

  /**
   * 检查评论监听器是否已绑定
   * @param {Element} element - 评论容器元素
   * @returns {boolean} 是否已绑定
   */
  hasCommentListener(element) {
    return this.commentListener.has(element);
  },

  /**
   * 清除指定元素的所有状态
   * @param {Element} video - 视频元素
   */
  clear(video) {
    this.uuid.delete(video);
    this.liveHandled.delete(video);
    this.skipAd.delete(video);
    this.commentListener.delete(video);
  }
};

// ========== 节流工具函数 ==========
/**
 * 节流函数 - 确保函数在指定时间内只执行一次
 * @param {string} actionId - 操作标识符
 * @param {number} delay - 节流时间（毫秒）
 * @returns {boolean} 是否允许执行
 */
function canExecuteAction(actionId, delay) {
  const now = Date.now();
  const lastTime = lastActionTime[actionId] || 0;
  if (now - lastTime >= delay) {
    lastActionTime[actionId] = now;
    return true;
  }
  return false;
}

/**
 * 按标识符隔离的防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounceById(fn, delay = 400) {
  const timerMap = new Map();
  return (id, ...args) => {
    const hasTimer = timerMap.has(id);
    if (hasTimer) clearTimeout(timerMap.get(id));
    if (!id || args.length != 2) {
      console.error('参数个数不正确');
      return;
    }
    if (!hasTimer) fn.apply(this, args);
    const timer = setTimeout(() => {
      timerMap.delete(id);
    }, delay);
    timerMap.set(id, timer);
  };
}

/**
 * 触发键盘事件（带节流）
 * @param {string} actionId - 操作标识
 * @param {string} eventType - 事件类型
 * @param {Object} eventData - 事件数据
 */
const triggerKeyboardEvent = debounceById(function triggerKeyboard(eventType, eventData) {
  const event = new KeyboardEvent(eventType, eventData);
  document.dispatchEvent(event);
}, 400);

/**
 * 下滑到下一个视频（带节流）
 * @param {string} reason - 下滑原因（用于日志）
 */
function skipToNextVideo(reason) {
  if (!canExecuteAction('skip_video', THROTTLE_CONFIG.SKIP_VIDEO)) {
    return;
  }

  const currentVideoBody = findOne('.playerContainer');
  const currentVideoId = currentVideoBody ? getVideoUUID(currentVideoBody) : null;

  console.log(`[自动下滑] 原因: ${reason}`);

  triggerKeyboardEvent("skip_video", "keydown", {
    keyCode: 40,
    key: "ArrowDown",
    code: "ArrowDown"
  });

  // 启动二次检测：检查视频是否真的切换了
  if (currentVideoId) {
    startVideoChangeCheck(currentVideoId, reason);
  }
}

/**
 * 视频变化检测定时器管理
 */
const VideoChangeChecker = {
  activeChecks: new Map(), // 存储正在进行的检测任务

  /**
   * 启动视频变化检测
   * @param {string} expectedVideoId - 期望离开的视频ID
   * @param {string} reason - 下滑原因
   */
  start(expectedVideoId, reason) {
    // 取消该视频ID之前的检测任务
    this.cancel(expectedVideoId);

    const CHECK_INTERVAL = 2000; // 每2秒检查一次
    const MAX_CHECKS = 3; // 最多检查3次（6秒）

    let checkCount = 0;

    const checkVideo = () => {
      checkCount++;
      const currentVideoBody = findOne('.playerContainer');
      const currentVideoId = currentVideoBody ? getVideoUUID(currentVideoBody) : null;

      // 如果视频已经变化，停止检测
      if (currentVideoId !== expectedVideoId) {
        console.log(`[二次检测] 视频已切换，停止检测`);
        this.cancel(expectedVideoId);
        return;
      }

      // 如果视频已经被标记（如直播已处理），停止检测
      if (currentVideoBody) {
        // 检查是否已标记为直播已处理
        if (VideoStateManager.isLiveHandled(currentVideoBody)) {
          console.log(`[二次检测] 视频已标记为直播，停止检测`);
          this.cancel(expectedVideoId);
          return;
        }
        // 检查是否已标记为广告
        if (VideoStateManager.isSkipAd(currentVideoBody)) {
          console.log(`[二次检测] 视频已标记为广告，停止检测`);
          this.cancel(expectedVideoId);
          return;
        }
      }

      // 如果达到最大检查次数，强制再次下滑
      if (checkCount >= MAX_CHECKS) {
        // 检查视频是否已经处理过（直播、广告等）
        if (currentVideoBody) {
          if (VideoStateManager.isLiveHandled(currentVideoBody)) {
            console.log(`[二次检测] 视频已标记为直播，停止检测`);
            this.cancel(expectedVideoId);
            return;
          }
          if (VideoStateManager.isSkipAd(currentVideoBody)) {
            console.log(`[二次检测] 视频已标记为广告，停止检测`);
            this.cancel(expectedVideoId);
            return;
          }
        }
        console.log(`[二次检测] 视频${checkCount}次检查未切换，强制再次下滑`);
        this.cancel(expectedVideoId);
        // 使用不同的actionId避免节流限制
        if (canExecuteAction('skip_video_retry', THROTTLE_CONFIG.SKIP_VIDEO)) {
          triggerKeyboardEvent("skip_video_retry", "keydown", {
            keyCode: 40,
            key: "ArrowDown",
            code: "ArrowDown"
          });
          // 重新启动检测
          this.start(currentVideoId, reason);
        }
        return;
      }

      console.log(`[二次检测] 第${checkCount}次检查，视频未切换，等待...`);
    };

    // 延迟1秒后开始第一次检查（给视频切换留出时间）
    const timerId = setTimeout(() => {
      checkVideo();
      // 设置后续的定时检查
      const intervalId = setInterval(checkVideo, CHECK_INTERVAL);
      // 存储intervalId用于取消
      this.activeChecks.set(expectedVideoId, { intervalId, timeoutId: null });
    }, 1000);

    // 存储初始timeoutId
    this.activeChecks.set(expectedVideoId, { intervalId: null, timeoutId: timerId });
  },

  /**
   * 取消指定视频ID的检测任务
   * @param {string} videoId - 视频ID
   */
  cancel(videoId) {
    const check = this.activeChecks.get(videoId);
    if (check) {
      if (check.intervalId) clearInterval(check.intervalId);
      if (check.timeoutId) clearTimeout(check.timeoutId);
      this.activeChecks.delete(videoId);
    }
  },

  /**
   * 取消所有正在进行的检测任务
   */
  cancelAll() {
    this.activeChecks.forEach((check) => {
      if (check.intervalId) clearInterval(check.intervalId);
      if (check.timeoutId) clearTimeout(check.timeoutId);
    });
    this.activeChecks.clear();
    console.log(`[二次检测] 所有检测任务已取消`);
  }
};

/**
 * 启动视频变化检测（别名函数）
 * @param {string} currentVideoId - 当前视频ID
 * @param {string} reason - 下滑原因
 */
function startVideoChangeCheck(currentVideoId, reason) {
  VideoChangeChecker.start(currentVideoId, reason);
}

/**
 * 获取或生成视频UUID - 使用 WeakMap 优化性能
 * @param {Element} videoBody - 视频容器元素
 * @returns {string} UUID字符串
 */
function getVideoUUID(videoBody) {
  return VideoStateManager.getUUID(videoBody);
}

/**
 * 生成UUID
 * @returns {string} UUID字符串
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 判断元素是否在视口中可见
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 是否可见
 */
function isElementInViewportAndVisible(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = rect.top >= 0 && rect.left >= 0 &&
    Math.floor(rect.right) <= window.innerWidth &&
    rect.bottom <= window.innerHeight &&
    rect.width != 0 && rect.height != 0;
  return isVisible && (window.getComputedStyle(element).display !== 'none');
}

/**
 * 找到唯一一个在页面中的元素
 * @param {string} selector - CSS选择器
 * @returns {Element|null} 找到的元素
 */
function findOne(selector) {
  const list = [...document.querySelectorAll(selector)]
    .filter(item => isElementInViewportAndVisible(item));
  if (list.length == 1) return list[0];
  return null;
}

/**
 * 查找指定SVG路径的元素
 * @param {string} pathStr - SVG路径字符串
 * @returns {Element|null} 找到的元素
 */
function findPath(pathStr) {
  return [...document.querySelectorAll('path')]
    .filter(item => isElementInViewportAndVisible(item))
    .find(it => it.outerHTML === pathStr);
}

// ========== 功能函数 ==========

/**
 * 检测广告SVG路径
 * @returns {boolean} 是否检测到广告
 */
function detectAdSvg() {
  const visiblePaths = [...document.querySelectorAll('path')]
    .filter(item => isElementInViewportAndVisible(item));

  // 检查是否包含任何广告SVG特征
  for (const adPath of AD_SVG_PATHS) {
    if (visiblePaths.some(it => it.outerHTML === adPath)) {
      return true;
    }
  }
  return false;
}

/**
 * 广告自动跳过
 * @param {Element} videoBody - 视频容器
 */
function skipAD(videoBody) {
  // 已经标记为广告的视频不再处理
  if (videoBody && VideoStateManager.isSkipAd(videoBody)) return;

  if (detectAdSvg()) {
    console.log('[广告检测] 检测到广告标识');
    if (videoBody) VideoStateManager.setSkipAd(videoBody, true);
    // 使用 r 键标记不感兴趣，然后下滑
    triggerKeyboardEvent("skipAD_mark", "keydown", { keyCode: 82, key: "r", code: "KeyR" });
    setTimeout(() => {
      skipToNextVideo('广告视频');
    }, 200);
  }
}

/**
 * 检测AI相关内容
 * @param {Element} videoBody - 视频容器
 * @returns {boolean} 是否检测到AI内容
 */
function detectAIContent(videoBody) {
  if (!videoBody) return false;

  const videoId = getVideoUUID(videoBody);
  const skipKey = `skip_ai_${videoId}`;

  // 已经处理过的AI视频不再处理
  if (processedVideos.has(skipKey)) return false;

  // 方法1: 检查safetyBar中是否有AI标识
  const safetyBar = findOne('.safetyBar');
  if (safetyBar && safetyBar.innerText.includes('AI')) {
    console.log('[AI检测] safetyBar.innerText:', safetyBar.innerText);
    return true;
  }

  return false;
}

/**
 * 跳过AI视频
 * @param {Element} videoBody - 视频容器
 */
function skipAi(videoBody) {
  const videoId = getVideoUUID(videoBody);
  const skipKey = `skip_ai_${videoId}`;

  if (detectAIContent(videoBody)) {
    console.log('[AI检测] 检测到AI相关内容');
    processedVideos.add(skipKey);
    skipToNextVideo('AI生成内容');
  }
}

/**
 * 检查不感兴趣关键词
 * @param {Element} videoBody - 视频容器
 * @returns {string|null} 匹配到的关键词
 */
function checkNotInterestedKeywords(videoBody) {
  if (!videoBody) return null;

  // 方法1: 获取视频区的所有标签文本（多种选择器）
  let tagList = [];

  // 选择器1: span>a>span 且以 # 开头
  const tagElements1 = [...videoBody.querySelectorAll('span>a>span')]
    .filter(item => isElementInViewportAndVisible(item))
    .filter(item => item.innerText.startsWith('#'));
  tagList.push(...tagElements1.map(it => it.innerText));

  // 选择器2: 所有包含 # 的 span 文本
  const tagElements2 = [...videoBody.querySelectorAll('span')]
    .filter(item => isElementInViewportAndVisible(item))
    .filter(item => item.innerText && item.innerText.startsWith('#') && item.innerText.length < 50);
  tagList.push(...tagElements2.map(it => it.innerText));

  // 去重
  tagList = [...new Set(tagList)];

  // 检查标签是否匹配不感兴趣关键词
  for (const tag of tagList) {
    for (const keyword of NOT_INTERESTED_KEYWORDS) {
      if (tag.includes(keyword)) {
        console.log(`[不感兴趣检测] 标签匹配: "${tag}" 包含 "${keyword}"`);
        return keyword;
      }
    }
  }

  console.log('[不感兴趣检测] 未匹配到关键词');
  return null;
}

/**
 * 处理不感兴趣视频
 * @param {Element} videoBody - 视频容器
 */
function handleNotInterested(videoBody) {
  const videoId = getVideoUUID(videoBody);
  const skipKey = `not_interested_${videoId}`;

  // 已经处理过的视频不再处理
  if (processedVideos.has(skipKey)) {
    console.log('[不感兴趣] 视频已处理过，跳过');
    return;
  }

  const matchedKeyword = checkNotInterestedKeywords(videoBody);
  if (matchedKeyword) {
    console.log(`[不感兴趣] 匹配到关键词: "${matchedKeyword}"，准备下滑`);
    processedVideos.add(skipKey);
    skipToNextVideo(`不感兴趣: ${matchedKeyword}`);
  }
}

/**
 * 是否在直播（全屏，整个画面都是直播）
 * @returns {boolean} 是否正在直播
 */
function isVideoing(video) {
  const text = video.innerText;
  return text.includes('点击或按\n进入直播间') || text.includes('上滑继续看视频');
}

/**
 * 直播自动跳过
 * @param {Element} videoBody - 视频容器
 */
function autoSkip(videoBody) {
  if (videoBody) return;
  const video = findOne('.douyin-player');
  if (!video) return;
  // 如果已经处理过这个直播视频，跳过
  if (VideoStateManager.isLiveHandled(video)) return;

  const isLive = isVideoing(video);
  if (isLive) {
    console.log('[直播检测] 检测到直播，准备跳过');
    // 标记为已处理
    VideoStateManager.setLiveHandled(video, true);
    skipToNextVideo('检测到直播');
  }
}

/**
 * 自动关注
 */
function autoStar() {
  // 根据svg的viewBox属性判断图标大小，关注加号图标大小为 0 0 32 33
  function hasNoStar() {
    return findPath('<path fill-rule="evenodd" clip-rule="evenodd" d="M16 26.7319C22.6274 26.7319 28 21.3594 28 14.7319C28 8.10452 22.6274 2.73193 16 2.73193C9.37258 2.73193 4 8.10452 4 14.7319C4 21.3594 9.37258 26.7319 16 26.7319Z" fill="#FE2C55"></path>');
  }

  const tagElements = [...document.querySelectorAll('span>a>span')]
    .filter(item => isElementInViewportAndVisible(item))
    .filter(item => item.innerText.startsWith('#'));
  const tagList = tagElements.map(it => it.innerText);

  // 检查是否需要自动关注
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

/**
 * 自动展开评论区
 * @param {Element} videoBody - 视频容器
 */
function autoOpenComment(videoBody) {
  if (!videoBody) return;

  const videoParent = videoBody.parentElement;
  if (!videoParent) return;

  // 检查评论区是否已经展开（评论区宽度会占用视频空间）
  const isCommentOpen = videoParent.offsetWidth > videoBody.offsetWidth;

  if (!isCommentOpen && canExecuteAction('open_comment', THROTTLE_CONFIG.OPEN_COMMENT)) {
    triggerKeyboardEvent("autoOpenComment", "keydown", { keyCode: 88, key: "x", code: "KeyX" });
  }
}

// ========== 评论区时间跳转功能 ==========

/**
 * 匹配时间字符串
 * @param {string} timeStr - 包含时间的文本
 * @param {number} offset - 点击位置的偏移量
 * @returns {string|null} 匹配到的时间字符串
 */
function matchTimeStr(timeStr, offset) {
  // 支持格式: 0:24, 00:28, 1:34, 00:2:35 等
  const regex = /\b((?:(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)|(?:(?:[01]?\d|2[0-3]):[0-5]\d)|(?:[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM))\b/g;
  const matches = timeStr.matchAll(regex);
  for (const match of matches) {
    const index = match["index"];
    match.lastIndex = index + match[0].length;
    if (offset >= index && offset < match.lastIndex) {
      return match[0];
    }
  }
  return null;
}

/**
 * 将时间字符串转换为秒数
 * @param {string} timeStr - 时间字符串 (如 "1:30", "01:30", "1:30:45")
 * @returns {number} 秒数
 */
function timeToSeconds(timeStr) {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];  // mm:ss
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];  // hh:mm:ss
  }
  return 0;
}

/**
 * 设置评论区时间跳转功能（心跳模式）
 * 监听评论区点击事件，如果点击位置包含时间文本，则跳转到对应时间
 */
function setVideoTime() {
  console.log('[时间跳转] 评论区监听已注册');

  // 心跳间隔（毫秒）- 每500ms检查一次
  const HEARTBEAT_INTERVAL = 500;
  const COMMENT_CONTAINER_SELECTOR = '#videoSideCard';

  // 返回工厂函数供 TimerManager 使用
  return () => setInterval(() => {
    const commentBody = findOne(COMMENT_CONTAINER_SELECTOR);

    // 使用 WeakMap 检查是否已绑定监听器
    if (commentBody && !VideoStateManager.hasCommentListener(commentBody)) {
      setupCommentClickListener(commentBody);
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * 为评论区容器设置点击监听器
 * @param {Element} container - 评论区容器
 */
function setupCommentClickListener(container) {
  // 标记已绑定事件 - 使用 WeakMap 替代 setAttribute
  VideoStateManager.setCommentListener(container, true);

  container.addEventListener('click', (e) => {
    const targetNode = e.target;

    // 只处理 SPAN 元素
    if (targetNode.nodeName !== 'SPAN') return;

    // 获取点击位置在文本中的偏移量
    let offset;

    if (document.caretPositionFromPoint) {
      const range = document.caretPositionFromPoint(e.clientX, e.clientY);
      offset = range.offset;
    } else if (document.caretRangeFromPoint) {
      // WebKit 专有回退方法
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      offset = range.startOffset;
    } else {
      // 两个方法都不支持，无法获取点击位置
      return;
    }

    // 匹配点击位置的时间字符串
    const match = matchTimeStr(targetNode.innerText, offset);
    if (!match) return;

    // 转换时间为秒数
    const currentTime = timeToSeconds(match);

    // 找到当前播放的视频
    const video = findOne('video');
    if (!video) return;

    // 检查时间是否在视频时长范围内
    if (video.duration >= currentTime) {
      console.log(`[时间跳转] 点击时间: ${match} (${currentTime}秒), 视频时长: ${Math.floor(video.duration)}秒`);
      video.currentTime = currentTime;
    } else {
      console.log(`[时间跳转] 时间超出范围: ${match} (${currentTime}秒) > 视频时长 (${Math.floor(video.duration)}秒)`);
    }
  });

  console.log('[时间跳转] 评论区时间跳转功能已启用');
}

/**
 * 主循环监听函数 - 心跳模式
 * 使用定时器定期检查视频变化，执行各项自动化操作
 * @param {Function} fn - 回调函数
 */
function loopFunc(fn) {
  let processCount = 0;

  function heartbeat() {
    try {
      fn();

      // 每50次处理输出一次心跳日志
      processCount++;
      if (processCount % 50 === 0) {
        const currentVideoBody = findOne('.playerContainer');
        const currentId = currentVideoBody ? getVideoUUID(currentVideoBody) : 'none';
        console.log(`[抖音脚本] 心跳 `);
      }
    } catch (error) {
      console.error('[Loop Error]', error);
    }
  }

  console.log('[抖音脚本] 视频容器监听已注册（心跳模式）');

  // 心跳间隔（毫秒）- 每1000ms检查一次
  const HEARTBEAT_INTERVAL = 1000;

  // 注册心跳定时器工厂函数
  TimerManager.register(() => setInterval(heartbeat, HEARTBEAT_INTERVAL));

  // 注册状态日志定时器工厂函数（每隔30秒输出一次状态）
  TimerManager.register(() => setInterval(() => {
    const currentVideoBody = findOne('.playerContainer');
    const currentId = currentVideoBody ? getVideoUUID(currentVideoBody) : 'none';
    console.log(`[抖音脚本] 状态运行中`);
  }, 30000));
}

// 当前正在处理的视频ID
let currentVideoId = null;

/**
 * 清理指定视频ID的处理记录
 * @param {string} videoId - 要清理的视频UUID
 */
function clearProcessedVideo(videoId) {
  if (!videoId) return;
  // 清理所有与该视频相关的处理记录
  const keysToDelete = [];
  for (const key of processedVideos) {
    if (key.endsWith(`_${videoId}`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => processedVideos.delete(key));
  if (keysToDelete.length > 0) {
    console.log(`[清理] 移除已离开视频的处理记录`);
  }
}

/**
 * 主处理函数 - 处理当前视频
 */
function processCurrentVideo() {

  const videoBody = findOne('.playerContainer');
  // 1. 直播检测
  autoSkip(videoBody);
  if (!videoBody) return;

  // 获取当前视频ID
  const videoId = getVideoUUID(videoBody);

  // 如果视频没有变化，跳过处理（避免重复处理同一视频）
  if (currentVideoId === videoId) {
    return;
  }

  // 视频切换了，更新当前视频ID
  if (currentVideoId !== null && currentVideoId !== videoId) {
    console.log(`[抖音脚本] 视频切换`);

    // 更新历史记录（在检测手动导航之前）
    updateVideoHistory(videoId);

    // 检查是否为手动导航（返回到之前的视频）
    if (isManualNavigation(videoId)) {
      console.log(`[手动导航] 检测到手动上滑返回，暂停自动处理`);
      // 取消所有正在进行的二次检测任务
      VideoChangeChecker.cancelAll();
      currentVideoId = videoId;
      return;
    }

    // 清理旧视频的处理记录（允许稍后返回时重新判断）
    clearProcessedVideo(currentVideoId);
  } else {
    // 首次加载，添加到历史
    updateVideoHistory(videoId);
  }
  currentVideoId = videoId;

  // 按优先级执行各项检查

  // 2. 广告检测
  skipAD(videoBody);

  // 3. AI内容检测
  skipAi(videoBody);

  // 4. 不感兴趣关键词检测
  handleNotInterested(videoBody);

  // 5. 自动关注
  autoStar();

  // 6. 自动展开评论区
  autoOpenComment(videoBody);
}

// ========== 初始化 ==========
function init() {
  // 防止重复初始化
  if (window.DouyinScript.isInitialized) {
    console.log('[抖音脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.DouyinScript.isInitialized = true;

  // Load domain-specific hide settings and apply
  loadDomainHideSettings();

  // 注册评论区时间跳转功能
  TimerManager.register(setVideoTime());

  // 注册主循环
  loopFunc(processCurrentVideo);

  // 启动所有定时器
  TimerManager.start();

  // 创建并保存监听器引用
  visibilityChangeHandler = () => {
    if (document.hidden) {
      // 页面隐藏时清除所有定时器
      console.log('[定时器管理] 页面隐藏，清除定时器');
      TimerManager.clearAll();
      VideoChangeChecker.cancelAll();
    } else {
      // 页面显示时重新启动定时器
      console.log('[定时器管理] 页面显示，重启定时器');
      TimerManager.restart();
    }
  };

  beforeUnloadHandler = () => {
    console.log('[定时器管理] 页面卸载，清除定时器');
    TimerManager.clearAll();
    VideoChangeChecker.cancelAll();
  };

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', visibilityChangeHandler);

  // 监听页面卸载
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

// 启动脚本
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 导出配置供外部使用
window.DouyinScriptConfig = {
  NOT_INTERESTED_KEYWORDS,
  AUTO_FOLLOW_KEYWORDS,
  AD_SVG_PATHS,
  AI_KEYWORDS,
  THROTTLE_CONFIG,
  DEFAULT_HIDE_SELECTORS
};

// ========== Chrome Extension Message Handler ==========
/**
 * 监听来自 popup 和 background 的消息
 * 使用全局标志防止重复注册
 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // 使用唯一标识符防止重复注册消息监听器
  const MESSAGE_HANDLER_ID = 'douyin_message_handler_v1';

  if (!window[MESSAGE_HANDLER_ID]) {
    window[MESSAGE_HANDLER_ID] = true;
    console.log('[抖音脚本] 注册消息监听器');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'UPDATE_KEYWORDS') {
        const { keywords } = message;
        if (keywords.NOT_INTERESTED_KEYWORDS) {
          NOT_INTERESTED_KEYWORDS.length = 0;
          NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)]);
          console.log('[抖音脚本] 不感兴趣关键词已更新:', NOT_INTERESTED_KEYWORDS);
        }
        if (keywords.AUTO_FOLLOW_KEYWORDS) {
          AUTO_FOLLOW_KEYWORDS.length = 0;
          AUTO_FOLLOW_KEYWORDS.push(...[...new Set(keywords.AUTO_FOLLOW_KEYWORDS)]);
          console.log('[抖音脚本] 自动关注关键词已更新:', AUTO_FOLLOW_KEYWORDS);
        }
        sendResponse({ success: true, message: '关键词已更新' });
        return true;
      }

      if (message.type === 'TOGGLE_EXTENSION') {
        const { enabled } = message;
        console.log('[抖音脚本] 扩展状态:', enabled ? '启用' : '禁用');
        sendResponse({ success: true });
        return true;
      }

      // Handle get default hide selectors
      if (message.type === 'GET_DEFAULT_HIDE_SELECTORS') {
        sendResponse({ success: true, selectors: DEFAULT_HIDE_SELECTORS });
        return true;
      }

      // Handle get current hide selectors
      if (message.type === 'GET_CURRENT_HIDE_SELECTORS') {
        sendResponse({ success: true, selectors: currentSelectors });
        return true;
      }

      // Handle update hide elements
      if (message.type === 'UPDATE_HIDE_ELEMENTS') {
        const { enabled, selectors } = message;
        if (enabled && selectors && selectors.length > 0) {
          updateHideElements(selectors);
          console.log('[抖音脚本] 隐藏元素已更新:', selectors);
        } else {
          // Disable hiding by removing style tag
          const existingStyle = document.getElementById(STYLE_TAG_ID);
          if (existingStyle) {
            existingStyle.remove();
          }
          console.log('[抖音脚本] 隐藏元素已禁用');
        }
        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }
}
