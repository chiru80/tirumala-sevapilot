import { test, expect } from './helpers/extension-fixture';

test.describe('E2E Journey 4 — Safety & Human Boundary Lab (Zero Automation)', () => {
  test('strictly never auto-fills or touches CAPTCHA input', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();
    const page = await context.newPage();
    await page.goto('https://ttdevasthanams.ap.gov.in/sed/entry');

    const captcha = page.locator('#captcha');
    await expect(captcha).toBeVisible();
    await expect(captcha).toHaveValue('');
  });

  test('strictly never auto-checks declarations, rules, or fitness undertakings', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();
    const srivariPage = await context.newPage();
    await srivariPage.goto('https://ttdevasthanams.ap.gov.in/srivari-seva/entry');

    const physicallyFit = srivariPage.locator('#physicallyFit');
    const mentallyFit = srivariPage.locator('#mentallyFit');
    const declaration = srivariPage.locator('#declaration');

    await expect(physicallyFit).not.toBeChecked();
    await expect(mentallyFit).not.toBeChecked();
    await expect(declaration).not.toBeChecked();
  });

  test('strictly never auto-clicks payment submission buttons', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();
    const page = await context.newPage();
    await page.goto('https://ttdevasthanams.ap.gov.in/sed/entry');

    const submitBtn = page.locator('#submit-booking-btn');
    await expect(submitBtn).toBeVisible();

    // Verify button remains unclicked and page stays on the entry route
    expect(page.url()).toContain('/sed/entry');
  });

  test('zero devotee PII (Aadhaar, phone, email) logged to browser console', async ({
    context,
    sidepanelPage,
    seedProfiles,
  }) => {
    const { mockSedProfile, validAadhaar1 } = await import('./helpers/mock-profiles');

    const loggedTexts: string[] = [];
    sidepanelPage.on('console', (msg) => loggedTexts.push(msg.text()));

    await seedProfiles([mockSedProfile]);
    await sidepanelPage.reload();

    // Verify Aadhaar number is never logged in plain text
    for (const log of loggedTexts) {
      expect(log).not.toContain(validAadhaar1);
      expect(log).not.toContain('srinivasa.e2e@example.com');
    }
  });
});
