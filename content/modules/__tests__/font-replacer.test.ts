import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FontReplacer', () => {
  let FontReplacer: any;
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Mock window.CDNMappings
    window.CDNMappings = {
      matchFont: vi.fn()
    };

    // Dynamically import the module
    const module = await import('./font-replacer.js');
    FontReplacer = module.default || module.FontReplacer;
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const replacer = new FontReplacer();
      expect(replacer.enabled).toBe(true);
      expect(replacer.excludePatterns).toEqual([]);
      expect(replacer.reportEnabled).toBe(true);
      expect(replacer.stats).toEqual({
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        details: []
      });
    });

    it('should accept custom options', () => {
      const replacer = new FontReplacer({
        enabled: false,
        excludePatterns: ['example.com'],
        reportEnabled: false
      });
      expect(replacer.enabled).toBe(false);
      expect(replacer.excludePatterns).toEqual(['example.com']);
      expect(replacer.reportEnabled).toBe(false);
    });

    it('should handle empty options object', () => {
      const replacer = new FontReplacer({});
      expect(replacer.enabled).toBe(true);
    });
  });

  describe('init', () => {
    it('should not process links when disabled', () => {
      const replacer = new FontReplacer({ enabled: false });
      const processSpy = vi.spyOn(replacer, '_processExistingLinks');
      replacer.init();
      expect(processSpy).not.toHaveBeenCalled();
    });

    it('should process existing links and setup observer when enabled', () => {
      const replacer = new FontReplacer();
      const processSpy = vi.spyOn(replacer, '_processExistingLinks');
      const observerSpy = vi.spyOn(replacer, '_setupMutationObserver');
      replacer.init();
      expect(processSpy).toHaveBeenCalled();
      expect(observerSpy).toHaveBeenCalled();
    });
  });

  describe('processLink', () => {
    it('should skip processing when disabled', () => {
      const replacer = new FontReplacer({ enabled: false });
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/test';
      replacer.processLink(link);
      expect(replacer.stats.total).toBe(0);
    });

    it('should skip links without href', () => {
      const replacer = new FontReplacer();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      replacer.processLink(link);
      expect(replacer.stats.total).toBe(0);
    });

    it('should skip already processed links', () => {
      const replacer = new FontReplacer();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/test';
      
      replacer.processLink(link);
      replacer.processLink(link);
      
      expect(replacer.stats.total).toBe(1);
    });

    it('should skip URLs matching exclude patterns', () => {
      const replacer = new FontReplacer({
        excludePatterns: ['excluded.com']
      });
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://excluded.com/font';
      
      replacer.processLink(link);
      expect(replacer.stats.skipped).toBe(1);
    });

    it('should skip if no CDN match found', () => {
      const replacer = new FontReplacer();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unknown.com/font';
      
      (window.CDNMatchers.matchFont as any).mockReturnValue(null);
      
      replacer.processLink(link);
      expect(replacer.stats.skipped).toBe(1);
    });

    it('should replace href when CDN match found', () => {
      const replacer = new FontReplacer();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      const originalUrl = 'https://fonts.googleapis.com/css?family=Roboto';
      link.href = originalUrl;
      
      const mockMatch = {
        name: 'Google Fonts',
        cdnUrl: 'https://fonts.loli.net/css?family=Roboto'
      };
      (window.CDNMatchers.matchFont as any).mockReturnValue(mockMatch);
      
      replacer.processLink(link);
      
      expect(link.href).toBe(mockMatch.cdnUrl);
      expect(replacer.stats.replaced).toBe(1);
      expect(replacer.stats.details).toContainEqual(
        expect.objectContaining({
          original: originalUrl,
          replaced: mockMatch.cdnUrl
        })
      );
    });

    it('should handle errors during replacement', () => {
      const replacer = new FontReplacer();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/test';
      
      // Mock href setter to throw
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLLinkElement.prototype, 'href'
      );
      Object.defineProperty(link, 'href', {
        get: () => originalDescriptor.get.call(link),
        set: () => { throw new Error('Test error'); },
        configurable: true
      });
      
      (window.CDNMatchers.matchFont as any).mockReturnValue({
        cdnUrl: 'https://fonts.loli.net/test'
      });
      
      replacer.processLink(link);
      expect(replacer.stats.errors).toBe(1);
      
      // Restore original descriptor
      Object.defineProperty(HTMLLinkElement.prototype, 'href', originalDescriptor);
    });
  });

  describe('_processExistingLinks', () => {
    it('should process all existing stylesheet links', () => {
      const link1 = document.createElement('link');
      link1.rel = 'stylesheet';
      link1.href = 'https://fonts.googleapis.com/css1';
      
      const link2 = document.createElement('link');
      link2.rel = 'stylesheet';
      link2.href = 'https://fonts.googleapis.com/css2';
      
      document.head.appendChild(link1);
      document.head.appendChild(link2);
      
      const replacer = new FontReplacer();
      const processSpy = vi.spyOn(replacer, 'processLink');
      replacer._processExistingLinks();
      
      expect(processSpy).toHaveBeenCalledTimes(2);
      
      link1.remove();
      link2.remove();
    });
  });

  describe('_setupMutationObserver', () => {
    it('should process dynamically added link elements', async () => {
      const replacer = new FontReplacer();
      replacer.init();
      
      const processSpy = vi.spyOn(replacer, 'processLink');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/dynamic';
      
      document.head.appendChild(link);
      
      // Wait for mutation observer to trigger
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(processSpy).toHaveBeenCalledWith(link);
      
      link.remove();
    });
  });

  describe('reporting', () => {
    it('should report replacement when reportEnabled is true', () => {
      const replacer = new FontReplacer({ reportEnabled: true });
      const reportSpy = vi.spyOn(replacer, 'reportReplacement');
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/test';
      
      (window.CDNMatchers.matchFont as any).mockReturnValue({
        cdnUrl: 'https://fonts.loli.net/test'
      });
      
      replacer.processLink(link);
      expect(reportSpy).toHaveBeenCalled();
    });

    it('should not report replacement when reportEnabled is false', () => {
      const replacer = new FontReplacer({ reportEnabled: false });
      const reportSpy = vi.spyOn(replacer, 'reportReplacement');
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/test';
      
      (window.CDNMatchers.matchFont as any).mockReturnValue({
        cdnUrl: 'https://fonts.loli.net/test'
      });
      
      replacer.processLink(link);
      expect(reportSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should disconnect observer on destroy', () => {
      const replacer = new FontReplacer();
      replacer.init();
      
      const disconnectSpy = vi.spyOn(replacer._observer, 'disconnect');
      replacer.destroy();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});