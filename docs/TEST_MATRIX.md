# Tirumala SevaPilot — Test Matrix & Regression Baseline (Phase 0 Audit)

**Date**: 2026-10-07  
**Baseline Commit**: `0c926cb8eb558be77f9051b60ca37cd910c7587a` (`origin/master`)  
**Auditor**: Principal Engineer & QA Lead  

---

## 1. Automated Baseline Execution Results

All commands were executed locally in the actual repository environment. The results below reflect the true state of the repository on `origin/master`:

| Command | Status | Result / Exit Code | Output Summary |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | **FAILED** | Exit Code `1` | 3 TypeScript errors in `src/content/autofill/page-workflow.ts` (`TS2552: Cannot find name 'detectGeneralDetails'`) |
| `npm run build` | **FAILED** | Exit Code `1` | Vite/Rolldown build error: `[PARSE_ERROR] Export 'detectGeneralDetails' is not defined in src/content/autofill/page-workflow.ts:211` |
| `npx vitest run` | **FAILED** | Exit Code `1` | **50 test files passed**, **11 test files failed**; **597 tests passed**, **42 tests failed** (out of 639 total tests) |

### Analysis of Vitest Failures:
* **41 failures**: Direct downstream consequence of `ReferenceError: detectGeneralDetails is not defined` inside `src/content/autofill/page-workflow.ts` line 81 & line 326. When step detection crashes, active step returns `unknown`, breaking assertions expecting `pilgrim` or `general`.
* **1 failure**: `release-calendar-and-sources.test.ts` failure caused by the static seed timestamp `2026-10-07 10:00 IST` having aged past the execution time (`2026-10-07 12:48 IST`), causing `isEventUpcoming()` to filter it out.

---

## 2. Test Suite Inventory by Category

The repository currently contains **61 test files** distributed across 10 functional domains:

### A. Autofill & DOM Engine (`tests/content/`) — 22 files
1. `tests/content/angular-event-dispatch.test.ts` (Unit/DOM): Synthetic Angular event sequence.
2. `tests/content/angular-form-observer.test.ts` (Integration): Reactive form validation tracking.
3. `tests/content/autofill-engine.test.ts` (Integration): Intermediate autofill pipeline.
4. `tests/content/autofill-manager.test.ts` (Integration): Authoritative autofill coordinator.
5. `tests/content/autofill/field-resolver.test.ts` (Unit/DOM): Multi-signal field resolution.
6. `tests/content/autofill/page-workflow.test.ts` (Unit/DOM): Booking step detection *(Failed due to unimported symbol)*.
7. `tests/content/autofill/retry-engine.test.ts` (Unit): Adaptive retry logic.
8. `tests/content/autofill/row-detector.test.ts` (Unit/DOM): Pilgrim row bounding.
9. `tests/content/autofill/verification.test.ts` (Unit): Field verification engine.
10. `tests/content/debug.test.ts` (DOM): TTD DOM layout debugging.
11. `tests/content/fail-closed-row-detector.test.ts` (Security/DOM): Rejection of ambiguous multi-name containers.
12. `tests/content/field-mapper.test.ts` (Unit): Logical-to-physical field mapping.
13. `tests/content/field-mapping-engine.test.ts` (Unit): Secondary field mapping.
14. `tests/content/form-change-detector.test.ts` (DOM): Form mutation change tracking.
15. `tests/content/form-scanner.test.ts` (DOM): Document form scanning.
16. `tests/content/general-autofill-integrity.test.ts` (Integration): General Details autofill.
17. `tests/content/phase6-booking-reliability.test.ts` (Integration): End-to-end booking reliability.
18. `tests/content/phase6-dom-lifecycle.test.ts` (DOM): Lifecycle handling across page navigations.
19. `tests/content/queue-monitor.test.ts` (Workflow): Passive digital queue monitoring.
20. `tests/content/smart-wait.test.ts` (Unit): Event-driven wait utilities.
21. `tests/content/spat-darshan-autofill.test.ts` (Integration): Padmavathi ₹200 autofill.
22. `tests/content/ttd-pilgrim-autofill.test.ts` (Integration): Legacy monolithic autofill engine.

