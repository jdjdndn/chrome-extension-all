// Popup script runs in the context of the popup window

// ========== 消息通信层 ==========
// Popup 与 content script 运行在隔离的上下文中，必须使用 Chrome Extension API 通信

/**
 * 统一发送消息函数（直接使用 Chrome API）
 * @param {string} type - 消息类型
 * @param {object} data - 消息数据
 * @returns {Promise<any>}
 */
async function sendMessage(type, data = {}) {
  try {
    return await chrome.runtime.sendMessage({ type, ...data });
  } catch (error) {
    console.error('[Popup] 发送消息失败:', error.message);
    return null;
  }
}

/**
 * 发送消息到 content script
 */
async function sendMessageToContentScript(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      return await chrome.tabs.sendMessage(tabs[0].id, message);
    }
  } catch (error) {
    // 如果 content script 未加载，静默失败（这是正常情况）
    if (!error.message.includes('Receiving end does not exist')) {
      console.warn('[Popup] 发送到 content script 失败:', error.message);
    }
  }
  return null;
}

/**
 * 广播消息到所有组件（通过 background）
 */
async function broadcastMessage(message) {
  await sendMessage('BROADCAST_MESSAGE', message);
}

// Default settings
const defaultSettings = {
  enabled: false,
  debugMode: false,
  blockedDomains: [],
  blockedResponseDomains: [],
  whitelistMode: false,
  whitelist: []
};

// DOM Elements
const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggle-btn');
const debugModeCheckbox = document.getElementById('debug-mode');

// AI Settings Elements
const aiMultiThinkingCheckbox = document.getElementById('ai-multi-thinking-enabled');
const aiRoundsSetting = document.getElementById('ai-rounds-setting');
const aiThinkingRoundsSelect = document.getElementById('ai-thinking-rounds');

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
  debugModeCheckbox.checked = settings.debugMode || false;

  // 白名单模式
  const whitelistCheckbox = document.getElementById('whitelist-mode');
  if (whitelistCheckbox) {
    whitelistCheckbox.checked = settings.whitelistMode || false;
    whitelistCheckbox.addEventListener('change', async () => {
      const result = await chrome.storage.sync.get('settings');
      const currentSettings = result.settings || defaultSettings;
      currentSettings.whitelistMode = whitelistCheckbox.checked;
      await chrome.storage.sync.set({ settings: currentSettings });
    });
  }

  // Load AI settings
  loadAISettings(settings);

  // Load script switches
  await loadScriptSwitches();

  // Load blocked domains
  await loadBlockedDomains();
}

// Load AI settings
function loadAISettings(settings) {
  const aiSettings = settings.ai || {};
  const multiThinking = aiSettings.multiThinking || { enabled: false, rounds: 3 };

  if (aiMultiThinkingCheckbox) {
    aiMultiThinkingCheckbox.checked = multiThinking.enabled;
  }

  if (aiRoundsSetting) {
    aiRoundsSetting.style.display = multiThinking.enabled ? 'block' : 'none';
  }

  if (aiThinkingRoundsSelect) {
    aiThinkingRoundsSelect.value = String(multiThinking.rounds);
  }
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

  // Notify content scripts (使用 EventBus)
  try {
    await waitForEventBus();
    await EventBus.publish('TOGGLE_EXTENSION', {
      enabled: newSettings.enabled
    });
  } catch (error) {
    console.warn('[Popup] 通知失败:', error);
  }
}

// Event Listeners
toggleBtn.addEventListener('click', toggleExtension);

debugModeCheckbox.addEventListener('change', () => {
  saveSettings({ debugMode: debugModeCheckbox.checked });
});

// ========== Script Switches Management ==========
const SCRIPT_SWITCHES_KEY = 'scriptSwitches';

// 获取所有脚本开关 checkbox
const scriptSwitchCheckboxes = document.querySelectorAll('[data-script]');

// 加载脚本开关状态
async function loadScriptSwitches() {
  try {
    const result = await chrome.storage.local.get(SCRIPT_SWITCHES_KEY);
    const switches = result[SCRIPT_SWITCHES_KEY] || {};

    // 获取默认开关配置
    const defaultSwitches = {
      'redirect-links': true,
      'text-to-link': true,
      'link-blank': true,
      'add-title': true,
      'doc-generator': true,
      'text-collector': true,
      'keyboard-pagination': true,
      'panel-position-manager': true,
      'widen-page': false,
      'tab-focus': true
    };

    // 合并默认值和存储的值
    const mergedSwitches = { ...defaultSwitches, ...switches };

    // 更新 UI
    scriptSwitchCheckboxes.forEach(checkbox => {
      const scriptName = checkbox.dataset.script;
      checkbox.checked = mergedSwitches[scriptName] !== false;
    });

    console.log('[ScriptSwitches] 已加载:', mergedSwitches);
  } catch (error) {
    console.error('[ScriptSwitches] 加载失败:', error);
  }
}

// 保存单个脚本开关状态
async function saveScriptSwitch(scriptName, enabled) {
  try {
    const result = await chrome.storage.local.get(SCRIPT_SWITCHES_KEY);
    const switches = result[SCRIPT_SWITCHES_KEY] || {};
    switches[scriptName] = enabled;
    await chrome.storage.local.set({ [SCRIPT_SWITCHES_KEY]: switches });
    console.log(`[ScriptSwitches] 已保存 ${scriptName}: ${enabled}`);
  } catch (error) {
    console.error('[ScriptSwitches] 保存失败:', error);
  }
}

// 为每个脚本开关添加事件监听
scriptSwitchCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const scriptName = checkbox.dataset.script;
    const enabled = checkbox.checked;
    saveScriptSwitch(scriptName, enabled);

    // widen-page 开关联动宽度设置显示
    if (scriptName === 'widen-page') {
      const widthSetting = document.getElementById('widen-page-width-setting');
      if (widthSetting) widthSetting.style.display = enabled ? 'block' : 'none';
    }
  });
});

// 页面宽度百分比控制
const widenPageWidthSlider = document.getElementById('widen-page-width');
const widenPageWidthValue = document.getElementById('widen-page-width-value');
const widenPageCheckbox = document.getElementById('script-widen-page');

if (widenPageWidthSlider) {
  // 加载保存的宽度值
  chrome.storage.local.get('widenPageWidth', (result) => {
    const width = result.widenPageWidth || 80;
    widenPageWidthSlider.value = width;
    if (widenPageWidthValue) widenPageWidthValue.textContent = width;

    // 根据开关状态显示/隐藏宽度设置
    const widthSetting = document.getElementById('widen-page-width-setting');
    if (widthSetting && widenPageCheckbox) {
      widthSetting.style.display = widenPageCheckbox.checked ? 'block' : 'none';
    }
  });

  // 滑块变更时保存并实时通知页面
  widenPageWidthSlider.addEventListener('input', () => {
    const width = parseInt(widenPageWidthSlider.value, 10);
    if (widenPageWidthValue) widenPageWidthValue.textContent = width;
    chrome.storage.local.set({ widenPageWidth: width });

    // 实时通知当前活动标签页更新宽度
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'WIDEN_PAGE_WIDTH_UPDATE',
          width: width
        }).catch(() => {});
      }
    });
  });
}


// Load blocked domains
async function loadBlockedDomains() {
  try {
    const result = await sendMessage('GET_BLOCKED_DOMAINS');
    console.log('[Blocked Domains] Response:', result);
    if (result) {
      renderBlockedDomains(result.blockedDomains || []);
      renderBlockedResponseDomains(result.blockedResponseDomains || []);

      // Debug log
      console.log('[Blocked Domains] Loaded:', result.blockedDomains);
      console.log('[Blocked Domains] Current domain:', result.currentDomain);
    } else {
      console.error('[Blocked Domains] No result from background');
      renderBlockedDomains([]);
      renderBlockedResponseDomains([]);
    }
  } catch (error) {
    console.error('[Blocked Domains] Error loading:', error);
    renderBlockedDomains([]);
    renderBlockedResponseDomains([]);
  }
}

// Render blocked domains in UI
function renderBlockedDomains(domains) {
  if (!blockedDomainsList) {
    console.error('[Blocked Domains] blockedDomainsList element not found');
    return;
  }

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

  const result = await sendMessage('ADD_BLOCKED_DOMAIN', { domain });

  if (result.success) {
    domainInput.value = '';
    renderBlockedDomains(result.domains);
  } else {
    alert('Failed to add domain');
  }
}

