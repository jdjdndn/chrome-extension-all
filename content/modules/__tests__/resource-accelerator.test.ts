import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceAccelerator } from './resource-accelerator';

// Mock chrome storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

beforeEach(() => {
  vi.stubGlobal('chrome', { storage: mockStorage });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResourceAccelerator', () => {
  it('should initialize with default config', () => {
    const instance = new ResourceAccelerator();
    expect(instance.config.enabled).toBe(true);
    expect(instance.config.jsReplace).toBe(true);
    expect(instance.config.fontReplace).toBe(true);
    expect(instance.config.cssReplace).toBe(true);
    expect(instance.config.imageLazyLoad).toBe(true);
    expect(instance.config.imageCompress).toBe(true);
    expect(instance.config.imageQuality).toBe(0.8);
    expect(instance.config.imageMinSize).toBe(51200);
    expect(instance.config.lazyLoadThreshold).toBe(200);
    expect(instance.config.preloadEnabled).toBe(true);
    expect(instance.config.dedupEnabled).toBe(true);
    expect(instance.config.excludeDomains).toEqual([]);
    expect(instance.config.excludeUrls).toEqual([]);
    expect(instance.config.cacheEnabled).toBe(true);
  });

  it('should override default config with provided options', () => {
    const customOptions = {
      enabled: false,
      jsReplace: false,
      imageQuality: 0.5,
      excludeDomains: ['test.com'],
    };
    const instance = new ResourceAccelerator(customOptions);
    expect(instance.config.enabled).toBe(false);
    expect(instance.config.jsReplace).toBe(false);
    expect(instance.config.imageQuality).toBe(0.5);
    expect(instance.config.excludeDomains).toEqual(['test.com']);
    // Defaults should still be present for non-overridden properties
    expect(instance.config.fontReplace).toBe(true);
  });

  it('should initialize with an empty cache structure', () => {
    const instance = new ResourceAccelerator();
    expect(instance.cache).toEqual({
      js: {},
      fonts: {},
      timestamp: expect.any(Number),
      lastSaved: 0,
    });
  });

  it('should initialize with an empty stats structure', () => {
    const instance = new ResourceAccelerator();
    expect(instance.stats).toEqual({
      js: { total: 0, replaced: 0, cached: 0, errors: 0 },
      fonts: { total: 0, replaced: 0, cached: 0, errors: 0 },
      css: { total: 0, replaced: 0, cached: 0, errors: 0 },
      images: { lazyLoaded: 0, compressed: 0, skipped: 0 },
      preload: { preloaded: 0, prefetched: 0 },
      dedup: { scripts: 0, styles: 0, removed: 0 },
    });
  });

  it('should initialize with an empty cumulative stats structure', () => {
    const instance = new ResourceAccelerator();
    expect(instance._cumulativeStats).toEqual({
      totalJsReplaced: 0,
      totalFontsReplaced: 0,
      totalCssReplaced: 0,
      totalImagesOptimized: 0,
      totalDedupRemoved: 0,
    });
  });

  it('should log initialization complete to the console', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const instance = new ResourceAccelerator();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ResourceAccelerator] 模块初始化完成'
    );
  });
});