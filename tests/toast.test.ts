import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Toast', () => {
  beforeEach(async () => {
    // 确保有body和head
    if (!document.body) {
      const body = document.createElement('body');
      document.documentElement.appendChild(body);
    }
    if (!document.head) {
      const head = document.createElement('head');
      document.documentElement.insertBefore(head, document.body);
    }
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.useRealTimers();

    // 重新导入模块以重置状态
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('toast', () => {
    it('should show toast message', async () => {
      const { toast } = await import('../content/utils/toast.js');

      const result = toast('Test message', { duration: 1000 });

      expect(result.id).toBeDefined();
      expect(result.close).toBeDefined();

      const toastEl = document.querySelector('.toast-item');
      expect(toastEl).not.toBeNull();
      expect(toastEl?.textContent).toBe('Test message');

      result.close();
    });

    it('should show different types of toast', async () => {
      const { toastSuccess, toastError, toastWarning, toastInfo } = await import('../content/utils/toast.js');

      toastSuccess('Success');
      toastError('Error');
      toastWarning('Warning');
      toastInfo('Info');

      const toasts = document.querySelectorAll('.toast-item');
      expect(toasts.length).toBe(4);
    });

    it('should close all toasts', async () => {
      const { toast, closeAllToasts } = await import('../content/utils/toast.js');

      toast('Message 1', { duration: 0 });
      toast('Message 2', { duration: 0 });
      toast('Message 3', { duration: 0 });

      expect(document.querySelectorAll('.toast-item').length).toBe(3);

      closeAllToasts();

      expect(document.querySelectorAll('.toast-item').length).toBe(0);
    });
  });
});
