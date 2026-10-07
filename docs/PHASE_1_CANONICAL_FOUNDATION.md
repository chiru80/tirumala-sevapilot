# Tirumala SevaPilot — Phase 1: Canonical Foundation Architecture

**Om Namo Venkatesaya**  
**Repository:** https://github.com/chiru80/tirumala-sevapilot  
**Branch:** `phase-1/canonical-foundation`  
**Base:** `master`

---

## 1. Executive Summary & Problem Statement

Prior to Phase 1, Tirumala SevaPilot contained overlapping and competing sources of truth across multiple subsystems:
1. **Service limits conflict (K02):** Srivari Seva had `maxPilgrims: 1` in the canonical workflow (`src/services/workflows/srivari-seva.ts`), but `maxPilgrims: 10` hardcoded in the legacy adapter (`src/services/srivari-seva/index.ts`).
2. **Field requirement fragmentation (K03):** Required, optional, and user-controlled fields were defined redundantly across legacy adapters, workflow step descriptors, and UI components.
3. **Readiness presentation leakage (K04):** `useReadiness` leaked internal percentage scoring (e.g., `80%`, `4/6 checks passed`) and internal diagnostic labels directly to presentation components, rather than providing a clean product-level contract (`READY`, `ACTION_REQUIRED`, `NOT_READY`, `UNKNOWN`).
4. **General Details logic scattered in UI (K06):** `GeneralDetailsSection.tsx` made ad-hoc string comparisons (`activeServiceId.includes('padmavathi')`) to decide whether contact/address fields were required or present.
5. **Legacy adapters as competing truth (K11):** Adapters maintained their own independent property tables rather than deriving from canonical definitions.
6. **Missing product-state contract (K12):** No single domain boundary existed to guarantee that Home UI, Diagnostics, and Autofill agreed on whether a booking was ready.

Phase 1 establishes **ONE authoritative canonical foundation** for all services, workflows, pilgrim limits, field classifications, and readiness evaluations.

---

## 2. Canonical Architecture Flow

```
TTD PAGE (Live URL & DOM)
         ↓
SERVICE RECOGNITION (Conservative, Route-Dominant)
         ↓
CANONICAL SERVICE REGISTRY (One Authoritative Definition)
         ↓
CANONICAL WORKFLOW (Ordered Steps & Step Detectors)
         ↓
CANONICAL FIELD RULES (REQUIRED | OPTIONAL | CONDITIONAL | USER_CONTROLLED | NOT_PRESENT)
         ↓
CANONICAL READINESS (BookingReadiness: READY | ACTION_REQUIRED | NOT_READY | UNKNOWN)
         ↓
AUTOFILL ENGINE / CONSUMER UI (Clean Contract, No Leaked Diagnostics)
```

---

## 3. Authoritative Service Registry & Rules Table

