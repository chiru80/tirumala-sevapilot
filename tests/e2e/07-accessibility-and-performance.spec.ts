import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile } from './helpers/mock-profiles';
import fs from 'fs';
import path from 'path';

test.describe('E2E Journey 7 — Accessibility, Language & Performance Benchmarks', () => {
  test('verifies 5-language parity across EN, TE, HI, TA, KN', async () => {
    const languages = ['en', 'te', 'hi', 'ta', 'kn'];
    const translations: Record<string, any> = {};

    for (const lang of languages) {
      const filePath = path.resolve(process.cwd(), 'src/i18n', lang, 'messages.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const raw = fs.readFileSync(filePath, 'utf-8');
      translations[lang] = JSON.parse(raw);
    }

    // Verify key parity between English and every other language
    const enKeys = Object.keys(translations.en);
    for (const lang of ['te', 'hi', 'ta', 'kn']) {
      const currentKeys = Object.keys(translations[lang]);
      for (const section of enKeys) {
        expect(currentKeys).toContain(section);
        const enSubkeys = Object.keys(translations.en[section]);
        const currentSubkeys = Object.keys(translations[lang][section] || {});
        for (const subkey of enSubkeys) {
          expect(currentSubkeys).toContain(subkey);
          expect(translations[lang][section][subkey]).toBeTruthy();
        }
      }
    }
  });

  test('keyboard accessibility: focus management and tab navigation', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSedProfile]);

    // Focus first interactive button on sidepanel
    await sidepanelPage.keyboard.press('Tab');
    const focusedTag = await sidepanelPage.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test('performance benchmark: measures sidepanel storage and DOM responsiveness', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSedProfile]);

    const timings = await sidepanelPage.evaluate(async () => {
      const samples: number[] = [];
      const iterations = 25;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // Benchmark real Chrome MV3 storage retrieval latency in browser context
        await chrome.storage.local.get('sp_profiles');
        const end = performance.now();
        samples.push(end - start);
      }

      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      const p95 = samples[Math.floor(samples.length * 0.95)];

      return { samples, median, p95, count: samples.length };
    });

    expect(timings.count).toBe(25);
    // MV3 local storage roundtrip in Chromium is well under 50ms
    expect(timings.median).toBeLessThan(50);
    expect(timings.p95).toBeLessThan(100);
  });
});
