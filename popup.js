// Popup script runs in the context of the popup window

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

// Default settings
const defaultSettings = {
  enabled: false,
  apiKey: '',
  debugMode: false,
  blockedDomains: [],
  blockedResponseDomains: []
};

// DOM Elements
const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggle-btn');
const apiKeyInput = document.getElementById('api-key');
const debugModeCheckbox = document.getElementById('debug-mode');

// Blocked domains UI
const blockedDomainsList = document.getElementById('blocked-domains-list');
const blockedResponseDomainsList = document.getElementById('blocked-response-domains-list');
const domainInput = document.getElementById('domain-input');
const responseDomainInput = document.getElementById('response-domain-input');
const addDomainBtn = document.getElementById('add-domain-btn');
const addResponseDomainBtn = document.getElementById('add-response-domain-btn');
const clearDomainsBtn = document.getElementById('clear-domains-btn');
const clearResponseDomainsBtn = document.getElementById('clear-response-domains-btn');

// Load settings from storage
async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || defaultSettings;

  // Update UI
  updateStatus(settings.enabled);
  apiKeyInput.value = settings.apiKey || '';
  debugModeCheckbox.checked = settings.debugMode || false;

  // Load blocked domains
  await loadBlockedDomains();
}

// Save settings to storage
async function saveSettings(settings) {
  const result = await chrome.storage.sync.get('settings');
  const currentSettings = result.settings || defaultSettings;
  const newSettings = { ...currentSettings, ...settings };
  await chrome.storage.sync.set({ settings: newSettings });
  return newSettings;
}

// Update status display
function updateStatus(enabled) {
  if (enabled) {
    statusEl.textContent = 'Active';
    statusEl.className = 'status active';
    toggleBtn.textContent = 'Disable Extension';
  } else {
    statusEl.textContent = 'Inactive';
    statusEl.className = 'status inactive';
    toggleBtn.textContent = 'Enable Extension';
  }
}

// Toggle extension on/off
async function toggleExtension() {
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || defaultSettings;
  const newEnabled = !settings.enabled;

  const newSettings = await saveSettings({ enabled: newEnabled });
  updateStatus(newSettings.enabled);

  // Notify content scripts
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'TOGGLE_EXTENSION',
      enabled: newSettings.enabled
    }).catch(() => {
      // Content script may not be loaded
    });
  }
}

// Event Listeners
toggleBtn.addEventListener('click', toggleExtension);

apiKeyInput.addEventListener('change', () => {
  saveSettings({ apiKey: apiKeyInput.value });
});

debugModeCheckbox.addEventListener('change', () => {
  saveSettings({ debugMode: debugModeCheckbox.checked });
});


// Load blocked domains
async function loadBlockedDomains() {
  const result = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_DOMAINS' });
  if (result) {
    renderBlockedDomains(result.blockedDomains || []);
    renderBlockedResponseDomains(result.blockedResponseDomains || []);

    // Debug log
    console.log('Loaded blocked domains:', result.blockedDomains);
    console.log('Current domain:', result.currentDomain);
  }
}

