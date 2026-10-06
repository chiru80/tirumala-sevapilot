# Security Architecture & Policies — Tirumala SevaPilot

Tirumala SevaPilot is built around a zero-knowledge, local-only threat model. This document details our cryptographic principles and security protections.

---

## 🔒 1. Local-Only Storage Model

- **No Remote Telemetry or Sync**: Pilgrim information (names, Aadhaar numbers, phone numbers, addresses) is **never** sent to any external server.
- All persistent data resides exclusively in `chrome.storage.local`.
- Permissions in `manifest.json` are strictly scoped to `storage`, `sidePanel`, `activeTab`, `scripting`, and host permissions limited solely to official TTD booking domains:
  - `https://ttdevasthanams.ap.gov.in/*`
  - `https://tirupatibalaji.ap.gov.in/*`

---

## 🛡️ 2. Cryptographic Architecture (AES-GCM-256)

For portable backup archives (`.spbk`) and the encrypted vault subsystem:
- **Key Derivation**: PBKDF2 with SHA-256, 600,000 iterations (exceeding OWASP guidelines).
- **Symmetric Cipher**: AES-GCM with 256-bit key length and 96-bit unique random Initialization Vector (IV).
- **Salt Generation**: 128-bit cryptographically secure pseudorandom salt (`crypto.getRandomValues`).
- **Memory Hygiene**: Crypto keys are kept in volatile JavaScript memory and cleared upon session completion.
- **Local Sandbox**: In-browser active profiles are stored in `chrome.storage.local` within the extension's protected browser sandbox.

---

## 👁️ 3. PII Masking & Console Sanitization

- Sensitive identifiers (Aadhaar, Passport, Phone numbers) are masked in UI views by default (e.g., `****-****-1234`).
- All structured logging (`src/shared/logger.ts`) implements PII scrubbing filters before printing to DevTools console.

---

## 🚫 4. Security Boundaries & Anti-Abuse Compliance

- **No CAPTCHA Bypassing**: SevaPilot does not inspect, solve, or interfere with CAPTCHAs.
- **No OTP Interception**: Users must read and type their own SMS OTPs.
- **No Payment Automations**: Users independently review and authorize banking/UPI checkout transactions.
- **No Auto-Submit**: Form autofill completes data fields, leaving the final submission click to the devotee's manual discretion.
