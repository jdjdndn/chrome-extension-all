// Background service worker (Manifest V3)
// Runs in the background and handles extension lifecycle events

// ========== EventBus 加载 ==========
// 在 service worker 中使用 importScripts 加载 event-bus-v4.6.js
// 这比 ES6 import 更可靠，因为 event-bus 是 IIFE 格式
if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
  self.importScripts('event-bus-v4.6.js');
}

// ========== Port 连接管理 ==========
// 使用 EventBus Transport 管理 Port 连接
const devtoolsPorts = new Map(); // tabId -> port (保留用于兼容)

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    console.log('[Background] DevTools 面板已连接');

    // 监听来自 DevTools 的消息
    port.onMessage.addListener((message) => {
      if (message.type === 'REGISTER_DEVTOOLS') {
        // 注册 DevTools 对应的 tabId
        devtoolsPorts.set(message.tabId, port);
        // 同时注册到 EventBus Transport
        if (typeof EventBus !== 'undefined' && EventBus.Transport) {
          EventBus.Transport.registerPort(message.tabId, port);
        }
        console.log(`[Background] 注册 DevTools: tabId=${message.tabId}`);
      }
      // 处理 EventBus 消息
      if (message.__eventbus__ && typeof EventBus !== 'undefined') {
        EventBus._handleMessage(message, { tabId: message.tabId });
      }
    });

    port.onDisconnect.addListener(() => {
      // 移除断开连接的 port
      for (const [tabId, p] of devtoolsPorts) {
        if (p === port) {
          devtoolsPorts.delete(tabId);
          console.log(`[Background] DevTools 断开: tabId=${tabId}`);
          break;
        }
      }
    });
  }

  // DevTools Tools Panel 连接
  if (port.name === 'devtools-tools-panel') {
    console.log('[Background] DevTools Tools 面板已连接');

    port.onMessage.addListener((message) => {
      if (message.type === 'REGISTER_TOOLS_PANEL') {
        devtoolsPorts.set(message.tabId, port);
        if (typeof EventBus !== 'undefined' && EventBus.Transport) {
          EventBus.Transport.registerPort(message.tabId, port);
        }
        console.log(`[Background] 注册 Tools Panel: tabId=${message.tabId}`);
      }
      // 处理 EventBus 消息
      if (message.__eventbus__ && typeof EventBus !== 'undefined') {
        EventBus._handleMessage(message, { tabId: message.tabId });
      }
    });

    port.onDisconnect.addListener(() => {
      for (const [tabId, p] of devtoolsPorts) {
        if (p === port) {
          devtoolsPorts.delete(tabId);
          console.log(`[Background] Tools Panel 断开: tabId=${tabId}`);
          break;
        }
      }
    });
  }
});

/**
 * 向指定 tab 的 DevTools 面板推送消息
 * 优先使用 EventBus Transport
 */
function pushToDevTools(tabId, message) {
  let pushed = false;

  // 尝试 EventBus Transport（仅当 Port 已注册时）
  if (typeof EventBus !== 'undefined' && EventBus.Transport && EventBus.Transport.ports && EventBus.Transport.ports.has(tabId)) {
    pushed = EventBus.Transport.sendViaPort(tabId, { type: 'PICKER_MESSAGE_PUSH', data: message });
    if (pushed) {
      console.log('[Background] EventBus Transport 推送成功, tabId:', tabId);
      return true;
    }
  }

  // 降级到 devtoolsPorts
  const port = devtoolsPorts.get(tabId);
  if (port) {
    try {
      port.postMessage({
        type: 'PICKER_MESSAGE_PUSH',
        data: message
      });
      console.log('[Background] devtoolsPorts 推送成功, tabId:', tabId);
      return true;
    } catch (error) {
      console.log('[Background] 推送失败:', error);
      devtoolsPorts.delete(tabId);
    }
  }

  console.warn('[Background] 未找到已注册的 DevTools Port, tabId:', tabId);
  return false;
}
const SETTINE = 'cy_settings';

// 脚本内部默认配置（各站点脚本可通过 REGISTER_BLOCKED_DOMAINS 注册）
const _defaultBlockedDomains = {
  // 示例：'douyin.com': ['mcs.zijieapi.com/list']
};

// 域名阻止数据（中间变量，合并存储数据和默认配置）
let _domainBlockedData = {
  blockedDomains: {},      // { domain: [blockedUrlPatterns] }
  blockedResponseDomains: {} // { domain: [blockedResponseUrlPatterns] }
};

// 设置加载状态
let _settingsLoaded = false;
let _settingsLoadPromise = null;

// 合并并去重数组
function mergeAndDedupe(arr1, arr2) {
  return [...new Set([...(arr1 || []), ...(arr2 || [])])];
}

// 合并域名阻止数据
function mergeDomainBlockedData(storedData, defaultData) {
  const result = {
    blockedDomains: { ...defaultData.blockedDomains },
    blockedResponseDomains: { ...defaultData.blockedResponseDomains }
  };

  // 合并存储的数据
  if (storedData) {
    // 合并 blockedDomains
    for (const [domain, domains] of Object.entries(storedData.blockedDomains || {})) {
      result.blockedDomains[domain] = mergeAndDedupe(
        result.blockedDomains[domain],
        domains
      );
    }
    // 合并 blockedResponseDomains
    for (const [domain, domains] of Object.entries(storedData.blockedResponseDomains || {})) {
      result.blockedResponseDomains[domain] = mergeAndDedupe(
        result.blockedResponseDomains[domain],
        domains
      );
    }
  }

  return result;
}

// 初始化函数
function initDomainBlockedData() {
  // 初始化为默认配置
  _domainBlockedData = {
    blockedDomains: { ..._defaultBlockedDomains },
    blockedResponseDomains: {}
  };
}

// 执行初始化
initDomainBlockedData();

// Get current tab's domain (async helper)
async function getCurrentTabDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      return url.hostname;
    }
    return null;
  } catch (error) {
    console.error('Error getting current tab domain:', error);
    return null;
  }
}

// Extension state
let extensionState = {
  initialized: false,
  isDebugMode: false,
  lastUpdate: null,
  domainScriptMap: {
    "4hu.tv": ['content/4hu.js'],
    "pornhub.com": ['content/porn.js'],
    "douyin.com": ['content/douyin.js'],
    "bilibili.com": ['content/bili.js'],
  }, // 新增：域名到注入脚本映射 {域名: [文件名数组]}
};

// Mock rules storage: { urlPattern: { response: any, enabled: boolean, statusCode: number } }
let mockRules = {};

// Define getters and setters that bind to current active tab's domain
Object.defineProperties(extensionState, {
  blockedDomains: {
    get: async function () {
      const domain = await getCurrentTabDomain();
      if (!domain) return [];
      return _domainBlockedData.blockedDomains[domain] || [];
    },
    set: async function (value) {
      const domain = await getCurrentTabDomain();
      if (domain) {
        _domainBlockedData.blockedDomains[domain] = value;
        // Persist to storage
        await persistDomainBlockedData();
      }
    },
    configurable: true
  },
  blockedResponseDomains: {
    get: async function () {
      const domain = await getCurrentTabDomain();
      if (!domain) return [];
      return _domainBlockedData.blockedResponseDomains[domain] || [];
    },
    set: async function (value) {
      const domain = await getCurrentTabDomain();
      if (domain) {
        _domainBlockedData.blockedResponseDomains[domain] = value;
        // Persist to storage
        await persistDomainBlockedData();
      }
    },
    configurable: true
  }
});

// Persist domain blocked data to storage
async function persistDomainBlockedData() {
  try {
    const result = await chrome.storage.sync.get(SETTINE);
    const currentSettings = result[SETTINE] || result.settings || {};
    await chrome.storage.sync.set({
      [SETTINE]: {
        ...currentSettings,
        domainBlockedData: _domainBlockedData
      }
    });
  } catch (error) {
    console.error('Error persisting domain blocked data:', error);
  }
}

// Get blocked domains for a specific domain (synchronous helper)
function getBlockedDomainsForDomain(domain) {
  if (!domain) return [];
  // First try exact match
  if (_domainBlockedData.blockedDomains[domain]) {
    return _domainBlockedData.blockedDomains[domain];
  }
  // Then try flexible matching (similar to getScriptsForDomain)
  for (const [key, domains] of Object.entries(_domainBlockedData.blockedDomains)) {
    if (domain.includes(key) || key.includes(domain)) {
      return domains;
    }
  }
  return [];
}

// Get blocked response domains for a specific domain (synchronous helper)
function getBlockedResponseDomainsForDomain(domain) {
  if (!domain) return [];
  // First try exact match
  if (_domainBlockedData.blockedResponseDomains[domain]) {
    return _domainBlockedData.blockedResponseDomains[domain];
  }
  // Then try flexible matching (similar to getScriptsForDomain)
  for (const [key, domains] of Object.entries(_domainBlockedData.blockedResponseDomains)) {
    if (domain.includes(key) || key.includes(domain)) {
      return domains;
    }
  }
  return [];
}

// Set blocked domains for a specific domain (synchronous helper)
function setBlockedDomainsForDomain(domain, domains) {
  _domainBlockedData.blockedDomains[domain] = domains;
}

// Set blocked response domains for a specific domain (synchronous helper)
function setBlockedResponseDomainsForDomain(domain, domains) {
  _domainBlockedData.blockedResponseDomains[domain] = domains;
}

// Get all blocked domains across all domains (for backward compatibility)
function getAllBlockedDomains() {
  const allDomains = new Set();
  Object.values(_domainBlockedData.blockedDomains).forEach(domains => {
    domains.forEach(d => allDomains.add(d));
  });
  return Array.from(allDomains);
}

// Get all blocked response domains across all domains (for backward compatibility)
function getAllBlockedResponseDomains() {
  const allDomains = new Set();
  Object.values(_domainBlockedData.blockedResponseDomains).forEach(domains => {
    domains.forEach(d => allDomains.add(d));
  });
  return Array.from(allDomains);
}

