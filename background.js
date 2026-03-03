// Background service worker (Manifest V3)
// Runs in the background and handles extension lifecycle events

// ========== Port 连接管理 ==========
const devtoolsPorts = new Map(); // tabId -> port

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    console.log('[Background] DevTools 面板已连接');

    // 监听来自 DevTools 的消息
    port.onMessage.addListener((message) => {
      if (message.type === 'REGISTER_DEVTOOLS') {
        // 注册 DevTools 对应的 tabId
        devtoolsPorts.set(message.tabId, port);
        console.log(`[Background] 注册 DevTools: tabId=${message.tabId}`);
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
});

/**
 * 向指定 tab 的 DevTools 面板推送消息
 */
function pushToDevTools(tabId, message) {
  const port = devtoolsPorts.get(tabId);
  if (port) {
    try {
      port.postMessage({
        type: 'PICKER_MESSAGE_PUSH',
        data: message
      });
      return true;
    } catch (error) {
      console.log('[Background] 推送消息失败:', error);
      devtoolsPorts.delete(tabId);
      return false;
    }
  }
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

  // Load settings (await to ensure data is ready)
  _settingsLoadPromise = loadSettings();
  await _settingsLoadPromise;
  _settingsLoaded = true;

  // Listen for extension events
  setupEventListeners();

  console.log('Extension initialized successfully');
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
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  // Listen for extension installation
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details);

    if (details.reason === 'install') {
      // Show welcome page on first install
      chrome.tabs.create({ url: 'welcome.html' });
    }
  });


  // Listen for tab updates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      handleTabUpdate(tabId, tab);
    }
  });

  // Listen for messages from other extension components
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async responses
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    handleStorageChange(changes);
  });
}


// Handle tab updates
function handleTabUpdate(tabId, tab) {
  if (extensionState.isDebugMode) {
    console.log('Tab updated:', tabId, tab.title);
  }
  if (!tab.active) return;

  // Only apply to specific URLs if needed
  if (tab.url && tab.status === 'complete' && tab.url.startsWith('http')) {
    // content.js is already injected via manifest.json, just inject domain-specific scripts
    injectScriptsForTab(tabId, tab.url);
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

// Handle runtime messages
async function handleMessage(message, sender, sendResponse) {
  if (extensionState.isDebugMode) {
    console.log('Background received message:', message);
  }

  try {
    switch (message.type) {
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
      try {
        // 从 sender 获取 tabId
        const senderTabId = sender.tab ? sender.tab.id : null;

        if (senderTabId) {
          // 直接通过 Port 推送到 DevTools
          const pushed = pushToDevTools(senderTabId, message.data);

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
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'GET_PICKER_MESSAGES':
      // DevTools 获取待处理的消息
      const tabIdForMessages = message.tabId;
      const since = message.since || 0;
      const messages = (globalThis._pickerMessages || [])
        .filter(m => m.tabId === tabIdForMessages && m.timestamp > since);
      sendResponse({ success: true, messages });
      break;

    case 'CLEAR_PICKER_MESSAGES':
      // 清除消息
      globalThis._pickerMessages = [];
      sendResponse({ success: true });
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