// Remove blocked domain
async function removeDomain(domain) {
  const result = await sendMessage('REMOVE_BLOCKED_DOMAIN', { domain });

  if (result.success) {
    const updatedResult = await sendMessage('GET_BLOCKED_DOMAINS');
    renderBlockedDomains(updatedResult.blockedDomains || []);
  } else {
    alert('Failed to remove domain');
  }
}

// Add blocked response domain
async function addResponseDomain(domain) {
  if (!domain) return;

  const result = await sendMessage('ADD_BLOCKED_RESPONSE_DOMAIN', { domain });

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
    const result = await sendMessage('ADD_BLOCKED_RESPONSE_DOMAIN', { domain });

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
  const result = await sendMessage('REMOVE_BLOCKED_RESPONSE_DOMAIN', { domain });

  if (result.success) {
    const updatedResult = await sendMessage('GET_BLOCKED_DOMAINS');
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

/**
 * 激活 content script（触发懒初始化）
 */
async function activateContentScript() {
  console.log('[Popup] 激活 content script');
  try {
    // 获取当前激活的 tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      console.log('[Popup] 无有效 tab，跳过激活');
      return;
    }

    // 排除扩展程序页面和特殊页面
    const url = tab.url;
    if (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('brave://')) {
      console.log('[Popup] 当前 tab 是特殊页面，跳过激活:', url.substring(0, 50));
      return;
    }

    // 发送激活消息
    await sendMessage('EXTENSION_ACTIVATE', { source: 'popup' });
    console.log('[Popup] 激活成功');
  } catch (error) {
    // 忽略常见错误（如 tab 没有 content script）
    if (!error.message?.includes('Receiving end does not exist')) {
      console.warn('[Popup] 激活失败:', error);
    }
  }
}

// Initialize popup
loadSettings().catch(console.error);

// popup 打开时激活 content script
activateContentScript();

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
    const result = await sendMessage('ADD_BLOCKED_DOMAIN', { domain });

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

// Clear all blocked domains
async function clearAllDomains() {
  const result = await sendMessage('GET_BLOCKED_DOMAINS');

  if (!result || !result.blockedDomains || result.blockedDomains.length === 0) {
    return;
  }

  // Remove each domain
  for (const domain of result.blockedDomains) {
    await sendMessage('REMOVE_BLOCKED_DOMAIN', { domain });
  }

  // Reload the list
  await loadBlockedDomains();
}

// Clear all blocked response domains
async function clearAllResponseDomains() {
  const result = await sendMessage('GET_BLOCKED_DOMAINS');

  if (!result || !result.blockedResponseDomains || result.blockedResponseDomains.length === 0) {
    return;
  }

  // Remove each domain
  for (const domain of result.blockedResponseDomains) {
    await sendMessage('REMOVE_BLOCKED_RESPONSE_DOMAIN', { domain });
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
 * Parse keywords - newline separated, each line is one keyword
 * Auto deduplicates
 */
function parseKeywords(text) {
  if (!text) return [];

  // 按换行符分割，每行一个关键词
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l);

  // 去重
  return [...new Set(lines)];
}

/**
 * Format keywords as newline-separated for display
 * Each keyword on its own line
 */
function formatKeywords(keywords) {
  return keywords.join('\n');
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

  // Update keywords count
  updateKeywordsCount();
}

/**
 * Update keywords count display
 */
function updateKeywordsCount() {
  const douyinCountEl = document.getElementById('douyin-keywords-count');
  const biliCountEl = document.getElementById('bili-keywords-count');

  if (douyinCountEl && notInterestedKeywordsTextarea) {
    const keywords = parseKeywords(notInterestedKeywordsTextarea.value);
    douyinCountEl.textContent = `(${keywords.length}个)`;
    console.log('[Popup] 更新抖音关键词数量:', keywords.length);
  }

  if (biliCountEl && biliNotInterestedKeywordsTextarea) {
    const keywords = parseKeywords(biliNotInterestedKeywordsTextarea.value);
    biliCountEl.textContent = `(${keywords.length}个)`;
    console.log('[Popup] 更新B站关键词数量:', keywords.length);
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

  // Update keywords count
  updateKeywordsCount();

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
const batchAddPanel = document.getElementById('batch-add-panel');
const batchSelectorsInput = document.getElementById('batch-selectors-input');
const batchAddBtn = document.getElementById('batch-add-selectors-btn');
const closeBatchPanelBtn = document.getElementById('close-batch-panel-btn');
const confirmBatchAddBtn = document.getElementById('confirm-batch-add-btn');

// Default hide elements selectors
const defaultHideElementsSelectors = [];

/**
 * Parse CSS selectors - supports complex selectors with quotes inside
 * Uses a smarter approach to handle selectors like: xg-icon:not([class*="foo"])
 * Supports: newline-separated, space-separated (with quotes for complex selectors)
 */
function parseSelectors(text) {
  if (!text) return [];

  // 首先尝试按换行符分割（优先）
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l);
  if (lines.length > 1) {
    // 如果有多行，按行处理
    const result = [];
    for (const line of lines) {
      // 检查是否是引号包裹的选择器
      if ((line.startsWith('"') && line.endsWith('"')) ||
          (line.startsWith("'") && line.endsWith("'"))) {
        result.push(line.slice(1, -1));
      } else {
        result.push(line);
      }
    }
    return [...new Set(result)];
  }

  // 单行情况，按空格分割（需要处理引号）
  const result = [];
  let current = '';
  let depth = 0; // Track parenthesis/bracket depth
  let inQuote = null; // Track quote state

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 处理引号
    if ((char === '"' || char === "'") && depth === 0) {
      if (inQuote === char) {
        // 结束引号
        inQuote = null;
        // 引号内的内容作为完整选择器
        if (current.trim()) {
          result.push(current.trim());
        }
        current = '';
        continue;
      } else if (!inQuote) {
        // 开始引号
        inQuote = char;
        continue;
      }
    }

    // 在引号内，直接添加字符
    if (inQuote) {
      current += char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth--;
      current += char;
    } else if (/\s/.test(char) && depth === 0) {
      // Whitespace at depth 0 means selector boundary
      if (current.trim()) {
        result.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last selector
  if (current.trim()) {
    result.push(current.trim());
  }

  // Deduplicate using Set
  return [...new Set(result)];
}

/**
 * Format selectors for display (newline-separated, easier to read)
 * Each selector on its own line
 */
function formatSelectors(selectors) {
  return selectors.join('\n');
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
// 各网站默认隐藏选择器（备用数据，当 content script 未加载时使用）
const DEFAULT_SELECTORS_BY_DOMAIN = {
  'douyin.com': [
    '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
    '.ooIf2jbM',
    '._e7lJDCC',
    '#island_076c3',
    '.ai-note-container',
    '.cursorPointer+*',
    'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])',
    '.danmakuContainer',
    '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)'
  ],
  'www.douyin.com': [
    '.qmhaloYp:nth-child(n):not(:nth-child(2)):not(:nth-child(5))',
    '.ooIf2jbM',
    '._e7lJDCC',
    '#island_076c3',
    '.ai-note-container',
    '.cursorPointer+*',
    'xg-right-grid>xg-icon:not([class*="automatic-continuous"]):not([class*="xgplayer-volume"])',
    '.danmakuContainer',
    '#douyin-header-menuCt>div>pace-island>div>*:not(:last-child)'
  ],
  'bilibili.com': [
    '.left-entry>.v-popover-wrap:nth-child(n+2)',
    '.floor-single-card:has(.living)',
    '.bili-feed-card:has(.bili-live-card)',
    '.floor-single-card:has(.floor-title)',
    '.bili-feed-card:not(:has(a))',
    '.feed-card:not(:has(a))'
  ],
  'www.bilibili.com': [
    '.left-entry>.v-popover-wrap:nth-child(n+2)',
    '.floor-single-card:has(.living)',
    '.bili-feed-card:has(.bili-live-card)',
    '.floor-single-card:has(.floor-title)',
    '.bili-feed-card:not(:has(a))',
    '.feed-card:not(:has(a))'
  ],
  'pornhub.com': [
    '.cnhmmcccai',
    '.alpha',
    '#dbdcdkcbbd',
    '#countryRedirectMessage',
    '.video-wrapper>.hd.clear.original',
    '#welcome'
  ],
  'www.pornhub.com': [
    '.cnhmmcccai',
    '.alpha',
    '#dbdcdkcbbd',
    '#countryRedirectMessage',
    '.video-wrapper>.hd.clear.original',
    '#welcome'
  ],
  '4hu.tv': ['.kkm-content'],
  'www.4hu.tv': ['.kkm-content']
};

async function getDefaultHideSelectors() {
  // 先尝试从 content script 获取
  try {
    console.log('[隐藏元素] 尝试从 content script 获取默认选择器');
    const response = await sendMessageToContentScript({
      type: 'GET_DEFAULT_HIDE_SELECTORS'
    });

    console.log('[隐藏元素] 收到响应:', response);

    if (response && response.success && response.selectors && response.selectors.length > 0) {
      console.log('[隐藏元素] ✓ 从 content script 获取默认选择器:', response.selectors.length, '个');
      return response.selectors;
    } else {
      console.log('[隐藏元素] 收到响应但选择器为空');
    }
  } catch (error) {
    console.log('[隐藏元素] 获取失败:', error.message);
  }

  // 失败时使用硬编码数据
  console.log('[隐藏元素] 使用硬编码默认选择器');
  const domain = await getCurrentDomain();
  if (domain && DEFAULT_SELECTORS_BY_DOMAIN[domain]) {
    console.log('[隐藏元素] 硬编码数据:', domain, DEFAULT_SELECTORS_BY_DOMAIN[domain].length, '个');
    return DEFAULT_SELECTORS_BY_DOMAIN[domain];
  }

  console.log('[隐藏元素] 无默认选择器');
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

  // 尝试从本地服务器加载数据
  let localServerSelectors = [];
  if (domain) {
    try {
      // 尝试两种域名格式：原始格式 和 带/不带 www. 的格式
      const domainsToTry = [domain];
      if (domain.startsWith('www.')) {
        domainsToTry.push(domain.slice(4)); // 移除 www.
      } else {
        domainsToTry.push('www.' + domain); // 添加 www.
      }

      for (const tryDomain of domainsToTry) {
        const response = await fetch(`http://localhost:3000/api/data/selectors/${tryDomain}`, {
          signal: AbortSignal.timeout(2000)
        });
        const data = await response.json();
        if (data.success && data.data && (Array.isArray(data.data) || typeof data.data === 'string')) {
          if (Array.isArray(data.data)) {
            localServerSelectors = data.data;
          } else if (typeof data.data === 'string' && data.data.trim()) {
            localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
          }
          console.log('[隐藏元素] 从本地服务器加载:', tryDomain, localServerSelectors.length, '个选择器');
          break; // 找到数据就停止
        }
      }
    } catch (e) {
      console.log('[隐藏元素] 本地服务器加载失败:', e.message);
    }
  }

  // Get settings for current domain
  const hasCustomSettings = domain && allSettings[domain];
  let settings;
  if (hasCustomSettings) {
    settings = allSettings[domain];
    // Merge: default + chrome storage + local server (remove duplicates)
    const mergedSelectors = [...new Set([...defaultSelectors, ...(settings.selectors || []), ...localServerSelectors])];
    settings.selectors = mergedSelectors;
    console.log('[隐藏元素] 从存储加载:', domain, settings);
  } else if (localServerSelectors.length > 0) {
    // 有本地服务器数据但没有 Chrome 存储数据
    settings = {
      enabled: true,
      selectors: [...new Set([...defaultSelectors, ...localServerSelectors])]
    };
    console.log('[隐藏元素] 从本地服务器加载:', domain, settings);
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

  // 调用 loadSelectorsEditor 来正确加载编辑器和列表
  // （编辑器只显示用户选择器，列表显示所有合并后的选择器）
  await loadSelectorsEditor();

  // Show manager only if enabled or has selectors to display
  const shouldShowManager = settings.enabled || (settings.selectors && settings.selectors.length > 0);
  const manager = document.getElementById('hide-elements-manager');
  if (manager) {
    manager.style.display = shouldShowManager ? 'block' : 'none';
  }
}

/**
 * Save hide elements settings (domain-specific)
 * @param {string[]} userSelectors - 用户选择器数组（可选，不传则从编辑器读取）
 */
async function saveHideElementsSettings(userSelectors = null) {
  const enabled = hideElementsEnabledCheckbox ? hideElementsEnabledCheckbox.checked : false;
  const domain = await getCurrentDomain();

  if (!domain) {
    console.error('Failed to save hide elements settings: unable to get current domain');
    return;
  }

  // 获取默认选择器
  const defaultSelectors = await getDefaultHideSelectors();

  // 获取本地服务器选择器
  let localServerSelectors = [];
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data;
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  // 如果没有传入 userSelectors，从编辑器读取（只包含用户添加的）
  if (userSelectors === null) {
    userSelectors = parseSelectorsFromEditor();
  }

  // 用户选择器去重
  userSelectors = [...new Set(userSelectors)];

  // 合并所有选择器（默认 + 本地服务器 + 用户），用于发送给 content script
  const mergedSelectors = [...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors])];

  // 获取所有现有设置
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};

  // 只保存用户选择器到存储（不包含默认和本地服务器的）
  allSettings[domain] = { enabled, selectors: userSelectors };

  // 保存到 Chrome 存储
  await chrome.storage.local.set({
    hideElementsSettings: allSettings
  });

  // 同步用户选择器到本地服务器
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userSelectors)
    });
    console.log('已同步用户选择器到本地服务器:', normalizedDomain);
  } catch (e) {
    console.log('同步到本地服务器失败:', e.message);
  }

  console.log('隐藏元素设置已保存:', {
    enabled,
    default: defaultSelectors.length,
    localServer: localServerSelectors.length,
    user: userSelectors.length,
    total: mergedSelectors.length
  });

  // 更新列表显示和编辑器
  await loadSelectorsEditor();

  // Notify content script to update hide elements (发送合并后的选择器)
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

/**
 * 渲染隐藏选择器列表
 */
async function renderHideSelectorsList() {
  const domain = await getCurrentDomain();
  if (!domain) return;

  // 获取默认选择器
  const defaultSelectors = await getDefaultHideSelectors();

  // 从存储获取用户选择器
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  const domainSettings = allSettings[domain] || {};
  const userSelectors = domainSettings.selectors || [];

  // 从本地服务器获取选择器
  let localServerSelectors = [];
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data;
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  // 合并所有选择器并去重
  const allSelectors = [...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors])];

  // 获取编辑器容器
  const editor = document.getElementById('hide-elements-editor');
  if (!editor) return;

  // 清空现有内容
  editor.innerHTML = '';

  // 渲染选择器列表
  allSelectors.forEach(selector => {
    const item = document.createElement('div');
    item.className = 'selector-item';

    // 判断选择器来源
    let source = '用户添加';
    if (defaultSelectors.includes(selector)) {
      source = '默认';
      item.classList.add('default-selector');
    } else if (localServerSelectors.includes(selector)) {
      source = '本地服务器';
      item.classList.add('local-server-selector');
    }

    item.innerHTML = `
      <span class="selector-text">${escapeHtml(selector)}</span>
      <span class="selector-source">${source}</span>
      <button class="selector-delete" data-selector="${escapeHtml(selector)}" title="删除">×</button>
    `;

    editor.appendChild(item);
  });

  // 添加删除事件监听
  editor.querySelectorAll('.selector-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const selectorToDelete = btn.getAttribute('data-selector');
      await deleteSelector(selectorToDelete);
    });
  });

  console.log('[隐藏元素] 已渲染选择器列表:', allSelectors.length, '个');
}

