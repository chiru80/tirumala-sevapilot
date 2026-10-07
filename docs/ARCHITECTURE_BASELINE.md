# Tirumala SevaPilot — Architecture Baseline (Phase 0 Audit)

**Date**: 2026-10-07  
**Baseline Commit**: `0c926cb8eb558be77f9051b60ca37cd910c7587a` (`origin/master`)  
**Package Version**: `1.1.0`  
**Manifest Version**: `3` (`1.1.0`)  
**Auditor**: Principal Engineer, Security Auditor & QA Lead  

---

## 1. System Overview & Technology Stack

Tirumala SevaPilot is an independent, non-affiliated third-party Google Chrome extension (Manifest V3) designed to assist devotees with booking preparation, client-side validation, and autofill verification on the official Tirumala Tirupati Devasthanams (TTD) booking portal (`ttdevasthanams.ap.gov.in` and `tirupatibalaji.ap.gov.in`).

### Core Technology Stack
- **Manifest**: Chrome Extensions Manifest V3 (`manifest_version: 3`)
- **Runtime**: TypeScript (`^7.0.2`), Node.js (`>=20`)
- **Bundler**: Vite (`^8.3.0`) with `@crxjs/vite-plugin` (`^2.7.1`), `@vitejs/plugin-react` (`^6.1.1`)
- **UI Framework**: React 18 (`^18.3.1`), `react-dom` (`^18.3.1`), `react-router-dom` (`^6.30.6`)
- **Styling**: Tailwind CSS (`^3.4.19`), PostCSS (`^8.5.28`), Autoprefixer (`^10.6.1`)
- **Testing**: Vitest (`^5.0.1`), JSDOM (`^30.1.1`), `@testing-library/react` (`^16.3.3`)
- **Storage**: `chrome.storage.local` with in-memory mutex write serialization and schema migration engine

---

## 2. High-Level Architecture Map

The extension operates across four primary browser contexts:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CHROME BROWSER                                   │
│                                                                                 │
│  ┌───────────────────────┐                    ┌──────────────────────────────┐  │
│  │   TTD Web Page Tab    │                    │     Extension Side Panel     │  │
│  │ (ttdevasthanams.ap.gov)│                    │       (React 18 SPA)         │  │
│  │                       │                    │                              │  │
│  │  Content Scripts:     │  chrome.runtime    │  Pages:                      │  │
│  │  - content.ts         │  messages          │  - Dashboard.tsx             │  │
│  │  - autofill-manager   │◄──────────────────►│  - Profiles.tsx              │  │
│  │  - form-scanner       │                    │  - Settings.tsx              │  │
│  │  - floating-helper    │                    │  - Validation.tsx            │  │
│  │                       │                    │  - Bookings.tsx              │  │
│  │  DOM Tree:            │                    │  - Backup.tsx                │  │
│  │  - Angular Reactive   │                    │                              │  │
│  │  - Material Steppers  │                    │  Domain Hooks:               │  │
│  │  - Custom Dropdowns   │                    │  - useReadiness              │  │
│  └───────────▲───────────┘                    │  - useProfiles               │  │
│              │                                │  - useTtdPage                │  │
│              │ Scripting                      │  - useAutofillSession        │  │
│              │ Injection                      └──────────────▲───────────────┘  │
│  ┌───────────┴───────────┐                                   │                  │
│  │  Background Worker    │                                   │ chrome.storage   │
│  │  (service-worker.ts)  │                                   │ local API        │
│  │                       │◄──────────────────────────────────┘                  │
│  │  - Message Router     │                                                      │
│  │  - Tab Binding Safety │                    ┌──────────────────────────────┐  │
│  │  - Context Menus      │                    │     Encrypted Storage &      │  │
│  │  - Lifecycle / Alarms │                    │     Local Repository         │  │
│  └───────────────────────┘                    │     - repository.ts          │  │
│                                               │     - crypto.ts / vault.ts   │  │
│                                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Inventory & Authority Analysis

