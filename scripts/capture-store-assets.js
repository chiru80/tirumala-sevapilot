import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  console.log('📸 [Store Assets] Starting Chrome Web Store asset generation...');

  const baseDir = process.cwd();
  const distDir = path.resolve(baseDir, 'dist');
  const storeAssetsDir = path.resolve(baseDir, 'store-assets');
  const screenshotsDir = path.join(storeAssetsDir, 'screenshots');
  const promoDir = path.join(storeAssetsDir, 'promo');
  const iconsDir = path.join(storeAssetsDir, 'icons');

  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(promoDir, { recursive: true });
  fs.mkdirSync(iconsDir, { recursive: true });

  // 1. Copy icon128
  const iconSrc = path.resolve(baseDir, 'public/icons/icon128.png');
  const iconDest = path.join(iconsDir, 'icon128.png');
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, iconDest);
    console.log('✅ Copied icon128.png to store-assets/icons/');
  }

  // 2. Launch persistent context with extension loaded
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cws-assets-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    // Locate extension service worker
    let background = context.serviceWorkers()[0];
    if (!background) {
      const eventPromise = context.waitForEvent('serviceworker', { timeout: 4000 }).catch(() => null);
      background = (await eventPromise) || context.serviceWorkers()[0];
    }
    for (let i = 0; i < 20 && !background; i++) {
      await new Promise(r => setTimeout(r, 200));
      background = context.serviceWorkers()[0];
    }

    if (!background) {
      throw new Error('Could not find extension service worker');
    }

    const extensionId = background.url().split('/')[2];
    console.log(`🔌 Extension loaded with ID: ${extensionId}`);

    const mockProfiles = [
      {
        id: 'prof-family-1',
        name: 'Govinda Family',
        pilgrims: [
          {
            id: 'p1',
            firstName: 'Srinivasa',
            lastName: 'Rao',
            fullName: 'Srinivasa Rao',
            age: 45,
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '234567890124',
            country: 'India',
            mobile: '9876543210',
          },
          {
            id: 'p2',
            firstName: 'Padmavathi',
            lastName: 'Rao',
            fullName: 'Padmavathi Rao',
            age: 41,
            gender: 'Female',
            idType: 'Aadhaar',
            idNumber: '345678901238',
            country: 'India',
            mobile: '9876543210',
          },
          {
            id: 'p3',
            firstName: 'Karthik',
            lastName: 'Rao',
            fullName: 'Karthik Rao',
            age: 16,
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '456789012349',
            country: 'India',
          },
        ],
        selectedPilgrims: {
          'special-entry-darshan-300': ['p1', 'p2', 'p3'],
        },
        general: {
          mobile: '9876543210',
          email: 'srinivasa.rao@example.com',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
        },
      },
    ];

    // Seed storage via extension background or a page
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.evaluate(async (profiles) => {
      await chrome.storage.local.set({
        sp_profiles: profiles,
        sp_active_profile_id: profiles[0].id,
        sp_onboarding_complete: true,
        sp_settings: {
          language: 'en',
          theme: 'light',
          autofillMode: 'fast',
          confirmationMode: 'high-confidence-direct',
          onboardingComplete: true,
        },
      });
    }, mockProfiles);

    await page.reload();
    await page.waitForTimeout(1000);

    // ── Screenshot 1: Side Panel Cockpit & Profile Manager (1280x800 composite view) ──
    console.log('Capturing Screenshot 1: Cockpit...');
    // Create an authentic composite mock representing Chrome browser with TTD portal + SevaPilot Side Panel
    const compositePage = await context.newPage();
    await compositePage.setViewportSize({ width: 1280, height: 800 });

    const compositeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; height: 800px; width: 1280px; background: #0f172a; overflow: hidden; }
          #ttd-stage { flex: 1; height: 100%; border-right: 2px solid #334155; position: relative; background: #f8fafc; }
          #sidepanel-frame { width: 440px; height: 100%; border: none; }
          .browser-bar { height: 42px; background: #1e293b; display: flex; align-items: center; padding: 0 16px; gap: 12px; border-bottom: 1px solid #334155; }
          .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
          .dot-red { background: #ef4444; } .dot-yellow { background: #f59e0b; } .dot-green { background: #10b981; }
          .url-bar { flex: 1; background: #0f172a; color: #94a3b8; font-size: 13px; padding: 6px 14px; border-radius: 6px; display: flex; align-items: center; gap: 8px; }
          .url-secure { color: #10b981; font-weight: 600; font-size: 11px; }
          .badge { background: #d97706; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div id="ttd-stage">
          <div class="browser-bar">
            <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
            <div class="url-bar">
              <span class="url-secure">🔒 HTTPS</span>
              <span>https://ttdevasthanams.ap.gov.in/special-entry-darshan/booking</span>
            </div>
            <span class="badge">Official TTD Portal</span>
          </div>
          <iframe src="https://ttdevasthanams.ap.gov.in" style="width:100%; height:calc(100% - 42px); border:none;" id="portal-frame"></iframe>
        </div>
        <iframe id="sidepanel-frame" src="chrome-extension://${extensionId}/sidepanel.html"></iframe>
      </body>
      </html>
    `;

    // Intercept ttdevasthanams iframe inside composite to display canonical mock booking page
    await compositePage.route('https://ttdevasthanams.ap.gov.in/**', async (route) => {
      const fixtureContent = fs.readFileSync(path.resolve(baseDir, 'tests/e2e/fixtures/special-entry-300.html'), 'utf8');
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixtureContent });
    });

    await compositePage.setContent(compositeHtml);
    await compositePage.waitForTimeout(2000);

    await compositePage.screenshot({
      path: path.join(screenshotsDir, 'screenshot-1-booking-cockpit-1280x800.png'),
    });
    console.log('✅ Saved: screenshot-1-booking-cockpit-1280x800.png');

    // ── Screenshot 2: Devotee Profile & Pilgrim Manager ──
    console.log('Capturing Screenshot 2: Pilgrim Manager...');
    const profilesBtn = page.getByRole('button', { name: /Profiles|భక్తులు/i }).first();
    if (await profilesBtn.isVisible()) {
      await profilesBtn.click();
      await page.waitForTimeout(500);
    }

    const compositeProfilesPage = await context.newPage();
    await compositeProfilesPage.setViewportSize({ width: 1280, height: 800 });
    const compositeProfilesHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; height: 800px; width: 1280px; background: #0f172a; overflow: hidden; }
          #ttd-stage { flex: 1; height: 100%; border-right: 2px solid #334155; position: relative; background: #f8fafc; }
          #sidepanel-frame { width: 440px; height: 100%; border: none; }
          .browser-bar { height: 42px; background: #1e293b; display: flex; align-items: center; padding: 0 16px; gap: 12px; border-bottom: 1px solid #334155; }
          .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
          .dot-red { background: #ef4444; } .dot-yellow { background: #f59e0b; } .dot-green { background: #10b981; }
          .url-bar { flex: 1; background: #0f172a; color: #94a3b8; font-size: 13px; padding: 6px 14px; border-radius: 6px; display: flex; align-items: center; gap: 8px; }
          .url-secure { color: #10b981; font-weight: 600; font-size: 11px; }
          .badge { background: #059669; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div id="ttd-stage">
          <div class="browser-bar">
            <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
            <div class="url-bar">
              <span class="url-secure">🔒 HTTPS</span>
              <span>https://ttdevasthanams.ap.gov.in/special-entry-darshan/pilgrim-details</span>
            </div>
            <span class="badge">Pilgrim Details Step</span>
          </div>
          <iframe src="https://ttdevasthanams.ap.gov.in" style="width:100%; height:calc(100% - 42px); border:none;"></iframe>
        </div>
        <iframe id="sidepanel-frame" src="chrome-extension://${extensionId}/sidepanel.html"></iframe>
      </body>
      </html>
    `;

    await compositeProfilesPage.route('https://ttdevasthanams.ap.gov.in/**', async (route) => {
      const fixtureContent = fs.readFileSync(path.resolve(baseDir, 'tests/e2e/fixtures/special-entry-300.html'), 'utf8');
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixtureContent });
    });

    await compositeProfilesPage.setContent(compositeProfilesHtml);
    await compositeProfilesPage.waitForTimeout(1500);

    await compositeProfilesPage.screenshot({
      path: path.join(screenshotsDir, 'screenshot-2-pilgrim-manager-1280x800.png'),
    });
    console.log('✅ Saved: screenshot-2-pilgrim-manager-1280x800.png');

    // ── Screenshot 3: Settings & Devotee Data Privacy (Danger Zone) ──
    console.log('Capturing Screenshot 3: Privacy & Erasure Settings...');
    const moreBtn = page.getByRole('button', { name: /More|మరిన్ని/i }).first();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(500);
    }

    // Scroll to danger zone
    const dangerZoneHeading = page.getByText(/Danger Zone|ప్రమాదకర ప్రాంతం/i).first();
    if (await dangerZoneHeading.isVisible()) {
      await dangerZoneHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }

    await page.screenshot({
      path: path.join(screenshotsDir, 'screenshot-3-privacy-and-settings-1280x800.png'),
    });
    console.log('✅ Saved: screenshot-3-privacy-and-settings-1280x800.png');

    // ── Screenshot 4: Encrypted Backup & Restore Modal ──
    console.log('Capturing Screenshot 4: Backup & Restore...');
    const backupNavBtn = page.getByText(/Backup & Restore|బ్యాకప్/i).first();
    if (await backupNavBtn.isVisible()) {
      await backupNavBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: path.join(screenshotsDir, 'screenshot-4-encrypted-backup-1280x800.png'),
    });
    console.log('✅ Saved: screenshot-4-encrypted-backup-1280x800.png');

    // ── 3. Render Promo Assets (Small Promo Tile 440x280) ──
    console.log('Rendering Promo Tile 440x280...');
    const promoTilePage = await context.newPage();
    await promoTilePage.setViewportSize({ width: 440, height: 280 });

    const promoSmallHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 440px; height: 280px;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 24px 28px;
            position: relative;
            overflow: hidden;
          }
          .halo {
            position: absolute;
            top: -60px; right: -60px;
            width: 200px; height: 200px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%);
            border-radius: 50%;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 1;
          }
          .icon-box {
            width: 48px; height: 48px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.4);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(90deg, #fef3c7, #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .subtitle {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .body-content {
            z-index: 1;
            margin-top: 10px;
          }
          .tagline {
            font-size: 15px;
            font-weight: 600;
            color: #f1f5f9;
            line-height: 1.35;
          }
          .description {
            font-size: 11px;
            color: #cbd5e1;
            margin-top: 6px;
            line-height: 1.4;
          }
          .pills {
            display: flex;
            gap: 8px;
            margin-top: 12px;
          }
          .pill {
            font-size: 10px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 20px;
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fcd34d;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #64748b;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 8px;
            z-index: 1;
          }
        </style>
      </head>
      <body>
        <div class="halo"></div>
        <div class="header">
          <div class="icon-box">
            <img src="chrome-extension://${extensionId}/icons/icon48.png" width="36" height="36" />
          </div>
          <div>
            <div class="title">Tirumala SevaPilot</div>
            <div class="subtitle">Pilgrim Booking Companion</div>
          </div>
        </div>
        <div class="body-content">
          <div class="tagline">Offline-First Devotee Profiles &amp; Booking Assistance</div>
          <div class="description">Secure pilgrim profile manager and guided form entry for official TTD darshan portals.</div>
          <div class="pills">
            <span class="pill">🔒 100% Local Only</span>
            <span class="pill">🛡️ Zero Telemetry</span>
            <span class="pill">⚡ Side Panel UI</span>
          </div>
        </div>
        <div class="footer">
          <span>Independent Devotee Companion</span>
          <span>Not Affiliated with TTD</span>
        </div>
      </body>
      </html>
    `;

    await promoTilePage.setContent(promoSmallHtml);
    await promoTilePage.waitForTimeout(500);
    await promoTilePage.screenshot({
      path: path.join(promoDir, 'promo-small-440x280.png'),
    });
    console.log('✅ Saved: promo-small-440x280.png');

    // ── 4. Render Promo Marquee Banner (1400x560) ──
    console.log('Rendering Marquee Promo Banner 1400x560...');
    const marqueePage = await context.newPage();
    await marqueePage.setViewportSize({ width: 1400, height: 560 });

    const marqueeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1400px; height: 560px;
            background: linear-gradient(135deg, #090d16 0%, #1e1b4b 45%, #2e1065 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 60px 80px;
            position: relative;
            overflow: hidden;
          }
          .glow {
            position: absolute;
            top: -100px; right: 200px;
            width: 500px; height: 500px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
            border-radius: 50%;
          }
          .left-col {
            max-width: 680px;
            z-index: 2;
          }
          .brand-row {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 24px;
          }
          .brand-icon {
            width: 80px; height: 80px;
            background: rgba(255, 255, 255, 0.08);
            border: 2px solid rgba(245, 158, 11, 0.5);
            border-radius: 20px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .brand-title {
            font-size: 42px;
            font-weight: 800;
            background: linear-gradient(90deg, #fef3c7, #f59e0b, #fbbf24);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -1px;
          }
          .brand-sub {
            font-size: 15px;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
          }
          .main-heading {
            font-size: 32px;
            font-weight: 700;
            line-height: 1.25;
            color: #f8fafc;
            margin-bottom: 16px;
          }
          .main-desc {
            font-size: 16px;
            color: #cbd5e1;
            line-height: 1.5;
            margin-bottom: 28px;
          }
          .feature-badges {
            display: flex;
            gap: 14px;
          }
          .badge {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
            color: #fcd34d;
            display: flex; align-items: center; gap: 8px;
          }
          .right-col {
            z-index: 2;
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 440px;
          }
          .card {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(245, 158, 11, 0.25);
            padding: 20px 24px;
            border-radius: 16px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
          }
          .card-title {
            font-size: 14px;
            font-weight: 700;
            color: #f59e0b;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-text {
            font-size: 13px;
            color: #cbd5e1;
            line-height: 1.4;
          }
          .legal-note {
            font-size: 11px;
            color: #64748b;
            text-align: right;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <div class="left-col">
          <div class="brand-row">
            <div class="brand-icon">
              <img src="chrome-extension://${extensionId}/icons/icon128.png" width="60" height="60" />
            </div>
            <div>
              <div class="brand-title">Tirumala SevaPilot</div>
              <div class="brand-sub">Independent Devotee Companion</div>
            </div>
          </div>
          <div class="main-heading">Peace of Mind for Pilgrim Quota Booking</div>
          <div class="main-desc">Manage family devotee profiles offline, avoid typing errors during fast-moving monthly releases, and navigate official TTD portals with confidence.</div>
          <div class="feature-badges">
            <span class="badge">🔒 Local-Only Storage</span>
            <span class="badge">🛡️ Zero Telemetry</span>
            <span class="badge">🔑 AES-GCM Encrypted Backups</span>
            <span class="badge">⚡ Native Side Panel</span>
          </div>
        </div>
        <div class="right-col">
          <div class="card">
            <div class="card-title">Strict Human Safety Boundaries</div>
            <div class="card-text">Never automates CAPTCHA, OTP, payments, or final submissions. Srivari Trust is strictly manual-only. Unconfirmed services fail closed.</div>
          </div>
          <div class="card">
            <div class="card-title">Multi-Lingual Devotee Cockpit</div>
            <div class="card-text">Fully translated into English, Telugu (తెలుగు), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), and Hindi (हिन्दी).</div>
          </div>
          <div class="legal-note">Independent open-source companion · Not affiliated with or endorsed by TTD</div>
        </div>
      </body>
      </html>
    `;

    await marqueePage.setContent(marqueeHtml);
    await marqueePage.waitForTimeout(500);
    await marqueePage.screenshot({
      path: path.join(promoDir, 'promo-marquee-1400x560.png'),
    });
    console.log('✅ Saved: promo-marquee-1400x560.png');

    console.log('✨ [Store Assets] All promotional and screenshot assets successfully generated!');
  } finally {
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error('❌ Error generating store assets:', err);
  process.exit(1);
});
