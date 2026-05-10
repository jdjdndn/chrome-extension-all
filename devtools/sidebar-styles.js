// Sidebar Styles panel logic
'use strict'

// ========== EventBus V4.6 初始化 ==========
let eventBusReady = false

async function initEventBus() {
  if (typeof EventBus === 'undefined') {
    console.log('[Sidebar] EventBus 未加载，使用原生 API')
    return false
  }

  try {
    const state = EventBus.getState ? EventBus.getState() : null
    if (state && state.isReady) {
      eventBusReady = true
      return true
    }

    await EventBus.init()
    eventBusReady = true
    console.log('[Sidebar] EventBus V4.6 初始化完成')
    return true
  } catch (error) {
    console.warn('[Sidebar] EventBus 初始化失败:', error.message)
    return false
  }
}

// 初始化 EventBus（非阻塞）
initEventBus()

// ========== DevTools Port 连接 ==========
let backgroundPort = null
let connectionAttempts = 0

function connectToBackground() {
  if (backgroundPort) {return backgroundPort}

  try {
    backgroundPort = chrome.runtime.connect({ name: 'devtools-panel' })

    // 注册当前 tab
    const tabId = chrome.devtools.inspectedWindow.tabId
    backgroundPort.postMessage({
      type: 'REGISTER_DEVTOOLS',
      tabId: tabId,
    })

    console.log('[Sidebar] 注册 DevTools, tabId:', tabId)

    // 监听来自 background 的消息
    backgroundPort.onMessage.addListener((message) => {
      console.log('[Sidebar] 收到 port 消息:', message.type, message)

      if (message.type === 'batch-selection-update' && message.selectors) {
        // 批量选择更新
        console.log('[Sidebar] 批量选择更新, 数量:', message.selectors.length)
        message.selectors.forEach((item) => {
          addSelectedElement(item.selector, item.tag)
        })
      }

      if (message.type === 'element-picker-selection' && message.selector) {
        // 单个元素选择
        addSelectedElement(message.selector, message.tag || 'div')
      }
    })

    // 断开重连
    backgroundPort.onDisconnect.addListener(() => {
      console.log('[Sidebar] Port 断开连接')
      backgroundPort = null
      connectionAttempts++
      if (connectionAttempts < 5) {
        setTimeout(connectToBackground, 1000)
      }
    })

    connectionAttempts = 0
    console.log('[Sidebar] 已连接到 background')
  } catch (error) {
    console.warn('[Sidebar] 连接 background 失败:', error)
    backgroundPort = null
  }

  return backgroundPort
}

// 初始化连接
connectToBackground()

const cssSelectorEl = document.getElementById('css-selector')
const pathBreadcrumbsEl = document.getElementById('path-breadcrumbs')
const stylesContainer = document.getElementById('styles-container')
const refreshBtn = document.getElementById('refresh-btn')
const computedBtn = document.getElementById('computed-btn')
const aiBtn = document.getElementById('ai-btn')
const aiExplainBtn = document.getElementById('ai-explain-btn')
const aiPanel = document.getElementById('ai-panel')
const aiPanelContent = document.getElementById('ai-panel-content')
const aiCloseBtn = document.getElementById('ai-close-btn')
const toastEl = document.getElementById('toast')
const selectorStatusEl = document.getElementById('selector-status')

let showComputed = false
let currentSelector = ''
let currentElementInfo = null // 保存当前元素信息用于 AI 分析

// Show status message
function showStatus(message, type = '') {
  if (selectorStatusEl) {
    selectorStatusEl.textContent = message
    selectorStatusEl.className = 'selector-status' + (type ? ' ' + type : '')
  }
}

// Clear status
function clearStatus() {
  if (selectorStatusEl) {
    selectorStatusEl.textContent = ''
    selectorStatusEl.className = 'selector-status'
  }
}

// Show toast notification
function showToast(message, isError = false) {
  toastEl.textContent = message
  toastEl.className = 'toast show' + (isError ? ' error' : '')

  setTimeout(() => {
    toastEl.className = 'toast'
  }, 2000)
}

