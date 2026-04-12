/**
 * StyleInjector - 样式注入管理器
 * 统一的样式注入和移除机制
 */

'use strict';

/**
 * 创建样式注入器
 * @param {string} styleId - 样式元素ID
 * @returns {{ inject: function, remove: function, update: function }}
 */
export function createStyleInjector(styleId) {
  let styleElement = null;

  return {
    /**
     * 注入CSS样式
     * @param {string} css - CSS内容
     * @returns {HTMLStyleElement}
     */
    inject(css) {
      if (!css || !css.trim()) {
        return null;
      }

      // 移除已存在的样式
      this.remove();

      // 创建新样式元素
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = css;
      (document.head || document.documentElement).appendChild(styleElement);

      return styleElement;
    },

    /**
     * 移除样式
     */
    remove() {
      const existing = document.getElementById(styleId);
      if (existing) {
        existing.remove();
      }
      styleElement = null;
    },

    /**
     * 更新样式内容
     * @param {string} css - 新的CSS内容
     */
    update(css) {
      if (styleElement) {
        styleElement.textContent = css;
      } else {
        this.inject(css);
      }
    },

    /**
     * 获取当前样式元素
     * @returns {HTMLStyleElement|null}
     */
    getElement() {
      return styleElement || document.getElementById(styleId);
    }
  };
}

/**
 * 生成隐藏元素的CSS
 * @param {string[]} selectors - CSS选择器数组
 * @returns {string} CSS字符串
 */
export function generateHideCSS(selectors) {
  return selectors
    .filter(s => s && s.trim())
    .map(selector => `${selector} { display: none !important; }`)
    .join('\n');
}

/**
 * 快捷方法：应用隐藏样式
 * @param {string} styleId - 样式ID
 * @param {string[]} selectors - 选择器数组
 */
export function applyHideStyle(styleId, selectors) {
  const injector = createStyleInjector(styleId);
  if (!selectors || selectors.length === 0) {
    injector.remove();
    return;
  }
  injector.inject(generateHideCSS(selectors));
}

const StyleInjector = {
  create: createStyleInjector,
  generateHideCSS,
  applyHideStyle
};

export default StyleInjector;

// 全局暴露
if (typeof window !== 'undefined' && !window.StyleInjector) {
  window.StyleInjector = StyleInjector;
  console.log('[StyleInjector] 模块已加载');
}