// Initialize extension
async function initialize() {
  if (extensionState.initialized) return;

  console.log('Initializing extension...');
  extensionState.initialized = true;

  // 初始化 EventBus V5
  if (typeof EventBus !== 'undefined') {
    await EventBus.init();
    console.log('[Background] EventBus V5 已初始化');

    // 配置 EventBus
    EventBus.configure({
      DEBUG_MODE: extensionState.isDebugMode || false,
      ENABLE_TRACKING: true,
      ENABLE_STATISTICS: true,
      ENABLE_PERFORMANCE_MONITORING: true,
      ENABLE_CIRCUIT_BREAKER: true,
      ENABLE_SMART_ERRORS: true,
      ENABLE_MEMORY_PROFILING: false, // Service Worker 不支持内存分析
      ENABLE_MESSAGE_TEMPLATES: true
    });

    // 注册核心处理器
    registerEventBusHandlers();

    // 注册消息模板
    registerMessageTemplates();
  }

  // Load settings (await to ensure data is ready)
  _settingsLoadPromise = loadSettings();
  await _settingsLoadPromise;
  _settingsLoaded = true;

  // Listen for extension events
  setupEventListeners();

  // 处理浏览器启动时已存在的标签页
  // 延迟执行，确保 service worker 完全就绪
  // 使用延迟注入模式：只注入当前激活的 tab，其他 tab 等激活时再注入
  setTimeout(() => {
    markTabsForLazyInjection();
  }, 500);

  console.log('Extension initialized successfully');
}

// 注册 EventBus 处理器
function registerEventBusHandlers() {
  // 测试回显
  EventBus.on('TEST_ECHO', (data) => {
    console.log('[Background] 收到 TEST_ECHO:', data);
    return { success: true, echo: data };
  });

  // 获取状态
  EventBus.on('GET_STATE', () => {
    return {
      success: true,
      state: extensionState,
      eventbus: EventBus.getState()
    };
  });

  // 获取性能指标
  EventBus.on('GET_PERFORMANCE', () => {
    return {
      success: true,
      metrics: EventBus.getPerformanceMetrics(),
      stats: EventBus.getStats()
    };
  });

  // 获取健康状态
  EventBus.on('GET_HEALTH', () => {
    return {
      success: true,
      health: EventBus.getHealthAnalysis()
    };
  });

  // 获取快照
  EventBus.on('GET_SNAPSHOT', () => {
    return {
      success: true,
      snapshot: EventBus.getSnapshot()
    };
  });

  // 检查域名是否被阻止
  EventBus.on('CHECK_DOMAIN_BLOCKED', (data) => {
    const { currentDomain, requestDomain } = data;
    if (currentDomain && requestDomain) {
      const blockedList = getBlockedDomainsForDomain(currentDomain);
      const isBlocked = blockedList.some(blockedDomain => {
        return requestDomain === blockedDomain ||
               requestDomain.endsWith('.' + blockedDomain);
      });
      return {
        blocked: isBlocked,
        blockedReason: isBlocked ? 'Domain in blocklist' : null
      };
    }
    return { blocked: false };
  });

  // 注册阻止域名
  EventBus.on('REGISTER_BLOCKED_DOMAINS', async (data) => {
    const { domain, blockedDomains } = data;
    if (domain && blockedDomains) {
      _domainBlockedData.blockedDomains[domain] = mergeAndDedupe(
        _domainBlockedData.blockedDomains[domain],
        blockedDomains
      );
      console.log(`[Background] 注册阻止域名 ${domain}:`, _domainBlockedData.blockedDomains[domain]);
      await persistDomainBlockedData();
      await updateNetworkRules();
      return { success: true };
    }
    return { success: false, error: 'Missing domain or blockedDomains' };
  });

  // 获取阻止域名数据（供 DevTools 通过 EventBus.request 调用）
  EventBus.on('GET_BLOCKED_DOMAINS', async () => {
    const currentDomainForResponse = await getCurrentTabDomain();
    console.log('[Background] EventBus GET_BLOCKED_DOMAINS - currentDomain:', currentDomainForResponse);
    const blockedDomains = getBlockedDomainsForDomain(currentDomainForResponse);
    const blockedResponseDomains = getBlockedResponseDomainsForDomain(currentDomainForResponse);
    return {
      currentDomain: currentDomainForResponse,
      blockedDomains: blockedDomains,
      blockedResponseDomains: blockedResponseDomains,
      domainScriptMap: extensionState.domainScriptMap,
      allDomainBlockedData: _domainBlockedData
    };
  });

  // 获取隐藏选择器
  EventBus.on('GET_DEFAULT_HIDE_SELECTORS', () => {
    return { success: true, selectors: [] };
  });

  EventBus.on('GET_CURRENT_HIDE_SELECTORS', () => {
    return { success: true, selectors: [] };
  });

  // 更新隐藏元素
  EventBus.on('UPDATE_HIDE_ELEMENTS', () => {
    return { success: true };
  });

  // 更新关键词
  EventBus.on('UPDATE_KEYWORDS', () => {
    return { success: true };
  });

  // 切换扩展
  EventBus.on('TOGGLE_EXTENSION', (data) => {
    console.log('[Background] TOGGLE_EXTENSION:', data.enabled);
    return { success: true };
  });

  // ========== StorageBridge 处理器 ==========
  // 存储获取
  EventBus.on('STORAGE_GET', async ({ keys, area = 'local' }) => {
    try {
      const result = await chrome.storage[area].get(keys);
      return { success: true, data: result };
    } catch (error) {
      console.error('[Background] STORAGE_GET error:', error);
      return { success: false, error: error.message };
    }
  });

  // 存储设置
  EventBus.on('STORAGE_SET', async ({ data, area = 'local' }) => {
    try {
      await chrome.storage[area].set(data);
      return { success: true };
    } catch (error) {
      console.error('[Background] STORAGE_SET error:', error);
      return { success: false, error: error.message };
    }
  });

  // 存储删除
  EventBus.on('STORAGE_REMOVE', async ({ keys, area = 'local' }) => {
    try {
      await chrome.storage[area].remove(keys);
      return { success: true };
    } catch (error) {
      console.error('[Background] STORAGE_REMOVE error:', error);
      return { success: false, error: error.message };
    }
  });

  // 存储清空
  EventBus.on('STORAGE_CLEAR', async ({ area = 'local' }) => {
    try {
      await chrome.storage[area].clear();
      return { success: true };
    } catch (error) {
      console.error('[Background] STORAGE_CLEAR error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[Background] EventBus 处理器已注册');
}

// 注册消息模板
function registerMessageTemplates() {
  // 设置变更消息模板
  EventBus.defineTemplate('SETTINGS_CHANGE', {
    schema: { required: ['key', 'value'] },
    defaults: { timestamp: Date.now() }
  });

  // 标签页消息模板
  EventBus.defineTemplate('TAB_ACTION', {
    schema: { required: ['action', 'tabId'] },
    validate: (data) => {
      const validActions = ['create', 'update', 'remove', 'activate'];
      if (!validActions.includes(data.action)) {
        return ['Invalid action'];
      }
      return null;
    }
  });

  console.log('[Background] 消息模板已注册');
}

// Ensure settings are loaded before accessing
async function ensureSettingsLoaded() {
  if (_settingsLoaded) return;
  if (_settingsLoadPromise) {
    await _settingsLoadPromise;
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINE);
    const settings = result[SETTINE] || result.settings || { debugMode: true };
    extensionState.isDebugMode = settings.debugMode || true;

    // 合并存储数据和默认配置
    const storedDomainData = settings.domainBlockedData || {
      blockedDomains: {},
      blockedResponseDomains: {}
    };

    // 如果有旧格式数据，先转换
    if (!settings.domainBlockedData && (settings.blockedDomains || settings.blockedResponseDomains)) {
      storedDomainData.blockedDomains = { '*': settings.blockedDomains || [] };
      storedDomainData.blockedResponseDomains = { '*': settings.blockedResponseDomains || [] };
    }

    // 合并并去重
    _domainBlockedData = mergeDomainBlockedData(storedDomainData, {
      blockedDomains: _defaultBlockedDomains,
      blockedResponseDomains: {}
    });

    extensionState.domainScriptMap = settings.domainScriptMap || extensionState.domainScriptMap || {};

    // Clear mock rules on startup (they should only last for one request)
    mockRules = {};
    await chrome.storage.local.set({ mockRules });

    if (extensionState.isDebugMode) {
      console.log('Settings loaded:', settings);
      console.log('Domain blocked data:', _domainBlockedData);
      console.log('Domain script map:', extensionState.domainScriptMap);
      console.log('Mock rules loaded:', Object.keys(mockRules).length, 'rules');
    }

    // Update declarative net request rules
    await updateNetworkRules();
    // Update response blocking rules
    await updateResponseBlockingRules();
    // CDN 资源重定向规则
    await updateCDNRedirectRules();
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  // Listen for extension installation
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed:', details);

    if (details.reason === 'install') {
      // Show welcome page on first install
      chrome.tabs.create({ url: 'welcome.html' });
    }

    // 无论安装还是更新，都使用延迟注入模式
    if (details.reason === 'install' || details.reason === 'update') {
      await markTabsForLazyInjection();
    }
  });

  // 监听 tab 激活事件：在 tab 激活时注入脚本
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await injectScriptsOnTabActivate(activeInfo.tabId);
  });

  // 监听窗口焦点变化：提前感知即将激活的 tab
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab && tab.id) {
        await injectScriptsOnTabActivate(tab.id);
      }
    } catch (error) {
      // 忽略错误
    }
  });


  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // 在页面加载完成时注入脚本
    if (changeInfo.status === 'complete') {
      handleTabUpdate(tabId, tab);
    }
  });

  // Listen for tab removal to clean up injection records
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const result = await chrome.storage.local.get('injectedTabs');
      const injectedTabs = result.injectedTabs || {};
      const tabKey = String(tabId);
      if (injectedTabs[tabKey]) {
        delete injectedTabs[tabKey];
        await chrome.storage.local.set({ injectedTabs });
        console.log(`[Background] 标签页 ${tabId} 已关闭，清理注入记录`);
      }
    } catch (error) {
      console.error('[Background] 清理注入记录失败:', error);
    }
  });

  // Listen for messages from other extension components
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 调试：记录所有收到的消息（带时间戳和来源）
    console.log('[Background] 收到消息:', message?.type, message, 'sender:', sender?.tab?.url || 'unknown');

    // 如果是 EventBus 消息，让 EventBus 处理器处理
    if (message && message.__eventbus__) {
      console.log('[Background] 这是 EventBus 消息，跳过');
      // EventBus 已经在 Transport.onMessage 中注册了监听器
      // 这里只需要返回 false，让其他监听器有机会处理
      return false;
    }

    console.log('[Background] 非 EventBus 消息，交给 handleMessage 处理');
    // 非 EventBus 消息，使用原有的 handleMessage
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async responses
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    handleStorageChange(changes);
  });
}