// Render blocked domains in UI
function renderBlockedDomains(domains) {
  if (!domains || domains.length === 0) {
    blockedDomainsList.innerHTML = '<div class="empty-state">暂无阻止的域名</div>';
    if (clearDomainsBtn) {
      clearDomainsBtn.disabled = true;
    }
    return;
  }

  blockedDomainsList.innerHTML = domains.map(domain => `
    <div class="domain-list-item">
      <span class="domain-text" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
      <button class="domain-remove-btn remove-domain" data-domain="${escapeHtml(domain)}">删除</button>
    </div>
  `).join('');

  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-domain').forEach(btn => {
    btn.addEventListener('click', () => {
      removeDomain(btn.dataset.domain);
    });
  });

  // Enable clear button when there are domains
  if (clearDomainsBtn) {
    clearDomainsBtn.disabled = false;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add blocked domain
async function addDomain(domain) {
  if (!domain) return;

  const result = await chrome.runtime.sendMessage({
    type: 'ADD_BLOCKED_DOMAIN',
    domain: domain
  });

  if (result.success) {
    domainInput.value = '';
    renderBlockedDomains(result.domains);
  } else {
    alert('Failed to add domain');
  }
}

// Remove blocked domain
async function removeDomain(domain) {
  const result = await chrome.runtime.sendMessage({
    type: 'REMOVE_BLOCKED_DOMAIN',
    domain: domain
  });

  if (result.success) {
    const updatedResult = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_DOMAINS' });
    renderBlockedDomains(updatedResult.blockedDomains || []);
  } else {
    alert('Failed to remove domain');
  }
}

// Add blocked response domain
async function addResponseDomain(domain) {
  if (!domain) return;

  const result = await chrome.runtime.sendMessage({
    type: 'ADD_BLOCKED_RESPONSE_DOMAIN',
    domain: domain
  });

  if (result.success) {
    responseDomainInput.value = '';
    renderBlockedResponseDomains(result.domains || []);
  } else {
    alert('Failed to add response domain');
  }
}

// Add multiple blocked response domains
async function addResponseDomains(domains) {
  let addedCount = 0;
  let failedCount = 0;

  for (const domain of domains) {
    const result = await chrome.runtime.sendMessage({
      type: 'ADD_BLOCKED_RESPONSE_DOMAIN',
      domain: domain
    });

    if (result.success) {
      addedCount++;
    } else {
      failedCount++;
    }
  }

  if (addedCount > 0) {
    responseDomainInput.value = '';
    // Reload the list to show updated domains
    await loadBlockedDomains();
  }

  if (failedCount > 0) {
    alert(`成功添加 ${addedCount} 个域名，失败 ${failedCount} 个`);
  } else if (addedCount > 0) {
    // All added successfully
  }
}

// Remove blocked response domain
async function removeResponseDomain(domain) {
  const result = await chrome.runtime.sendMessage({
    type: 'REMOVE_BLOCKED_RESPONSE_DOMAIN',
    domain: domain
  });

  if (result.success) {
    const updatedResult = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_DOMAINS' });
    renderBlockedResponseDomains(updatedResult.domains || []);
  } else {
    alert('Failed to remove response domain');
  }
}

// Render blocked response domains in UI
function renderBlockedResponseDomains(domains) {
  if (!domains || domains.length === 0) {
    if (blockedResponseDomainsList) {
      blockedResponseDomainsList.innerHTML = '<div class="empty-state">暂无阻止的域名</div>';
    }
    if (clearResponseDomainsBtn) {
      clearResponseDomainsBtn.disabled = true;
    }
    return;
  }

  if (blockedResponseDomainsList) {
    blockedResponseDomainsList.innerHTML = domains.map(domain => `
      <div class="domain-list-item">
        <span class="domain-text" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
        <button class="domain-remove-btn remove-response-domain" data-domain="${escapeHtml(domain)}" style="background-color: #e0a800;">删除</button>
      </div>
    `).join('');

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-response-domain').forEach(btn => {
      btn.addEventListener('click', () => {
        removeResponseDomain(btn.dataset.domain);
      });
    });
  }

  // Enable clear button when there are domains
  if (clearResponseDomainsBtn) {
    clearResponseDomainsBtn.disabled = false;
  }
}

// Initialize popup
loadSettings().catch(console.error);

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'UPDATE_STATUS') {
    updateStatus(message.enabled);
  }
});

