# Tirumala SevaPilot — Policy-Compliant Booking Assistant (Phase 15)

## 1. Executive Summary & Policy Boundary

Tirumala SevaPilot is designed as a **privacy-first devotee companion** committed to strict compliance with Tirumala Tirupati Devasthanams (TTD) published booking rules, anti-bot protections, and security policies.

In May 2026, TTD announced that **autofill and automated copy-paste mechanisms were abolished for Srivani Trust darshan bookings** to curb unauthorized automated reservations and protect genuine pilgrims.

In full alignment with this directive, SevaPilot establishes authoritative policy boundaries:
1. **Zero Autofill for Srivani**: Automated DOM injection and automated clipboard filling are permanently blocked at the content-script engine level for Srivani Trust.
2. **Fail-Closed on Unconfirmed Services**: Any service not explicitly verified and permitted fails closed in manual mode.
3. **Dedicated Manual-Entry Assistant**: Replaces automated filling with a field-by-field reference checklist that devotees consult while manually typing their details on the official TTD portal.
4. **Strict Human Boundaries**: CAPTCHA, OTP, declarations, payment gateways, and final booking submissions remain 100% human-controlled.
5. **No Affiliation / No Endorsement**: SevaPilot is an independent open-source assistant and is neither affiliated with nor endorsed by TTD.

---

## 2. Canonical Automation Policies

Every service in the Canonical Service Registry (`src/services/canonical-service-registry.ts`) is explicitly governed by an automation policy:

| Service ID | Service Name | Automation Policy | User Workflow |
|---|---|---|---|
| `special-entry-darshan-300` | Special Entry Darshan (₹300) | `PERMITTED_USER_INITIATED` | User-initiated autofill & verification on active TTD tab |
| `padmavathi-darshan-200` | Sri Padmavathi Ammavari Darshan (₹200) | `PERMITTED_USER_INITIATED` | User-initiated autofill & verification on active TTD tab |
| `divyanugraha-homam-1600` | Sri Srinivasa Divyanugraha Homam (₹1600) | `PERMITTED_USER_INITIATED` | User-initiated autofill (requires exact 2 householders & Gothram) |
| `srivari-seva` | Srivari Seva General Enrollment | `PERMITTED_USER_INITIATED` | User-initiated autofill (exact 1 devotee, 18–60 age verification) |
| `srivani-trust` | Srivani Trust Donation & Darshan | `RESTRICTED_MANUAL_ONLY` | **Autofill blocked.** Manual-Entry Assistant active |
| `unknown-*` | Any Unrecognized / Unconfirmed Service | `UNCONFIRMED_FAIL_CLOSED` | **Autofill blocked.** Fallback to generic manual checklist |

### Engine Enforcement
At the root of the autofill pipeline (`src/content/autofill/autofill-manager.ts`), the policy guard verifies permission before executing any DOM action:
```typescript
const policy = getServiceAutomationPolicy(request.serviceId);
if (policy !== 'PERMITTED_USER_INITIATED') {
  logger.warn(`Autofill blocked for service '${request.serviceId}' under automation policy: ${policy}`);
  return {
    success: false,
    status: 'error',
    error: `Autofill is restricted for service '${request.serviceId}' per TTD booking policy.`
  };
}
```

---

## 3. Manual-Entry Assistant Experience

When a devotee selects Srivani Trust, SevaPilot dynamically adapts the entire interface:
- **Primary CTA**: Replaces `⚡ FILL & VERIFY` with `📋 OPEN MANUAL ASSISTANT`.
- **Policy Notice**: Displays the prominent notice: *“In accordance with TTD's May 2026 announcement, autofill and automated copy-paste mechanisms were abolished for Srivani bookings.”*
- **Step-by-Step Guidance**: Presents devotees one by one with sequential field values (Full Name, Age, Gender, Photo ID Proof type).
- **Interactive Checklist**: Devotees can tick items as `Mark entered` to track progress across large family groups without losing their place.
- **Privacy Masking**: Photo ID numbers are masked by default as `•••• •••• {last4}` with a deliberate devotee toggle to reveal digits.
- **Zero Automated Clipboard Actions**: Does not auto-copy or inject text into the operating system clipboard.

---

## 4. Strict Human Security Boundaries (Zero Automation)

SevaPilot strictly respects all TTD security checkpoints through non-negotiable boundaries:

```
┌────────────────────────────────────────────────────────┐
│               TTD SECURITY CHECKPOINTS                 │
├──────────────────────┬─────────────────────────────────┤
│ Checkpoint           │ SevaPilot Boundary Enforcement  │
├──────────────────────┼─────────────────────────────────┤
│ CAPTCHA Verification │ STRICT ZERO AUTOMATION          │
│                      │ Never solved, touched, or bypassed│
├──────────────────────┼─────────────────────────────────┤
│ Mobile SMS OTP       │ STRICT ZERO AUTOMATION          │
│                      │ Never intercepted, read, or transmitted│
├──────────────────────┼─────────────────────────────────┤
│ Devotee Declarations │ STRICT ZERO AUTOMATION          │
│                      │ Never auto-checked; human must review│
├──────────────────────┼─────────────────────────────────┤
│ Bank Payment Gateway │ STRICT ZERO AUTOMATION          │
│                      │ Never automated; devotee completes safely│
├──────────────────────┼─────────────────────────────────┤
│ Virtual Queue Token  │ PASSIVE MONITORING ONLY         │
│                      │ Zero burst polling, zero queue jumping│
├──────────────────────┼─────────────────────────────────┤
│ Temporary Lock Hold  │ ZERO RETRY AUTO-CLICK           │
│                      │ Retry buttons removed to prevent hold extension│
└──────────────────────┴─────────────────────────────────┘
```

A dedicated **Safe Session Guidance Modal** (`SafeSessionGuidanceModal.tsx`) educates devotees on each checkpoint, explaining why TTD enforces it and how to proceed safely.

---

## 5. Devotee Privacy & Zero-PII Guarantee

1. **Local-First Storage**: All devotee profiles, names, and identification proofs reside exclusively within the user's browser via `chrome.storage.local`. No devotee data is ever sent to external cloud servers.
2. **Recursive Log Sanitization**: The logging subsystem (`src/shared/logger.ts`) runs recursive sanitization across all log calls:
   - 12-digit Aadhaar numbers masked as `•••• •••• {last4}`.
   - 10-digit mobile numbers masked as `••••••{last4}`.
   - Sensitive devotee fields (`idNumber`, `mobile`, `name`, `email`, `address`, `passportNumber`) replaced with `[REDACTED_PII]`.
3. **No Network Telemetry**: Zero analytics, trackers, or telemetry SDKs are bundled into the extension.

---

## 6. Official Information Verification & Transparency

All upcoming release notifications and quota calendars rendered in `UpcomingReleasesCard.tsx` adhere to strict verification standards:
- **Verified Domains**: Official links are restricted exclusively to authorized TTD web properties: `ttdevasthanams.ap.gov.in` and `news.tirumala.org`.
- **Publication Metadata**: Clear display of official publication date, source domain, and verification status.
- **Unconfirmed Date Indicators**: Clearly distinguishes between officially confirmed dates and unconfirmed recurring release estimates.

---

## 7. 5-Language Accessibility & Localization Parity

All Phase 15 features, policy banners, manual entry instructions, and safe session guidance are fully localized with 100% key parity across all 5 supported languages:
- **English (EN)**
- **Telugu (TE)**
- **Hindi (HI)**
- **Tamil (TA)**
- **Kannada (KN)**

Zero untranslated keys, zero raw translation identifiers in user-facing surfaces.