// Handle tab updates
async function handleTabUpdate(tabId, tab) {
  if (extensionState.isDebugMode) {
    console.log('Tab updated:', tabId, tab.title);
  }
  if (!tab.active) return;

  // 排除 Chrome Web Store 等受保护页面
  const protectedPatterns = [
    'chrome.google.com/webstore',
    'chromewebstore.google.com'
  ];
  const isProtected = protectedPatterns.some(pattern => tab.url?.includes(pattern));
  if (isProtected) {
    console.log(`[Background] 跳过受保护页面: ${tab.url}`);
    return;
  }

  // Only apply to specific URLs if needed
  if (tab.url && tab.status === 'complete' && tab.url.startsWith('http')) {
    // 检查是否已经注入过
    const result = await chrome.storage.local.get('injectedTabs');
    const injectedTabs = result.injectedTabs || {};
    const tabKey = String(tabId);

    // 如果已记录为手动注入过，跳过
    if (injectedTabs[tabKey]) {
      console.log(`[Background] 标签页 ${tabId} 已手动注入过，跳过`);
      return;
    }

    // 检查是否 manifest.json 已自动注入（通过检查 ExtensionAPI）
    try {
      // 先检查 tab 状态，避免在错误页面注入
      const tab = await chrome.tabs.get(tabId);
      if (!tab || tab.status === 'unloaded') {
        console.log(`[Background] 标签页 ${tabId} 未加载完成，跳过检查`);
        return;
      }

      // 检查是否是错误页面（chrome-error:// 或 about:blank 等）
      if (tab.url && (tab.url.startsWith('chrome-error://') || tab.url === 'about:blank')) {
        console.log(`[Background] 标签页 ${tabId} 是错误页面，跳过注入`);
        return;
      }

      const checkResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => typeof window.ExtensionAPI !== 'undefined'
      });

      if (checkResult && checkResult[0]?.result) {
        console.log(`[Background] 标签页 ${tabId} 已通过 manifest.json 自动注入`);
        return;
      }

      // manifest.json 没有自动注入，需要手动注入（已存在的标签页）
      console.log(`[Background] 标签页 ${tabId} 需要手动注入`);
      await injectAllScriptsForTab(tabId, tab.url);
      injectedTabs[tabKey] = Date.now();
      await chrome.storage.local.set({ injectedTabs });
    } catch (error) {
      // 特定错误处理
      if (error.message?.includes('error page') || error.message?.includes('cannot access')) {
        console.log(`[Background] 标签页 ${tabId} 无法注入（错误页面或受限页面）`);
      } else {
        console.error('[Background] 检查/注入失败:', error.message || error);
      }
    }
  }
}

// Add blocked domain for current active tab's domain
async function addBlockedDomain(domain) {
  const currentDomain = await getCurrentTabDomain();
  if (!currentDomain) return false;

  if (!_domainBlockedData.blockedDomains[currentDomain]) {
    _domainBlockedData.blockedDomains[currentDomain] = [];
  }

  if (!_domainBlockedData.blockedDomains[currentDomain].includes(domain)) {
    _domainBlockedData.blockedDomains[currentDomain].push(domain);
    await persistDomainBlockedData();
    await updateNetworkRules();
    return true;
  }
  return false;
}

// Remove blocked domain for current active tab's domain
async function removeBlockedDomain(domain) {
  const currentDomain = await getCurrentTabDomain();
  if (!currentDomain) return false;

  if (_domainBlockedData.blockedDomains[currentDomain]) {
    const index = _domainBlockedData.blockedDomains[currentDomain].indexOf(domain);
    if (index > -1) {
      _domainBlockedData.blockedDomains[currentDomain].splice(index, 1);
      await persistDomainBlockedData();
      await updateNetworkRules();
      return true;
    }
  }
  return false;
}

// Add blocked response domain for current active tab's domain
async function addBlockedResponseDomain(domain) {
  const currentDomain = await getCurrentTabDomain();
  if (!currentDomain) return false;

  if (!_domainBlockedData.blockedResponseDomains[currentDomain]) {
    _domainBlockedData.blockedResponseDomains[currentDomain] = [];
  }

  if (!_domainBlockedData.blockedResponseDomains[currentDomain].includes(domain)) {
    _domainBlockedData.blockedResponseDomains[currentDomain].push(domain);
    await persistDomainBlockedData();

    if (extensionState.isDebugMode) {
      console.log('Added blocked response domain for', currentDomain, ':', domain);
    }
    return true;
  }
  return false;
}

// Remove blocked response domain for current active tab's domain
async function removeBlockedResponseDomain(domain) {
  const currentDomain = await getCurrentTabDomain();
  if (!currentDomain) return false;

  if (_domainBlockedData.blockedResponseDomains[currentDomain]) {
    const index = _domainBlockedData.blockedResponseDomains[currentDomain].indexOf(domain);
    if (index > -1) {
      _domainBlockedData.blockedResponseDomains[currentDomain].splice(index, 1);
      await persistDomainBlockedData();

      if (extensionState.isDebugMode) {
        console.log('Removed blocked response domain for', currentDomain, ':', domain);
      }
      return true;
    }
  }
  return false;
}

// Check if domain should be blocked based on current page
function shouldBlockRequest(domain, url) {
  // Get the current active tab to determine the source domain
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const currentUrl = new URL(tabs[0].url);
        const currentDomain = currentUrl.hostname;

        // Check if the request is being made from a blocked domain
        const isFromBlockedDomain = extensionState.blockedDomains.some(blockedDomain => {
          return currentDomain.includes(blockedDomain) || blockedDomain.includes(currentDomain);
        });

        // Check if the request is to a blocked domain
        const isToBlockedDomain = extensionState.blockedDomains.some(blockedDomain => {
          return url.includes(blockedDomain) || url.includes(`.${blockedDomain}`);
        });

        resolve(isFromBlockedDomain || isToBlockedDomain);
      } else {
        resolve(false);
      }
    });
  });
}

// Intercept API requests to block responses from specific domains
async function interceptAPIRequest(url, tabUrl) {
  // Check if domain should be blocked
  const shouldBlock = extensionState.blockedDomains.some(domain => {
    return url.includes(domain) || url.includes(`.${domain}`) ||
      tabUrl.includes(domain) || tabUrl.includes(`.${domain}`);
  });

  if (shouldBlock) {
    if (extensionState.isDebugMode) {
      console.log(`API request blocked: ${url}`);
    }
    return { blocked: true, error: 'API request blocked by extension' };
  }

  return { blocked: false };
}

// Add domain script mapping entry
function addDomainScriptEntry(domain, scriptFiles) {
  if (!extensionState.domainScriptMap[domain]) {
    extensionState.domainScriptMap[domain] = scriptFiles;

    (async () => {
      const settings = await chrome.storage.sync.get(SETTINE);
      const currentSettings = settings.settings || {};
      await chrome.storage.sync.set({
        settings: {
          ...currentSettings,
          domainScriptMap: extensionState.domainScriptMap
        }
      });

      if (extensionState.isDebugMode) {
        console.log('Added script entry for domain:', domain, scriptFiles);
      }
    })();

    return true;
  }
  return false;
}

// Remove domain script mapping entry
function removeDomainScriptEntry(domain) {
  if (extensionState.domainScriptMap[domain]) {
    delete extensionState.domainScriptMap[domain];

    (async () => {
      const settings = await chrome.storage.sync.get(SETTINE);
      const currentSettings = settings.settings || {};
      await chrome.storage.sync.set({
        settings: {
          ...currentSettings,
          domainScriptMap: extensionState.domainScriptMap
        }
      });

      if (extensionState.isDebugMode) {
        console.log('Removed script entry for domain:', domain);
      }
    })();

    return true;
  }
  return false;
}

// Get scripts to inject for current domain
function getScriptsForDomain(domain) {
  // Use includes for flexible domain matching (subdomains)
  // e.g., "www.douyin.com" matches "douyin.com"
  // "douyin.com" matches "douyin.com"
  // But only return the first match to avoid duplicates
  for (const [key, scripts] of Object.entries(extensionState.domainScriptMap)) {
    // Check if domain matches key (supports subdomain matching)
    if (domain.includes(key) || key.includes(domain)) {
      return scripts;
    }
  }
  return [];
}

