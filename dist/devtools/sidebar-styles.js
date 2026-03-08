// Sidebar Styles panel logic
'use strict';

// ========== EventBus V4.6 初始化 ==========
let eventBusReady = false;

async function initEventBus() {
  if (typeof EventBus === 'undefined') {
    console.log('[Sidebar] EventBus 未加载，使用原生 API');
    return false;
  }

  try {
    const state = EventBus.getState ? EventBus.getState() : null;
    if (state && state.isReady) {
      eventBusReady = true;
      return true;
    }

    await EventBus.init();
    eventBusReady = true;
    console.log('[Sidebar] EventBus V4.6 初始化完成');
    return true;
  } catch (error) {
    console.warn('[Sidebar] EventBus 初始化失败:', error.message);
    return false;
  }
}

// 初始化 EventBus（非阻塞）
initEventBus();

// ========== DevTools Port 连接 ==========
let backgroundPort = null;
let connectionAttempts = 0;

function connectToBackground() {
  if (backgroundPort) return backgroundPort;

  try {
    backgroundPort = chrome.runtime.connect({ name: 'devtools-panel' });

    // 注册当前 tab
    const tabId = chrome.devtools.inspectedWindow.tabId;
    backgroundPort.postMessage({
      type: 'REGISTER_DEVTOOLS',
      tabId: tabId
    });

    console.log('[Sidebar] 注册 DevTools, tabId:', tabId);

    // 监听来自 background 的消息
    backgroundPort.onMessage.addListener((message) => {
      console.log('[Sidebar] 收到 port 消息:', message.type, message);

      if (message.type === 'batch-selection-update' && message.selectors) {
        // 批量选择更新
        console.log('[Sidebar] 批量选择更新, 数量:', message.selectors.length);
        message.selectors.forEach(item => {
          addSelectedElement(item.selector, item.tag);
        });
      }

      if (message.type === 'element-picker-selection' && message.selector) {
        // 单个元素选择
        addSelectedElement(message.selector, message.tag || 'div');
      }
    });

    // 断开重连
    backgroundPort.onDisconnect.addListener(() => {
      console.log('[Sidebar] Port 断开连接');
      backgroundPort = null;
      connectionAttempts++;
      if (connectionAttempts < 5) {
        setTimeout(connectToBackground, 1000);
      }
    });

    connectionAttempts = 0;
    console.log('[Sidebar] 已连接到 background');
  } catch (error) {
    console.warn('[Sidebar] 连接 background 失败:', error);
    backgroundPort = null;
  }

  return backgroundPort;
}

// 初始化连接
connectToBackground();

const cssSelectorEl = document.getElementById('css-selector');
const pathBreadcrumbsEl = document.getElementById('path-breadcrumbs');
const stylesContainer = document.getElementById('styles-container');
const refreshBtn = document.getElementById('refresh-btn');
const computedBtn = document.getElementById('computed-btn');
const aiBtn = document.getElementById('ai-btn');
const aiExplainBtn = document.getElementById('ai-explain-btn');
const aiPanel = document.getElementById('ai-panel');
const aiPanelContent = document.getElementById('ai-panel-content');
const aiCloseBtn = document.getElementById('ai-close-btn');
const toastEl = document.getElementById('toast');
const selectorStatusEl = document.getElementById('selector-status');

let showComputed = false;
let currentSelector = '';
let currentElementInfo = null; // 保存当前元素信息用于 AI 分析

// Show status message
function showStatus(message, type = '') {
  if (selectorStatusEl) {
    selectorStatusEl.textContent = message;
    selectorStatusEl.className = 'selector-status' + (type ? ' ' + type : '');
  }
}

// Clear status
function clearStatus() {
  if (selectorStatusEl) {
    selectorStatusEl.textContent = '';
    selectorStatusEl.className = 'selector-status';
  }
}

// Show toast notification
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = 'toast show' + (isError ? ' error' : '');

  setTimeout(() => {
    toastEl.className = 'toast';
  }, 2000);
}