// Parse domain input - supports both single domain and multiple domains separated by comma
function parseDomainInput(input) {
  if (!input) return [];

  // Remove quotes if present (both single and double quotes)
  let cleaned = input.replace(/['"]/g, '').trim();

  if (!cleaned) return [];

  // Split by comma and trim each entry
  return cleaned.split(',').map(d => d.trim()).filter(d => d);
}

// Event listeners for domain management
if (addDomainBtn) {
  addDomainBtn.addEventListener('click', () => {
    const input = domainInput.value.trim();
    const domains = parseDomainInput(input);

    if (domains.length === 0) {
      alert('请输入有效的域名（例如: tracking.example.com 或 "api1.com, api2.com"）');
      return;
    }

    // Add all domains
    addDomains(domains);
  });
}

// Add multiple domains
async function addDomains(domains) {
  let addedCount = 0;
  let failedCount = 0;

  for (const domain of domains) {
    const result = await chrome.runtime.sendMessage({
      type: 'ADD_BLOCKED_DOMAIN',
      domain: domain
    });

    if (result.success) {
      addedCount++;
    } else {
      failedCount++;
    }
  }

  if (addedCount > 0) {
    domainInput.value = '';
    // Reload the list to show updated domains
    await loadBlockedDomains();
  }

  if (failedCount > 0) {
    alert(`成功添加 ${addedCount} 个域名，失败 ${failedCount} 个`);
  } else if (addedCount > 0) {
    // All added successfully
  }
}

// Handle Enter key in domain input
if (domainInput) {
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomainBtn.click();
    }
  });
}

// Event listeners for response domain management
if (addResponseDomainBtn) {
  addResponseDomainBtn.addEventListener('click', () => {
    const input = responseDomainInput.value.trim();
    const domains = parseDomainInput(input);

    if (domains.length === 0) {
      alert('请输入有效的域名（例如: api.example.com 或 "api1.com, api2.com"）');
      return;
    }

    // Add all response domains
    addResponseDomains(domains);
  });
}

// Add multiple response domains
async function addResponseDomains(domains) {
  let addedCount = 0;
  let failedCount = 0;

  for (const domain of domains) {
    const result = await chrome.runtime.sendMessage({
      type: 'ADD_BLOCKED_RESPONSE_DOMAIN',
      domain: domain
    });

    if (result.success) {
      addedCount++;
    } else {
      failedCount++;
    }
  }

  if (addedCount > 0) {
    responseDomainInput.value = '';
    // Reload the list to show updated domains
    await loadBlockedDomains();
  }

  if (failedCount > 0) {
    alert(`成功添加 ${addedCount} 个域名，失败 ${failedCount} 个`);
  } else if (addedCount > 0) {
    // All added successfully
  }
}

// Clear all blocked domains
async function clearAllDomains() {
  const result = await chrome.runtime.sendMessage({
    type: 'GET_BLOCKED_DOMAINS'
  });

  if (!result || !result.blockedDomains || result.blockedDomains.length === 0) {
    return;
  }

  // Remove each domain
  for (const domain of result.blockedDomains) {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_BLOCKED_DOMAIN',
      domain: domain
    });
  }

  // Reload the list
  await loadBlockedDomains();
}

// Clear all blocked response domains
async function clearAllResponseDomains() {
  const result = await chrome.runtime.sendMessage({
    type: 'GET_BLOCKED_DOMAINS'
  });

  if (!result || !result.blockedResponseDomains || result.blockedResponseDomains.length === 0) {
    return;
  }

  // Remove each domain
  for (const domain of result.blockedResponseDomains) {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_BLOCKED_RESPONSE_DOMAIN',
      domain: domain
    });
  }

  // Reload the list
  await loadBlockedDomains();
}

// Handle Enter key in response domain input
if (responseDomainInput) {
  responseDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addResponseDomainBtn.click();
    }
  });
}

// Clear all domains button
if (clearDomainsBtn) {
  clearDomainsBtn.addEventListener('click', clearAllDomains);
}

// Clear all response domains button
if (clearResponseDomainsBtn) {
  clearResponseDomainsBtn.addEventListener('click', clearAllResponseDomains);
}

// ========== Douyin Keywords Management ==========
const notInterestedKeywordsTextarea = document.getElementById('not-interested-keywords');
const autoFollowKeywordsTextarea = document.getElementById('auto-follow-keywords');
const saveKeywordsBtn = document.getElementById('save-keywords-btn');
const saveFollowKeywordsBtn = document.getElementById('save-follow-keywords-btn');