// Escape HTML
function escapeHtml(text) {
  if (text === null || text === undefined) {return ''}
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

// Generate unique CSS selector for an element
function generateUniqueSelector(el, document) {
  if (!el || el === document.body) {
    return 'body'
  }

  if (el === document.documentElement) {
    return 'html'
  }

  // Try ID first (most specific)
  if (el.id && !el.id.includes(' ') && !el.id.match(/^\d/)) {
    return '#' + CSS.escape(el.id)
  }

  // Build selector parts
  const parts = []
  let current = el

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()

    // Add ID if exists
    if (current.id && !current.id.includes(' ') && !current.id.match(/^\d/)) {
      selector = '#' + CSS.escape(current.id)
      parts.unshift(selector)
      break // ID is unique, stop here
    }

    // Add classes (filter out auto-generated ones)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter((c) => c && !c.match(/^[0-9]/) && !c.match(/^(css-|styled|sc-|_|js-)/))
        .slice(0, 2) // Limit to 2 classes to avoid long selectors

      if (classes.length > 0) {
        selector += '.' + classes.map((c) => CSS.escape(c)).join('.')
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current.tagName
      )

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += ':nth-child(' + index + ')'
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ')
}

// Get element path (ancestors)
function getElementPath(el, document) {
  const path = []
  let current = el

  while (current && current !== document.documentElement) {
    let name = current.tagName.toLowerCase()

    if (current.id) {
      name += '#' + current.id
    } else if (current.className && typeof current.className === 'string') {
      const firstClass = current.className.trim().split(/\s+/)[0]
      if (firstClass) {
        name += '.' + firstClass
      }
    }

    path.unshift({
      name: name,
      tag: current.tagName.toLowerCase(),
    })

    current = current.parentElement
  }

  return path
}

// Get element info and styles
function getElementInfo() {
  showStatus('正在生成选择器...', 'loading')

  const script = `
    (function() {
      try {
        const el = $0;
        if (!el || !el.tagName) {
          return { error: 'No element selected' };
        }

        // Generate CSS selector (ensure exact match)
        // 支持 DEFAULT_HIDE_SELECTORS 的高级模式
        function generateSelector(targetElement) {
          if (!targetElement) return '';
          if (targetElement === document.body) return 'body';
          if (targetElement === document.documentElement) return 'html';

          // === Helper Functions ===
          const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\\d/.test(node.id);

          const getClasses = (node) => {
            if (!node.className || typeof node.className !== 'string') return [];
            return node.className.trim().split(' ').filter(c => {
              if (!c || /^[0-9]/.test(c)) return false;
              // 过滤动态生成的 class
              if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_|ng-|React|react|vue-|v-)/.test(c)) return false;
              if (c.length > 40) return false;
              return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
            });
          };

          // 高优先级测试属性
          const TEST_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-test-id', 'data-qa', 'data-automation-id'];

          // 稳定属性
          const STABLE_ATTRS = ['type', 'role', 'data-type', 'data-role', 'data-kind', 'data-variant', 'data-size', 'data-id', 'name', 'disabled', 'readonly', 'required', 'checked'];

          const getUsefulAttributes = (node) => {
            if (!node.attributes) return [];
            const skipAttrs = ['onclick', 'onchange', 'onsubmit', 'oninput', 'onfocus', 'onblur', 'id', 'class', 'style', 'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby', 'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip', 'tabindex'];
            const attrs = [];
            for (const attr of node.attributes) {
              if (skipAttrs.includes(attr.name.toLowerCase())) continue;
              if (!attr.value || attr.value.length > 80 || /^\\d+$/.test(attr.value)) continue;
              attrs.push({ name: attr.name, value: attr.value });
            }
            // 按优先级排序：测试属性 > 稳定属性 > 其他
            attrs.sort((a, b) => {
              const aIsTest = TEST_ATTRS.includes(a.name) ? 0 : 1;
              const bIsTest = TEST_ATTRS.includes(b.name) ? 0 : 1;
              if (aIsTest !== bIsTest) return aIsTest - bIsTest;
              const aIsStable = STABLE_ATTRS.includes(a.name) ? 0 : 1;
              const bIsStable = STABLE_ATTRS.includes(b.name) ? 0 : 1;
              return aIsStable - bIsStable;
            });
            return attrs;
          };

          const getNthChild = (node) => {
            const parent = node.parentElement;
            if (!parent) return 0;
            const siblings = Array.from(parent.children);
            return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
          };

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

          const tag = targetElement.tagName.toLowerCase();
          const classes = getClasses(targetElement);
          const attrs = getUsefulAttributes(targetElement);
          const nthChild = getNthChild(targetElement);
          const nthOfType = getNthOfType(targetElement);

          // === 收集所有候选选择器 ===
          const candidates = [];

          // === Level 1: 最简单的选择器 ===

          // 1.1 测试属性（最高优先级）
          for (const testAttr of TEST_ATTRS) {
            const attr = attrs.find(a => a.name === testAttr);
            if (attr) {
              candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
              candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
            }
          }

          // 1.2 ID
          if (hasValidId(targetElement)) {
            candidates.push('#' + CSS.escape(targetElement.id));
          }

          // 1.3 role 属性
          const roleAttr = attrs.find(a => a.name === 'role');
          if (roleAttr) {
            candidates.push(tag + '[role="' + CSS.escape(roleAttr.value) + '"]');
          }

          // 1.4 单个 class
          for (const cls of classes) {
            candidates.push('.' + CSS.escape(cls));
            candidates.push(tag + '.' + CSS.escape(cls));
          }

          // 1.5 其他属性
          for (const attr of attrs.slice(0, 3)) {
            if (!TEST_ATTRS.includes(attr.name) && attr.name !== 'role') {
              candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
              candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
            }
          }

          // 测试 Level 1
          for (const sel of candidates) {
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 2: 双 class 组合 ===
          if (classes.length >= 2) {
            const sel = tag + '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
            // 尝试不带 tag
            const sel2 = '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 3: class + 属性组合 ===
          if (classes.length > 0 && attrs.length > 0) {
            for (const cls of classes.slice(0, 2)) {
              for (const attr of attrs.slice(0, 2)) {
                const sel = tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 4: 多 class 组合（3个） ===
          if (classes.length >= 3) {
            const sel = tag + '.' + classes.slice(0, 3).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 5: 结构伪类 ===
          const parent = targetElement.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const sameTypeSiblings = siblings.filter(c => c.tagName === targetElement.tagName);

            // :first-child
            if (targetElement === siblings[0]) {
              const sel = tag + ':first-child';
              if (isExactMatch(sel, targetElement)) return sel;
              if (classes.length > 0) {
                const sel2 = tag + '.' + CSS.escape(classes[0]) + ':first-child';
                if (isExactMatch(sel2, targetElement)) return sel2;
              }
            }

            // :last-child
            if (targetElement === siblings[siblings.length - 1]) {
              const sel = tag + ':last-child';
              if (isExactMatch(sel, targetElement)) return sel;
              if (classes.length > 0) {
                const sel2 = tag + '.' + CSS.escape(classes[0]) + ':last-child';
                if (isExactMatch(sel2, targetElement)) return sel2;
              }
            }

            // :only-child
            if (siblings.length === 1) {
              const sel = tag + ':only-child';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :first-of-type
            if (targetElement === sameTypeSiblings[0] && sameTypeSiblings.length > 1) {
              const sel = tag + ':first-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :last-of-type
            if (targetElement === sameTypeSiblings[sameTypeSiblings.length - 1] && sameTypeSiblings.length > 1) {
              const sel = tag + ':last-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :only-of-type
            if (sameTypeSiblings.length === 1) {
              const sel = tag + ':only-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :nth-child
            if (nthChild > 0) {
              const sel = tag + ':nth-child(' + nthChild + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :nth-of-type
            if (nthOfType > 0) {
              const sel = tag + ':nth-of-type(' + nthOfType + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // class + nth-of-type
            if (classes.length > 0 && nthOfType > 0) {
              const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-of-type(' + nthOfType + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // class + nth-child
            if (classes.length > 0 && nthChild > 0) {
              const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-child(' + nthChild + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 6: 兄弟选择器 ===
          const prevSibling = targetElement.previousElementSibling;
          const nextSibling = targetElement.nextElementSibling;

          if (prevSibling) {
            // 尝试用前一个兄弟 + 兄弟选择器
            const prevTag = prevSibling.tagName.toLowerCase();
            const prevClasses = getClasses(prevSibling);

            // prev + target
            const sel1 = prevTag + ' + ' + tag;
            if (isExactMatch(sel1, targetElement)) return sel1;

            // prev.class + target
            if (prevClasses.length > 0) {
              const sel2 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' + ' + tag;
              if (isExactMatch(sel2, targetElement)) return sel2;
            }

            // prev + target.class
            if (classes.length > 0) {
              const sel3 = prevTag + ' + ' + tag + '.' + CSS.escape(classes[0]);
              if (isExactMatch(sel3, targetElement)) return sel3;
            }

            // prev.class + target.class
            if (prevClasses.length > 0 && classes.length > 0) {
              const sel4 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' + ' + tag + '.' + CSS.escape(classes[0]);
              if (isExactMatch(sel4, targetElement)) return sel4;
            }
          }

          // === Level 7: 属性包含选择器 ===
          for (const cls of classes.slice(0, 3)) {
            // 尝试不同长度的子串
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              for (let start = 0; start <= cls.length - len; start++) {
                const substr = cls.substring(start, start + len);
                const sel = tag + '[class*="' + substr + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 8: 属性前缀/后缀选择器 ===
          for (const cls of classes.slice(0, 2)) {
            // 前缀
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              const prefix = cls.substring(0, len);
              const sel = tag + '[class^="' + prefix + '"]';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            // 后缀
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              const suffix = cls.substring(cls.length - len);
              const sel = tag + '[class$="' + suffix + '"]';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 9: :empty 空元素检查 ===
          if (targetElement.children.length === 0 && targetElement.textContent.trim() === '') {
            const sel = tag + ':empty';
            if (isExactMatch(sel, targetElement)) return sel;
            if (classes.length > 0) {
              const sel2 = tag + '.' + CSS.escape(classes[0]) + ':empty';
              if (isExactMatch(sel2, targetElement)) return sel2;
            }
          }

          // === Level 10: 状态伪类 ===
          try {
            if (targetElement.matches(':checked')) {
              const sel = tag + ':checked';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':disabled')) {
              const sel = tag + ':disabled';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':enabled')) {
              const sel = tag + ':enabled';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':required')) {
              const sel = tag + ':required';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':optional')) {
              const sel = tag + ':optional';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':read-only')) {
              const sel = tag + ':read-only';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':placeholder-shown')) {
              const sel = tag + ':placeholder-shown';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':valid')) {
              const sel = tag + ':valid';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':invalid')) {
              const sel = tag + ':invalid';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':in-range')) {
              const sel = tag + ':in-range';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':out-of-range')) {
              const sel = tag + ':out-of-range';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':default')) {
              const sel = tag + ':default';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':indeterminate')) {
              const sel = tag + ':indeterminate';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          } catch (e) {}

          // === Level 11: :not() 排除模式 ===
          if (parent) {
            const siblings = Array.from(parent.children);
            const sameTypeSiblings = siblings.filter(c => c.tagName === targetElement.tagName);

            // 如果目标元素是大多数同类元素中的一个，尝试排除少数
            if (sameTypeSiblings.length > 1) {
              const targetIndex = sameTypeSiblings.indexOf(targetElement);

              // 尝试排除第一个
              if (targetIndex !== 0) {
                const sel = tag + ':not(:first-of-type)';
                if (isExactMatch(sel, targetElement)) return sel;
              }

              // 尝试排除最后一个
              if (targetIndex !== sameTypeSiblings.length - 1) {
                const sel = tag + ':not(:last-of-type)';
                if (isExactMatch(sel, targetElement)) return sel;
              }

              // 尝试排除特定位置
              const excludeIndices = [];
              for (let i = 0; i < sameTypeSiblings.length; i++) {
                if (i !== targetIndex && sameTypeSiblings[i] !== targetElement) {
                  excludeIndices.push(i + 1);
                }
              }

              if (excludeIndices.length === 1) {
                const sel = tag + ':not(:nth-of-type(' + excludeIndices[0] + '))';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }

            // 尝试排除特定 class
            const siblingClasses = new Set();
            for (const sib of sameTypeSiblings) {
              if (sib !== targetElement) {
                for (const c of getClasses(sib)) {
                  if (!classes.includes(c)) {
                    siblingClasses.add(c);
                  }
                }
              }
            }

            if (siblingClasses.size > 0 && siblingClasses.size <= 2) {
              for (const excludeCls of siblingClasses) {
                const sel = tag + ':not(.' + CSS.escape(excludeCls) + ')';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 12: :has() 包含选择器 ===
          if (targetElement.children.length > 0) {
            const firstChild = targetElement.firstElementChild;
            if (firstChild) {
              const childTag = firstChild.tagName.toLowerCase();
              const childClasses = getClasses(firstChild);

              // :has(child)
              const sel1 = tag + ':has(' + childTag + ')';
              if (isExactMatch(sel1, targetElement)) return sel1;

              // :has(> child)
              const sel2 = tag + ':has(> ' + childTag + ')';
              if (isExactMatch(sel2, targetElement)) return sel2;

              // :has(> .class)
              if (childClasses.length > 0) {
                const sel3 = tag + ':has(> .' + CSS.escape(childClasses[0]) + ')';
                if (isExactMatch(sel3, targetElement)) return sel3;
              }
            }

            // :has(> *) - 有子元素
            const sel4 = tag + ':has(>)';
            if (isExactMatch(sel4, targetElement)) return sel4;
          }

          // === Level 13: :lang() 语言选择器 ===
          const lang = targetElement.getAttribute('lang');
          if (lang) {
            const sel = tag + '[lang="' + CSS.escape(lang) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const sel2 = tag + ':lang(' + lang + ')';
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 14: :dir() 方向选择器 ===
          const dir = targetElement.getAttribute('dir');
          if (dir) {
            const sel = tag + '[dir="' + CSS.escape(dir) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const sel2 = tag + ':dir(' + dir + ')';
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 15: 属性词匹配 [attr~=value] ===
          for (const cls of classes) {
            const sel = tag + '[class~="' + cls + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 16: :nth-last-child 倒数选择器 ===
          if (parent) {
            const siblings = Array.from(parent.children);
            const reverseIndex = siblings.length - siblings.indexOf(targetElement);

            if (reverseIndex === 1) {
              const sel = tag + ':nth-last-child(1)';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            if (reverseIndex <= 3) {
              const sel = tag + ':nth-last-child(-n+' + reverseIndex + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 17: 通用兄弟选择器 ~ ===
          if (prevSibling) {
            const prevTag = prevSibling.tagName.toLowerCase();
            const prevClasses = getClasses(prevSibling);

            // prev ~ target (任意后续兄弟)
            const sel1 = prevTag + ' ~ ' + tag;
            if (isExactMatch(sel1, targetElement)) return sel1;

            // prev.class ~ target
            if (prevClasses.length > 0) {
              const sel2 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' ~ ' + tag;
              if (isExactMatch(sel2, targetElement)) return sel2;
            }
          }

          // === Level 18: 构建路径 ===
          const path = [];
          let cur = targetElement;
          let depth = 0;
          const maxDepth = 8;

          while (cur && depth < maxDepth) {
            if (hasValidId(cur)) {
              path.unshift('#' + CSS.escape(cur.id));
              break;
            }

            const t = cur.tagName.toLowerCase();
            const c = getClasses(cur);
            const nth = getNthOfType(cur);
            const curAttrs = cur === targetElement ? attrs : getUsefulAttributes(cur);

            // 优先级：class > attr > nth-of-type > tag
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
            depth++;
          }

          let selector = path.join(' > ');
          if (isExactMatch(selector, targetElement)) return selector;

          // 尝试增强路径
          const lastPart = path[path.length - 1];
          if (classes.length > 1 && !lastPart.includes(':nth')) {
            const enhancedPath = [...path];
            enhancedPath[enhancedPath.length - 1] = tag + '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            const enhancedSel = enhancedPath.join(' > ');
            if (isExactMatch(enhancedSel, targetElement)) return enhancedSel;
          }

          // === Level 19: 路径压缩 ===
          // 尝试用后代选择器替代子选择器
          if (path.length >= 3) {
            const compressedPath = [path[0], path[path.length - 1]];
            const compressedSel = compressedPath.join(' ');
            if (isExactMatch(compressedSel, targetElement)) return compressedSel;
          }

          // === Level 20: 最终回退 ===
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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, evalError) => {
    // Handle eval error
    if (evalError) {
      showError(
        'Failed to get element info: ' + (evalError.value || evalError.message || 'Unknown error')
      )
      showStatus('获取元素信息失败', 'error')
      return
    }

    // Handle result error
    if (!result) {
      showError('No result from page')
      showStatus('页面无响应', 'error')
      return
    }

    if (result.error) {
      // Not a critical error, just show empty state
      cssSelectorEl.textContent = 'Select an element'
      cssSelectorEl.classList.add('empty')
      currentSelector = ''
      pathBreadcrumbsEl.innerHTML =
        '<span style="color: #666; font-size: 10px;">No element selected</span>'
      stylesContainer.innerHTML = '<div class="empty-state">Select an element to view styles</div>'
      showStatus('请选择一个元素', '')
      return
    }

    // Update CSS selector display
    currentSelector = result.selector
    currentElementInfo = result // 保存元素信息用于 AI 分析
    // Format selector for display (highlight shadow boundaries)
    const displaySelector = currentSelector.replace(/>>shadow/g, '\u2192 shadow') // → shadow
    cssSelectorEl.textContent = displaySelector
    cssSelectorEl.classList.remove('empty')

    // Update path breadcrumbs
    renderPathBreadcrumbs(result.path)

    // Render styles
    renderStyles(result.matched)

    // Show success status
    showStatus('选择器生成成功', 'success')
  })
}

// Get computed styles
function getComputedStyles() {
  showStatus('正在获取计算样式...', 'loading')

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
        // 支持 DEFAULT_HIDE_SELECTORS 的高级模式
        function generateSelector(targetElement) {
          if (!targetElement) return '';
          if (targetElement === document.body) return 'body';
          if (targetElement === document.documentElement) return 'html';

          // === Helper Functions ===
          const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\\d/.test(node.id);

          const getClasses = (node) => {
            if (!node.className || typeof node.className !== 'string') return [];
            return node.className.trim().split(' ').filter(c => {
              if (!c || /^[0-9]/.test(c)) return false;
              if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_|ng-|React|react|vue-|v-)/.test(c)) return false;
              if (c.length > 40) return false;
              return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
            });
          };

          // 高优先级测试属性
          const TEST_ATTRS = ['data-testid', 'data-test', 'data-cy', 'data-test-id', 'data-qa', 'data-automation-id'];

          // 稳定属性
          const STABLE_ATTRS = ['type', 'role', 'data-type', 'data-role', 'data-kind', 'data-variant', 'data-size', 'data-id', 'name', 'disabled', 'readonly', 'required', 'checked'];

          const getUsefulAttributes = (node) => {
            if (!node.attributes) return [];
            const skipAttrs = ['id', 'class', 'style', 'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby', 'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip', 'tabindex'];
            const attrs = [];
            for (const attr of node.attributes) {
              if (skipAttrs.includes(attr.name.toLowerCase())) continue;
              if (!attr.value || attr.value.length > 80 || /^\\d+$/.test(attr.value)) continue;
              attrs.push({ name: attr.name, value: attr.value });
            }
            attrs.sort((a, b) => {
              const aIsTest = TEST_ATTRS.includes(a.name) ? 0 : 1;
              const bIsTest = TEST_ATTRS.includes(b.name) ? 0 : 1;
              if (aIsTest !== bIsTest) return aIsTest - bIsTest;
              const aIsStable = STABLE_ATTRS.includes(a.name) ? 0 : 1;
              const bIsStable = STABLE_ATTRS.includes(b.name) ? 0 : 1;
              return aIsStable - bIsStable;
            });
            return attrs;
          };

          const getNthChild = (node) => {
            const parent = node.parentElement;
            if (!parent) return 0;
            const siblings = Array.from(parent.children);
            return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
          };

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

          const tag = targetElement.tagName.toLowerCase();
          const classes = getClasses(targetElement);
          const attrs = getUsefulAttributes(targetElement);
          const nthChild = getNthChild(targetElement);
          const nthOfType = getNthOfType(targetElement);

          // === 收集所有候选选择器 ===
          const candidates = [];

          // === Level 1: 最简单的选择器 ===

          // 1.1 测试属性（最高优先级）
          for (const testAttr of TEST_ATTRS) {
            const attr = attrs.find(a => a.name === testAttr);
            if (attr) {
              candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
              candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
            }
          }

          // 1.2 ID
          if (hasValidId(targetElement)) {
            candidates.push('#' + CSS.escape(targetElement.id));
          }

          // 1.3 role 属性
          const roleAttr = attrs.find(a => a.name === 'role');
          if (roleAttr) {
            candidates.push(tag + '[role="' + CSS.escape(roleAttr.value) + '"]');
          }

          // 1.4 单个 class
          for (const cls of classes) {
            candidates.push('.' + CSS.escape(cls));
            candidates.push(tag + '.' + CSS.escape(cls));
          }

          // 1.5 其他属性
          for (const attr of attrs.slice(0, 3)) {
            if (!TEST_ATTRS.includes(attr.name) && attr.name !== 'role') {
              candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
              candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
            }
          }

          // 测试 Level 1
          for (const sel of candidates) {
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 2: 双 class 组合 ===
          if (classes.length >= 2) {
            const sel = tag + '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
            // 尝试不带 tag
            const sel2 = '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 3: class + 属性组合 ===
          if (classes.length > 0 && attrs.length > 0) {
            for (const cls of classes.slice(0, 2)) {
              for (const attr of attrs.slice(0, 2)) {
                const sel = tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 4: 多 class 组合（3个） ===
          if (classes.length >= 3) {
            const sel = tag + '.' + classes.slice(0, 3).map(c => CSS.escape(c)).join('.');
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 5: 结构伪类 ===
          const parent = targetElement.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const sameTypeSiblings = siblings.filter(c => c.tagName === targetElement.tagName);

            // :first-child
            if (targetElement === siblings[0]) {
              const sel = tag + ':first-child';
              if (isExactMatch(sel, targetElement)) return sel;
              if (classes.length > 0) {
                const sel2 = tag + '.' + CSS.escape(classes[0]) + ':first-child';
                if (isExactMatch(sel2, targetElement)) return sel2;
              }
            }

            // :last-child
            if (targetElement === siblings[siblings.length - 1]) {
              const sel = tag + ':last-child';
              if (isExactMatch(sel, targetElement)) return sel;
              if (classes.length > 0) {
                const sel2 = tag + '.' + CSS.escape(classes[0]) + ':last-child';
                if (isExactMatch(sel2, targetElement)) return sel2;
              }
            }

            // :only-child
            if (siblings.length === 1) {
              const sel = tag + ':only-child';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :first-of-type
            if (targetElement === sameTypeSiblings[0] && sameTypeSiblings.length > 1) {
              const sel = tag + ':first-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :last-of-type
            if (targetElement === sameTypeSiblings[sameTypeSiblings.length - 1] && sameTypeSiblings.length > 1) {
              const sel = tag + ':last-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :only-of-type
            if (sameTypeSiblings.length === 1) {
              const sel = tag + ':only-of-type';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :nth-child
            if (nthChild > 0) {
              const sel = tag + ':nth-child(' + nthChild + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // :nth-of-type
            if (nthOfType > 0) {
              const sel = tag + ':nth-of-type(' + nthOfType + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // class + nth-of-type
            if (classes.length > 0 && nthOfType > 0) {
              const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-of-type(' + nthOfType + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            // class + nth-child
            if (classes.length > 0 && nthChild > 0) {
              const sel = tag + '.' + CSS.escape(classes[0]) + ':nth-child(' + nthChild + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 6: 兄弟选择器 ===
          const prevSibling = targetElement.previousElementSibling;
          const nextSibling = targetElement.nextElementSibling;

          if (prevSibling) {
            // 尝试用前一个兄弟 + 兄弟选择器
            const prevTag = prevSibling.tagName.toLowerCase();
            const prevClasses = getClasses(prevSibling);

            // prev + target
            const sel1 = prevTag + ' + ' + tag;
            if (isExactMatch(sel1, targetElement)) return sel1;

            // prev.class + target
            if (prevClasses.length > 0) {
              const sel2 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' + ' + tag;
              if (isExactMatch(sel2, targetElement)) return sel2;
            }

            // prev + target.class
            if (classes.length > 0) {
              const sel3 = prevTag + ' + ' + tag + '.' + CSS.escape(classes[0]);
              if (isExactMatch(sel3, targetElement)) return sel3;
            }

            // prev.class + target.class
            if (prevClasses.length > 0 && classes.length > 0) {
              const sel4 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' + ' + tag + '.' + CSS.escape(classes[0]);
              if (isExactMatch(sel4, targetElement)) return sel4;
            }
          }

          // === Level 7: 属性包含选择器 ===
          for (const cls of classes.slice(0, 3)) {
            // 尝试不同长度的子串
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              for (let start = 0; start <= cls.length - len; start++) {
                const substr = cls.substring(start, start + len);
                const sel = tag + '[class*="' + substr + '"]';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 8: 属性前缀/后缀选择器 ===
          for (const cls of classes.slice(0, 2)) {
            // 前缀
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              const prefix = cls.substring(0, len);
              const sel = tag + '[class^="' + prefix + '"]';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            // 后缀
            for (let len = Math.min(cls.length, 8); len >= 3; len--) {
              const suffix = cls.substring(cls.length - len);
              const sel = tag + '[class$="' + suffix + '"]';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 9: :empty 空元素检查 ===
          if (targetElement.children.length === 0 && targetElement.textContent.trim() === '') {
            const sel = tag + ':empty';
            if (isExactMatch(sel, targetElement)) return sel;
            if (classes.length > 0) {
              const sel2 = tag + '.' + CSS.escape(classes[0]) + ':empty';
              if (isExactMatch(sel2, targetElement)) return sel2;
            }
          }

          // === Level 10: 状态伪类 ===
          try {
            if (targetElement.matches(':checked')) {
              const sel = tag + ':checked';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':disabled')) {
              const sel = tag + ':disabled';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':enabled')) {
              const sel = tag + ':enabled';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':required')) {
              const sel = tag + ':required';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':optional')) {
              const sel = tag + ':optional';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':read-only')) {
              const sel = tag + ':read-only';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':placeholder-shown')) {
              const sel = tag + ':placeholder-shown';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':valid')) {
              const sel = tag + ':valid';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':invalid')) {
              const sel = tag + ':invalid';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':in-range')) {
              const sel = tag + ':in-range';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':out-of-range')) {
              const sel = tag + ':out-of-range';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':default')) {
              const sel = tag + ':default';
              if (isExactMatch(sel, targetElement)) return sel;
            }
            if (targetElement.matches(':indeterminate')) {
              const sel = tag + ':indeterminate';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          } catch (e) {}

          // === Level 11: :not() 排除模式 ===
          if (parent) {
            const siblings = Array.from(parent.children);
            const sameTypeSiblings = siblings.filter(c => c.tagName === targetElement.tagName);

            // 如果目标元素是大多数同类元素中的一个，尝试排除少数
            if (sameTypeSiblings.length > 1) {
              const targetIndex = sameTypeSiblings.indexOf(targetElement);

              // 尝试排除第一个
              if (targetIndex !== 0) {
                const sel = tag + ':not(:first-of-type)';
                if (isExactMatch(sel, targetElement)) return sel;
              }

              // 尝试排除最后一个
              if (targetIndex !== sameTypeSiblings.length - 1) {
                const sel = tag + ':not(:last-of-type)';
                if (isExactMatch(sel, targetElement)) return sel;
              }

              // 尝试排除特定位置
              const excludeIndices = [];
              for (let i = 0; i < sameTypeSiblings.length; i++) {
                if (i !== targetIndex && sameTypeSiblings[i] !== targetElement) {
                  excludeIndices.push(i + 1);
                }
              }

              if (excludeIndices.length === 1) {
                const sel = tag + ':not(:nth-of-type(' + excludeIndices[0] + '))';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }

            // 尝试排除特定 class
            const siblingClasses = new Set();
            for (const sib of sameTypeSiblings) {
              if (sib !== targetElement) {
                for (const c of getClasses(sib)) {
                  if (!classes.includes(c)) {
                    siblingClasses.add(c);
                  }
                }
              }
            }

            if (siblingClasses.size > 0 && siblingClasses.size <= 2) {
              for (const excludeCls of siblingClasses) {
                const sel = tag + ':not(.' + CSS.escape(excludeCls) + ')';
                if (isExactMatch(sel, targetElement)) return sel;
              }
            }
          }

          // === Level 12: :has() 包含选择器 ===
          if (targetElement.children.length > 0) {
            const firstChild = targetElement.firstElementChild;
            if (firstChild) {
              const childTag = firstChild.tagName.toLowerCase();
              const childClasses = getClasses(firstChild);

              // :has(child)
              const sel1 = tag + ':has(' + childTag + ')';
              if (isExactMatch(sel1, targetElement)) return sel1;

              // :has(> child)
              const sel2 = tag + ':has(> ' + childTag + ')';
              if (isExactMatch(sel2, targetElement)) return sel2;

              // :has(> .class)
              if (childClasses.length > 0) {
                const sel3 = tag + ':has(> .' + CSS.escape(childClasses[0]) + ')';
                if (isExactMatch(sel3, targetElement)) return sel3;
              }
            }

            // :has(> *) - 有子元素
            const sel4 = tag + ':has(>)';
            if (isExactMatch(sel4, targetElement)) return sel4;
          }

          // === Level 13: :lang() 语言选择器 ===
          const lang = targetElement.getAttribute('lang');
          if (lang) {
            const sel = tag + '[lang="' + CSS.escape(lang) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const sel2 = tag + ':lang(' + lang + ')';
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 14: :dir() 方向选择器 ===
          const dir = targetElement.getAttribute('dir');
          if (dir) {
            const sel = tag + '[dir="' + CSS.escape(dir) + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
            const sel2 = tag + ':dir(' + dir + ')';
            if (isExactMatch(sel2, targetElement)) return sel2;
          }

          // === Level 15: 属性词匹配 [attr~=value] ===
          for (const cls of classes) {
            const sel = tag + '[class~="' + cls + '"]';
            if (isExactMatch(sel, targetElement)) return sel;
          }

          // === Level 16: :nth-last-child 倒数选择器 ===
          if (parent) {
            const siblings = Array.from(parent.children);
            const reverseIndex = siblings.length - siblings.indexOf(targetElement);

            if (reverseIndex === 1) {
              const sel = tag + ':nth-last-child(1)';
              if (isExactMatch(sel, targetElement)) return sel;
            }

            if (reverseIndex <= 3) {
              const sel = tag + ':nth-last-child(-n+' + reverseIndex + ')';
              if (isExactMatch(sel, targetElement)) return sel;
            }
          }

          // === Level 17: 通用兄弟选择器 ~ ===
          if (prevSibling) {
            const prevTag = prevSibling.tagName.toLowerCase();
            const prevClasses = getClasses(prevSibling);

            // prev ~ target (任意后续兄弟)
            const sel1 = prevTag + ' ~ ' + tag;
            if (isExactMatch(sel1, targetElement)) return sel1;

            // prev.class ~ target
            if (prevClasses.length > 0) {
              const sel2 = prevTag + '.' + CSS.escape(prevClasses[0]) + ' ~ ' + tag;
              if (isExactMatch(sel2, targetElement)) return sel2;
            }
          }

          // === Level 18: 构建路径 ===
          const path = [];
          let cur = targetElement;
          let depth = 0;
          const maxDepth = 8;

          while (cur && depth < maxDepth) {
            if (hasValidId(cur)) {
              path.unshift('#' + CSS.escape(cur.id));
              break;
            }

            const t = cur.tagName.toLowerCase();
            const c = getClasses(cur);
            const nth = getNthOfType(cur);
            const curAttrs = cur === targetElement ? attrs : getUsefulAttributes(cur);

            // 优先级：class > attr > nth-of-type > tag
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
            depth++;
          }

          let selector = path.join(' > ');
          if (isExactMatch(selector, targetElement)) return selector;

          // 尝试增强路径
          const lastPart = path[path.length - 1];
          if (classes.length > 1 && !lastPart.includes(':nth')) {
            const enhancedPath = [...path];
            enhancedPath[enhancedPath.length - 1] = tag + '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
            const enhancedSel = enhancedPath.join(' > ');
            if (isExactMatch(enhancedSel, targetElement)) return enhancedSel;
          }

          // === Level 19: 路径压缩 ===
          // 尝试用后代选择器替代子选择器
          if (path.length >= 3) {
            const compressedPath = [path[0], path[path.length - 1]];
            const compressedSel = compressedPath.join(' ');
            if (isExactMatch(compressedSel, targetElement)) return compressedSel;
          }

          // === Level 20: 最终回退 ===
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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, evalError) => {
    if (evalError || !result || result.error) {
      showError('Failed to get computed styles')
      showStatus('获取计算样式失败', 'error')
      return
    }

    currentSelector = result.selector
    // Format selector for display (highlight shadow boundaries)
    const displaySelector = currentSelector.replace(/>>shadow/g, '\u2192 shadow') // → shadow
    cssSelectorEl.textContent = displaySelector
    cssSelectorEl.classList.remove('empty')

    renderComputedStyles(result.styles)

    showStatus('计算样式获取成功', 'success')
  })
}

// Show error message
function showError(message) {
  stylesContainer.innerHTML = '<div class="error-state">' + escapeHtml(message) + '</div>'
  showToast(message, true)
}

// Render path breadcrumbs
function renderPathBreadcrumbs(path) {
  if (!path || path.length === 0) {
    pathBreadcrumbsEl.innerHTML =
      '<span style="color: #666; font-size: 10px;">No path available</span>'
    return
  }

  let html = ''
  path.forEach((item, index) => {
    const isLast = index === path.length - 1

    if (item.isShadow) {
      // Shadow root marker
      html += '<span class="path-item shadow-marker" title="Shadow DOM boundary">_SHADOW_</span>'
      html += '<span class="path-separator">›</span>'
    } else {
      html +=
        '<span class="path-item' +
        (isLast ? ' current' : '') +
        '" title="' +
        escapeHtml(item.name) +
        '">' +
        escapeHtml(item.name) +
        '</span>'
      if (!isLast) {
        html += '<span class="path-separator">›</span>'
      }
    }
  })

  pathBreadcrumbsEl.innerHTML = html
}

// Render matched styles
function renderStyles(matched) {
  if (!matched || matched.length === 0) {
    stylesContainer.innerHTML = '<div class="empty-state">No styles found</div>'
    return
  }

  let html = ''
  for (const rule of matched) {
    const fileName = rule.href === 'inline' ? 'inline' : rule.href.split('/').pop().split('?')[0]

    html += `
      <div class="selector-section">
        <div class="selector-header">
          <span class="selector-name">${escapeHtml(rule.selector)}</span>
          <span class="selector-file">${escapeHtml(fileName)}</span>
        </div>
        <div class="style-rules">
    `

    if (rule.styles && rule.styles.length > 0) {
      for (const style of rule.styles) {
        const important = style.important ? ' !important' : ''
        html += `
          <div class="style-rule">
            <input type="checkbox" class="style-checkbox" checked>
            <span class="style-property">${escapeHtml(style.property)}:</span>
            <span class="style-value">
              <input type="text" value="${escapeHtml(style.value)}${important}" data-property="${escapeHtml(style.property)}">
            </span>
          </div>
        `
      }
    } else {
      html += '<div class="empty-state" style="padding: 8px;">No properties</div>'
    }

    html += '</div></div>'
  }

  stylesContainer.innerHTML = html

  // Add event listeners for style editing
  stylesContainer.querySelectorAll('.style-value input').forEach((input) => {
    input.addEventListener('change', handleStyleChange)
  })
}

// Render computed styles
function renderComputedStyles(styles) {
  if (!styles || styles.length === 0) {
    stylesContainer.innerHTML = '<div class="empty-state">No computed styles found</div>'
    return
  }

  let html = '<div class="selector-section"><div class="style-rules">'

  for (const style of styles) {
    html += `
      <div class="style-rule">
        <span class="style-property">${escapeHtml(style.property)}:</span>
        <span class="style-value">${escapeHtml(style.value)}</span>
      </div>
    `
  }

  html += '</div></div>'
  stylesContainer.innerHTML = html
}

// Handle style change
function handleStyleChange(e) {
  const property = e.target.dataset.property
  if (!property) {return}

  const value = e.target.value.replace(/!important$/, '').trim()
  const important = e.target.value.includes('!important')

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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || (result && result.error)) {
      showToast('Failed to update style', true)
    } else {
      showToast('Style updated')
    }
  })
}

// Refresh button
refreshBtn.addEventListener('click', () => {
  if (showComputed) {
    getComputedStyles()
  } else {
    getElementInfo()
  }
})

// Computed toggle
computedBtn.addEventListener('click', () => {
  showComputed = !showComputed
  computedBtn.classList.toggle('active', showComputed)

  if (showComputed) {
    getComputedStyles()
  } else {
    getElementInfo()
  }
})

// Listen for element selection changes
chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
  hideAiPanel()
  if (showComputed) {
    getComputedStyles()
  } else {
    getElementInfo()
  }
})

// Initial load
getElementInfo()

// ========== AI 辅助功能 ==========

/**
 * 隐藏 AI 面板
 */
function hideAiPanel() {
  if (aiPanel) {
    aiPanel.style.display = 'none'
  }
}

/**
 * 显示 AI 面板
 */
function showAiPanel(content) {
  if (aiPanel && aiPanelContent) {
    aiPanelContent.innerHTML = content
    aiPanel.style.display = 'block'
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
    `

    chrome.devtools.inspectedWindow.eval(script, (result, error) => {
      if (error || !result || result.error) {
        resolve(null)
      } else {
        resolve(result)
      }
    })
  })
}

