# Tirumala SevaPilot — Privacy & Security Disclosure

**Version:** 1.1.0  
**Effective Date:** October 2026  
**Scope:** Tirumala SevaPilot Chrome Extension (Manifest V3)  
**Target Origin:** `https://ttdevasthanams.ap.gov.in` and `https://tirupatibalaji.ap.gov.in`

---

## 1. Executive Summary & Core Philosophy

**Tirumala SevaPilot** is designed with an uncompromising **Privacy-First, Local-First, and Zero-Automation** architecture. Our mission is to assist devotees in planning, organizing, and executing their pilgrimage bookings manually, transparently, and in strict compliance with the **Tirumala Tirupati Devasthanams (TTD)** official policies and terms of service.

We collect **no telemetry**, maintain **no external servers**, use **no third-party analytics**, and store **all data strictly inside the user's local browser instance**.

---

## 2. Chrome Web Store Compliance & Single Purpose

- **Single Purpose:** Tirumala SevaPilot serves a single, well-defined purpose: to act as a local companion and manual-entry reference assistant for devotees making pilgrimage and seva bookings on official TTD portals.
- **Audited Minimal Permissions:**
  - `storage`: Required to persist devotee profiles and preferences locally in `chrome.storage.local`.
  - `sidePanel`: Required to render the companion side panel interface in Chrome.
  - `scripting`: Required to inject and execute content verification scripts solely on pinned official TTD domains.
  - `contextMenus`: Used for user-initiated quick launch of the side panel from the browser context menu.
- **Explicitly Removed & Excluded Permissions:**
  - **REMOVED** `tabs` and `activeTab`: Audited and eliminated to strictly uphold Chrome Web Store least-privilege principles. The extension does not read broad tab titles, URLs, or browsing history.
  - **NO** `<all_urls>` or unrestricted host permissions.
  - **NO** `clipboardRead` or `clipboardWrite` (ensures zero automated clipboard manipulation).
  - **NO** `webRequest` or `webRequestBlocking` (ensures zero traffic sniffing or tampering).
  - **NO** `proxy`, `debugger`, `cookies`, `history`, or `bookmarks` permissions.
- **Host Permission Pinning:** Strictly scoped only to official TTD domains:
  - `https://ttdevasthanams.ap.gov.in/*`
  - `https://tirupatibalaji.ap.gov.in/*`

---

## 3. Data Storage & Architecture

### 3.1 Local Storage Tier (`chrome.storage.local`)
All application data resides inside `chrome.storage.local` within the sandbox of the user's browser. No data is synchronized to external clouds or Google accounts unless explicitly exported by the devotee.

| Storage Key | Data Class | Sensitivity | Retention & Purge |
| :--- | :--- | :--- | :--- |
| `pilgrims` | Devotee profiles (Name, Age, Gender, ID Type, Masked ID, Photo reference) | High | Erased upon Devotee Purge or Nuclear Wipe |
| `vault` | Sensitive identification details (Encrypted/Masked Aadhaar/Passport) | Critical | Erased upon Devotee Purge or Nuclear Wipe |
| `notifications` | Release alerts and in-app devotee notifications | Medium | Erased upon Devotee Purge or Nuclear Wipe |
| `bookingHistory` | Local records of confirmed or completed reservations | Medium | Erased upon Devotee Purge or Nuclear Wipe |
| `session_draft_tokens` | Ephemeral draft tokens for form consistency | High | Erased upon Devotee Purge or Nuclear Wipe |
| `settings` | UI theme, language (EN, TE, HI, TA, KN), accessibility preferences | Low | Preserved during Devotee Purge; Erased during Nuclear Wipe |
| `releaseScheduleCache` | Cached official TTD booking schedule | Low | Preserved during Devotee Purge; Erased during Nuclear Wipe |

### 3.2 Session Storage Tier (`chrome.storage.session`)
Ephemeral operational state (such as temporary policy flags and active step tracking) is held in `chrome.storage.session`, which is automatically purged when the browser process terminates.

---

## 4. Cryptographic Security & Backup Procedures