// Escape HTML
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Generate unique CSS selector for an element
function generateUniqueSelector(el, document) {
  if (!el || el === document.body) {
    return 'body';
  }

  if (el === document.documentElement) {
    return 'html';
  }

  // Try ID first (most specific)
  if (el.id && !el.id.includes(' ') && !el.id.match(/^\d/)) {
    return '#' + CSS.escape(el.id);
  }

  // Build selector parts
  const parts = [];
  let current = el;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add ID if exists
    if (current.id && !current.id.includes(' ') && !current.id.match(/^\d/)) {
      selector = '#' + CSS.escape(current.id);
      parts.unshift(selector);
      break; // ID is unique, stop here
    }

    // Add classes (filter out auto-generated ones)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(c => c && !c.match(/^[0-9]/) && !c.match(/^(css-|styled|sc-|_|js-)/))
        .slice(0, 2); // Limit to 2 classes to avoid long selectors

      if (classes.length > 0) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += ':nth-child(' + index + ')';
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

// Get element path (ancestors)
function getElementPath(el, document) {
  const path = [];
  let current = el;

  while (current && current !== document.documentElement) {
    let name = current.tagName.toLowerCase();

    if (current.id) {
      name += '#' + current.id;
    } else if (current.className && typeof current.className === 'string') {
      const firstClass = current.className.trim().split(/\s+/)[0];
      if (firstClass) {
        name += '.' + firstClass;
      }
    }

    path.unshift({
      name: name,
      tag: current.tagName.toLowerCase()
    });

    current = current.parentElement;
  }

  return path;
}

// Get element info and styles
function getElementInfo() {
  showStatus('正在生成选择器...', 'loading');

  const script = `
    (function() {
      try {
        const el = $0;
        if (!el || !el.tagName) {
          return { error: 'No element selected' };
        }

        // Generate CSS selector (ensure exact match)
        function generateSelector(targetElement) {
          if (!targetElement) return '';
          if (targetElement === document.body) return 'body';
          if (targetElement === document.documentElement) return 'html';

          // === Helper Functions ===
          const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\\d/.test(node.id);

          const getClasses = (node) => {
            if (!node.className || typeof node.className !== 'string') return [];
            return node.className.trim().split(' ').filter(c => {
              if (!c || /^[0-9]/.test(c) || /^(css-|styled|sc-|js-)/.test(c)) return false;
              return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c);
            });
          };

          const getUsefulAttributes = (node) => {
            if (!node.attributes) return [];
            // 排除：样式属性、事件属性、内容属性（每个元素都不同的）
            const skipAttrs = [
              // 事件属性
              'onclick', 'onchange', 'onsubmit', 'oninput', 'onfocus', 'onblur',
              // 基础属性
              'id', 'class', 'style',
              // 内容属性（每个元素不同）
              'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby',
              'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip',
              // 状态/交互属性（不稳定）
              'tabindex', 'role', 'disabled', 'type'
            ];
            const attrs = [];
            for (const attr of node.attributes) {
              if (skipAttrs.includes(attr.name.toLowerCase())) continue;
              if (!attr.value || attr.value.length > 50 || /^\\d+$/.test(attr.value)) continue;
              attrs.push({ name: attr.name, value: attr.value });
            }
            return attrs;
          };

          // Get nth-of-type index (among same tag siblings)
          const getNthOfType = (node) => {
            const parent = node.parentElement;
            if (!parent) return 0;
            const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
            return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
          };

          const testSelector = (sel) => {
            try { return document.querySelectorAll(sel); } catch { return []; }
          };

          const isExactMatch = (sel, target) => {
            const found = testSelector(sel);
            return found.length === 1 && found[0] === target;
          };

          // === Strategy 1: ID ===
          if (hasValidId(targetElement)) {
            const sel = '#' + CSS.escape(targetElement.id);
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Strategy 2: Single class ===
          const tag = targetElement.tagName.toLowerCase();
          const classes = getClasses(targetElement);
          for (const cls of classes) {
            const sel = '.' + CSS.escape(cls);
            if (isExactMatch(sel, targetElement)) return sel;
            const tagCls = tag + '.' + CSS.escape(cls);
            if (isExactMatch(tagCls, targetElement)) return tagCls;
          }

          // === Strategy 3: Attribute selector ===
          const attrs = getUsefulAttributes(targetElement);
          for (const attr of attrs) {
            const sel = '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const tagAttr = tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
            if (isExactMatch(tagAttr, targetElement)) return tagAttr;
          }

          // === Strategy 4: class + attr combination ===
          if (classes.length > 0 && attrs.length > 0) {
            for (const cls of classes) {
              for (const attr of attrs) {
                const sel = tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Strategy 5: Multiple classes ===
          if (classes.length >= 2) {
            const sel = tag + '.' + classes.map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Strategy 6: Build full path ===
          const path = [];
          let cur = targetElement;

          while (cur) {
            if (hasValidId(cur)) {
              path.unshift('#' + CSS.escape(cur.id));
              break;
            }

            const t = cur.tagName.toLowerCase();
            const c = getClasses(cur);
            const nth = getNthOfType(cur);
            const curAttrs = cur === targetElement ? attrs : getUsefulAttributes(cur);

            // Priority: class > attr > nth-of-type > tag
            if (c.length > 0) {
              path.unshift(t + '.' + CSS.escape(c[0]));
            } else if (curAttrs.length > 0) {
              path.unshift(t + '[' + CSS.escape(curAttrs[0].name) + '="' + CSS.escape(curAttrs[0].value) + '"]');
            } else if (nth > 0) {
              path.unshift(t + ':nth-of-type(' + nth + ')');
            } else {
              path.unshift(t);
            }

            if (cur === document.documentElement) break;
            cur = cur.parentElement;
          }

          // Verify and extend if needed
          let selector = path.join(' > ');
          while (!isExactMatch(selector, targetElement)) {
            if (path[0] === 'html') {
              const lastPart = path[path.length - 1];
              if (attrs.length > 0 && !lastPart.includes('[')) {
                path[path.length - 1] = lastPart + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]';
              } else if (classes.length > 0 && !lastPart.includes('.')) {
                path[path.length - 1] = lastPart + '.' + CSS.escape(classes[0]);
              } else {
                break;
              }
            }
            selector = path.join(' > ');
            if (isExactMatch(selector, targetElement)) break;
            break;
          }

          return selector;
        }

        // Get element path with Shadow DOM support
        function getPath(element) {
          const path = [];
          let current = element;

          while (current && current !== document.documentElement) {
            const root = current.getRootNode();
            const inShadow = root instanceof ShadowRoot;
            const startRoot = root;

            // Collect path within current tree
            const tempPath = [];
            let node = current;

            while (node && node !== document.documentElement) {
              // Check if we're still in the same root
              const currentRoot = node.getRootNode();
              if (currentRoot !== startRoot) break;

              if (node.tagName) {
                let name = node.tagName.toLowerCase();

                if (node.id) {
                  name += '#' + node.id;
                } else if (node.className && typeof node.className === 'string') {
                  const firstClass = node.className.trim().split(/\\s+/)[0];
                  if (firstClass) {
                    name += '.' + firstClass;
                  }
                }

                tempPath.unshift({ name: name, tag: node.tagName.toLowerCase(), isShadow: false });
              }

              const parent = node.parentElement;
              if (!parent) break;
              node = parent;
            }

            path.unshift(...tempPath);

            // Add shadow boundary marker and continue with shadow host
            if (inShadow && root.host) {
              path.unshift({ name: '#shadow-root', tag: '#shadow-root', isShadow: true });
              current = root.host;
            } else {
              break;
            }
          }

          return path;
        }

        // Get matched styles
        const matched = [];
        const sheets = document.styleSheets;

        for (let sheet of sheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (let rule of rules) {
              if (rule.style && el.matches(rule.selectorText)) {
                const styles = [];
                for (let i = 0; i < rule.style.length; i++) {
                  const prop = rule.style[i];
                  styles.push({
                    property: prop,
                    value: rule.style.getPropertyValue(prop),
                    important: rule.style.getPropertyPriority(prop) === 'important'
                  });
                }
                matched.push({
                  selector: rule.selectorText,
                  styles: styles,
                  href: sheet.href || 'inline'
                });
              }
            }
          } catch (e) {
            // Cross-origin stylesheet - skip
          }
        }

        // Inline styles
        if (el.style && el.style.length > 0) {
          const inlineStyles = [];
          for (let i = 0; i < el.style.length; i++) {
            const prop = el.style[i];
            inlineStyles.push({
              property: prop,
              value: el.style.getPropertyValue(prop),
              important: el.style.getPropertyPriority(prop) === 'important'
            });
          }
          matched.unshift({
            selector: 'element.style',
            styles: inlineStyles,
            href: 'inline'
          });
        }

        // 生成选择器并计算匹配数量
        const selector = generateSelector(el);
        let matchCount = 0;
        try {
          matchCount = document.querySelectorAll(selector).length;
        } catch (e) {
          matchCount = 0;
        }

        return {
          selector: selector,
          matchCount: matchCount,
          path: getPath(el),
          matched: matched,
          tagName: el.tagName.toLowerCase(),
          hasId: !!el.id
        };
      } catch (e) {
        return { error: e.message || 'Unknown error' };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, evalError) => {
    // Handle eval error
    if (evalError) {
      showError('Failed to get element info: ' + (evalError.value || evalError.message || 'Unknown error'));
      showStatus('获取元素信息失败', 'error');
      return;
    }

    // Handle result error
    if (!result) {
      showError('No result from page');
      showStatus('页面无响应', 'error');
      return;
    }

    if (result.error) {
      // Not a critical error, just show empty state
      cssSelectorEl.textContent = 'Select an element';
      cssSelectorEl.classList.add('empty');
      currentSelector = '';
      pathBreadcrumbsEl.innerHTML = '<span style="color: #666; font-size: 10px;">No element selected</span>';
      stylesContainer.innerHTML = '<div class="empty-state">Select an element to view styles</div>';
      showStatus('请选择一个元素', '');
      return;
    }

    // Update CSS selector display
    currentSelector = result.selector;
    currentElementInfo = result; // 保存元素信息用于 AI 分析
    // Format selector for display (highlight shadow boundaries)
    const displaySelector = currentSelector.replace(/>>shadow/g, '\u2192 shadow'); // → shadow
    cssSelectorEl.textContent = displaySelector;
    cssSelectorEl.classList.remove('empty');

    // Update path breadcrumbs
    renderPathBreadcrumbs(result.path);

    // Render styles
    renderStyles(result.matched);

    // Show success status
    showStatus('选择器生成成功', 'success');
  });
}

// Get computed styles
function getComputedStyles() {
  showStatus('正在获取计算样式...', 'loading');

  const script = `
    (function() {
      try {
        const el = $0;
        if (!el || !el.tagName) {
          return { error: 'No element selected' };
        }

        const computed = window.getComputedStyle(el);
        const styles = [];

        for (let prop of computed) {
          const value = computed.getPropertyValue(prop);
          // Filter out default/empty values
          if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
            styles.push({ property: prop, value: value });
          }
        }

        // Generate CSS selector (ensure exact match)
        function generateSelector(targetElement) {
          if (!targetElement) return '';
          if (targetElement === document.body) return 'body';
          if (targetElement === document.documentElement) return 'html';

          // === Helper Functions ===
          const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\\d/.test(node.id);

          const getClasses = (node) => {
            if (!node.className || typeof node.className !== 'string') return [];
            return node.className.trim().split(' ').filter(c => {
              if (!c || /^[0-9]/.test(c) || /^(css-|styled|sc-|js-)/.test(c)) return false;
              return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c);
            });
          };

          const getUsefulAttributes = (node) => {
            if (!node.attributes) return [];
            // 排除：样式属性、内容属性（每个元素都不同的）、状态属性
            const skipAttrs = [
              'id', 'class', 'style',
              'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby',
              'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip',
              'tabindex', 'role', 'disabled', 'type'
            ];
            const attrs = [];
            for (const attr of node.attributes) {
              if (skipAttrs.includes(attr.name.toLowerCase())) continue;
              if (!attr.value || attr.value.length > 50 || /^\\d+$/.test(attr.value)) continue;
              attrs.push({ name: attr.name, value: attr.value });
            }
            return attrs;
          };

          // Get nth-of-type index (among same tag siblings)
          const getNthOfType = (node) => {
            const parent = node.parentElement;
            if (!parent) return 0;
            const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
            return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
          };

          const testSelector = (sel) => {
            try { return document.querySelectorAll(sel); } catch { return []; }
          };

          const isExactMatch = (sel, target) => {
            const found = testSelector(sel);
            return found.length === 1 && found[0] === target;
          };

          // === Strategy 1: ID ===
          if (hasValidId(targetElement)) {
            const sel = '#' + CSS.escape(targetElement.id);
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Strategy 2: Single class ===
          const tag = targetElement.tagName.toLowerCase();
          const classes = getClasses(targetElement);
          for (const cls of classes) {
            const sel = '.' + CSS.escape(cls);
            if (isExactMatch(sel, targetElement)) return sel;
            const tagCls = tag + '.' + CSS.escape(cls);
            if (isExactMatch(tagCls, targetElement)) return tagCls;
          }

          // === Strategy 3: Attribute selector ===
          const attrs = getUsefulAttributes(targetElement);
          for (const attr of attrs) {
            const sel = '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const tagAttr = tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
            if (isExactMatch(tagAttr, targetElement)) return tagAttr;
          }

          // === Strategy 4: class + attr combination ===
          if (classes.length > 0 && attrs.length > 0) {
            for (const cls of classes) {
              for (const attr of attrs) {
                const sel = tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Strategy 5: Multiple classes ===
          if (classes.length >= 2) {
            const sel = tag + '.' + classes.map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Strategy 6: Build full path ===
          const path = [];
          let cur = targetElement;

          while (cur) {
            if (hasValidId(cur)) {
              path.unshift('#' + CSS.escape(cur.id));
              break;
            }

            const t = cur.tagName.toLowerCase();
            const c = getClasses(cur);
            const nth = getNthOfType(cur);
            const curAttrs = cur === targetElement ? attrs : getUsefulAttributes(cur);

            if (c.length > 0) {
              path.unshift(t + '.' + CSS.escape(c[0]));
            } else if (curAttrs.length > 0) {
              path.unshift(t + '[' + CSS.escape(curAttrs[0].name) + '="' + CSS.escape(curAttrs[0].value) + '"]');
            } else if (nth > 0) {
              path.unshift(t + ':nth-of-type(' + nth + ')');
            } else {
              path.unshift(t);
            }

            if (cur === document.documentElement) break;
            cur = cur.parentElement;
          }

          let selector = path.join(' > ');
          while (!isExactMatch(selector, targetElement)) {
            if (path[0] === 'html') {
              const lastPart = path[path.length - 1];
              if (attrs.length > 0 && !lastPart.includes('[')) {
                path[path.length - 1] = lastPart + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]';
              } else if (classes.length > 0 && !lastPart.includes('.')) {
                path[path.length - 1] = lastPart + '.' + CSS.escape(classes[0]);
              } else {
                break;
              }
            }
            selector = path.join(' > ');
            if (isExactMatch(selector, targetElement)) break;
            break;
          }

          return selector;
        }

        // 生成选择器并计算匹配数量
        const selector = generateSelector(el);
        let matchCount = 0;
        try {
          matchCount = document.querySelectorAll(selector).length;
        } catch (e) {
          matchCount = 0;
        }

        return {
          selector: selector,
          matchCount: matchCount,
          styles: styles.slice(0, 50) // Limit to first 50 properties
        };
      } catch (e) {
        return { error: e.message || 'Unknown error' };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, evalError) => {
    if (evalError || !result || result.error) {
      showError('Failed to get computed styles');
      showStatus('获取计算样式失败', 'error');
      return;
    }

    currentSelector = result.selector;
    // Format selector for display (highlight shadow boundaries)
    const displaySelector = currentSelector.replace(/>>shadow/g, '\u2192 shadow'); // → shadow
    cssSelectorEl.textContent = displaySelector;
    cssSelectorEl.classList.remove('empty');

    renderComputedStyles(result.styles);

    showStatus('计算样式获取成功', 'success');
  });
}

// Show error message
function showError(message) {
  stylesContainer.innerHTML = '<div class="error-state">' + escapeHtml(message) + '</div>';
  showToast(message, true);
}

// Render path breadcrumbs
function renderPathBreadcrumbs(path) {
  if (!path || path.length === 0) {
    pathBreadcrumbsEl.innerHTML = '<span style="color: #666; font-size: 10px;">No path available</span>';
    return;
  }

  let html = '';
  path.forEach((item, index) => {
    const isLast = index === path.length - 1;

    if (item.isShadow) {
      // Shadow root marker
      html += '<span class="path-item shadow-marker" title="Shadow DOM boundary">_SHADOW_</span>';
      html += '<span class="path-separator">›</span>';
    } else {
      html += '<span class="path-item' + (isLast ? ' current' : '') + '" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span>';
      if (!isLast) {
        html += '<span class="path-separator">›</span>';
      }
    }
  });

  pathBreadcrumbsEl.innerHTML = html;
}

// Render matched styles
function renderStyles(matched) {
  if (!matched || matched.length === 0) {
    stylesContainer.innerHTML = '<div class="empty-state">No styles found</div>';
    return;
  }

  let html = '';
  for (const rule of matched) {
    const fileName =
      rule.href === 'inline'
        ? 'inline'
        : rule.href.split('/').pop().split('?')[0];

    html += `
      <div class="selector-section">
        <div class="selector-header">
          <span class="selector-name">${escapeHtml(rule.selector)}</span>
          <span class="selector-file">${escapeHtml(fileName)}</span>
        </div>
        <div class="style-rules">
    `;

    if (rule.styles && rule.styles.length > 0) {
      for (const style of rule.styles) {
        const important = style.important ? ' !important' : '';
        html += `
          <div class="style-rule">
            <input type="checkbox" class="style-checkbox" checked>
            <span class="style-property">${escapeHtml(style.property)}:</span>
            <span class="style-value">
              <input type="text" value="${escapeHtml(style.value)}${important}" data-property="${escapeHtml(style.property)}">
            </span>
          </div>
        `;
      }
    } else {
      html += '<div class="empty-state" style="padding: 8px;">No properties</div>';
    }

    html += '</div></div>';
  }

  stylesContainer.innerHTML = html;

  // Add event listeners for style editing
  stylesContainer.querySelectorAll('.style-value input').forEach((input) => {
    input.addEventListener('change', handleStyleChange);
  });
}

// Render computed styles
function renderComputedStyles(styles) {
  if (!styles || styles.length === 0) {
    stylesContainer.innerHTML = '<div class="empty-state">No computed styles found</div>';
    return;
  }

  let html = '<div class="selector-section"><div class="style-rules">';

  for (const style of styles) {
    html += `
      <div class="style-rule">
        <span class="style-property">${escapeHtml(style.property)}:</span>
        <span class="style-value">${escapeHtml(style.value)}</span>
      </div>
    `;
  }

  html += '</div></div>';
  stylesContainer.innerHTML = html;
}

// Handle style change
function handleStyleChange(e) {
  const property = e.target.dataset.property;
  if (!property) return;

  const value = e.target.value.replace(/!important$/, '').trim();
  const important = e.target.value.includes('!important');

  const script = `
    (function() {
      try {
        const el = $0;
        if (!el) return { error: 'No element selected' };
        el.style.setProperty('${property.replace(/'/g, "\\'")}', '${value.replace(/'/g, "\\'")}'${important ? ", 'important'" : ''});
        return { success: true };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || (result && result.error)) {
      showToast('Failed to update style', true);
    } else {
      showToast('Style updated');
    }
  });
}

// Refresh button
refreshBtn.addEventListener('click', () => {
  if (showComputed) {
    getComputedStyles();
  } else {
    getElementInfo();
  }
});

// Computed toggle
computedBtn.addEventListener('click', () => {
  showComputed = !showComputed;
  computedBtn.classList.toggle('active', showComputed);

  if (showComputed) {
    getComputedStyles();
  } else {
    getElementInfo();
  }
});

// Listen for element selection changes
chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
  hideAiPanel();
  if (showComputed) {
    getComputedStyles();
  } else {
    getElementInfo();
  }
});

// Initial load
getElementInfo();

// ========== AI 辅助功能 ==========

/**
 * 隐藏 AI 面板
 */
function hideAiPanel() {
  if (aiPanel) {
    aiPanel.style.display = 'none';
  }
}

/**
 * 显示 AI 面板
 */
function showAiPanel(content) {
  if (aiPanel && aiPanelContent) {
    aiPanelContent.innerHTML = content;
    aiPanel.style.display = 'block';
  }
}

/**
 * 获取元素上下文信息（用于 AI 分析）
 */
function getElementContextForAI() {
  return new Promise((resolve) => {
    const script = `
      (function() {
        try {
          const el = $0;
          if (!el || !el.tagName) {
            return { error: 'No element selected' };
          }

          // 获取元素的基本信息
          const getBasicInfo = (element) => ({
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className && typeof element.className === 'string'
              ? element.className.trim() : null,
            attributes: Array.from(element.attributes || []).map(attr => ({
              name: attr.name,
              value: attr.value
            }))
          });

          // 获取元素在父级中的位置信息
          const getPositionInfo = (element) => {
            const parent = element.parentElement;
            if (!parent) return null;

            const siblings = Array.from(parent.children);
            const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
            const index = siblings.indexOf(element);
            const sameTagIndex = sameTagSiblings.indexOf(element);

            return {
              parentTag: parent.tagName.toLowerCase(),
              parentClass: parent.className && typeof parent.className === 'string'
                ? parent.className.trim() : null,
              totalSiblings: siblings.length,
              sameTagSiblings: sameTagSiblings.length,
              index: index + 1,
              sameTagIndex: sameTagIndex + 1
            };
          };

          // 获取元素的文本内容（截断）
          const getTextContent = (element) => {
            const text = element.textContent ? element.textContent.trim() : '';
            return text.length > 100 ? text.substring(0, 100) + '...' : text;
          };

          // 获取周围的兄弟元素信息
          const getSiblingContext = (element) => {
            const parent = element.parentElement;
            if (!parent) return [];

            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element);
            const context = [];

            // 前一个兄弟
            if (index > 0) {
              const prev = siblings[index - 1];
              context.push({
                position: 'previous',
                ...getBasicInfo(prev)
              });
            }

            // 后一个兄弟
            if (index < siblings.length - 1) {
              const next = siblings[index + 1];
              context.push({
                position: 'next',
                ...getBasicInfo(next)
              });
            }

            return context;
          };

          // 获取父级路径信息（最多3层）
          const getAncestorPath = (element, depth = 3) => {
            const path = [];
            let current = element.parentElement;
            let count = 0;

            while (current && current !== document.body && count < depth) {
              path.push({
                ...getBasicInfo(current),
                childrenCount: current.children.length
              });
              current = current.parentElement;
              count++;
            }

            return path;
          };

          // 获取子元素信息（直接子元素）
          const getChildrenInfo = (element) => {
            return Array.from(element.children).slice(0, 5).map(child => getBasicInfo(child));
          };

          // 测试选择器
          const testSelector = (sel) => {
            try {
              const found = document.querySelectorAll(sel);
              return {
                valid: true,
                count: found.length,
                unique: found.length === 1
              };
            } catch {
              return { valid: false, count: 0, unique: false };
            }
          };

          return {
            basic: getBasicInfo(el),
            position: getPositionInfo(el),
            text: getTextContent(el),
            siblings: getSiblingContext(el),
            ancestors: getAncestorPath(el),
            children: getChildrenInfo(el),
            url: window.location.href,
            pageTitle: document.title
          };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;

    chrome.devtools.inspectedWindow.eval(script, (result, error) => {
      if (error || !result || result.error) {
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * AI 优化选择器
 */
async function aiOptimizeSelector() {
  if (!currentElementInfo) {
    showToast('请先选择一个元素', true);
    return;
  }

  showAiPanel('<div class="ai-loading">AI 正在分析并优化选择器...</div>');

  const context = await getElementContextForAI();
  if (!context) {
    showAiPanel('<div class="ai-error">无法获取元素上下文信息</div>');
    return;
  }

  // 构建发送给 AI 的请求
  const aiRequest = {
    currentSelector: currentSelector,
    element: context,
    goal: 'optimize' // 优化当前选择器
  };

  try {
    // 尝试通过本地服务调用 AI
    const response = await fetch('http://localhost:3000/api/ai/selector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    renderAiSuggestions(result);
  } catch (error) {
    // 如果本地服务不可用，使用本地规则生成建议
    console.log('[AI] 本地服务不可用，使用本地规则:', error.message);
    const localSuggestions = generateLocalSuggestions(context);
    renderAiSuggestions({ suggestions: localSuggestions, source: 'local' });
  }
}

/**
 * AI 分析元素
 */
async function aiAnalyzeElement() {
  if (!currentElementInfo) {
    showToast('请先选择一个元素', true);
    return;
  }

  showAiPanel('<div class="ai-loading">AI 正在分析元素...</div>');

  const context = await getElementContextForAI();
  if (!context) {
    showAiPanel('<div class="ai-error">无法获取元素上下文信息</div>');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    renderAiAnalysis(result);
  } catch (error) {
    console.log('[AI] 本地服务不可用，使用本地分析:', error.message);
    const localAnalysis = generateLocalAnalysis(context);
    renderAiAnalysis({ analysis: localAnalysis, source: 'local' });
  }
}

/**
 * 本地规则生成选择器建议（当 AI 服务不可用时）
 */
function generateLocalSuggestions(context) {
  const suggestions = [];
  const { basic, position, ancestors, siblings } = context;

  // 策略1: ID 选择器
  if (basic.id && !basic.id.includes(' ') && !/^\d/.test(basic.id)) {
    suggestions.push({
      type: 'ID选择器',
      selector: `#${CSS.escape(basic.id)}`,
      score: 100,
      description: '使用唯一 ID，最稳定的选择器',
      pros: ['唯一性强', '性能最好'],
      cons: ['ID 可能会变化']
    });
  }

  // 策略2: 语义化 class 选择器
  if (basic.className) {
    const classes = basic.className.split(' ').filter(c =>
      c && !/^(css-|styled-|sc-|js-|_|Mui|jss|css_|data-|ep-)/.test(c) && !/^\d/.test(c)
    );

    if (classes.length > 0) {
      // 单 class
      const semanticClass = classes.find(c => /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper|header|footer|content|title|text|icon)/.test(c.toLowerCase()));
      if (semanticClass) {
        suggestions.push({
          type: '语义化Class',
          selector: `${basic.tagName}.${CSS.escape(semanticClass)}`,
          score: 85,
          description: '使用语义化的 class 名称',
          pros: ['可读性好', '相对稳定'],
          cons: ['可能匹配多个元素']
        });
      }

      // 组合 class
      if (classes.length >= 2) {
        const combined = classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
        suggestions.push({
          type: '组合Class',
          selector: `${basic.tagName}.${combined}`,
          score: 80,
          description: '组合多个 class 提高精确度',
          pros: ['精确度较高'],
          cons: ['选择器较长']
        });
      }
    }
  }

  // 策略3: 属性选择器
  const usefulAttrs = basic.attributes.filter(attr =>
    !['id', 'class', 'style', 'data-ep-selected', 'data-ep-uid', 'data-ep-index'].includes(attr.name) &&
    attr.value && attr.value.length < 50 && !/^\d+$/.test(attr.value)
  );

  for (const attr of usefulAttrs.slice(0, 2)) {
    suggestions.push({
      type: '属性选择器',
      selector: `${basic.tagName}[${CSS.escape(attr.name)}="${CSS.escape(attr.value)}"]`,
      score: 75,
      description: `使用 ${attr.name} 属性`,
      pros: ['属性通常较稳定'],
      cons: ['属性可能被移除']
    });
  }

  // 策略4: 层级选择器（结合父级）
  if (ancestors.length > 0) {
    const parent = ancestors[0];
    if (parent.className) {
      const parentClass = parent.className.split(' ')[0];
      if (parentClass && !/^(css-|styled-|sc-)/.test(parentClass)) {
        suggestions.push({
          type: '层级选择器',
          selector: `${parent.tagName}.${CSS.escape(parentClass)} > ${basic.tagName}`,
          score: 70,
          description: '结合父级容器选择',
          pros: ['结构化选择', '相对稳定'],
          cons: ['依赖DOM结构']
        });
      }
    }
  }

  // 策略5: nth-child（作为备选）
  if (position && position.sameTagSiblings > 1) {
    suggestions.push({
      type: '位置选择器',
      selector: `${basic.tagName}:nth-child(${position.index})`,
      score: 50,
      description: '使用元素位置（不推荐）',
      pros: ['总是有效'],
      cons: ['DOM变化时失效', '脆弱'],
      warning: true
    });
  }

  return suggestions.slice(0, 5);
}

/**
 * 本地分析元素（当 AI 服务不可用时）
 */
function generateLocalAnalysis(context) {
  const { basic, position, ancestors, siblings, children, text } = context;
  const analysis = [];

  // 元素类型分析
  analysis.push(`**元素类型**: \`${basic.tagName}\``);

  // ID 分析
  if (basic.id) {
    analysis.push(`**ID**: \`${basic.id}\` ${/^\d/.test(basic.id) ? '(以数字开头，不可用作选择器)' : '(可用作选择器)'}`);
  }

  // Class 分析
  if (basic.className) {
    const classes = basic.className.split(' ').filter(c => c);
    const semantic = classes.filter(c => /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper)/.test(c.toLowerCase()));
    const generated = classes.filter(c => /^(css-|styled-|sc-|js-|_|Mui|jss)/.test(c));

    analysis.push(`**Class 分析**: 共 ${classes.length} 个 class`);
    if (semantic.length > 0) {
      analysis.push(`- 语义化 class: \`${semantic.join('`, `')}\``);
    }
    if (generated.length > 0) {
      analysis.push(`- 自动生成 class (不建议使用): ${generated.length} 个`);
    }
  }

  // 位置分析
  if (position) {
    analysis.push(`**位置信息**: 在父级 \`${position.parentTag}\` 中的第 ${position.index} 个子元素`);
    if (position.sameTagSiblings > 1) {
      analysis.push(`- 同类型兄弟元素: ${position.sameTagSiblings} 个`);
    }
  }

  // 结构分析
  if (children && children.length > 0) {
    analysis.push(`**子元素**: ${children.length} 个直接子元素`);
  }

  // 文本内容
  if (text && text.length > 0) {
    analysis.push(`**文本内容**: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  }

  // 选择器建议
  analysis.push(`**选择器建议**:`);
  if (basic.id && !/^\d/.test(basic.id)) {
    analysis.push(`- 推荐使用 ID 选择器: \`#${basic.id}\``);
  } else if (basic.className) {
    const classes = basic.className.split(' ').filter(c => c && !/^(css-|styled-|sc-)/.test(c));
    if (classes.length > 0) {
      analysis.push(`- 推荐使用 class 选择器: \`.${classes[0]}\``);
    }
  }

  return analysis.join('\n\n');
}

/**
 * 渲染 AI 建议列表
 */
function renderAiSuggestions(result) {
  const { suggestions, source } = result;

  if (!suggestions || suggestions.length === 0) {
    showAiPanel('<div class="ai-error">AI 未能生成有效建议</div>');
    return;
  }

  let html = '';

  if (source === 'local') {
    html += '<div style="color: #888; font-size: 10px; margin-bottom: 8px;">⚠️ AI 服务不可用，使用本地规则生成</div>';
  }

  suggestions.forEach((suggestion, index) => {
    const scoreClass = suggestion.score >= 80 ? '' : suggestion.score >= 60 ? 'medium' : 'low';

    html += `
      <div class="ai-suggestion ${suggestion.warning ? 'warning' : ''}">
        <div class="ai-suggestion-header">
          <span class="ai-suggestion-type">${suggestion.type}</span>
          <span class="ai-suggestion-score ${scoreClass}">${suggestion.score}%</span>
        </div>
        <div class="ai-suggestion-selector" data-selector="${escapeHtml(suggestion.selector)}" title="点击复制">
          ${escapeHtml(suggestion.selector)}
        </div>
        <div class="ai-suggestion-desc">${escapeHtml(suggestion.description)}</div>
        <div class="ai-suggestion-actions">
          <button class="primary" data-apply="${escapeHtml(suggestion.selector)}">应用</button>
          <button data-copy="${escapeHtml(suggestion.selector)}">复制</button>
        </div>
      </div>
    `;
  });

  showAiPanel(html);

  // 绑定事件
  aiPanelContent.querySelectorAll('.ai-suggestion-selector').forEach(el => {
    el.addEventListener('click', () => {
      copyToClipboard(el.dataset.selector);
    });
  });

  aiPanelContent.querySelectorAll('[data-apply]').forEach(btn => {
    btn.addEventListener('click', () => {
      applySelector(btn.dataset.apply);
    });
  });

  aiPanelContent.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.copy);
    });
  });
}

/**
 * 渲染 AI 分析结果
 */
function renderAiAnalysis(result) {
  const { analysis, source } = result;

  let html = '';

  if (source === 'local') {
    html += '<div style="color: #888; font-size: 10px; margin-bottom: 8px;">⚠️ AI 服务不可用，使用本地分析</div>';
  }

  html += `<div class="ai-explanation">${analysis.replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</div>`;

  showAiPanel(html);
}

/**
 * 应用选择器
 */
function applySelector(selector) {
  // 验证选择器
  const script = `
    (function() {
      try {
        const found = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
        return {
          valid: true,
          count: found.length,
          matches: Array.from(found).map(el => el === $0)
        };
      } catch (e) {
        return { valid: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.valid) {
      showToast('选择器无效: ' + (result?.error || '未知错误'), true);
      return;
    }

    // 更新显示
    currentSelector = selector;
    cssSelectorEl.textContent = selector;
    cssSelectorEl.classList.remove('empty');

    // 显示匹配数量
    if (result.count === 1) {
      showStatus('唯一匹配 ✓', 'success');
    } else {
      showStatus(`匹配 ${result.count} 个元素`, 'warning');
    }

    showToast(`已应用选择器 (匹配 ${result.count} 个元素)`);
  });
}

/**
 * 复制到剪贴板
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板');
  }).catch(() => {
    showToast('复制失败', true);
  });
}

// AI 按钮事件
if (aiBtn) {
  aiBtn.addEventListener('click', aiOptimizeSelector);
}

if (aiExplainBtn) {
  aiExplainBtn.addEventListener('click', aiAnalyzeElement);
}

if (aiCloseBtn) {
  aiCloseBtn.addEventListener('click', hideAiPanel);
}

// ========== 选择器测试工具 ==========

const testerPanel = document.getElementById('selector-tester');
const testerInput = document.getElementById('tester-input');
const testerResult = document.getElementById('tester-result');
const testBtn = document.getElementById('test-btn');
const testerClose = document.getElementById('tester-close');
const testerHighlight = document.getElementById('tester-highlight');
const testerCopy = document.getElementById('tester-copy');

let testerDebounceTimer = null;

/**
 * 测试选择器
 */
function testSelector(selector) {
  if (!selector || !selector.trim()) {
    updateTesterResult(0, '等待输入', '');
    return;
  }

  const script = `
    (function() {
      try {
        const found = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
        return {
          valid: true,
          count: found.length,
          elements: Array.from(found).slice(0, 5).map(el => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: el.className && typeof el.className === 'string'
              ? el.className.trim().split(' ').slice(0, 2).join(' ') : ''
          }))
        };
      } catch (e) {
        return { valid: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result) {
      updateTesterResult(0, '执行错误', 'error');
      return;
    }

    if (!result.valid) {
      updateTesterResult(0, result.error || '无效选择器', 'error');
      return;
    }

    const count = result.count;
    let text = count === 1 ? '唯一匹配' : `匹配 ${count} 个元素`;
    let type = count === 1 ? 'success' : count > 10 ? 'warning' : '';

    updateTesterResult(count, text, type, result.elements);
  });
}

/**
 * 更新测试结果
 */
function updateTesterResult(count, text, type, elements = []) {
  if (!testerResult) return;

  const countEl = testerResult.querySelector('.result-count');
  const textEl = testerResult.querySelector('.result-text');

  if (countEl) {
    countEl.textContent = count;
    countEl.className = 'result-count' + (type === 'error' ? ' error' : '');
  }

  if (textEl) {
    textEl.textContent = text;
  }

  // 显示匹配元素预览
  if (elements.length > 0) {
    let preview = elements.map(el => {
      let str = el.tag;
      if (el.id) str += '#' + el.id;
      if (el.className) str += '.' + el.className.split(' ')[0];
      return str;
    }).join(', ');
    if (count > 5) preview += ' ...';
    textEl.textContent = text + ' | ' + preview;
  }
}

/**
 * 高亮匹配的元素
 */
function highlightMatches(selector) {
  const script = `
    (function() {
      try {
        const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');

        // 移除旧的高亮
        document.querySelectorAll('[data-tester-highlight]').forEach(el => {
          el.removeAttribute('data-tester-highlight');
        });

        // 添加新高亮
        elements.forEach(el => {
          el.setAttribute('data-tester-highlight', 'true');
        });

        // 添加临时样式
        if (!document.getElementById('tester-highlight-style')) {
          const style = document.createElement('style');
          style.id = 'tester-highlight-style';
          style.textContent = \`
            [data-tester-highlight="true"] {
              outline: 2px solid #f59e0b !important;
              outline-offset: 1px !important;
              background: rgba(245, 158, 11, 0.1) !important;
            }
          \`;
          document.head.appendChild(style);
        }

        // 3秒后移除高亮
        setTimeout(() => {
          document.querySelectorAll('[data-tester-highlight]').forEach(el => {
            el.removeAttribute('data-tester-highlight');
          });
        }, 3000);

        return { success: true, count: elements.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败: ' + (result?.error || '未知错误'), true);
    } else {
      showToast(`已高亮 ${result.count} 个元素 (3秒后消失)`);
    }
  });
}

// 测试按钮事件
if (testBtn) {
  testBtn.addEventListener('click', () => {
    if (testerPanel) {
      const isVisible = testerPanel.style.display !== 'none';
      testerPanel.style.display = isVisible ? 'none' : 'block';

      if (!isVisible) {
        testerInput.value = currentSelector;
        testerInput.focus();
        testSelector(currentSelector);
      }
    }
  });
}

if (testerClose) {
  testerClose.addEventListener('click', () => {
    if (testerPanel) testerPanel.style.display = 'none';
  });
}

if (testerInput) {
  testerInput.addEventListener('input', (e) => {
    clearTimeout(testerDebounceTimer);
    testerDebounceTimer = setTimeout(() => {
      testSelector(e.target.value);
    }, 300);
  });

  testerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      testSelector(e.target.value);
    }
  });
}

if (testerHighlight) {
  testerHighlight.addEventListener('click', () => {
    const selector = testerInput?.value || currentSelector;
    if (selector) highlightMatches(selector);
  });
}

if (testerCopy) {
  testerCopy.addEventListener('click', () => {
    const selector = testerInput?.value || currentSelector;
    if (selector) {
      copyToClipboard(selector);
    }
  });
}

// ========== 批量操作功能 ==========

const batchPanel = document.getElementById('batch-panel');
const batchBtn = document.getElementById('batch-btn');
const batchClose = document.getElementById('batch-close');
const batchAction = document.getElementById('batch-action');
const batchParams = document.getElementById('batch-params');
const batchClassName = document.getElementById('batch-class-name');
const batchSelector = document.getElementById('batch-selector');
const batchPreview = document.getElementById('batch-preview');
const batchExecute = document.getElementById('batch-execute');
const batchResult = document.getElementById('batch-result');

/**
 * 更新批量操作参数面板
 */
function updateBatchParams() {
  if (!batchAction || !batchParams) return;

  const action = batchAction.value;
  let html = '';

  switch (action) {
    case 'addClass':
    case 'removeClass':
      html = '<label>Class 名称</label><input type="text" id="batch-class-name" placeholder="如: active, hidden" />';
      break;
    case 'setAttribute':
    case 'removeAttribute':
      html = `
        <label>属性名</label>
        <input type="text" id="batch-attr-name" placeholder="如: data-type" />
        ${action === 'setAttribute' ? '<label>属性值</label><input type="text" id="batch-attr-value" placeholder="属性值" />' : ''}
      `;
      break;
    case 'setStyle':
      html = `
        <label>样式属性</label>
        <input type="text" id="batch-style-prop" placeholder="如: display, color" />
        <label>样式值</label>
        <input type="text" id="batch-style-value" placeholder="如: none, red" />
      `;
      break;
  }

  batchParams.innerHTML = html;
}

/**
 * 执行批量操作
 */
function executeBatchAction(preview = false) {
  const action = batchAction?.value;
  const selector = batchSelector?.value || currentSelector;

  if (!selector) {
    showBatchResult('请输入或选择一个选择器', true);
    return;
  }

  let params = {};

  // 获取参数
  const classInput = document.getElementById('batch-class-name');
  const attrNameInput = document.getElementById('batch-attr-name');
  const attrValueInput = document.getElementById('batch-attr-value');
  const stylePropInput = document.getElementById('batch-style-prop');
  const styleValueInput = document.getElementById('batch-style-value');

  if (classInput) params.className = classInput.value;
  if (attrNameInput) params.attrName = attrNameInput.value;
  if (attrValueInput) params.attrValue = attrValueInput.value;
  if (stylePropInput) params.styleProp = stylePropInput.value;
  if (styleValueInput) params.styleValue = styleValueInput.value;

  // 构建执行脚本
  const script = `
    (function() {
      try {
        const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
        const action = '${action}';
        const params = ${JSON.stringify(params)};
        const preview = ${preview};
        let affected = 0;

        elements.forEach(el => {
          switch (action) {
            case 'addClass':
              if (params.className) {
                if (preview) {
                  el.style.outline = '2px dashed #f59e0b';
                } else {
                  params.className.split(' ').forEach(c => el.classList.add(c));
                }
                affected++;
              }
              break;
            case 'removeClass':
              if (params.className) {
                if (!preview) {
                  params.className.split(' ').forEach(c => el.classList.remove(c));
                }
                affected++;
              }
              break;
            case 'setAttribute':
              if (params.attrName) {
                if (!preview) {
                  el.setAttribute(params.attrName, params.attrValue || '');
                }
                affected++;
              }
              break;
            case 'removeAttribute':
              if (params.attrName) {
                if (!preview) {
                  el.removeAttribute(params.attrName);
                }
                affected++;
              }
              break;
            case 'setStyle':
              if (params.styleProp && params.styleValue !== undefined) {
                if (preview) {
                  el.style.outline = '2px dashed #10b981';
                } else {
                  el.style[params.styleProp] = params.styleValue;
                }
                affected++;
              }
              break;
          }
        });

        // 预览模式下3秒后移除高亮
        if (preview) {
          setTimeout(() => {
            elements.forEach(el => {
              el.style.outline = '';
            });
          }, 3000);
        }

        return { success: true, affected, total: elements.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showBatchResult('操作失败: ' + (result?.error || '未知错误'), true);
    } else {
      const msg = preview
        ? `预览: 将影响 ${result.affected} 个元素`
        : `成功: 已对 ${result.affected} 个元素执行操作`;
      showBatchResult(msg, false);
    }
  });
}

/**
 * 显示批量操作结果
 */
function showBatchResult(message, isError) {
  if (!batchResult) return;
  batchResult.textContent = message;
  batchResult.className = 'batch-result visible ' + (isError ? 'error' : 'success');
}

// 批量操作事件
if (batchBtn) {
  batchBtn.addEventListener('click', () => {
    if (batchPanel) {
      const isVisible = batchPanel.style.display !== 'none';
      batchPanel.style.display = isVisible ? 'none' : 'block';

      if (!isVisible) {
        batchSelector.value = currentSelector;
      }
    }
  });
}

if (batchClose) {
  batchClose.addEventListener('click', () => {
    if (batchPanel) batchPanel.style.display = 'none';
  });
}

if (batchAction) {
  batchAction.addEventListener('change', updateBatchParams);
}

if (batchPreview) {
  batchPreview.addEventListener('click', () => executeBatchAction(true));
}

if (batchExecute) {
  batchExecute.addEventListener('click', () => executeBatchAction(false));
}

// ========== 元素过滤功能 ==========

const filterPanel = document.getElementById('element-filter');
const filterInput = document.getElementById('filter-input');
const filterTag = document.getElementById('filter-tag');
const filterClass = document.getElementById('filter-class');
const filterId = document.getElementById('filter-id');

let filterDebounceTimer = null;

/**
 * 过滤样式列表
 */
function filterStyles(keyword) {
  const sections = stylesContainer?.querySelectorAll('.selector-section');
  if (!sections) return;

  const useTag = filterTag?.checked ?? true;
  const useClass = filterClass?.checked ?? true;
  const useId = filterId?.checked ?? true;

  sections.forEach(section => {
    const selectorName = section.querySelector('.selector-name')?.textContent || '';
    const styleRules = section.querySelectorAll('.style-rule');

    let match = !keyword; // 空关键词时显示所有

    // 检查选择器名称
    if (!match && keyword) {
      if (useTag && selectorName.toLowerCase().includes(keyword.toLowerCase())) {
        match = true;
      }
    }

    // 检查样式规则
    if (!match && keyword) {
      styleRules.forEach(rule => {
        const prop = rule.querySelector('.style-property')?.textContent || '';
        const value = rule.querySelector('.style-value input')?.value ||
                      rule.querySelector('.style-value')?.textContent || '';

        if (prop.toLowerCase().includes(keyword.toLowerCase()) ||
            value.toLowerCase().includes(keyword.toLowerCase())) {
          match = true;
        }
      });
    }

    section.style.display = match ? '' : 'none';
  });
}

// 过滤事件
if (filterInput) {
  filterInput.addEventListener('input', (e) => {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      filterStyles(e.target.value);
    }, 200);
  });
}

[filterTag, filterClass, filterId].forEach(el => {
  if (el) {
    el.addEventListener('change', () => {
      filterStyles(filterInput?.value || '');
    });
  }
});

// 快捷键支持
document.addEventListener('keydown', (e) => {
  // Ctrl+F 打开过滤
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    if (filterPanel) {
      filterPanel.classList.toggle('visible');
      if (filterPanel.classList.contains('visible')) {
        filterInput?.focus();
      }
    }
  }

  // Escape 关闭面板
  if (e.key === 'Escape') {
    if (testerPanel?.style.display !== 'none') {
      testerPanel.style.display = 'none';
    }
    if (batchPanel?.style.display !== 'none') {
      batchPanel.style.display = 'none';
    }
    if (filterPanel?.classList.contains('visible')) {
      filterPanel.classList.remove('visible');
    }
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel?.classList.contains('visible')) {
      settingsPanel.classList.remove('visible');
    }
  }

  // R - 刷新
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    refreshBtn?.click();
  }

  // C - 计算样式
  if (e.key === 'c' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    computedBtn?.click();
  }

  // T - 测试
  if (e.key === 't' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    testBtn?.click();
  }

  // B - 批量
  if (e.key === 'b' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    batchBtn?.click();
  }
});

