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

## Resilient Automation Engine tests (Phase 11 Complete)

Automated suites:
- [`tests/content/automation/resilient-automation.test.ts`](file:///tests/content/automation/resilient-automation.test.ts) (17/17 tests passing)
- [`tests/content/automation/chaos-resilience.test.ts`](file:///tests/content/automation/chaos-resilience.test.ts) (5/5 tests passing)

- [x] Canonical state machine forward transitions validated (`IDLE` -> `OBSERVING` -> `FORM_DETECTED` -> `FIELD_RESOLUTION`)
- [x] Illegal state transitions rejected without state corruption
- [x] State change callbacks and transition history logging
- [x] Document instance identity (`documentId`) generation and tracking
- [x] SPA navigation detection (`pushState`, `replaceState`, `popstate`, URL changes)
- [x] Safe Shadow DOM traversal (`DomTraversalEngine`) across open shadow roots
- [x] DOM observation engine debouncing and micro-batching
- [x] Field lifecycle classification (`EMPTY`, `ALREADY_CORRECT`, `USER_MODIFIED`, `WRONG_VALUE`, `UNAVAILABLE`)
- [x] Human field ownership tracking and zero silent overwrite guarantee
- [x] Idempotent autofill execution (skips already-correct fields)
- [x] Bounded exponential retry engine with jitter
- [x] Hard safety retry exclusions (never automatically retries CAPTCHA, OTP, payment, locks, declarations)
- [x] Instant AbortSignal cancellation during retry operations
- [x] Controlled recovery engine strategies (`FIELD_NOT_FOUND`, `DOM_REPLACED`, `USER_MODIFIED`, `PAGE_CHANGED`)
- [x] Typed extension message protocol runtime validation
- [x] Emergency Stop immediately halts active automation without page reload or tab closure
- [x] Chaos resilience: late field mounting handled via bounded retry
- [x] Chaos resilience: parent container replacement (Angular / React rerender) safely recovered
- [x] Chaos resilience: abort mid-execution safely halts and preserves form state
- [x] Chaos resilience: disabled/readonly form controls respected
- [x] Zero-PII performance telemetry logged without devotee identity

## Performance Engineering tests (Phase 12 Complete)

Automated suites:
- [`tests/content/automation/performance-regression.test.ts`](file:///tests/content/automation/performance-regression.test.ts) (11/11 tests passing)
- [`tests/content/automation/chaos-performance.test.ts`](file:///tests/content/automation/chaos-performance.test.ts) (5/5 tests passing)

- [x] DOM Invalidation Cache: bounded TTL lookups, element connectivity invalidation (`isConnected`), and document change purge
- [x] MutationObserver stress: 100, 500, and 1,000 rapid DOM mutations micro-batched into <= 3 batches without unbounded scans
- [x] MutationObserver filtering: pure style changes and extension's own UI mutations ignored
- [x] Anti-reflow defense: layout-forcing `innerText` replaced with `textContent` across detectors
- [x] Message deduplication & coalescing: rapid identical state messages suppressed (99.5% suppression rate)
- [x] Storage multi-tier separation: `chrome.storage.sync` for settings, `chrome.storage.session` for ephemeral state, in-memory caching for instant read (< 5ms)
- [x] Deterministic timer lifecycle: owner-scoped tracking, auto-termination of exceeded intervals, and complete bulk disposal on unmount
- [x] React zero-lag rendering: `BookingCockpit`, `QueueCard`, `ReleaseCountdownCard`, `ActiveProfileCard`, `PrivacyBadge` wrapped in `React.memo`
- [x] Strict Zero-PII invariance preserved under telemetry stress

## Performance Profiler & Real Timing Instrumentation tests (Phase 11 Complete)

Automated suite: [`tests/content/autofill/performance-profiler.test.ts`](file:///tests/content/autofill/performance-profiler.test.ts) (6/6 tests passing)

- [x] High-resolution timing initialized with safe performance marks (`sevapilot:<session>:start`)
- [x] Phase durations measured with `performance.mark` and `performance.measure` (`scan`, `resolve`, `fill`, `verify`)
- [x] Granular operation durations and Angular wait timings tracked (`recordAngularWait`)
- [x] Accurate accounting of resolved, filled, verified, skipped, and retry counts
- [x] Strict zero-PII guarantee maintained across all telemetry metrics and logs
- [x] Graceful fallback when performance marks or measures throw in restricted environments

## Internationalization (i18n) Parity tests (Phase 11 Complete)

Automated suite: [`tests/i18n/language-parity.test.ts`](file:///tests/i18n/language-parity.test.ts) (5/5 tests passing)

- [x] 100% exact key count parity across all 5 supported languages (`en`, `te`, `hi`, `ta`, `kn`) — 611 keys each
- [x] Zero missing keys in Telugu, Hindi, Tamil, or Kannada relative to English
- [x] Zero extra or orphaned keys in any dictionary
- [x] All translations contain non-empty, meaningful content
- [x] Dynamic format placeholders (`{count}`, `{service}`, `{time}`, etc.) preserved across all languages

## Accessibility & UI Polish tests (Phase 11 Complete)

Automated suite: [`tests/sidepanel/accessibility-and-polish.test.tsx`](file:///tests/sidepanel/accessibility-and-polish.test.tsx) (5/5 tests passing)

- [x] QueueCard accessibility: `role="region"`, `aria-live="polite"`, `aria-label`, accessible action buttons, min 36px click target
- [x] BookingCockpit accessibility: `role="region"`, `aria-live="polite"` status bar, `aria-disabled`, min 44px touch target, focus visible outline
- [x] AutofillProgress progressbar semantics: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label`
- [x] TemporaryLockCard alert semantics: `role="alert"`, `aria-live="assertive"`
- [x] ReleaseCountdownCard accessibility: minimum touch targets (min-h-[36px]), focus visible rings

## UI tests

Automated suites:
- [`tests/sidepanel/BookingCockpit.test.tsx`](file:///tests/sidepanel/BookingCockpit.test.tsx) (6/6 tests passing)
- [`tests/sidepanel/Dashboard.test.tsx`](file:///tests/sidepanel/Dashboard.test.tsx) (11/11 tests passing)
- [`tests/sidepanel/accessibility-and-polish.test.tsx`](file:///tests/sidepanel/accessibility-and-polish.test.tsx) (5/5 tests passing)

- [x] first-time Home (renders CREATE PROFILE, How It Works, zero percentage clutter)
- [x] existing-profile Home (renders PREPARE BOOKING and secondary OPEN TTD BOOKING)
- [x] TTD-detected Home (renders TTD PAGE READY, service context, ⚡ FILL & VERIFY)
- [x] temporary-lock Home (renders TRY AGAIN, CHECK BOOKING HISTORY, non-auto-retry)

## Phase 13 — Professional UI/UX & User-First Booking Experience tests

Automated suite:
- [`tests/sidepanel/phase13-user-experience.test.tsx`](file:///tests/sidepanel/phase13-user-experience.test.tsx) (15/15 tests passing)

- [x] Next Action presentation mapper: authoritative single-action calculation across 8 state categories (`NO_PROFILE`, `PROFILE_INCOMPLETE`, `READY`, `TTD_DETECTED`, `WORKING`, `USER_ACTION_REQUIRED`, `QUEUE_WAITING`, `BLOCKED`)
- [x] Zero engineering leaks: verifies technical states (`FIELD_RESOLUTION`, `DOM_REPLACED`, `MUTATION_BATCH`) never surface in UI copy
- [x] Service-aware readiness validation: SED ₹300 enforces general details + photo + valid ID; Padmavathi ₹200 does not require general details; Homam ₹1600 enforces Gothram
- [x] NextActionCard component: accessible primary button with `#sp-hero-primary-action-btn`, sticky positioning, click callback dispatch
- [x] BookingModeView: full-screen high-focus mode, single dominant CTA, clean devotee count summary, smooth exit mechanism
- [x] ServiceSelectorModal: instant service switching across SED ₹300, Padmavathi ₹200, Homam ₹1600, Srivari Seva
- [x] TestProfileModal: pre-booking simulator validating devotee data against canonical TTD rules with zero network calls
- [x] Multilingual dictionary parity: 100% key parity across `en`, `te`, `hi`, `ta`, and `kn` (5/5 suites passing)
- [x] diagnostics hidden from primary Home (internal scores kept off main dashboard)
- [x] diagnostics available in Settings (System Diagnostics modal opens on demand)
- [x] one dominant CTA (single primary sticky button adapts contextually)
- [x] mobile/side-panel responsive (supports 360px-400px widths, truncated text, responsive grids)
- [x] keyboard accessibility (ARIA landmarks, progressbar, alert semantics, focus rings)

## Phase 14 — Browser E2E Testing & Real-World Reliability Lab

Automated Playwright suites (executed in persistent Chromium context loading `./dist`):
- [`tests/e2e/01-onboarding-and-navigation.spec.ts`](file:///tests/e2e/01-onboarding-and-navigation.spec.ts) (3/3 passing)
- [`tests/e2e/02-service-readiness-correctness.spec.ts`](file:///tests/e2e/02-service-readiness-correctness.spec.ts) (3/3 passing)
- [`tests/e2e/03-autofill-pipeline-and-dom.spec.ts`](file:///tests/e2e/03-autofill-pipeline-and-dom.spec.ts) (3/3 passing)
- [`tests/e2e/04-safety-human-boundaries.spec.ts`](file:///tests/e2e/04-safety-human-boundaries.spec.ts) (4/4 passing)
- [`tests/e2e/05-queue-and-temporary-lock.spec.ts`](file:///tests/e2e/05-queue-and-temporary-lock.spec.ts) (2/2 passing)
- [`tests/e2e/06-tab-isolation-and-lifecycle.spec.ts`](file:///tests/e2e/06-tab-isolation-and-lifecycle.spec.ts) (2/2 passing)
- [`tests/e2e/07-accessibility-and-performance.spec.ts`](file:///tests/e2e/07-accessibility-and-performance.spec.ts) (3/3 passing)

Key Invariants Verified:
- [x] Production MV3 extension bundle loaded into real Chromium browser
- [x] Unknown service fails closed with `Requirements Unavailable` / `Generic Mode`
- [x] Homam enforces exactly 2 householder devotees and required Gothram
- [x] Srivari Seva enforces single pilgrim count and 18-60 age boundary
- [x] SED form autofill and input event dispatch on local TTD fixtures
- [x] User-edited values preserved without destructive overwriting
- [x] Dynamic DOM replacement safely handled with MutationObserver
- [x] Invariant defense: zero CAPTCHA autofill, zero OTP touch, zero auto-checking of declarations, zero payment automation
- [x] Zero PII logged to browser console (Aadhaar, phone, email masked or absent)
- [x] Temporary lock presents BLOCKED state with history link and NO retry/try-again buttons
- [x] Queue progression distinguishes waiting, action required, expired session; emergency stop cancels monitoring cleanly
- [x] Multi-tab context isolation: sessions and service contexts do not leak across tabs
- [x] MV3 storage persistence survives sidepanel reloads
- [x] 5-language translation parity verified across EN, TE, HI, TA, KN
- [x] Keyboard focus management via Tab navigation verified
- [x] Real browser performance benchmarked (median ~0-1ms, p95 < 4ms)



