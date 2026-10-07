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
- Profile/service/workflow prewarming.
- Section-scoped DOM scanning.
- Field/row caching.
- Differential fill.
- Event-driven Angular waits.
- Targeted verification and repair.
- Preserve all safety checks.

## Phase 5 — Profiles / pilgrim manager
- Clear 1–6 pilgrim UX.
- Service compatibility.
- Service-specific max/exact limits.
- Required-field readiness.

## Phase 6 — Srivari Seva
- Complete required enrollment data.
- Preserve user control for declaration and fitness attestations.
- Explicit USER_ACTION_REQUIRED state.
- Review before submission.

## Phase 7 — Release Intelligence
- Official TTD source pipeline.
- Freshness and expiry.
- No fabricated dates.
- Compact verified release ticker.
- Future-only event selection.

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
