# Tirumala SevaPilot — Chrome Web Store Release Audit Report

**Report Version:** 1.1.0  
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity AI Engineering & Security Review  
**Target Repository:** `chiru80/tirumala-sevapilot`  
**Target Branch:** `phase-17/chrome-web-store-release-hardening`  
**Package Artifact:** `releases/tirumala-sevapilot-v1.1.0.zip`  
**Package Size:** 914.1 KB (936,045 bytes)  
**Package SHA-256:** `7EFA75B0027B2D9EC6D22EDB5EE773F8EC33EAE0CE5E0BF0A0200E0E050EB173`  
**Overall Verdict:** **GO FOR HUMAN RELEASE REVIEW** (Ready for CWS submission)

---

## 1. Executive Summary

This audit report documents the security, privacy, policy compliance, and reproducibility verification performed for **Tirumala SevaPilot v1.1.0** ahead of submission to the Google Chrome Web Store. 

Tirumala SevaPilot is designed as an offline-first devotee companion assisting pilgrims during darshan and seva booking on the official Tirumala Tirupati Devasthanams (TTD) web portals. The extension implements strict safety boundaries, zero-telemetry data retention, and strict Manifest V3 least-privilege principles.

All automated verification gates (1,018 unit tests, 26 browser end-to-end tests, 0 TypeScript errors, clean package linter) have passed with 100% compliance.

---

## 2. Manifest V3 & Permissions Audit

### 2.1 Manifest Specification
The production manifest adheres strictly to Google Chrome Manifest V3 specifications.

```json
{
  "manifest_version": 3,
  "name": "Tirumala SevaPilot - Devotee Companion",
  "version": "1.1.0",
  "description": "Privacy-first booking companion for TTD pilgrims. Assists with devotee profile management and official portal guidance."
}
```

### 2.2 Audited Permission Set
The extension requests only four permissions, verified as the minimal set required for core functionality:

| Permission | Architectural Justification | Risk Level | Alternatives Evaluated |
| :--- | :--- | :---: | :--- |
| `storage` | Stores devotee profiles, preferences, and session state locally on the user's computer via `chrome.storage.local`. | Low | Required for local-first profile management. |
| `sidePanel` | Displays the extension cockpit side-by-side with official TTD pages without obstructing form fields or viewport. | Low | Side Panel API replaces intrusive injected popups. |
| `scripting` | Coordinates content-script injection and field highlighting on official TTD booking pages. | Medium | Required for DOM inspection and assistance on dynamic Angular pages. |
| `contextMenus` | Provides quick right-click actions ("Fill Pilgrim Details", "Open SevaPilot") to assist devotees directly from form fields. | Low | Context menu provides natural desktop accessibility. |

### 2.3 Forbidden Permissions & Removals
An explicit audit verified that high-risk or unnecessary permissions have been eliminated:

- **`tabs` Removed:** Previously used in development for tab switching; eliminated in favor of safe tab focusing via tab ID without requiring broad browsing history access.
- **`activeTab` Removed:** Eliminated to avoid unneeded broad permissions; specific official host matching is used instead.
- **`<all_urls>` Strictly Forbidden:** Zero wildcards; extension has no access to non-TTD websites.
- **`webRequest`, `webRequestBlocking`, `cookies`, `proxy`, `debugger`:** Strictly forbidden and absent from codebase.

### 2.4 Host Origin Pinning
Content scripts, background communications, and web-accessible resources are strictly pinned to official TTD origins:

1. `https://ttdevasthanams.ap.gov.in/*`
2. `https://tirupatibalaji.ap.gov.in/*`

No other origins, subdomains, or external third-party hosts are permitted or queried.

### 2.5 Extension Content Security Policy (CSP)
The extension declares a strict Content Security Policy:
```text
script-src 'self'; object-src 'self';
```
- Zero remote scripts or dynamically fetched CDN dependencies.
- Zero `unsafe-eval` or dynamic code evaluation (`Function()`, `eval()`).
- Zero `unsafe-inline` script tags.
- All code is bundled locally within the extension distribution directory (`dist/`).

---

## 3. Privacy, Data Handling, & Devotee Trust Audit

### 3.1 Data Flow & Local-Only Architecture
- **Zero Remote Storage:** Devotee profiles (names, Aadhaar/passport numbers, age, gender) are stored strictly on the devotee's physical device in `chrome.storage.local`.
- **Zero Network Transmission:** The extension never transmits devotee data to any server, proxy, cloud database, or analytics endpoint.
- **Zero Third-Party Telemetry:** Codebase is free of Google Analytics, Sentry, Mixpanel, Segment, or tracking pixels.
- **Network Isolation:** Outgoing network requests from background or content scripts are restricted strictly to official TTD portal interactions initiated directly by the devotee.

### 3.2 Backup & Cryptographic Implementation
- **Encryption Scheme:** AES-GCM-256 with 96-bit random initialization vectors (IV).
- **Key Derivation:** PBKDF2 with SHA-256 and **600,000 iterations** (OWASP 2026 standard for password-based key derivation).
- **Entropy:** Salt and IV are generated using browser-native `crypto.getRandomValues()`.
- **Exception Handling:** Handled Web Crypto API `OperationError` DOMException (thrown on wrong password or ciphertext tampering) to ensure graceful, non-crashing devotee feedback.
- **Unencrypted Export Prohibited:** No option exists to export devotee profiles in unencrypted plaintext.

