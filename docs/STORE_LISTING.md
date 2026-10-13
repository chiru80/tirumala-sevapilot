# Tirumala SevaPilot — Chrome Web Store Listing Draft

This document contains the exact metadata, descriptions, permission explanations, and privacy declarations required when submitting Tirumala SevaPilot to the Google Chrome Web Store Developer Dashboard.

---

## 1. Store Metadata

- **Extension Name:** `Tirumala SevaPilot - Devotee Companion`
- **Short Description (Max 132 chars):**  
  `Privacy-first booking companion for TTD pilgrims. Assists with devotee profile management and official portal guidance.`  
  *(Length: 119 characters)*
- **Primary Category:** `Accessibility` or `Productivity`
- **Language:** English (United States) (with multilingual side panel UI in English, Telugu, Tamil, Kannada, Hindi)
- **Version:** `1.1.0`

---

## 2. Detailed Description (Chrome Web Store Listing Body)

*(Plain text formatting suitable for Chrome Web Store markdown parser)*

```text
Tirumala SevaPilot is an independent, privacy-first companion extension designed to assist devotees booking darshan, accommodation, and sevas on the official Tirumala Tirupati Devasthanams (TTD) web portals.

Preparing booking details in advance helps devotees avoid stressful typing errors during fast-moving monthly quota releases. Tirumala SevaPilot keeps your family and group details organized offline on your own device and assists you directly on the official booking pages.

KEY FEATURES:

1. OFFLINE-FIRST DEVOTEE PROFILES
Save devotee details (Name, Age, Gender, Photo ID type and number) securely on your computer. When official quota booking opens, fill all pilgrim rows with a single click.

2. MILITARY-GRADE ENCRYPTED BACKUPS
Export your saved profiles to an AES-GCM-256 encrypted file protected by your chosen master password with 600,000 PBKDF2 iterations. Easily restore profiles across devices without storing anything in the cloud.

3. UNOBTRUSIVE SIDE PANEL COCKPIT
Access your devotee profiles, preparation checklist, and quota countdowns right alongside the official TTD website in Chrome's dedicated Side Panel—never blocking the booking page.

4. MULTILINGUAL SUPPORT
Full user interface available in English, Telugu (తెలుగు), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), and Hindi (हिन्दी).

5. POLICY COMPLIANCE & SAFETY GUARDIAN
SevaPilot strictly enforces ethical, human-first interaction:
- Unconfirmed or newly launched services fail-closed (0 fields filled) to ensure strict portal alignment.
- Srivari Trust bookings remain strictly manual-only.
- Zero touch of security controls: SevaPilot NEVER automates CAPTCHA, OTP verification, payment details (cards/UPI), or final booking submission.

----------------------------------------------------------------------
IMPORTANT DISCLAIMERS & COMMUNITY DISCLOSURE:
----------------------------------------------------------------------

1. NOT AN OFFICIAL TTD EXTENSION:
Tirumala SevaPilot is an independent open-source project developed for the pilgrim community. It is NOT affiliated with, endorsed by, authorized by, or in any way officially connected with Tirumala Tirupati Devasthanams (TTD).

2. NO GUARANTEE OF SUCCESS:
This extension is an accessibility and typing assistance tool. It DOES NOT guarantee quota availability, ticket confirmation, or transaction completion. Booking success depends entirely on official TTD quota availability and payment gateway processing.

3. NO QUEUE OR CAPTCHA BYPASS:
This extension DOES NOT bypass waiting rooms, modify queue tokens, evade rate limits, solve CAPTCHAs, or intercept one-time passwords (OTP). Devotees must solve all CAPTCHAs and enter all OTPs and payment credentials manually.

4. 100% PRIVATE & OFFLINE:
Your data stays entirely on your computer. Tirumala SevaPilot transmits NO devotee information, identity details, or browsing data to any external server or analytics service.
```

---

## 3. Chrome Web Store Permission Justifications (For Reviewers)

When requested by the Chrome Web Store submission questionnaire:

| Permission | Justification for Chrome Web Store Reviewers |
| :--- | :--- |
| `storage` | Required to store pilgrim profile information (names, age, gender, ID details) and user preferences locally on the devotee's device via `chrome.storage.local`. No data is synced or sent to remote servers. |
| `sidePanel` | Required to display the companion interface side-by-side with official TTD booking tabs via Chrome's native Side Panel API without injecting intrusive floating UI into the page. |
| `scripting` | Required to assist devotees by highlighting form fields and populating saved devotee details into official Angular form inputs upon explicit devotee request. |
| `contextMenus` | Provides devotees with right-click context menu options to quickly autofill saved pilgrim details directly from the input fields on official TTD pages. |
| `host_permissions`<br>`https://ttdevasthanams.ap.gov.in/*`<br>`https://tirupatibalaji.ap.gov.in/*` | Strictly restricted to the two official TTD booking domains. Required to detect when the devotee is on an official booking workflow and assist with form field entry. |

---

## 4. Privacy Practices Questionnaire Declarations

### 4.1 Single Purpose Declaration
> *"Tirumala SevaPilot assists pilgrims with offline devotee profile management and guided form entry on official Tirumala Tirupati Devasthanams (TTD) booking portals."*

### 4.2 Data Collection & Usage Declarations
- **Personally Identifiable Information (PII):** Yes (Pilgrim names, ID numbers, age, gender).  
  *Handling:* Stored **exclusively locally on the user's computer** via `chrome.storage.local`. Never collected by the developer, never transmitted over the network, never sent to external servers.
- **Health Information:** Not collected.
- **Financial & Payment Information:** Not collected. (Extension explicitly ignores payment inputs).
- **Authentication Information:** Not collected. (Extension explicitly ignores passwords and OTPs).
- **Personal Communications:** Not collected.
- **Location:** Not collected.
- **Web History:** Not collected. (Extension only matches two declared official host origins).
- **User Activity:** Not collected. (Zero analytics, zero tracking).
- **Website Content:** Not collected.

### 4.3 Policy Certifications
- [x] **I confirm that my extension adheres to the Chrome Web Store Developer Program Policies.**
- [x] **I certify that data is not sold to third parties.**
- [x] **I certify that data is not used or transferred for purposes unrelated to the item's core functionality.**
- [x] **I certify that data is not used or transferred to determine creditworthiness or for lending purposes.**

---

## 5. Support & Links

- **Support Email:** `chiru80@users.noreply.github.com` (or project maintainer email)
- **Support / Issue URL:** `https://github.com/chiru80/tirumala-sevapilot/issues`
- **Public Privacy Policy URL:**  
  `https://github.com/chiru80/tirumala-sevapilot/blob/master/docs/PRIVACY_AND_SECURITY_DISCLOSURE.md`
- **Source Code Repository:** `https://github.com/chiru80/tirumala-sevapilot`

---

## 6. Store Asset Specifications (Generated & Ready in `store-assets/`)

All required visual assets are prepared, generated from the production build, and available in `store-assets/`:

- **Store Icon (128x128 PNG):**
  - Path: `store-assets/icons/icon128.png` (and `public/icons/icon128.png`)
  - Resolution: `128x128` pixels (46.1 KB)
  - Compliant with Chrome Web Store icon specifications.

- **Small Promotional Tile (440x280 PNG):**
  - Path: `store-assets/promo/promo-small-440x280.png`
  - Resolution: `440x280` pixels (66.1 KB)
  - Shows extension branding, offline devotee highlights, and independent status.

- **Marquee Promotional Banner (1400x560 PNG):**
  - Path: `store-assets/promo/promo-marquee-1400x560.png`
  - Resolution: `1400x560` pixels (395.5 KB)
  - Large store banner highlighting peace-of-mind quota preparation and non-negotiable safety boundaries.

- **Production Screenshots (1280x800 PNG):**
  - *Screenshot 1:* `store-assets/screenshots/screenshot-1-booking-cockpit-1280x800.png`  
    Official TTD Portal side-by-side with SevaPilot Side Panel Booking Cockpit & Quota Countdown.
  - *Screenshot 2:* `store-assets/screenshots/screenshot-2-pilgrim-manager-1280x800.png`  
    Devotee Profile Manager showing offline family groups, masked ID numbers, and readiness validation.
  - *Screenshot 3:* `store-assets/screenshots/screenshot-3-privacy-and-settings-1280x800.png`  
    Settings page showing local-only storage controls and the Danger Zone data erasure triggers.
  - *Screenshot 4:* `store-assets/screenshots/screenshot-4-encrypted-backup-1280x800.png`  
    Military-grade AES-GCM-256 backup export/restore interface with master password protection.