// Default keywords from douyin.js
const defaultNotInterestedKeywords = [
  '抽象', '漫画', '国漫', '修仙', '玄幻', '系统', '动画', '动漫', '小说', '黑神话',
  '解说', '好剧', '儿童', '孩子', '观影', '案件', '国学', '狗', '猫', '宠物', '娃',
  '王者荣耀', '射手', '对抗路', '中单', '上单', '打野', '巅峰赛', '游戏日常', '综艺', '游戏',
  '美食', '测评', '小品', '春晚', '相亲', '恋爱', '情侣日常', '国服', '驾照', '考试', '结婚',
  '率土之滨', '程序员', '前端', '动物', '电商', '追剧', '军旅', '短剧', '小说', '恐怖',
  '影视', '电影', '司机', '工地', '情侣', '原生家庭', '影娱', '好片', '亲子', '幼儿园',
  '育儿', '育婴', '宝宝', '母婴', '妈妈', '父母', '爸妈', '早教', '幼教', '学前',
  '儿童', '音乐', '热歌'
];

const defaultAutoFollowKeywords = ['ootd'];

/**
 * Parse keywords - supports space, comma, or newline separated formats
 * Automatically removes quotes and deduplicates
 * Examples: "关键词1 关键词2 关键词3" or "关键词1,关键词2" or one per line
 */
