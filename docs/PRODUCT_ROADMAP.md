# Tirumala SevaPilot — Phase 0 Product Roadmap

## Phase 0 — Baseline
Status: COMPLETE
- Repository audit
- Architecture baseline
- Known issues
- Test matrix definition

## Phase 1 — Canonical foundation
- Introduce consumer-facing BookingReadiness / BookingContext contract.
- Keep detailed ReadinessEngine diagnostics internal.
- Define one canonical service registry/config contract.
- Resolve Srivari workflow vs adapter conflicts.
- Define service-aware field requirements.

## Phase 2 — Home / Booking Cockpit
Status: COMPLETE
- First-time Home: CREATE PROFILE.
- Existing profile: PREPARE BOOKING.
- TTD detected: service + readiness + FILL & VERIFY.
- Temporary lock: dedicated warning state.
- Remove diagnostic percentages/checklists from Home.
- Move technical diagnostics to Settings.

## Phase 3 — Service intelligence
Status: COMPLETE
- Centralize rules for ₹300 SED.
- Centralize rules for ₹200 Padmavathi/Sri PAT.
- Centralize rules for ₹1600 Homam.
- Centralize Srivari enrollment rules.
- Enforce exact service limits.
- Service × Pilgrim-Count matrix fully tested.

## Phase 4 — Ultra-fast autofill
Status: COMPLETE
- Profile/service/workflow prewarming.
- Section-scoped DOM scanning.
- Field/row caching.
- Differential fill.
- Event-driven Angular waits.
- Targeted verification and repair.
- Preserve all safety checks.

## Phase 5 — Profiles / pilgrim manager
Status: COMPLETE
- Clear 1–6 pilgrim UX.
- Service compatibility.
- Service-specific max/exact limits.
- Required-field readiness.

## Phase 6 — Srivari Seva Hardening
Status: COMPLETE
- Zero invented defaults: removed all fallback substitutions ('Aadhaar', 'Male', 'India', default address).
- Hardened Readiness Contract: explicit DomReadinessStatus (READY, PARTIALLY_READY, USER_ACTION_REQUIRED, BLOCKED, UNKNOWN).
- Strictly user-controlled: declaration and fitness attestations (mentallyFit, physicallyFit) block readiness when unconfirmed and are never auto-checked.
- Safe file input handling: missing required photo surfaces USER_ACTION_REQUIRED; zero PII / base64 leakage.
- Exact-1 devotee party size strictly enforced without leaking into other services.
- User modification protection: manual inputs preserved.
- Temporary TTD booking lock prioritized with dedicated guidance.
- Full verification suite: 27 new tests, 67 test files total (791 tests passing).

## Phase 7 — Release Intelligence
Status: COMPLETE
- Canonical release model (`ReleaseEvent`) with explicit status: `CONFIRMED`, `EXPECTED`, `ESTIMATED`, `UNKNOWN`, `STALE`, `EXPIRED`.
- Explicit confidence levels: `OFFICIAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`.
- Strict calendar-validated date parser (`release-date-parser.ts`) rejecting impossible dates (Feb 30, Oct 32).
- Strict time parser normalizing to `HH:mm` in Asia/Kolkata (IST); timezone canonicalization.
- Recurring pattern engine (`recurring-pattern-engine.ts`) generating `EXPECTED` events from verified historical schedules.
- Official confirmed data always overrides expected data immediately (`reconcileReleaseEvents`).
- Change detection engine (`release-change-detector.ts`) with rescheduling alerts and `previousReleaseDate`/`previousReleaseTime` tracking.
- Bounded, versioned schema cache (`ttd-cache.ts`) with automatic staleness detection (K01 resolved).
- Request coalescing and background fetch coordination (`ttd-fetch-coordinator.ts`).
- State notification transitions (`RELEASE_UPCOMING`, `RELEASE_TODAY`, `RELEASE_UPDATED`, `RELEASE_STARTED`, `RELEASE_PASSED`) with polling deduplication (`release-state-notifier.ts`).
- Future event filtering and nearest release selection; zero fabricated dates/times.
- Release Day Mode and preparation guidance without automating submissions, CAPTCHAs, OTPs, or payments.
- Multilingual UI support with English and Telugu translations across ticker and countdown cards.
- Comprehensive Phase 7 regression suite: 30 new tests in `release-intelligence.test.ts`, 68 test files total (825 tests passing).

