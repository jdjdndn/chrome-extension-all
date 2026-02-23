// Background service worker (Manifest V3)
// Runs in the background and handles extension lifecycle events

// ========== 彩色日志工具 ==========
// 生成随机颜色（避开白色/浅色）
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 40);
  const lightness = 30 + Math.floor(Math.random() * 30);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
function coloredLog(tag, message, ...args) {
  const tagStyle = `color: ${getRandomColor()}; font-weight: bold;`;
  const styledArgs = args.map((arg) => {
    return [`%c${String(arg)}`, `color: ${getRandomColor()}`];
  }).flat();
  if (styledArgs.length > 0) console.log(`%c${tag} ${message}`, tagStyle, ...styledArgs);
  else console.log(`%c${tag} ${message}`, tagStyle);
}
const originalConsole = { log: console.log.bind(console) };
console.log = function(...args) {
  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
    if (tagMatch) {
      const tag = `[${tagMatch[1]}]`;
      const message = firstArg.slice(tag.length).trim() || '';
      coloredLog(tag, message, ...args.slice(1));
      return;
    }
  }
  originalConsole.log(...args);
};

console.log('[Extension] Extension service worker started');
const SETTINE = 'cy_settings';

// Helper to get current active tab's domain
async function getCurrentTabDomain() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const domain = new URL(tabs[0].url).hostname;
          resolve(domain);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

// Internal storage for domain-specific blocked lists
// blockedDomains 通过 content scripts 向 background 注册
function createDomainBlockedData() {
  return {
    blockedDomains: {},
    blockedResponseDomains: {}
  };
}

const _domainBlockedData = createDomainBlockedData();

// 初始化函数（保留用于存储加载时合并配置）
function initDomainBlockedData() {
  // 配置已直接定义在 _domainBlockedData 中
  // 此函数保留用于未来可能的扩展
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
    const settings = await chrome.storage.sync.get(SETTINE);
    const currentSettings = settings.settings || {};
    await chrome.storage.sync.set({
      settings: {
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
function initialize() {
  if (extensionState.initialized) return;

  console.log('Initializing extension...');
  extensionState.initialized = true;

  // Load settings
  loadSettings();

  // Listen for extension events
  setupEventListeners();

  console.log('Extension initialized successfully');
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINE);
    const settings = result.settings || { debugMode: true };
    extensionState.isDebugMode = settings.debugMode || true;

    // Load domain-specific blocked data
    if (settings.domainBlockedData) {
      _domainBlockedData.blockedDomains = settings.domainBlockedData.blockedDomains || {};
      _domainBlockedData.blockedResponseDomains = settings.domainBlockedData.blockedResponseDomains || {};
    } else {
      // Migrate old data format to new format
      const oldBlockedDomains = settings.blockedDomains || [];
      const oldBlockedResponseDomains = settings.blockedResponseDomains || [];
      // Store old data in a default key (can be migrated to specific domains as needed)
      _domainBlockedData.blockedDomains = { '*': oldBlockedDomains };
      _domainBlockedData.blockedResponseDomains = { '*': oldBlockedResponseDomains };
    }

    extensionState.domainScriptMap = settings.domainScriptMap || extensionState.domainScriptMap || {};

    if (extensionState.isDebugMode) {
      console.log('Settings loaded:', settings);
      console.log('Domain blocked data:', _domainBlockedData);
      console.log('Domain script map:', extensionState.domainScriptMap);
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
      sendResponse({
        currentDomain: currentDomainForResponse,
        blockedDomains: getBlockedDomainsForDomain(currentDomainForResponse),
        blockedResponseDomains: getBlockedResponseDomainsForDomain(currentDomainForResponse),
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
      // 注册 content script 的 blockedDomains 配置
      if (message.domain && message.blockedDomains) {
        _domainBlockedData.blockedDomains[message.domain] = message.blockedDomains;
        console.log(`[Extension] Registered blockedDomains for ${message.domain}:`, message.blockedDomains);
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

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
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