/**
 * AI 优化选择器
 */
async function aiOptimizeSelector() {
  if (!currentElementInfo) {
    showToast('请先选择一个元素', true)
    return
  }

  showAiPanel('<div class="ai-loading">AI 正在分析并优化选择器...</div>')

  const context = await getElementContextForAI()
  if (!context) {
    showAiPanel('<div class="ai-error">无法获取元素上下文信息</div>')
    return
  }

  // 构建发送给 AI 的请求
  const aiRequest = {
    currentSelector: currentSelector,
    element: context,
    goal: 'optimize', // 优化当前选择器
  }

  try {
    // 尝试通过本地服务调用 AI
    const response = await fetch('http://localhost:3000/api/ai/selector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiRequest),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    renderAiSuggestions(result)
  } catch (error) {
    // 如果本地服务不可用，使用本地规则生成建议
    console.log('[AI] 本地服务不可用，使用本地规则:', error.message)
    const localSuggestions = generateLocalSuggestions(context)
    renderAiSuggestions({ suggestions: localSuggestions, source: 'local' })
  }
}

/**
 * AI 分析元素
 */
async function aiAnalyzeElement() {
  if (!currentElementInfo) {
    showToast('请先选择一个元素', true)
    return
  }

  showAiPanel('<div class="ai-loading">AI 正在分析元素...</div>')

  const context = await getElementContextForAI()
  if (!context) {
    showAiPanel('<div class="ai-error">无法获取元素上下文信息</div>')
    return
  }

  try {
    const response = await fetch('http://localhost:3000/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    renderAiAnalysis(result)
  } catch (error) {
    console.log('[AI] 本地服务不可用，使用本地分析:', error.message)
    const localAnalysis = generateLocalAnalysis(context)
    renderAiAnalysis({ analysis: localAnalysis, source: 'local' })
  }
}

/**
 * 本地规则生成选择器建议（当 AI 服务不可用时）
 */
function generateLocalSuggestions(context) {
  const suggestions = []
  const { basic, position, ancestors, siblings } = context

  // 策略1: ID 选择器
  if (basic.id && !basic.id.includes(' ') && !/^\d/.test(basic.id)) {
    suggestions.push({
      type: 'ID选择器',
      selector: `#${CSS.escape(basic.id)}`,
      score: 100,
      description: '使用唯一 ID，最稳定的选择器',
      pros: ['唯一性强', '性能最好'],
      cons: ['ID 可能会变化'],
    })
  }

  // 策略2: 语义化 class 选择器
  if (basic.className) {
    const classes = basic.className
      .split(' ')
      .filter(
        (c) => c && !/^(css-|styled-|sc-|js-|_|Mui|jss|css_|data-|ep-)/.test(c) && !/^\d/.test(c)
      )

    if (classes.length > 0) {
      // 单 class
      const semanticClass = classes.find((c) =>
        /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper|header|footer|content|title|text|icon)/.test(
          c.toLowerCase()
        )
      )
      if (semanticClass) {
        suggestions.push({
          type: '语义化Class',
          selector: `${basic.tagName}.${CSS.escape(semanticClass)}`,
          score: 85,
          description: '使用语义化的 class 名称',
          pros: ['可读性好', '相对稳定'],
          cons: ['可能匹配多个元素'],
        })
      }

      // 组合 class
      if (classes.length >= 2) {
        const combined = classes
          .slice(0, 2)
          .map((c) => CSS.escape(c))
          .join('.')
        suggestions.push({
          type: '组合Class',
          selector: `${basic.tagName}.${combined}`,
          score: 80,
          description: '组合多个 class 提高精确度',
          pros: ['精确度较高'],
          cons: ['选择器较长'],
        })
      }
    }
  }

  // 策略3: 属性选择器
  const usefulAttrs = basic.attributes.filter(
    (attr) =>
      !['id', 'class', 'style', 'data-ep-selected', 'data-ep-uid', 'data-ep-index'].includes(
        attr.name
      ) &&
      attr.value &&
      attr.value.length < 50 &&
      !/^\d+$/.test(attr.value)
  )

  for (const attr of usefulAttrs.slice(0, 2)) {
    suggestions.push({
      type: '属性选择器',
      selector: `${basic.tagName}[${CSS.escape(attr.name)}="${CSS.escape(attr.value)}"]`,
      score: 75,
      description: `使用 ${attr.name} 属性`,
      pros: ['属性通常较稳定'],
      cons: ['属性可能被移除'],
    })
  }

  // 策略4: 层级选择器（结合父级）
  if (ancestors.length > 0) {
    const parent = ancestors[0]
    if (parent.className) {
      const parentClass = parent.className.split(' ')[0]
      if (parentClass && !/^(css-|styled-|sc-)/.test(parentClass)) {
        suggestions.push({
          type: '层级选择器',
          selector: `${parent.tagName}.${CSS.escape(parentClass)} > ${basic.tagName}`,
          score: 70,
          description: '结合父级容器选择',
          pros: ['结构化选择', '相对稳定'],
          cons: ['依赖DOM结构'],
        })
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
      warning: true,
    })
  }

  return suggestions.slice(0, 5)
}

/**
 * 本地分析元素（当 AI 服务不可用时）
 */
function generateLocalAnalysis(context) {
  const { basic, position, ancestors, siblings, children, text } = context
  const analysis = []

  // 元素类型分析
  analysis.push(`**元素类型**: \`${basic.tagName}\``)

  // ID 分析
  if (basic.id) {
    analysis.push(
      `**ID**: \`${basic.id}\` ${/^\d/.test(basic.id) ? '(以数字开头，不可用作选择器)' : '(可用作选择器)'}`
    )
  }

  // Class 分析
  if (basic.className) {
    const classes = basic.className.split(' ').filter((c) => c)
    const semantic = classes.filter((c) =>
      /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper)/.test(
        c.toLowerCase()
      )
    )
    const generated = classes.filter((c) => /^(css-|styled-|sc-|js-|_|Mui|jss)/.test(c))

    analysis.push(`**Class 分析**: 共 ${classes.length} 个 class`)
    if (semantic.length > 0) {
      analysis.push(`- 语义化 class: \`${semantic.join('`, `')}\``)
    }
    if (generated.length > 0) {
      analysis.push(`- 自动生成 class (不建议使用): ${generated.length} 个`)
    }
  }

  // 位置分析
  if (position) {
    analysis.push(
      `**位置信息**: 在父级 \`${position.parentTag}\` 中的第 ${position.index} 个子元素`
    )
    if (position.sameTagSiblings > 1) {
      analysis.push(`- 同类型兄弟元素: ${position.sameTagSiblings} 个`)
    }
  }

  // 结构分析
  if (children && children.length > 0) {
    analysis.push(`**子元素**: ${children.length} 个直接子元素`)
  }

  // 文本内容
  if (text && text.length > 0) {
    analysis.push(`**文本内容**: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
  }

  // 选择器建议
  analysis.push(`**选择器建议**:`)
  if (basic.id && !/^\d/.test(basic.id)) {
    analysis.push(`- 推荐使用 ID 选择器: \`#${basic.id}\``)
  } else if (basic.className) {
    const classes = basic.className.split(' ').filter((c) => c && !/^(css-|styled-|sc-)/.test(c))
    if (classes.length > 0) {
      analysis.push(`- 推荐使用 class 选择器: \`.${classes[0]}\``)
    }
  }

  return analysis.join('\n\n')
}

/**
 * 渲染 AI 建议列表
 */
