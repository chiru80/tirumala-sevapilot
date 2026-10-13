import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile, mockMultiSrivaniProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 9 — Production Readiness, Data Security & Trust', () => {
  test('Settings: Danger Zone provides Devotee Data Purge vs Nuclear Factory Reset', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    const consoleErrors: string[] = [];
    sidepanelPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await seedProfiles([mockSedProfile]);

    // 1. Navigate to More tab
    const moreTabBtn = sidepanelPage.getByRole('button', { name: /More/i });
    await expect(moreTabBtn).toBeVisible();
    await moreTabBtn.click();

    // 2. Open Settings & Speed
    const settingsBtn = sidepanelPage.locator('button', { hasText: /Settings & Speed/i });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // 3. Verify Danger Zone dual erasure buttons exist
    const purgeBtn = sidepanelPage.locator('#sp-settings-purge-devotees-btn');
    const nuclearBtn = sidepanelPage.locator('#sp-settings-nuclear-wipe-btn');

    await expect(purgeBtn).toBeVisible();
    await expect(nuclearBtn).toBeVisible();

    // 4. Click Purge Profiles and verify confirmation prompt
    await purgeBtn.click();

    const confirmPurgeBtn = sidepanelPage.locator('#sp-settings-confirm-purge-btn');
    await expect(confirmPurgeBtn).toBeVisible();

    // Confirm the purge
    await confirmPurgeBtn.click();

    // 5. Verify success feedback is shown
    const purgeStatus = sidepanelPage.locator('#sp-settings-purge-status');
    await expect(purgeStatus).toBeVisible();
    await expect(purgeStatus).toContainText(/Devotee profiles purged successfully/i);

    // Verify zero uncaught errors
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Backup: displays prominent unencrypted JSON privacy disclosure', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSedProfile]);

    // 1. Navigate to More tab
    const moreTabBtn = sidepanelPage.getByRole('button', { name: /More/i });
    await expect(moreTabBtn).toBeVisible();
    await moreTabBtn.click();

    // 2. Open Backup & Restore
    const backupBtn = sidepanelPage.locator('button', { hasText: /Backup & Restore/i });
    await expect(backupBtn).toBeVisible();
    await backupBtn.click();

    // 3. Verify AES-GCM encrypted backup is primary
    await expect(
      sidepanelPage.locator('text=Download Encrypted Backup (.spbk)')
    ).toBeVisible();

    // 4. Verify unencrypted JSON privacy warning notice is prominently rendered
    const jsonWarningNotice = sidepanelPage.locator('#sp-backup-json-privacy-notice');
    await expect(jsonWarningNotice).toBeVisible();
    await expect(jsonWarningNotice).toContainText(/Notice: Plain JSON files are unencrypted/i);
  });

  test('Manual-Entry Assistant: multi-devotee pending filter and completion state', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    const consoleErrors: string[] = [];
    sidepanelPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await seedProfiles([mockMultiSrivaniProfile]);

    // 1. Switch service to Srivani
    const changeServiceBtn = sidepanelPage.getByLabel(/Change service/i).first();
    await changeServiceBtn.click();

    const dialog = sidepanelPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const srivaniOption = dialog.getByRole('button', { name: /Srivani/i });
    await expect(srivaniOption).toBeVisible();
    await srivaniOption.click();

    // 2. Open Manual-Entry Assistant
    const manualBtn = sidepanelPage.locator('#sp-booking-open-manual-assistant-btn');
    await expect(manualBtn).toBeVisible();
    await manualBtn.click();

    const assistant = sidepanelPage.locator('#sp-manual-assistant-container');
    await expect(assistant).toBeVisible();

    // Both devotees are visible initially
    await expect(assistant.locator('text=Govinda Rao').first()).toBeVisible();
    await expect(assistant.locator('text=Lakshmi Rao').first()).toBeVisible();

    // 3. Mark first devotee entered (Govinda Rao)
    const checkSv1 = assistant.locator('#sp-manual-check-sv1');
    await checkSv1.click();

    // Progress updates to 1 / 2
    await expect(assistant.locator('text=1 / 2')).toBeVisible();

    // 4. Filter Pending Only button appears when at least one devotee is completed
    const filterBtn = assistant.locator('#sp-manual-filter-pending-btn');
    await expect(filterBtn).toBeVisible();

    // 5. Toggle Pending Only filter
    await filterBtn.click();

    // Govinda Rao card should now be filtered out; Lakshmi Rao remains visible
    await expect(assistant.locator('text=Govinda Rao')).toHaveCount(0);
    await expect(assistant.locator('text=Lakshmi Rao').first()).toBeVisible();

    // 6. Complete Lakshmi Rao
    const checkSv2 = assistant.locator('#sp-manual-check-sv2');
    await checkSv2.click();

    // Progress is now 2 / 2
    await expect(assistant.locator('text=2 / 2')).toBeVisible();

    // Completion banner is rendered
    const completionBanner = assistant.locator('#sp-manual-all-completed-banner');
    await expect(completionBanner).toBeVisible();
    await expect(completionBanner).toContainText(/ALL DEVOTEES ENTERED/i);

    // Verify zero uncaught errors
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});