/**
 * 删除选择器
 */
async function deleteSelector(selector) {
  const domain = await getCurrentDomain();
  if (!domain) return;

  // 获取当前设置
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  const domainSettings = allSettings[domain] || {};
  const currentSelectors = domainSettings.selectors || [];

  // 获取默认选择器和本地服务器选择器
  const defaultSelectors = await getDefaultHideSelectors();
  let localServerSelectors = [];
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data;
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
      }
    }
  } catch (e) {
    // 忽略
  }

  // 只能删除用户添加的选择器，不能删除默认和本地服务器的
  if (defaultSelectors.includes(selector) || localServerSelectors.includes(selector)) {
    console.log('[隐藏元素] 不能删除默认或本地服务器选择器:', selector);
    return;
  }

  // 从用户选择器中删除
  const newSelectors = currentSelectors.filter(s => s !== selector);

  // 保存
  await saveHideElementsSettings(newSelectors);

  // 重新渲染列表
  await renderHideSelectorsList();
}

// Add event listeners for hide elements
if (hideElementsEnabledCheckbox) {
  hideElementsEnabledCheckbox.addEventListener('change', () => {
    saveHideElementsSettings();
  });
}

// 批量添加面板事件
if (batchAddBtn) {
  batchAddBtn.addEventListener('click', () => {
    if (batchAddPanel) {
      batchAddPanel.style.display = batchAddPanel.style.display === 'none' ? 'block' : 'none';
      if (batchSelectorsInput) batchSelectorsInput.focus();
    }
  });
}

