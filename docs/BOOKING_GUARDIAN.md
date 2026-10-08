# Tirumala SevaPilot — Booking Guardian (Phase 8 Architecture & Specification)

## 1. Overview & Core Philosophy

**Booking Guardian is NOT an auto-booking bot.**

Its purpose is to intelligently monitor the user's live TTD booking flow, track current page and workflow context, enforce strict preflight safety checks, and coordinate autofill assistance while preserving **uncompromising human control over every sensitive decision**.

### Core Operational Principle
```
DETECT → PREPARE → ASSIST → VERIFY → HAND OFF TO USER
```
**Never:**
```
DETECT → AUTOMATICALLY SUBMIT (PROHIBITED)
```

The human devotee remains in sovereign control of all credentials, CAPTCHA challenges, OTP verifications, declarations, fitness attestations, payment authorizations, and final booking submissions.

---

## 2. Canonical Booking State Machine

Booking Guardian establishes one authoritative, non-duplicative state machine across the lifecycle of a booking attempt:

| State | Classification | Description & Action |
|---|---|---|
| `UNKNOWN` | Neutral | Extension cannot safely determine current page or service; no automated action taken. |
| `TTD_PAGE_DETECTED` | Informational | Official TTD domain recognized (`ttdevasthanams.ap.gov.in`). |
| `SERVICE_DETECTED` | Informational | Canonical TTD service identified (SED ₹300, Padmavathi ₹200, Homam ₹1600, Srivari Seva). |
| `PROFILE_NOT_READY` | Action Required | Devotee details incomplete, missing required fields, or exceeding service party limits. |
| `READY_TO_AUTOFILL` | Ready | 10-point preflight verification passed; awaiting devotee's explicit initiation. |
| `AUTOFILLING` | Processing | Coordinated handoff to `AutofillManager` in progress; field resolver and transaction active. |
| `VERIFYING` | Processing | Validating written field values against expected profile data. |
| `AUTOFILL_COMPLETE` | Transient | Autofill and field-level verification succeeded. |
| `USER_ACTION_REQUIRED` | Boundary | Mandatory user interaction required (e.g., photo upload, manual checkbox, unresolvable field). |
| `CAPTCHA_REQUIRED` | Boundary | CAPTCHA detected on page; extension pauses and awaits devotee manual completion. |
| `OTP_REQUIRED` | Boundary | SMS OTP challenge detected; extension enforces devotee manual OTP entry. |
| `PAYMENT_REQUIRED` | Boundary | Payment gateway reached; extension halts and preserves human payment control. |
| `REVIEW_REQUIRED` | Boundary | Review summary page reached; prompts devotee to verify details before manual submission. |
| `SUBMISSION_READY` | Boundary | Pre-submission verification complete; handoff prepared. |
| `SUBMISSION_MANUAL` | Handoff | **Final state after successful autofill:** Devotee reviews details and clicks final submission manually. |
| `BOOKING_SUCCESS` | Outcome | Definitive official booking confirmation markers detected in live DOM. |
| `BOOKING_FAILED` | Outcome | Booking attempt failed (e.g. quota exhausted, validation rejected). |
| `TTD_TEMPORARY_BOOKING_LOCK` | Highest Priority Safety | Server-side lock holding pilgrim IDs detected; autofill blocked, cooldown guidance displayed. |
| `SESSION_EXPIRED` | Safety | TTD authentication session timed out; prompts devotee to re-authenticate manually. |
| `PAGE_CHANGED` | Safety | Route navigation or workflow step change detected; invalidates stale autofill session. |
| `BLOCKED` | Safety | Emergency stop triggered or critical safety prerequisite breached. |

---

## 3. Human Control Boundaries (Strict Non-Negotiables)

Booking Guardian adheres to strict security and ethical boundaries. The extension **MUST NOT and DOES NOT**:

1. **CAPTCHA Boundary:**
   - ❌ Never click, solve, or bypass CAPTCHA.
   - ❌ Never invoke external third-party CAPTCHA solving services.
   - ✅ Detects CAPTCHA presence, transitions to `CAPTCHA_REQUIRED`, highlights the challenge for the user, and waits.

2. **OTP Boundary:**
   - ❌ Never read OTP from SMS or system notifications.
   - ❌ Never scrape, intercept, or auto-enter OTPs.
   - ❌ Never submit OTP forms.
   - ✅ Transitions to `OTP_REQUIRED` and displays "Enter the OTP manually."

3. **Payment Boundary:**
   - ❌ Never enter credit/debit card numbers, CVVs, expiry dates, net banking credentials, or UPI PINs.
   - ❌ Never submit payments or interact with payment gateways.
   - ✅ Transitions to `PAYMENT_REQUIRED` and leaves all payment interactions to the user.

4. **Review & Final Submission Boundary:**
   - ❌ Never automatically click "Book Now", "Submit", "Confirm", "Proceed to Payment", or "Final Submit".
   - ❌ Never bypass disabled controls or client-side form validations.
   - ✅ Transitions to `REVIEW_REQUIRED` or `SUBMISSION_MANUAL`. Prompts: *"Everything is ready. Review and continue manually on TTD."*

5. **Legal & Medical Attestation Boundary:**
   - ❌ Never auto-tick declaration checkboxes or terms acceptance.
   - ❌ Never auto-attest health/fitness checkboxes (`mentallyFit`, `physicallyFit`).
   - ✅ Treats unconfirmed declarations as blocking conditions with `USER_ACTION_REQUIRED`.

6. **Queue & Server Safety Boundary:**
   - ❌ Never bypass digital queues or waiting rooms.
   - ❌ Never bypass server-side temporary booking locks.
   - ❌ Never rotate pilgrim IDs or alter identity values to evade holds.
   - ❌ Never spam requests or auto-refresh pages.