function parseKeywords(text) {
  if (!text) return [];

  // Try to match comma-separated format first (for backward compatibility)
  if (text.includes(',')) {
    const parsed = text
      .split(',')
      .map(k => k.trim().replace(/^['"]|['"]$/g, ''))
      .filter(k => k);
    if (parsed.length > 1) return [...new Set(parsed)];
  }

  // Split by whitespace (spaces, newlines, tabs)
  const parsed = text
    .split(/\s+/)
    .map(k => k.trim().replace(/^['"]|['"]$/g, ''))
    .filter(k => k);
  // Deduplicate using Set
  return [...new Set(parsed)];
}

/**
 * Format keywords as space-separated for display
 */
function formatKeywords(keywords) {
  return keywords.join(' ');
}

/**
 * Load keywords from storage
 */
async function loadKeywords() {
  // Only load keywords for Douyin domains
  const domain = await getCurrentDomain();
  if (!isDouyinDomain(domain)) {
    return;
  }

  const result = await chrome.storage.local.get(['douyinKeywords']);
  const keywords = result.douyinKeywords || {
    notInterested: defaultNotInterestedKeywords,
    autoFollow: defaultAutoFollowKeywords
  };

  // Update textareas - format as comma-separated
  if (notInterestedKeywordsTextarea) {
    notInterestedKeywordsTextarea.value = formatKeywords(keywords.notInterested);
  }
  if (autoFollowKeywordsTextarea) {
    autoFollowKeywordsTextarea.value = formatKeywords(keywords.autoFollow);
  }
}

/**
 * Save keywords to storage and notify content script
 */
async function saveKeywords() {
  if (!notInterestedKeywordsTextarea) return;

  // Only save keywords for Douyin domains
  const domain = await getCurrentDomain();
  if (!isDouyinDomain(domain)) {
    console.log('非抖音域名，跳过保存关键词');
    return;
  }

  // Parse textarea content (supports both formats, auto deduplicate)
  const keywords = parseKeywords(notInterestedKeywordsTextarea.value);

  // Get current auto-follow keywords
  const autoFollowKeywords = autoFollowKeywordsTextarea
    ? parseKeywords(autoFollowKeywordsTextarea.value)
    : defaultAutoFollowKeywords;

  await chrome.storage.local.set({
    douyinKeywords: {
      notInterested: keywords,
      autoFollow: autoFollowKeywords
    }
  });

  console.log('不感兴趣关键词已保存:', keywords);

  // Update textarea with deduplicated keywords
  notInterestedKeywordsTextarea.value = formatKeywords(keywords);

  // Notify content script to update keywords
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_KEYWORDS',
        keywords: {
          NOT_INTERESTED_KEYWORDS: keywords,
          AUTO_FOLLOW_KEYWORDS: autoFollowKeywords
        }
      }).catch(() => {
        // Content script may not be loaded
      });
    }
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

/**
 * Save auto-follow keywords
 */
async function saveAutoFollowKeywords() {
  if (!autoFollowKeywordsTextarea) return;

  // Only save keywords for Douyin domains
  const domain = await getCurrentDomain();
  if (!isDouyinDomain(domain)) {
    console.log('非抖音域名，跳过保存关键词');
    return;
  }

  // Parse textarea content (supports both formats, auto deduplicate)
  const keywords = parseKeywords(autoFollowKeywordsTextarea.value);

  // Get current not-interested keywords from storage
  const result = await chrome.storage.local.get(['douyinKeywords']);
  const currentKeywords = result.douyinKeywords || {
    notInterested: defaultNotInterestedKeywords,
    autoFollow: defaultAutoFollowKeywords
  };

  await chrome.storage.local.set({
    douyinKeywords: {
      ...currentKeywords,
      autoFollow: keywords
    }
  });

  console.log('自动关注关键词已保存:', keywords);

  // Update textarea with deduplicated keywords
  autoFollowKeywordsTextarea.value = formatKeywords(keywords);

  // Notify content script
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_KEYWORDS',
        keywords: {
          AUTO_FOLLOW_KEYWORDS: keywords
        }
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

// ========== Hide Elements Management ==========
const hideElementsEnabledCheckbox = document.getElementById('hide-elements-enabled');
const hideElementsEditor = document.getElementById('hide-elements-editor');
const hideElementsSelectorsTextarea = document.getElementById('hide-elements-selectors');
const saveHideElementsBtn = document.getElementById('save-hide-elements-btn');

// Default hide elements selectors
const defaultHideElementsSelectors = [];

/**
 * Parse CSS selectors - space-separated format
 */
function parseSelectors(text) {
  if (!text) return [];

  // Split by whitespace and filter empty entries
  const parsed = text
    .split(/\s+/)
    .map(s => s.trim())
    .filter(s => s);

  // Deduplicate using Set
  return [...new Set(parsed)];
}

/**
 * Format selectors as space-separated for display
 */
function formatSelectors(selectors) {
  return selectors.join(' ');
}

/**
 * Get current tab's domain
 */
async function getCurrentDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      return new URL(tabs[0].url).hostname;
    }
  } catch (error) {
    console.error('Failed to get current domain:', error);
  }
  return null;
}

/**
 * Get default hide selectors from content script
 * @returns {Promise<string[]>} Default selectors or empty array
 */
async function getDefaultHideSelectors() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'GET_DEFAULT_HIDE_SELECTORS'
      }).catch(() => null);
      if (response && response.success && response.selectors) {
        console.log('[隐藏元素] 获取到默认选择器:', response.selectors);
        return response.selectors;
      }
    }
  } catch (error) {
    console.log('[隐藏元素] 无法获取默认选择器:', error);
  }
  return [];
}

/**
 * Load hide elements settings from storage (domain-specific)
 */
async function loadHideElementsSettings() {
  const domain = await getCurrentDomain();
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};

  // Get default selectors from content script
  const defaultSelectors = await getDefaultHideSelectors();
  console.log('[隐藏元素] 默认选择器:', defaultSelectors);

  // Get settings for current domain
  const hasCustomSettings = domain && allSettings[domain];
  let settings;
  if (hasCustomSettings) {
    settings = allSettings[domain];
    // Merge default selectors with stored selectors (remove duplicates)
    const mergedSelectors = [...new Set([...defaultSelectors, ...(settings.selectors || [])])];
    settings.selectors = mergedSelectors;
  } else {
    // Use default selectors, but don't auto-enable
    settings = {
      enabled: false,
      selectors: defaultSelectors
    };
  }

  // Update UI
  if (hideElementsEnabledCheckbox) {
    hideElementsEnabledCheckbox.checked = settings.enabled;
  }
  if (hideElementsSelectorsTextarea) {
    hideElementsSelectorsTextarea.value = formatSelectors(settings.selectors);
  }

  // Show editor only if enabled or has selectors to display
  const shouldShowEditor = settings.enabled || (settings.selectors && settings.selectors.length > 0);
  updateHideElementsEditorVisibility(shouldShowEditor);
}

