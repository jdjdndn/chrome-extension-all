/**
 * DOM 工具模块类型定义
 */

export interface DOMUtils {
  getCurrentDomain(): string | null;
  upsertStyle(id: string, css: string): HTMLStyleElement | null;
  removeStyle(id: string): boolean;
  generateHideCSS(selectors: string[]): string;
  applyHideStyle(styleId: string, selectors: string[]): void;
  waitForElement(selector: string, timeout?: number, parent?: Element | Document): Promise<Element | null>;
  waitForElements(selectors: string[], timeout?: number): Promise<Element[]>;
  createDebouncedObserver(callback: () => void, debounceMs?: number): MutationObserver;
  debounce<T extends (...args: any[]) => any>(func: T, delay?: number): T;
  throttle<T extends (...args: any[]) => any>(func: T, delay?: number): T;
  onBodyReady(callback: () => void): void;
  isElementInViewport(element: Element, options?: ViewportOptions): boolean;
  findOneInViewport(selector: string, options?: ViewportOptions): Element | null;
  findAllInViewport(selector: string, options?: ViewportOptions): Element[];
}

export interface ViewportOptions {
  checkVisibility?: boolean;
  checkDimensions?: boolean;
}

export interface ThrottleState {
  check(): boolean;
  reset(): void;
}

declare global {
  interface Window {
    DOMUtils?: DOMUtils;
    ScriptLoader?: {
      markReady: (name: string) => void;
    };
  }
}