// Inject scripts for matching domain
async function injectScriptsForTab(tabId, tabUrl) {
  try {
    // 检查 URL 是否允许注入（跳过特殊页面）
    if (!tabUrl || !tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
      return;
    }

    const currentDomain = new URL(tabUrl).hostname;
    const scriptsToInject = getScriptsForDomain(currentDomain);
    console.log('Scripts to inject for domain:', currentDomain, scriptsToInject);

    if (scriptsToInject.length > 0) {
      if (extensionState.isDebugMode) {
        console.log(`Injecting scripts for domain: ${currentDomain}`, scriptsToInject);
      }
      // Inject each script file individually
      for (const scriptFile of scriptsToInject) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [scriptFile]
          });
        } catch (error) {
          console.error(`Error injecting script ${scriptFile}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error injecting scripts:', error);
  }
}

// 标记需要延迟注入的 tab（扩展安装/更新时调用）
async function markTabsForLazyInjection() {
  try {
    const tabs = await chrome.tabs.query({});
    console.log('[Background] 扩展更新，标记需要延迟注入的标签页');

    // 获取当前注入记录
    const result = await chrome.storage.local.get(['injectedTabs', 'pendingInjectionTabs']);
    const injectedTabs = result.injectedTabs || {};
    const pendingTabs = result.pendingInjectionTabs || {};
    const now = Date.now();

    // 清理旧记录
    for (const [tabId, timestamp] of Object.entries(injectedTabs)) {
      if (now - timestamp > 3600000) {
        delete injectedTabs[tabId];
      }
    }

    // 标记所有 http/https tab 为待注入（排除已注入的）
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith('http')) {
        const tabKey = String(tab.id);
        // 清除旧的注入记录，强制重新注入
        delete injectedTabs[tabKey];
        // 标记为待注入
        pendingTabs[tabKey] = { url: tab.url, timestamp: now };

        // 如果是当前激活的 tab，立即注入
        if (tab.active) {
          try {
            await injectAllScriptsForTab(tab.id, tab.url);
            injectedTabs[tabKey] = now;
            delete pendingTabs[tabKey];
            console.log(`[Background] 激活标签页 ${tab.id} 已立即注入`);
          } catch (error) {
            console.log(`[Background] 无法注入激活标签页 ${tab.id}:`, error.message);
          }
        }
      }
    }

    await chrome.storage.local.set({ injectedTabs, pendingInjectionTabs: pendingTabs });
    console.log('[Background] 已标记', Object.keys(pendingTabs).length, '个标签页待注入');
  } catch (error) {
    console.error('[Background] 标记待注入标签页失败:', error);
  }
}

// 在 tab 激活时注入脚本
async function injectScriptsOnTabActivate(tabId) {
  try {
    // 获取 tab 信息
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      return;
    }

    // 排除受保护页面
    const protectedPatterns = [
      'chrome.google.com/webstore',
      'chromewebstore.google.com'
    ];
    const isProtected = protectedPatterns.some(pattern => tab.url?.includes(pattern));
    if (isProtected) {
      return;
    }

    // 检查错误页面
    if (tab.url.startsWith('chrome-error://') || tab.url === 'about:blank') {
      return;
    }

    // 实际检查页面中脚本是否已注入（而非仅依赖 storage 记录）
    // 这解决了浏览器重启后 storage 记录存在但脚本实际未注入的问题
    try {
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => typeof window.ExtensionAPI !== 'undefined'
      });

      if (checkResult && checkResult[0]?.result) {
        // 脚本已注入，更新记录并跳过
        const result = await chrome.storage.local.get(['injectedTabs']);
        const injectedTabs = result.injectedTabs || {};
        injectedTabs[String(tabId)] = Date.now();
        await chrome.storage.local.set({ injectedTabs });
        return;
      }
    } catch (checkError) {
      // 无法检查（可能是错误页面），跳过
      return;
    }

    // 脚本未注入，执行注入
    console.log(`[Background] Tab ${tabId} 激活，检测到脚本未注入，开始注入`);
    await injectAllScriptsForTab(tabId, tab.url);

    // 更新记录
    const result = await chrome.storage.local.get(['injectedTabs', 'pendingInjectionTabs']);
    const injectedTabs = result.injectedTabs || {};
    const pendingTabs = result.pendingInjectionTabs || {};
    const tabKey = String(tabId);
    injectedTabs[tabKey] = Date.now();
    delete pendingTabs[tabKey];
    await chrome.storage.local.set({ injectedTabs, pendingInjectionTabs: pendingTabs });
  } catch (error) {
    // tab 可能已关闭
    console.log(`[Background] Tab ${tabId} 注入失败:`, error.message);
  }
}

// 完整注入所有脚本（模拟 manifest.json 的 content_scripts 行为）
async function injectAllScriptsForTab(tabId, tabUrl) {
  try {
    // 检查 URL 是否允许注入（跳过特殊页面）
    if (!tabUrl || !tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
      console.log(`[Background] 跳过非 HTTP(S) 页面: ${tabUrl}`);
      return;
    }

    // 排除 Chrome Web Store 等受保护页面
    const protectedPatterns = [
      'chrome.google.com/webstore',
      'chromewebstore.google.com'
    ];
    const isProtected = protectedPatterns.some(pattern => tabUrl?.includes(pattern));
    if (isProtected) {
      console.log(`[Background] 跳过受保护页面: ${tabUrl}`);
      return;
    }

    // 检查 tab 状态
    const tab = await chrome.tabs.get(tabId);
    if (!tab || tab.status === 'unloaded') {
      console.log(`[Background] 标签页 ${tabId} 未加载完成，跳过注入`);
      return;
    }

    // 检查是否是错误页面
    if (tab.url && (tab.url.startsWith('chrome-error://') || tab.url === 'about:blank')) {
      console.log(`[Background] 跳过错误页面: ${tab.url}`);
      return;
    }

    // 检查基础脚本是否已注入（core-bundle.js 由 manifest.json 自动注入）
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return typeof window.ExtensionAPI !== 'undefined';
      }
    });

    const baseAlreadyInjected = checkResult && checkResult[0]?.result;

    const url = new URL(tabUrl);
    const hostname = url.hostname;

    // 打包后的 bundle 脚本（所有页面都需要）
    const baseScripts = [
      'content/core-bundle.js',
      'content/common-bundle.js'
    ];

    // 域名特定脚本映射（使用打包后的 bundle）
    const domainScripts = {
      'bilibili.com': ['content/bundled/bili.bundle.js'],
      'douyin.com': ['content/bundled/douyin.bundle.js'],
      '4hu.tv': ['content/bundled/4hu.bundle.js'],
      'weread.qq.com': ['content/bundled/weread.bundle.js'],
      'quark.cn': ['content/bundled/quark.bundle.js'],
      '18comic.vip': ['content/bundled/comic18.bundle.js'],
      'aliyundrive.com': ['content/bundled/aliyun.bundle.js'],
      'baidu.com': ['content/bundled/baiduPan.bundle.js'],
      'zhipin.com': ['content/bundled/boss.bundle.js'],
      'xiaohongshu.com': ['content/bundled/xiaohongshu.bundle.js'],
      'wyaqpx.com': ['content/bundled/dianGong.bundle.js'],
      'ymmfa.com': ['content/bundled/gongkong.bundle.js'],
      'youtube.com': ['content/bundled/youtube.bundle.js'],
      'github.com': ['content/bundled/github.bundle.js'],
      'modelscope.cn': ['content/bundled/modelscope.bundle.js']
    };

    // 收集需要注入的脚本：基础脚本仅未注入时添加，域名脚本始终尝试注入
    const scriptsToInject = [];

    if (!baseAlreadyInjected) {
      scriptsToInject.push(...baseScripts);
    }

    // 域名特定脚本始终尝试注入（各脚本有自己的防重复加载机制）
    for (const [domain, scripts] of Object.entries(domainScripts)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        scriptsToInject.push(...scripts);
        console.log(`[Background] 为 ${hostname} 添加域名脚本:`, scripts);
        break;
      }
    }

    if (scriptsToInject.length === 0) {
      console.log(`[Background] 标签页 ${tabId} 脚本已存在且无域名脚本，跳过注入`);
      return;
    }

    // 依次注入所有脚本
    for (const scriptFile of scriptsToInject) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [scriptFile]
        });
        console.log(`[Background] 已注入脚本: ${scriptFile} 到标签页 ${tabId}`);
      } catch (error) {
        console.error(`[Background] 注入脚本失败 ${scriptFile}:`, error);
      }
    }

    console.log(`[Background] 标签页 ${tabId} (${hostname}) 脚本注入完成`);
  } catch (error) {
    console.error('[Background] 注入脚本时出错:', error);
  }
}

// Handle runtime messages
async function handleMessage(message, sender, sendResponse) {
  if (extensionState.isDebugMode) {
    console.log('Background received message:', message);
  }

  try {
    switch (message.type) {
    // ========== 文件下载 ==========
    case 'DOWNLOAD_FILE':
      console.log('[Background] 收到下载请求:', message.url);
      try {
        chrome.downloads.download({
          url: message.url,
          filename: message.fileName,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('[Background] 下载失败:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[Background] 下载已开始, downloadId:', downloadId);
            sendResponse({ success: true, downloadId });
          }
        });
      } catch (error) {
        console.error('[Background] 下载异常:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // 保持消息通道开放

    // ========== 懒初始化激活消息 ==========
    case 'EXTENSION_ACTIVATE':
      // popup 打开时激活当前 tab 的 content script
      console.log('[Background] 收到激活请求，来源:', message.source);
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // 检查是否是特殊页面（无法注入 content script）
          if (tab.url && (
            tab.url.startsWith('chrome://') ||
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('edge://')
          )) {
            console.log('[Background] 跳过特殊页面:', tab.url);
            sendResponse({ success: false, error: 'Cannot activate on special pages' });
            break;
          }

          // 尝试发送激活消息，带重试机制
          let retries = 3;
          let lastError = null;

          while (retries > 0) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_ACTIVATE',
                source: message.source || 'popup'
              });
              console.log('[Background] 激活成功, tabId:', tab.id);
              sendResponse({ success: true, tabId: tab.id });
              break;
            } catch (error) {
              lastError = error;
              retries--;

              // 如果是 "Receiving end does not exist" 错误，等待后重试
              if (error.message?.includes('Receiving end does not exist') && retries > 0) {
                console.log(`[Background] content script 未就绪，等待重试 (剩余 ${retries} 次)`);
                await new Promise(resolve => setTimeout(resolve, 500));
              } else {
                throw error;
              }
            }
          }

          if (retries === 0) {
            throw lastError;
          }
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (error) {
        console.error('[Background] 激活失败:', error.message);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'DEVTOOLS_ACTIVATE':
      // DevTools 打开时激活对应 tab 的 content script
      console.log('[Background] 收到 DevTools 激活请求, tabId:', message.tabId);
      try {
        if (message.tabId) {
          // 注入 page-helper.js
          await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            files: ['content/devtools/page-helper.js']
          });
          console.log('[Background] page-helper.js 已注入');

          // 发送激活消息
          await chrome.tabs.sendMessage(message.tabId, {
            type: 'DEVTOOLS_ACTIVATE',
            source: 'devtools'
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Missing tabId' });
        }
      } catch (error) {
        console.error('[Background] DevTools 激活失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'GET_EXTENSION_INFO':
      const currentDomainForInfo = await getCurrentTabDomain();
      sendResponse({
        name: chrome.runtime.getManifest().name,
        version: chrome.runtime.getManifest().version,
        enabled: true,
        currentDomain: currentDomainForInfo,
        blockedDomains: getBlockedDomainsForDomain(currentDomainForInfo),
        blockedResponseDomains: getBlockedResponseDomainsForDomain(currentDomainForInfo)
      });
      break;

    case 'PERFORM_API_CALL':
      // Get current tab to check if request should be blocked based on current domain
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          const tabDomain = new URL(tabs[0].url).hostname;
          const requestDomain = new URL(message.url).hostname;

          // Check if current domain or request domain is blocked
          const isDomainBlocked = extensionState.blockedDomains.some(blockedDomain => {
            return tabDomain.includes(blockedDomain) || blockedDomain.includes(tabDomain) ||
              requestDomain.includes(blockedDomain) || blockedDomain.includes(requestDomain);
          });

          if (isDomainBlocked) {
            sendResponse({
              success: false,
              error: 'API request blocked - domain in blocked list',
              blocked: true,
              domain: tabDomain,
              requestDomain: requestDomain
            });
            return;
          }

          // If not blocked, proceed with the request
          try {
            const response = await fetch(message.url, {
              method: message.method || 'GET',
              headers: message.headers || {},
              body: message.body
            });
            const data = await response.json();
            sendResponse({ success: true, data });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        } else {
          // No active tab, proceed without blocking
          try {
            const response = await fetch(message.url, {
              method: message.method || 'GET',
              headers: message.headers || {},
              body: message.body
            });
            const data = await response.json();
            sendResponse({ success: true, data });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }
      });
      return true; // Keep message channel open for async response

    case 'SET_DEBUG_MODE':
      extensionState.isDebugMode = message.enabled;
      await loadSettings();
      sendResponse({ success: true });
      break;

    case 'GET_DEBUG_MODE':
      sendResponse({ enabled: extensionState.isDebugMode });
      break;

    case 'ADD_BLOCKED_DOMAIN':
      const addResult = await addBlockedDomain(message.domain);
      const currentDomain1 = await getCurrentTabDomain();
      sendResponse({
        success: addResult,
        currentDomain: currentDomain1,
        domains: getBlockedDomainsForDomain(currentDomain1)
      });
      break;

    case 'REMOVE_BLOCKED_DOMAIN':
      const removeResult = await removeBlockedDomain(message.domain);
      const currentDomain2 = await getCurrentTabDomain();
      sendResponse({
        success: removeResult,
        currentDomain: currentDomain2,
        domains: getBlockedDomainsForDomain(currentDomain2)
      });
      break;

    case 'CHECK_DOMAIN_BLOCKED':
      // 检查请求域名是否被阻止
      if (message.currentDomain && message.requestDomain) {
        const blockedList = getBlockedDomainsForDomain(message.currentDomain);
        const isBlocked = blockedList.some(blockedDomain => {
          return message.requestDomain === blockedDomain ||
                 message.requestDomain.endsWith('.' + blockedDomain);
        });
        sendResponse({
          blocked: isBlocked,
          blockedReason: isBlocked ? 'Domain in blocklist' : null,
          blockedDomains: blockedList
        });
      } else {
        sendResponse({ blocked: false, error: 'Missing domains' });
      }
      break;

    case 'GET_BLOCKED_DOMAINS':
      const currentDomainForResponse = await getCurrentTabDomain();
      console.log('[Background] GET_BLOCKED_DOMAINS - currentDomain:', currentDomainForResponse);
      console.log('[Background] _domainBlockedData:', JSON.stringify(_domainBlockedData));
      const blockedDomains = getBlockedDomainsForDomain(currentDomainForResponse);
      const blockedResponseDomains = getBlockedResponseDomainsForDomain(currentDomainForResponse);
      console.log('[Background] blockedDomains:', blockedDomains);
      console.log('[Background] blockedResponseDomains:', blockedResponseDomains);
      sendResponse({
        currentDomain: currentDomainForResponse,
        blockedDomains: blockedDomains,
        blockedResponseDomains: blockedResponseDomains,
        domainScriptMap: extensionState.domainScriptMap,
        allDomainBlockedData: _domainBlockedData
      });
      break;

    case 'ADD_DOMAIN_SCRIPT_ENTRY':
      const addEntryResult = await addDomainScriptEntry(message.domain, message.scripts);
      sendResponse({ success: addEntryResult, domainScriptMap: extensionState.domainScriptMap });
      break;

    case 'REMOVE_DOMAIN_SCRIPT_ENTRY':
      const removeEntryResult = await removeDomainScriptEntry(message.domain);
      sendResponse({ success: removeEntryResult, domainScriptMap: extensionState.domainScriptMap });
      break;

    case 'GET_DOMAIN_SCRIPT_MAP':
      sendResponse({ domainScriptMap: extensionState.domainScriptMap });
      break;

    case 'REGISTER_BLOCKED_DOMAINS':
      // 注册 content script 的 blockedDomains 配置（合并去重）
      if (message.domain && message.blockedDomains) {
        _domainBlockedData.blockedDomains[message.domain] = mergeAndDedupe(
          _domainBlockedData.blockedDomains[message.domain],
          message.blockedDomains
        );
        console.log(`[Extension] Registered blockedDomains for ${message.domain}:`, _domainBlockedData.blockedDomains[message.domain]);
        // 持久化到 storage
        await persistDomainBlockedData();
        // 更新网络规则
        await updateNetworkRules();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Missing domain or blockedDomains' });
      }
      break;

    case 'ADD_BLOCKED_RESPONSE_DOMAIN':
      const addResponseResult = await addBlockedResponseDomain(message.domain);
      const currentDomain3 = await getCurrentTabDomain();
      sendResponse({
        success: addResponseResult,
        currentDomain: currentDomain3,
        domains: getBlockedResponseDomainsForDomain(currentDomain3)
      });
      break;

    case 'REMOVE_BLOCKED_RESPONSE_DOMAIN':
      const removeResponseResult = await removeBlockedResponseDomain(message.domain);
      const currentDomain4 = await getCurrentTabDomain();
      sendResponse({
        success: removeResponseResult,
        currentDomain: currentDomain4,
        domains: getBlockedResponseDomainsForDomain(currentDomain4)
      });
      break;

    case 'BLOCK_API_CALL':
      // Try to block the request
      try {
        const response = await fetch(message.url, {
          method: message.method || 'GET',
          headers: message.headers || {},
          body: message.body
        });
        // If we get here, the request wasn't blocked by declarative rules
        const data = await response.json();
        sendResponse({ success: true, data, blocked: false });
      } catch (error) {
        // Request was likely blocked
        sendResponse({ success: false, error: error.message, blocked: true });
      }
      break;

    case 'REGISTER_MOCK':
      // Register a mock rule (simple URL -> response mapping)
      if (message.url && message.response !== undefined) {
        mockRules[message.url] = message.response;
        console.log('[Mock] Registered mock for:', message.url);
        chrome.storage.local.set({ mockRules }).catch(() => {});
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Missing url or response' });
      }
      break;

    case 'UNREGISTER_MOCK':
      // Remove a mock rule
      if (message.url) {
        delete mockRules[message.url];
        console.log('[Mock] Unregistered mock for:', message.url);
        chrome.storage.local.set({ mockRules }).catch(() => {});
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Missing url' });
      }
      break;

    case 'GET_MOCK_RULES':
      sendResponse({ success: true, rules: mockRules });
      break;

    case 'CLEAR_MOCK_RULES':
      mockRules = {};
      chrome.storage.local.set({ mockRules }).catch(() => {});
      sendResponse({ success: true });
      break;

    case 'CHECK_MOCK':
      // Check if a URL has a mock rule
      const mockEntry = mockRules[message.url];
      if (mockEntry && mockEntry.enabled) {
        sendResponse({
          hasMock: true,
          response: mockEntry.response,
          statusCode: mockEntry.statusCode,
          contentType: mockEntry.contentType
        });
      } else {
        sendResponse({ hasMock: false });
      }
      break;

    case 'GET_MEMORY_INFO':
      // 获取当前标签页的性能和内存信息
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          // 在页面中执行脚本获取内存信息
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              const info = {};

              // JS堆内存信息
              if (performance.memory) {
                info.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
                info.totalJSHeapSize = performance.memory.totalJSHeapSize;
                info.usedJSHeapSize = performance.memory.usedJSHeapSize;
              }

              // 导航计时
              if (performance.getEntriesByType) {
                const navigation = performance.getEntriesByType('navigation')[0];
                if (navigation) {
                  info.domContentLoaded = navigation.domContentLoadedEventEnd;
                  info.loadComplete = navigation.loadEventEnd;
                  info.domInteractive = navigation.domInteractive;
                  info.transferSize = navigation.transferSize;
                  info.encodedBodySize = navigation.encodedBodySize;
                  info.decodedBodySize = navigation.decodedBodySize;
                }

                // 资源信息
                const resources = performance.getEntriesByType('resource');
                info.resourceCount = resources.length;
                info.resourceSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
              }

              return info;
            }
          });

          if (results && results[0]) {
            sendResponse({ success: true, data: results[0].result });
          } else {
            sendResponse({ success: false, error: 'No result from script' });
          }
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (error) {
        console.error('[Background] Error getting memory info:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'CLEANUP_COOKIES':
      // 清理当前页面的cookies
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url) {
          const url = new URL(tabs[0].url);
          const cookies = await chrome.cookies.getAll({ domain: url.hostname });
          let count = 0;
          for (const cookie of cookies) {
            await chrome.cookies.remove({
              url: `${url.protocol}//${cookie.domain}${cookie.path}`,
              name: cookie.name
            });
            count++;
          }
          sendResponse({ success: true, count });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (error) {
        console.error('[Background] Error cleaning cookies:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'CLEAR_BROWSING_DATA':
      // Clear browsing data - handled in background script
      console.log('[Background] 收到清除数据请求:', message);
      try {
        // chrome.browsingData.remove requires {since: number} as first parameter
        await chrome.browsingData.remove({ since: message.data.since }, message.data.dataTypes);
        console.log('[清除数据] 已清除:', message.data.dataTypes);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[清除数据] 清除失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'LOCAL_SERVER_FETCH':
      // 代理 fetch 请求到本地服务
      try {
        const response = await fetch(message.url, {
          method: message.method || 'GET',
          headers: message.headers || {},
          body: message.body ? JSON.stringify(message.body) : undefined
        });
        const data = await response.json();
        sendResponse({ success: true, data, status: response.status });
      } catch (error) {
        console.error('[本地服务] 请求失败:', error.message);
        sendResponse({ success: false, error: error.message });
      }
      break;

    // ========== 元素拾取器消息处理 ==========
    case 'PICKER_MESSAGE_RELAY':
      // 转发元素拾取器消息到 DevTools 面板
      console.log('[Background] 收到 PICKER_MESSAGE_RELAY:', message.data?.type);
      try {
        // 从 sender 获取 tabId
        const senderTabId = sender.tab ? sender.tab.id : null;
        console.log('[Background] senderTabId:', senderTabId,
                    'EventBus.ports:', EventBus?.Transport?.ports ? Array.from(EventBus.Transport.ports.keys()) : 'N/A',
                    'devtoolsPorts:', Array.from(devtoolsPorts.keys()));

        if (senderTabId) {
          // 直接通过 Port 推送到 DevTools
          const pushed = pushToDevTools(senderTabId, message.data);
          console.log('[Background] 推送结果:', pushed);

          if (!pushed) {
            // Port 不可用，存储消息作为备用
            if (!globalThis._pickerMessages) {
              globalThis._pickerMessages = {};
            }
            if (!globalThis._pickerMessages[senderTabId]) {
              globalThis._pickerMessages[senderTabId] = [];
            }
            globalThis._pickerMessages[senderTabId].push({
              ...message.data,
              timestamp: Date.now()
            });
            // 只保留最近 50 条消息
            if (globalThis._pickerMessages[senderTabId].length > 50) {
              globalThis._pickerMessages[senderTabId] = globalThis._pickerMessages[senderTabId].slice(-50);
            }
          }
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] PICKER_MESSAGE_RELAY 错误:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'GET_PICKER_MESSAGES':
      // DevTools 获取待处理的消息
      const tabIdForMessages = message.tabId;
      const since = message.since || 0;
      // _pickerMessages 结构为 { [tabId]: [...] }，不是数组
      const messages = (globalThis._pickerMessages?.[tabIdForMessages] || [])
        .filter(m => m.timestamp > since);
      sendResponse({ success: true, messages });
      break;

    case 'CLEAR_PICKER_MESSAGES':
      // 清除消息
      globalThis._pickerMessages = [];
      sendResponse({ success: true });
      break;

    case 'INJECT_PICKER_LISTENER':
      // 在 content script 世界中注入 element-picker-message 转发器
      try {
        const targetTabId = message.tabId || (sender.tab ? sender.tab.id : null);
        if (!targetTabId) {
          sendResponse({ success: false, error: 'No tabId' });
          break;
        }
        await chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          func: () => {
            if (window._pickerMessageListenerSet) return;
            document.addEventListener('element-picker-message', (event) => {
              const message = event.detail;
              if (message) {
                chrome.runtime.sendMessage({
                  type: 'PICKER_MESSAGE_RELAY',
                  data: message
                }).catch(() => {});
              }
            });
            window._pickerMessageListenerSet = true;
          }
        });
        console.log('[Background] 已注入 picker 消息转发器, tabId:', targetTabId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] 注入 picker 消息转发器失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'START_ELEMENT_PICKER':
      // 启动元素拾取器
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          // 先注入脚本
          await chrome.scripting.executeScript({
            files: ['content/element-picker-inject.js'],
            target: { tabId: tabs[0].id }
          });
          // 等待脚本加载
          await new Promise(resolve => setTimeout(resolve, 100));
          // 发送启动命令
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_ELEMENT_PICKER' });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (error) {
        console.error('[ElementPicker] 启动失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'STOP_ELEMENT_PICKER':
      // 停止元素拾取器
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_ELEMENT_PICKER' });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (error) {
        console.error('[ElementPicker] 停止失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'EVENTBUS_DEVTOOLS_LOG':
      // 从 content script 接收 EventBus 事件并转发到 DevTools
      if (message.events && Array.isArray(message.events)) {
        const senderTabId = sender.tab?.id;
        if (senderTabId) {
          // 批量转发事件到对应 tab 的 DevTools
          for (const event of message.events) {
            pushToDevTools(senderTabId, {
              type: event.type,
              direction: event.direction,
              data: event.data,
              from: event.from,
              fromEnv: event.fromEnv,
              timestamp: event.timestamp,
              id: event.id
            });
          }
        }
      }
      sendResponse({ success: true });
      break;

    case 'GET_HIDE_ELEMENTS_SETTINGS':
      // 获取当前域名的隐藏元素设置
      try {
        const domain = await getCurrentTabDomain();
        const result = await chrome.storage.local.get(['hideElementsSettings']);
        const allSettings = result.hideElementsSettings || {};
        const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };
        sendResponse({
          success: true,
          domain,
          settings: domainSettings
        });
      } catch (error) {
        console.error('[HideElements] 获取设置失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'UPDATE_HIDE_ELEMENTS_SETTINGS':
      // 更新隐藏元素设置
      try {
        const domain = await getCurrentTabDomain();
        if (!domain) {
          sendResponse({ success: false, error: 'Cannot determine domain' });
          break;
        }

        const result = await chrome.storage.local.get(['hideElementsSettings']);
        const allSettings = result.hideElementsSettings || {};

        allSettings[domain] = {
          enabled: message.enabled ?? true,
          selectors: message.selectors || []
        };

        await chrome.storage.local.set({ hideElementsSettings: allSettings });

        // 通知 content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_HIDE_ELEMENTS',
            enabled: allSettings[domain].enabled,
            selectors: allSettings[domain].selectors
          }).catch(() => {
            // Content script may not be loaded
          });
        }

        sendResponse({ success: true, settings: allSettings[domain] });
      } catch (error) {
        console.error('[HideElements] 更新设置失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'ADD_HIDE_SELECTOR':
      // 添加单个隐藏选择器
      try {
        const domain = await getCurrentTabDomain();
        if (!domain) {
          sendResponse({ success: false, error: 'Cannot determine domain' });
          break;
        }

        const result = await chrome.storage.local.get(['hideElementsSettings']);
        const allSettings = result.hideElementsSettings || {};
        const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

        if (!domainSettings.selectors.includes(message.selector)) {
          domainSettings.selectors.push(message.selector);
          domainSettings.enabled = true;
          allSettings[domain] = domainSettings;
          await chrome.storage.local.set({ hideElementsSettings: allSettings });

          // 通知 content script
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'UPDATE_HIDE_ELEMENTS',
              enabled: domainSettings.enabled,
              selectors: domainSettings.selectors
            }).catch(() => {});
          }
        }

        sendResponse({ success: true, settings: domainSettings });
      } catch (error) {
        console.error('[HideElements] 添加选择器失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'REMOVE_HIDE_SELECTOR':
      // 移除单个隐藏选择器
      try {
        const domain = await getCurrentTabDomain();
        if (!domain) {
          sendResponse({ success: false, error: 'Cannot determine domain' });
          break;
        }

        const result = await chrome.storage.local.get(['hideElementsSettings']);
        const allSettings = result.hideElementsSettings || {};
        const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

        const index = domainSettings.selectors.indexOf(message.selector);
        if (index > -1) {
          domainSettings.selectors.splice(index, 1);
          allSettings[domain] = domainSettings;
          await chrome.storage.local.set({ hideElementsSettings: allSettings });

          // 通知 content script
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'UPDATE_HIDE_ELEMENTS',
              enabled: domainSettings.enabled,
              selectors: domainSettings.selectors
            }).catch(() => {});
          }
        }

        sendResponse({ success: true, settings: domainSettings });
      } catch (error) {
        console.error('[HideElements] 移除选择器失败:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'ELEMENT_SELECTION_CHANGED':
      // 转发元素选择变化消息到 DevTools 面板
      console.log('[Background] 收到 ELEMENT_SELECTION_CHANGED:', message);
      if (sender.tab && sender.tab.id) {
        const tabId = sender.tab.id;
        console.log('[Background] 来源 tabId:', tabId);

        // 尝试通过 port 发送
        const port = devtoolsPorts.get(tabId);
        if (port) {
          console.log('[Background] 找到 port, 发送 batch-selection-update');
          try {
            port.postMessage({
              type: 'batch-selection-update',
              selectors: message.elements?.map(el => ({
                selector: el.selector,
                tag: el.tagName
              })) || []
            });
          } catch (e) {
            console.warn('[Background] Port 发送失败:', e);
            devtoolsPorts.delete(tabId);
          }
        } else {
          console.log('[Background] 未找到 port, 当前注册的 ports:', Array.from(devtoolsPorts.keys()));
        }
      }
      sendResponse({ success: true });
      break;

    // 元素被选中消息（来自 content.js，转发给 popup）
    case 'ELEMENT_PICKED':
      // 这个消息主要用于通知 popup 有新元素被选中
      // 如果 popup 打开着，它会通过 chrome.runtime.onMessage 监听
      // 这里只需要返回成功即可
      console.log('[Background] 收到 ELEMENT_PICKED:', message.data?.selector);
      sendResponse({ success: true });
      break;

    // 在侧边栏/拆分视图中打开链接
    case 'OPEN_IN_SIDE_PANEL':
      console.log('[Background] 收到 OPEN_IN_SIDE_PANEL:', message.url);
      (async () => {
        try {
          // 获取当前窗口信息
          const currentWindow = await chrome.windows.getCurrent();
          const screenWidth = currentWindow.width || 1920;
          const screenHeight = currentWindow.height || 1080;
          const left = currentWindow.left || 0;
          const top = currentWindow.top || 0;

          // 创建侧边窗口（模拟拆分视图效果）
          // 宽度约为屏幕的 30%，最小 400px
          const panelWidth = Math.max(400, Math.floor(screenWidth * 0.3));

          await chrome.windows.create({
            url: message.url,
            type: 'popup',
            width: panelWidth,
            height: screenHeight,
            left: left + screenWidth - panelWidth,
            top: top,
            focused: true
          });

          console.log('[Background] 已在侧边窗口打开:', message.url);
          sendResponse({ success: true, method: 'sideWindow' });
        } catch (error) {
          console.error('[Background] OPEN_IN_SIDE_PANEL 失败:', error);
          // 出错时回退到新标签页
          chrome.tabs.create({ url: message.url });
          sendResponse({ success: true, method: 'newTab' });
        }
      })();
      return true; // 保持消息通道开放

    // ========== 统计数据消息处理 ==========
    case 'GET_STATS':
      sendResponse({ success: true, stats: getStats() });
      break;

    case 'RESET_STATS':
      resetStats();
      sendResponse({ success: true });
      break;

    case 'RECORD_HIDDEN_ELEMENT':
      if (message.domain && message.count) {
        recordHiddenElement(message.domain, message.count);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Missing domain or count' });
      }
      break;

    // ========== 剪贴板历史记录 ==========
    case 'RECORD_CLIPBOARD':
      if (message.text) {
        // 存储剪贴板历史
        const result = await chrome.storage.local.get('clipboardHistory');
        const history = result.clipboardHistory || [];

        // 添加新记录（避免重复）
        const newEntry = {
          text: message.text,
          timestamp: message.timestamp || Date.now(),
          url: message.url || ''
        };

        // 检查是否与最近一条重复
        if (history.length > 0 && history[0].text === message.text) {
          sendResponse({ success: true, duplicate: true });
          break;
        }

        // 添加到开头，限制历史数量
        history.unshift(newEntry);
        if (history.length > 100) {
          history.pop();
        }

        await chrome.storage.local.set({ clipboardHistory: history });
        console.log('[Background] 剪贴板已记录, 当前历史数:', history.length);
        sendResponse({ success: true, count: history.length });
      } else {
        sendResponse({ success: false, error: 'Missing text' });
      }
      break;

    case 'GET_CLIPBOARD_HISTORY':
      {
        const result = await chrome.storage.local.get('clipboardHistory');
        sendResponse({ success: true, history: result.clipboardHistory || [] });
      }
      break;

    case 'CLEAR_CLIPBOARD_HISTORY':
      await chrome.storage.local.set({ clipboardHistory: [] });
      sendResponse({ success: true });
      break;

    // ========== 通知管理 ==========
    case 'ADD_NOTIFICATION':
      if (message.message) {
        const result = await chrome.storage.local.get('notifications');
        const notifications = result.notifications || [];
        notifications.unshift({
          message: message.message,
          type: message.type || 'info',
          time: Date.now(),
          read: false
        });
        // 最多保留20条
        await chrome.storage.local.set({ notifications: notifications.slice(0, 20) });
        console.log('[Background] 通知已添加:', message.message);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Missing message' });
      }
      break;

    case 'GET_NOTIFICATIONS':
      {
        const result = await chrome.storage.local.get('notifications');
        sendResponse({ success: true, notifications: result.notifications || [] });
      }
      break;

    case 'MARK_NOTIFICATION_READ':
      {
        const result = await chrome.storage.local.get('notifications');
        const notifications = result.notifications || [];
        if (notifications[message.index]) {
          notifications[message.index].read = true;
          await chrome.storage.local.set({ notifications });
        }
        sendResponse({ success: true });
      }
      break;

    case 'CLEAR_NOTIFICATIONS':
      await chrome.storage.local.set({ notifications: [] });
      sendResponse({ success: true });
      break;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
  } catch (error) {
    console.error('[Background] Error handling message:', error);
    sendResponse({ error: error.message, success: false });
  }
}

// Lock to prevent concurrent rule updates
let updateRulesLock = false;
let pendingRulesUpdate = false;

// Update declarative net request rules
async function updateNetworkRules() {
  // If already updating, schedule a pending update
  if (updateRulesLock) {
    pendingRulesUpdate = true;
    if (extensionState.isDebugMode) {
      console.log('Rules update already in progress, scheduling pending update');
    }
    return;
  }

  updateRulesLock = true;

  try {
    // Collect all unique blocked domains across all domains
    const allBlockedDomains = getAllBlockedDomains();

    // Get existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = existingRules
      .filter(rule => rule.id >= 1000 && rule.id < 2000)
      .map(rule => rule.id);

    // First, remove all existing rules in the 1000-1999 range
    if (oldRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRuleIds
      });
    }

    // Then add new rules if there are any
    if (allBlockedDomains.length > 0) {
      const rules = allBlockedDomains.map((domain, index) => ({
        id: 1000 + index,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: ["xmlhttprequest", "script", "image", "sub_frame"]
        }
      }));

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });

      if (extensionState.isDebugMode) {
        console.log('Network rules updated:', rules.length, 'rules');
      }
    } else {
      if (extensionState.isDebugMode) {
        console.log('No blocked domains, all rules removed');
      }
    }
  } catch (error) {
    console.error('Error updating network rules:', error);
  } finally {
    updateRulesLock = false;

    // If there was a pending update request, process it now
    if (pendingRulesUpdate) {
      pendingRulesUpdate = false;
      if (extensionState.isDebugMode) {
        console.log('Processing pending rules update');
      }
      // Small delay to ensure the lock is fully released
      setTimeout(() => updateNetworkRules(), 10);
    }
  }
}

