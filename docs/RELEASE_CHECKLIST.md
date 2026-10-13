# Tirumala SevaPilot — Release Readiness Checklist

**Release Target:** v1.1.0  
**Phase:** Phase 17 (Chrome Web Store Release Hardening)  
**Package Artifact:** `releases/tirumala-sevapilot-v1.1.0.zip`  
**Package SHA-256 Checksum:** `7EFA75B0027B2D9EC6D22EDB5EE773F8EC33EAE0CE5E0BF0A0200E0E050EB173`  
**Target Repository:** `chiru80/tirumala-sevapilot`  
**Status:** Verification Complete — **PENDING HUMAN RELEASE APPROVAL & CWS DASHBOARD SUBMISSION**

---

## 1. Automated Checks Passed (CI / Build Verification)

All automated checks were executed directly against the clean production release branch.

| Check | Command / Pipeline | Real Output / Evidence | Status |
| :--- | :--- | :--- | :---: |
| **TypeScript Static Analysis** | `npm run typecheck` | 0 errors, exit code 0 | PASS |
| **Unit & Integration Suite** | `npm test` | **83 test files passed, 1018/1018 tests passed** (0 failed) | PASS |
| **End-to-End Suite** | `npm run test:e2e` | **9 journeys, 26/26 tests passed** (0 failed) | PASS |
| **Production Vite Build** | `npm run build` | 178 modules transformed into `dist/` with zero bundle errors | PASS |
| **Package Archiver & Linter** | `npm run package` | Packaged to `releases/tirumala-sevapilot-v1.1.0.zip` (914.1 KB) | PASS |
| **Artifact Sanitization** | `scripts/package-extension.js` | 0 source maps, 0 `.ts`/`.tsx` files, 0 test fixtures, 0 `.env` files | PASS |
| **Manifest V3 Least Privilege** | Manifest Linter | Permissions strictly limited to `storage`, `sidePanel`, `scripting`, `contextMenus` | PASS |
| **Host Origin Pinning** | Manifest Linter | Only `https://ttdevasthanams.ap.gov.in/*` and `https://tirupatibalaji.ap.gov.in/*` | PASS |
| **Fail-Closed Policy Compliance** | `phase17-policy-compliance-gate.test.ts` | 5/5 tests passing: unconfirmed services & Srivani write 0 fields | PASS |
| **Crypto Exception Handling** | Vitest suite | Web Crypto `OperationError` correctly caught and surfaced to devotee | PASS |

---

## 2. Manual Checks Completed

Manual architectural and UX audits conducted by the engineering team:

- [x] **Zero Remote Code Execution:** CSP verified (`script-src 'self'`); no remote scripts, dynamically loaded CDNs, eval, or unsafe-inline.
- [x] **Devotee Data Stays Local:** Storage relies exclusively on `chrome.storage.local`. Zero devotee telemetry, zero analytics beacons, zero third-party endpoints.
- [x] **PBKDF2/AES-GCM-256 Encrypted Backups:** Backup export requires devotee master password with 600,000 PBKDF2 iterations and random salt; invalid password attempts reject with friendly message.
- [x] **Purge & Complete Data Deletion:** "Purge Devotee Data" and "Clear All Data" buttons in settings purge all profiles, logs, and storage keys across local and session layers.
- [x] **Manual-Only Booking Boundaries:** Verified that extension never touches:
  - CAPTCHA input boxes or audio puzzles
  - SMS/Aadhaar OTP entry
  - Payment gateway, CVV, UPI, or card fields
  - Final booking declaration checkboxes and booking submission buttons
- [x] **Srivari Trust Protection:** Srivari Trust is explicitly marked `MANUAL_ONLY` in workflow intelligence and blocked by fail-closed gate.
- [x] **Unconfirmed Services Fail-Closed:** Any newly launched or unconfirmed TTD seva URL halts execution with 0 fields written.
- [x] **Queue / Waiting Room Integrity:** Extension does not manipulate queue cookies, tokens, DOM waiting room elements, or network timing.
- [x] **Legal Disclaimers Displayed:** Side panel header, options page, and storage disclosure clearly display:
  > *"Tirumala SevaPilot is an independent open-source devotee companion. It is NOT affiliated with, authorized by, or endorsed by Tirumala Tirupati Devasthanams (TTD). Availability and booking success are not guaranteed."*

---

## 3. Chrome Web Store Developer Dashboard Tasks Pending (Manual Human Actions)

