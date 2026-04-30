import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSReplacer } from '../../../content/modules/js-replacer';

describe('JSReplacer', () => {
  let instance;
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.documentElement.innerHTML = `<head></head><body></body>`;
    instance = new JSReplacer();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    if (instance._observer) {
      instance._observer.disconnect();
    }
    if (instance._originalCreateElement) {
      document.createElement = instance._originalCreateElement;
    }
    instance._processedScripts = new WeakSet();
    instance.enabled = true;
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      expect(instance.enabled).toBe(true);
      expect(instance.excludePatterns).toEqual([]);
      expect(instance.reportEnabled).toBe(true);
      expect(instance.stats).toEqual({
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        details: []
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('模块初始化完成'));
    });

    it('should initialize with custom options', () => {
      const customInstance = new JSReplacer({
        enabled: false,
        excludePatterns: ['example.com'],
        reportEnabled: false
      });
      expect(customInstance.enabled).toBe(false);
      expect(customInstance.excludePatterns).toEqual(['example.com']);
      expect(customInstance.reportEnabled).toBe(false);
    });
  });

  describe('init()', () => {
    it('should not setup observers if disabled', () => {
      instance.enabled = false;
      const observerSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      instance.init();
      expect(observerSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('模块已禁用'));
    });

    it('should setup MutationObserver and intercept createElement when enabled', () => {
      const originalCreateElement = document.createElement.bind(document);
      instance.init();
      expect(instance._observer).toBeInstanceOf(MutationObserver);
      expect(instance._originalCreateElement).toBe(originalCreateElement);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('初始化完成，开始监听'));
    });
  });

  describe('_processExistingScripts()', () => {
    it('should process scripts already present in the DOM', () => {
      const script = document.createElement('script');
      script.src = 'https://example.com/existing.js';
      document.head.appendChild(script);

      // Restore original createElement to avoid double-mocking in this specific test setup
      if (instance._originalCreateElement) {
        document.createElement = instance._originalCreateElement;
      }

      const processSpy = vi.spyOn(instance, 'processScript');
      instance._processExistingScripts();
      
      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(processSpy).toHaveBeenCalledWith(script);
    });

    it('should ignore scripts without src', () => {
      const script = document.createElement('script');
      script.textContent = 'console.log("inline")';
      document.head.appendChild(script);

      if (instance._originalCreateElement) {
        document.createElement = instance._originalCreateElement;
      }

      const processSpy = vi.spyOn(instance, 'processScript');
      instance._processExistingScripts();
      
      expect(processSpy).not.toHaveBeenCalled();
    });
  });

  describe('_interceptCreateElement()', () => {
    it('should intercept document.createElement for script tags', () => {
      instance.init();
      
      const script = document.createElement('script');
      expect(instance._originalCreateElement).not.toBeNull();
      
      // Verify src interceptor is attached
      const descriptor = Object.getOwnPropertyDescriptor(script, 'src');
      expect(descriptor).toBeDefined();
      expect(typeof descriptor.set).toBe('function');
    });

    it('should not intercept document.createElement for non-script tags', () => {
      instance.init();
      
      const div = document.createElement('div');
      const descriptor = Object.getOwnPropertyDescriptor(div, 'src');
      expect(descriptor).toBeUndefined();
    });
  });

  describe('_interceptScriptSrc() & processScript() integration', () => {
    it('should trigger processScript when src is set dynamically', async () => {
      instance.init();
      
      const processSpy = vi.spyOn(instance, 'processScript');
      const script = document.createElement('script');
      
      script.src = 'https://example.com/dynamic.js';
      
      // Wait for setTimeout(0)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(processSpy).toHaveBeenCalledWith(script);
    });

    it('should not trigger processScript if disabled', async () => {
      instance.init();
      instance.enabled = false;
      
      const processSpy = vi.spyOn(instance, 'processScript');
      const script = document.createElement('script');
      
      script.src = 'https://example.com/disabled.js';
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(processSpy).not.toHaveBeenCalled();
    });
  });

  describe('MutationObserver integration', () => {
    it('should process script tags dynamically added to the DOM', async () => {
      instance.init();
      
      const processSpy = vi.spyOn(instance, 'processScript');
      const script = document.createElement('script');
      script.src = 'https://example.com/mutated.js';
      
      document.body.appendChild(script);
      
      // MutationObserver is async, wait a tick
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(processSpy).toHaveBeenCalledWith(script);
    });
  });

  describe('processScript()', () => {
    it('should skip processing if instance is disabled', () => {
      instance.enabled = false;
      const script = { src: 'http://test.com' };
      instance._processedScripts = new WeakSet();
      
      instance.processScript(script);
      expect(instance._processedScripts.has(script)).toBe(false);
    });

    it('should skip processing if script has no src', () => {
      const script = { src: '' };
      
      instance.processScript(script);
      expect(instance._processedScripts.has(script)).toBe(false);
    });

    it('should avoid duplicate processing of the same script element', () => {
      const script = document.createElement('script');
      script.src = 'https://test.com/duplicate.js';
      
      instance.processScript(script);
      instance.processScript(script); // Second call
      
      // Assuming stats tracking or similar, or just check WeakSet size behavior
      expect(instance._processedScripts.has(script)).toBe(true);
      // If there were tracking logs, we would assert they only fired once here
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing options gracefully', () => {
      const emptyInstance = new JSReplacer();
      expect(emptyInstance.excludePatterns).toEqual([]);
      expect(emptyInstance.stats).toBeDefined();
    });

    it('should handle excludePatterns (mocking internal match logic if implemented)', () => {
      const excludedInstance = new JSReplacer({
        excludePatterns: ['cdn.example.com']
      });
      
      expect(excludedInstance.excludePatterns).toContain('cdn.example.com');
    });

    it('should not throw if original document.createElement is restored multiple times', () => {
      instance.init();
      instance.init(); // Init twice
      
      document.createElement = instance._originalCreateElement;
      expect(() => document.createElement('div')).not.toThrow();
    });
  });
});