// ========== 主题系统 ==========

const themeBtn = document.getElementById('theme-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const settingTheme = document.getElementById('setting-theme');

// 当前主题
let currentTheme = localStorage.getItem('sidebar-theme') || 'dark';

/**
 * 应用主题
 */
function applyTheme(theme) {
  currentTheme = theme;

  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('light-theme', !prefersDark);
  } else {
    document.body.classList.toggle('light-theme', theme === 'light');
  }

  localStorage.setItem('sidebar-theme', theme);

  if (settingTheme) {
    settingTheme.value = theme;
  }
}

/**
 * 切换主题
 */
function toggleTheme() {
  const themes = ['dark', 'light'];
  const currentIndex = themes.indexOf(currentTheme === 'auto' ? 'dark' : currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  applyTheme(nextTheme);
}

// 主题按钮事件
if (themeBtn) {
  themeBtn.addEventListener('click', toggleTheme);
}

// 设置面板
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    settingsPanel?.classList.toggle('visible');
  });
}

if (settingsClose) {
  settingsClose.addEventListener('click', () => {
    settingsPanel?.classList.remove('visible');
  });
}

if (settingTheme) {
  settingTheme.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (currentTheme === 'auto') {
    document.body.classList.toggle('light-theme', !e.matches);
  }
});

