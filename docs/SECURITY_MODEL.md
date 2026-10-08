# Tirumala SevaPilot — Security Model & Extension Trust Boundaries

## 1. Core Principle
> **"TRUST NOTHING FROM THE WEB PAGE."**
> 
> TTD DOM content is untrusted input. External release content is untrusted input. Extension messages are untrusted until validated. Persisted data is untrusted until validated. Navigation URLs are untrusted until validated.

---

## 2. Threat Model & Adversary Profiles

| Threat / Vector | Potential Impact | SevaPilot Architectural Defense |
| :--- | :--- | :--- |
| **Hostile / Modified TTD DOM** | Deceptive input fields (fake password, CVV, OTP, or CAPTCHA targets masquerading as devotee name/age). | `isForbiddenAutofillTarget` strictly inspects attributes (`type="password"`, `autocomplete`, name/id/label patterns) and rejects sensitive targets. Never forces disabled/readonly. |
| **Content Script Compromise** | Malicious script in tab context attempting privilege escalation via background messages. | `isInternalExtensionContext` blocks message senders with `sender.tab`. Privileged operations (`GET_PROFILES`, `SAVE_PROFILE`, `DELETE_PROFILE`, `SAVE_SETTINGS`) are exclusively accessible by internal extension pages (`sidepanel`, `popup`, `options`). |
| **Prototype Pollution** | Stored or parsed JSON injecting `__proto__`, `constructor`, or `prototype` to alter application prototypes. | `stripPrototypePollution` recursively strips forbidden prototype keys before objects enter application state or storage. |
| **Stored XSS** | Malicious devotee name, address, or release note injecting `<script>` or `<img>` onerror payloads into sidepanel UI. | `sanitizeText` strips HTML angle brackets (`<>`), control characters, and length-bounds strings. UI is rendered via React JSX escaping without `dangerouslySetInnerHTML`. |
| **Unsafe Navigation** | Phishing links or `javascript:` / `data:` pseudo-protocols triggered from release feeds or buttons. | `isSafeNavigationUrl` and `safeOpenUrl` strictly enforce HTTPS and an allowlist of official TTD origins (`ttdevasthanams.ap.gov.in`, `tirupatibalaji.ap.gov.in`, `news.tirumala.org`, `tirumala.org`). |
| **Data Leakage & PII in Logs** | Devotee Aadhaar, mobile, passwords, payment info, or photo data URIs leaked into console logs or error reports. | Structured `logger.ts` redacts Aadhaar (******{last4}), mobile (******{last2}), credentials, card numbers, bearer tokens, and base64 Data URIs (`[IMAGE_DATA_URI:REDACTED]`). |
| **Malicious File Uploads** | Devotee photo upload embedding executable code (`.jpg.exe`), SVGs with JavaScript, or memory-exhaustion bombs. | `validateDevoteePhotoFile` enforces 500 KB maximum size, strict JPEG/PNG MIME verification, and rejects multiple/executable extensions. |

---

## 3. Trust Boundaries & Context Isolation

```
   ┌─────────────────────────────────────────────────────────┐
   │             Untrusted Web Page (TTD DOM)                │
   │  - Page scripts, hostile inputs, deceptive attributes    │
   └───────────────────────────▲─────────────────────────────┘
                               │  DOM access only
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │           Content Script (Isolated World)               │
   │  - Scans DOM with isForbiddenAutofillTarget guards      │
   │  - CANNOT read or write chrome.storage profiles         │
   │  - CANNOT trigger privileged extension operations       │
   └───────────────────────────▲─────────────────────────────┘
                               │  runtime.sendMessage (sender.tab marked)
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │            Background Service Worker                    │
   │  - isInternalExtensionContext(sender) barrier           │
   │  - Rejects storage access from sender.tab callers       │
   │  - Strict schema validation on all routed messages      │
   └───────────────────────────▲─────────────────────────────┘
                               │  Internal extension messaging (no tab)
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │        Trusted Extension UI (Sidepanel / Popup)         │
   │  - Profile management, Preflight Engine, Guardian UI    │
   │  - Content Security Policy: script-src 'self'           │
   │  - No unsafe-eval, no inline scripts                    │
   └─────────────────────────────────────────────────────────┘
```

---

## 4. Specific Security Boundaries

### 4.1. CAPTCHA Boundary
- **Strictly Passive**: SevaPilot contains zero CAPTCHA solving, auto-clicking, token scraping, or third-party CAPTCHA solver APIs.
- **Allowed Capabilities**: Detect CAPTCHA presence, highlight for human attention, and pause automation until the devotee solves it manually.

### 4.2. OTP Boundary
- **Strictly User-Owned**: SevaPilot does not capture, store, autofill, or intercept SMS/Email OTPs.
- **Form Scanner Defense**: Any field matching OTP patterns is rejected by `isForbiddenAutofillTarget`.

### 4.3. Payment & Banking Boundary
- **Strictly Manual**: No credit card numbers, CVVs, UPI PINs, net banking credentials, or payment submission flows are stored, handled, or automated.
- **Guardian Enforcement**: Detection of payment gateway transitions the Guardian to `SUBMISSION_MANUAL` and ceases interaction.

### 4.4. Digital Queue & Virtual Waiting Room Boundary
- **Passive Waiting**: SevaPilot does not alter queue cookies, token headers, or execute aggressive refresh loops. The queue countdown remains under devotee observation.

### 4.5. Temporary Booking Lock Boundary
- **Integrity Preservation**: When TTD detects temporary rate limits (`TTD_TEMPORARY_BOOKING_LOCK`), SevaPilot halts all autofill attempts and displays cooldown countdown guidance. No automated lock bypassing, identity rotation, or retry hammering is permitted.

---

## 5. Storage & Profile Validation Policy
- All records loaded from `chrome.storage.local` pass through `validateAndSanitizeProfile` and `stripPrototypePollution`.
- Invalid or corrupted pilgrim records are safely filtered out without extension crashes.
- Corrupted profile IDs are dropped.
- **Rule of Truth**: `EMPTY > INVENTED`. Missing values remain empty/unspecified to prompt human input rather than synthesizing fake identity values.

---

## 6. Manifest & CSP Permissions Audit
- **Permissions**: `storage`, `sidePanel`, `activeTab`, `scripting`, `tabs`, `contextMenus`.
- **Host Permissions**: Strictly limited to `https://ttdevasthanams.ap.gov.in/*` and `https://tirupatibalaji.ap.gov.in/*`. No `<all_urls>`.
- **Web Accessible Resources**: Strictly limited to `icons/*` for official TTD matches.
- **CSP**: `"extension_pages": "script-src 'self'; object-src 'self'"`. Zero `unsafe-eval` or `unsafe-inline`.
