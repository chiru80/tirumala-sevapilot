# Tirumala SevaPilot — Phase 3: Service Intelligence & Limit Enforcement

**Om Namo Venkatesaya**  
**Repository:** https://github.com/chiru80/tirumala-sevapilot  
**Branch:** `phase-3/service-intelligence`  
**Base:** `master`

---

## 1. Executive Summary & Objectives

In Phase 1, Tirumala SevaPilot established the Canonical Service Registry and eliminated conflicting devotee limits (such as the legacy Srivari Seva 1 vs 10 pilgrim contradiction). In Phase 2, the user-facing Booking Cockpit was built to present a fast, confident, single dominant CTA during booking moments.

**Phase 3 — Service Intelligence** centralizes and deepens the domain rules across all four supported services, establishes strict limit and count enforcement, links legacy configurations directly to canonical sources of truth, and verifies the full **Service × Pilgrim-Count Matrix** (1 to 6 devotees) with exhaustive automated test coverage.

---

## 2. Centralized Service Intelligence Engine

Located at: [`src/services/service-intelligence.ts`](file:///src/services/service-intelligence.ts)

The `ServiceIntelligence` engine provides an authoritative, single-entrypoint API for any subsystem requiring service rules, count validation, or compatibility checking:

```typescript
export class ServiceIntelligence {
  // 1. Authoritative service rules query
  public static getRules(serviceIdOrType: string): ServiceRulesSummary | undefined;

  // 2. Strict count and quota limit validation
  public static validatePilgrimCount(serviceId: string, count: number): PilgrimCountValidation;

  // 3. General Details step expectation
  public static isGeneralDetailsExpected(serviceId: string): boolean;

  // 4. User-controlled field detection
  public static isUserControlled(serviceId: string, fieldKey: string): boolean;

  // 5. Complete profile compatibility verification
  public static checkCompatibility(profile: Profile, serviceId: string, selectedPilgrims?: Pilgrim[]): ServiceCompatibilityResult;
}
```

---

## 3. Four Canonical Service Rules Summary

| Canonical Service ID | Display Name | Category | Price | Min Pilgrims | Max Pilgrims | Exact Limit | General Details Step | Mandatory Unique Requirements | User-Controlled Protections |
|---|---|---|---|---|---|---|---|---|---|
| `special-entry-darshan-300` | Special Entry Darshan ₹300 | `DARSHAN` | ₹300 | 1 | 6 | — | **YES** (Step 2 after Pilgrims) | Email, City, State, Country, PIN | Declaration Checkbox |
| `padmavathi-supadham-entry-200` | Padmavathi / Sri PAT | `DARSHAN` | ₹200 | 1 | 6 | — | **NO** (Not present in verified flow) | SPAT route dominance | Declaration Checkbox |
| `sri-srinivasa-divyanugraha-homam` | Divyanugraha Homam (₹1600) | `ARJITHA_SEVA` | ₹1600 | 2 | 2 | **2** (Householders) | **YES** (Step 2 before Pilgrims) | **Gothram REQUIRED** for sankalpam | Declaration Checkbox |
| `srivari-seva` | Srivari Seva | `VOLUNTEER` | ₹0 | 1 | 1 | **1** (Individual slot) | **YES** (Unified Enrollment) | DOB, Mobile, Photo, Full Address | Declaration, Mentally Fit, Physically Fit |

---

## 4. Strict Limit Enforcement & Quota Rules

### 1. ₹300 Special Entry Darshan (SED)
- **Allowed Pilgrim Counts:** 1, 2, 3, 4, 5, 6 devotees per booking.
- **Disallowed Counts:** 0 devotees (rejects with action required), >6 devotees (rejects with "allows a maximum of 6 devotees per booking").
- **General Details:** Mandatory (`email`, `city`, `state`, `country`, `pinCode`). `mobile` is optional and never blocks readiness.
- **Safety:** Declaration checkbox is strictly `USER_CONTROLLED` and must be ticked manually by the devotee.

### 2. ₹200 Padmavathi / Sri PAT (SPAT)
- **Allowed Pilgrim Counts:** 1, 2, 3, 4, 5, 6 devotees per booking.
- **Disallowed Counts:** 0 devotees, >6 devotees.
- **General Details:** Confirmed **NOT PRESENT** in verified TTD SPAT flow. Missing email/address never blocks readiness for SPAT bookings.
- **Safety:** Declaration checkbox is strictly `USER_CONTROLLED`.

### 3. ₹1600 Sri Srinivasa Divyanugraha Vishesha Homam
- **Allowed Pilgrim Counts:** STRICTLY **exact 2** devotees (Householders).
- **Disallowed Counts:** 1 devotee (rejects with "requires exactly 2 devotees (Householders)"), 3, 4, 5, 6 devotees (rejects with exact count requirement).
- **General Details:** Mandatory with **Gothram required** for sankalpam. Missing Gothram explicitly blocks readiness.
- **Safety:** Declaration checkbox is strictly `USER_CONTROLLED`.

### 4. Srivari Seva Voluntary Pilgrim Service
- **Allowed Pilgrim Counts:** STRICTLY **exact 1** devotee slot.
- **Disallowed Counts:** 2 or more devotees (rejects with "voluntary enrollment is issued strictly on an individual basis (exactly 1 devotee)").
- **Enrollment Details:** Mandatory `fullName`, `dateOfBirth`, `age`, `gender`, `idType`, `idNumber`, `mobile`, `photo`, `doorNumber`, `street`, `district`, `city`, `state`, `country`, `pincode`.
- **Optional Details:** `fatherSpouseName`, `email`, `bloodGroup`, `qualification`, `profession`, `areaOfInterest`, `mandal` (never block readiness).
- **Safety:** Declaration, Mentally Fit attestation, and Physically Fit attestation are strictly `USER_CONTROLLED` and must NEVER be automated.

---

## 5. Service × Pilgrim-Count Test Matrix

Exhaustive test suite implemented at [`tests/services/service-matrix.test.ts`](file:///tests/services/service-matrix.test.ts) covering all 54 scenarios:

| Service | 1 Devotee | 2 Devotees | 3 Devotees | 4 Devotees | 5 Devotees | 6 Devotees | 7+ Devotees | Notes |
|---|---|---|---|---|---|---|---|---|
| **₹300 Special Entry Darshan** | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ❌ REJECTED | General Details expected |
| **₹200 Padmavathi / Sri PAT** | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ✅ READY | ❌ REJECTED | No General Details step |
| **₹1600 Divyanugraha Homam** | ❌ REJECTED | ✅ READY | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | Exact 2 required + Gothram |
| **Srivari Seva** | ✅ READY | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | ❌ REJECTED | Exact 1 individual slot |

---

## 6. Elimination of Parallel Sources of Truth

Legacy configuration files in `src/services/ttd-information/ttd-service-rules.ts`:
- `SPECIAL_ENTRY_300_CONFIG` now derives limits, workflowId, price, and required fields directly from `CANONICAL_SPECIAL_ENTRY_300`.
- `PADMAVATHI_200_CONFIG` now derives limits, workflowId, price, and required fields directly from `CANONICAL_PADMAVATHI_200`.
- `HOMAM_1600_CONFIG` now derives limits, workflowId, price, and required fields directly from `CANONICAL_HOMAM_1600`.
- `SRIVARI_SEVA_CONFIG` now derives limits, workflowId, price, and required fields directly from `CANONICAL_SRIVARI_SEVA`.
- `getServiceConfig(id)` now falls back seamlessly to `getCanonicalService(id)`, ensuring that canonical IDs, aliases (`sed-300`, `spat`, `homam-1600`), and canonical definitions resolve identically across all callers.

---

## 7. Safety Invariants Preserved

1. **Zero CAPTCHA automation:** Visual human verification is never bypassed.
2. **Zero OTP automation:** SMS/mobile authentication remains 100% under human control.
3. **Zero payment automation:** Bank, UPI, and payment gateway entry is never automated.
4. **Zero final submission automation:** Booking submit buttons are never auto-clicked.
5. **Zero declaration/fitness auto-ticking:** Devotee attestations are strictly user-controlled.
6. **Zero sensitive logging:** Aadhaar, mobile, and devotee PII are masked in all logs and telemetry.