if (closeBatchPanelBtn) {
  closeBatchPanelBtn.addEventListener('click', () => {
    if (batchAddPanel) {
      batchAddPanel.style.display = 'none';
      if (batchSelectorsInput) batchSelectorsInput.value = '';
    }
  });
}

if (confirmBatchAddBtn) {
  confirmBatchAddBtn.addEventListener('click', async () => {
    if (!batchSelectorsInput) return;
    const inputText = batchSelectorsInput.value.trim();
    if (!inputText) return;

    const newSelectors = parseSelectors(inputText);
    if (newSelectors.length === 0) return;

    // 添加到现有选择器
    const domain = await getCurrentDomain();
    const result = await chrome.storage.local.get(['hideElementsSettings']);
    const allSettings = result.hideElementsSettings || {};
    const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };
    const existingSelectors = domainSettings.selectors || [];

    // 合并并去重
    const mergedSelectors = [...new Set([...existingSelectors, ...newSelectors])];

    // 保存
    await saveHideElementsSettings(mergedSelectors);

    // 清空并关闭面板
    batchSelectorsInput.value = '';
    batchAddPanel.style.display = 'none';

    // 刷新列表
    await renderHideSelectorsList();
  });
}

// Load hide elements settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadHideElementsSettings().catch(console.error);
  checkLocalServerStatus();
  // 检查是否有待处理的选中元素
  checkPendingPickedElement();
});

/**
 * 检查是否有待处理的选中元素（popup 重新打开时）
 */
async function checkPendingPickedElement() {
  try {
    const result = await chrome.storage.local.get(['pendingPickedElement']);
    if (result.pendingPickedElement) {
      const pending = result.pendingPickedElement;
      // 检查是否是最近5秒内的选择
      if (Date.now() - pending.timestamp < 5000) {
        handlePickedElement(pending);
      }
      // 清除待处理元素
      await chrome.storage.local.remove(['pendingPickedElement']);
    }
  } catch (error) {
    console.error('[Popup] 检查待处理元素失败:', error);
  }
}

// ========== 本地服务状态检测 ==========
const LOCAL_SERVER_URL = 'http://localhost:3000';

async function checkLocalServerStatus() {
  const statusDot = document.getElementById('server-status-dot');
  const statusText = document.getElementById('server-status-text');
  const statusDetail = document.getElementById('server-status-detail');

  if (!statusDot || !statusText) return;

  try {
    const response = await fetch(`${LOCAL_SERVER_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    const result = await response.json();

    if (result.status === 'ok') {
      statusDot.style.background = '#28a745';
      statusText.textContent = '本地服务: 已连接';

      // 获取详细数据
      try {
        let domain = await getCurrentDomain();
        if (domain) {
          // 尝试两种域名格式
          const domainsToTry = [domain];
          if (domain.startsWith('www.')) {
            domainsToTry.push(domain.slice(4));
          } else {
            domainsToTry.push('www.' + domain);
          }

          let keywordsData = null;
          for (const tryDomain of domainsToTry) {
            const keywordsRes = await fetch(`${LOCAL_SERVER_URL}/api/data/keywords/${tryDomain}`);
            const data = await keywordsRes.json();
            if (data.success && data.data) {
              keywordsData = data;
              domain = tryDomain; // 使用找到数据的域名
              break;
            }
          }

          console.log('[本地服务] 关键词响应:', JSON.stringify(keywordsData));
          const count = keywordsData?.data?.notInterested?.length || 0;
          statusDetail.textContent = `域名: ${domain} | 关键词: ${count}个`;
        }
      } catch (e) {
        console.log('[本地服务] 获取关键词失败:', e);
        statusDetail.textContent = '';
      }
    } else {
      throw new Error('服务异常');
    }
  } catch (error) {
    statusDot.style.background = '#dc3545';
    statusText.textContent = '本地服务: 未连接';
    statusDetail.textContent = '请启动 local-data-server';
  }
}

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

    // Format as comma-separated quoted strings: "a","b","c"
    const arrayFormat = keywords.map(k => `"${k}"`).join(',');

    // Set clipboard data
    e.preventDefault();
    e.clipboardData.setData('text/plain', arrayFormat);
    console.log('[复制] 已转换为数组格式:', arrayFormat);
  });
}

// Setup copy listeners for keywords textareas
setupCopyAsArray(notInterestedKeywordsTextarea);
setupCopyAsArray(autoFollowKeywordsTextarea);

// Add paste event listener - auto convert JSON array to space-separated format
function setupPasteFromArray(textarea) {
  if (!textarea) return;

  textarea.addEventListener('paste', (e) => {
    const pastedText = e.clipboardData.getData('text');

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(pastedText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Convert to space-separated format, remove spaces from each item
        const formatted = parsed
          .filter(item => typeof item === 'string' && item.trim())
          .map(item => item.replace(/\s+/g, ''))
          .join(' ');
        if (formatted) {
          e.preventDefault();

          // Insert at cursor position or replace selection
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const before = textarea.value.substring(0, start);
          const after = textarea.value.substring(end);

          textarea.value = before + formatted + after;

          // Move cursor to end of pasted content
          const newPos = start + formatted.length;
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;

          console.log('[粘贴] 已从数组格式转换:', formatted);
        }
      }
    } catch (e) {
      // Not a JSON array, use default paste behavior
    }
  });
}

// Setup paste listeners for keywords textareas
setupPasteFromArray(notInterestedKeywordsTextarea);
setupPasteFromArray(autoFollowKeywordsTextarea);

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

  // Update keywords count
  updateKeywordsCount();
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

  // Update keywords count
  updateKeywordsCount();

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
setupPasteFromArray(biliNotInterestedKeywordsTextarea);

// Load keywords when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadKeywords().catch(console.error);
  await loadBiliKeywords().catch(console.error);
  // Update keywords sections visibility
  updateDouyinKeywordsVisibility().catch(console.error);
  updateBilibiliKeywordsVisibility().catch(console.error);
  // 确保 keyword count 在加载后更新
  updateKeywordsCount();
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


// ========== 隐藏选择器编辑器 ==========
const selectorsEditor = document.getElementById('selectors-editor');
const selectorsCount = document.getElementById('selectors-count');
const currentDomainName = document.getElementById('current-domain-name');
const saveSelectorsBtn = document.getElementById('save-selectors-btn');

/**
 * 加载选择器到编辑器
 */
async function loadSelectorsEditor() {
  const domain = await getCurrentDomain();
  if (!domain) return;

  // 更新当前域名显示
  if (currentDomainName) {
    currentDomainName.textContent = domain;
  }

  // 获取默认选择器
  const defaultSelectors = await getDefaultHideSelectors();

  // 尝试从本地服务器加载数据
  let localServerSelectors = [];
  try {
    const domainsToTry = [domain];
    if (domain.startsWith('www.')) {
      domainsToTry.push(domain.slice(4));
    } else {
      domainsToTry.push('www.' + domain);
    }

    for (const tryDomain of domainsToTry) {
      const response = await fetch(`http://localhost:3000/api/data/selectors/${tryDomain}`, {
        signal: AbortSignal.timeout(2000)
      });
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        localServerSelectors = data.data;
        console.log('[隐藏选择器] 从本地服务器加载:', tryDomain, localServerSelectors.length, '个');
        break;
      }
    }
  } catch (e) {
    console.log('[隐藏选择器] 本地服务器加载失败:', e.message);
  }

  // 从 Chrome 存储加载（仅用户添加的选择器）
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  const domainSettings = allSettings[domain] || { selectors: [] };
  const userSelectors = domainSettings.selectors || [];

  // 编辑器只显示用户添加的选择器（不包含默认和本地服务器的）
  // 这样用户编辑时不会意外修改默认或本地服务器的选择器
  if (selectorsEditor) {
    selectorsEditor.value = userSelectors.join('\n');
  }

  // 更新计数显示总选择器数（默认+本地服务器+用户）
  const totalSelectors = [...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors])];
  updateSelectorsCount(totalSelectors.length, defaultSelectors.length, localServerSelectors.length, userSelectors.length);

  // 同时渲染列表（显示所有合并后的选择器）
  await renderHideSelectorsList();
}