## Phase 8 — Booking Guardian
Status: COMPLETE
- Canonical Guardian State Model (`src/services/guardian/types.ts`) with 21 orchestration states and 15 page stages.
- Multi-signal live DOM page classifier (`page-detector.ts`) detecting CAPTCHA, OTP, payment gateway, review page, booking success (definitive confirmation markers only), session expiration, and temporary locks.
- 10-point Preflight Verification Engine (`preflight-engine.ts`) enforcing service limits (SED/Padmavathi: 1–6, Homam: exact 2, Srivari: exact 1), required devotee data, required attachments, and concurrency limits.
- Authoritative Autofill Orchestrator (`booking-guardian.ts`) coordinating `AutofillManager` handoff and post-fill verification.
- Human Control Boundary Enforcement: strictly prohibits auto-solving CAPTCHA, auto-entering OTP, auto-submitting payments, or auto-clicking final booking submission.
- Transitions to `SUBMISSION_MANUAL` upon successful autofill verification for human review.
- Temporary TTD Booking Lock detection (`TTD_TEMPORARY_BOOKING_LOCK`) with cooldown guidance and user-initiated retry.
- Emergency Stop mechanism (`emergencyStop()`) aborting active autofill without wiping user-entered values.
- Stale session invalidation on page or route transitions (`PAGE_CHANGED`).
- Zero-PII logging guarantee throughout sessions, preflight, and diagnostic reporting.
- Comprehensive Phase 8 regression suite: 25 new tests in `booking-guardian.test.ts`, 69 test files total (850 tests passing).

## Phase 9 — Security Hardening
Status: COMPLETE
- Manifest permission minimization: host permissions strictly pinned to official TTD origins without `<all_urls>`, web_accessible_resources restricted to icons.
- URL security & safe navigation engine (`url-security.ts`): enforces strict HTTPS and whitelist of official TTD origins, blocking `javascript:`, `data:`, `blob:`, and embedded credentials.
- Message trust boundaries & privilege isolation: `isInternalExtensionContext` prevents untrusted content script tab senders from reading or mutating profile storage.
- Prototype pollution defense: `stripPrototypePollution` recursively removes `__proto__`, `constructor`, and `prototype` keys from inputs and stored data.
- Stored XSS defense: `sanitizeText` strips HTML brackets and control characters from devotee and release data.
- Hostile DOM & autofill target defense (`dom-security.ts`): `isForbiddenAutofillTarget` rigorously blocks password, payment, OTP, and CAPTCHA targets even under deceptive labels; respects site controls (`disabled`, `readOnly`, `aria-disabled`).
- File upload & Data URI validation (`file-security.ts`): 500 KB ceiling, strict JPEG/PNG MIME verification, and dangerous multiple-extension defense.
- Zero-PII logging policy (`logger.ts`): masked Aadhaar, phone numbers, credentials, card numbers, and base64 image Data URIs.
- Full Phase 9 security regression suite: 30 new tests in `security-hardening.test.ts`, 70 test files total (880 tests passing 100%).

