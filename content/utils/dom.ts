/**
 * DOM 工具模块 (TypeScript版本)
 * 提供 DOM 操作相关的通用功能
 */

'use strict';

/**
 * 视口检查选项
 */
export interface ViewportOptions {
  checkVisibility?: boolean;
  checkDimensions?: boolean;
}

/**
 * 节流状态
 */
export interface ThrottleState {
  check(): boolean;
  reset(): void;
}

/**
 * 获取当前域名
 */
export function getCurrentDomain(): string | null {
  try {
    return window.location.hostname;
  } catch (error) {
    console.error('[DOM] 获取域名失败:', error);
    return null;
  }
}

/**
 * 创建或更新样式标签
 */
export function upsertStyle(id: string, css: string): HTMLStyleElement | null {
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  if (!css || !css.trim()) {
    return null;
  }

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
}

/**
 * 移除样式标签
 */
export function removeStyle(id: string): boolean {
  const style = document.getElementById(id);
  if (style) {
    style.remove();
    return true;
  }
  return false;
}

/**
 * 生成隐藏元素的 CSS
 */
export function generateHideCSS(selectors: string[]): string {
  return selectors
    .filter((s) => s && s.trim())
    .map((selector) => `${selector} { display: none !important; }`)
    .join('\n');
}

/**
 * 应用隐藏元素样式
 */
export function applyHideStyle(styleId: string, selectors: string[]): void {
  if (!selectors || selectors.length === 0) {
    removeStyle(styleId);
    return;
  }

  const css = generateHideCSS(selectors);
  upsertStyle(styleId, css);
  console.log(`[DOM] 已应用隐藏样式，共 ${selectors.length} 个选择器`);
}

/**
 * 等待 DOM 元素出现
 */
export function waitForElement(
  selector: string,
  timeout: number = 10000,
  parent: Element | Document = document
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = parent.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent === document ? document.body : parent, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * 批量等待多个元素
 */
export async function waitForElements(
  selectors: string[],
  timeout: number = 10000
): Promise<Element[]> {
  const results = await Promise.all(
    selectors.map((s) => waitForElement(s, timeout))
  );
  return results.filter(Boolean) as Element[];
}

/**
 * 防抖执行的 DOM 观察器
 */
export function createDebouncedObserver(
  callback: () => void,
  debounceMs: number = 300
): MutationObserver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, debounceMs);
  });
  return observer;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
    return undefined;
  };
}

/**
 * 创建带状态的节流函数
 */
export function createThrottleState(delay: number = 500): ThrottleState {
  let lastExecutionTime = 0;
  return {
    check() {
      const now = Date.now();
      if (now - lastExecutionTime >= delay) {
        lastExecutionTime = now;
        return true;
      }
      return false;
    },
    reset() {
      lastExecutionTime = 0;
    }
  };
}

/**
 * 安全地等待 DOM body 就绪后执行回调
 */
export function onBodyReady(callback: () => void): void {
  if (document.body) {
    callback();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    setTimeout(() => onBodyReady(callback), 50);
  }
}

/**
 * 检查元素是否在视口内
 */
export function isElementInViewport(
  element: Element,
  options: ViewportOptions = {}
): boolean {
  if (!element) return false;

  const { checkVisibility = false, checkDimensions = false } = options;

  try {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    let inViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= windowHeight &&
      rect.right <= windowWidth
    );

    if (inViewport && checkDimensions) {
      inViewport = rect.width > 0 && rect.height > 0;
    }

    if (inViewport && checkVisibility) {
      const style = window.getComputedStyle(element);
      inViewport = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    return inViewport;
  } catch {
    return false;
  }
}

/**
 * 查找视口内唯一匹配的元素
 */
export function findOneInViewport(
  selector: string,
  options: ViewportOptions = {}
): Element | null {
  const elements = [...document.querySelectorAll(selector)].filter(el =>
    isElementInViewport(el, options)
  );
  return elements.length === 1 ? elements[0] : null;
}

/**
 * 查找所有在视口内的元素
 */
export function findAllInViewport(
  selector: string,
  options: ViewportOptions = {}
): Element[] {
  return [...document.querySelectorAll(selector)].filter(el =>
    isElementInViewport(el, options)
  );
}

// 默认导出
const DOMUtils = {
  getCurrentDomain,
  upsertStyle,
  removeStyle,
  generateHideCSS,
  applyHideStyle,
  waitForElement,
  waitForElements,
  createDebouncedObserver,
  debounce,
  throttle,
  createThrottleState,
  onBodyReady,
  isElementInViewport,
  findOneInViewport,
  findAllInViewport,
};

export default DOMUtils;

// 全局暴露
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.DOMUtils) {
    win.DOMUtils = DOMUtils;
    if (win.ScriptLoader) {
      win.ScriptLoader.markReady('DOMUtils');
    }
    console.log('[DOM] DOM工具模块已加载');
  }
}