// 初始化主题
applyTheme(currentTheme);

// ========== 设置管理 ==========

const settings = {
  autoPreview: true,
  showMatched: true,
  showInherited: false,
  compactMode: false,
  strategy: 'prefer-id'
};

/**
 * 加载设置
 */
function loadSettings() {
  const saved = localStorage.getItem('sidebar-settings');
  if (saved) {
    try {
      Object.assign(settings, JSON.parse(saved));
    } catch (e) {}
  }

  // 应用到 UI
  const autoPreview = document.getElementById('setting-auto-preview');
  const showMatched = document.getElementById('setting-show-matched');
  const showInherited = document.getElementById('setting-show-inherited');
  const compactMode = document.getElementById('setting-compact-mode');
  const strategy = document.getElementById('setting-strategy');

  if (autoPreview) autoPreview.checked = settings.autoPreview;
  if (showMatched) showMatched.checked = settings.showMatched;
  if (showInherited) showInherited.checked = settings.showInherited;
  if (compactMode) compactMode.checked = settings.compactMode;
  if (strategy) strategy.value = settings.strategy;

  // 应用紧凑模式
  document.body.classList.toggle('compact', settings.compactMode);
}

/**
 * 保存设置
 */
function saveSettings() {
  localStorage.setItem('sidebar-settings', JSON.stringify(settings));
}