---

## 4. Multi-Signal Page State Detection

Booking Guardian classifies pages using live DOM evidence, form structures, and stable labels rather than relying solely on fragile URLs:

- **CAPTCHA Stage:** Detects elements matching `captcha`, `recaptcha`, `turnstile`, `hcaptcha`, `#captchaInput`, or `img[src*="captcha"]`.
- **OTP Stage:** Detects input fields with `name="otp"`, `id="otpInput"`, `maxlength="6"` alongside headers containing "OTP Verification" or "Enter OTP".
- **Payment Stage:** Detects payment iframes, gateway wrappers (`#paymentGateway`, `.payment-options`), UPI/card forms, or checkout routes.
- **Review Stage:** Detects summary confirmation tables, "Review Booking", "Verify Details", or "Declaration" sections prior to final submission.
- **Booking Success:** Strictly requires definitive official confirmation indicators (`booking-success`, `booking-confirmed`, `Transaction ID:`, `Receipt Number:`) and a confirmation print/download voucher button. Optimistic triggers (button clicks, form removals) are explicitly rejected.
- **Temporary Lock:** Detects server messages such as `"Booking with same pilgrim id is in progress"`, `"Your own previous attempt is still holding these pilgrims"`.
- **Session Expired:** Detects session timeout dialogs, "Session Expired", or "Please Login Again".

---

## 5. 10-Point Preflight Verification Engine

Before handing off execution to `AutofillManager`, Guardian executes a comprehensive 10-point preflight check:

1. **TTD Page Recognized:** Valid official TTD domain or approved local test harness.
2. **Canonical Service Identified:** Mapped via `CanonicalServiceRegistry` (never defaults unknown services silently to Special Entry).
3. **Booking Workflow Mapped:** Authoritative workflow definition available.
4. **Devotee Quota & Count Enforcement:** Validates party size against canonical limits (SED: 1–6, Padmavathi: 1–6, Homam: exactly 2, Srivari Seva: exactly 1).
5. **Required Profile Details:** Core devotee attributes (Name, Gender, Age/DOB, ID Proof Type, ID Number) validated with Verhoeff-compliant checksums.
6. **Required File Attachments:** Validates presence of mandatory photos/documents (e.g. Srivari Seva).
7. **No CAPTCHA Block:** Page must not be waiting on an unsolved CAPTCHA.
8. **No Payment Page Block:** Page must not be on a live payment gateway.
9. **Server Cooldown & Lock Guard:** Verifies absence of server-side pilgrim holds.
10. **Concurrency Check:** Confirms no other active booking session is running (prevents popup/sidepanel contention).

If any preflight check fails, autofill **does not start**, and an actionable explanation is presented to the user.

---

## 6. Coordinated Autofill Handoff Architecture

Booking Guardian coordinates without duplicating the autofill engine:

```
BookingGuardian
   │ (1. State evaluation & 10-point preflight)
   ▼
AutofillManager (executeAutofill)
   │ (2. Field scanning & row locking)
   ▼
FieldResolver
   │ (3. Angular-safe input dispatching)
   ▼
FieldTransaction
   │ (4. Independent verification)
   ▼
AutofillVerification
   │ (5. Success / Partial / Lock evaluation)
   ▼
BookingGuardian
   │ (6. Transition to SUBMISSION_MANUAL / USER_ACTION_REQUIRED)
   ▼
Devotee (Performs manual submission)
```

### Partial Failure Handling
If 5 fields are filled and 1 required field fails verification:
- State transitions to `USER_ACTION_REQUIRED` (never `BOOKING_SUCCESS`).
- Generic diagnostic label is displayed (e.g., `Required field unresolved: idProofNumber`).
- Raw PII values are strictly omitted from diagnostic messages.

---

## 7. Temporary TTD Booking Lock Handling

When TTD holds a pilgrim ID from a recent interrupted booking attempt:
- **Detected Messages:**
  - *"Booking with same pilgrim id is in progress. Please try again after some time"*
  - *"Your own previous attempt is still holding these pilgrims"*
- **State:** `TTD_TEMPORARY_BOOKING_LOCK`
- **Behavior:**
  - Autofill is immediately halted.
  - No automated retries, request hammering, or identity rotation.
  - UI displays dedicated cooldown guidance: *"Your previous booking attempt is still holding this pilgrim. TTD usually releases the lock after a few minutes."*
  - Dedicated user actions: **[Check Booking History]** and **[Try Again Manually]**.

---

## 8. Concurrency, Page Changes & Emergency Stop

1. **Single Session Guarantee:** A shared `bookingSession` lock prevents conflicting simultaneous triggers from the side panel, popup, and background scripts.
2. **Page Navigation Invalidation:** When SPA route changes, page transitions, or step progressions occur during autofill, the stale session is immediately invalidated with `PAGE_CHANGED`, and pending retries are aborted.
3. **Emergency Stop (`emergencyStop()`):**
   - Cancels active autofill execution immediately.
   - Halts all retry attempts and mutation observers.
   - Invalidates current session state and sets `BLOCKED`.
   - Preserves all human-entered form values (never auto-reloads the page or wipes user inputs).

---

## 9. Security & Zero-PII Audit

- **Zero Sensitive Data Logging:** Aadhaar numbers, passport IDs, phone numbers, email addresses, dates of birth, photos, and payment details are never logged in console outputs, session objects, or diagnostic reports.
- **Field Name Masking:** Diagnostics log abstract field keys (`name`, `idProofNumber`) rather than sensitive values.
- **Local Execution:** All state transitions and preflight evaluations execute locally in browser memory with zero external network transmission.