function renderAiSuggestions(result) {
  const { suggestions, source } = result

  if (!suggestions || suggestions.length === 0) {
    showAiPanel('<div class="ai-error">AI 未能生成有效建议</div>')
    return
  }

  let html = ''

  if (source === 'local') {
    html +=
      '<div style="color: #888; font-size: 10px; margin-bottom: 8px;">⚠️ AI 服务不可用，使用本地规则生成</div>'
  }

  suggestions.forEach((suggestion, index) => {
    const scoreClass = suggestion.score >= 80 ? '' : suggestion.score >= 60 ? 'medium' : 'low'

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
    `
  })

  showAiPanel(html)

  // 绑定事件
  aiPanelContent.querySelectorAll('.ai-suggestion-selector').forEach((el) => {
    el.addEventListener('click', () => {
      copyToClipboard(el.dataset.selector)
    })
  })

  aiPanelContent.querySelectorAll('[data-apply]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applySelector(btn.dataset.apply)
    })
  })

  aiPanelContent.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.copy)
    })
  })
}

/**
 * 渲染 AI 分析结果
 */
function renderAiAnalysis(result) {
  const { analysis, source } = result

  let html = ''

  if (source === 'local') {
    html +=
      '<div style="color: #888; font-size: 10px; margin-bottom: 8px;">⚠️ AI 服务不可用，使用本地分析</div>'
  }

  html += `<div class="ai-explanation">${analysis
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</div>`

  showAiPanel(html)
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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.valid) {
      showToast('选择器无效: ' + (result?.error || '未知错误'), true)
      return
    }

    // 更新显示
    currentSelector = selector
    cssSelectorEl.textContent = selector
    cssSelectorEl.classList.remove('empty')

    // 显示匹配数量
    if (result.count === 1) {
      showStatus('唯一匹配 ✓', 'success')
    } else {
      showStatus(`匹配 ${result.count} 个元素`, 'warning')
    }

    showToast(`已应用选择器 (匹配 ${result.count} 个元素)`)
  })
}

/**
 * 复制到剪贴板
 */
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast('已复制到剪贴板')
    })
    .catch(() => {
      showToast('复制失败', true)
    })
}

// AI 按钮事件
if (aiBtn) {
  aiBtn.addEventListener('click', aiOptimizeSelector)
}

if (aiExplainBtn) {
  aiExplainBtn.addEventListener('click', aiAnalyzeElement)
}

if (aiCloseBtn) {
  aiCloseBtn.addEventListener('click', hideAiPanel)
}

// ========== 选择器测试工具 ==========

const testerPanel = document.getElementById('selector-tester')
const testerInput = document.getElementById('tester-input')
const testerResult = document.getElementById('tester-result')
const testBtn = document.getElementById('test-btn')
const testerClose = document.getElementById('tester-close')
const testerHighlight = document.getElementById('tester-highlight')
const testerCopy = document.getElementById('tester-copy')

let testerDebounceTimer = null

/**
 * 测试选择器
 */
function testSelector(selector) {
  if (!selector || !selector.trim()) {
    updateTesterResult(0, '等待输入', '')
    return
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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result) {
      updateTesterResult(0, '执行错误', 'error')
      return
    }

    if (!result.valid) {
      updateTesterResult(0, result.error || '无效选择器', 'error')
      return
    }

    const count = result.count
    const text = count === 1 ? '唯一匹配' : `匹配 ${count} 个元素`
    const type = count === 1 ? 'success' : count > 10 ? 'warning' : ''

    updateTesterResult(count, text, type, result.elements)
  })
}

/**
 * 更新测试结果
 */
function updateTesterResult(count, text, type, elements = []) {
  if (!testerResult) {return}

  const countEl = testerResult.querySelector('.result-count')
  const textEl = testerResult.querySelector('.result-text')

  if (countEl) {
    countEl.textContent = count
    countEl.className = 'result-count' + (type === 'error' ? ' error' : '')
  }

  if (textEl) {
    textEl.textContent = text
  }

  // 显示匹配元素预览
  if (elements.length > 0) {
    let preview = elements
      .map((el) => {
        let str = el.tag
        if (el.id) {str += '#' + el.id}
        if (el.className) {str += '.' + el.className.split(' ')[0]}
        return str
      })
      .join(', ')
    if (count > 5) {preview += ' ...'}
    textEl.textContent = text + ' | ' + preview
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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败: ' + (result?.error || '未知错误'), true)
    } else {
      showToast(`已高亮 ${result.count} 个元素 (3秒后消失)`)
    }
  })
}

// 测试按钮事件
if (testBtn) {
  testBtn.addEventListener('click', () => {
    if (testerPanel) {
      const isVisible = testerPanel.style.display !== 'none'
      testerPanel.style.display = isVisible ? 'none' : 'block'

      if (!isVisible) {
        testerInput.value = currentSelector
        testerInput.focus()
        testSelector(currentSelector)
      }
    }
  })
}

if (testerClose) {
  testerClose.addEventListener('click', () => {
    if (testerPanel) {testerPanel.style.display = 'none'}
  })
}

if (testerInput) {
  testerInput.addEventListener('input', (e) => {
    clearTimeout(testerDebounceTimer)
    testerDebounceTimer = setTimeout(() => {
      testSelector(e.target.value)
    }, 300)
  })

  testerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      testSelector(e.target.value)
    }
  })
}

if (testerHighlight) {
  testerHighlight.addEventListener('click', () => {
    const selector = testerInput?.value || currentSelector
    if (selector) {highlightMatches(selector)}
  })
}

if (testerCopy) {
  testerCopy.addEventListener('click', () => {
    const selector = testerInput?.value || currentSelector
    if (selector) {
      copyToClipboard(selector)
    }
  })
}

// ========== 批量操作功能 ==========

const batchPanel = document.getElementById('batch-panel')
const batchBtn = document.getElementById('batch-btn')
const batchClose = document.getElementById('batch-close')
const batchAction = document.getElementById('batch-action')
const batchParams = document.getElementById('batch-params')
const batchClassName = document.getElementById('batch-class-name')
const batchSelector = document.getElementById('batch-selector')
const batchPreview = document.getElementById('batch-preview')
const batchExecute = document.getElementById('batch-execute')
const batchResult = document.getElementById('batch-result')

/**
 * 更新批量操作参数面板
 */
function updateBatchParams() {
  if (!batchAction || !batchParams) {return}

  const action = batchAction.value
  let html = ''

  switch (action) {
    case 'addClass':
    case 'removeClass':
      html =
        '<label>Class 名称</label><input type="text" id="batch-class-name" placeholder="如: active, hidden" />'
      break
    case 'setAttribute':
    case 'removeAttribute':
      html = `
        <label>属性名</label>
        <input type="text" id="batch-attr-name" placeholder="如: data-type" />
        ${action === 'setAttribute' ? '<label>属性值</label><input type="text" id="batch-attr-value" placeholder="属性值" />' : ''}
      `
      break
    case 'setStyle':
      html = `
        <label>样式属性</label>
        <input type="text" id="batch-style-prop" placeholder="如: display, color" />
        <label>样式值</label>
        <input type="text" id="batch-style-value" placeholder="如: none, red" />
      `
      break
  }

  batchParams.innerHTML = html
}

/**
 * 执行批量操作
 */
function executeBatchAction(preview = false) {
  const action = batchAction?.value
  const selector = batchSelector?.value || currentSelector

  if (!selector) {
    showBatchResult('请输入或选择一个选择器', true)
    return
  }

  const params = {}

  // 获取参数
  const classInput = document.getElementById('batch-class-name')
  const attrNameInput = document.getElementById('batch-attr-name')
  const attrValueInput = document.getElementById('batch-attr-value')
  const stylePropInput = document.getElementById('batch-style-prop')
  const styleValueInput = document.getElementById('batch-style-value')

  if (classInput) {params.className = classInput.value}
  if (attrNameInput) {params.attrName = attrNameInput.value}
  if (attrValueInput) {params.attrValue = attrValueInput.value}
  if (stylePropInput) {params.styleProp = stylePropInput.value}
  if (styleValueInput) {params.styleValue = styleValueInput.value}

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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showBatchResult('操作失败: ' + (result?.error || '未知错误'), true)
    } else {
      const msg = preview
        ? `预览: 将影响 ${result.affected} 个元素`
        : `成功: 已对 ${result.affected} 个元素执行操作`
      showBatchResult(msg, false)
    }
  })
}

/**
 * 显示批量操作结果
 */
function showBatchResult(message, isError) {
  if (!batchResult) {return}
  batchResult.textContent = message
  batchResult.className = 'batch-result visible ' + (isError ? 'error' : 'success')
}

// 批量操作事件
if (batchBtn) {
  batchBtn.addEventListener('click', () => {
    if (batchPanel) {
      const isVisible = batchPanel.style.display !== 'none'
      batchPanel.style.display = isVisible ? 'none' : 'block'

      if (!isVisible) {
        batchSelector.value = currentSelector
      }
    }
  })
}

if (batchClose) {
  batchClose.addEventListener('click', () => {
    if (batchPanel) {batchPanel.style.display = 'none'}
  })
}

if (batchAction) {
  batchAction.addEventListener('change', updateBatchParams)
}

if (batchPreview) {
  batchPreview.addEventListener('click', () => executeBatchAction(true))
}

if (batchExecute) {
  batchExecute.addEventListener('click', () => executeBatchAction(false))
}

// ========== 元素过滤功能 ==========

const filterPanel = document.getElementById('element-filter')
const filterInput = document.getElementById('filter-input')
const filterTag = document.getElementById('filter-tag')
const filterClass = document.getElementById('filter-class')
const filterId = document.getElementById('filter-id')

let filterDebounceTimer = null

/**
 * 过滤样式列表
 */
function filterStyles(keyword) {
  const sections = stylesContainer?.querySelectorAll('.selector-section')
  if (!sections) {return}

  const useTag = filterTag?.checked ?? true
  const useClass = filterClass?.checked ?? true
  const useId = filterId?.checked ?? true

  sections.forEach((section) => {
    const selectorName = section.querySelector('.selector-name')?.textContent || ''
    const styleRules = section.querySelectorAll('.style-rule')

    let match = !keyword // 空关键词时显示所有

    // 检查选择器名称
    if (!match && keyword) {
      if (useTag && selectorName.toLowerCase().includes(keyword.toLowerCase())) {
        match = true
      }
    }

    // 检查样式规则
    if (!match && keyword) {
      styleRules.forEach((rule) => {
        const prop = rule.querySelector('.style-property')?.textContent || ''
        const value =
          rule.querySelector('.style-value input')?.value ||
          rule.querySelector('.style-value')?.textContent ||
          ''

        if (
          prop.toLowerCase().includes(keyword.toLowerCase()) ||
          value.toLowerCase().includes(keyword.toLowerCase())
        ) {
          match = true
        }
      })
    }

    section.style.display = match ? '' : 'none'
  })
}

// 过滤事件
if (filterInput) {
  filterInput.addEventListener('input', (e) => {
    clearTimeout(filterDebounceTimer)
    filterDebounceTimer = setTimeout(() => {
      filterStyles(e.target.value)
    }, 200)
  })
}

[filterTag, filterClass, filterId].forEach((el) => {
  if (el) {
    el.addEventListener('change', () => {
      filterStyles(filterInput?.value || '')
    })
  }
})

// 快捷键支持
document.addEventListener('keydown', (e) => {
  // Ctrl+F 打开过滤
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    if (filterPanel) {
      filterPanel.classList.toggle('visible')
      if (filterPanel.classList.contains('visible')) {
        filterInput?.focus()
      }
    }
  }

  // Escape 关闭面板
  if (e.key === 'Escape') {
    if (testerPanel?.style.display !== 'none') {
      testerPanel.style.display = 'none'
    }
    if (batchPanel?.style.display !== 'none') {
      batchPanel.style.display = 'none'
    }
    if (filterPanel?.classList.contains('visible')) {
      filterPanel.classList.remove('visible')
    }
    const settingsPanel = document.getElementById('settings-panel')
    if (settingsPanel?.classList.contains('visible')) {
      settingsPanel.classList.remove('visible')
    }
  }

  // R - 刷新
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    refreshBtn?.click()
  }

  // C - 计算样式
  if (e.key === 'c' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    computedBtn?.click()
  }

  // T - 测试
  if (e.key === 't' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    testBtn?.click()
  }

  // B - 批量
  if (e.key === 'b' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    batchBtn?.click()
  }
})

// ========== 主题系统 ==========

const themeBtn = document.getElementById('theme-btn')
const settingsBtn = document.getElementById('settings-btn')
const settingsPanel = document.getElementById('settings-panel')
const settingsClose = document.getElementById('settings-close')
const settingTheme = document.getElementById('setting-theme')

// 当前主题
let currentTheme = localStorage.getItem('sidebar-theme') || 'dark'

/**
 * 应用主题
 */
function applyTheme(theme) {
  currentTheme = theme

  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.body.classList.toggle('light-theme', !prefersDark)
  } else {
    document.body.classList.toggle('light-theme', theme === 'light')
  }

  localStorage.setItem('sidebar-theme', theme)

  if (settingTheme) {
    settingTheme.value = theme
  }
}

/**
 * 切换主题
 */
function toggleTheme() {
  const themes = ['dark', 'light']
  const currentIndex = themes.indexOf(currentTheme === 'auto' ? 'dark' : currentTheme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  applyTheme(nextTheme)
}

// 主题按钮事件
if (themeBtn) {
  themeBtn.addEventListener('click', toggleTheme)
}

// 设置面板
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    settingsPanel?.classList.toggle('visible')
  })
}

if (settingsClose) {
  settingsClose.addEventListener('click', () => {
    settingsPanel?.classList.remove('visible')
  })
}

if (settingTheme) {
  settingTheme.addEventListener('change', (e) => {
    applyTheme(e.target.value)
  })
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (currentTheme === 'auto') {
    document.body.classList.toggle('light-theme', !e.matches)
  }
})

// 初始化主题
applyTheme(currentTheme)

// ========== 设置管理 ==========

const settings = {
  autoPreview: true,
  showMatched: true,
  showInherited: false,
  compactMode: false,
  strategy: 'prefer-id',
}

/**
 * 加载设置
 */
function loadSettings() {
  const saved = localStorage.getItem('sidebar-settings')
  if (saved) {
    try {
      Object.assign(settings, JSON.parse(saved))
    } catch (e) {}
  }

  // 应用到 UI
  const autoPreview = document.getElementById('setting-auto-preview')
  const showMatched = document.getElementById('setting-show-matched')
  const showInherited = document.getElementById('setting-show-inherited')
  const compactMode = document.getElementById('setting-compact-mode')
  const strategy = document.getElementById('setting-strategy')

  if (autoPreview) {autoPreview.checked = settings.autoPreview}
  if (showMatched) {showMatched.checked = settings.showMatched}
  if (showInherited) {showInherited.checked = settings.showInherited}
  if (compactMode) {compactMode.checked = settings.compactMode}
  if (strategy) {strategy.value = settings.strategy}

  // 应用紧凑模式
  document.body.classList.toggle('compact', settings.compactMode)
}

/**
 * 保存设置
 */
function saveSettings() {
  localStorage.setItem('sidebar-settings', JSON.stringify(settings))
}

// 设置变更监听
[
  'setting-auto-preview',
  'setting-show-matched',
  'setting-show-inherited',
  'setting-compact-mode',
  'setting-strategy',
].forEach((id) => {
  const el = document.getElementById(id)
  if (el) {
    el.addEventListener('change', (e) => {
      const key = id.replace('setting-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      settings[key] = el.type === 'checkbox' ? el.checked : el.value
      saveSettings()

      // 应用紧凑模式
      if (key === 'compactMode') {
        document.body.classList.toggle('compact', settings.compactMode)
      }
    })
  }
})

// 初始化设置
loadSettings()

// ========== 选中元素列表面板 ==========

// 批量选择的元素列表
let selectedElements = []

// 新的UI元素（在批量操作面板中）
const startPickerBtn = document.getElementById('start-picker-btn')
const stopPickerBtn = document.getElementById('stop-picker-btn')
const clearSelectionBtn = document.getElementById('clear-selection-btn')
const selectedElementsList = document.getElementById('selected-elements-list')
const mergedSelectorCode = document.getElementById('merged-selector-code')
const mergedCountEl = document.getElementById('merged-count')
const copyMergedBtn = document.getElementById('copy-merged-selector-btn')
const optimizeMergedBtn = document.getElementById('optimize-selector-btn')

// 旧的面板元素（可能不存在）
const selectedCountEl = document.getElementById('selected-count')
const selectedPanelContent = document.getElementById('selected-panel-content')
const mergedSelectorDisplay = document.getElementById('merged-selector-display')

console.log('[Sidebar] 选中元素面板元素检查:', {
  startPickerBtn: !!startPickerBtn,
  selectedElementsList: !!selectedElementsList,
  mergedSelectorCode: !!mergedSelectorCode,
})

/**
 * 添加选中元素
 */
function addSelectedElement(selector, tag) {
  console.log('[Sidebar] addSelectedElement 被调用:', selector, tag)

  if (!selector) {
    console.warn('[Sidebar] 选择器为空，跳过')
    return
  }

  // 检查是否已存在
  if (selectedElements.some((el) => el.selector === selector)) {
    console.log('[Sidebar] 选择器已存在，跳过:', selector)
    return
  }

  selectedElements.push({
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    selector: selector,
    tag: tag || 'div',
    timestamp: Date.now(),
  })

  console.log('[Sidebar] 添加成功，当前数量:', selectedElements.length)
  updateSelectedElementsPanel()
  showToast(`已添加: ${selector.substring(0, 30)}${selector.length > 30 ? '...' : ''}`)
}

/**
 * 移除选中元素
 */
function removeSelectedElement(id) {
  selectedElements = selectedElements.filter((el) => el.id !== id)
  updateSelectedElementsPanel()
}

/**
 * 清除所有选中元素
 */
function clearAllSelectedElements() {
  selectedElements = []
  updateSelectedElementsPanel()
  showToast('已清除所有选中元素')
}

/**
 * 更新选中元素面板
 */
function updateSelectedElementsPanel() {
  // 更新新的列表
  if (selectedElementsList) {
    if (selectedElements.length === 0) {
      selectedElementsList.innerHTML =
        '<div class="empty-selection-hint">点击"开始选择"后在页面上选择元素</div>'
    } else {
      let html = ''
      selectedElements.forEach((el, index) => {
        html += `
          <div class="selected-element-item" data-id="${el.id}" title="${escapeHtml(el.selector)}">
            <span class="index">${index + 1}</span>
            <span class="tag">${escapeHtml(el.tag)}</span>
            <span class="selector">${escapeHtml(el.selector)}</span>
            <button class="remove-btn" data-remove="${el.id}" title="移除">×</button>
          </div>
        `
      })
      selectedElementsList.innerHTML = html

      // 绑定移除事件
      selectedElementsList.querySelectorAll('.remove-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          removeSelectedElement(btn.dataset.remove)
        })
      })

      // 绑定点击事件（高亮元素）
      selectedElementsList.querySelectorAll('.selected-element-item').forEach((item) => {
        item.addEventListener('click', () => {
          highlightElementById(item.dataset.id)
        })
      })
    }
  }

  // 更新合并选择器
  const mergedSelector = generateMergedSelector()

  // 更新新的合并选择器显示
  if (mergedSelectorCode) {
    const codeEl = mergedSelectorCode.querySelector('code')
    if (codeEl) {
      codeEl.textContent = mergedSelector || '-'
    }
  }

  // 更新合并计数
  if (mergedCountEl) {
    mergedCountEl.textContent = `${selectedElements.length} 个元素`
  }

  // 同时更新旧的面板（兼容）
  if (selectedCountEl) {
    selectedCountEl.textContent = selectedElements.length
  }

  if (mergedSelectorDisplay) {
    const codeEl = mergedSelectorDisplay.querySelector('code')
    if (codeEl) {
      codeEl.textContent = mergedSelector || '-'
    }
  }
}

/**
 * 通过 ID 高亮元素
 */
function highlightElementById(id) {
  const element = selectedElements.find((el) => el.id === id)
  if (!element) {return}

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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败', true)
    }
  })
}

/**
 * 启动元素拾取器
 */
function startElementPicker() {
  console.log('[Sidebar] 启动元素拾取器')

  // 更新按钮状态
  if (startPickerBtn) {startPickerBtn.style.display = 'none'}
  if (stopPickerBtn) {stopPickerBtn.style.display = 'block'}

  // 发送消息到 content script
  chrome.devtools.inspectedWindow.eval(
    `
    (function() {
      if (typeof window.startElementPicker === 'function') {
        window.startElementPicker();
        return { success: true };
      }
      // 如果拾取器未注入，通过消息启动
      return { needInject: true };
    })()
  `,
    (result, error) => {
      if (result && result.needInject) {
        // 需要注入拾取器
        chrome.runtime.sendMessage({ type: 'START_ELEMENT_PICKER' })
      }
    }
  )

  showToast('元素拾取器已启动，请在页面上选择元素')
}

/**
 * 停止元素拾取器
 */
function stopElementPicker() {
  console.log('[Sidebar] 停止元素拾取器')

  // 更新按钮状态
  if (startPickerBtn) {startPickerBtn.style.display = 'block'}
  if (stopPickerBtn) {stopPickerBtn.style.display = 'none'}

  // 发送消息到 content script
  chrome.devtools.inspectedWindow.eval(`
    (function() {
      if (typeof window.stopElementPicker === 'function') {
        window.stopElementPicker();
        return { success: true };
      }
      return { success: false };
    })()
  `)

  // 也通过 background 发送消息
  chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_PICKER' })

  showToast('元素拾取器已停止')
}

// 绑定拾取器按钮事件
if (startPickerBtn) {
  startPickerBtn.addEventListener('click', startElementPicker)
}

if (stopPickerBtn) {
  stopPickerBtn.addEventListener('click', stopElementPicker)
}

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener('click', () => {
    clearAllSelectedElements()
  })
}

// 绑定合并选择器按钮事件
if (copyMergedBtn) {
  copyMergedBtn.addEventListener('click', () => {
    const selector = generateMergedSelector()
    if (selector) {
      copyToClipboard(selector)
      showToast('已复制合并选择器')
    } else {
      showToast('没有可复制的选择器', true)
    }
  })
}

if (optimizeMergedBtn) {
  optimizeMergedBtn.addEventListener('click', () => {
    const selector = generateMergedSelector()
    if (selector) {
      // 调用 AI 优化
      currentSelector = selector
      if (cssSelectorEl) {
        cssSelectorEl.textContent = selector
        cssSelectorEl.classList.remove('empty')
      }
      aiOptimizeSelector()
    } else {
      showToast('没有可优化的选择器', true)
    }
  })
}

/**
 * 生成合并选择器（高级模式）
 * 支持 DEFAULT_HIDE_SELECTORS 的高级模式：
 * - :nth-child(n):not(:nth-child(X)) 选择所有但排除特定位置
 * - [class*="xxx"] 属性包含选择器
 * - +* 兄弟选择器（任意元素）
 * - 多层 :not() 链
 * - :has() 选择器
 * - 共同祖先 + 后代选择器
 * - 结构伪类 :first-child, :last-child, :nth-of-type
 * - 属性前缀/后缀/包含选择器
 * - 复杂 :not() 组合
 */
function generateMergedSelector() {
  if (selectedElements.length === 0) {return null}
  if (selectedElements.length === 1) {return selectedElements[0].selector}

  const selectors = selectedElements.map((el) => el.selector)
  const startTime = Date.now()
  const MAX_TIME = 5000 // 最多 5 秒

  // 收集所有候选选择器，按优先级排序
  const candidates = []

  // === 策略 1: 共同 class 合并（最快） ===
  const classMerged = tryClassMerge(selectors)
  if (classMerged) {
    candidates.push({ selector: classMerged, priority: 100, strategy: 'class' })
  }

  // === 策略 2: 共同前缀合并 ===
  const parts = selectors.map((s) => s.split(/\s*>\s*/))
  const commonPrefix = []
  const minLen = Math.min(...parts.map((p) => p.length))

  for (let i = 0; i < minLen; i++) {
    const part = parts[0][i]
    if (parts.every((p) => p[i] === part)) {
      commonPrefix.push(part)
    } else {
      break
    }
  }

  if (commonPrefix.length > 0) {
    const remainders = parts.map((p) => p.slice(commonPrefix.length).join(' > ')).filter((r) => r)

    if (remainders.length === 0) {
      candidates.push({ selector: commonPrefix.join(' > '), priority: 95, strategy: 'prefix' })
    } else {
      // 尝试各种高级合并模式
      const advancedMerged = tryAdvancedMerge(remainders, commonPrefix)
      if (advancedMerged)
        {candidates.push({ selector: advancedMerged, priority: 90, strategy: 'advanced' })}

      const notMerged = tryNotMergeForRemainders(remainders, commonPrefix)
      if (notMerged) {candidates.push({ selector: notMerged, priority: 88, strategy: 'not-nth' })}

      const attrMerged = tryAttrContainsMerge(remainders, commonPrefix)
      if (attrMerged)
        {candidates.push({ selector: attrMerged, priority: 85, strategy: 'attr-contains' })}

      const structuralMerged = tryStructuralMerge(remainders, commonPrefix)
      if (structuralMerged)
        {candidates.push({ selector: structuralMerged, priority: 82, strategy: 'structural' })}

      const complexNotMerged = tryComplexNotMerge(remainders, commonPrefix)
      if (complexNotMerged)
        {candidates.push({ selector: complexNotMerged, priority: 80, strategy: 'complex-not' })}

      // :is() 合并
      if (remainders.length <= 5 && remainders.every((r) => r.length < 50)) {
        const prefix = commonPrefix.join(' > ')
        const suffix = ':is(' + remainders.join(', ') + ')'
        candidates.push({ selector: prefix + ' > ' + suffix, priority: 75, strategy: 'is' })
      }
    }
  }

  // === 策略 3: :not() 排除模式 ===
  const notMerged = tryNotMerge(selectors)
  if (notMerged) {candidates.push({ selector: notMerged, priority: 85, strategy: 'not' })}

  // === 策略 4: 兄弟选择器模式 ===
  const siblingMerged = trySiblingMerge(selectors)
  if (siblingMerged) {candidates.push({ selector: siblingMerged, priority: 80, strategy: 'sibling' })}

  // === 策略 5: :has() 选择器模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const hasMerged = tryHasMerge(selectors)
    if (hasMerged) {candidates.push({ selector: hasMerged, priority: 78, strategy: 'has' })}
  }

  // === 策略 6: 共同祖先 + 后代选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const ancestorMerged = tryAncestorMerge(selectors)
    if (ancestorMerged)
      {candidates.push({ selector: ancestorMerged, priority: 75, strategy: 'ancestor' })}
  }

  // === 策略 7: 属性包含选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const attrMerged = tryAttrContainsMergeGlobal(selectors)
    if (attrMerged) {candidates.push({ selector: attrMerged, priority: 72, strategy: 'attr-global' })}
  }

  // === 策略 8: 结构伪类模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const structMerged = tryStructuralPseudoMerge(selectors)
    if (structMerged) {candidates.push({ selector: structMerged, priority: 70, strategy: 'pseudo' })}
  }

  // === 策略 9: 属性前缀/后缀模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const prefixSuffixMerged = tryAttrPrefixSuffixMerge(selectors)
    if (prefixSuffixMerged)
      {candidates.push({
        selector: prefixSuffixMerged,
        priority: 68,
        strategy: 'attr-prefix-suffix',
      })}
  }

  // === 策略 10: 嵌套 :not():is() 组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const nestedMerged = tryNestedPseudoMerge(selectors)
    if (nestedMerged)
      {candidates.push({ selector: nestedMerged, priority: 65, strategy: 'nested-pseudo' })}
  }

  // === 策略 11: 共同属性模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const attrValueMerged = tryCommonAttrMerge(selectors)
    if (attrValueMerged)
      {candidates.push({ selector: attrValueMerged, priority: 62, strategy: 'common-attr' })}
  }

  // === 策略 12: 路径优化 ===
  if (Date.now() - startTime < MAX_TIME) {
    const pathOptimized = tryPathOptimization(selectors)
    if (pathOptimized)
      {candidates.push({ selector: pathOptimized, priority: 60, strategy: 'path-opt' })}
  }

  // === 策略 13: 模糊匹配模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const fuzzyMerged = tryFuzzyMerge(selectors)
    if (fuzzyMerged) {candidates.push({ selector: fuzzyMerged, priority: 55, strategy: 'fuzzy' })}
  }

  // === 策略 14: :where() 低优先级合并 ===
  if (Date.now() - startTime < MAX_TIME) {
    const whereMerged = tryWhereMerge(selectors)
    if (whereMerged) {candidates.push({ selector: whereMerged, priority: 58, strategy: 'where' })}
  }

  // === 策略 15: 倒数选择器 :nth-last-child ===
  if (Date.now() - startTime < MAX_TIME) {
    const nthLastMerged = tryNthLastMerge(selectors)
    if (nthLastMerged)
      {candidates.push({ selector: nthLastMerged, priority: 72, strategy: 'nth-last' })}
  }

  // === 策略 16: :empty 空元素选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const emptyMerged = tryEmptyMerge(selectors)
    if (emptyMerged) {candidates.push({ selector: emptyMerged, priority: 70, strategy: 'empty' })}
  }

  // === 策略 17: :checked/:disabled/:enabled 状态选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const stateMerged = tryStateMerge(selectors)
    if (stateMerged) {candidates.push({ selector: stateMerged, priority: 75, strategy: 'state' })}
  }

  // === 策略 18: :not() 多重排除链 ===
  if (Date.now() - startTime < MAX_TIME) {
    const multiNotMerged = tryMultiNotMerge(selectors)
    if (multiNotMerged)
      {candidates.push({ selector: multiNotMerged, priority: 78, strategy: 'multi-not' })}
  }

  // === 策略 19: :is() + :not() 组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const isNotMerged = tryIsNotMerge(selectors)
    if (isNotMerged) {candidates.push({ selector: isNotMerged, priority: 76, strategy: 'is-not' })}
  }

  // === 策略 20: 属性正则匹配 [attr~=value] ===
  if (Date.now() - startTime < MAX_TIME) {
    const attrRegexMerged = tryAttrRegexMerge(selectors)
    if (attrRegexMerged)
      {candidates.push({ selector: attrRegexMerged, priority: 66, strategy: 'attr-regex' })}
  }

  // === 策略 21: :nth-child(An+B) 公式模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const formulaMerged = tryNthFormulaMerge(selectors)
    if (formulaMerged)
      {candidates.push({ selector: formulaMerged, priority: 74, strategy: 'nth-formula' })}
  }

  // === 策略 22: :only-child/:only-of-type ===
  if (Date.now() - startTime < MAX_TIME) {
    const onlyMerged = tryOnlyMerge(selectors)
    if (onlyMerged) {candidates.push({ selector: onlyMerged, priority: 71, strategy: 'only' })}
  }

  // === 策略 23: 通配符优化 ===
  if (Date.now() - startTime < MAX_TIME) {
    const wildcardMerged = tryWildcardMerge(selectors)
    if (wildcardMerged)
      {candidates.push({ selector: wildcardMerged, priority: 50, strategy: 'wildcard' })}
  }

  // === 策略 24: :has() + 后代组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const hasDescMerged = tryHasDescendantMerge(selectors)
    if (hasDescMerged)
      {candidates.push({ selector: hasDescMerged, priority: 67, strategy: 'has-desc' })}
  }

  // === 策略 25: 多层级路径压缩 ===
  if (Date.now() - startTime < MAX_TIME) {
    const compressedMerged = tryPathCompression(selectors)
    if (compressedMerged)
      {candidates.push({ selector: compressedMerged, priority: 63, strategy: 'path-compress' })}
  }

  // === 策略 26: 相邻兄弟组 ~ ===
  if (Date.now() - startTime < MAX_TIME) {
    const generalSiblingMerged = tryGeneralSiblingMerge(selectors)
    if (generalSiblingMerged)
      {candidates.push({ selector: generalSiblingMerged, priority: 73, strategy: 'general-sibling' })}
  }

  // === 策略 27: :lang() 语言选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const langMerged = tryLangMerge(selectors)
    if (langMerged) {candidates.push({ selector: langMerged, priority: 64, strategy: 'lang' })}
  }

  // === 策略 28: :dir() 方向选择器 ===
  if (Date.now() - startTime < MAX_TIME) {
    const dirMerged = tryDirMerge(selectors)
    if (dirMerged) {candidates.push({ selector: dirMerged, priority: 64, strategy: 'dir' })}
  }

  // === 策略 29: :target/:focus/:hover 状态 ===
  if (Date.now() - startTime < MAX_TIME) {
    const targetMerged = tryTargetMerge(selectors)
    if (targetMerged) {candidates.push({ selector: targetMerged, priority: 69, strategy: 'target' })}
  }

  // === 策略 30: 深度选择器 ::deep / >>> ===
  if (Date.now() - startTime < MAX_TIME) {
    const deepMerged = tryDeepMerge(selectors)
    if (deepMerged) {candidates.push({ selector: deepMerged, priority: 52, strategy: 'deep' })}
  }

  // === 策略 31: :is() + 属性组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const isAttrMerged = tryIsAttrMerge(selectors)
    if (isAttrMerged) {candidates.push({ selector: isAttrMerged, priority: 74, strategy: 'is-attr' })}
  }

  // === 策略 32: :where() + :not() 组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const whereNotMerged = tryWhereNotMerge(selectors)
    if (whereNotMerged)
      {candidates.push({ selector: whereNotMerged, priority: 56, strategy: 'where-not' })}
  }

  // === 策略 33: 偶数/奇数模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const evenOddMerged = tryEvenOddMerge(selectors)
    if (evenOddMerged)
      {candidates.push({ selector: evenOddMerged, priority: 73, strategy: 'even-odd' })}
  }

  // === 策略 34: :not(:first-child) 排除模式 ===
  if (Date.now() - startTime < MAX_TIME) {
    const notFirstLastMerged = tryNotFirstLastMerge(selectors)
    if (notFirstLastMerged)
      {candidates.push({ selector: notFirstLastMerged, priority: 67, strategy: 'not-first-last' })}
  }

  // === 策略 35: 多属性组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const multiAttrMerged = tryMultiAttrMerge(selectors)
    if (multiAttrMerged)
      {candidates.push({ selector: multiAttrMerged, priority: 71, strategy: 'multi-attr' })}
  }

  // === 策略 36: :is() + :nth-child 组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const isNthMerged = tryIsNthMerge(selectors)
    if (isNthMerged) {candidates.push({ selector: isNthMerged, priority: 70, strategy: 'is-nth' })}
  }

  // === 策略 37: :has(> :not(:empty)) 非空子元素 ===
  if (Date.now() - startTime < MAX_TIME) {
    const hasNotEmptyMerged = tryHasNotEmptyMerge(selectors)
    if (hasNotEmptyMerged)
      {candidates.push({ selector: hasNotEmptyMerged, priority: 59, strategy: 'has-not-empty' })}
  }

  // === 策略 38: 属性值模式匹配 ===
  if (Date.now() - startTime < MAX_TIME) {
    const attrPatternMerged = tryAttrPatternMerge(selectors)
    if (attrPatternMerged)
      {candidates.push({ selector: attrPatternMerged, priority: 66, strategy: 'attr-pattern' })}
  }

  // === 策略 39: :is() + 多 class 组合 ===
  if (Date.now() - startTime < MAX_TIME) {
    const isMultiClassMerged = tryIsMultiClassMerge(selectors)
    if (isMultiClassMerged)
      {candidates.push({ selector: isMultiClassMerged, priority: 72, strategy: 'is-multi-class' })}
  }

  // 选择最优结果
  if (candidates.length > 0) {
    // 按优先级排序，优先级相同则选最短的
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {return b.priority - a.priority}
      return a.selector.length - b.selector.length
    })
    return candidates[0].selector
  }

  // 无法优化合并，直接用逗号连接
  return selectors.join(', ')
}

/**
 * 尝试 :where() 合并
 */
function tryWhereMerge(selectors) {
  // :where() 与 :is() 类似但优先级为 0
  if (selectors.length <= 5) {
    // 检查是否可以用 :where() 包裹
    const parsed = selectors.map((s) => {
      // 提取最后部分
      const parts = s.split(/\s*>\s*/)
      return { full: s, last: parts[parts.length - 1], parent: parts.slice(0, -1).join(' > ') }
    })

    const parents = [...new Set(parsed.map((p) => p.parent))]
    if (parents.length === 1 && parents[0]) {
      const lastParts = [...new Set(parsed.map((p) => p.last))]
      if (lastParts.length <= 5) {
        return parents[0] + ' > :where(' + lastParts.join(', ') + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :nth-last-child 合并
 */
function tryNthLastMerge(selectors) {
  // 解析选择器中的 nth-child 信息
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    const last = parts[parts.length - 1]
    const match = last.match(/:nth-child\((\d+)\)/)
    return {
      full: sel,
      parts,
      last,
      nthChild: match ? parseInt(match[1], 10) : null,
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  // 检查是否有共同父级
  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const nthValues = parsed.filter((p) => p.nthChild !== null).map((p) => p.nthChild)
    if (nthValues.length === selectors.length && nthValues.length >= 2) {
      // 检查是否是从末尾开始的连续序列
      // 假设总共有 N 个子元素，nth-last-child(1) 是最后一个
      // 这里我们尝试生成 :nth-last-child(-n+X) 模式
      const sorted = [...nthValues].sort((a, b) => b - a) // 降序
      const isConsecutiveFromEnd = sorted.every((n, i) => n === sorted[0] - i)
      if (isConsecutiveFromEnd && sorted.length <= 5) {
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')
        const lastN = sorted.length
        return parents[0] + ' > ' + base + ':nth-last-child(-n+' + lastN + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :empty 合并
 */
function tryEmptyMerge(selectors) {
  // 检查是否所有选择器都指向空元素
  // 这需要实际检查 DOM，这里只做语法层面的分析
  const lastParts = selectors.map((s) => {
    const parts = s.split(/\s*>\s*/)
    return parts[parts.length - 1]
  })

  // 检查是否有共同模式
  const baseParts = lastParts.map((p) => p.replace(/:empty/g, ''))
  const uniqueBase = [...new Set(baseParts)]

  if (uniqueBase.length === 1) {
    const parents = selectors.map((s) =>
      s
        .split(/\s*>\s*/)
        .slice(0, -1)
        .join(' > ')
    )
    const uniqueParents = [...new Set(parents)]
    if (uniqueParents.length === 1 && uniqueParents[0]) {
      return uniqueParents[0] + ' > ' + uniqueBase[0] + ':empty'
    }
  }
  return null
}

/**
 * 尝试状态选择器合并
 */
function tryStateMerge(selectors) {
  const statePseudos = [
    ':checked',
    ':disabled',
    ':enabled',
    ':required',
    ':optional',
    ':read-only',
    ':read-write',
    ':valid',
    ':invalid',
    ':in-range',
    ':out-of-range',
    ':placeholder-shown',
    ':default',
    ':focus',
    ':hover',
    ':active',
    ':visited',
    ':target',
  ]

  // 检查选择器是否包含状态伪类
  for (const state of statePseudos) {
    const hasState = selectors.filter((s) => s.includes(state))
    if (hasState.length === selectors.length) {
      // 提取基础选择器
      const bases = selectors.map((s) => s.replace(state, '').replace(/:nth-child\(\d+\)/g, ''))
      const uniqueBases = [...new Set(bases)]
      if (uniqueBases.length === 1) {
        return uniqueBases[0] + state
      }
    }
  }
  return null
}

/**
 * 尝试多重 :not() 排除链
 */
function tryMultiNotMerge(selectors) {
  // 解析选择器结构
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  // 检查是否有共同父级
  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    // 提取所有选中元素的 class
    const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    const selectedClasses = new Set()
    for (const p of parsed) {
      let match
      classPattern.lastIndex = 0
      while ((match = classPattern.exec(p.last)) !== null) {
        selectedClasses.add(match[1])
      }
    }

    // 生成排除选择器
    // 假设我们要排除某些 class
    // 这里生成一个通用的选择器
    if (selectedClasses.size > 0 && selectedClasses.size <= 3) {
      const tagMatch = parsed[0].last.match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : '*'
      const classList = [...selectedClasses]
      return parents[0] + ' > ' + tag + ':is(' + classList.map((c) => '.' + c).join(', ') + ')'
    }
  }
  return null
}

/**
 * 尝试 :is() + :not() 组合
 */
function tryIsNotMerge(selectors) {
  // 解析选择器
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const lastParts = [...new Set(parsed.map((p) => p.last))]
    if (lastParts.length <= 5 && lastParts.length >= 2) {
      // 生成 :is() 选择器
      return parents[0] + ' > :is(' + lastParts.join(', ') + ')'
    }
  }
  return null
}

/**
 * 尝试属性正则匹配
 */
function tryAttrRegexMerge(selectors) {
  // 提取所有 class
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
  const allClasses = []

  for (const sel of selectors) {
    const classes = []
    let match
    classPattern.lastIndex = 0
    while ((match = classPattern.exec(sel)) !== null) {
      classes.push(match[1])
    }
    allClasses.push(classes)
  }

  if (allClasses.length === 0 || allClasses.some((c) => c.length === 0)) {return null}

  // 找出共同的词（用空格分隔的 class）
  const firstClasses = allClasses[0]
  for (const cls of firstClasses) {
    // 检查是否所有元素都有这个词
    const allHave = allClasses.every((classes) => classes.includes(cls))
    if (allHave) {
      // 使用 [class~="word"] 匹配
      const tagMatch = selectors[0].match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : ''
      return tag + '[class~="' + cls + '"]'
    }
  }
  return null
}

/**
 * 尝试 :nth-child(An+B) 公式模式
 */
function tryNthFormulaMerge(selectors) {
  // 解析 nth-child 信息
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    const last = parts[parts.length - 1]
    const match = last.match(/:nth-child\((\d+)\)/)
    return {
      full: sel,
      parts,
      last,
      nthChild: match ? parseInt(match[1], 10) : null,
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const nthValues = parsed.filter((p) => p.nthChild !== null).map((p) => p.nthChild)
    if (nthValues.length === selectors.length && nthValues.length >= 3) {
      // 尝试找出 An+B 公式
      const sorted = [...nthValues].sort((a, b) => a - b)

      // 检查是否是等差数列
      const diffs = []
      for (let i = 1; i < sorted.length; i++) {
        diffs.push(sorted[i] - sorted[i - 1])
      }
      const uniqueDiffs = [...new Set(diffs)]

      if (uniqueDiffs.length === 1) {
        // 等差数列，生成 :nth-child(An+B)
        const A = uniqueDiffs[0]
        const B = sorted[0] - A
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')

        if (A === 1) {
          // :nth-child(n+B)
          return parents[0] + ' > ' + base + ':nth-child(n+' + B + ')'
        } else {
          // :nth-child(An+B)
          return parents[0] + ' > ' + base + ':nth-child(' + A + 'n+' + B + ')'
        }
      }

      // 检查是否是奇数/偶数
      const allOdd = sorted.every((n) => n % 2 === 1)
      const allEven = sorted.every((n) => n % 2 === 0)

      if (allOdd) {
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')
        return parents[0] + ' > ' + base + ':nth-child(odd)'
      }
      if (allEven) {
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')
        return parents[0] + ' > ' + base + ':nth-child(even)'
      }
    }
  }
  return null
}

/**
 * 尝试 :only-child/:only-of-type 合并
 */
function tryOnlyMerge(selectors) {
  // 检查是否所有选择器都指向唯一子元素
  const lastParts = selectors.map((s) => {
    const parts = s.split(/\s*>\s*/)
    return parts[parts.length - 1]
  })

  // 检查是否有共同模式
  const baseParts = lastParts.map((p) => p.replace(/:only-child|:only-of-type/g, ''))
  const uniqueBase = [...new Set(baseParts)]

  if (uniqueBase.length === 1) {
    const parents = selectors.map((s) =>
      s
        .split(/\s*>\s*/)
        .slice(0, -1)
        .join(' > ')
    )
    const uniqueParents = [...new Set(parents)]
    if (uniqueParents.length === 1 && uniqueParents[0]) {
      // 检查是 :only-child 还是 :only-of-type
      const hasOnlyChild = selectors.some((s) => s.includes(':only-child'))
      const hasOnlyOfType = selectors.some((s) => s.includes(':only-of-type'))
      const pseudo = hasOnlyOfType ? ':only-of-type' : ':only-child'
      return uniqueParents[0] + ' > ' + uniqueBase[0] + pseudo
    }
  }
  return null
}

/**
 * 尝试通配符合并
 */
function tryWildcardMerge(selectors) {
  // 检查是否可以用通配符替换
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return { full: sel, parts, depth: parts.length }
  })

  // 检查是否所有选择器深度相同
  const depths = [...new Set(parsed.map((p) => p.depth))]
  if (depths.length === 1 && depths[0] >= 2) {
    // 尝试用 * 替换中间层级
    const firstParts = parsed[0].parts
    const wildcardPath = [firstParts[0], '*', firstParts[firstParts.length - 1]]
    return wildcardPath.join(' > ')
  }
  return null
}

/**
 * 尝试 :has() + 后代组合
 */
function tryHasDescendantMerge(selectors) {
  // 检查是否可以用 :has() 表示
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      ancestor: parts[0],
      descendant: parts.slice(1).join(' > '),
    }
  })

  // 检查是否有共同祖先
  const ancestors = [...new Set(parsed.map((p) => p.ancestor))]
  if (ancestors.length === 1) {
    const descendants = [...new Set(parsed.map((p) => p.descendant))]
    if (descendants.length <= 3) {
      return ancestors[0] + ':has(' + descendants.join(', ') + ')'
    }
  }
  return null
}

/**
 * 尝试路径压缩
 */
function tryPathCompression(selectors) {
  // 解析所有路径
  const paths = selectors.map((s) => s.split(/\s*>\s*/))

  // 尝试找出可以压缩的模式
  // 例如：a > b > c, a > d > c -> a > :is(b, d) > c
  if (paths.every((p) => p.length >= 3)) {
    const firstParts = paths.map((p) => p[0])
    const lastParts = paths.map((p) => p[p.length - 1])
    const middleParts = paths.map((p) => p.slice(1, -1).join(' > '))

    const uniqueFirst = [...new Set(firstParts)]
    const uniqueLast = [...new Set(lastParts)]
    const uniqueMiddle = [...new Set(middleParts)]

    if (uniqueFirst.length === 1 && uniqueLast.length === 1) {
      if (uniqueMiddle.length <= 3) {
        return uniqueFirst[0] + ' > :is(' + uniqueMiddle.join(', ') + ') > ' + uniqueLast[0]
      }
    }
  }
  return null
}

/**
 * 尝试通用兄弟选择器 ~
 */
function tryGeneralSiblingMerge(selectors) {
  // 检查是否可以用 ~ 表示兄弟关系
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const lastParts = [...new Set(parsed.map((p) => p.last))]
    if (lastParts.length === selectors.length && lastParts.length >= 2) {
      // 检查是否是兄弟关系
      // 生成 parent > first ~ last 模式
      const first = lastParts[0]
      const others = lastParts.slice(1)
      if (others.every((o) => o === first.replace(/\.\w+/g, ''))) {
        // 相同 tag，不同 class
        return parents[0] + ' > ' + first + ' ~ ' + others[0]
      }
    }
  }
  return null
}

/**
 * 尝试 :lang() 合并
 */
function tryLangMerge(selectors) {
  // 检查是否所有选择器都有 lang 属性
  const langPattern = /\[lang="([^"]+)"\]|:lang\(([^)]+)\)/
  const langs = selectors.map((s) => {
    const match = s.match(langPattern)
    return match ? match[1] || match[2] : null
  })

  if (langs.every((l) => l !== null)) {
    const uniqueLangs = [...new Set(langs)]
    if (uniqueLangs.length === 1) {
      const bases = selectors.map((s) => s.replace(langPattern, ''))
      const uniqueBases = [...new Set(bases)]
      if (uniqueBases.length === 1) {
        return uniqueBases[0] + ':lang(' + uniqueLangs[0] + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :dir() 合并
 */
function tryDirMerge(selectors) {
  // 检查是否所有选择器都有 dir 属性
  const dirPattern = /\[dir="([^"]+)"\]|:dir\(([^)]+)\)/
  const dirs = selectors.map((s) => {
    const match = s.match(dirPattern)
    return match ? match[1] || match[2] : null
  })

  if (dirs.every((d) => d !== null)) {
    const uniqueDirs = [...new Set(dirs)]
    if (uniqueDirs.length === 1) {
      const bases = selectors.map((s) => s.replace(dirPattern, ''))
      const uniqueBases = [...new Set(bases)]
      if (uniqueBases.length === 1) {
        return uniqueBases[0] + ':dir(' + uniqueDirs[0] + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :target/:focus/:hover 合并
 */
function tryTargetMerge(selectors) {
  const targetPseudos = [
    ':target',
    ':focus',
    ':focus-within',
    ':focus-visible',
    ':hover',
    ':active',
  ]

  for (const pseudo of targetPseudos) {
    const hasPseudo = selectors.filter((s) => s.includes(pseudo))
    if (hasPseudo.length === selectors.length) {
      const bases = selectors.map((s) => s.replace(pseudo, ''))
      const uniqueBases = [...new Set(bases)]
      if (uniqueBases.length === 1) {
        return uniqueBases[0] + pseudo
      }
    }
  }
  return null
}

/**
 * 尝试深度选择器合并
 */
function tryDeepMerge(selectors) {
  // 检查是否可以用深度选择器简化
  const paths = selectors.map((s) => s.split(/\s*>\s*/))

  if (paths.every((p) => p.length >= 3)) {
    const firstParts = [...new Set(paths.map((p) => p[0]))]
    const lastParts = [...new Set(paths.map((p) => p[p.length - 1]))]

    if (firstParts.length === 1 && lastParts.length === 1) {
      // 使用深度选择器
      return firstParts[0] + ' ' + lastParts[0]
    }
  }
  return null
}

/**
 * 尝试 :is() + 属性组合
 */
function tryIsAttrMerge(selectors) {
  // 提取所有属性选择器
  const attrPattern = /\[([a-zA-Z_-][a-zA-Z0-9_-]*)="([^"]+)"\]/g
  const allAttrs = []

  for (const sel of selectors) {
    const attrs = []
    let match
    attrPattern.lastIndex = 0
    while ((match = attrPattern.exec(sel)) !== null) {
      attrs.push({ name: match[1], value: match[2] })
    }
    allAttrs.push(attrs)
  }

  if (allAttrs.length === 0 || allAttrs.some((a) => a.length === 0)) {return null}

  // 找出共同的属性名
  const firstAttrNames = allAttrs[0].map((a) => a.name)
  for (const attrName of firstAttrNames) {
    const values = allAttrs.map((attrs) => {
      const found = attrs.find((a) => a.name === attrName)
      return found ? found.value : null
    })

    if (values.every((v) => v !== null)) {
      const uniqueValues = [...new Set(values)]
      if (uniqueValues.length === selectors.length && uniqueValues.length <= 5) {
        const tagMatch = selectors[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        const isContent = uniqueValues.map((v) => '[' + attrName + '="' + v + '"]').join(', ')
        return tag + ':is(' + isContent + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :where() + :not() 组合
 */
function tryWhereNotMerge(selectors) {
  // 解析选择器
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    // 提取所有选中元素的 class
    const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    const allClasses = []
    for (const p of parsed) {
      const classes = []
      let match
      classPattern.lastIndex = 0
      while ((match = classPattern.exec(p.last)) !== null) {
        classes.push(match[1])
      }
      allClasses.push(new Set(classes))
    }

    // 找出共同的 class
    const commonClasses = [...allClasses[0]].filter((cls) =>
      allClasses.every((set) => set.has(cls))
    )

    if (commonClasses.length > 0) {
      const tagMatch = parsed[0].last.match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : ''
      return parents[0] + ' > ' + tag + '.' + commonClasses[0]
    }

    // 使用 :where() 包裹不同的部分
    const lastParts = [...new Set(parsed.map((p) => p.last))]
    if (lastParts.length <= 5) {
      return parents[0] + ' > :where(' + lastParts.join(', ') + ')'
    }
  }
  return null
}

/**
 * 尝试 :nth-child(2n) 偶数模式
 */
function tryEvenOddMerge(selectors) {
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    const last = parts[parts.length - 1]
    const match = last.match(/:nth-child\((\d+)\)/)
    return {
      full: sel,
      parts,
      last,
      nthChild: match ? parseInt(match[1], 10) : null,
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const nthValues = parsed.filter((p) => p.nthChild !== null).map((p) => p.nthChild)
    if (nthValues.length === selectors.length && nthValues.length >= 2) {
      // 检查是否全是偶数
      const allEven = nthValues.every((n) => n % 2 === 0)
      if (allEven) {
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')
        return parents[0] + ' > ' + base + ':nth-child(even)'
      }

      // 检查是否全是奇数
      const allOdd = nthValues.every((n) => n % 2 === 1)
      if (allOdd) {
        const base = parsed[0].last.replace(/:nth-child\(\d+\)/g, '')
        return parents[0] + ' > ' + base + ':nth-child(odd)'
      }
    }
  }
  return null
}

/**
 * 尝试 :not(:first-child) 排除模式
 */
function tryNotFirstLastMerge(selectors) {
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const lastParts = [...new Set(parsed.map((p) => p.last))]

    // 如果只有一个唯一选择器，但匹配多个元素
    if (lastParts.length === 1) {
      // 检查是否可以用 :not(:first-child) 或 :not(:last-child)
      const base = lastParts[0]
      const tagMatch = base.match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : ''

      // 尝试 :not(:first-child)
      const sel1 = tag + ':not(:first-child)'
      // 这里无法验证，返回候选
      return parents[0] + ' > ' + sel1
    }
  }
  return null
}

/**
 * 尝试多属性组合
 */
function tryMultiAttrMerge(selectors) {
  // 提取所有属性
  const attrPattern = /\[([a-zA-Z_-][a-zA-Z0-9_-]*)="([^"]+)"\]/g
  const allAttrs = []

  for (const sel of selectors) {
    const attrs = new Map()
    let match
    attrPattern.lastIndex = 0
    while ((match = attrPattern.exec(sel)) !== null) {
      attrs.set(match[1], match[2])
    }
    allAttrs.push(attrs)
  }

  if (allAttrs.length === 0 || allAttrs.some((a) => a.size === 0)) {return null}

  // 找出所有共同的属性
  const commonAttrs = []
  const firstAttrs = allAttrs[0]
  for (const [name, value] of firstAttrs) {
    if (allAttrs.every((attrs) => attrs.get(name) === value)) {
      commonAttrs.push({ name, value })
    }
  }

  if (commonAttrs.length >= 2) {
    // 使用多属性组合
    const tagMatch = selectors[0].match(/^([a-z]+)/)
    const tag = tagMatch ? tagMatch[1] : ''
    const attrStr = commonAttrs
      .slice(0, 2)
      .map((a) => '[' + a.name + '="' + a.value + '"]')
      .join('')
    return tag + attrStr
  }
  return null
}

/**
 * 尝试 :is() + :nth-child 组合
 */
function tryIsNthMerge(selectors) {
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    const last = parts[parts.length - 1]
    const nthMatch = last.match(/:nth-child\((\d+)\)/)
    const classMatch = last.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/)

    return {
      full: sel,
      parts,
      last,
      nthChild: nthMatch ? parseInt(nthMatch[1], 10) : null,
      class: classMatch ? classMatch[1] : null,
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    // 检查是否所有元素都有相同的 class
    const classes = parsed.map((p) => p.class)
    const uniqueClasses = [...new Set(classes.filter((c) => c !== null))]

    if (uniqueClasses.length === 1) {
      const nthValues = parsed.filter((p) => p.nthChild !== null).map((p) => p.nthChild)
      if (nthValues.length === selectors.length && nthValues.length <= 5) {
        // 生成 :is(:nth-child(1), :nth-child(2), ...) 模式
        const nthStr = nthValues.map((n) => ':nth-child(' + n + ')').join(', ')
        const tagMatch = parsed[0].last.match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        return parents[0] + ' > ' + tag + '.' + uniqueClasses[0] + ':is(' + nthStr + ')'
      }
    }
  }
  return null
}

/**
 * 尝试 :has(> :not(:empty)) 非空子元素
 */
function tryHasNotEmptyMerge(selectors) {
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const lastParts = [...new Set(parsed.map((p) => p.last))]
    if (lastParts.length === 1) {
      // 检查是否可以用 :has(> :not(:empty))
      const base = lastParts[0]
      const tagMatch = base.match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : ''
      return parents[0] + ' > ' + tag + ':has(> :not(:empty))'
    }
  }
  return null
}

/**
 * 尝试属性值模式匹配
 */
function tryAttrPatternMerge(selectors) {
  // 提取所有属性值
  const attrPattern = /\[([a-zA-Z_-][a-zA-Z0-9_-]*)="([^"]+)"\]/g
  const allAttrs = []

  for (const sel of selectors) {
    const attrs = []
    let match
    attrPattern.lastIndex = 0
    while ((match = attrPattern.exec(sel)) !== null) {
      attrs.push({ name: match[1], value: match[2] })
    }
    allAttrs.push(attrs)
  }

  if (allAttrs.length === 0 || allAttrs.some((a) => a.length === 0)) {return null}

  // 找出属性值中的共同模式
  const firstAttrs = allAttrs[0]
  for (const attr of firstAttrs) {
    const value = attr.value

    // 检查是否有共同的前缀
    for (let len = Math.min(value.length, 10); len >= 3; len--) {
      const prefix = value.substring(0, len)
      const allHavePrefix = allAttrs.every((attrs) => attrs.some((a) => a.value.startsWith(prefix)))

      if (allHavePrefix) {
        const tagMatch = selectors[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        return tag + '[' + attr.name + '^="' + prefix + '"]'
      }
    }

    // 检查是否有共同的后缀
    for (let len = Math.min(value.length, 10); len >= 3; len--) {
      const suffix = value.substring(value.length - len)
      const allHaveSuffix = allAttrs.every((attrs) => attrs.some((a) => a.value.endsWith(suffix)))

      if (allHaveSuffix) {
        const tagMatch = selectors[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        return tag + '[' + attr.name + '$="' + suffix + '"]'
      }
    }

    // 检查是否有共同的子串
    for (let len = Math.min(value.length, 10); len >= 3; len--) {
      for (let start = 0; start <= value.length - len; start++) {
        const substr = value.substring(start, start + len)
        const allHave = allAttrs.every((attrs) => attrs.some((a) => a.value.includes(substr)))

        if (allHave) {
          const tagMatch = selectors[0].match(/^([a-z]+)/)
          const tag = tagMatch ? tagMatch[1] : ''
          return tag + '[' + attr.name + '*="' + substr + '"]'
        }
      }
    }
  }
  return null
}

/**
 * 尝试 :is() + 多 class 组合
 */
function tryIsMultiClassMerge(selectors) {
  // 提取所有 class
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
  const allClasses = []

  for (const sel of selectors) {
    const classes = []
    let match
    classPattern.lastIndex = 0
    while ((match = classPattern.exec(sel)) !== null) {
      classes.push(match[1])
    }
    allClasses.push(classes)
  }

  if (allClasses.length === 0 || allClasses.some((c) => c.length === 0)) {return null}

  // 找出每个选择器的第一个 class
  const firstClasses = allClasses.map((c) => c[0])
  const uniqueFirst = [...new Set(firstClasses)]

  if (uniqueFirst.length === selectors.length && uniqueFirst.length <= 5) {
    // 所有选择器的第一个 class 都不同
    const tagMatch = selectors[0].match(/^([a-z]+)/)
    const tag = tagMatch ? tagMatch[1] : ''
    const isContent = uniqueFirst.map((c) => '.' + c).join(', ')
    return tag + ':is(' + isContent + ')'
  }
  return null
}

/**
 * 尝试结构伪类合并
 * 使用 :first-child, :last-child, :nth-of-type 等
 */
function tryStructuralMerge(remainders, commonPrefix) {
  // 提取所有 nth-child 信息
  const nthInfo = remainders.map((r) => {
    const match = r.match(/:nth-(?:child|of-type)\((\d+)\)/)
    return match ? parseInt(match[1], 10) : null
  })

  // 检查是否是连续的序列
  const validNths = nthInfo.filter((n) => n !== null)
  if (validNths.length === remainders.length && validNths.length >= 2) {
    const sorted = [...validNths].sort((a, b) => a - b)

    // 检查是否是前 N 个
    const isConsecutiveFromStart = sorted.every((n, i) => n === i + 1)
    if (isConsecutiveFromStart) {
      const base = remainders[0].replace(/:nth-(?:child|of-type)\(\d+\)/g, '')
      const lastN = sorted[sorted.length - 1]

      // 使用 :nth-child(-n+X) 选择前 X 个
      const selector = base + ':nth-child(-n+' + lastN + ')'
      return commonPrefix.join(' > ') + ' > ' + selector
    }

    // 检查是否是最后 N 个
    const totalChildren = sorted[sorted.length - 1]
    const isConsecutiveFromEnd = sorted.every((n, i) => n === totalChildren - sorted.length + i + 1)
    if (isConsecutiveFromEnd && sorted.length <= 3) {
      const base = remainders[0].replace(/:nth-(?:child|of-type)\(\d+\)/g, '')

      // 使用 :nth-child(n+X) 选择从 X 开始
      const startN = sorted[0]
      const selector = base + ':nth-child(n+' + startN + ')'
      return commonPrefix.join(' > ') + ' > ' + selector
    }
  }

  // 检查是否都是第一个或最后一个
  const firstLast = remainders.map((r) => {
    if (r.includes(':first-child')) {return 'first'}
    if (r.includes(':last-child')) {return 'last'}
    return null
  })

  const validFirstLast = firstLast.filter((f) => f !== null)
  if (validFirstLast.length === remainders.length) {
    const allFirst = validFirstLast.every((f) => f === 'first')
    const allLast = validFirstLast.every((f) => f === 'last')

    if (allFirst || allLast) {
      const base = remainders[0].replace(/:(?:first|last)-child/g, '')
      const pseudo = allFirst ? ':first-child' : ':last-child'
      return commonPrefix.join(' > ') + ' > ' + base + pseudo
    }
  }

  return null
}

/**
 * 尝试复杂 :not() 合并
 * 生成 :not(.class1, .class2) 或 :not([attr1], [attr2])
 */
function tryComplexNotMerge(remainders, commonPrefix) {
  // 提取基础部分和 class
  const baseParts = []
  const allClasses = []

  for (const r of remainders) {
    const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    const classes = []
    let match
    while ((match = classPattern.exec(r)) !== null) {
      classes.push(match[1])
    }
    allClasses.push(new Set(classes))

    // 提取基础部分
    const base = r.replace(classPattern, '').replace(/:nth-child\(\d+\)/g, '')
    baseParts.push(base)
  }

  // 如果基础部分相同
  const uniqueBase = [...new Set(baseParts)]
  if (uniqueBase.length === 1 && uniqueBase[0]) {
    // 找出共同的 class
    const commonClasses = [...allClasses[0]].filter((cls) =>
      allClasses.every((set) => set.has(cls))
    )

    if (commonClasses.length > 0) {
      // 使用共同 class
      const selector = uniqueBase[0] + '.' + commonClasses[0]
      return commonPrefix.join(' > ') + ' > ' + selector
    }
  }

  return null
}

/**
 * 尝试结构伪类全局合并
 */
function tryStructuralPseudoMerge(selectors) {
  // 检查选择器是否包含结构伪类
  const pseudoPattern = /:(first|last|nth|only)-(child|of-type)/
  const hasPseudo = selectors.every((s) => pseudoPattern.test(s))

  if (!hasPseudo) {return null}

  // 提取基础选择器和伪类
  const parsed = selectors
    .map((s) => {
      const match = s.match(/^(.+?)(:[a-z-]+(?:\([^)]*\))?)$/)
      if (match) {
        return { base: match[1], pseudo: match[2] }
      }
      return null
    })
    .filter(Boolean)

  if (parsed.length === selectors.length) {
    // 检查基础选择器是否相同
    const bases = [...new Set(parsed.map((p) => p.base))]
    if (bases.length === 1) {
      // 合并伪类
      const pseudos = [...new Set(parsed.map((p) => p.pseudo))]
      if (pseudos.length <= 3) {
        return bases[0] + ':is(' + pseudos.join(', ') + ')'
      }
    }
  }

  return null
}

/**
 * 尝试属性前缀/后缀合并
 */
function tryAttrPrefixSuffixMerge(selectors) {
  // 提取所有属性选择器
  const attrPattern = /\[([a-zA-Z_-][a-zA-Z0-9_-]*)\^?=\^?"([^"]+)"\]?/g
  const allAttrs = []

  for (const sel of selectors) {
    const attrs = []
    let match
    attrPattern.lastIndex = 0
    while ((match = attrPattern.exec(sel)) !== null) {
      attrs.push({ name: match[1], value: match[2] })
    }
    allAttrs.push(attrs)
  }

  if (allAttrs.length === 0 || allAttrs.some((a) => a.length === 0)) {return null}

  // 找出共同的前缀或后缀
  const firstAttrs = allAttrs[0]
  for (const attr of firstAttrs) {
    const value = attr.value

    // 尝试不同长度的前缀
    for (let len = Math.min(value.length, 10); len >= 3; len--) {
      const prefix = value.substring(0, len)
      const allHavePrefix = allAttrs.every((attrs) => attrs.some((a) => a.value.startsWith(prefix)))

      if (allHavePrefix) {
        const tagMatch = selectors[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        return tag + '[' + attr.name + '^="' + prefix + '"]'
      }
    }

    // 尝试不同长度的后缀
    for (let len = Math.min(value.length, 10); len >= 3; len--) {
      const suffix = value.substring(value.length - len)
      const allHaveSuffix = allAttrs.every((attrs) => attrs.some((a) => a.value.endsWith(suffix)))

      if (allHaveSuffix) {
        const tagMatch = selectors[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        return tag + '[' + attr.name + '$="' + suffix + '"]'
      }
    }
  }

  return null
}

/**
 * 尝试嵌套伪类合并
 * 生成 :not(:is(.a, .b)) 或 :is(:not(.a), :not(.b)) 等
 */
function tryNestedPseudoMerge(selectors) {
  // 解析选择器结构
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
      parent: parts.slice(0, -1).join(' > '),
    }
  })

  // 检查是否有共同父级
  const parents = [...new Set(parsed.map((p) => p.parent))]
  if (parents.length === 1 && parents[0]) {
    const parent = parents[0]
    const lastParts = parsed.map((p) => p.last)

    // 提取 class
    const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    const allClasses = []
    for (const part of lastParts) {
      const classes = []
      let match
      classPattern.lastIndex = 0
      while ((match = classPattern.exec(part)) !== null) {
        classes.push(match[1])
      }
      allClasses.push(classes)
    }

    // 如果每个元素都有 class
    if (allClasses.every((c) => c.length > 0)) {
      // 尝试生成 :not(:is(.excluded)) 模式
      // 假设我们要排除某些 class

      // 或者生成 :is(.a, .b, .c) 模式
      const flatClasses = [...new Set(allClasses.flat())]
      if (flatClasses.length <= 5) {
        const tagMatch = lastParts[0].match(/^([a-z]+)/)
        const tag = tagMatch ? tagMatch[1] : ''
        const isContent = flatClasses.map((c) => '.' + c).join(', ')
        return parent + ' > ' + tag + ':is(' + isContent + ')'
      }
    }
  }

  return null
}

/**
 * 尝试共同属性值合并
 */
function tryCommonAttrMerge(selectors) {
  // 提取所有属性
  const attrPattern = /\[([a-zA-Z_-][a-zA-Z0-9_-]*)="([^"]+)"\]/g
  const allAttrs = []

  for (const sel of selectors) {
    const attrs = new Map()
    let match
    attrPattern.lastIndex = 0
    while ((match = attrPattern.exec(sel)) !== null) {
      attrs.set(match[1], match[2])
    }
    allAttrs.push(attrs)
  }

  if (allAttrs.length === 0 || allAttrs.some((a) => a.size === 0)) {return null}

  // 找出共同的属性
  const firstAttrs = allAttrs[0]
  for (const [name, value] of firstAttrs) {
    const allHave = allAttrs.every((attrs) => attrs.get(name) === value)
    if (allHave) {
      const tagMatch = selectors[0].match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : ''
      return tag + '[' + name + '="' + value + '"]'
    }
  }

  return null
}

/**
 * 尝试路径优化
 * 找到最短的唯一路径
 */
function tryPathOptimization(selectors) {
  // 解析所有选择器的路径
  const paths = selectors.map((s) => s.split(/\s*>\s*/))

  // 尝试从后向前缩短路径
  for (let startFromEnd = 1; startFromEnd <= 3; startFromEnd++) {
    const shortened = paths.map((p) => p.slice(-startFromEnd).join(' > '))
    const unique = [...new Set(shortened)]

    // 如果缩短后仍然唯一
    if (unique.length === 1) {
      return unique[0]
    }

    // 如果缩短后可以用 :is() 合并
    if (unique.length <= 5 && unique.every((u) => u.length < 50)) {
      return ':is(' + unique.join(', ') + ')'
    }
  }

  // 尝试移除中间层级
  if (paths.every((p) => p.length >= 3)) {
    const skipMiddle = paths.map((p) => [p[0], p[p.length - 1]].join(' > '))
    const unique = [...new Set(skipMiddle)]

    if (unique.length === 1) {
      return unique[0]
    }
  }

  return null
}

/**
 * 尝试模糊匹配合并
 * 使用更宽松的匹配规则
 */
function tryFuzzyMerge(selectors) {
  // 提取所有 tag
  const tagPattern = /^([a-z]+)/
  const tags = selectors.map((s) => {
    const match = s.match(tagPattern)
    return match ? match[1] : ''
  })

  const uniqueTags = [...new Set(tags)]

  // 如果所有选择器都有相同的 tag
  if (uniqueTags.length === 1 && uniqueTags[0]) {
    const tag = uniqueTags[0]

    // 提取所有 class
    const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
    const allClasses = []

    for (const sel of selectors) {
      const classes = []
      let match
      classPattern.lastIndex = 0
      while ((match = classPattern.exec(sel)) !== null) {
        classes.push(match[1])
      }
      allClasses.push(new Set(classes))
    }

    // 找出至少在一个选择器中出现的 class
    const anyClass = new Set()
    for (const classSet of allClasses) {
      for (const cls of classSet) {
        anyClass.add(cls)
      }
    }

    // 检查是否大多数选择器都有这些 class
    const commonThreshold = Math.ceil(selectors.length * 0.7)
    const commonClasses = [...anyClass].filter(
      (cls) => allClasses.filter((set) => set.has(cls)).length >= commonThreshold
    )

    if (commonClasses.length > 0) {
      return tag + '.' + commonClasses[0]
    }
  }

  return null
}

/**
 * 尝试高级合并模式
 */
function tryAdvancedMerge(remainders, commonPrefix) {
  // 检查是否都是简单的 tag 或 tag.class 形式
  const simplePattern = /^[a-z]+(\.[a-zA-Z_-][a-zA-Z0-9_-]*)?$/
  if (!remainders.every((r) => simplePattern.test(r))) {return null}

  // 提取 tags 和 classes
  const tags = new Set()
  const classes = new Set()
  for (const r of remainders) {
    const match = r.match(/^([a-z]+)(?:\.([a-zA-Z_-][a-zA-Z0-9_-]*))?$/)
    if (match) {
      tags.add(match[1])
      if (match[2]) {classes.add(match[2])}
    }
  }

  // 如果都是同一个 tag，且有共同 class
  if (tags.size === 1 && classes.size === 1) {
    const tag = [...tags][0]
    const cls = [...classes][0]
    return commonPrefix.join(' > ') + ' > ' + tag + '.' + cls
  }

  // 如果都是同一个 tag，使用 :is() 合并不同 class
  if (tags.size === 1 && classes.size > 1) {
    const tag = [...tags][0]
    const classList = [...classes]
    if (classList.length <= 5) {
      const isContent = classList.map((c) => '.' + c).join(', ')
      return commonPrefix.join(' > ') + ' > ' + tag + ':is(' + isContent + ')'
    }
  }

  // 如果有多个 tag 但有共同 class
  if (classes.size === 1 && tags.size > 1 && tags.size <= 5) {
    const cls = [...classes][0]
    const tagList = [...tags]
    return (
      commonPrefix.join(' > ') + ' > ' + ':is(' + tagList.map((t) => t + '.' + cls).join(', ') + ')'
    )
  }

  return null
}

/**
 * 尝试 :not() 排除模式（用于剩余部分）
 */
function tryNotMergeForRemainders(remainders, commonPrefix) {
  // 提取所有 nth-child 信息
  const nthPattern = /:nth-child\((\d+)\)/
  const nthIndices = []
  const baseParts = []

  for (const r of remainders) {
    const match = r.match(nthPattern)
    if (match) {
      nthIndices.push(parseInt(match[1], 10))
      // 提取基础部分（不含 nth-child）
      baseParts.push(r.replace(nthPattern, ''))
    }
  }

  // 如果能提取到 nth-child 信息
  if (nthIndices.length === remainders.length && nthIndices.length >= 2) {
    // 检查基础部分是否相同
    const uniqueBase = [...new Set(baseParts)]
    if (uniqueBase.length === 1) {
      const base = uniqueBase[0]
      const minNth = Math.min(...nthIndices)
      const maxNth = Math.max(...nthIndices)
      const selectedSet = new Set(nthIndices)

      // 找出应该排除的索引
      const excludeIndices = []
      for (let i = minNth; i <= maxNth; i++) {
        if (!selectedSet.has(i)) {
          excludeIndices.push(i)
        }
      }

      // 如果排除的数量少于选中的数量，使用 :not() 模式
      if (excludeIndices.length > 0 && excludeIndices.length < nthIndices.length) {
        const notChain = excludeIndices.map((i) => ':not(:nth-child(' + i + '))').join('')
        return commonPrefix.join(' > ') + ' > ' + base + ':nth-child(n)' + notChain
      }
    }
  }

  return null
}

/**
 * 尝试属性包含选择器合并
 */
function tryAttrContainsMerge(remainders, commonPrefix) {
  // 提取所有 class
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
  const allClasses = []

  for (const r of remainders) {
    const classes = []
    let match
    while ((match = classPattern.exec(r)) !== null) {
      classes.push(match[1])
    }
    allClasses.push(classes)
  }

  // 找出共同 class 子串
  if (allClasses.length > 0 && allClasses.every((c) => c.length > 0)) {
    const firstClasses = allClasses[0]

    for (const cls of firstClasses) {
      // 尝试不同长度的子串
      for (let len = Math.min(cls.length, 8); len >= 3; len--) {
        for (let start = 0; start <= cls.length - len; start++) {
          const substr = cls.substring(start, start + len)

          // 检查是否所有元素都有包含此子串的 class
          const allHave = allClasses.every((classes) => classes.some((c) => c.includes(substr)))

          if (allHave) {
            // 提取 tag
            const tagMatch = remainders[0].match(/^([a-z]+)/)
            const tag = tagMatch ? tagMatch[1] : ''

            const sel = tag + '[class*="' + substr + '"]'
            return commonPrefix.join(' > ') + ' > ' + sel
          }
        }
      }
    }
  }

  return null
}

/**
 * 尝试共同 class 合并
 */
function tryClassMerge(selectors) {
  // 提取所有 class
  const allClasses = []
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g

  for (const sel of selectors) {
    const classes = []
    let match
    while ((match = classPattern.exec(sel)) !== null) {
      classes.push(match[1])
    }
    allClasses.push(new Set(classes))
  }

  // 找出共同 class
  if (allClasses.length === 0) {return null}
  const commonClasses = [...allClasses[0]].filter((cls) => allClasses.every((set) => set.has(cls)))

  if (commonClasses.length > 0) {
    return '.' + commonClasses[0]
  }

  return null
}

/**
 * 尝试 :not() 排除模式
 * 生成类似 .parent > *:not(:nth-child(2)):not(:nth-child(5)) 的选择器
 */
function tryNotMerge(selectors) {
  // 解析选择器结构
  const parsed = selectors.map((sel) => {
    const parts = sel.split(/\s*>\s*/)
    return {
      full: sel,
      parts,
      last: parts[parts.length - 1],
    }
  })

  // 检查是否有共同父级
  if (parsed.length < 2) {return null}

  // 找出共同父级路径
  const firstParts = parsed[0].parts.slice(0, -1)
  const commonParent = firstParts.join(' > ')

  // 检查所有选择器是否共享相同父级
  const sameParent = parsed.every((p) => p.parts.slice(0, -1).join(' > ') === commonParent)

  if (!sameParent) {return null}

  // 提取最后的 nth-child 信息
  const lastParts = parsed.map((p) => p.last)
  const nthPattern = /:nth-child\((\d+)\)/

  const nthIndices = []
  for (const part of lastParts) {
    const match = part.match(nthPattern)
    if (match) {
      nthIndices.push(parseInt(match[1], 10))
    }
  }

  // 如果能提取到 nth-child 信息，生成 :not() 模式
  if (nthIndices.length === selectors.length && nthIndices.length >= 2) {
    const minNth = Math.min(...nthIndices)
    const maxNth = Math.max(...nthIndices)
    const selectedSet = new Set(nthIndices)

    const excludeIndices = []
    for (let i = minNth; i <= maxNth; i++) {
      if (!selectedSet.has(i)) {
        excludeIndices.push(i)
      }
    }

    if (excludeIndices.length > 0 && excludeIndices.length < nthIndices.length) {
      const notChain = excludeIndices.map((i) => ':not(:nth-child(' + i + '))').join('')
      const tagMatch = lastParts[0].match(/^([a-z]+)/)
      const tag = tagMatch ? tagMatch[1] : '*'

      return commonParent + ' > ' + tag + ':nth-child(n)' + notChain
    }
  }

  // 尝试 :not(.class) 模式
  const notClassMerged = tryNotClassMerge(parsed, commonParent, lastParts)
  if (notClassMerged) {return notClassMerged}

  return null
}

/**
 * 尝试 :not(.class) 排除模式
 */
function tryNotClassMerge(parsed, commonParent, lastParts) {
  // 提取选中元素的 class
  const selectedClasses = new Set()
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g

  for (const part of lastParts) {
    let match
    while ((match = classPattern.exec(part)) !== null) {
      selectedClasses.add(match[1])
    }
  }

  // 如果选中的元素有共同 class，尝试排除其他 class
  if (selectedClasses.size > 0 && selectedClasses.size <= 3) {
    const commonCls = [...selectedClasses][0]
    const tagMatch = lastParts[0].match(/^([a-z]+)/)
    const tag = tagMatch ? tagMatch[1] : '*'

    // 生成选择器
    return commonParent + ' > ' + tag + '.' + commonCls
  }

  return null
}

/**
 * 尝试兄弟选择器合并
 */
function trySiblingMerge(selectors) {
  // 检查选择器是否可以表示为兄弟关系
  const siblingPatterns = []

  for (const sel of selectors) {
    // 检查是否有 + 或 ~ 兄弟选择器
    if (sel.includes(' + ') || sel.includes(' ~ ')) {
      siblingPatterns.push(sel)
    }
  }

  // 如果所有选择器都是兄弟选择器
  if (siblingPatterns.length === selectors.length) {
    // 提取前驱元素
    const predecessors = []
    for (const sel of selectors) {
      const parts = sel.split(/\s*\+\s*|\s*~\s*/)
      if (parts.length >= 2) {
        predecessors.push(parts[0])
      }
    }

    // 如果前驱元素相同
    const uniquePred = [...new Set(predecessors)]
    if (uniquePred.length === 1) {
      // 生成 prev + * 或 prev ~ * 模式
      return uniquePred[0] + ' + *'
    }
  }

  return null
}

/**
 * 尝试 :has() 选择器合并
 */
function tryHasMerge(selectors) {
  // 检查选择器是否可以表示为 :has() 模式
  // 例如：parent:has(> child1), parent:has(> child2) -> parent:has(> :is(child1, child2))

  const hasPattern = /(.+):has\((.+)\)/
  const hasMatches = selectors.map((s) => s.match(hasPattern)).filter(Boolean)

  if (hasMatches.length === selectors.length) {
    // 提取父级和子级
    const parents = [...new Set(hasMatches.map((m) => m[1]))]
    const children = hasMatches.map((m) => m[2])

    if (parents.length === 1) {
      // 合并子级
      const mergedChildren = ':is(' + children.join(', ') + ')'
      return parents[0] + ':has(' + mergedChildren + ')'
    }
  }

  return null
}

/**
 * 尝试共同祖先合并
 */
function tryAncestorMerge(selectors) {
  // 解析所有选择器的路径
  const paths = selectors.map((s) => s.split(/\s*>\s*/))

  // 找出共同祖先（路径前缀）
  const commonAncestor = []
  const minLen = Math.min(...paths.map((p) => p.length - 1)) // 不包括最后一个

  for (let i = 0; i < minLen; i++) {
    const part = paths[0][i]
    // 检查是否所有路径都有相同的前缀部分（忽略 nth-child 差异）
    const normalizedPart = part.replace(/:nth-child\(\d+\)/g, '')
    const allMatch = paths.every((p) => {
      const normalized = p[i].replace(/:nth-child\(\d+\)/g, '')
      return normalized === normalizedPart
    })

    if (allMatch) {
      commonAncestor.push(part)
    } else {
      break
    }
  }

  if (commonAncestor.length > 0) {
    // 获取各选择器的最后部分
    const lastParts = paths.map((p) => p[p.length - 1])

    // 尝试用 :is() 合并最后部分
    const uniqueLast = [...new Set(lastParts)]
    if (uniqueLast.length <= 5) {
      const ancestor = commonAncestor.join(' > ')
      const descendants = ':is(' + uniqueLast.join(', ') + ')'
      return ancestor + ' > ' + descendants
    }
  }

  return null
}

/**
 * 尝试全局属性包含选择器合并
 */
function tryAttrContainsMergeGlobal(selectors) {
  // 提取所有 class
  const classPattern = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g
  const allClasses = []

  for (const sel of selectors) {
    const classes = []
    let match
    classPattern.lastIndex = 0 // 重置正则
    while ((match = classPattern.exec(sel)) !== null) {
      classes.push(match[1])
    }
    if (classes.length > 0) {
      allClasses.push(classes)
    }
  }

  if (allClasses.length === 0) {return null}

  // 找出共同 class 子串
  const firstClasses = allClasses[0]

  for (const cls of firstClasses) {
    for (let len = Math.min(cls.length, 8); len >= 3; len--) {
      for (let start = 0; start <= cls.length - len; start++) {
        const substr = cls.substring(start, start + len)

        const allHave = allClasses.every((classes) => classes.some((c) => c.includes(substr)))

        if (allHave) {
          return '[class*="' + substr + '"]'
        }
      }
    }
  }

  return null
}

/**
 * 更新合并选择器显示
 */
function updateMergedSelector(selector) {
  if (!mergedSelectorDisplay) {return}

  if (!selector) {
    mergedSelectorDisplay.innerHTML = '<code>-</code>'
    return
  }

  // 截断过长的选择器
  const displaySelector = selector.length > 200 ? selector.substring(0, 200) + '...' : selector
  mergedSelectorDisplay.innerHTML = `<code>${escapeHtml(displaySelector)}</code>`
}

/**
 * 高亮元素
 */
function highlightElement(id) {
  const element = selectedElements.find((el) => el.id === id)
  if (!element) {return}

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
  `

  chrome.devtools.inspectedWindow.eval(script, (result, error) => {
    if (error || !result || !result.success) {
      showToast('高亮失败', true)
    }
  })
}

/**
 * 复制所有选择器
 */
function copyAllSelectors() {
  if (selectedElements.length === 0) {
    showToast('没有选中元素', true)
    return
  }

  const text = selectedElements.map((el) => el.selector).join('\n')
  copyToClipboard(text)
}

/**
 * 复制合并选择器
 */
function copyMergedSelector() {
  const selector = generateMergedSelector()
  if (!selector) {
    showToast('没有可复制的选择器', true)
    return
  }
  copyToClipboard(selector)
}

/**
 * 导出选择器
 */
function exportSelectors() {
  if (selectedElements.length === 0) {
    showToast('没有选中元素', true)
    return
  }

  const data = {
    timestamp: new Date().toISOString(),
    count: selectedElements.length,
    elements: selectedElements.map((el) => ({
      selector: el.selector,
      tag: el.tag,
    })),
    mergedSelector: generateMergedSelector(),
  }

  const text = JSON.stringify(data, null, 2)
  copyToClipboard(text)
  showToast('已导出 JSON 格式')
}

/**
 * 优化合并选择器
 */
function optimizeMergedSelector() {
  const selector = generateMergedSelector()
  if (!selector) {
    showToast('没有可优化的选择器', true)
    return
  }

  // 调用 AI 优化
  currentSelector = selector
  cssSelectorEl.textContent = selector
  cssSelectorEl.classList.remove('empty')
  aiOptimizeSelector()
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
  console.log('[Sidebar] 收到 runtime 消息:', message.type, message)

  if (message.type === 'batch-selection-update') {
    if (message.selectors && Array.isArray(message.selectors)) {
      console.log('[Sidebar] 处理批量选择更新, 数量:', message.selectors.length)
      message.selectors.forEach((item) => {
        addSelectedElement(item.selector, item.tag)
      })
    }
    sendResponse({ success: true })
  }

  if (message.type === 'element-picker-selection') {
    // 从元素选择器接收选择
    if (message.selector) {
      console.log('[Sidebar] 添加单个元素选择:', message.selector)
      addSelectedElement(message.selector, message.tag || 'div')
    }
    sendResponse({ success: true })
  }

  return true // 保持消息通道开放
})

// 初始化面板
updateSelectedElementsPanel()
console.log('[Sidebar] 选中元素面板已初始化')

// ========== 备用方案：通过 storage 同步选中元素 ==========
// 当 port 连接不稳定时使用

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pendingPickedElement) {
    const element = changes.pendingPickedElement.newValue
    if (element && element.selector) {
      console.log('[Sidebar] 从 storage 收到元素选择:', element.selector)
      addSelectedElement(element.selector, element.tagName || 'div')
    }
  }
})

