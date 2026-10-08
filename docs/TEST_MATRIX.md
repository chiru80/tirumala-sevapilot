# Tirumala SevaPilot — Phase 0 Test Matrix

## Automated baseline

Required commands:
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`

Result in Phase 0:
- Not executed by repository connector.
- Must not be represented as passed.

## Service matrix

Automated suite: [`tests/services/service-matrix.test.ts`](file:///tests/services/service-matrix.test.ts) (54/54 tests passing)
Phase 6 Hardening suite: [`tests/services/srivari-seva-hardening.test.ts`](file:///tests/services/srivari-seva-hardening.test.ts) (27/27 tests passing)

| Service | 1 | 2 | 3 | 4 | 5 | 6 | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| ₹300 Special Entry Darshan | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | General Details expected (1–6 valid) |
| ₹200 Padmavathi / Sri PAT | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | No General Details step (1–6 valid) |
| ₹1600 Divyanugraha Homam | ☒ | ☑ | N/A | N/A | N/A | N/A | Exact 2 required + Gothram mandatory |
| Srivari Seva | ☑ | ☒ | ☒ | ☒ | ☒ | ☒ | Dedicated enrollment (strictly 1 slot) |

## Workflow tests

- [x] Digital queue detection
- [x] Availability detection
- [x] Slot selection detection
- [x] Additional Services detection
- [x] Pilgrim Details detection
- [x] General Details detection after Pilgrim Details
- [x] Review detection
- [x] Payment detection without automation
- [x] Srivari instructions detection
- [x] Srivari enrollment detection
- [x] Ambiguous workflow returns UNKNOWN/uncertain

## Autofill tests

- [x] Name
- [x] Age
- [x] Gender (no default Male)
- [x] ID proof type (no default Aadhaar)
- [x] ID number
- [x] General email
- [x] City
- [x] State
- [x] Country (no default India)
- [x] PIN
- [x] Gothram
- [x] Srivari DOB & Age consistency
- [x] Srivari address (doorNumber, street, district, etc.)
- [x] Angular rerender
- [x] already-correct field is skipped safely
- [x] failed verification is repaired
- [x] disabled/read-only fields are not forced

## Safety tests

- [x] No CAPTCHA automation
- [x] No OTP automation
- [x] No payment automation
- [x] No final submission automation
- [x] No queue manipulation
- [x] No TTD temporary-lock bypass
- [x] No declaration auto-tick
- [x] No fitness-attestation auto-tick
- [x] No sensitive PII in logs (Zero-PII guarantee)

## Temporary-lock tests (Phase 8 Complete)

- [x] Lock message detected
- [x] Autofill stops
- [x] No automatic retry
- [x] No automatic refresh
- [x] User can check booking history
- [x] User can retry manually
- [x] Lock remains dedicated if still present

## Booking Guardian tests (Phase 8 Complete)

Automated suite: [`tests/services/guardian/booking-guardian.test.ts`](file:///tests/services/guardian/booking-guardian.test.ts) (25/25 tests passing)

- [x] Multi-signal page detection (CAPTCHA, OTP, Payment, Review, Success, Lock, Session Expired)
- [x] Success detected only from definitive official confirmation markers (rejects button click or disappearing form)
- [x] 10-point Preflight Verification passed for valid configurations
- [x] Preflight fails when pilgrim count exceeds service limits (SED/Padmavathi: 1–6, Homam: exact 2, Srivari: exact 1)
- [x] Preflight blocks autofill on CAPTCHA, payment, or active server lock
- [x] Single-session concurrency lock prevents duplicate / overlapping sessions
- [x] Enforces manual OTP entry without scraping or auto-fill
- [x] Preserves human payment control without manipulating payment gateways
- [x] Requires human review before manual submission
- [x] Autofill handoff executes and transitions to `SUBMISSION_MANUAL` (never auto-submits)
- [x] Partial autofill failure transitions to `USER_ACTION_REQUIRED` without exposing PII
- [x] Server-side hold during autofill transitions to `TTD_TEMPORARY_BOOKING_LOCK`
- [x] Emergency stop immediately halts autofill, retries, and marks `BLOCKED` while preserving user data
- [x] Page navigation or step transition during autofill invalidates stale session (`PAGE_CHANGED`)
- [x] Notification deduplication prevents spam on unchanged state
- [x] Zero-PII guarantee: sessions, diagnostics, and logs contain zero raw Aadhaar, phone, or identity values

## Release-data tests (Phase 7 Complete)

- [x] Official domain accepted (`news.tirumala.org`, `tirumala.org`, `ttdevasthanams.ap.gov.in`)
- [x] non-official domain rejected
- [x] stale event marked STALE and triggers refresh guidance
- [x] expired event filtered from upcoming verified releases
- [x] unconfirmed event has no countdown
- [x] exact confirmed event shows release time in IST
- [x] future event selection works and selects nearest release
- [x] past events do not appear as upcoming
- [x] strict date parsing rejects invalid calendar dates (Feb 30, Oct 32)
- [x] strict time parsing normalizes 12/24hr formats and rejects invalid times
- [x] recurring pattern engine produces EXPECTED status
- [x] official confirmed data wins over expected pattern data
- [x] change detection identifies rescheduled date/time and preserves previous dates
- [x] state transitions: RELEASE_UPCOMING, RELEASE_TODAY, RELEASE_UPDATED, RELEASE_STARTED, RELEASE_PASSED
- [x] notification deduplication suppresses repeated polling alerts
- [x] request coalescing merges concurrent fetches into single execution
- [x] cache-first and cooldown coordination
- [x] EXPIRED status and canonical ReleaseEvent completeness
- [x] zero PII leakage into release logs or cache
- [x] i18n English and Telugu verified across release intelligence

## Security Hardening tests (Phase 9 Complete)

Automated suite: [`tests/security/security-hardening.test.ts`](file:///tests/security/security-hardening.test.ts) (30/30 tests passing)

- [x] Official TTD HTTPS domains permitted (`ttdevasthanams.ap.gov.in`, `tirupatibalaji.ap.gov.in`, `news.tirumala.org`, `tirumala.org`)
- [x] Dangerous pseudo-protocols blocked (`javascript:`, `data:`, `blob:`, `file:`, `vbscript:`)
- [x] HTTP navigation rejected
- [x] Embedded user credentials in URLs rejected
- [x] Untrusted third-party domains blocked
- [x] Prototype pollution keys (`__proto__`, `constructor`, `prototype`) stripped recursively
- [x] Stored XSS tags (`<script>`, `<img onerror>`) and control characters sanitized
- [x] Devotee profile schema validated, dropping corrupted records safely
- [x] Extension message privilege isolation (`isInternalExtensionContext`) rejecting content scripts from accessing storage
- [x] Hostile DOM defense: password fields forbidden
- [x] Hostile DOM defense: hidden fields forbidden
- [x] Hostile DOM defense: disabled, readonly, and aria-disabled site controls respected
- [x] Hostile DOM defense: payment, credit card, and UPI fields strictly forbidden
- [x] Hostile DOM defense: OTP and CAPTCHA targets strictly forbidden
- [x] Legitimate devotee fields permitted with support for dynamic enable workflows
- [x] Photo file size limit (500 KB) enforced
- [x] Photo MIME types strictly restricted to JPEG and PNG (executables, SVGs rejected)
- [x] Dangerous multiple file extensions (`.exe.jpg`, etc.) rejected
- [x] Base64 image Data URIs strictly validated
- [x] Zero-PII logger redaction verified (Aadhaar, mobile, secrets, image Data URIs)

## Queue Intelligence tests (Phase 10 Complete)

Automated suite: [`tests/services/queue/queue-intelligence.test.ts`](file:///tests/services/queue/queue-intelligence.test.ts) (18/18 tests passing)

- [x] `QUEUE_NOT_PRESENT` recognized on standard non-queue booking pages
- [x] `QUEUE_WAITING` recognized upon multi-signal waiting room presence
- [x] `QUEUE_PROGRESSING` verified with official numeric queue position
- [x] `QUEUE_ERROR` recognized upon explicit TTD queue failure messages
- [x] `TTD_TEMPORARY_BOOKING_LOCK` precedence enforced (`QUEUE_BLOCKED`)
- [x] Human boundary: `QUEUE_CAPTCHA_REQUIRED` detected; zero automated CAPTCHA solving
- [x] Human boundary: `QUEUE_SESSION_EXPIRED` detected; manual re-login guidance
- [x] Truth Boundary: authentic extraction of official queue position without guessing
- [x] Truth Boundary: authentic extraction of explicit wait time without synthetic estimates
- [x] Missing wait time/position handled gracefully without fabricating numbers
- [x] Queue lifecycle: session start and passive `MutationObserver` attachment
- [x] Queue completion: detects queue disappearance (`QUEUE_COMPLETED`) and triggers callbacks for Booking Guardian hand-off
- [x] User cancellation: `stopMonitoring()` cleans up observers and timers safely
- [x] Emergency Stop: `emergencyStop()` immediately invalidates monitoring without reloading page or closing tab
- [x] Multi-tab isolation: distinct session IDs across separate browser tab instances
- [x] Security: queue tokens never logged, stored, or exposed in diagnostics
- [x] Security: malicious DOM scripts or unescaped HTML safely ignored as untrusted text
- [x] Zero Queue Bypass: strictly no queue circumvention, no token forgery, no automated refresh loops

## UI tests

- [ ] first-time Home
- [ ] existing-profile Home
- [ ] TTD-detected Home
- [ ] temporary-lock Home
- [ ] diagnostics hidden from primary Home
- [ ] diagnostics available in Settings
- [ ] one dominant CTA
- [ ] mobile/side-panel responsive
- [ ] keyboard accessibility