// Update response blocking rules
async function updateResponseBlockingRules() {
  // Collect all unique blocked response domains across all domains
  const allBlockedResponseDomains = getAllBlockedResponseDomains();

  if (extensionState.isDebugMode) {
    console.log('Updating response blocking rules...');
    console.log('All blocked response domains:', allBlockedResponseDomains);
  }

  try {
    // Get current rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

    // Remove old response blocking rules (IDs starting with 2000)
    const oldRuleIds = existingRules
      .filter(rule => rule.id >= 2000 && rule.id < 3000)
      .map(rule => rule.id);

    if (oldRuleIds.length > 0) {
      if (extensionState.isDebugMode) {
        console.log('Removing old response blocking rules:', oldRuleIds);
      }
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRuleIds
      });
    }

    // Add new response blocking rules if any domains are blocked
    if (allBlockedResponseDomains.length > 0) {
      const newRules = allBlockedResponseDomains.map((domain, index) => ({
        id: 2000 + index,
        priority: 2,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: ["xmlhttprequest", "script", "image", "sub_frame", "main_frame"]
        }
      }));

      if (extensionState.isDebugMode) {
        console.log('Adding new response blocking rules:', newRules);
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules
      });
    }
  } catch (error) {
    console.error('Error updating response blocking rules:', error);
  }
}