// 页面加载时检查是否有待处理的元素
chrome.storage.local.get(['pendingPickedElement'], (result) => {
  if (result.pendingPickedElement) {
    const element = result.pendingPickedElement
    // 只处理最近 5 秒内的元素
    if (element.timestamp && Date.now() - element.timestamp < 5000) {
      console.log('[Sidebar] 恢复待处理元素:', element.selector)
      addSelectedElement(element.selector, element.tagName || 'div')
    }
    // 清除
    chrome.storage.local.remove('pendingPickedElement')
  }
})

// ========== 调试功能：添加测试选择 ==========
// 在控制台可以使用 window.testAddSelector() 测试
window.testAddSelector = function (selector, tag) {
  addSelectedElement(selector || 'div.test', tag || 'div')
}

// 监听元素选择变化，自动添加到批量选择列表
// 当在 DevTools Elements 面板选择元素时，按住 Alt 键可添加到批量列表
document.addEventListener('keydown', (e) => {
  if (e.altKey && currentSelector) {
    addSelectedElement(currentSelector, 'div')
  }
})

// ========== 性能优化: 虚拟滚动 ==========
// 当选中大量元素时，使用虚拟滚动提升性能

/**
 * 简易虚拟滚动实现
 */
class VirtualScroller {
  constructor(container, itemHeight = 24) {
    this.container = container
    this.itemHeight = itemHeight
    this.items = []
    this.visibleStart = 0
    this.visibleEnd = 0
    this.scrollTop = 0

    if (this.container) {
      this.container.addEventListener('scroll', () => this.onScroll())
    }
  }