### 3.3 Devotee Data Redaction & Deletion
- **Diagnostic Log Sanitization:** Diagnostic logger strips all sensitive fields (`idNumber`, `name`, `email`, `phone`, `aadhaar`) prior to recording events in debug logs.
- **Complete Data Purge:** The Settings dashboard features two independent purge operations:
  1. `purgeDevoteeData()`: Removes all devotee profiles, family members, and cached booking data.
  2. `clearAllData()`: Wipes all keys across `chrome.storage.local` and `chrome.storage.session`.

---

## 4. Booking Safety & TTD Policy Compliance

### 4.1 Non-Negotiable Invariants Verification
The extension strictly honors the safety invariants specified in the TTD policy guide:

| Safety Invariant | Implementation Mechanism | Verification Result |
| :--- | :--- | :---: |
| **Zero CAPTCHA Automation** | No OCR, third-party solver APIs, or audio transcription code exists. The CAPTCHA step strictly pauses for human devotee input. | VERIFIED |
| **Zero OTP Interception** | No SMS listening, clipboard snooping, or automated OTP submission. The OTP step halts and prompts the devotee. | VERIFIED |
| **Zero Payment Automation** | Payment gateway URLs, CVV fields, card numbers, and UPI PIN fields are completely excluded from autofill registry. | VERIFIED |
| **Srivari Trust Manual-Only** | Srivari Trust is flagged `MANUAL_ONLY` across UI, keyboard commands, context menus, and content scripts. | VERIFIED |
| **Fail-Closed on Unconfirmed Services** | If a devotee attempts autofill on an unknown or unconfirmed TTD seva URL, the automation engine immediately halts with an error and writes **zero** fields. | VERIFIED (5/5 tests) |
| **Zero Queue / Waiting Room Bypass** | Extension does not touch queue tokens, waiting room DOM elements, or refresh loops. | VERIFIED |
| **Zero Quota Fabrication** | Quota countdowns and release times rely on official schedules or devotee configuration; never fabricated. | VERIFIED |

### 4.2 Independence and Non-Affiliation Disclaimers
The extension makes no claim of endorsement, partnership, or affiliation with Tirumala Tirupati Devasthanams (TTD). Clear disclosures are displayed across all user surfaces:
- Side Panel Header
- Options / Settings View
- Export / Import Modal
- Privacy and Security Disclosure Document

---

## 5. Production Build & Package Reproducibility

### 5.1 Build Environment
- **Node.js:** v22.18.0
- **npm:** 10.9.3
- **Vite:** 5.4.14
- **TypeScript:** 5.6.3

### 5.2 Build Commands Executed
```bash
# 1. Typecheck
npm run typecheck       # Exit code 0, 0 errors

# 2. Unit & Integration Test Suite
npm test                # Exit code 0, 83 files passed, 1018/1018 passed

# 3. End-to-End Test Suite
npm run test:e2e        # Exit code 0, 9 journeys passed, 26/26 passed

# 4. Production Bundle
npm run build           # Exit code 0, 178 modules transformed

# 5. Production Archive Packaging
npm run package         # Exit code 0, releases/tirumala-sevapilot-v1.1.0.zip created
```

### 5.3 Archive Integrity Audit
- **Artifact:** `releases/tirumala-sevapilot-v1.1.0.zip`
- **File Count:** 28 entries
- **Uncompressed Size:** 2,429,918 bytes (~2.32 MB)
- **Compressed ZIP Size:** 936,045 bytes (~914.1 KB)
- **SHA-256 Checksum:** `7EFA75B0027B2D9EC6D22EDB5EE773F8EC33EAE0CE5E0BF0A0200E0E050EB173`

**Leakage & Hygiene Verification:**
- Source maps (`.map`): **0 files** (None)
- TypeScript sources (`.ts`, `.tsx`): **0 files** (None)
- Test specs (`.test.*`, `.spec.*`): **0 files** (None)
- Environment files (`.env*`): **0 files** (None)
- Git repository files (`.git*`): **0 files** (None)
- Node modules / dev tooling: **0 files** (None)

---

## 6. Test Suite Execution Summary

```
Test Files: 83 passed (83)
     Tests: 1018 passed (1018)
  Duration: 8.64s

E2E Tests:  26 passed (26)
  Duration: 13.9s
```

All 1,044 combined automated tests execute cleanly without flaky retries or timeouts.

---

## 7. Audit Findings & Recommendations

### Findings
1. **Zero High or Medium Severity Vulnerabilities:** Codebase conforms to all Manifest V3 security requirements.
2. **Strict Privacy Alignment:** Privacy disclosure accurately reflects the underlying source code.
3. **Robust Policy Gate:** Newly introduced fail-closed gate prevents unintentional autofill on emerging or unverified TTD seva paths.

### Verdict
**GO FOR HUMAN RELEASE REVIEW**  
The release package `releases/tirumala-sevapilot-v1.1.0.zip` is hardened, verified, reproducible, and ready for Chrome Web Store Developer Console upload.
