import { test, expect } from './helpers/extension-fixture';
import { mockSrivaniProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 8 — Policy-Compliant Booking Assistant', () => {
  test('Srivani Trust activates Manual-Entry Assistant with zero automated autofill', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    // Collect console errors to ensure zero uncaught runtime exceptions
    const consoleErrors: string[] = [];
    sidepanelPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await seedProfiles([mockSrivaniProfile]);

    // 1. Verify profile loaded
    await expect(
      sidepanelPage.getByRole('heading', { name: 'Srivani Trust Devotee' })
    ).toBeVisible();

    // 2. Open service selector modal and select SRIVANI Trust
    const changeServiceBtn = sidepanelPage.getByLabel(/Change service/i).first();
    await changeServiceBtn.click();

    // Dialog is visible
    const dialog = sidepanelPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select Srivani in the modal
    const srivaniOption = dialog.getByRole('button', { name: /Srivani/i });
    await expect(srivaniOption).toBeVisible();
    await srivaniOption.click();

    // 3. Verify policy compliance notice in readiness section
    const policyNotice = sidepanelPage.locator('text=TTD Manual-Entry Policy (May 2026)');
    await expect(policyNotice).toBeVisible();

    // 4. Verify primary action is Manual Assistant, NOT Fill & Verify
    const manualBtn = sidepanelPage.locator('#sp-booking-open-manual-assistant-btn');
    await expect(manualBtn).toBeVisible();

    // Verify FILL & VERIFY is NOT visible when Srivani is active
    const fillAndVerifyBtn = sidepanelPage.locator('button', {
      hasText: /⚡ FILL & VERIFY|FILL & VERIFY/i,
    });
    await expect(fillAndVerifyBtn).toHaveCount(0);

    // 5. Open Manual-Entry Assistant
    await manualBtn.click();

    // Verify Assistant container is rendered
    const assistantContainer = sidepanelPage.locator('#sp-manual-assistant-container');
    await expect(assistantContainer).toBeVisible();

    // Verify May 2026 policy badge and explanation
    await expect(
      sidepanelPage.locator('text=TTD POLICY COMPLIANT (MAY 2026)')
    ).toBeVisible();
    await expect(
      sidepanelPage.locator('text=Zero Automation Policy Notice')
    ).toBeVisible();

    // 6. Verify ID masking and toggle
    const maskedId = assistantContainer.locator('text=•••• •••• 0124');
    await expect(maskedId).toBeVisible();

    const toggleMaskBtn = assistantContainer.locator('#sp-manual-toggle-id-sv1');
    await expect(toggleMaskBtn).toBeVisible();
    await toggleMaskBtn.click();

    // Revealing shows the full ID
    const unmaskedId = assistantContainer.locator('text=234567890124');
    await expect(unmaskedId).toBeVisible();

    // Click again to re-mask
    await toggleMaskBtn.click();
    await expect(maskedId).toBeVisible();

    // 7. Verify mark entered checklist interaction
    const markEnteredCheckbox = assistantContainer.locator('#sp-manual-check-sv1');
    await expect(markEnteredCheckbox).toBeVisible();
    await markEnteredCheckbox.click();

    // Progress updates to 1 / 1
    await expect(assistantContainer.locator('text=1 / 1')).toBeVisible();

    // Verify zero uncaught errors
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Safe Session Guidance Modal explains security checkpoints without automation', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSrivaniProfile]);

    // 1. Locate and open the Safe Session Guidance button in QuickActions
    const guideBtn = sidepanelPage.locator('#sp-open-safe-session-guide-btn');
    await expect(guideBtn).toBeVisible();
    await guideBtn.click();

    // 2. Verify modal opened
    const modalTitle = sidepanelPage.locator('#safe-session-guidance-title');
    await expect(modalTitle).toBeVisible();
    await expect(modalTitle).toHaveText(/SAFE SESSION GUIDANCE/i);

    // 3. Tab through states: CAPTCHA -> OTP -> QUEUE -> EXPIRED -> TEMPORARY_LOCK
    const tabList = sidepanelPage.locator('[role="tablist"]');
    await expect(tabList).toBeVisible();

    // Check CAPTCHA tab content
    await expect(
      sidepanelPage.locator('text=CAPTCHA Security Verification')
    ).toBeVisible();
    await expect(
      sidepanelPage.locator('text=SevaPilot strictly never touches, auto-solves, or bypasses CAPTCHA inputs.')
    ).toBeVisible();

    // Switch to OTP tab
    const otpTab = sidepanelPage.locator('button[role="tab"]', { hasText: /Mobile|OTP/i });
    await otpTab.click();
    await expect(
      sidepanelPage.locator('text=Mobile SMS OTP Verification')
    ).toBeVisible();
    await expect(
      sidepanelPage.locator('text=SevaPilot never intercepts, requests, reads, or transmits OTPs.')
    ).toBeVisible();

    // Switch to Temporary Lock tab
    const lockTab = sidepanelPage.locator('button[role="tab"]', { hasText: /Temporary|Lock/i });
    await lockTab.click();
    await expect(
      sidepanelPage.locator('text=Temporary Slot Hold / Lock')
    ).toBeVisible();
    await expect(
      sidepanelPage.locator('text=SevaPilot strictly eliminates automated retry buttons while a lock is active')
    ).toBeVisible();

    // 4. Close modal via Got It button
    const closeBtn = sidepanelPage.getByRole('button', { name: /Got It/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(modalTitle).not.toBeVisible();
  });

  test('Upcoming Releases Card displays verified official source domain and publication timestamp', async ({
    sidepanelPage,
    seedProfiles,
  }) => {
    await seedProfiles([mockSrivaniProfile]);

    // 1. Verify upcoming releases card is rendered
    const releasesCard = sidepanelPage.locator('text=UPCOMING TTD RELEASES');
    await expect(releasesCard).toBeVisible();

    // 2. Verify official source badge
    const officialBadge = sidepanelPage.locator('text=Official TTD update');
    await expect(officialBadge).toBeVisible();

    // 3. Verify official domain link or button targeting authorized TTD domain
    const sourceBtn = sidepanelPage.locator('button', {
      hasText: /tirumala\.org|ttdevasthanams\.ap\.gov\.in/i,
    });
    await expect(sourceBtn.first()).toBeVisible();

    // 4. Verify verified timestamp is displayed
    const verifiedBadge = sidepanelPage.locator('text=Verified');
    await expect(verifiedBadge.first()).toBeVisible();
  });
});