  setItems(items) {
    this.items = items
    this.update()
  }

  onScroll() {
    const newScrollTop = this.container.scrollTop
    if (Math.abs(newScrollTop - this.scrollTop) > this.itemHeight) {
      this.scrollTop = newScrollTop
      this.update()
    }
  }

  update() {
    if (!this.container || this.items.length === 0) {return}

    const containerHeight = this.container.clientHeight
    const visibleCount = Math.ceil(containerHeight / this.itemHeight) + 2

    this.visibleStart = Math.floor(this.scrollTop / this.itemHeight)
    this.visibleEnd = Math.min(this.visibleStart + visibleCount, this.items.length)

    this.render()
  }

  render() {
    const fragment = document.createDocumentFragment()
    const offsetY = this.visibleStart * this.itemHeight

    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const item = this.items[i]
      if (item && item.element) {
        item.element.style.transform = `translateY(${offsetY}px)`
        fragment.appendChild(item.element)
      }
    }

    // 保留滚动空间
    const spacer = document.createElement('div')
    spacer.style.height = `${this.items.length * this.itemHeight}px`
    fragment.appendChild(spacer)

    this.container.innerHTML = ''
    this.container.appendChild(fragment)
  }
}

// ========== 智能推荐增强 ==========

/**
 * 基于选中模式推荐更优选择器
 */
