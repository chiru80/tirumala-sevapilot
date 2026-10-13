import { test, expect } from './helpers/extension-fixture';
import path from 'path';

const MOCK_PROFILE = {
  id: 'profile-family-1',
  name: 'Tirupati Pilgrimage Family',
  isDefault: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  pilgrims: [
    {
      id: 'p-1',
      name: 'Venkata Raman',
      age: 48,
      gender: 'MALE',
      photoIdType: 'AADHAAR',
      photoIdNumber: '987654321012',
      isPrimary: true,
    },
    {
      id: 'p-2',
      name: 'Padmavathi Amma',
      age: 45,
      gender: 'FEMALE',
      photoIdType: 'AADHAAR',
      photoIdNumber: '876543210987',
      isPrimary: false,
    },
    {
      id: 'p-3',
      name: 'Srinivasa Rao',
      age: 22,
      gender: 'MALE',
      photoIdType: 'AADHAAR',
      photoIdNumber: '765432109876',
      isPrimary: false,
    },
  ],
};

test.describe('Capture Actual UI Screenshots for Evidence', () => {
  test('Capture sidepanel views at 380x640', async ({ sidepanelPage, seedProfiles }) => {
    // Standard side-panel viewport
    await sidepanelPage.setViewportSize({ width: 380, height: 640 });

    // Seed realistic profile
    await seedProfiles([MOCK_PROFILE]);

    const artifactsDir = 'C:/Users/HP/.gemini/antigravity-ide/brain/432c7db7-331b-4bbc-aee3-5eb8dacee3d2';

    // 1. Home Dashboard View
    await sidepanelPage.waitForSelector('header');
    await sidepanelPage.waitForTimeout(1000);
    await sidepanelPage.screenshot({
      path: path.join(artifactsDir, 'sidepanel_redesign_home.png'),
      fullPage: false,
    });

    // 1b. Home Scrolled Down View (Upcoming Releases)
    await sidepanelPage.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 1000;
    });
    await sidepanelPage.waitForTimeout(500);
    await sidepanelPage.screenshot({
      path: path.join(artifactsDir, 'sidepanel_redesign_home_bottom.png'),
      fullPage: false,
    });

    // 1c. Home Scrolled Down View (Quick Actions & Privacy)
    await sidepanelPage.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 2500;
    });
    await sidepanelPage.waitForTimeout(500);
    await sidepanelPage.screenshot({
      path: path.join(artifactsDir, 'sidepanel_redesign_home_quickactions.png'),
      fullPage: false,
    });

    // 2. Profiles View
    const profilesNavBtn = sidepanelPage.locator('button', { hasText: 'Profiles' }).last();
    if (await profilesNavBtn.isVisible()) {
      await profilesNavBtn.click();
      await sidepanelPage.waitForTimeout(800);
      await sidepanelPage.screenshot({
        path: path.join(artifactsDir, 'sidepanel_redesign_profiles.png'),
        fullPage: false,
      });
    }

    // 3. More View
    const moreNavBtn = sidepanelPage.locator('button', { hasText: 'More' }).last();
    if (await moreNavBtn.isVisible()) {
      await moreNavBtn.click();
      await sidepanelPage.waitForTimeout(800);
      await sidepanelPage.screenshot({
        path: path.join(artifactsDir, 'sidepanel_redesign_more.png'),
        fullPage: false,
      });
    }

    // 4. Settings View
    const settingsBtn = sidepanelPage.locator('button', { hasText: 'Settings' }).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await sidepanelPage.waitForTimeout(800);
      await sidepanelPage.screenshot({
        path: path.join(artifactsDir, 'sidepanel_redesign_settings.png'),
        fullPage: false,
      });
    }
  });
});