### 4.1 Encrypted Backups (`.spbk`)
When a devotee creates an encrypted backup (`.spbk`), SevaPilot employs authenticated browser-native cryptography via the **Web Cryptography API (`crypto.subtle`)**:
- **Cipher:** AES-GCM with a 256-bit symmetric key (`VAULT_CONFIG.ALGORITHM`).
- **Key Derivation:** PBKDF2 using SHA-256 with **600,000 iterations** (`VAULT_CONFIG.PBKDF2_ITERATIONS`) and a cryptographically secure 32-byte random salt (`VAULT_CONFIG.SALT_LENGTH`).
- **Initialization Vector (IV):** 12-byte cryptographically secure random IV generated per export (`VAULT_CONFIG.IV_LENGTH`).
- **Integrity Authentication:** 128-bit GCM authentication tag verifying ciphertext tamper-resistance. Any tampered ciphertext is rejected prior to storage.

### 4.2 Plain JSON Exports & Unencrypted Warning
Devotees have the option to export raw JSON for personal records. Whenever plain JSON export is accessed, the application displays a prominent security warning:
> **Security Advisory:** Plain JSON exports are unencrypted. Anyone with access to the downloaded file can read devotee names, birth dates, and identity numbers. Store exported files in an encrypted container and delete them once no longer needed.

---

## 5. Devotee Data Erasure & Right to Be Forgotten

Devotees have complete control over their personal data at all times. SevaPilot provides two independent levels of data erasure within `Settings -> Danger Zone`:

1. **Purge Devotee Personal Data (`purgeDevoteeData`):**
   - Completely removes all devotee profiles (`pilgrims`), identification vault entries (`vault`), booking histories, in-app notifications, and session tokens.
   - Preserves user UI settings (selected language, dark/light theme, high-contrast mode) and cached release dates.
   - Executable with a single confirmation without needing to reconfigure display preferences.
2. **Factory Reset / Nuclear Wipe (`clearAllData`):**
   - Performs a complete, irreversible wipe across `chrome.storage.local`, `chrome.storage.sync`, and `chrome.storage.session`.
   - Restores the extension to a pristine post-installation state.
   - Clears all cached schedule artifacts, telemetry-free preferences, and security registries.

---

## 6. Strict TTD Policy Compliance & Anti-Bot Boundary

In compliance with official notifications published by the Tirumala Tirupati Devasthanams (including the May 2026 advisory ending automated filling on Srivani and sensitive services):

1. **Zero Autofill for Restricted Services:**
   - Autofill is strictly blocked for Srivani VIP Break Darshan and any newly introduced restricted quota categories via the `PolicyRegistry`.
2. **Zero Clipboard Automation:**
   - The extension does not read from or silently paste into devotee clipboards. All manual copying is explicitly triggered by the user via interactive click-to-copy buttons.
3. **Zero CAPTCHA / OTP Automation:**
   - The extension contains no optical character recognition (OCR), CAPTCHA solving modules, or automated OTP reading handlers. Devotees must solve CAPTCHAs and enter SMS/WhatsApp OTPs manually.
4. **Zero Queue Manipulation:**
   - The extension contains zero mechanisms to bypass, manipulate, or accelerate TTD's virtual waiting rooms (Cloudflare / Akamai queuing systems).
5. **Zero Payment Automation:**
   - All payment flows, card entry, UPI redirection, and net banking submissions must be initiated and confirmed solely by the devotee.
6. **Zero Session Lock Bypasses:**
   - When TTD issues a temporary lock or session timeout, the extension respects the lock state, alerts the user, and guides them to wait out the mandatory cooldown period.

---

## 7. Official Release Freshness & Trust Badges

Booking release schedules displayed in the application are derived directly from official TTD press notes and calendar publications.
- **Cache Age Tracking:** The extension tracks cache timestamp metadata (`lastFetched`).
- **Staleness Badges:** If cached release information has not been verified against official TTD releases within the threshold, a warning badge (`Cached · Check TTD`) is rendered alongside an active link to the official TTD portal.
- **Zero Hallucination:** The extension never predicts or speculates on unannounced release dates.

---

## 8. Responsible Disclosure & Auditing

If you discover a potential privacy or security issue, please disclose it responsibly via GitHub Security Advisories at:  
`https://github.com/chiru80/tirumala-sevapilot/security/advisories`

All releases undergo automated static security linting via `npm run package` before deployment to ensure no unauthorized permissions, source map leaks, or unpinned origins are bundled into distribution archives.