// 设置变更监听
['setting-auto-preview', 'setting-show-matched', 'setting-show-inherited',
 'setting-compact-mode', 'setting-strategy'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', (e) => {
      const key = id.replace('setting-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      settings[key] = el.type === 'checkbox' ? el.checked : el.value;
      saveSettings();

      // 应用紧凑模式
      if (key === 'compactMode') {
        document.body.classList.toggle('compact', settings.compactMode);
      }
    });
  }
});

// 初始化设置
loadSettings();

// ========== 选中元素列表面板 ==========

// 批量选择的元素列表
let selectedElements = [];

// 新的UI元素（在批量操作面板中）
const startPickerBtn = document.getElementById('start-picker-btn');
const stopPickerBtn = document.getElementById('stop-picker-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const selectedElementsList = document.getElementById('selected-elements-list');
const mergedSelectorCode = document.getElementById('merged-selector-code');
const mergedCountEl = document.getElementById('merged-count');
const copyMergedBtn = document.getElementById('copy-merged-selector-btn');
const optimizeMergedBtn = document.getElementById('optimize-selector-btn');

// 旧的面板元素（可能不存在）
const selectedCountEl = document.getElementById('selected-count');
const selectedPanelContent = document.getElementById('selected-panel-content');
const mergedSelectorDisplay = document.getElementById('merged-selector-display');

console.log('[Sidebar] 选中元素面板元素检查:', {
  startPickerBtn: !!startPickerBtn,
  selectedElementsList: !!selectedElementsList,
  mergedSelectorCode: !!mergedSelectorCode
});

/**
 * 添加选中元素
 */
function addSelectedElement(selector, tag) {
  console.log('[Sidebar] addSelectedElement 被调用:', selector, tag);

  if (!selector) {
    console.warn('[Sidebar] 选择器为空，跳过');
    return;
  }

  // 检查是否已存在
  if (selectedElements.some(el => el.selector === selector)) {
    console.log('[Sidebar] 选择器已存在，跳过:', selector);
    return;
  }

  selectedElements.push({
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    selector: selector,
    tag: tag || 'div',
    timestamp: Date.now()
  });

  console.log('[Sidebar] 添加成功，当前数量:', selectedElements.length);
  updateSelectedElementsPanel();
  showToast(`已添加: ${selector.substring(0, 30)}${selector.length > 30 ? '...' : ''}`);
}

/**
 * 移除选中元素
 */
function removeSelectedElement(id) {
  selectedElements = selectedElements.filter(el => el.id !== id);
  updateSelectedElementsPanel();
}

/**
 * 清除所有选中元素
 */
function clearAllSelectedElements() {
  selectedElements = [];
  updateSelectedElementsPanel();
  showToast('已清除所有选中元素');
}

/**
 * 更新选中元素面板
 */
function updateSelectedElementsPanel() {
  // 更新新的列表
  if (selectedElementsList) {
    if (selectedElements.length === 0) {
      selectedElementsList.innerHTML = '<div class="empty-selection-hint">点击"开始选择"后在页面上选择元素</div>';
    } else {
      let html = '';
      selectedElements.forEach((el, index) => {
        html += `
          <div class="selected-element-item" data-id="${el.id}" title="${escapeHtml(el.selector)}">
            <span class="index">${index + 1}</span>
            <span class="tag">${escapeHtml(el.tag)}</span>
            <span class="selector">${escapeHtml(el.selector)}</span>
            <button class="remove-btn" data-remove="${el.id}" title="移除">×</button>
          </div>
        `;
      });
      selectedElementsList.innerHTML = html;

      // 绑定移除事件
      selectedElementsList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSelectedElement(btn.dataset.remove);
        });
      });

      // 绑定点击事件（高亮元素）
      selectedElementsList.querySelectorAll('.selected-element-item').forEach(item => {
        item.addEventListener('click', () => {
          highlightElementById(item.dataset.id);
        });
      });
    }
  }

  // 更新合并选择器
  const mergedSelector = generateMergedSelector();

  // 更新新的合并选择器显示
  if (mergedSelectorCode) {
    const codeEl = mergedSelectorCode.querySelector('code');
    if (codeEl) {
      codeEl.textContent = mergedSelector || '-';
    }
  }

  // 更新合并计数
  if (mergedCountEl) {
    mergedCountEl.textContent = `${selectedElements.length} 个元素`;
  }

  // 同时更新旧的面板（兼容）
  if (selectedCountEl) {
    selectedCountEl.textContent = selectedElements.length;
  }

  if (mergedSelectorDisplay) {
    const codeEl = mergedSelectorDisplay.querySelector('code');
    if (codeEl) {
      codeEl.textContent = mergedSelector || '-';
    }
  }
}

