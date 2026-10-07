# Tirumala SevaPilot — Known Issues & Severity Log (Phase 0 Audit)

**Date**: 2026-10-07  
**Baseline Commit**: `0c926cb8eb558be77f9051b60ca37cd910c7587a` (`origin/master`)  
**Auditor**: Principal Engineer, Security Auditor & QA Lead  

---

## Severity Classification Model

* **P0 (Critical / Blocker)**: Security vulnerabilities, data corruption, broken build/runtime, unsafe autofill, payment/OTP/CAPTCHA bypass, incorrect identity mapping, automatic declaration/attestation, booking lock bypass.
* **P1 (High)**: Contradictory service rules, broken workflows, incorrect pilgrim limits, diverging field definitions, stale static data.
* **P2 (Medium)**: Redundant architectures, unused settings, UX presentation leakage, missing CI automation.
* **P3 (Low)**: Code hygiene, styling compatibility notes, minor maintainability items.

---

## P0 — Critical Issues

### ISSUE-01 (P0): Broken Import Regression in `src/content/autofill/page-workflow.ts`
* **File**: [`src/content/autofill/page-workflow.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/content/autofill/page-workflow.ts)
* **Root Cause**: Commit `0c926cb` introduced `detectGeneralDetails` on line 81, line 211 (export), and line 326 without importing it from `../../services/workflows/step-detectors`.
* **Observable Impact**:
  1. **Build Failure**: `npm run build` exits with code 1 (`[PARSE_ERROR] Export 'detectGeneralDetails' is not defined`).
  2. **Typecheck Failure**: `npm run typecheck` exits with code 1 (`error TS2552: Cannot find name 'detectGeneralDetails'`).
  3. **Runtime Error**: Injected content scripts crash with `ReferenceError: detectGeneralDetails is not defined` whenever booking step detection executes.
  4. **Test Failures**: 11 test suites and 42 tests fail in Vitest due to unhandled exceptions in step detection.
* **Remediation Plan for Phase 1**: Add `detectGeneralDetails` to the import declaration from `../../services/workflows/step-detectors`.

### ISSUE-02 (P0): Contradictory Pilgrim Limits in Srivari Seva
* **Files**: 
  - Canonical: [`src/services/workflows/srivari-seva-workflow.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/services/workflows/srivari-seva-workflow.ts#L27-L28) (`maxPilgrims: 1, exactPilgrims: 1`)
  - Legacy: [`src/services/srivari-seva/index.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/services/srivari-seva/index.ts#L9) (`maxPilgrims: 10`)
* **Root Cause**: Coexisting legacy adapter system was never synchronized with the canonical voluntary service rules. TTD Srivari Seva voluntary registration permits exactly 1 individual per enrollment slot.
* **Risk**: If the legacy adapter is evaluated by fallback consumers, the UI could allow up to 10 pilgrims, causing form submission rejection on the TTD portal.
* **Remediation Plan for Phase 1**: Deprecate legacy adapter and establish `srivari-seva-workflow.ts` as the single authoritative source of truth.

---

## P1 — High Severity Issues

### ISSUE-03 (P1): Aging Static Seed Dates in `VERIFIED_RELEASE_EVENTS`
* **File**: [`src/services/ttd-information/ttd-release-calendar.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/services/ttd-information/ttd-release-calendar.ts#L248-L317)
* **Description**: `VERIFIED_RELEASE_EVENTS` embeds static release dates (e.g. `2026-10-07 10:00 IST`). Once that exact timestamp passes, `isEventUpcoming()` correctly filters it out as past. However, unit tests asserting upcoming status for `special-entry-300` fail because the static timestamp has expired relative to current execution time.
* **Remediation Plan for Phase 1**: Separate dynamic online quota feeds from frozen unit test mock fixtures. Do not present hardcoded static dates as current live announcements without fresh network verification.

### ISSUE-04 (P1): Triple Service Registration Architecture
* **Files**:
  - `src/services/workflows/registry.ts` (Phase 3 workflows)
  - `src/services/registry.ts` (Legacy `ServiceAdapter` array)
  - `src/services/ttd-information/ttd-service-rules.ts` (Static config records)
  - `src/services/service-recognition-engine.ts` (Custom signatures array)
* **Description**: Four separate modules maintain independent lists of supported services and rule sets. SED ₹300 and SPAT ₹200 are lumped together in `darshanAdapter` but split in `workflows/registry.ts`.
* **Remediation Plan for Phase 1**: Consolidate into a unified canonical service registry where adapters derive from workflow definitions.

### ISSUE-05 (P1): Srivari Seva Field Model Divergence
* **Files**:
  - `srivari-seva-workflow.ts`: 15 required fields (including `doorNumber`, `street`, `district`, `state`, `photo`, `mobile`)
  - `srivari-seva/index.ts`: 7 required fields (`fullName`, `gender`, `dateOfBirth`, `idType`, `idNumber`, `mobile`, `country`)
* **Description**: Consumers querying field requirements get conflicting answers depending on which module they import.

### ISSUE-06 (P1): Monolithic Legacy Autofill Engine Duplication
* **Files**:
  - Active: `src/content/autofill/autofill-manager.ts` (81 KB)
  - Legacy: `src/content/ttd-pilgrim-autofill.ts` (58 KB)
* **Description**: The repository retains the entire legacy monolithic autofill implementation alongside the modularized `autofill-manager.ts`. Legacy unit tests still execute against `ttd-pilgrim-autofill.ts`, risking false confidence if the production content script uses `autofill-manager.ts`.

---

## P2 — Medium Severity Issues

### ISSUE-07 (P2): Settings Defined in UI but Not Consumed at Runtime
* **Files**:
  - `autoFillOnDetect`: Present in `types.ts`, `constants.ts`, `Settings.tsx`, and i18n, but never read in `content.ts` or `autofill-manager.ts`.
  - `autoScanEnabled`: Present in `types.ts` and `constants.ts`, but has zero callers in the codebase.
  - `diagnosticsMode`: Toggles a card in `Settings.tsx`, but does not alter logger verbosity or content script diagnostics.
* **Remediation Plan**: Either wire these settings to active runtime behaviors or remove them to avoid misleading users.

### ISSUE-08 (P2): Absence of Automated CI / GitHub Workflows
* **Location**: `.github/workflows/` (directory does not exist)
* **Description**: The repository contains no continuous integration configuration. Build and test validation occurs solely on developer workstations, allowing broken commits (such as `0c926cb`) to reach the master branch undetected.

### ISSUE-09 (P2): Granular Readiness Score Leakage in Hooks
* **File**: [`src/sidepanel/hooks/useReadiness.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/sidepanel/hooks/useReadiness.ts)
* **Description**: `useReadiness` exposes a numerical `score` (0–100%) and internal checklist objects. While `Dashboard.tsx` now formats this into a clean binary `READY / ACTION REQUIRED`, other consumers or legacy dialogs still access the raw percentage, violating the consumer-first UI philosophy.

---

## P3 — Low Severity Issues

### ISSUE-10 (P3): Tailwind v4-Style Utility Usage in Tailwind v3 Project
* **Files**: `Settings.tsx`, `Dashboard.tsx`, `SessionHistoryModal.tsx`, etc.
* **Description**: The codebase uses `shadow-xs`, `shadow-2xs`, and `backdrop-blur-xs`. These work currently because they are explicitly defined in `tailwind.config.js` under `extend`. However, when upgrading to Tailwind CSS v4 in the future, these redundant custom extensions may conflict with standard defaults.

### ISSUE-11 (P3): In-Memory Mutex Storage Queue vs Multi-Tab Concurrency
* **File**: [`src/storage/repository.ts`](file:///c:/Users/HP/Desktop/TIRUMALA%20SEVAPILOT/src/storage/repository.ts#L38-L44)
* **Description**: `enqueueWrite` serializes writes within the same JavaScript execution environment (Side Panel). If multiple extension contexts (e.g. Side Panel and Popup) write simultaneously, `chrome.storage.local` could encounter race conditions without a cross-context lock mechanism.
