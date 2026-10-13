// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Navigation } from '../../src/sidepanel/components/Navigation';
import { More } from '../../src/sidepanel/pages/More';
import { setLanguage, type Language } from '../../src/i18n';

describe('UI Untranslated Keys Detection Suite', () => {
  const languages: Language[] = ['en', 'te', 'hi', 'ta', 'kn'];

  beforeEach(() => {
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    };
  });

  afterEach(() => {
    cleanup();
    setLanguage('en');
  });

  // Regex detecting unlocalized dot-notation keys like "nav.more", "dashboard.scanPage", "settings.title"
  const rawKeyRegex = /\b(nav|dashboard|common|settings|profiles|more|backup|validation|documents|readiness|bookingWorkflow|manualEntry)\.[a-zA-Z0-9_-]+\b/;

  it('renders bottom Navigation in all 5 languages without any untranslated dot-keys', () => {
    for (const lang of languages) {
      setLanguage(lang);
      const { container, unmount } = render(
        <Navigation currentPage="dashboard" onNavigate={vi.fn()} />
      );

      const text = container.textContent || '';
      expect(rawKeyRegex.test(text), `Found raw translation key in Navigation (${lang}): "${text}"`).toBe(false);

      // Explicitly check nav.more is not visible
      expect(text).not.toContain('nav.more');
      expect(text).not.toContain('nav.home');
      expect(text).not.toContain('nav.profiles');

      unmount();
    }
  });

  it('renders More hub screen in all 5 languages without any untranslated dot-keys', () => {
    for (const lang of languages) {
      setLanguage(lang);
      const { container, unmount } = render(
        <More onNavigate={vi.fn()} />
      );

      const text = container.textContent || '';
      expect(rawKeyRegex.test(text), `Found raw translation key in More page (${lang}): "${text}"`).toBe(false);

      unmount();
    }
  });

  it('audits all rendered DOM node text for any pattern matching key.subkey format', () => {
    for (const lang of languages) {
      setLanguage(lang);
      const { container, unmount } = render(
        <Navigation currentPage="more" onNavigate={vi.fn()} />
      );

      // Walk all text nodes
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let currentNode = walker.nextNode();
      while (currentNode) {
        const val = currentNode.nodeValue?.trim() || '';
        if (val.length > 0) {
          expect(rawKeyRegex.test(val), `Text node contains raw key "${val}" in lang "${lang}"`).toBe(false);
        }
        currentNode = walker.nextNode();
      }

      unmount();
    }
  });
});
