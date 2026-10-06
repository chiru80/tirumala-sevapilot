// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { saveSettings, getSettings } from '../../src/storage/repository';
import { getLanguage, setLanguage, t } from '../../src/i18n/index';
import { bootstrapPopup } from '../../src/popup/index';

const storageMap = new Map<string, any>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: any) => {
        if (typeof key === 'string') {
          return { [key]: storageMap.get(key) };
        }
        if (Array.isArray(key)) {
          const res: Record<string, any> = {};
          for (const k of key) res[k] = storageMap.get(k);
          return res;
        }
        return Object.fromEntries(storageMap.entries());
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      }),
      remove: vi.fn(async (key: string) => storageMap.delete(key)),
      clear: vi.fn(async () => storageMap.clear()),
    },
  },
  tabs: {
    query: vi.fn(async () => [{
      id: 202,
      url: 'https://ttdevasthanams.ap.gov.in/darshan/entry',
      title: 'TTD Special Entry Darshan',
    }]),
  },
  runtime: {
    sendMessage: vi.fn(async () => ({ success: true, data: { mappedFields: [] } })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

describe('Popup Language Initialization & Persistence', () => {
  beforeEach(() => {
    storageMap.clear();
    cleanup();
    document.body.innerHTML = '<div id="root"></div>';
    setLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes popup in Telugu when saved setting is Telugu', async () => {
    await saveSettings({ language: 'te' });

    await bootstrapPopup();

    expect(getLanguage()).toBe('te');
    // Verify Telugu translation key for popup title is used
    expect(t('popup.title')).toBe('TTD సేవాపైలట్');
  });

  it('retains saved language across bootstrap invocations', async () => {
    await saveSettings({ language: 'hi' });
    await bootstrapPopup();
    expect(getLanguage()).toBe('hi');

    await saveSettings({ language: 'ta' });
    await bootstrapPopup();
    expect(getLanguage()).toBe('ta');

    await saveSettings({ language: 'kn' });
    await bootstrapPopup();
    expect(getLanguage()).toBe('kn');
  });

  it('falls back safely to English when saved language is invalid or unset', async () => {
    await saveSettings({ language: 'unsupported-lang' as any });
    setLanguage('en');
    await bootstrapPopup();
    expect(getLanguage()).toBe('en');
  });
});