/**
 * Update hide elements editor visibility
 */
function updateHideElementsEditorVisibility(enabled) {
  if (hideElementsEditor) {
    hideElementsEditor.style.display = enabled ? 'block' : 'none';
  }
}

/**
 * Save hide elements settings (domain-specific)
 */
async function saveHideElementsSettings() {
  if (!hideElementsSelectorsTextarea) return;

  const enabled = hideElementsEnabledCheckbox ? hideElementsEnabledCheckbox.checked : false;
  const inputSelectors = parseSelectors(hideElementsSelectorsTextarea.value);
  const domain = await getCurrentDomain();

  if (!domain) {
    console.error('Failed to save hide elements settings: unable to get current domain');
    return;
  }

  // Get default selectors to merge with user input
  const defaultSelectors = await getDefaultHideSelectors();

  // Merge default selectors with user input (remove duplicates)
  const mergedSelectors = [...new Set([...defaultSelectors, ...inputSelectors])];

  // Get all existing settings
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};

  // Update settings for current domain
  allSettings[domain] = { enabled, selectors: mergedSelectors };

  await chrome.storage.local.set({
    hideElementsSettings: allSettings
  });

  console.log('隐藏元素设置已保存:', { enabled, selectors: mergedSelectors });

  // Update textarea with deduplicated selectors
  hideElementsSelectorsTextarea.value = formatSelectors(mergedSelectors);

  // Notify content script to update hide elements
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_HIDE_ELEMENTS',
        enabled,
        selectors: mergedSelectors
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

// Add event listeners for hide elements
if (hideElementsEnabledCheckbox) {
  hideElementsEnabledCheckbox.addEventListener('change', () => {
    updateHideElementsEditorVisibility(hideElementsEnabledCheckbox.checked);
    saveHideElementsSettings();
  });
}

if (saveHideElementsBtn) {
  saveHideElementsBtn.addEventListener('click', saveHideElementsSettings);
}

// Load hide elements settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadHideElementsSettings().catch(console.error);
});

// Add copy event listener for keywords textareas - copy as array format
function setupCopyAsArray(textarea) {
  if (!textarea) return;

  textarea.addEventListener('copy', (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Get selected text, or full textarea value if no selection
    let selectedText = selection.toString();
    if (!selectedText) {
      selectedText = textarea.value;
    }

    // Parse as keywords array
    const keywords = parseKeywords(selectedText);

    // Format as JSON array
    const arrayFormat = JSON.stringify(keywords, null, 2);

    // Set clipboard data
    e.preventDefault();
    e.clipboardData.setData('text/plain', arrayFormat);
    console.log('[复制] 已转换为数组格式:', arrayFormat);
  });
}

// Setup copy listeners for keywords textareas
setupCopyAsArray(notInterestedKeywordsTextarea);
setupCopyAsArray(autoFollowKeywordsTextarea);

// Add event listeners for save buttons
if (saveKeywordsBtn) {
  saveKeywordsBtn.addEventListener('click', saveKeywords);
}
if (saveFollowKeywordsBtn) {
  saveFollowKeywordsBtn.addEventListener('click', saveAutoFollowKeywords);
}

// Check if current domain is Douyin-related
function isDouyinDomain(domain) {
  if (!domain) return false;
  const douyinDomains = ['douyin.com', 'www.douyin.com', 'iesdouyin.com'];
  return douyinDomains.some(d => domain === d || domain.endsWith('.' + d));
}

// Check if current domain is Bilibili-related
function isBilibiliDomain(domain) {
  if (!domain) return false;
  const biliDomains = ['bilibili.com', 'www.bilibili.com'];
  return biliDomains.some(d => domain === d || domain.endsWith('.' + d));
}

