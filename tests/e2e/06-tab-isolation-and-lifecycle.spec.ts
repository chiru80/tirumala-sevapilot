import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile, mockHomamProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 6 — Tab Context Isolation & Storage Lifecycle', () => {
  test('sessions and service contexts do not leak across multiple tabs', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();

    // Tab 1: Special Entry Darshan ₹300
    const sedTab = await context.newPage();
    await sedTab.goto('https://ttdevasthanams.ap.gov.in/sed/entry');
    await expect(sedTab.locator('#ttd-sed-container')).toBeVisible();

    // Tab 2: Padmavathi ₹200
    const spatTab = await context.newPage();
    await spatTab.goto('https://ttdevasthanams.ap.gov.in/spat/entry');
    await expect(spatTab.locator('#ttd-spat-container')).toBeVisible();

    // Verify Tab 1 DOM is strictly SED
    await expect(sedTab.locator('h1')).toHaveText(/Special Entry Darshan/i);
    // Verify Tab 2 DOM is strictly SPAT
    await expect(spatTab.locator('h1')).toHaveText(/Padmavathi/i);
  });

  test('storage persistence survives multiple reloads and state queries', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSedProfile, mockHomamProfile]);

    // First load
    let stored = await sidepanelPage.evaluate(() => chrome.storage.local.get('sp_profiles') as Promise<{ sp_profiles: any[] }>);
    expect(stored.sp_profiles).toHaveLength(2);

    // Reload sidepanel
    await sidepanelPage.reload();
    await sidepanelPage.waitForLoadState('domcontentloaded');

    // Second check
    stored = await sidepanelPage.evaluate(() => chrome.storage.local.get('sp_profiles') as Promise<{ sp_profiles: any[] }>);
    expect(stored.sp_profiles).toHaveLength(2);
    expect(stored.sp_profiles[0].name).toBe('Govinda Family');
    expect(stored.sp_profiles[1].name).toBe('Dampatulu Homam Group');
  });
});