// ========== CDN 资源重定向规则 (ID 3000-3099) ==========
// 使用 declarativeNetRequest 在网络层拦截，消除DOM层时序竞争
// 仅用于字体/CSS（CSP style-src通常宽松），JS保持DOM层安全替换

const CDN_REDIRECT_DOMAINS = [
  'cdn.bootcdn.net', 'cdn.baomitu.com', 'cdn.staticfile.org',
  'lf3-cdn-tos.bytecdntp.com', 'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com', 'unpkg.com',
  'fonts.font.im', 'fonts.loli.net', 'fonts.googleapis.cnpmjs.org',
  'fonts.googleapis.com', 'use.fontawesome.com', 'maxcdn.bootstrapcdn.com',
  'stackpath.bootstrapcdn.com', 'ajax.googleapis.com'
];

// DNR CDN重定向规则 (ID 3000-3099)
// 覆盖: 字体/CSS框架/图标库 — 这些资源的style-src CSP通常宽松
// JS库保持DOM层安全替换(有CSP预检机制)
const CDN_REDIRECT_RULES = [
  // ===== Google Fonts → fonts.font.im (host替换, 保留完整路径) =====
  { id: 3001, regex: '^https://fonts\\.googleapis\\.com/(css2.*)', sub: 'https://fonts.font.im/\\1' },
  { id: 3002, regex: '^https://fonts\\.googleapis\\.com/(css\\?.*)', sub: 'https://fonts.font.im/\\1' },
  { id: 3003, regex: '^https://fonts\\.googleapis\\.com/(earlyaccess.*)', sub: 'https://fonts.font.im/\\1' },
  { id: 3004, regex: '^https://fonts\\.googleapis\\.com/(icon.*)', sub: 'https://fonts.font.im/\\1' },

  // ===== 慢速CDN源 CSS 全拦截 → bootcdn =====
  // ajax.googleapis.com/ajax/libs/{lib}/{ver}/{file}.css
  { id: 3005, regex: '^https://ajax\\.googleapis\\.com/ajax/libs/([^/]+)/(\\d+\\.\\d+(?:\\.\\d+)?)/(.*)\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/\\1/\\2/\\3.css' },
  // stackpath.bootstrapcdn.com/{lib}/{ver}/...
  { id: 3006, regex: '^https://stackpath\\.bootstrapcdn\\.com/(.*)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/\\1' },
  // maxcdn.bootstrapcdn.com/{lib}/{ver}/...
  { id: 3007, regex: '^https://maxcdn\\.bootstrapcdn\\.com/(.*)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/\\1' },

  // ===== FontAwesome (各来源) =====
  { id: 3010, regex: 'use\\.fontawesome\\.com/releases/(\\d+\\.\\d+\\.\\d+)/css/all(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/font-awesome/\\1/css/all.min.css' },
  { id: 3011, regex: '(?:/|^)font-awesome/(\\d+\\.\\d+\\.\\d+)/css/font-awesome(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/font-awesome/\\1/css/font-awesome.min.css' },
  { id: 3012, regex: '(?:/|^)fontawesome-free/(\\d+\\.\\d+\\.\\d+)/css/all(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/font-awesome/\\1/css/all.min.css' },

  // ===== Bootstrap CSS =====
  { id: 3020, regex: 'bootstrap[/-](\\d+\\.\\d+\\.\\d+)/(?:css|dist/css)/bootstrap(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/bootstrap/\\1/css/bootstrap.min.css' },
  { id: 3021, regex: '(?:^|/)bootstrap(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css' },
  { id: 3022, regex: 'bootstrap[/-](\\d+\\.\\d+\\.\\d+)/css/bootstrap-grid(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/bootstrap/\\1/css/bootstrap-grid.min.css' },

  // ===== Normalize =====
  { id: 3030, regex: '(?:^|/)normalize(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/normalize.css/8.0.1/normalize.min.css' },

  // ===== Animate.css =====
  { id: 3031, regex: 'animate[/.-](\\d+\\.\\d+\\.\\d+)/animate(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/animate.css/\\1/animate.min.css' },
  { id: 3032, regex: '(?:^|/)animate(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/animate.css/4.1.1/animate.min.css' },

  // ===== Foundation =====
  { id: 3033, regex: 'foundation[/-](\\d+\\.\\d+\\.\\d+)/css/foundation(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/foundation-sites/\\1/css/foundation.min.css' },
  { id: 3034, regex: '(?:^|/)foundation(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/foundation-sites/6.8.1/css/foundation.min.css' },

  // ===== Swiper CSS =====
  { id: 3040, regex: 'swiper[/-](\\d+\\.\\d+\\.\\d+)/.*swiper(?:-bundle)?(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/swiper/\\1/swiper-bundle.min.css' },
  { id: 3041, regex: '(?:^|/)swiper(?:-bundle)?(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/swiper/11.0.5/swiper-bundle.min.css' },

  // ===== AOS =====
  { id: 3042, regex: 'aos[/-](\\d+\\.\\d+\\.\\d+)/dist/aos(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/aos/\\1/aos.css' },
  { id: 3043, regex: '(?:^|/)aos(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/aos/2.3.4/aos.css' },

  // ===== Hover.css =====
  { id: 3044, regex: 'hover\\.css/(\\d+\\.\\d+\\.\\d+)/css/hover(?:-min)?(?:\\.min)?\\.css',
    sub: 'https://cdn.bootcdn.net/ajax/libs/hover.css/\\1/css/hover-min.css' },
  { id: 3045, regex: '(?:^|/)hover-min(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.bootcdn.net/ajax/libs/hover.css/2.3.2/css/hover-min.css' },

  // ===== Ionicons =====
  { id: 3050, regex: 'ionicons[/-](\\d+\\.\\d+\\.\\d+)/css/ionicons(?:\\.min)?\\.css',
    sub: 'https://cdn.jsdelivr.net/npm/ionicons@\\1/dist/css/ionicons.min.css' },
  { id: 3051, regex: '(?:^|/)ionicons(?:\\.min)?\\.css(?:\\?|#|$)',
    sub: 'https://cdn.jsdelivr.net/npm/ionicons@7.2.1/dist/css/ionicons.min.css' }
];

