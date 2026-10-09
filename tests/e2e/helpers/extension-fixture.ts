import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ExtensionTestFixtures {
  context: BrowserContext;
  extensionId: string;
  sidepanelPage: Page;
  setupRoutes: () => Promise<void>;
  seedProfiles: (profiles: any[], settings?: any) => Promise<void>;
}

export const test = base.extend<ExtensionTestFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(pathToExtension)) {
      throw new Error(`Extension build not found at ${pathToExtension}. Run 'npm run build' first.`);
    }

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sevapilot-e2e-'));

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-gpu',
      ],
    });

    await use(context);
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore tmp cleanup error
    }
  },

  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },

  setupRoutes: async ({ context }, use) => {
    const fixturesDir = path.resolve(process.cwd(), 'tests/e2e/fixtures');

    const setup = async () => {
      await context.route('https://ttdevasthanams.ap.gov.in/**', async (route) => {
        const url = route.request().url();
        let fixtureFile = 'special-entry-300.html';

        if (url.includes('/spat/') || url.includes('padmavathi')) {
          fixtureFile = 'padmavathi-200.html';
        } else if (url.includes('/homam/')) {
          fixtureFile = 'homam-1600.html';
        } else if (url.includes('/srivari-seva/')) {
          fixtureFile = 'srivari-seva.html';
        } else if (url.includes('/lock')) {
          fixtureFile = 'temporary-lock.html';
        } else if (url.includes('/queue/')) {
          fixtureFile = 'queue-simulation.html';
        } else if (url.includes('/dynamic/')) {
          fixtureFile = 'dynamic-dom.html';
        } else if (url.includes('/unknown') || url.includes('/portal/info')) {
          fixtureFile = 'unknown-service.html';
        }

        const filePath = path.join(fixturesDir, fixtureFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: content,
          });
        } else {
          await route.fulfill({ status: 404, body: 'Not found' });
        }
      });
    };

    await use(setup);
  },

  sidepanelPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },

  seedProfiles: async ({ sidepanelPage }, use) => {
    const seed = async (profiles: any[], settings?: any) => {
      await sidepanelPage.evaluate(async ({ p, s }) => {
        await chrome.storage.local.set({
          sp_profiles: p,
          sp_active_profile_id: p[0]?.id || null,
          sp_onboarding_complete: true,
          sp_settings: {
            language: 'en',
            theme: 'light',
            autofillMode: 'fast',
            confirmationMode: 'high-confidence-direct',
            onboardingComplete: true,
            ...(s || {}),
          },
        });
      }, { p: profiles, s: settings });
      await sidepanelPage.reload();
      await sidepanelPage.waitForLoadState('domcontentloaded');
    };
    await use(seed);
  },
});

export { expect } from '@playwright/test';