### B. Service Workflows & Information (`tests/services/`) — 18 files
1. `tests/services/adapters.test.ts` (Unit): Legacy service adapters.
2. `tests/services/phase9-real-ttd-qa.test.ts` (Integration): QA validation on real TTD structures.
3. `tests/services/profile-health.test.ts` (Unit): Profile completeness calculations.
4. `tests/services/profile-intelligence.test.ts` (Unit): Intelligent profile suggestions.
5. `tests/services/readiness-engine.test.ts` (Unit): Domain booking readiness engine.
6. `tests/services/service-adapter-integration.test.ts` (Integration): Adapter integration *(Failed due to step detector error)*.
7. `tests/services/service-recognition-engine.test.ts` (Unit): Service recognition scoring.
8. `tests/services/spat-system-flow.test.tsx` (UI/Integration): SPAT end-to-end flow.
9. `tests/services/srivari-seva-workflow.test.ts` (Integration): Srivari Seva instructions and declarations.
10. `tests/services/ttd-temporary-lock.test.ts` (Security/Workflow): Temporary lock handling.
11. `tests/services/workflows/sri-srinivasa-divyanugraha-homam.test.ts` (Integration): Homam ₹1600 *(Failed due to step detector error)*.
12. `tests/services/workflows/step-detectors.test.ts` (Unit): Individual step detectors.
13. `tests/services/workflows/workflow-engine.test.ts` (Unit): State machine transitions.
14. `tests/services/workflows/workflow-registry.test.ts` (Unit): Workflow registry resolution.
15. `tests/services/ttd-information/phase5-readiness.test.ts` (Unit): Phase 5 readiness rules.
16. `tests/services/ttd-information/release-calendar-and-sources.test.ts` (Unit): Release calendar *(Failed due to expired static date)*.
17. `tests/services/ttd-information/release-calendar-hardening.test.ts` (Security): HTTPS and domain validation.
18. `tests/services/ttd-information/service-rules-and-recognition.test.ts` (Unit): Service rule configurations.

### C. UI & Side Panel (`tests/sidepanel/`) — 8 files
1. `tests/sidepanel/AutofillProgress.test.tsx` (UI): Progress indicator rendering.
2. `tests/sidepanel/AutofillResult.test.tsx` (UI): Verification result card.
3. `tests/sidepanel/Dashboard.test.tsx` (UI): Main Dashboard rendering and state changes.
4. `tests/sidepanel/PilgrimSelection.test.tsx` (UI): Pilgrim selection checklist.
5. `tests/sidepanel/Profiles.test.tsx` (UI): Profile management interface.
6. `tests/sidepanel/ReadinessCard.test.tsx` (UI): Readiness presentation.
7. `tests/sidepanel/intelligence-cards.test.tsx` (UI): Dashboard cards.
8. `tests/sidepanel/popup-language-initialization.test.tsx` (UI): i18n initialization.

### D. Storage & Migrations (`tests/storage/`) — 5 files
1. `tests/storage/import-validator.test.ts` (Security): Safe profile import validation.
2. `tests/storage/migration-safety.test.ts` (Security): Automatic backup during migrations.
3. `tests/storage/repository-phase3.test.ts` (Unit): Storage repository methods.
4. `tests/storage/storage-manager.test.ts` (Unit): Low-level storage adapter.
5. `tests/storage/write-serialization.test.ts` (Concurrency): Mutex write queue serialization.

### E. Validation, Security & Background (`tests/validation/`, `tests/security/`, `tests/background/`) — 6 files
1. `tests/validation/aadhaar.test.ts` (Unit): Verhoeff algorithm Aadhaar validation.
2. `tests/validation/effective-age.test.ts` (Unit): DOB vs age calculations.
3. `tests/validation/validators.test.ts` (Unit): Email, mobile, pincode validation.
4. `tests/security/crypto.test.ts` (Security): AES-GCM encryption & decryption.
5. `tests/background/tab-binding-safety.test.ts` (Security): Message routing tab binding.
6. `tests/regression-matrix.test.ts` (Regression): Cross-cutting regression assertions.

### F. Legacy Phase Suites (`tests/phase2-2/`, `tests/phase4/`) — 2 files
1. `tests/phase2-2/phase2-2.test.ts`: Legacy milestone assertions.
2. `tests/phase4/production-hardening.test.ts`: Legacy milestone assertions.

---

## 3. Service × Pilgrim Count Test Matrix

Target coverage matrix required for production qualification:

| Service | 1 Pilgrim | 2 Pilgrims | 3 Pilgrims | 4 Pilgrims | 5 Pilgrims | 6 Pilgrims | General Details |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **₹300 Special Entry Darshan** | Tested | Tested | Tested | Tested | Tested | Tested | Required (Email, City, State, PIN) |
| **₹200 Padmavathi / Sri PAT** | Tested | Tested | Tested | Tested | Tested | Tested | Prohibited / Skipped |
| **₹1600 Divyanugraha Homam** | N/A | Tested | N/A | N/A | N/A | N/A | Required (Gothram, Address) |
| **Srivari Seva (Voluntary)** | Tested | N/A | N/A | N/A | N/A | N/A | Unified Profile Enrollment |

---

## 4. Safety & Policy Assertions

All tests must continuously assert that the extension enforces the following safety invariants:

- [x] **No CAPTCHA Automation**: CAPTCHA elements are never selected, focused, or modified.
- [x] **No OTP Automation**: Mobile verification OTP fields are never intercepted or submitted.
- [x] **No Payment Automation**: Payment gateway iframes and forms are never clicked or filled.
- [x] **No Final Submission**: The final "Pay Now" / "Submit Booking" buttons are never automatically clicked.
- [x] **No Queue Manipulation**: Virtual queue waiting rooms are monitored passively without polling bypass.
- [x] **No Booking Lock Bypass**: Temporary locks immediately halt autofill; IDs are never manipulated.
- [x] **No Declaration Auto-Tick**: Religious and fitness declarations require explicit user manual check.
- [x] **Zero PII Logging**: Logs never contain unmasked Aadhaar, passport, mobile, or email values.