async function updateCDNRedirectRules() {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = existingRules
      .filter(rule => rule.id >= 3000 && rule.id < 3100)
      .map(rule => rule.id);

    if (oldIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    }

    const rules = CDN_REDIRECT_RULES.map(r => ({
      id: r.id,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: r.substitution }
      },
      condition: {
        regexFilter: r.regexFilter,
        resourceTypes: r.resourceTypes,
        excludedRequestDomains: CDN_REDIRECT_DOMAINS
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    console.log('[Background] CDN 重定向规则已注册:', rules.length, '条');
  } catch (error) {
    console.error('[Background] CDN 重定向规则注册失败:', error);
  }
}

// Handle storage changes
async function handleStorageChange(changes) {
  if (changes.settings) {
    console.log('Settings changed:', changes.settings.newValue);
    extensionState.isDebugMode = changes.settings.newValue?.debugMode || false;

    // Load domain-specific blocked data
    if (changes.settings.newValue?.domainBlockedData) {
      _domainBlockedData.blockedDomains = changes.settings.newValue.domainBlockedData.blockedDomains || {};
      _domainBlockedData.blockedResponseDomains = changes.settings.newValue.domainBlockedData.blockedResponseDomains || {};
    }

    extensionState.domainScriptMap = changes.settings.newValue?.domainScriptMap || {};

    await updateNetworkRules();
  }
}

// Service worker lifecycle - install
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started with Chrome');
  initialize();
});

