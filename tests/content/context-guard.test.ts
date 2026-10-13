import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isExtensionContextValid,
  safeSendMessage,
  safeStorageGet,
  safeStorageSet,
  onContextInvalidated,
  teardownOrphanedContentScript,
} from '../../src/content/context-guard';

describe('Extension Context Invalidation Guard', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).chrome = originalChrome;
  });

  describe('isExtensionContextValid', () => {
    it('returns true when chrome.runtime.id is present and accessible', () => {
      (globalThis as any).chrome = {
        runtime: { id: 'test-extension-id' },
      };
      expect(isExtensionContextValid()).toBe(true);
    });

    it('returns true when chrome is undefined (allowing non-extension test environments)', () => {
      (globalThis as any).chrome = undefined;
      expect(isExtensionContextValid()).toBe(true);
    });

    it('returns false when chrome.runtime is undefined', () => {
      (globalThis as any).chrome = {};
      expect(isExtensionContextValid()).toBe(false);
    });

    it('returns false when chrome.runtime.id is undefined (orphaned context)', () => {
      (globalThis as any).chrome = {
        runtime: {},
      };
      expect(isExtensionContextValid()).toBe(false);
    });

    it('returns false when accessing chrome.runtime throws "Extension context invalidated"', () => {
      (globalThis as any).chrome = {
        get runtime() {
          throw new Error('Extension context invalidated.');
        },
      };
      expect(isExtensionContextValid()).toBe(false);
    });
  });

  describe('safeSendMessage', () => {
    it('sends message and returns result when context is valid', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true, data: 'ok' });
      (globalThis as any).chrome = {
        runtime: {
          id: 'valid-id',
          sendMessage: mockSendMessage,
        },
      };

      const result = await safeSendMessage({ type: 'TEST_MSG' });
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'TEST_MSG' });
      expect(result).toEqual({ success: true, data: 'ok' });
    });

    it('returns null and does not throw when context is invalid', async () => {
      (globalThis as any).chrome = {
        runtime: {},
      };

      const result = await safeSendMessage({ type: 'TEST_MSG' });
      expect(result).toBeNull();
    });

    it('handles synchronous throw of "Extension context invalidated" gracefully', async () => {
      (globalThis as any).chrome = {
        runtime: {
          id: 'valid-id',
          sendMessage: () => {
            throw new Error('Extension context invalidated.');
          },
        },
      };

      const teardownSpy = vi.fn();
      const unregister = onContextInvalidated(teardownSpy);

      const result = await safeSendMessage({ type: 'TEST_MSG' });
      expect(result).toBeNull();
      expect(teardownSpy).toHaveBeenCalled();

      unregister();
    });

    it('handles promise rejection of "Extension context invalidated" gracefully', async () => {
      (globalThis as any).chrome = {
        runtime: {
          id: 'valid-id',
          sendMessage: () => Promise.reject(new Error('Extension context invalidated.')),
        },
      };

      const result = await safeSendMessage({ type: 'TEST_MSG' });
      expect(result).toBeNull();
    });
  });

  describe('safeStorageGet and safeStorageSet', () => {
    it('reads storage when context is valid', async () => {
      const mockGet = vi.fn().mockResolvedValue({ test_key: 'test_val' });
      (globalThis as any).chrome = {
        runtime: { id: 'valid-id' },
        storage: { local: { get: mockGet } },
      };

      const res = await safeStorageGet('test_key');
      expect(res).toEqual({ test_key: 'test_val' });
    });

    it('returns empty object and does not throw when context is invalid during get', async () => {
      (globalThis as any).chrome = {
        runtime: {},
        storage: { local: { get: vi.fn() } },
      };

      const res = await safeStorageGet('test_key');
      expect(res).toEqual({});
    });

    it('writes storage when context is valid', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).chrome = {
        runtime: { id: 'valid-id' },
        storage: { local: { set: mockSet } },
      };

      await safeStorageSet({ test_key: 'new_val' });
      expect(mockSet).toHaveBeenCalledWith({ test_key: 'new_val' });
    });

    it('does not throw when storage.local.set throws context invalidated error', async () => {
      (globalThis as any).chrome = {
        runtime: { id: 'valid-id' },
        storage: {
          local: {
            set: () => {
              throw new Error('Extension context invalidated.');
            },
          },
        },
      };

      await expect(safeStorageSet({ test_key: 'val' })).resolves.not.toThrow();
    });
  });

  describe('teardown lifecycle', () => {
    it('executes registered teardown callbacks on teardownOrphanedContentScript', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      onContextInvalidated(cleanup1);
      onContextInvalidated(cleanup2);

      teardownOrphanedContentScript();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it('unregisters callback properly', () => {
      const cleanup = vi.fn();
      const unregister = onContextInvalidated(cleanup);

      unregister();
      teardownOrphanedContentScript();

      expect(cleanup).not.toHaveBeenCalled();
    });
  });
});
