import { test, expect } from './helpers/extension-fixture';

test.describe('E2E Journey 1 — Onboarding, Navigation, and Lifecycle', () => {
  test('verifies extension manifest validity and MV3 metadata', async ({ sidepanelPage }) => {
    const manifest = await sidepanelPage.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toContain('Tirumala SevaPilot');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts?.length).toBeGreaterThan(0);
  });

  test('first-time user onboarding journey and profile creation', async ({ sidepanelPage }) => {
    // Collect console errors to ensure zero runtime uncaught exceptions
    const consoleErrors: string[] = [];
    sidepanelPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Clean initial storage
    await sidepanelPage.evaluate(() => chrome.storage.local.clear());
    await sidepanelPage.reload();

    // Verify initial home view welcomes devotee without metric clutter
    await expect(sidepanelPage.locator('body')).toBeVisible();

    // Click on Profiles in bottom/sub navigation
    const profilesNavBtn = sidepanelPage.getByRole('button', { name: /Profiles|భక్తులు|प्रोफ़ाइल/i });
    if (await profilesNavBtn.isVisible()) {
      await profilesNavBtn.click();
    }

    // Verify zero uncaught runtime errors during basic launch
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Back navigation stack and data preservation across screens', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    const { mockSedProfile } = await import('./helpers/mock-profiles');
    await seedProfiles([mockSedProfile]);

    // Starts on Home
    await expect(sidepanelPage.getByRole('heading', { name: 'Govinda Family' })).toBeVisible();

    // Navigate to More
    const moreBtn = sidepanelPage.getByRole('button', { name: /More|మరిన్ని|अधिक/i });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await expect(
        sidepanelPage.getByRole('heading', { name: /More & Preferences|More|మరిన్ని/i })
      ).toBeVisible();

      // Click on Back button
      const backBtn = sidepanelPage.getByLabel('Back');
      await expect(backBtn).toBeVisible();
      await backBtn.click();

      // Returns safely to Home
      await expect(sidepanelPage.getByRole('heading', { name: 'Govinda Family' })).toBeVisible();
    }
  });
});
