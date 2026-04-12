import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScriptGuard', () => {
  beforeEach(() => {
    // 清理全局状态
    vi.stubGlobal('window', {});
  });

  describe('createScriptGuard', () => {
    it('should create a guard with check method', async () => {
      const { createScriptGuard } = await import('../content/utils/script-guard.js');
      const guard = createScriptGuard('test');

      expect(guard.check).toBeDefined();
      expect(guard.markInitialized).toBeDefined();
      expect(guard.isInitialized).toBeDefined();
    });

    it('should return true on second check', async () => {
      const { createScriptGuard } = await import('../content/utils/script-guard.js');
      const guard = createScriptGuard('unique-test');

      const firstCheck = guard.check();
      const secondCheck = guard.check();

      expect(firstCheck).toBe(false);
      expect(secondCheck).toBe(true);
    });

    it('should track initialization state', async () => {
      const { createScriptGuard } = await import('../content/utils/script-guard.js');
      const guard = createScriptGuard('init-test');

      expect(guard.isInitialized()).toBe(false);

      guard.markInitialized();

      expect(guard.isInitialized()).toBe(true);
    });
  });
});