### A. Background Context (`src/background/`)
* **`service-worker.ts`**: Manifest V3 background service worker. Handles install/update events, registers context menus, sets up side panel behavior (`chrome.sidePanel.setPanelBehavior`), and listens for tab updates.
* **`message-router.ts`**: Central message multiplexer between the side panel, popup, and content script. Implements strict tab-binding safety to ensure messages target only active TTD tabs.

### B. Content Script Context (`src/content/`)
* **`content.ts`**: Injected script entry point. Initializes mutation observers, floating helper pill, message listeners, and coordinates on-page form scanning.
* **`autofill/autofill-manager.ts`**: **Authoritative** coordinator for modern workflow-aware autofill transactions. Manages session locks, pilgrim batch processing, differential updating, and error reporting.
* **`autofill/field-resolver.ts`**: Resolves logical field definitions to concrete DOM elements using multi-signal scoring, `WeakMap` label caching, and ARIA inspection.
* **`autofill/field-transaction.ts`**: Dispatches high-fidelity synthetic DOM events (`focus`, `input`, `change`, `blur`) to trigger Angular `ControlValueAccessor` updates.
* **`autofill/page-workflow.ts`**: Step detector coordinator across multi-step Angular booking wizards. *(Note: Contains Phase 0 broken import regression documented below).*
* **`autofill/retry-engine.ts`**: Adaptive recovery engine executing targeted retries on dynamic DOM replacements.
* **`autofill/row-detector.ts`**: Detects and bounds pilgrim row containers with fail-closed safety.
* **`autofill/verification.ts`**: Post-write verification engine checking actual DOM values against expected profile data.
* **`floating-helper.ts`**: In-page Floating UI pill injected into shadow DOM for quick access.
* **`smart-wait.ts`**: Event-driven DOM readiness waiter utilizing MutationObserver with synchronous frame-0 evaluation.
* **`legacy / redundant content files`**:
  - `ttd-pilgrim-autofill.ts` (58 KB): Monolithic legacy autofill engine. Still retained in repo and exercised by legacy tests, duplicating `autofill-manager.ts`.
  - `autofill-engine.ts`: Intermediate autofill layer.
  - `field-mapper.ts` & `field-mapping-engine.ts`: Two separate field mapping utilities.

### C. Services & Domain Logic (`src/services/`)
* **`workflows/registry.ts`**: **Authoritative** Phase 3 Workflow Registry containing verified workflows:
  - `SPECIAL_ENTRY_DARSHAN_300` (`special-entry-300.ts`)
  - `PADMAVATHI_SUPADHAM_ENTRY_200` (`padmavathi-200.ts`)
  - `SRI_SRINIVASA_DIVYANUGRAHA_HOMAM` (`sri-srinivasa-divyanugraha-homam.ts`)
  - `SRIVARI_SEVA_WORKFLOW` (`srivari-seva-workflow.ts`)
* **`ttd-information/ttd-service-rules.ts`**: Strongly-typed static configuration definitions for TTD services.
* **`readiness-engine.ts`**: **Authoritative** domain evaluator for pilgrim and profile booking readiness.
* **`service-recognition-engine.ts`**: Independent multi-signal service classifier.
* **`legacy service adapters` (`src/services/registry.ts`)**:
  - `darshanAdapter`, `arjithaSevaAdapter`, `accommodationAdapter`, `srivaniAdapter`, `srivariSevaAdapter`, `genericAdapter`.
  - *Conflict*: `srivariSevaAdapter` defines `maxPilgrims: 10`, directly contradicting `SRIVARI_SEVA_WORKFLOW` (`maxPilgrims: 1`).

### D. Side Panel & User Interface (`src/sidepanel/`)
* **`pages/Dashboard.tsx`**: Primary user landing page ("Booking Cockpit").
* **`hooks/useReadiness.ts`**: Bridges `ReadinessEngine` to React components. Exposes readiness state and checklist.
* **`hooks/useProfiles.ts`**: Manages profile CRUD and service-keyed pilgrim selection.
* **`hooks/useTtdPage.ts`**: Manages active tab state, TTD URL tracking, and temporary booking lock detection.
* **`hooks/useAutofillSession.ts`**: Manages autofill progress, verification results, and emergency cancellation.
* **`components/dashboard/`**: Contains `PrimaryAction`, `ActiveProfileCard`, `PilgrimSelection`, `HowItWorksCard`, `UpcomingReleasesCard`, `ReleaseTicker`, `TemporaryLockCard`, `AutofillProgress`, `AutofillResult`.

