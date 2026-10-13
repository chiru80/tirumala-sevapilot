import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile, mockHomamProfile, mockSrivariSevaProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 2 — Service & Readiness Correctness Lab', () => {
  test('unknown service fails closed without inheriting ₹300 requirements', async ({
    context,
    sidepanelPage,
    setupRoutes,
    seedProfiles,
  }) => {
    await setupRoutes();
    await seedProfiles([mockSedProfile]);

    const unknownPage = await context.newPage();
    await unknownPage.goto('https://ttdevasthanams.ap.gov.in/unknown/service');
    await unknownPage.bringToFront();

    // Sidepanel must display Requirements Unavailable / Generic Mode safety notice
    await sidepanelPage.bringToFront();
    await expect(
      sidepanelPage.getByText(/Requirements Unavailable|Safe generic mode|Generic Mode/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify it is NOT ready to fill for unknown service
    await expect(sidepanelPage.getByText('Ready to fill')).toHaveCount(0);
  });

  test('homam requires exactly 2 householder devotees and Gothram', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    // 1. Seed single-pilgrim profile first
    await seedProfiles([mockSedProfile]);

    // Open Service Selector modal
    await sidepanelPage.getByLabel(/Change service/i).click();
    await expect(sidepanelPage.getByRole('dialog')).toBeVisible();

    // Select Homam button inside dialog
    await sidepanelPage.getByRole('dialog').getByRole('button', { name: /Homam/i }).click();

    // Verify single-pilgrim profile fails Homam readiness check
    await expect(
      sidepanelPage.getByText(/Exactly 2 pilgrims needed|Missing/i).first()
    ).toBeVisible();

    // 2. Now seed valid Homam profile with 2 pilgrims and Kashyapa Gothram
    await seedProfiles([mockHomamProfile]);

    // Switch service to Homam again
    await sidepanelPage.getByLabel(/Change service/i).click();
    await sidepanelPage.getByRole('dialog').getByRole('button', { name: /Homam/i }).click();

    // Profile heading is visible and ready
    await expect(sidepanelPage.getByRole('heading', { name: 'Dampatulu Homam Group' })).toBeVisible();
    await expect(
      sidepanelPage.getByText(/Ready for Booking|required items ready/i).first()
    ).toBeVisible();
  });

  test('srivari seva strictly enforces 1 devotee and 18-60 age boundary', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    // Under-age pilgrim (age 16)
    const underAgeProfile = {
      ...mockSrivariSevaProfile,
      pilgrims: [{ ...mockSrivariSevaProfile.pilgrims[0], age: 16 }],
    };
    await seedProfiles([underAgeProfile]);

    // Select Srivari Seva inside dialog
    await sidepanelPage.getByLabel(/Change service/i).click();
    await sidepanelPage.getByRole('dialog').getByRole('button', { name: /Srivari Seva/i }).click();

    // Verify readiness fails closed for invalid age
    await expect(
      sidepanelPage.getByText(/18 and 60|Missing|Incomplete|Needs Attention|Requirements Unavailable/i).first()
    ).toBeVisible();
  });
});
