# Phase 5 — Profiles & Pilgrim Manager Intelligence

**Brand**: Tirumala SevaPilot  
**Component**: Profiles & Devotee Booking Group Manager (`src/sidepanel/components/dashboard/PilgrimSelection.tsx`, `src/sidepanel/components/profiles/ProfileCard.tsx`, `src/services/service-intelligence.ts`, `src/services/profile-health.ts`)  
**Branch**: `phase-5/pilgrim-manager`  
**Base**: `master`  
**Core Principle**: *"Clear 1–6 booking group UX with strict service limit enforcement before and during booking."*  

---

## 1. Executive Summary & Architecture

Phase 5 replaces flat, disconnected devotee lists with a structured, visual **1–6 Devotee Booking Group Manager** with real-time service compatibility and limit enforcement:

1. **Six-Devotee Visual Booking Group**:
   - Explicit slot layout (`Slot 1` to `Slot 6` for SED ₹300 / SPAT ₹200; `Slot 1` and `Slot 2` for Homam ₹1600; `Slot 1` for Srivari Seva).
   - Visual slot tracker bar illustrating real-time devotee allocation (`Slot 1 ✓`, `Slot 2 ✓`, etc.).
   - Interactive cards with status badges (`✓ Ready` vs `⚠ Needs attention` / `⚠ Action required`).
   - One-click devotee editing with direct focus on incomplete fields.
   - Dynamic "+ Add Devotee (Slot N)" slot card when service capacity permits.

2. **Service Compatibility & Exact Limit Enforcer**:
   - Evaluates profiles against live canonical service rules:
     - **₹300 Special Entry Darshan**: 1–6 devotees, Step 2 General Details required.
     - **₹200 Padmavathi / Sri PAT**: 1–6 devotees, strictly NO General Details step.
     - **₹1600 Divyanugraha Homam**: Strictly 2 devotees (Householders), Gothram mandatory.
     - **Srivari Seva**: Strictly 1 devotee slot, embedded address & identity fields mandatory.
   - Surfaces instant compatibility feedback:
     - 🟢 `✓ Compatible`: Devotee count and all field requirements satisfied.
     - 🟡 `Limit / Requirements Alert`: Explains exact mismatch (e.g. *"Homam permits exactly 2 pilgrims (1 selected)"*).
     - Single-tap **Auto-select for Service** reconciliation button that automatically selects the first valid N devotees matching exact or bounded quota.

3. **Required-Field Readiness**:
   - `ServiceIntelligence.getDevoteeReadiness(pilgrim, serviceId)` provides field-by-field checklist validation.
   - `calculateProfileHealth` computes canonical service-aware General Details completeness (detecting when General Details is not present for Padmavathi ₹200 or embedded for Srivari Seva).

---

## 2. Service Compatibility & Limits Matrix

| Service | Min Devotees | Max Devotees | Exact Devotees | General Details Step | Mandatory Unique Fields | Selection Enforcement |
|---|---:|---:|---:|---|---|---|
| **Special Entry Darshan ₹300** | 1 | 6 | — | **Yes** (Step 2) | Email, City, State, Country, PIN | Blocks 7th devotee |
| **Padmavathi / Sri PAT ₹200** | 1 | 6 | — | **No** (Auto-satisfied) | Name, Age, Gender, ID Proof, ID Number | Blocks 7th devotee |
| **Divyanugraha Homam ₹1600** | 2 | 2 | **2** | **Yes** (Step 2) | Gothram, City, State, Country, PIN | Blocks 3rd devotee |
| **Srivari Seva** | 1 | 1 | **1** | **No** (Embedded in enrollment) | DOB, Photo, Mobile, Address, District | Blocks 2nd devotee |

---

## 3. Devotee Auto-Reconcile Algorithm

When users switch between services or click **Auto-select for service**, `ServiceIntelligence.reconcilePilgrimSelection(profile, serviceId)` executes:

```text
Input: Profile + Target Service ID
  │
  ▼
1. Fetch Canonical Service Definition (min, max, exactPilgrims)
  │
  ▼
2. Evaluate each devotee's readiness for target service
  │
  ├── Group A: Devotees with 100% field readiness (Name, Age/DOB, Gender, ID Proof & Number)
  │
  └── Group B: Incomplete devotees
  │
  ▼
3. Rank & Slice: Select [Group A, Group B].slice(0, targetLimit)
  │
  ▼
Output: Exactly [targetLimit] IDs, prioritizing ready devotees
```

---

## 4. Test Suite Coverage

- **Phase 5 Dedicated Test Suite**: [`tests/services/phase5-pilgrim-manager.test.ts`](file:///tests/services/phase5-pilgrim-manager.test.ts) (13/13 tests passing)
- **Pilgrim Selection Suite**: [`tests/sidepanel/PilgrimSelection.test.tsx`](file:///tests/sidepanel/PilgrimSelection.test.tsx) (11/11 tests passing)
- **Profiles Page Suite**: [`tests/sidepanel/Profiles.test.tsx`](file:///tests/sidepanel/Profiles.test.tsx) (4/4 tests passing)
- **Service Matrix Suite**: [`tests/services/service-matrix.test.ts`](file:///tests/services/service-matrix.test.ts) (54/54 tests passing)
- **Profile Health Suite**: [`tests/services/profile-health.test.ts`](file:///tests/services/profile-health.test.ts) (21/21 tests passing)
- **Total Test Matrix**: 117 tests passing across 11 test suites.
- **Typecheck**: `npm run typecheck` passed with 0 errors.
- **Production Build**: `npm run build` compiled 148 modules in 2.99s.