Located at: [`src/services/canonical-service-registry.ts`](file:///src/services/canonical-service-registry.ts)

| Canonical Service ID | Display Name | Service Type | Price | Min Pilgrims | Max Pilgrims | Exact Pilgrims | General Details Step | Special Requirements |
|---|---|---|---|---|---|---|---|---|
| `special-entry-darshan-300` | Special Entry Darshan ₹300 | `DARSHAN` | ₹300 | 1 | 6 | — | **YES** (Step 2 after Pilgrims) | Declaration (User Controlled) |
| `padmavathi-supadham-entry-200` | Padmavathi / Sri PAT | `DARSHAN` | ₹200 | 1 | 6 | — | **NO** (Not present in verified flow) | SPAT route dominance |
| `sri-srinivasa-divyanugraha-homam` | Divyanugraha Homam (₹1600) | `ARJITHA_SEVA` | ₹1600 | 2 | 2 | **2** (Householders) | **YES** (Step 2 before Pilgrims) | **Gothram REQUIRED** |
| `srivari-seva` | Srivari Seva | `SRIVARI_SEVA` | ₹0 | 1 | 1 | **1** (Individual slot) | **YES** (Unified Enrollment) | **Declaration & Fitness USER_CONTROLLED** |

---

## 4. Resolution of the Srivari Seva Conflict (K02 & K03)

### The Conflict
- `src/services/workflows/srivari-seva.ts`: Defined `maxPilgrims: 1`.
- `src/services/srivari-seva/index.ts`: Hardcoded `maxPilgrims: 10`.

### The Resolution
In official TTD Tirumala voluntary Seva, registration slots are strictly issued on an **individual devotee basis** (1 slot = 1 devotee registration with photo, Aadhaar, DOB, and physical fitness self-attestation). Group leader allocations are handled under a distinct quota not part of the standard voluntary individual flow.

Therefore, the canonical truth is:
```typescript
CANONICAL_SRIVARI_SEVA = {
  serviceId: 'srivari-seva',
  minPilgrims: 1,
  maxPilgrims: 1,
  exactPilgrims: 1,
  // ...
};
```
The legacy adapter in [`src/services/srivari-seva/index.ts`](file:///src/services/srivari-seva/index.ts) now **derives directly from canonical definitions**:
```typescript
const canonicalSrivari = getCanonicalService('srivari-seva')!;

export const srivariSevaAdapter: ServiceAdapter = {
  id: canonicalSrivari.serviceId,
  name: canonicalSrivari.displayName,
  serviceType: canonicalSrivari.serviceType,
  maxPilgrims: canonicalSrivari.maxPilgrims, // DERIVED: 1 (not hardcoded 10)
  // ...
};
```

---

## 5. Canonical Field Classifications

Every service field is classified under one of six explicit categories:
1. `REQUIRED`: Mandatory for form submission and blocks booking readiness if missing.
2. `OPTIONAL`: May be filled if present; **never blocks readiness**.
3. `CONDITIONAL`: Required only when a prerequisite condition is met (e.g., Passport/Visa for foreign nationals).
4. `NOT_PRESENT`: Not requested on the live TTD form (e.g., General Details on Padmavathi ₹200). Does not block readiness.
5. `USER_CONTROLLED`: Must **never be automated** under any circumstances (e.g., Declaration checkbox, Mentally Fit checkbox, Physically Fit checkbox). Requires explicit devotee confirmation.
6. `SYSTEM_GENERATED`: Generated by TTD servers (e.g., Captcha token, Session token).

### Field Rules Summary
- **₹300 Special Entry Darshan**:
  - Pilgrim: Name \*, Age \*, Gender \*, Photo ID Proof \*, Photo ID Number \*. Mobile and DOB are optional.
  - General: Email \*, City \*, State \*, Country \*, Pincode \*. Mobile is optional.
- **₹200 Padmavathi / Sri PAT**:
  - Pilgrim: Name \*, Age \*, Gender \*, Photo ID Proof \*, Photo ID Number \*.
  - General: `NOT_PRESENT`. Missing email/address does not block ₹200 readiness.
- **₹1600 Divyanugraha Homam**:
  - Exact: 2 Householders.
  - General: **Gothram \***, Email \*, City \*, State \*, Country \*, Pincode \*.
- **Srivari Seva**:
  - Pilgrim Identity: Name \*, DOB \*, Age \*, Gender \*, Photo ID Proof \*, Photo ID Number \*, Mobile \*, Photo \*.
  - Address: Country \*, Pincode \*, State \*, District \*, City \*, Street \*, Door Number \*.
  - Optional (do NOT block readiness): Father/Spouse name, Email, Blood Group, Qualification, Profession, Area of Interest, Mandal, Employee ID.
  - User-Controlled: Declaration, Mentally Fit attestation, Physically Fit attestation.

---

## 6. Canonical Readiness Contract (K04 & K12)

The product-facing readiness contract separates consumer UI states from internal scoring diagnostics.

```typescript
export type BookingReadinessStatus =
  | 'READY'
  | 'ACTION_REQUIRED'
  | 'NOT_READY'
  | 'UNKNOWN';

export interface BookingReadiness {
  status: BookingReadinessStatus;
  headline: string;
  userAction?: string;
  serviceId?: string;
  pilgrimCount: number;
  maxPilgrims?: number;
  exactPilgrims?: number;
  canFill: boolean;
  diagnostics?: InternalDiagnostics;
}
```

### Architectural Separation
- **Consumer UI (Dashboard / Home / Floating Widget)**: Consumes `status`, `headline`, `userAction`, and `canFill`. It never computes or parses percentage scores.
- **Settings / Diagnostics Tab**: Consumes `diagnostics` (`score`, individual checks, itemized recommendations) when deep inspection is needed.
- **`useReadiness` Hook**: Exposes the canonical contract while providing backwards-compatible derived getters (`isReady = status === 'READY'`).

---

## 7. Domain-Driven General Details (K06)

`GeneralDetailsSection.tsx` previously contained ad-hoc component checks (`activeServiceId.includes('padmavathi')`). It now consumes canonical registry functions:
```typescript
import {
  getCanonicalService,
  hasGeneralDetails,
  isFieldRequiredForService,
} from '@services/canonical-service-registry';

const canonicalService = activeServiceId ? getCanonicalService(activeServiceId) : undefined;
const serviceHasGeneralDetails = activeServiceId ? hasGeneralDetails(activeServiceId) : true;
const isGothramRequired = activeServiceId ? isFieldRequiredForService(activeServiceId, 'general', 'gothram') : false;
const isEmailRequired = activeServiceId ? isFieldRequiredForService(activeServiceId, 'general', 'email') : true;
```

---

## 8. Strict Safety Guarantees & Invariants

1. **Attestation Safety**: `declaration`, `mentallyFit`, and `physicallyFit` checkboxes are classified as `USER_CONTROLLED`. SevaPilot detects and highlights them, but never auto-checks them.
2. **Prohibited Automations**: CAPTCHA bypass, OTP interception, payment automation, final booking button submission, and queue manipulation remain strictly prohibited and unsupported.
3. **TTD Temporary Booking Lock Invariant**: Detected server-side locks immediately halt autofill with no automated retries or refreshes.
4. **Zero-PII Logging**: Aadhaar numbers, phone numbers, emails, and photos are never logged to console or telemetry. Only masked representations are displayed in the UI.
5. **Live DOM Precedence**: A live General Details section in the DOM takes immediate priority over a stale `/pilgrim-details` token in the URL.

---

## 9. Verification & Test Evidence

- **New Test Suite**: [`tests/services/canonical-foundation.test.ts`](file:///tests/services/canonical-foundation.test.ts) (32 tests covering registry resolution, limits, field rules, readiness contract, service isolation, live DOM vs URL, and lock handling).
- **TypeScript Typecheck**: Passed with 0 errors (`npm run typecheck`).
- **Production Build**: Built in 5.88s with 0 errors (`npm run build`).
- **Full Vitest Suite**: All 62 test files and 671 tests passed cleanly.

---

## 10. Remaining Work for Phase 2

- Redesign Home UI into the unified Booking Cockpit layout.
- Modernize visual telemetry cards without modifying canonical domain engines.
- Add real-time live page observer to dispatch canonical readiness events.