function recommendBetterSelector(selectedElements) {
  if (!selectedElements || selectedElements.length === 0) {return null}

  const recommendations = []

  // 分析选中元素的模式
  const patterns = analyzeSelectionPatterns(selectedElements)

  // 推荐1: 如果选中了多个同级元素，推荐使用 :nth-child 范围
  if (patterns.areSiblings && patterns.areConsecutive) {
    recommendations.push({
      type: '范围选择器',
      selector: `${patterns.tagName}:nth-child(n+${patterns.startIndex}):nth-child(-n+${patterns.endIndex})`,
      reason: '选中的是连续的兄弟元素，使用范围选择器更简洁',
      score: 85,
    })
  }

  // 推荐2: 如果选中了奇数/偶数位置的元素
  if (patterns.isOddPattern) {
    recommendations.push({
      type: '奇偶选择器',
      selector: `${patterns.tagName}:nth-child(odd)`,
      reason: '选中的元素都位于奇数位置',
      score: 80,
    })
  } else if (patterns.isEvenPattern) {
    recommendations.push({
      type: '奇偶选择器',
      selector: `${patterns.tagName}:nth-child(even)`,
      reason: '选中的元素都位于偶数位置',
      score: 80,
    })
  }

  // 推荐3: 如果有共同的父级 class
  if (patterns.commonParentClass) {
    recommendations.push({
      type: '父级限定选择器',
      selector: `.${patterns.commonParentClass} > ${patterns.tagName}`,
      reason: '选中元素有共同的父级容器',
      score: 75,
    })
  }

  return recommendations.length > 0 ? recommendations : null
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
    commonParentClass: null,
  }

  if (elements.length < 2) {return result}

  // 检查是否同级
  const parents = new Set(elements.map((el) => el.parentElement))
  result.areSiblings = parents.size === 1

  if (result.areSiblings) {
    const parent = elements[0].parentElement
    const children = Array.from(parent.children)
    const indices = elements.map((el) => children.indexOf(el) + 1).sort((a, b) => a - b)

    result.tagName = elements[0].tagName?.toLowerCase() || ''
    result.startIndex = indices[0]
    result.endIndex = indices[indices.length - 1]

    // 检查是否连续
    result.areConsecutive = indices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1)

    // 检查奇偶模式
    result.isOddPattern = indices.every((i) => i % 2 === 1)
    result.isEvenPattern = indices.every((i) => i % 2 === 0)

    // 检查共同父级 class
    const parentClasses = parent.className?.split(' ') || []
    result.commonParentClass =
      parentClasses.find((c) => c && !/^(css-|styled-|sc-|js-|_)/.test(c)) || null
  }

  return result
}