/**
 * 更新选择器计数
 * @param {number} total - 总选择器数（默认+本地服务器+用户）
 * @param {number} defaultCount - 默认选择器数
 * @param {number} localServerCount - 本地服务器选择器数
 * @param {number} userCount - 用户选择器数
 */
function updateSelectorsCount(total = null, defaultCount = null, localServerCount = null, userCount = null) {
  if (selectorsCount) {
    if (total !== null && defaultCount !== null && localServerCount !== null && userCount !== null) {
      selectorsCount.textContent = `(${total}个 - 默认${defaultCount}+服务器${localServerCount}+用户${userCount})`;
    } else if (selectorsEditor) {
      // Fallback: parse from editor (only user selectors)
      const selectors = parseSelectorsFromEditor();
      selectorsCount.textContent = `(${selectors.length}个用户选择器)`;
    }
  }
}

/**
 * 从编辑器解析选择器（每行一个）
 */
function parseSelectorsFromEditor() {
  if (!selectorsEditor) return [];
  const text = selectorsEditor.value.trim();
  if (!text) return [];

  // 按换行分割，去重，过滤空行
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line);
  return [...new Set(lines)];
}

/**
 * 保存选择器
 */
async function saveSelectors() {
  const domain = await getCurrentDomain();
  if (!domain) return;

  // 用户选择器（从编辑器读取）
  const userSelectors = parseSelectorsFromEditor();

  // 获取默认选择器和本地服务器选择器
  const defaultSelectors = await getDefaultHideSelectors();
  let localServerSelectors = [];
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        localServerSelectors = data.data;
      } else if (typeof data.data === 'string' && data.data.trim()) {
        localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  // 合并所有选择器（用于发送给 content script）
  const mergedSelectors = [...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors])];

  // 保存用户选择器到 Chrome 存储
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  allSettings[domain] = { enabled: userSelectors.length > 0 || defaultSelectors.length > 0 || localServerSelectors.length > 0, selectors: userSelectors };
  await chrome.storage.local.set({ hideElementsSettings: allSettings });

  // 同步用户选择器到本地服务器
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userSelectors)
    });
    console.log('[隐藏选择器] 已同步到本地服务器:', normalizedDomain);
  } catch (e) {
    console.log('[隐藏选择器] 同步到本地服务器失败:', e.message);
  }

  // 通知 content script（发送合并后的选择器）
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_HIDE_ELEMENTS',
        enabled: mergedSelectors.length > 0,
        selectors: mergedSelectors
      }).catch(() => {});
    }
  } catch (error) {
    console.error('[隐藏选择器] 通知 content script 失败:', error);
  }

  // 更新计数和列表
  await loadSelectorsEditor();

  // 显示保存成功提示
  const btn = document.getElementById('save-selectors-btn');
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '已保存 ✓';
    btn.style.background = '#28a745';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 1500);
  }

  console.log('[隐藏选择器] 已保存:', {
    default: defaultSelectors.length,
    localServer: localServerSelectors.length,
    user: userSelectors.length,
    total: mergedSelectors.length
  });
}

// 事件监听
if (saveSelectorsBtn) {
  saveSelectorsBtn.addEventListener('click', saveSelectors);
}

if (selectorsEditor) {
  // 实时更新计数（需要重新获取默认和本地服务器选择器来计算总数）
  selectorsEditor.addEventListener('input', async () => {
    const domain = await getCurrentDomain();
    if (!domain) return;

    const defaultSelectors = await getDefaultHideSelectors();
    let localServerSelectors = [];
    try {
      const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
      const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
        signal: AbortSignal.timeout(500)
      });
      const data = await response.json();
      if (data.success && data.data) {
        if (Array.isArray(data.data)) {
          localServerSelectors = data.data;
        } else if (typeof data.data === 'string' && data.data.trim()) {
          localServerSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
        }
      }
    } catch (e) {
      // 忽略本地服务器错误
    }

    const userSelectors = parseSelectorsFromEditor();
    const totalSelectors = [...new Set([...defaultSelectors, ...localServerSelectors, ...userSelectors])];
    updateSelectorsCount(totalSelectors.length, defaultSelectors.length, localServerSelectors.length, userSelectors.length);
  });
}

// 加载编辑器
document.addEventListener('DOMContentLoaded', () => {
  loadSelectorsEditor();
  initNavigation();
});

// ========== Tab切换 ==========
function initNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  console.log('[Tab] tabBtns:', tabBtns.length);
  console.log('[Tab] tabPanels:', tabPanels.length);

  if (tabBtns.length === 0) {
    console.error('[Tab] No tab buttons found!');
    return;
  }

  function showTab(tabName) {
    // 隐藏所有面板
    tabPanels.forEach(panel => panel.classList.remove('active'));
    // 移除所有按钮active
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // 显示目标面板
    const targetPanel = document.getElementById(`${tabName}-tab`);
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);

    if (targetPanel) {
      targetPanel.classList.add('active');
    }
    if (targetBtn) {
      targetBtn.classList.add('active');
    }

    // 加载对应数据
    if (tabName === 'global') {
      loadGlobalSettings();
    } else if (tabName === 'stats') {
      loadStatsData();
      drawStatsChart();
    } else if (tabName === 'home') {
      loadClipboardHistory();
    } else if (tabName === 'page') {
      loadBlockedDomains();
      loadHideElementsSettings();
    }
  }

  // 为每个Tab按钮添加点击事件
  tabBtns.forEach(btn => {
    console.log('[Tab] Adding click listener to:', btn.dataset.tab);
    btn.addEventListener('click', (e) => {
      console.log('[Tab] Clicked:', btn.dataset.tab);
      const tabName = btn.dataset.tab;
      showTab(tabName);
    });
  });

  // 初始加载首页数据
  showTab('home');
}

// ========== 统计面板 ==========
async function loadStatsData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response?.success && response.stats) {
      renderStats(response.stats);
    }
  } catch (error) {
    console.error('[Stats] 加载统计数据失败:', error);
  }
}

function renderStats(stats) {
  // 今日数据
  const todayBlocked = document.getElementById('today-blocked');
  const todayHidden = document.getElementById('today-hidden');
  const todayBytes = document.getElementById('today-bytes');

  if (todayBlocked) todayBlocked.textContent = formatNumber(stats.today?.blocked || 0);
  if (todayHidden) todayHidden.textContent = formatNumber(stats.today?.hidden || 0);
  if (todayBytes) todayBytes.textContent = formatBytes(stats.today?.bytes || 0);

  // 累计数据
  const totalBlocked = document.getElementById('total-blocked');
  const totalHidden = document.getElementById('total-hidden');
  const totalBytes = document.getElementById('total-bytes');

  if (totalBlocked) totalBlocked.textContent = formatNumber(stats.totalBlocked || 0);
  if (totalHidden) totalHidden.textContent = formatNumber(stats.totalHidden || 0);
  if (totalBytes) totalBytes.textContent = formatBytes(stats.estimatedBytesSaved || 0);

  // 域名排行
  renderDomainRanking(stats.domainStats || {});
}

