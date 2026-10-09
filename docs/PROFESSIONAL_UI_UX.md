# Tirumala SevaPilot — Professional UI/UX & User-First Booking Experience (Phase 13)

## 1. Executive Summary

Phase 13 transforms SevaPilot from a technically robust Chrome MV3 automation system into an effortless, serene, and consumer-grade booking companion.

Following the core product principle:
> **"Every user should immediately understand what SevaPilot is, what they need to do, and what happens next."**

Phase 13 hides the intricate engineering complexity developed in Phases 1–12 (DOM caches, MutationObserver batching, shadow DOM traversals, queue token monitors) behind a calm, authoritative, and user-first visual interface.

---

## 2. Core UX Innovations

### A. The Next Action Presentation Engine (`src/sidepanel/presentation/next-action.ts`)
Instead of presenting users with disconnected indicators, telemetry graphs, or confusing diagnostic scores (e.g. "80% ready", "4 of 6 checks passed"), the screen is anchored by **ONE dominant Next Action Card**:

| Product State | User-Facing Status | Headline | Description | Primary CTA |
| :--- | :--- | :--- | :--- | :--- |
| **NO_PROFILE** | Setup Needed | Complete your profile | Add pilgrim details once to prepare for fast booking. | `CREATE PROFILE` |
| **PROFILE_INCOMPLETE** | Devotees Needed | Select devotees to book for | Choose devotees from your profile for {service}. | `SELECT PILGRIMS` |
| **READY (No TTD tab)** | Ready to Book | You're ready | Your details are prepared. Open TTD when booking opens. | `PREPARE BOOKING` / `OPEN TTD` |
| **TTD_DETECTED** | Ready to Book | Booking page detected | Your details are prepared to fill for {service}. | `⚡ FILL & VERIFY` |
| **WORKING** | Filling Form | Preparing your details… | Safely entering details for Pilgrim 1… | `Stop Autofill` (Emergency abort) |
| **USER_ACTION_REQUIRED** | Action Needed | Your action is needed | Complete the CAPTCHA / OTP / Payment on TTD. | `Continue on TTD` |
| **QUEUE_WAITING** | In Queue | You're in the queue | Safe queue monitoring is active. Official wait: ~12 mins. | `Stop Monitoring` |
| **BLOCKED (Temp Hold)** | Temporarily Blocked | Previous booking attempt active | TTD holds slot tokens before releasing. Check history. | `CHECK BOOKING HISTORY` / `TRY AGAIN` |
| **COMPLETED** | Verified | Details verified | Review all filled details on TTD before continuing. | `Review on TTD` |

### B. Strict Abstraction of Engineering Internals
No internal technical machine states are ever leaked to the UI:
- ❌ Never displayed: `FIELD_RESOLUTION`, `DOM_REPLACED`, `INTERACTION_STABILIZED`, `MUTATION_BATCH`, `EVENT_COALESCING`, `PASSIVE_OBSERVER`.
- ✅ Displayed: "Preparing your details…", "Checking details…", "Verified".

### C. Service-Aware Readiness (No Arbitrary Percentages)
Readiness is computed strictly based on `CanonicalServiceRegistry`:
- **Special Entry Darshan ₹300**: Checks Pilgrim Name, Age, Gender, Valid Photo ID, and General Details (Email, City, State, 6-digit Pincode).
- **Padmavathi Supadham Entry ₹200**: No General Details step required; validates Pilgrim details and Photo ID only.
- **Sri Srinivasa Divyanugraha Homam ₹1600**: Mandatory Gothram check for Sankalpam.
- **Srivari Seva**: Pilgrim age within valid seva bracket (18–60) and single pilgrim constraint.

### D. Signature "Booking Mode" (`src/sidepanel/components/dashboard/BookingModeView.tsx`)
A high-focus mode designed specifically for high-stress quota drops:
- Strips out tabs, headers, side distractions, and secondary tools.
- Displays service badge, devotee count, and a dominant, unmistakable `⚡ FILL & VERIFY` trigger.
- Prominently displays the **Zero Automation Boundary Notice**: Reminding the user that CAPTCHA, OTP, and payments remain strictly in their control.

### E. Simplified 3-Tab Architecture
Navigation is streamlined to 3 clean destinations:
1. **Home (`dashboard`)**: Next Action Hero, active service badge, active profile summary, and "How it works" trust banner.
2. **Profile (`profiles`)**: Create, edit, duplicate, and validate pilgrim records with instant inline feedback.
3. **More (`more`)**: Dedicated hub for secondary features:
   - "Test My Profile" Pre-Booking Simulator
   - Release Calendar & Notification settings
   - Language Selector (`English`, `తెలుగు`, `हिन्दी`, `தமிழ்`, `ಕನ್ನಡ`)
   - Backup & Restore (.json export/import)
   - Diagnostic Report & Keyboard shortcuts
   - Security & Privacy declarations

---

## 3. Human Trust & Security Preservation

Phase 13 maintains the inviolable Phase 9 and Phase 10 security boundaries:
1. **Zero Automation of CAPTCHA**: Users are explicitly prompted to solve the CAPTCHA themselves.
2. **Zero Automation of OTP**: SMS/WhatsApp OTP inputs remain strictly user-controlled.
3. **Zero Payment Automation**: Bank/UPI selection and transaction completion are strictly user-directed.
4. **Passive Queue Monitoring**: Queue token observation is strictly passive with zero token replay or fake heartbeat generation.
5. **PII Masking**: All pilgrim identifiers are masked in memory and logs; zero unencrypted telemetry transmitted.
