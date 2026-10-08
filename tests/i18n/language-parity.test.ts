// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 11 Language Parity
// Verifies 100% exact key parity, completeness, and placeholder
// preservation across English, Telugu, Hindi, Tamil, and Kannada.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getDeepKeysAndValues(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sub = getDeepKeysAndValues(value as Record<string, unknown>, fullKey);
      sub.forEach((v, k) => map.set(k, v));
    } else if (typeof value === 'string') {
      map.set(fullKey, value);
    }
  }
  return map;
}

function extractPlaceholders(str: string): string[] {
  const matches = str.match(/\{[a-zA-Z0-9_]+\}/g);
  return matches ? matches.sort() : [];
}

describe('Phase 11: Internationalization (i18n) Completeness & Exact Parity', () => {
  const locales = ['en', 'te', 'hi', 'ta', 'kn'] as const;
  const localeMaps = new Map<string, Map<string, string>>();

  beforeAll(() => {
    for (const locale of locales) {
      const filePath = path.resolve(__dirname, `../../src/i18n/${locale}/messages.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      localeMaps.set(locale, getDeepKeysAndValues(content));
    }
  });

  it('enforces exact key count parity across all 5 languages', () => {
    const enMap = localeMaps.get('en')!;
    const enCount = enMap.size;
    expect(enCount).toBeGreaterThan(600);

    for (const locale of locales) {
      const curMap = localeMaps.get(locale)!;
      expect(curMap.size).toBe(enCount);
    }
  });

  it('guarantees zero missing keys in any language compared to English', () => {
    const enKeys = Array.from(localeMaps.get('en')!.keys());

    for (const locale of locales) {
      if (locale === 'en') continue;
      const curMap = localeMaps.get(locale)!;
      const missingKeys = enKeys.filter((k) => !curMap.has(k));
      expect(missingKeys, `Missing keys in ${locale}: ${missingKeys.join(', ')}`).toEqual([]);
    }
  });

  it('guarantees zero extra/orphaned keys in any language', () => {
    const enMap = localeMaps.get('en')!;

    for (const locale of locales) {
      if (locale === 'en') continue;
      const curKeys = Array.from(localeMaps.get(locale)!.keys());
      const extraKeys = curKeys.filter((k) => !enMap.has(k));
      expect(extraKeys, `Extra keys in ${locale}: ${extraKeys.join(', ')}`).toEqual([]);
    }
  });

  it('ensures no translation is an empty or whitespace-only string', () => {
    for (const locale of locales) {
      const curMap = localeMaps.get(locale)!;
      for (const [key, val] of curMap.entries()) {
        expect(val.trim().length, `Empty string at ${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('preserves all essential dynamic format placeholders ({count}, {service}, {time}, etc.) in translations', () => {
    const enMap = localeMaps.get('en')!;

    for (const [key, enVal] of enMap.entries()) {
      let enPlaceholders = extractPlaceholders(enVal);
      if (enPlaceholders.length === 0) continue;

      for (const locale of locales) {
        if (locale === 'en') continue;
        const curVal = localeMaps.get(locale)!.get(key)!;
        const curPlaceholders = extractPlaceholders(curVal);

        // In Indian languages (te, hi, ta, kn), grammatical plural markers are encoded in noun suffixes
        // rather than separate English {plural} tokens.
        const expected = enPlaceholders.filter((p) => p !== '{plural}' || curPlaceholders.includes('{plural}'));

        expect(
          curPlaceholders,
          `Placeholder mismatch in ${locale} for key '${key}'. Expected ${expected.join(', ')} but got ${curPlaceholders.join(', ')}`,
        ).toEqual(expected);
      }
    }
  });
});