function renderDomainRanking(domainStats) {
  const container = document.getElementById('domain-ranking');
  if (!container) return;

  const entries = Object.entries(domainStats)
    .map(([domain, data]) => ({
      domain,
      total: (data.blocked || 0) + (data.hidden || 0)
    }))
    .filter(e => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (entries.length === 0) {
    container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无数据</div>';
    return;
  }

  const maxTotal = entries[0].total;
  container.innerHTML = entries.map((e, i) => {
    const percent = Math.round((e.total / maxTotal) * 100);
    return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="width: 16px; color: #666; font-size: 11px;">${i + 1}.</span>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-size: 11px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${escapeHtml(e.domain)}</span>
            <span style="font-size: 11px; color: #666;">${e.total}</span>
          </div>
          <div style="height: 4px; background: #e9ecef; border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: ${percent}%; background: linear-gradient(90deg, #007bff, #0056b3); border-radius: 2px;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

function formatBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + 'GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

// 统计面板事件绑定
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-stats');
  const resetBtn = document.getElementById('reset-stats');
  const exportCsvBtn = document.getElementById('export-stats-csv');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadStatsData();
      drawStatsChart();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('确定要重置所有统计数据吗？此操作不可恢复。')) {
        try {
          await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
          loadStatsData();
          drawStatsChart();
        } catch (error) {
          console.error('[Stats] 重置失败:', error);
        }
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportStatsToCSV);
  }
});

// ========== 统计图表绘制 ==========
function drawStatsChart() {
  const canvas = document.getElementById('stats-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;

  // 设置canvas实际尺寸
  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 模拟7天数据（实际应从存储加载）
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const data = [120, 150, 80, 200, 180, 90, 140]; // 示例数据

  const maxVal = Math.max(...data, 1);
  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / days.length - 10;

  // 绘制背景网格
  ctx.strokeStyle = '#e9ecef';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // 绘制柱状图
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, '#007bff');
  gradient.addColorStop(1, '#0056b3');

  data.forEach((val, i) => {
    const barHeight = (val / maxVal) * chartHeight;
    const x = padding + i * (chartWidth / days.length) + 5;
    const y = height - padding - barHeight;

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    // 绘制标签
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(days[i], x + barWidth / 2, height - 10);
  });
}

// ========== 导出统计CSV ==========
async function exportStatsToCSV() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (!response?.stats) {
      alert('暂无数据可导出');
      return;
    }

    const stats = response.stats;
    let csv = '日期,拦截请求,隐藏元素,节省流量\n';

    // 添加今日数据
    const today = new Date().toISOString().split('T')[0];
    csv += `${today},${stats.today?.blocked || 0},${stats.today?.hidden || 0},${stats.today?.bytes || 0}\n`;

    // 添加累计数据
    csv += `累计,${stats.totalBlocked || 0},${stats.totalHidden || 0},${stats.estimatedBytesSaved || 0}\n`;

    // 下载CSV
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-stats-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[导出CSV] 失败:', error);
    alert('导出失败: ' + error.message);
  }
}

// ========== 通知中心 ==========\n
document.addEventListener('DOMContentLoaded', async () => {
  const bellBtn = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  const closeBtn = document.getElementById('close-notifications');
  const clearBtn = document.getElementById('clear-notifications');
  const badge = document.getElementById('notification-badge');

  // 加载通知
  await loadNotifications();

  if (bellBtn && panel) {
    bellBtn.addEventListener('click', () => {
      panel.style.display = 'block';
      markNotificationsRead();
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => panel.style.display = 'none');
  }

  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) panel.style.display = 'none';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      await chrome.storage.local.remove('notifications');
      await loadNotifications();
    });
  }
});

async function loadNotifications() {
  const list = document.getElementById('notification-list');
  const badge = document.getElementById('notification-badge');
  if (!list) return;

  const result = await chrome.storage.local.get('notifications');
  const notifications = result.notifications || [];

  if (notifications.length === 0) {
    list.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无通知</div>';
    if (badge) badge.style.display = 'none';
    return;
  }

  // 显示未读数量
  const unreadCount = notifications.filter(n => !n.read).length;
  if (badge) badge.style.display = unreadCount > 0 ? 'block' : 'none';

  list.innerHTML = notifications.map((n, i) => `
    <div style="padding: 8px; margin-bottom: 8px; background: ${n.read ? '#f8f9fa' : '#e3f2fd'}; border-radius: 6px; border-left: 3px solid ${n.type === 'success' ? '#28a745' : n.type === 'warning' ? '#ffc107' : '#007bff'};">
      <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${new Date(n.time).toLocaleString('zh-CN')}</div>
      <div style="font-size: 13px;">${escapeHtml(n.message)}</div>
    </div>
  `).join('');
}

async function markNotificationsRead() {
  const result = await chrome.storage.local.get('notifications');
  const notifications = result.notifications || [];
  notifications.forEach(n => n.read = true);
  await chrome.storage.local.set({ notifications });

  const badge = document.getElementById('notification-badge');
  if (badge) badge.style.display = 'none';
}

// 添加通知（供其他模块调用）
async function addNotification(message, type = 'info') {
  const result = await chrome.storage.local.get('notifications');
  const notifications = result.notifications || [];
  notifications.unshift({
    message,
    type,
    time: Date.now(),
    read: false
  });
  // 最多保留20条
  await chrome.storage.local.set({ notifications: notifications.slice(0, 20) });
}

// ========== 快速笔记 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const noteArea = document.getElementById('quick-note');
  const saveBtn = document.getElementById('save-note');
  const clearBtn = document.getElementById('clear-note');

  // 加载笔记
  const result = await chrome.storage.local.get('quickNote');
  if (noteArea && result.quickNote) {
    noteArea.value = result.quickNote;
  }

  // 自动保存
  if (noteArea) {
    noteArea.addEventListener('input', async () => {
      await chrome.storage.local.set({ quickNote: noteArea.value });
    });
  }

  // 保存按钮
  saveBtn?.addEventListener('click', async () => {
    await chrome.storage.local.set({ quickNote: noteArea.value });
    saveBtn.textContent = '已保存 ✓';
    setTimeout(() => saveBtn.textContent = '保存', 1500);
  });

  // 清空按钮
  clearBtn?.addEventListener('click', async () => {
    if (confirm('确定要清空笔记吗？')) {
      noteArea.value = '';
      await chrome.storage.local.remove('quickNote');
    }
  });
});

// ========== 剪贴板历史（增强版） ==========
document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('clipboard-list');
  const clearBtn = document.getElementById('clear-clipboard');

  // 添加搜索框
  if (list && !document.getElementById('clipboard-search')) {
    const searchContainer = document.createElement('div');
    searchContainer.innerHTML = `
      <input type="text" id="clipboard-search" placeholder="搜索剪贴板历史..."
        style="width: 100%; padding: 6px 8px; margin-bottom: 8px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px;">
      <div id="clipboard-filters" style="display: flex; gap: 4px; margin-bottom: 8px;">
        <button class="clipboard-filter active" data-filter="all" style="padding: 4px 8px; font-size: 11px; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; background: #007bff; color: white;">全部</button>
        <button class="clipboard-filter" data-filter="url" style="padding: 4px 8px; font-size: 11px; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer;">URL</button>
        <button class="clipboard-filter" data-filter="code" style="padding: 4px 8px; font-size: 11px; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer;">代码</button>
        <button class="clipboard-filter" data-filter="text" style="padding: 4px 8px; font-size: 11px; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer;">文本</button>
      </div>
    `;
    list.parentNode.insertBefore(searchContainer, list);

    // 搜索事件
    const searchInput = document.getElementById('clipboard-search');
    searchInput?.addEventListener('input', () => {
      loadClipboardHistory(searchInput.value, currentClipboardFilter);
    });

    // 筛选事件
    document.querySelectorAll('.clipboard-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.clipboard-filter').forEach(b => {
          b.classList.remove('active');
          b.style.background = '';
          b.style.color = '';
        });
        btn.classList.add('active');
        btn.style.background = '#007bff';
        btn.style.color = 'white';
        currentClipboardFilter = btn.dataset.filter;
        loadClipboardHistory(document.getElementById('clipboard-search')?.value || '', currentClipboardFilter);
      });
    });
  }

  await loadClipboardHistory();

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('确定要清空所有剪贴板历史吗？')) {
        await chrome.storage.local.remove('clipboardHistory');
        await loadClipboardHistory();
      }
    });
  }
});

