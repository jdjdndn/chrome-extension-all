import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to re-require or re-import for each test since the module
// uses an IIFE that assigns to window.ResourcePreloader

const MODULE_PATH = '../content/modules/resource-preloader.js';

describe('ResourcePreloader', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (window as any).ResourcePreloader;
    delete (window as any).CDNMappings;
  });

  function loadModule() {
    // The module is an IIFE, so importing it executes it.
    // We need to use vi.resetModules to re-execute the IIFE for each test
    vi.resetModules();
    return import(MODULE_PATH);
  }

  it('should assign ResourcePreloader to window', async () => {
    await loadModule();
    expect((window as any).ResourcePreloader).toBeDefined();
  });

  it('should skip initialization if ResourcePreloader already exists', async () => {
    const logSpy = vi.spyOn(console, 'log');
    (window as any).ResourcePreloader = {};
    await loadModule();
    // The IIFE should return early and log
    expect(logSpy).toHaveBeenCalledWith(
      '[ResourcePreloader] 已存在，跳过初始化'
    );
    logSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should set default options', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      expect(instance.enabled).toBe(true);
      expect(instance.preloadJS).toBe(true);
      expect(instance.preloadCSS).toBe(true);
      expect(instance.preloadFonts).toBe(true);
      expect(instance.preloadImages).toBe(false);
      expect(instance.maxPreloads).toBe(10);
      expect(instance.excludePatterns).toEqual([]);
    });

    it('should accept custom options', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({
        enabled: false,
        preloadJS: false,
        preloadCSS: false,
        preloadFonts: false,
        preloadImages: true,
        maxPreloads: 5,
        excludePatterns: ['/test/']
      });
      expect(instance.enabled).toBe(false);
      expect(instance.preloadJS).toBe(false);
      expect(instance.preloadCSS).toBe(false);
      expect(instance.preloadFonts).toBe(false);
      expect(instance.preloadImages).toBe(true);
      expect(instance.maxPreloads).toBe(5);
      expect(instance.excludePatterns).toEqual(['/test/']);
    });

    it('should initialize stats correctly', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      expect(instance.stats).toEqual({
        preloaded: 0,
        prefetched: 0,
        skipped: 0,
        details: []
      });
    });
  });

  describe('init()', () => {
    it('should not process resources if disabled', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ enabled: false });
      const logSpy = vi.spyOn(console, 'log');
      instance.init();
      expect(logSpy).toHaveBeenCalledWith(
        '[ResourcePreloader] 模块已禁用'
      );
      logSpy.mockRestore();
    });

    it('should process resources if enabled', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ enabled: true });
      const logSpy = vi.spyOn(console, 'log');
      instance.init();
      expect(logSpy).toHaveBeenCalledWith(
        '[ResourcePreloader] 初始化完成'
      );
      logSpy.mockRestore();
    });
  });

  describe('_preconnectCDNs', () => {
    it('should add dns-prefetch and preconnect links for valid CDNs', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      
      (window as any).CDNMappings = {
        CDN_SOURCES: [
          { id: 'bootcdn', baseUrl: 'https://cdn.bootcdn.net/test/' }
        ]
      };

      instance.init();

      const dnsPrefetch = document.querySelector('link[rel="dns-prefetch"]');
      expect(dnsPrefetch).toBeDefined();
      expect(dnsPrefetch?.getAttribute('href')).toBe('https://cdn.bootcdn.net');

      const preconnect = document.querySelector('link[rel="preconnect"]');
      expect(preconnect).toBeDefined();
      expect(preconnect?.getAttribute('href')).toBe('https://cdn.bootcdn.net');
    });

    it('should handle invalid URLs gracefully', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      
      (window as any).CDNMappings = {
        CDN_SOURCES: [
          { id: 'invalid-cdn', baseUrl: 'not-a-valid-url' }
        ]
      };

      expect(() => instance.init()).not.toThrow();
      const dnsPrefetch = document.querySelector('link[rel="dns-prefetch"]');
      expect(dnsPrefetch).toBeNull();
    });

    it('should not add preconnect for non-priority CDNs', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      
      (window as any).CDNMappings = {
        CDN_SOURCES: [
          { id: 'unimportant-cdn', baseUrl: 'https://cdn.example.com' }
        ]
      };

      instance.init();

      const dnsPrefetch = document.querySelector('link[rel="dns-prefetch"]');
      expect(dnsPrefetch).toBeDefined();
      
      const preconnect = document.querySelector('link[rel="preconnect"]');
      expect(preconnect).toBeNull();
    });

    it('should do nothing if window.CDNMappings is not defined', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader();
      
      expect(() => instance.init()).not.toThrow();
      const links = document.querySelectorAll('link');
      expect(links.length).toBe(0);
    });
  });

  describe('_processExistingResources', () => {
    it('should preload critical JS scripts if preloadJS is true', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ preloadJS: true });
      
      instance._isCritical = vi.fn().mockReturnValue(true);
      
      const script = document.createElement('script');
      script.src = 'https://example.com/critical.js';
      document.head.appendChild(script);
      
      instance.init();
      
      expect(instance._isCritical).toHaveBeenCalledWith(
        'https://example.com/critical.js',
        'js'
      );
    });

    it('should not preload JS scripts if preloadJS is false', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ preloadJS: false });
      
      instance._isCritical = vi.fn().mockReturnValue(true);
      
      const script = document.createElement('script');
      script.src = 'https://example.com/critical.js';
      document.head.appendChild(script);
      
      instance.init();
      
      expect(instance._isCritical).not.toHaveBeenCalled();
    });

    it('should preload critical CSS links if preloadCSS is true', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ preloadCSS: true });
      
      instance._isCritical = vi.fn().mockReturnValue(true);
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/critical.css';
      document.head.appendChild(link);
      
      instance.init();
      
      expect(instance._isCritical).toHaveBeenCalledWith(
        'https://example.com/critical.css',
        'css'
      );
    });

    it('should not preload CSS links if preloadCSS is false', async () => {
      await loadModule();
      const ResourcePreloader = (window as any).ResourcePreloader;
      const instance = new ResourcePreloader({ preloadCSS: false });
      
      instance._isCritical = vi.fn().mockReturnValue(true);
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/critical.css';
      document.head.appendChild(link);
      
      instance.init();
      
      expect(instance._isCritical).not.toHaveBeenCalled();
    });
  });
});