// Service worker lifecycle - install
self.addEventListener('install', () => {
  console.log('Service worker installing...');
  // Skip waiting for activation
  self.skipWaiting();
});

// Service worker lifecycle - activate
self.addEventListener('activate', () => {
  console.log('Service worker activating...');
  // Take control of all existing clients
  clients.claim();
  initialize();
});

// Handle extension errors
// chrome.runtime.onSuspendError.addListener(() => {
//   console.error('Service worker suspended due to error');
// });

// Initialize when service worker starts
console.log('[Background] 脚本开始执行，准备初始化...');
initialize();

// ========== 添加到新标签页功能 ==========

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToNewtab',
    title: '添加到新标签页',
    contexts: ['page', 'link']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToNewtab') {
    // 获取要添加的 URL
    let url = info.linkUrl || tab.url;

    // 获取页面标题
    let title = tab.title;

    // 获取 favicon
    let favicon = tab.favIconUrl || '';

    // 保存到 storage
    saveToNewtab(url, title, favicon, tab.id);
  }
});

// 保存到新标签页
function saveToNewtab(url, title, favicon, tabId) {
  chrome.storage.local.get(['quickLinks'], (result) => {
    const links = result.quickLinks || [];

    // 检查是否已存在
    const exists = links.some(link => link.url === url);
    if (exists) {
      // 通知用户已存在
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '已存在',
        message: '该网站已在新标签页中'
      });
      return;
    }

    // 获取域名作为图标
    let icon = getDomainIcon(url);

    // 添加新链接
    links.unshift({
      title: title || new URL(url).hostname,
      url: url,
      icon: icon,
      favicon: favicon
    });

    // 保存（最多保留 20 个）
    const trimmedLinks = links.slice(0, 20);
    chrome.storage.local.set({ quickLinks: trimmedLinks }, () => {
      // 通知用户
      chrome.notifications.create({
        type: 'basic',
        iconUrl: favicon || 'icon.png',
        title: '已添加到新标签页',
        message: title || new URL(url).hostname
      });
    });
  });
}

// 获取域名对应的图标
function getDomainIcon(url) {
  const icons = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨', '📺', '🎵', '🛒', '📰', '🎮'];
  try {
    const domain = new URL(url).hostname;
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    return icons[Math.abs(hash) % icons.length];
  } catch (e) {
    return '🌐';
  }
}

// ========== 数据统计系统 ==========
// 统计数据存储
let statsData = {
  totalBlocked: 0,           // 总拦截请求数
  totalHidden: 0,            // 总隐藏元素数
  estimatedBytesSaved: 0,    // 估算节省流量(字节)
  domainStats: {},           // 按域名统计 { domain: { blocked, hidden, bytes } }
  dailyStats: {},            // 按日期统计 { 'YYYY-MM-DD': { blocked, hidden, bytes } }
  lastUpdated: Date.now()
};

// 从存储加载统计数据
async function loadStatsData() {
  try {
    const result = await chrome.storage.local.get(['extensionStats']);
    if (result.extensionStats) {
      statsData = { ...statsData, ...result.extensionStats };
    }
  } catch (error) {
    console.error('[Stats] 加载统计数据失败:', error);
  }
}

// 保存统计数据
async function saveStatsData() {
  try {
    statsData.lastUpdated = Date.now();
    await chrome.storage.local.set({ extensionStats: statsData });
  } catch (error) {
    console.error('[Stats] 保存统计数据失败:', error);
  }
}

// 获取今日日期字符串
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// 记录拦截请求
function recordBlockedRequest(url, tabId) {
  statsData.totalBlocked++;

  // 估算流量 (平均每个请求约 10KB)
  const estimatedBytes = 10240;
  statsData.estimatedBytesSaved += estimatedBytes;

  // 按日期统计
  const today = getTodayKey();
  if (!statsData.dailyStats[today]) {
    statsData.dailyStats[today] = { blocked: 0, hidden: 0, bytes: 0 };
  }
  statsData.dailyStats[today].blocked++;
  statsData.dailyStats[today].bytes += estimatedBytes;

  // 获取域名
  if (tabId) {
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.url) {
        try {
          const domain = new URL(tab.url).hostname;
          if (!statsData.domainStats[domain]) {
            statsData.domainStats[domain] = { blocked: 0, hidden: 0, bytes: 0 };
          }
          statsData.domainStats[domain].blocked++;
          statsData.domainStats[domain].bytes += estimatedBytes;
        } catch (e) {}
      }
    });
  }

  // 异步保存
  saveStatsData();
}

// 记录隐藏元素
function recordHiddenElement(domain, count = 1) {
  statsData.totalHidden += count;

  const today = getTodayKey();
  if (!statsData.dailyStats[today]) {
    statsData.dailyStats[today] = { blocked: 0, hidden: 0, bytes: 0 };
  }
  statsData.dailyStats[today].hidden += count;

  if (domain) {
    if (!statsData.domainStats[domain]) {
      statsData.domainStats[domain] = { blocked: 0, hidden: 0, bytes: 0 };
    }
    statsData.domainStats[domain].hidden += count;
  }

  saveStatsData();
}

// 获取统计数据
function getStats() {
  const today = getTodayKey();
  return {
    ...statsData,
    today: statsData.dailyStats[today] || { blocked: 0, hidden: 0, bytes: 0 }
  };
}

// 重置统计数据
function resetStats() {
  statsData = {
    totalBlocked: 0,
    totalHidden: 0,
    estimatedBytesSaved: 0,
    domainStats: {},
    dailyStats: {},
    lastUpdated: Date.now()
  };
  saveStatsData();
}

// 监听 declarativeNetRequest 拦截事件
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (info.rule.id >= 1000 && info.rule.id < 2000) {
      recordBlockedRequest(info.request.url, info.request.tabId);
    }
  });
}

// 初始化统计数据
loadStatsData();