let currentClipboardFilter = 'all';

async function loadClipboardHistory(searchQuery = '', filter = 'all') {
  const list = document.getElementById('clipboard-list');
  if (!list) return;

  const result = await chrome.storage.local.get('clipboardHistory');
  let history = result.clipboardHistory || [];

  // 分类检测
  const categorize = (text) => {
    if (/^https?:\/\//i.test(text)) return 'url';
    if (/[\{\}\[\]\(\);=>]/.test(text) && text.includes('\n')) return 'code';
    return 'text';
  };

  // 筛选
  if (filter !== 'all') {
    history = history.filter(item => categorize(item.text) === filter);
  }

  // 搜索
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    history = history.filter(item => item.text.toLowerCase().includes(query));
  }

  if (history.length === 0) {
    list.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无记录</div>';
    return;
  }

  list.innerHTML = history.map((item, i) => {
    const category = categorize(item.text);
    const categoryColor = category === 'url' ? '#17a2b8' : category === 'code' ? '#28a745' : '#6c757d';
    const categoryLabel = category === 'url' ? 'URL' : category === 'code' ? '代码' : '文本';

    // 高亮搜索词
    let displayText = escapeHtml(item.text.slice(0, 100));
    if (searchQuery) {
      const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
      displayText = displayText.replace(regex, '<mark style="background: #fff3cd; padding: 0 2px;">$1</mark>');
    }

    return `
      <div class="clipboard-item" style="padding: 8px; margin-bottom: 4px; background: #f8f9fa; border-radius: 4px; cursor: pointer; overflow: hidden; position: relative;" data-index="${i}">
        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayText}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 10px; color: #999;">${new Date(item.time).toLocaleString('zh-CN')}</span>
          <span style="font-size: 10px; padding: 2px 6px; background: ${categoryColor}; color: white; border-radius: 3px;">${categoryLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  // 点击复制
  list.querySelectorAll('.clipboard-item').forEach(el => {
    el.addEventListener('click', async () => {
      const index = parseInt(el.dataset.index);
      const text = history[index]?.text;
      if (text) {
        await navigator.clipboard.writeText(text);
        el.style.background = '#d4edda';
        setTimeout(() => el.style.background = '', 500);
      }
    });
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 记录剪贴板内容（供content script调用）
async function recordClipboard(text) {
  if (!text || text.length > 1000) return;

  const result = await chrome.storage.local.get('clipboardHistory');
  const history = result.clipboardHistory || [];

  // 去重
  if (history.some(h => h.text === text)) return;

  history.unshift({ text, time: Date.now() });
  await chrome.storage.local.set({ clipboardHistory: history.slice(0, 20) });
}

// ========== 快捷键帮助面板 ==========
document.addEventListener('DOMContentLoaded', () => {
  const helpBtn = document.getElementById('shortcuts-help');
  const panel = document.getElementById('shortcuts-panel');
  const closeBtn = document.getElementById('close-shortcuts');

  if (helpBtn && panel) {
    helpBtn.addEventListener('click', () => {
      panel.style.display = 'block';
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }

  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        panel.style.display = 'none';
      }
    });
  }
});

// ========== 规则模板库 ==========
const RULE_TEMPLATES = {
  ads: {
    name: '广告拦截',
    domains: [
      'googlesyndication.com',
      'doubleclick.net',
      'googleadservices.com',
      'ads.google.com',
      'pagead2.googlesyndication.com'
    ]
  },
  trackers: {
    name: '隐私追踪',
    domains: [
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.net/tr',
      'connect.facebook.net',
      'analytics.twitter.com'
    ]
  },
  social: {
    name: '社交组件',
    domains: [
      'platform.twitter.com/widgets',
      'connect.facebook.net/zh_CN/sdk',
      'assets.pinterest.com/js/pinit',
      'platform.linkedin.com/in.js'
    ]
  },
  'video-ads': {
    name: '视频广告',
    domains: [
      'ads.youtube.com',
      'googleads.g.doubleclick.net',
      'static.doubleclick.net/instream/ad_status',
      'pagead2.googlesyndication.com/pagead/ads'
    ]
  },
  // 扩展模板
  'video-sites': {
    name: '视频网站',
    domains: [
      'api.bilibili.com/x/ad',
      'api.bilibili.com/x/web-show/res/loc',
      'awp.taobao.com',
      'mmstat.com',
      'atm.youku.com'
    ]
  },
  'social-media': {
    name: '社交媒体',
    domains: [
      'weibo.com/ajax/statuses/hotsearch',
      'zhihu.com/commercial',
      'xiaohongshu.com/api/sns/v1/note/',
      'tieba.baidu.com/tb/tml/ad'
    ]
  },
  'shopping': {
    name: '购物网站',
    domains: [
      'alicdn.com',
      'tanx.com',
      'mmstat.com',
      'atm.youku.com',
      'cm.ipinyou.com',
      'ad.toutiao.com'
    ]
  },
  'news-sites': {
    name: '新闻网站',
    domains: [
      'cpro.baidu.com',
      'pos.baidu.com',
      'eclick.baidu.com',
      'hm.baidu.com',
      'tanx.com/m/ad'
    ]
  }
};

// 保存自定义模板
async function saveCustomTemplate(name, domains) {
  const result = await chrome.storage.local.get('customTemplates');
  const customTemplates = result.customTemplates || {};
  customTemplates[name] = {
    name,
    domains,
    createdAt: Date.now()
  };
  await chrome.storage.local.set({ customTemplates });
}

// 加载自定义模板
async function loadCustomTemplates() {
  const result = await chrome.storage.local.get('customTemplates');
  return result.customTemplates || {};
}

document.addEventListener('DOMContentLoaded', () => {
  const templateBtns = document.querySelectorAll('.template-btn');
  templateBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateKey = btn.dataset.template;
      const template = RULE_TEMPLATES[templateKey];
      if (!template) return;

      // 获取当前阻止域名
      const result = await chrome.storage.sync.get('settings');
      const settings = result.settings || {};
      const currentBlocked = settings.blockedDomains || [];

      // 合并模板域名
      const newDomains = [...new Set([...currentBlocked, ...template.domains])];

      // 保存
      await chrome.storage.sync.set({
        settings: { ...settings, blockedDomains: newDomains }
      });

      // 更新UI
      const originalText = btn.textContent;
      btn.textContent = '✓ 已添加';
      btn.style.background = '#c8e6c9';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1500);

      // 刷新阻止域名列表
      if (typeof loadBlockedDomains === 'function') {
        loadBlockedDomains();
      }
    });
  });
});

// ========== 暗黑模式 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  // 加载主题设置
  const result = await chrome.storage.local.get('theme');
  const savedTheme = result.theme || 'light';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    await chrome.storage.local.set({ theme: newTheme });
  });
});

function applyTheme(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    if (themeToggle) themeToggle.textContent = '🌙';
  }
}

// ========== 导出/导入设置 ==========
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('export-settings-btn');
  const importBtn = document.getElementById('import-settings-btn');
  const importInput = document.getElementById('import-file-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', exportSettings);
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importSettings);
  }
});

async function exportSettings() {
  try {
    // 收集所有设置
    const syncData = await chrome.storage.sync.get(null);
    const localData = await chrome.storage.local.get(null);

    // 排除统计数据（太大）
    delete localData.extensionStats;

    const exportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      sync: syncData,
      local: localData
    };

    // 下载JSON文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrome-extension-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // 提示成功
    alert('设置已导出成功！');
  } catch (error) {
    console.error('[导出设置] 失败:', error);
    alert('导出失败: ' + error.message);
  }
}

async function importSettings(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 验证格式
    if (!data.version || !data.sync || !data.local) {
      throw new Error('无效的设置文件格式');
    }

    // 确认导入
    if (!confirm('导入设置将覆盖当前所有设置，确定继续吗？')) {
      return;
    }

    // 导入sync设置
    if (Object.keys(data.sync).length > 0) {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(data.sync);
    }

    // 导入local设置（保留统计数据）
    const currentLocal = await chrome.storage.local.get('extensionStats');
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ ...data.local, extensionStats: currentLocal.extensionStats });

    alert('设置已导入成功！页面将刷新。');
    location.reload();
  } catch (error) {
    console.error('[导入设置] 失败:', error);
    alert('导入失败: ' + error.message);
  } finally {
    // 清空input，允许重复导入同一文件
    event.target.value = '';
  }
}

// ========== 全局设置 ==========
let currentKeywordCategory = 'notInterested';

async function loadGlobalSettings() {
  const domainSelect = document.getElementById('global-domain-select');
  const keywordsEditor = document.getElementById('global-keywords-editor');
  const keywordsTextarea = document.getElementById('global-keywords-textarea');

  if (!domainSelect || !keywordsEditor || !keywordsTextarea) return;

  // 关键词分类切换
  document.querySelectorAll('.keyword-category-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.keyword-category-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '';
        b.style.color = '';
      });
      btn.classList.add('active');
      btn.style.background = '#007bff';
      btn.style.color = 'white';

      currentKeywordCategory = btn.dataset.category;
      await loadKeywordsForCategory();
    });
  });

  domainSelect.addEventListener('change', async () => {
    const domain = domainSelect.value;
    if (!domain) {
      keywordsEditor.style.display = 'none';
      return;
    }

    keywordsEditor.style.display = 'block';
    await loadKeywordsForCategory();
  });

  // 导入关键词
  const importKeywordsBtn = document.getElementById('import-keywords-btn');
  const keywordsImportFile = document.getElementById('keywords-import-file');

  if (importKeywordsBtn && keywordsImportFile) {
    importKeywordsBtn.addEventListener('click', () => keywordsImportFile.click());
    keywordsImportFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let keywords = [];

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          keywords = Array.isArray(data) ? data : (data.keywords || []);
        } else {
          keywords = text.split('\n').map(k => k.trim()).filter(k => k);
        }

        // 合并现有关键词
        const existingKeywords = keywordsTextarea.value.split('\n').map(k => k.trim()).filter(k => k);
        const merged = [...new Set([...existingKeywords, ...keywords])];
        keywordsTextarea.value = merged.join('\n');

        const countEl = document.getElementById('keyword-count');
        if (countEl) countEl.textContent = merged.length;

        alert(`成功导入 ${keywords.length} 个关键词`);
      } catch (error) {
        alert('导入失败: ' + error.message);
      }
      e.target.value = '';
    });
  }

  // 导出关键词
  const exportKeywordsBtn = document.getElementById('export-keywords-btn');
  if (exportKeywordsBtn) {
    exportKeywordsBtn.addEventListener('click', () => {
      const keywords = keywordsTextarea.value.split('\n').map(k => k.trim()).filter(k => k);
      const data = {
        category: currentKeywordCategory,
        domain: domainSelect.value,
        keywords,
        exportTime: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keywords-${currentKeywordCategory}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // 保存按钮
  const saveBtn = document.getElementById('global-save-keywords-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const domain = domainSelect.value;
      if (!domain) return;

      const keywords = keywordsTextarea.value
        .split('\n')
        .map(k => k.trim())
        .filter(k => k);

      try {
        // 保存到KeywordManager格式
        const storageKey = `${domain}Keywords`;
        const existingResult = await chrome.storage.local.get(storageKey);
        const existingKeywords = existingResult[storageKey] || {};

        existingKeywords[currentKeywordCategory] = keywords;
        await chrome.storage.local.set({ [storageKey]: existingKeywords });

        // 显示成功提示
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已保存 ✓';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = '';
        }, 1500);

        console.log('[全局设置] 已保存关键词:', domain, currentKeywordCategory, keywords.length);
      } catch (error) {
        console.error('[全局设置] 保存关键词失败:', error);
      }
    });
  }
}

async function loadKeywordsForCategory() {
  const domainSelect = document.getElementById('global-domain-select');
  const keywordsTextarea = document.getElementById('global-keywords-textarea');
  const countEl = document.getElementById('keyword-count');

  const domain = domainSelect?.value;
  if (!domain || !keywordsTextarea) return;

  try {
    const storageKey = `${domain}Keywords`;
    const result = await chrome.storage.local.get(storageKey);
    const allKeywords = result[storageKey] || {};
    const keywords = allKeywords[currentKeywordCategory] || [];

    keywordsTextarea.value = keywords.join('\n');
    if (countEl) countEl.textContent = keywords.length;
  } catch (error) {
    console.error('[全局设置] 加载关键词失败:', error);
    keywordsTextarea.value = '';
  }
}

// ========== 资源加速器控制 ==========
async function initResourceAccelerator() {
  const result = await chrome.storage.local.get('resourceAcceleratorConfig');
  const config = result.resourceAcceleratorConfig || {
    enabled: false,
    jsReplace: true,
    fontReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8
  };

  const enabledEl = document.getElementById('ra-enabled');
  const jsReplaceEl = document.getElementById('ra-js-replace');
  const fontReplaceEl = document.getElementById('ra-font-replace');
  const imageLazyEl = document.getElementById('ra-image-lazy');
  const imageCompressEl = document.getElementById('ra-image-compress');
  const qualityEl = document.getElementById('ra-quality');
  const qualityValueEl = document.getElementById('ra-quality-value');
  const settingsPanel = document.getElementById('ra-settings');

  if (!enabledEl) return;

  enabledEl.checked = config.enabled;
  jsReplaceEl.checked = config.jsReplace;
  fontReplaceEl.checked = config.fontReplace;
  imageLazyEl.checked = config.imageLazyLoad;
  imageCompressEl.checked = config.imageCompress;
  qualityEl.value = config.imageQuality * 100;
  qualityValueEl.textContent = Math.round(config.imageQuality * 100);
  settingsPanel.style.display = config.enabled ? 'block' : 'none';

  enabledEl.addEventListener('change', async (e) => {
    config.enabled = e.target.checked;
    settingsPanel.style.display = config.enabled ? 'block' : 'none';
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyResourceAccelerator(config);
  });

  jsReplaceEl.addEventListener('change', async (e) => {
    config.jsReplace = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyResourceAccelerator(config);
  });

  fontReplaceEl.addEventListener('change', async (e) => {
    config.fontReplace = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyResourceAccelerator(config);
  });

  imageLazyEl.addEventListener('change', async (e) => {
    config.imageLazyLoad = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyResourceAccelerator(config);
  });

  imageCompressEl.addEventListener('change', async (e) => {
    config.imageCompress = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyResourceAccelerator(config);
  });

  qualityEl.addEventListener('input', async (e) => {
    const value = parseInt(e.target.value);
    qualityValueEl.textContent = value;
    config.imageQuality = value / 100;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
  });

  loadResourceAcceleratorStats();
}

async function loadResourceAcceleratorStats() {
  const result = await chrome.storage.local.get('resourceAcceleratorStats');
  const stats = result.resourceAcceleratorStats || {
    totalJsReplaced: 0,
    totalFontsReplaced: 0,
    totalImagesOptimized: 0,
    totalBytesSaved: 0
  };

  const jsCountEl = document.getElementById('ra-js-count');
  const fontCountEl = document.getElementById('ra-font-count');
  const lazyCountEl = document.getElementById('ra-lazy-count');
  const compressCountEl = document.getElementById('ra-compress-count');
  const bytesSavedEl = document.getElementById('ra-bytes-saved');
  const totalReplacedEl = document.getElementById('ra-total-replaced');

  if (jsCountEl) jsCountEl.textContent = `(${stats.totalJsReplaced})`;
  if (fontCountEl) fontCountEl.textContent = `(${stats.totalFontsReplaced})`;
  if (lazyCountEl) lazyCountEl.textContent = `(${stats.totalImagesOptimized})`;
  if (compressCountEl) compressCountEl.textContent = `(${stats.totalImagesOptimized})`;
  if (bytesSavedEl) bytesSavedEl.textContent = Math.round(stats.totalBytesSaved / 1024);
  if (totalReplacedEl) totalReplacedEl.textContent = stats.totalJsReplaced + stats.totalFontsReplaced + stats.totalImagesOptimized;
}

function notifyResourceAccelerator(config) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'RESOURCE_ACCELERATOR_CONFIG', data: config }).catch(() => {});
    }
  });
}

// DOM加载后初始化
document.addEventListener('DOMContentLoaded', () => {
  initResourceAccelerator();
});
