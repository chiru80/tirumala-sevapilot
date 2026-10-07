# Tirumala SevaPilot — Security Baseline & Compliance Audit (Phase 0)

**Date**: 2026-10-07  
**Baseline Commit**: `0c926cb8eb558be77f9051b60ca37cd910c7587a` (`origin/master`)  
**Auditor**: Principal Security Auditor & QA Lead  

---

## 1. Chrome Extensions Manifest V3 Compliance

The project adheres strictly to Google Chrome's Manifest V3 specifications:

| Area | Implementation Details | Compliance Status |
| :--- | :--- | :--- |
| **Manifest Version** | `"manifest_version": 3` in [`manifest.json`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/manifest.json#L2) | **COMPLIANT** |
| **Background Execution** | Service Worker: `"background": { "service_worker": "src/background/service-worker.ts", "type": "module" }` | **COMPLIANT** |
| **Content Security Policy** | `"extension_pages": "script-src 'self'; object-src 'self'"` (Strictly prohibits `unsafe-eval` and remote code) | **COMPLIANT** |
| **Remote Scripts** | Zero external scripts or CDNs loaded. All assets bundled locally via Vite. | **COMPLIANT** |
| **Web Accessible Resources** | Limited to extension icons (`icons/*.png`) and `options.html`. | **COMPLIANT** |

---

## 2. Permissions & Host Permissions Audit

### A. Declared API Permissions
```json
"permissions": [
  "storage",
  "sidePanel",
  "activeTab",
  "scripting",
  "tabs",
  "contextMenus"
]
```
* **`storage`**: **Required**. Used exclusively for `chrome.storage.local` to store profiles, pilgrim details, and extension settings locally on the user's machine.
* **`sidePanel`**: **Required**. Powers the Chrome Side Panel user interface (`chrome.sidePanel.setPanelBehavior`).
* **`activeTab`**: **Required**. Grants temporary active tab interaction when user clicks the extension action.
* **`contextMenus`**: **Required**. Enables right-click context menu shortcut "Fill Pilgrim Details".
* **`scripting`**: **Under Review**. Used in `message-router.ts` line 79 to inject content scripts into pre-existing TTD tabs if the extension was installed after page load.
* **`tabs`**: **Under Review for Minimization**. Currently used in `useTtdPage.ts` and `message-router.ts` to query active tab URLs. In Phase 9, this should be evaluated for potential minimization to `activeTab` to reduce Web Store review friction.

### B. Host Permissions
```json
"host_permissions": [
  "https://ttdevasthanams.ap.gov.in/*",
  "https://tirupatibalaji.ap.gov.in/*"
]
```
* **Audit Finding**: Host permissions are strictly constrained to the two official TTD production domains. Broad wildcards (e.g. `<all_urls>` or `*://*/*`) are **NOT** used.

---

## 3. Data Privacy & Zero-PII Telemetry Guarantee

1. **Local-Only Storage**: All profile and pilgrim records reside exclusively in `chrome.storage.local`.
2. **Zero Remote Transmission**: The codebase contains **no external fetch calls**, analytics endpoints, tracking SDKs, or remote logging services.
3. **Regex-Sanitizing Structured Logger**: [`src/shared/logger.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/shared/logger.ts) enforces active pattern matching to mask:
   - 12-digit Aadhaar numbers (`******{last4}`)
   - Passports (`PASSPORT:****`)
   - 10-digit Indian mobile numbers (`******{last2}`)
   - Email addresses (`***@***`)
   - PIN codes (`PIN:******`)
   - Passwords, OTPs, CVVs, tokens (`[REDACTED]`)
4. **Console Direct Calls**: Confirmed zero bypass of the structured logger in production workflows.

---

## 4. Cryptographic Storage & Backup Security

* **Algorithm**: Web Crypto API standard `AES-GCM` with 256-bit encryption keys.
* **Key Derivation**: `PBKDF2` with `600,000` SHA-256 iterations and 32-byte cryptographically random salt (`crypto.getRandomValues`).
* **Encrypted Backups**: Exports `.spbk` backup files containing serialized profile vaults encrypted with user-provided passphrases.
* **Automatic Migration Backups**: Schema migrations create temporary local recovery snapshots (`sp_migration_backup_v*`) that automatically clean up upon successful verification.

---

## 5. Non-Negotiable Safety Boundaries

Audit verification confirmed that the codebase strictly enforces the following boundaries:

| Safety Boundary | Audit Verification |
| :--- | :--- |
| **No CAPTCHA Bypass** | Confirmed: CAPTCHA elements are never inspected, clicked, or automated. |
| **No OTP Automation** | Confirmed: Mobile OTP inputs are never automated or intercepted. |
| **No Payment Automation** | Confirmed: Payment gateway forms and payment buttons are never automated. |
| **No Final Submission** | Confirmed: Final booking submission buttons require explicit user action. |
| **No Queue Bypass** | Confirmed: Virtual queue waiting rooms are monitored passively without polling bypass. |
| **No Booking Lock Bypass** | Confirmed: Server-side temporary locks immediately halt autofill; IDs are never manipulated. |
| **No Auto-Declarations** | Confirmed: Religious declarations and fitness attestations require manual user check. |
| **No Forced Fields** | Confirmed: Disabled or read-only DOM elements are never forcibly modified. |