/**
 * 通过 ID 高亮元素
 */
function highlightElementById(id) {
  const element = selectedElements.find(el => el.id === id);
  if (!element) return;

  const script = `
    (function() {
      try {
        const elements = document.querySelectorAll('${element.selector.replace(/'/g, "\\'")}');

        // 移除旧高亮
        document.querySelectorAll('[data-devtools-highlight]').forEach(el => {
          el.removeAttribute('data-devtools-highlight');
        });

        // 添加新高亮
        elements.forEach(el => {
          el.setAttribute('data-devtools-highlight', 'true');
        });

        // 添加临时样式
        if (!document.getElementById('devtools-highlight-style')) {
          const style = document.createElement('style');
          style.id = 'devtools-highlight-style';
          style.textContent = \`
            [data-devtools-highlight="true"] {
              outline: 2px solid #d97706 !important;
              outline-offset: 2px !important;
              background: rgba(217, 119, 6, 0.1) !important;
            }
          \`;
          document.head.appendChild(style);
        }

        // 2秒后移除高亮
        setTimeout(() => {
          document.querySelectorAll('[data-devtools-highlight]').forEach(el => {
            el.removeAttribute('data-devtools-highlight');
          });
        }, 2000);

        return { success: true, count: elements.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败', true);
    }
  });
}

/**
 * 启动元素拾取器
 */
function startElementPicker() {
  console.log('[Sidebar] 启动元素拾取器');

  // 更新按钮状态
  if (startPickerBtn) startPickerBtn.style.display = 'none';
  if (stopPickerBtn) stopPickerBtn.style.display = 'block';

  // 发送消息到 content script
  chrome.devtools.inspectedWindow.eval(`
    (function() {
      if (typeof window.startElementPicker === 'function') {
        window.startElementPicker();
        return { success: true };
      }
      // 如果拾取器未注入，通过消息启动
      return { needInject: true };
    })()
  `, (result, error) => {
    if (result && result.needInject) {
      // 需要注入拾取器
      chrome.runtime.sendMessage({ type: 'START_ELEMENT_PICKER' });
    }
  });

  showToast('元素拾取器已启动，请在页面上选择元素');
}

/**
 * 停止元素拾取器
 */
function stopElementPicker() {
  console.log('[Sidebar] 停止元素拾取器');

  // 更新按钮状态
  if (startPickerBtn) startPickerBtn.style.display = 'block';
  if (stopPickerBtn) stopPickerBtn.style.display = 'none';

  // 发送消息到 content script
  chrome.devtools.inspectedWindow.eval(`
    (function() {
      if (typeof window.stopElementPicker === 'function') {
        window.stopElementPicker();
        return { success: true };
      }
      return { success: false };
    })()
  `);

  // 也通过 background 发送消息
  chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_PICKER' });

  showToast('元素拾取器已停止');
}

// 绑定拾取器按钮事件
if (startPickerBtn) {
  startPickerBtn.addEventListener('click', startElementPicker);
}

if (stopPickerBtn) {
  stopPickerBtn.addEventListener('click', stopElementPicker);
}

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener('click', () => {
    clearAllSelectedElements();
  });
}

// 绑定合并选择器按钮事件
if (copyMergedBtn) {
  copyMergedBtn.addEventListener('click', () => {
    const selector = generateMergedSelector();
    if (selector) {
      copyToClipboard(selector);
      showToast('已复制合并选择器');
    } else {
      showToast('没有可复制的选择器', true);
    }
  });
}

if (optimizeMergedBtn) {
  optimizeMergedBtn.addEventListener('click', () => {
    const selector = generateMergedSelector();
    if (selector) {
      // 调用 AI 优化
      currentSelector = selector;
      if (cssSelectorEl) {
        cssSelectorEl.textContent = selector;
        cssSelectorEl.classList.remove('empty');
      }
      aiOptimizeSelector();
    } else {
      showToast('没有可优化的选择器', true);
    }
  });
}

/**
 * 生成合并选择器
 */
function generateMergedSelector() {
  if (selectedElements.length === 0) return null;
  if (selectedElements.length === 1) return selectedElements[0].selector;

  // 提取所有选择器
  const selectors = selectedElements.map(el => el.selector);

  // 尝试找共同父级
  const parts = selectors.map(s => s.split(/\s*>\s*/));

  // 找最长公共前缀
  let commonPrefix = [];
  const minLen = Math.min(...parts.map(p => p.length));

  for (let i = 0; i < minLen; i++) {
    const part = parts[0][i];
    if (parts.every(p => p[i] === part)) {
      commonPrefix.push(part);
    } else {
      break;
    }
  }

  // 如果有共同前缀，构建优化后的选择器
  if (commonPrefix.length > 0) {
    // 获取剩余部分
    const remainders = parts.map(p => p.slice(commonPrefix.length).join(' > ')).filter(r => r);

    if (remainders.length === 0) {
      return commonPrefix.join(' > ');
    }

    // 如果剩余部分较短，用 :is() 合并
    if (remainders.length <= 5 && remainders.every(r => r.length < 50)) {
      const prefix = commonPrefix.join(' > ');
      const suffix = remainders.map(r => `:is(${r})`).join(' > ');
      return prefix + ' > ' + suffix;
    }
  }

  // 无法优化合并，直接用逗号连接
  return selectors.join(', ');
}

/**
 * 更新合并选择器显示
 */
function updateMergedSelector(selector) {
  if (!mergedSelectorDisplay) return;

  if (!selector) {
    mergedSelectorDisplay.innerHTML = '<code>-</code>';
    return;
  }

  // 截断过长的选择器
  const displaySelector = selector.length > 200 ? selector.substring(0, 200) + '...' : selector;
  mergedSelectorDisplay.innerHTML = `<code>${escapeHtml(displaySelector)}</code>`;
}

/**
 * 高亮元素
 */
function highlightElement(id) {
  const element = selectedElements.find(el => el.id === id);
  if (!element) return;

  const script = `
    (function() {
      try {
        const elements = document.querySelectorAll('${element.selector.replace(/'/g, "\\'")}');

        // 移除旧高亮
        document.querySelectorAll('[data-selected-highlight]').forEach(el => {
          el.removeAttribute('data-selected-highlight');
        });

        // 添加新高亮
        elements.forEach(el => {
          el.setAttribute('data-selected-highlight', 'true');
        });

        // 添加临时样式
        if (!document.getElementById('selected-highlight-style')) {
          const style = document.createElement('style');
          style.id = 'selected-highlight-style';
          style.textContent = \`
            [data-selected-highlight="true"] {
              outline: 2px solid #d97706 !important;
              outline-offset: 2px !important;
              background: rgba(217, 119, 6, 0.1) !important;
            }
          \`;
          document.head.appendChild(style);
        }

        // 2秒后移除高亮
        setTimeout(() => {
          document.querySelectorAll('[data-selected-highlight]').forEach(el => {
            el.removeAttribute('data-selected-highlight');
          });
        }, 2000);

        return { success: true, count: elements.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败', true);
    }
  });
}

/**
 * 复制所有选择器
 */
function copyAllSelectors() {
  if (selectedElements.length === 0) {
    showToast('没有选中元素', true);
    return;
  }

  const text = selectedElements.map(el => el.selector).join('\n');
  copyToClipboard(text);
}

/**
 * 复制合并选择器
 */
function copyMergedSelector() {
  const selector = generateMergedSelector();
  if (!selector) {
    showToast('没有可复制的选择器', true);
    return;
  }
  copyToClipboard(selector);
}

/**
 * 导出选择器
 */
function exportSelectors() {
  if (selectedElements.length === 0) {
    showToast('没有选中元素', true);
    return;
  }

  const data = {
    timestamp: new Date().toISOString(),
    count: selectedElements.length,
    elements: selectedElements.map(el => ({
      selector: el.selector,
      tag: el.tag
    })),
    mergedSelector: generateMergedSelector()
  };

  const text = JSON.stringify(data, null, 2);
  copyToClipboard(text);
  showToast('已导出 JSON 格式');
}

/**
 * 优化合并选择器
 */
function optimizeMergedSelector() {
  const selector = generateMergedSelector();
  if (!selector) {
    showToast('没有可优化的选择器', true);
    return;
  }

  // 调用 AI 优化
  currentSelector = selector;
  cssSelectorEl.textContent = selector;
  cssSelectorEl.classList.remove('empty');
  aiOptimizeSelector();
}

/**
 * 切换面板折叠（已废弃 - 面板现在在批量操作区域内）
 */
function togglePanelCollapse() {
  // 面板已移至批量操作区域内，此函数保留以兼容
}

// 接收来自 content script 的批量选择消息
// 注意：DevTools 面板主要通过 port 连接接收消息，但也可以监听 runtime.onMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Sidebar] 收到 runtime 消息:', message.type, message);

  if (message.type === 'batch-selection-update') {
    if (message.selectors && Array.isArray(message.selectors)) {
      console.log('[Sidebar] 处理批量选择更新, 数量:', message.selectors.length);
      message.selectors.forEach(item => {
        addSelectedElement(item.selector, item.tag);
      });
    }
    sendResponse({ success: true });
  }

  if (message.type === 'element-picker-selection') {
    // 从元素选择器接收选择
    if (message.selector) {
      console.log('[Sidebar] 添加单个元素选择:', message.selector);
      addSelectedElement(message.selector, message.tag || 'div');
    }
    sendResponse({ success: true });
  }

  return true; // 保持消息通道开放
});

// 初始化面板
updateSelectedElementsPanel();
console.log('[Sidebar] 选中元素面板已初始化');

// ========== 备用方案：通过 storage 同步选中元素 ==========
// 当 port 连接不稳定时使用

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pendingPickedElement) {
    const element = changes.pendingPickedElement.newValue;
    if (element && element.selector) {
      console.log('[Sidebar] 从 storage 收到元素选择:', element.selector);
      addSelectedElement(element.selector, element.tagName || 'div');
    }
  }
});

// 页面加载时检查是否有待处理的元素
chrome.storage.local.get(['pendingPickedElement'], (result) => {
  if (result.pendingPickedElement) {
    const element = result.pendingPickedElement;
    // 只处理最近 5 秒内的元素
    if (element.timestamp && Date.now() - element.timestamp < 5000) {
      console.log('[Sidebar] 恢复待处理元素:', element.selector);
      addSelectedElement(element.selector, element.tagName || 'div');
    }
    // 清除
    chrome.storage.local.remove('pendingPickedElement');
  }
});

// ========== 调试功能：添加测试选择 ==========
// 在控制台可以使用 window.testAddSelector() 测试
window.testAddSelector = function(selector, tag) {
  addSelectedElement(selector || 'div.test', tag || 'div');
};

// 监听元素选择变化，自动添加到批量选择列表
// 当在 DevTools Elements 面板选择元素时，按住 Alt 键可添加到批量列表
document.addEventListener('keydown', (e) => {
  if (e.altKey && currentSelector) {
    addSelectedElement(currentSelector, 'div');
  }
});

// ========== 性能优化: 虚拟滚动 ==========
// 当选中大量元素时，使用虚拟滚动提升性能

/**
 * 简易虚拟滚动实现
 */
class VirtualScroller {
  constructor(container, itemHeight = 24) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollTop = 0;

    if (this.container) {
      this.container.addEventListener('scroll', () => this.onScroll());
    }
  }

  setItems(items) {
    this.items = items;
    this.update();
  }

  onScroll() {
    const newScrollTop = this.container.scrollTop;
    if (Math.abs(newScrollTop - this.scrollTop) > this.itemHeight) {
      this.scrollTop = newScrollTop;
      this.update();
    }
  }

  update() {
    if (!this.container || this.items.length === 0) return;

    const containerHeight = this.container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / this.itemHeight) + 2;

    this.visibleStart = Math.floor(this.scrollTop / this.itemHeight);
    this.visibleEnd = Math.min(this.visibleStart + visibleCount, this.items.length);

    this.render();
  }

  render() {
    const fragment = document.createDocumentFragment();
    const offsetY = this.visibleStart * this.itemHeight;

    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const item = this.items[i];
      if (item && item.element) {
        item.element.style.transform = `translateY(${offsetY}px)`;
        fragment.appendChild(item.element);
      }
    }

    // 保留滚动空间
    const spacer = document.createElement('div');
    spacer.style.height = `${this.items.length * this.itemHeight}px`;
    fragment.appendChild(spacer);

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}

// ========== 智能推荐增强 ==========

/**
 * 基于选中模式推荐更优选择器
 */
function recommendBetterSelector(selectedElements) {
  if (!selectedElements || selectedElements.length === 0) return null;

  const recommendations = [];

  // 分析选中元素的模式
  const patterns = analyzeSelectionPatterns(selectedElements);

  // 推荐1: 如果选中了多个同级元素，推荐使用 :nth-child 范围
  if (patterns.areSiblings && patterns.areConsecutive) {
    recommendations.push({
      type: '范围选择器',
      selector: `${patterns.tagName}:nth-child(n+${patterns.startIndex}):nth-child(-n+${patterns.endIndex})`,
      reason: '选中的是连续的兄弟元素，使用范围选择器更简洁',
      score: 85
    });
  }

  // 推荐2: 如果选中了奇数/偶数位置的元素
  if (patterns.isOddPattern) {
    recommendations.push({
      type: '奇偶选择器',
      selector: `${patterns.tagName}:nth-child(odd)`,
      reason: '选中的元素都位于奇数位置',
      score: 80
    });
  } else if (patterns.isEvenPattern) {
    recommendations.push({
      type: '奇偶选择器',
      selector: `${patterns.tagName}:nth-child(even)`,
      reason: '选中的元素都位于偶数位置',
      score: 80
    });
  }

  // 推荐3: 如果有共同的父级 class
  if (patterns.commonParentClass) {
    recommendations.push({
      type: '父级限定选择器',
      selector: `.${patterns.commonParentClass} > ${patterns.tagName}`,
      reason: '选中元素有共同的父级容器',
      score: 75
    });
  }

  return recommendations.length > 0 ? recommendations : null;
}

/**
 * 分析选中模式
 */
function analyzeSelectionPatterns(elements) {
  const result = {
    areSiblings: false,
    areConsecutive: false,
    isOddPattern: false,
    isEvenPattern: false,
    tagName: '',
    startIndex: 0,
    endIndex: 0,
    commonParentClass: null
  };

  if (elements.length < 2) return result;

  // 检查是否同级
  const parents = new Set(elements.map(el => el.parentElement));
  result.areSiblings = parents.size === 1;

  if (result.areSiblings) {
    const parent = elements[0].parentElement;
    const children = Array.from(parent.children);
    const indices = elements.map(el => children.indexOf(el) + 1).sort((a, b) => a - b);

    result.tagName = elements[0].tagName?.toLowerCase() || '';
    result.startIndex = indices[0];
    result.endIndex = indices[indices.length - 1];

    // 检查是否连续
    result.areConsecutive = indices.every((val, i, arr) =>
      i === 0 || val === arr[i - 1] + 1
    );

    // 检查奇偶模式
    result.isOddPattern = indices.every(i => i % 2 === 1);
    result.isEvenPattern = indices.every(i => i % 2 === 0);

    // 检查共同父级 class
    const parentClasses = parent.className?.split(' ') || [];
    result.commonParentClass = parentClasses.find(c =>
      c && !/^(css-|styled-|sc-|js-|_)/.test(c)
    ) || null;
  }

  return result;
}

/**
 * 检测选择器潜在问题
 */
function detectSelectorIssues(selector) {
  const issues = [];

  if (!selector) return issues;

  // 检查过于具体的选择器
  const parts = selector.split(/\s*>\s*|\s+/);
  if (parts.length > 5) {
    issues.push({
      type: 'warning',
      message: '选择器层级过深，可能脆弱',
      suggestion: '考虑使用更短的选择器或添加有意义的 class'
    });
  }

  // 检查使用了自动生成的 class
  if (/(css-|styled-|sc-|js-|_)[a-z0-9]+/i.test(selector)) {
    issues.push({
      type: 'warning',
      message: '使用了自动生成的 class，可能不稳定',
      suggestion: '优先使用语义化的 class 或 data 属性'
    });
  }

  // 检查使用了位置选择器
  if (/:nth-child\(\d+\)/.test(selector)) {
    issues.push({
      type: 'info',
      message: '使用了位置选择器，DOM 结构变化时可能失效',
      suggestion: '如果可能，使用更稳定的属性选择器'
    });
  }

  // 检查通配符
  if (selector.includes('*')) {
    issues.push({
      type: 'warning',
      message: '使用了通配符，可能影响性能',
      suggestion: '尽量使用具体的标签名替代通配符'
    });
  }

  return issues;
}

// 导出功能供外部调用
window.SidebarUtils = {
  testSelector,
  highlightMatches,
  executeBatchAction,
  recommendBetterSelector,
  detectSelectorIssues,
  applyTheme
};