### E. Security, Storage & Shared (`src/security/`, `src/storage/`, `src/shared/`)
* **`security/crypto.ts` & `vault.ts`**: AES-GCM 256-bit PBKDF2 Web Crypto implementation for encrypted backups and secure local storage.
* **`storage/repository.ts`**: Mutex-serialized CRUD wrapper around `chrome.storage.local`.
* **`shared/logger.ts`**: Regex-sanitizing logger preventing Aadhaar, mobile, email, passport, and credentials from reaching console output.

---

## 4. Autofill Execution Lifecycle

The complete autofill lifecycle follows this sequence:

```
[User clicks FILL & VERIFY]
       │
       ▼
1. Pre-Flight Check & Session Lock
   - useAutofillSession acquires session lock (prevents double-clicks)
   - Checks active tab URL & official TTD domain whitelist
       │
       ▼
2. Page & Service Recognition
   - resolveWorkflowWithConfidence() evaluates URL patterns and page markers
   - Route dominance applied (SPAT -> Padmavathi ₹200; Srivari Seva -> Srivari Workflow)
       │
       ▼
3. Step Detection
   - detectWorkflowStep() / detectActiveBookingStep() inspects active Angular stepper
   - Determines: PILGRIM_DETAILS vs GENERAL_DETAILS vs INSTRUCTIONS_REVIEW
       │
       ▼
4. Container & Row Bounding
   - RowDetector identifies pilgrim table/form containers
   - Enforces fail-closed isolation (rejects ambiguous multi-name containers)
       │
       ▼
5. Field Resolution
   - FieldResolver queries form control candidates via multi-signal scoring
   - Evaluates formcontrolname, name, id, tag, ARIA attributes, and label proximity
       │
       ▼
6. Differential Pre-Check
   - Reads current normalized DOM value
   - If value matches expected profile data -> skips write (ALREADY_CORRECT)
       │
       ▼
7. Field Write Transaction
   - Dispatches synthetic event sequence: Focus -> KeyDown -> Value assignment -> Input -> Change -> Blur
   - Triggers Angular ControlValueAccessor validation state update
       │
       ▼
8. Immediate DOM Verification
   - VerificationEngine reads back actual DOM property value
   - Strictly validates exact ID numbers, name strings, and dropdown selections
       │
       ▼
9. Adaptive Retry & Selective Repair
   - Retries only if DOM mutation indicates transient Angular rerender
   - Failed fields highlighted; user presented with targeted "REPAIR" option
       │
       ▼
10. Final Result & Cleanup
    - Session lock released; verification report sent to Side Panel
```

---

## 5. Architectural Redundancies & Divergences Identified

1. **Autofill Multiplicity**:
   - `src/content/autofill/autofill-manager.ts` (Phase 3+ active engine)
   - `src/content/ttd-pilgrim-autofill.ts` (Legacy monolithic engine, 58 KB)
   - `src/content/autofill-engine.ts` (Intermediate engine)
2. **Service Registries**:
   - `src/services/workflows/registry.ts` (Phase 3 workflow engine)
   - `src/services/registry.ts` (Legacy service adapters)
   - `src/services/ttd-information/ttd-service-rules.ts` (Static service configs)
   - `src/services/service-recognition-engine.ts` (Signature list)
3. **Field Mappers**:
   - `src/content/field-mapper.ts`
   - `src/content/field-mapping-engine.ts`
   - `src/content/autofill/field-contracts.ts`

---

## 6. Phase 0 Audit Conclusion

The core modern architecture (`autofill-manager.ts`, `workflows/registry.ts`, `readiness-engine.ts`, and `repository.ts`) is well-designed, privacy-conscious, and robust. However, legacy parallel systems and recent unimported references must be addressed to re-establish a pristine baseline for Phase 1.
