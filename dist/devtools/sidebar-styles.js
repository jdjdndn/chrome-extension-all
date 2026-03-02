// Sidebar Styles panel logic
'use strict';

const cssSelectorEl = document.getElementById('css-selector');
const pathBreadcrumbsEl = document.getElementById('path-breadcrumbs');
const stylesContainer = document.getElementById('styles-container');
const refreshBtn = document.getElementById('refresh-btn');
const computedBtn = document.getElementById('computed-btn');
const toastEl = document.getElementById('toast');
const selectorStatusEl = document.getElementById('selector-status');

let showComputed = false;
let currentSelector = '';

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
  if (showComputed) {
    getComputedStyles();
  } else {
    getElementInfo();
  }
});

// Initial load
getElementInfo();
