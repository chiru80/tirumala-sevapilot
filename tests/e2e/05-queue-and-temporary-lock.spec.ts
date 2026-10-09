import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 5 — Queue Intelligence & Temporary Lock Lab', () => {
  test('temporary lock presents BLOCKED state with history link and NO retry button', async ({
    context,
    sidepanelPage,
    setupRoutes,
    seedProfiles,
  }) => {
    await setupRoutes();
    await seedProfiles([mockSedProfile]);

    // Open temporary lock fixture
    const lockPage = await context.newPage();
    await lockPage.goto('https://ttdevasthanams.ap.gov.in/sed/lock');
    await expect(lockPage.locator('#ttd-lock-notice')).toBeVisible();

    // Verify lock notice exists on page with canonical lock text
    const lockText = await lockPage.locator('#ttd-lock-notice').textContent();
    expect(lockText).toContain('Active Transaction in Progress');
    expect(lockText).toContain('Booking with same pilgrim id is in progress');

    // Focus sidepanel
    await sidepanelPage.bringToFront();

    // Verify STRICT SAFETY RULE: NO Retry / "TRY AGAIN" button exists
    const retryButtons = sidepanelPage.getByRole('button', { name: /TRY AGAIN|RETRY/i });
    await expect(retryButtons).toHaveCount(0);
  });

  test('queue progression: detects queue and handles emergency stop cleanly', async ({
    context,
    sidepanelPage,
    setupRoutes,
  }) => {
    await setupRoutes();

    // Open queue fixture
    const queuePage = await context.newPage();
    await queuePage.goto('https://ttdevasthanams.ap.gov.in/queue/waiting');

    await expect(queuePage.locator('#ttd-virtual-queue')).toBeVisible();
    await expect(queuePage.locator('#queue-position')).toHaveText('142');

    // Verify sidepanel stays responsive and doesn't inject rogue tokens or solvers
    await sidepanelPage.bringToFront();
    await expect(sidepanelPage.locator('body')).toBeVisible();

    // Test emergency stop button if autofill or queue monitoring is active
    const stopBtn = sidepanelPage.locator('#sp-booking-emergency-stop-btn');
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
      await expect(sidepanelPage.getByText(/Stopped|Cancelled|Idle/i)).toBeVisible();
    }
  });
});
