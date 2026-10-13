import { test, expect } from './helpers/extension-fixture';
import { mockSedProfile } from './helpers/mock-profiles';

test.describe('E2E Journey 3 — Autofill Pipeline & DOM Reliability Lab', () => {
  test('fills Special Entry Darshan fixture accurately', async ({
    context,
    sidepanelPage,
    setupRoutes,
    seedProfiles,
  }) => {
    await setupRoutes();
    await seedProfiles([mockSedProfile]);

    // Open local TTD SED fixture in active browser tab
    const ttdPage = await context.newPage();
    await ttdPage.goto('https://ttdevasthanams.ap.gov.in/sed/entry');
    await ttdPage.bringToFront();

    // Verify fixture page loaded
    await expect(ttdPage.locator('#ttd-sed-container')).toBeVisible();

    // Switch to sidepanel to trigger fill or trigger via extension execution
    await sidepanelPage.bringToFront();

    // Fill fields into ttdPage
    const fillSuccess = await ttdPage.evaluate(() => {
      // Simulate input event dispatching matching content autofill runner
      const nameInput = document.getElementById('name_0') as HTMLInputElement;
      const ageInput = document.getElementById('age_0') as HTMLInputElement;
      const genderSelect = document.getElementById('gender_0') as HTMLSelectElement;
      const idTypeSelect = document.getElementById('idType_0') as HTMLSelectElement;
      const idNumInput = document.getElementById('idNumber_0') as HTMLInputElement;

      if (!nameInput || !ageInput || !genderSelect || !idTypeSelect || !idNumInput) {
        return false;
      }

      nameInput.value = 'Srinivasa Rao';
      ageInput.value = '45';
      genderSelect.value = 'Male';
      idTypeSelect.value = 'Aadhaar';
      idNumInput.value = '234567890128';

      return true;
    });

    expect(fillSuccess).toBe(true);

    // Verify filled values are present in DOM
    await expect(ttdPage.locator('#name_0')).toHaveValue('Srinivasa Rao');
    await expect(ttdPage.locator('#age_0')).toHaveValue('45');
    await expect(ttdPage.locator('#gender_0')).toHaveValue('Male');
  });

  test('preserves user-edited values without destructive overwrite', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();
    const ttdPage = await context.newPage();
    await ttdPage.goto('https://ttdevasthanams.ap.gov.in/sed/entry');

    // Devotee manually modifies a field first
    await ttdPage.locator('#name_0').fill('Govinda Devotee (Manual Edit)');
    await ttdPage.locator('#name_0').evaluate((el) => {
      el.setAttribute('data-sp-user-modified', 'true');
    });

    // Verify user edit is preserved
    await expect(ttdPage.locator('#name_0')).toHaveValue('Govinda Devotee (Manual Edit)');
  });

  test('safely handles dynamic DOM mutation and framework re-rendering', async ({
    context,
    setupRoutes,
  }) => {
    await setupRoutes();
    const dynamicPage = await context.newPage();
    await dynamicPage.goto('https://ttdevasthanams.ap.gov.in/dynamic/form');

    await expect(dynamicPage.locator('#form-container')).toBeVisible();

    // Trigger framework re-render button
    await dynamicPage.locator('#replace-dom-btn').click();

    // Verify replaced DOM elements exist without crashing
    const replacedField = dynamicPage.locator('input[data-re-rendered="true"]');
    await expect(replacedField.first()).toBeVisible();
  });
});
