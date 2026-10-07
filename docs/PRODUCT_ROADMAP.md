# Tirumala SevaPilot — Product Roadmap & Execution Phases

**Date**: 2026-10-07  
**Baseline Commit**: `0c926cb8eb558be77f9051b60ca37cd910c7587a`  
**Status**: Phase 0 Baseline Audit Completed  

---

## Strategic Product Philosophy

* **FAST**: Minimal latency, differential DOM updating, zero blind sleeps.
* **SAFE**: Never bypass CAPTCHA, OTP, payment, or server-side locks. Never automatically tick religious/fitness declarations.
* **SMART**: Service-aware, step-aware, fail-closed row bounding, adaptive recovery.
* **TRUSTED**: 100% client-side local storage. Zero PII telemetry, zero external tracking, open-source transparency.
* **BEAUTIFUL**: Traditional Temple aesthetic (Devasthanam Purple & Temple Gold), responsive Side Panel, clean consumer hierarchy.

---

## Phase Roadmap Overview

| Phase | Title | Objective | Target Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Baseline & Audit** | Establish factual source of truth and regression baseline | Architecture map, Known Issues log, Test matrix, Security baseline |
| **Phase 1** | **Canonical Foundation** | Unify domain contracts and resolve broken imports | Fix `page-workflow.ts` import; deprecate conflicting legacy adapters; unify service rules |
| **Phase 2** | **Booking Cockpit (Home UX)** | Create single-dominant-action consumer experience | Dedicated Home states (First-time, Profile Ready, TTD Detected, Locked); move internal metrics to Diagnostics |
| **Phase 3** | **Service Intelligence** | Enforce exact service-specific rules across services | ₹300 SED, ₹200 SPAT, ₹1600 Homam, and Srivari Seva exact limits and field specifications |
| **Phase 4** | **Ultra-Fast Engine Core** | Optimize autofill pipeline without compromising safety | Page snapshot, candidate indexing, differential updates, event-driven waits, parallel text inputs |
| **Phase 5** | **Profile & Pilgrim Manager** | Streamline 1–6 pilgrim management | Service-keyed selection, health indicators, duplicate detection, masked previews |
| **Phase 6** | **Srivari Seva Dedicated Experience** | Unified voluntary service enrollment | 15-field profile support, explicit `USER_ACTION_REQUIRED` for declarations and fitness attestations |
| **Phase 7** | **Release Intelligence & Source Validator** | Authentic official TTD announcements | Dynamic announcement ingestion, strict HTTPS/domain validation, IST countdowns, stale data filtering |
| **Phase 8** | **Booking Guardian** | Real-time stability and failure protection | Semantic temporary lock detection, Angular rerender detection, fail-closed row isolation |
| **Phase 9** | **Security & Privacy Hardening** | Manifest V3 and Web Store compliance | Permission minimization, zero-PII logging audit, Web Crypto backup integrity |
| **Phase 10** | **End-to-End Regression Matrix** | Automated validation across all services and steps | 1–6 pilgrim tests, general details transitions, lock recovery, error states |
| **Phase 11** | **Performance & Polish** | Final UI/UX refinement and accessibility | Non-PII timing budgets, i18n completeness, keyboard shortcuts, dark mode fidelity |
| **Phase 12** | **Production Release Preparation** | Chrome Web Store submission readiness | Production build optimization, store assets, privacy disclosures, release notes |

---

## Detailed Phase Breakdown

### Phase 0: Baseline & Audit (CURRENT)
- [x] Fetch latest master (`0c926cb`) and record environment baseline.
- [x] Audit all components, service workflows, and autofill pipelines.
- [x] Identify critical regressions (broken imports in `page-workflow.ts`, Srivari limits conflict).
- [x] Execute baseline test run and record real-world pass/fail statistics.
- [x] Produce comprehensive baseline documentation.

### Phase 1: Canonical Foundation
- **Prerequisites**: Phase 0 baseline accepted.
- **Tasks**:
  1. Fix the broken import in `src/content/autofill/page-workflow.ts` (`import { detectGeneralDetails } from '../../services/workflows/step-detectors'`).
  2. Deprecate legacy adapters in `src/services/registry.ts` in favor of `src/services/workflows/registry.ts`.
  3. Resolve Srivari Seva pilgrim limits conflict (`maxPilgrims: 1, exactPilgrims: 1`).
  4. Establish a unified `TtdServiceRegistry` contract.
  5. Add GitHub Actions CI workflow for pull requests and branch builds.