// Show/hide Douyin keywords section based on current domain
async function updateDouyinKeywordsVisibility() {
  const domain = await getCurrentDomain();
  const douyinSection = document.getElementById('douyin-keywords-section');
  if (douyinSection) {
    if (isDouyinDomain(domain)) {
      douyinSection.style.display = 'block';
    } else {
      douyinSection.style.display = 'none';
    }
  }
}

// ========== Bilibili Keywords Management ==========
const biliNotInterestedKeywordsTextarea = document.getElementById('bili-not-interested-keywords');
const biliSaveKeywordsBtn = document.getElementById('bili-save-keywords-btn');

// Default keywords from bili.js
const defaultBiliNotInterestedKeywords = [
  "原神", "崩坏", "星铁", "鸣潮", "王者", "荣耀", "LOL", "英雄联盟", "绝区零",
  "火影", "海贼", "柯南", "漫威", "DC", "漫展", "cos", "COS", "Cos",
  "直播", "带货", "广告", "推广"
];

/**
 * Load Bilibili keywords from storage
 */
async function loadBiliKeywords() {
  // Only load keywords for Bilibili domains
  const domain = await getCurrentDomain();
  if (!isBilibiliDomain(domain)) {
    return;
  }

  const result = await chrome.storage.local.get(['biliKeywords']);
  const keywords = result.biliKeywords || {
    notInterested: defaultBiliNotInterestedKeywords
  };

  // Update textarea
  if (biliNotInterestedKeywordsTextarea) {
    biliNotInterestedKeywordsTextarea.value = formatKeywords(keywords.notInterested);
  }
}

/**
 * Save Bilibili keywords to storage and notify content script
 */
async function saveBiliKeywords() {
  if (!biliNotInterestedKeywordsTextarea) return;

  // Only save keywords for Bilibili domains
  const domain = await getCurrentDomain();
  if (!isBilibiliDomain(domain)) {
    console.log('非B站域名，跳过保存关键词');
    return;
  }

  // Parse textarea content
  const keywords = parseKeywords(biliNotInterestedKeywordsTextarea.value);

  await chrome.storage.local.set({
    biliKeywords: {
      notInterested: keywords
    }
  });

  console.log('B站不感兴趣关键词已保存:', keywords.length, '个');

  // Update textarea with deduplicated keywords
  biliNotInterestedKeywordsTextarea.value = formatKeywords(keywords);

  // Notify content script to update keywords
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_KEYWORDS',
        keywords: {
          NOT_INTERESTED_KEYWORDS: keywords
        }
      }).catch(() => {
        // Content script may not be loaded
      });
    }
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

// Show/hide Bilibili keywords section based on current domain
async function updateBilibiliKeywordsVisibility() {
  const domain = await getCurrentDomain();
  const biliSection = document.getElementById('bili-keywords-section');
  if (biliSection) {
    if (isBilibiliDomain(domain)) {
      biliSection.style.display = 'block';
    } else {
      biliSection.style.display = 'none';
    }
  }
}

// Add event listener for Bilibili save button
if (biliSaveKeywordsBtn) {
  biliSaveKeywordsBtn.addEventListener('click', saveBiliKeywords);
}

// Setup copy listener for Bilibili keywords textarea
setupCopyAsArray(biliNotInterestedKeywordsTextarea);

// Load keywords when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadKeywords().catch(console.error);
  loadBiliKeywords().catch(console.error);
  // Update keywords sections visibility
  updateDouyinKeywordsVisibility().catch(console.error);
  updateBilibiliKeywordsVisibility().catch(console.error);
});

// Load blocked domains when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadBlockedDomains().catch(err => {
    console.error('Error loading blocked domains:', err);
    // Show error state in UI
    if (blockedDomainsList) {
      blockedDomainsList.innerHTML = '<div class="empty-state">加载失败，请刷新重试</div>';
    }
  });
});