These steps require administrative access to the Google Chrome Web Store Developer Dashboard and must be performed manually by the repository owner:

- [ ] **Developer Account Authentication:** Log into the Chrome Web Store Developer Dashboard ([https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)).
- [ ] **Package Upload:** Upload the built ZIP artifact:  
  `releases/tirumala-sevapilot-v1.1.0.zip`  
  *(Verify uploaded checksum matches: `7EFA75B0027B2D9EC6D22EDB5EE773F8EC33EAE0CE5E0BF0A0200E0E050EB173`)*.
- [ ] **Store Listing Metadata:** Populate metadata from `docs/STORE_LISTING.md`:
  - Item Title: `Tirumala SevaPilot - Devotee Companion`
  - Short Description (max 132 characters)
  - Detailed Description (Markdown rendered as plain text per CWS format)
  - Category: `Accessibility` or `Productivity` (Workflow & Planning)
- [ ] **Visual Media Upload:**
  - 128x128 store icon (`public/icons/icon128.png`)
  - 1280x800 or 640x400 screenshot of the Side Panel Devotee Manager
  - 1280x800 screenshot of the Booking Cockpit & Quota Countdown
  - 440x280 small promo tile
- [ ] **Privacy Declarations (Developer Console Questionnaire):**
  - **Single Purpose Description:** *"Assists pilgrims with local profile management and guided form entry on official Tirumala Tirupati Devasthanams (TTD) booking portals."*
  - **Permission Justifications:**
    - `storage`: Persist encrypted pilgrim profiles locally on the user's computer.
    - `sidePanel`: Provide an unobtrusive side-by-side devotee cockpit while navigating the booking portal.
    - `scripting`: Insert non-invasive helper cues and devotee form autofill on official TTD booking pages.
    - `contextMenus`: Provide context menu shortcuts to fill devotee details directly from input fields.
    - `host_permissions`: Strictly constrained to `https://ttdevasthanams.ap.gov.in/*` and `https://tirupatibalaji.ap.gov.in/*`.
  - **Data Usage Affirmations:**
    - Devotee data is **NOT sold to third parties**.
    - Devotee data is **NOT used for creditworthiness or lending**.
    - Devotee data is **NOT transferred across the network to external servers**.
  - **Privacy Policy URL:** Link to public hosted document:  
    `https://github.com/chiru80/tirumala-sevapilot/blob/master/docs/PRIVACY_AND_SECURITY_DISCLOSURE.md`
- [ ] **Reviewer Notes:** Add instructions explaining how to open the side panel and clarify that testing can be done with mock profiles without requiring real Aadhaar verification.

---

## 4. External Policy & Environmental Risks (Ongoing Monitoring)

- **TTD DOM Volatility:** TTD periodically updates Angular Material form controls, field names, or quota release workflows. The extension relies on multi-strategy semantic selectors and fails closed if fields change.
- **Queue / Cloudflare Anti-Bot Layer:** TTD employs Cloudflare and internal queue management. SevaPilot adheres strictly to rate limits, never spawns background fetch loops, and never bypasses Cloudflare checks.
- **Store Review SLA:** Chrome Web Store review typically takes 1–5 business days for extensions requesting `scripting` and host permissions.
- **No Fabricated Review Status:** Neither this document nor the repository shall claim Google approval or store publication until review is complete.

---

## 5. Final Release Sign-Off Gate

| Gate | Criterion | Responsible Party | Status |
| :--- | :--- | :--- | :---: |
| **G1: Build & Test Integrity** | 100% automated tests passing, clean build, clean archive | Antigravity AI Engineer | **PASSED** |
| **G2: Policy Compliance** | Zero CAPTCHA/OTP/Payment touch, Srivani manual-only, fail-closed | Antigravity AI Engineer | **PASSED** |
| **G3: Privacy Disclosure** | Privacy doc matches implementation, local-only storage verified | Antigravity AI Engineer | **PASSED** |
| **G4: Pull Request Review** | PR reviewed and merged into master | Maintainer / Devotee Lead | **PENDING** |
| **G5: CWS Submission** | Package uploaded to CWS dashboard with disclosures | Maintainer / Account Owner | **PENDING** |
| **G6: Store Publication** | Extension approved by Google and published live | Google CWS Review Team | **PENDING** |

**Recommendation:** **GO FOR HUMAN RELEASE REVIEW AND CWS DASHBOARD SUBMISSION**.