/**
 * 检测选择器潜在问题
 */
function detectSelectorIssues(selector) {
  const issues = []

  if (!selector) {return issues}

  // 检查过于具体的选择器
  const parts = selector.split(/\s*>\s*|\s+/)
  if (parts.length > 5) {
    issues.push({
      type: 'warning',
      message: '选择器层级过深，可能脆弱',
      suggestion: '考虑使用更短的选择器或添加有意义的 class',
    })
  }

  // 检查使用了自动生成的 class
  if (/(css-|styled-|sc-|js-|_)[a-z0-9]+/i.test(selector)) {
    issues.push({
      type: 'warning',
      message: '使用了自动生成的 class，可能不稳定',
      suggestion: '优先使用语义化的 class 或 data 属性',
    })
  }

  // 检查使用了位置选择器
  if (/:nth-child\(\d+\)/.test(selector)) {
    issues.push({
      type: 'info',
      message: '使用了位置选择器，DOM 结构变化时可能失效',
      suggestion: '如果可能，使用更稳定的属性选择器',
    })
  }

  // 检查通配符
  if (selector.includes('*')) {
    issues.push({
      type: 'warning',
      message: '使用了通配符，可能影响性能',
      suggestion: '尽量使用具体的标签名替代通配符',
    })
  }

  return issues
}

// 导出功能供外部调用
window.SidebarUtils = {
  testSelector,
  highlightMatches,
  executeBatchAction,
  recommendBetterSelector,
  detectSelectorIssues,
  applyTheme,
}
