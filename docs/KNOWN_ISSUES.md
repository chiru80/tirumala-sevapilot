# Tirumala SevaPilot — Known Issues Tracker

## P0 — Correctness / architecture

### K01 — Release data freshness (RESOLVED in Phase 7)
**Status: Resolved.** Production-grade release intelligence pipeline implemented: `SOURCE → PARSER → NORMALIZED EVENT → VALIDATION → CACHE → FRESHNESS → UI`. Built non-locale calendar-validated parser (`release-date-parser.ts`), authoritative release status (`CONFIRMED`, `EXPECTED`, `ESTIMATED`, `UNKNOWN`, `STALE`), recurring pattern engine (`recurring-pattern-engine.ts`), change detection with postponement/rescheduling alerts (`release-change-detector.ts`), bounded schema-versioned cache (`ttd-cache.ts`), future event filtering, and strict Asia/Kolkata timezone normalization. Zero fabricated dates/times.

### K02 — Srivari rule duplication (RESOLVED in Phase 1)
**Status: Resolved.** Single source of truth established in `CANONICAL_SRIVARI_SEVA` (`maxPilgrims: 1, exactPilgrims: 1`). Legacy adapter `srivariSevaAdapter` now derives its limits directly from canonical service definition.

### K03 — Srivari field-rule duplication (RESOLVED in Phase 1)
**Status: Resolved.** Authoritative field classifications (`REQUIRED`, `OPTIONAL`, `USER_CONTROLLED`, `NOT_PRESENT`) established in `CANONICAL_SRIVARI_SEVA`. Srivari Seva declarations and fitness attestations are strictly classified as `USER_CONTROLLED`. Legacy adapter delegates field rules to canonical definition.

### K04 — Readiness presentation leakage (RESOLVED in Phase 1)
**Status: Resolved.** Implemented `BookingReadiness` contract (`READY | ACTION_REQUIRED | NOT_READY | UNKNOWN`) with `headline`, `userAction`, and `canFill`. Internal diagnostic scoring and checklist items are separated into `InternalDiagnostics` for Settings/Diagnostics tabs.

## P1 — Product UX

### K05 — ProfileCard legacy terminology/fallbacks (RESOLVED in Phase 1)
**Status: Resolved.** ProfileCard now queries `getCanonicalService(serviceId)?.displayName` for authoritative service naming instead of hardcoded substring matching.

### K06 — General Details service logic in UI (RESOLVED in Phase 1)
**Status: Resolved.** `GeneralDetailsSection` refactored to consume `getCanonicalService`, `hasGeneralDetails`, and `isFieldRequiredForService`. Ad-hoc component-level service conditionals eliminated.

### K07 — Home complexity (Open — Phase 2)
Dashboard contains many advanced surfaces. The final Home should prioritize release update, contextual booking state, one dominant CTA, simple how-it-works and quick actions.

## P1 — Reliability

### K08 — Settings runtime verification (Open — Phase 2)
Settings contain multiple behavior toggles. Each toggle must be traced from UI → storage → runtime consumer → observable behavior.

### K09 — Tailwind compatibility (Open — Phase 2)
The declared project version is Tailwind 3.4.x. Utility classes used by the project must be checked against that version; unsupported utilities should not be silently assumed to work.

### K10 — Full test/build evidence (RESOLVED in Phase 1)
**Status: Resolved.** Full local verification confirmed: TypeScript compilation passes cleanly (`npm run typecheck`), production Vite bundle builds cleanly (`npm run build`), and all 62 test files (671 unit and integration tests) pass at 100%.

## P2 — Maintainability

### K11 — Legacy adapters (RESOLVED in Phase 1)
**Status: Resolved.** Legacy adapters in `src/services/` now derive their `maxPilgrims`, required fields, and detection rules from the canonical registry, preventing dual sources of truth.

### K12 — Product state contract (RESOLVED in Phase 1)
**Status: Resolved.** `BookingReadiness` established as the authoritative contract across `ReadinessEngine`, `useReadiness`, and UI surfaces.

### K13 — Invented Srivari personal defaults (RESOLVED in Phase 6)
**Status: Resolved.** Eliminated all fallback identity substitutions (`|| 'Aadhaar'`, `|| 'Male'`, `|| 'India'`, default addresses) across autofill manager, message router, profile prewarm, and service intelligence. Missing values remain strictly empty, missing required fields are surfaced to the user, and trigger `USER_ACTION_REQUIRED`.

### K14 — Readiness state vs user-controlled actions (RESOLVED in Phase 6)
**Status: Resolved.** Enforced that machine field completion never implies booking readiness (`isReady === true`) when user-controlled actions (`declaration`, `mentallyFit`, `physicallyFit`, or required photo) remain unconfirmed. Standardized `DomReadinessStatus` (`READY`, `PARTIALLY_READY`, `USER_ACTION_REQUIRED`, `BLOCKED`, `UNKNOWN`).

### K15 — Step collision between enrollment declaration and instructions review (RESOLVED in Phase 6)
**Status: Resolved.** Re-ordered step detection so that the unified profile enrollment form (with its bottom declaration checkbox) is not prematurely captured as an instructions review step.

### K16 — Zero PII logging in Srivari workflow & autofill diagnostics (RESOLVED in Phase 6)
**Status: Resolved.** Masked logging implemented across Srivari enrollment flow. Sensitive values (Aadhaar, ID numbers, mobile, DOB, addresses, base64 photo data) are never output in raw form to console logs, diagnostics, or test outputs.

### K17 — Fragmented Booking State Orchestration (RESOLVED in Phase 8)
**Status: Resolved.** Unified fragmented stage detection and autofill trigger pathways into a canonical, bounded `BookingGuardian` state machine. Established clear preflight validation (10 checks), human-control boundaries (CAPTCHA, OTP, payment, review), single-session concurrency guards, and stale session invalidation on route changes.

### K18 — Server-Side Temporary Lock Handling (RESOLVED in Phase 8)
**Status: Resolved.** Prioritized `TTD_TEMPORARY_BOOKING_LOCK` with highest safety precedence upon recognizing held pilgrim IDs. Blocks further autofill writes, halts automated retries, avoids aggressive page reloads, and guides the devotee to check booking history or retry manually after the cooldown expires.

## Safety constraints

No issue above justifies:
- CAPTCHA bypass
- OTP automation
- payment automation
- final booking submission automation
- queue manipulation
- TTD lock bypass
- forcing disabled/read-only fields
- automatic declarations/attestations
- sensitive logging