## Phase 10 — Queue Intelligence + Safe Waiting
Status: COMPLETE
- Canonical Queue State Model (`src/services/queue/types.ts`) with 16 distinct waiting room states.
- Multi-signal detection engine (`queue-detector.ts`) combining URL markers, stable DOM selectors, and semantic text tokens.
- Strict Zero Queue Bypass policy: zero synthetic requests, zero token manipulation or replay, zero automatic refresh loops.
- Truth Boundary: authentic extraction of official queue position and explicit wait times; never fabricates numbers or estimates.
- Priority Boundaries: Temporary Booking Lock (`QUEUE_BLOCKED`), Session Expiration (`QUEUE_SESSION_EXPIRED`), and CAPTCHA (`QUEUE_CAPTCHA_REQUIRED`) take safety precedence over queue waiting.
- Safe Waiting Mode: comforts devotee with guidance, clear no-refresh warnings, and manual refresh controls.
- Passive Observation Lifecycle (`queue-manager.ts`): debounced `MutationObserver` (250ms) with bounded 6-second heartbeat fallback. Zero polling network overhead.
- Seamless Transition & Handoff: detects queue disappearance (`QUEUE_COMPLETED`), cleans up observers, and transfers authoritative control to Booking Guardian for preflight verification.
- Multi-Tab Isolation: distinct session identities prevent state collision across multiple browser tabs.
- Emergency Stop: immediate cancellation of observers and timers without reloading or closing tabs.
- Accessible Queue Card UI (`QueueCard.tsx`) with English and Telugu translations.
- Full Phase 10 regression suite: 18 new tests in `queue-intelligence.test.ts`, 71 test files total (890 tests passing 100%).

## Phase 11 — Resilient Automation Engine
Status: COMPLETE
- Canonical Automation State Machine (`src/content/automation/state-machine.ts`) with 14 strongly typed states and transition validation matrix.
- Structured Concurrency & Session Ownership: `AutomationSession` with `AbortController` owning all asynchronous tasks and operations.
- Document Identity & SPA Navigation (`document-identity.ts`): Unique instance identification (`documentId`) prevents stale automation across route changes (`pushState`, `replaceState`, `popstate`).
- Centralized DOM Observation Engine (`dom-observation-engine.ts`): Micro-batched (50ms) debounced `MutationObserver` with safe open Shadow DOM traversal (`DomTraversalEngine`).
- Field Ownership & Human Protection (`field-ownership-tracker.ts`): Real-time devotee input tracking. Marks fields as `USER_MODIFIED` and guarantees zero silent overwriting.
- Idempotent Autofill: Automatically skips `ALREADY_CORRECT` fields, eliminating redundant DOM writes.
- Resilient Retry Engine (`resilient-retry-engine.ts`): Exponential backoff with jitter and hard safety exclusion (never retries CAPTCHA, OTP, payment, locks, declarations).
- Recovery Engine (`recovery-engine.ts`): Controlled self-healing for `FIELD_NOT_FOUND`, `DOM_REPLACED`, `PAGE_CHANGED`, `USER_MODIFIED`, and `UNKNOWN_STATE`.
- Typed Message Protocol (`message-protocol.ts`): Runtime schema validation rejecting malformed payloads or mismatched session IDs.
- Zero-PII Performance Telemetry: Measures operation duration without logging devotee identity.
- Full Phase 11 Suite: 22 new tests across `resilient-automation.test.ts` and `chaos-resilience.test.ts`, 73 test files total (912 tests passing 100%).

## Phase 12 — Performance & Zero-Lag Architecture
- Memory and observer profiling.
- Request coalescing optimization.
- Cache warming and storage batching.

## Phase 13 — AI-Assisted DOM Intelligence (Deterministic/Safe)
- Deterministic heuristic fallback and semantic fuzzy matching.
- Human review boundaries.

## Phase 14 — Advanced UX / Accessibility / i18n
- Multi-language expansion and WCAG 2.1 AA keyboard/screen-reader compliance.

## Phase 15 — Observability + Diagnostics without PII
- Structured internal diagnostics, zero-PII telemetry aggregation.

## Phase 16 — Production QA / Chaos Testing
- End-to-end chaos suites, simulated network degradation, and mock server latency.

## Phase 17 — Chrome Web Store Release Hardening
- Final manifest and security audit, package bundle production distribution.