### Phase 2: Booking Cockpit & Consumer UI
- **Tasks**:
  1. Ensure Home displays clean consumer states:
     - **First-Time**: "Welcome to SevaPilot" -> CTA: "CREATE PROFILE".
     - **Profile Exists**: Profile summary -> CTA: "OPEN TTD BOOKING" / "PREPARE BOOKING".
     - **TTD Detected**: Service name + "READY TO FILL" -> CTA: "⚡ FILL & VERIFY".
     - **Temporary Lock**: "TEMPORARY TTD LOCK" -> CTAs: "CHECK BOOKING HISTORY" & "TRY AGAIN".
  2. Remove internal percentage scores and technical checklists from the primary Dashboard.
  3. Ensure advanced diagnostics remain strictly accessible in Settings.

### Phase 3: Service Rules Specialization
- **Tasks**:
  1. **₹300 Special Entry Darshan**: 1–6 pilgrims, General Details required after Pilgrim Details.
  2. **₹200 Padmavathi / Sri PAT**: 1–6 pilgrims, NO General Details step.
  3. **₹1600 Divyanugraha Homam**: Exactly 2 pilgrims (householders), Gothram required in General Details.
  4. **Srivari Seva**: Exactly 1 pilgrim, unified enrollment address and personal fields.

### Phase 4: Ultra-Fast Autofill Engine
- **Tasks**:
  1. Implement single-pass `AutofillPageSnapshot` with indexed candidate lookups ($O(1)$).
  2. Implement `DifferentialAutofillEngine` to skip writing already-correct fields (`ALREADY_CORRECT`).
  3. Parallelize independent text inputs (Name + Age) within row batches.
  4. Eliminate blind sleeps (`setTimeout(120/150/30/60)`); replace with event-driven `smart-wait.ts`.
  5. Verify only changed fields; perform targeted repair on failed fields only.

### Phase 5: Pilgrim Manager & Profile Intelligence
- **Tasks**:
  1. Enforce service-specific selection limits in `useProfiles`.
  2. Aadhaar / Photo ID formatting and checksum validation.
  3. Clean masked previews (`******1234`) with user toggle.

### Phase 6: Srivari Seva Dedicated Workflow
- **Tasks**:
  1. Complete 15-field profile support (DOB, profession, district, door number).
  2. Enforce strict user control for declaration, mentally fit, and physically fit checkboxes.
  3. Pauses autofill and presents `USER_ACTION_REQUIRED` for user to tick declarations manually.

### Phase 7: Release Intelligence & Official Source Validator
- **Tasks**:
  1. Separate live dynamic release feeds from frozen test fixtures.
  2. Strict HTTPS and domain validation (`tirumala.org`, `news.tirumala.org`, `ttdevasthanams.ap.gov.in`).
  3. Countdown calculation strictly evaluated in Asia/Kolkata (IST).
  4. Automatic filtering of past/expired quota announcements.

### Phase 8: Booking Guardian
- **Tasks**:
  1. Immediate halt on detection of server-side temporary booking lock.
  2. Angular dynamic form re-render detection without infinite retry loops.
  3. Fail-closed pilgrim row detector preventing cross-row data contamination.

### Phase 9: Security & Privacy Audit
- **Tasks**:
  1. Verify zero PII is logged to console or stored remotely.
  2. Audit Manifest V3 permissions: evaluate optional permissions for `tabs` and `scripting`.
  3. Validate Web Crypto AES-GCM backup encryption and passphrase recovery.

### Phase 10: Full Regression Matrix
- **Tasks**:
  1. Execute automated matrix: 4 services × 1–6 pilgrim configurations.
  2. Verify edge cases: partially filled forms, rapid double-clicks, emergency cancellation.

### Phase 11 & 12: Polish & Store Packaging
- **Tasks**:
  1. Multi-language i18n audit (Telugu, Tamil, Kannada, Hindi, English).
  2. Final production bundle build and size optimization.
  3. Chrome Web Store package generation and compliance submission.
