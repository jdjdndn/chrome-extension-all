import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 模拟 DOM 环境
describe('StyleInjector', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  describe('createStyleInjector', () => {
    it('should create an injector with inject method', async () => {
      const { createStyleInjector } = await import('../content/utils/style-injector.js');
      const injector = createStyleInjector('test-style');

      expect(injector.inject).toBeDefined();
      expect(injector.remove).toBeDefined();
      expect(injector.update).toBeDefined();
      expect(injector.getElement).toBeDefined();
    });

    it('should inject CSS into document', async () => {
      const { createStyleInjector } = await import('../content/utils/style-injector.js');
      const injector = createStyleInjector('test-style-1');

      injector.inject('.test { color: red; }');

      const styleEl = document.getElementById('test-style-1');
      expect(styleEl).not.toBeNull();
      expect(styleEl.textContent).toBe('.test { color: red; }');
    });

    it('should remove existing style before injecting', async () => {
      const { createStyleInjector } = await import('../content/utils/style-injector.js');
      const injector = createStyleInjector('test-style-2');

      injector.inject('.first { color: blue; }');
      injector.inject('.second { color: green; }');

      const styleEl = document.getElementById('test-style-2');
      expect(styleEl.textContent).toBe('.second { color: green; }');
    });

    it('should remove style element', async () => {
      const { createStyleInjector } = await import('../content/utils/style-injector.js');
      const injector = createStyleInjector('test-style-3');

      injector.inject('.test { color: red; }');
      expect(document.getElementById('test-style-3')).not.toBeNull();

      injector.remove();
      expect(document.getElementById('test-style-3')).toBeNull();
    });

    it('should not inject empty CSS', async () => {
      const { createStyleInjector } = await import('../content/utils/style-injector.js');
      const injector = createStyleInjector('test-style-4');

      const result = injector.inject('');
      expect(result).toBeNull();
      expect(document.getElementById('test-style-4')).toBeNull();
    });
  });

  describe('generateHideCSS', () => {
    it('should generate hide CSS for selectors', async () => {
      const { generateHideCSS } = await import('../content/utils/style-injector.js');
      const css = generateHideCSS(['.ad', '#popup']);

      expect(css).toContain('.ad { display: none !important; }');
      expect(css).toContain('#popup { display: none !important; }');
    });
  });
});
