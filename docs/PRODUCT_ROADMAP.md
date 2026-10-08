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
- Canonical release model (`ReleaseEvent`) with explicit status: `CONFIRMED`, `EXPECTED`, `ESTIMATED`, `UNKNOWN`, `STALE`.
- Explicit confidence levels: `OFFICIAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`.
- Strict calendar-validated date parser (`release-date-parser.ts`) rejecting impossible dates (Feb 30, Oct 32).
- Strict time parser normalizing to `HH:mm` in Asia/Kolkata (IST); timezone canonicalization.
- Recurring pattern engine (`recurring-pattern-engine.ts`) generating `EXPECTED` events from verified historical schedules.
- Official confirmed data always overrides expected data immediately (`reconcileReleaseEvents`).
- Change detection engine (`release-change-detector.ts`) with rescheduling alerts and `previousReleaseDate`/`previousReleaseTime` tracking.
- Bounded, versioned schema cache (`ttd-cache.ts`) with automatic staleness detection (K01 resolved).
- Future event filtering and nearest release selection; zero fabricated dates/times.
- Release Day Mode and preparation guidance without automating submissions, CAPTCHAs, OTPs, or payments.
- Multilingual UI support with English and Telugu translations across ticker and countdown cards.
- Comprehensive Phase 7 regression suite: 21 new tests, 68 test files total (812 tests passing).

## Phase 8 — Booking Guardian
- Detect unexpected rerenders, changed fields, invalid state, temporary lock and workflow ambiguity.
- Stop safely rather than guess.
- Preserve booking context.

## Phase 9 — Security
- Permission audit.
- Sensitive-data logging audit.
- Storage audit.
- CSP/remote-code audit.
- Web Store policy review.

## Phase 10 — Regression
- Service × pilgrim-count matrix.
- Angular rerender tests.
- lock-state tests.
- General Details tests.
- Srivari user-action tests.
- release-data tests.

## Phase 11 — Performance / polish
- Real timing instrumentation.
- Reduce redundant work.
- Accessibility.
- i18n.
- responsive side panel.
- visual consistency.

## Phase 12 — Release
- Production build.
- final security audit.
- Chrome Web Store package.
- release notes.
- manual TTD validation.
