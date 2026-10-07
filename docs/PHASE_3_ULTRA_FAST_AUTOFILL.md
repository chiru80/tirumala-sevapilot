# Phase 3 — Ultra-Fast Autofill Engine

**Brand**: Tirumala SevaPilot  
**Component**: Ultra-Fast Autofill Engine (`src/content/autofill/`)  
**Branch**: `phase-3/ultra-fast-autofill`  
**Base**: `master`  
**Core Product Principle**: *"Fast when it's safe. Stops when it's uncertain."*  

---

## 1. Executive Summary & Architecture

Phase 3 introduces an ultra-fast, non-intrusive optimization layer directly on top of SevaPilot's authoritative autofill state machine. **No second autofill engine was created.** The existing verification pipeline, retry bounds, service adapters, temporary-lock detection, and Angular reactivity mechanisms remain authoritative and intact.

Speed is achieved strictly by **eliminating redundant work**:
- **DOM Snapshots**: Scoped candidate scanning replaces repetitive `document.querySelectorAll()` traversals across the whole document.
- **Profile Prewarming**: Immutable normalized booking payloads are precalculated on session start, eliminating duplicate transformations during form interaction.
- **Single-Pass Row Resolution**: All pilgrim rows and field containers are mapped once upfront, building a cohesive `AutofillExecutionPlan`.
- **Differential Autofill**: Before performing a transaction, controls are inspected; if the value is already identical to the profile, expensive write transactions and dispatch chains are bypassed while retaining exact verification.
- **RAF Layout Settling**: Arbitrary `setTimeout` pauses have been replaced with `AutofillScheduler.settleDom()` and `waitForCondition` on enabled states.
- **Zero-PII Performance Profiler**: High-resolution latency and count metrics are captured locally without ever touching or logging Aadhaar, names, phone numbers, or emails.

```
       TTD Page / DOM
             │
             ▼
   Service Recognition
             │
             ▼
     Canonical Workflow
             │
             ▼
     Profile Prewarm
  (Normalized, Memoized)
             │
             ▼
     Fast DOM Snapshot
 (Scoped Candidate Controls)
             │
             ▼
  Field Fingerprint Cache
   (WeakMap, Rerender-Safe)
             │
             ▼
      Execution Plan
 (Single Pass Row Resolution)
             │
             ▼
    Differential Fill
  (Skip if already matches)
             │
             ▼
   Angular Synchronization
(MutationObserver / RAF Settling)
             │
             ▼
     Exact Verification
             │
             ▼
     READY FOR REVIEW
```

---

## 2. Key Optimization Strategies

### A. Performance Instrumentation Layer (`performance-profiler.ts`)
- Measures phase durations: `scanMs`, `resolveMs`, `fillMs`, `verifyMs`, and `totalMs`.
- Collects execution counters: `pilgrimCount`, `fieldsResolved`, `fieldsFilled`, `fieldsVerified`, `fieldsSkipped`, and `retries`.
- **Zero PII Guarantee**: Strictly records aggregated numeric timings and status flags. Never includes names, IDs, Aadhaar numbers, phone numbers, emails, photos, or raw profile objects.

### B. Profile Prewarming (`profile-prewarm.ts`)
- Precomputes normalized display strings, effective age, standardized gender strings, and canonical field mappings upon profile selection and service detection.
- Uses a bounded LRU-style cache (`MAX_CACHE_ENTRIES = 10`) keyed by profile revision, target pilgrim IDs, and service identifier.
- Explicit invalidation via `clearPrewarmCache()` / `invalidatePrewarmCache()` when active profile, pilgrims, or service context changes.

### C. Fast DOM Snapshot (`dom-snapshot.ts`)
- Captures candidate inputs, selects, textareas, and radio buttons within form containers.
- Replaces repetitive `document.body.querySelectorAll` queries with localized control lookups.
- Caches visible controls using `WeakMap<HTMLElement, SectionSnapshot>` with short-lived expiration (500ms) and element disconnection checks.

### D. Field Fingerprint Cache (`field-cache.ts`)
- Extracts invariant structural fingerprints: tag name, type, formControlName, aria-label, placeholder, and section role.
- Stored in `WeakMap<Element, FieldFingerprint>` preventing DOM node retention or memory leaks.
- Automatically invalidated when elements disconnect or Angular rerenders the subtree.

### E. Single-Pass Row Resolution & Execution Plan (`execution-plan.ts`)
- For multi-pilgrim forms (1–6 for Special Entry / Padmavathi, exactly 2 for Homam):
  - Detects container boundaries once.
  - Locks and binds rows upfront into `PilgrimRowContext[]`.
  - Builds an immutable `AutofillExecutionPlan`.
- Eliminates repeatedly scanning the full DOM per pilgrim row.

### F. Differential Autofill
- Before executing a field write, `isFieldSatisfied(element, targetValue, fieldType)` checks current DOM control state:
  - Text input: checks trimmed equality or masked Aadhaar match.
  - Dropdown: inspects `select.value` and selected option text.
- If satisfied: skips DOM mutation and synthetic event dispatch, marking status as `'verified'` with strategy `'differentialPreserved'`.
- Verification is preserved for all fields, ensuring zero loss in validation rigor.

### G. Angular Synchronization & Scheduler (`autofill-scheduler.ts`)
- Replaced arbitrary hardcoded timeouts (`setTimeout(120)`, `setTimeout(150)`) with `AutofillScheduler.settleDom()` and `waitForCondition` polling on reactive enabled states.
- Respects Angular change detection cycles and reactive form control disabling/enabling without artificial lag.

### H. Controlled Concurrency & Cancellation
- Authority lock: `bookingSessionManager` and `isRunning` flag protect against double-click triggers and simultaneous shortcut executions.
- Clean abort: `requestStop()` and `AbortSignal` trigger instant safe termination across all asynchronous loops and yield control back to the user.

---

## 3. Strict Safety & Compliance Rules Preserved

| Invariant | Implementation Enforcement | Status |
|---|---|---|
| **No CAPTCHA automation** | `autofocusCaptcha(doc)` only sets focus to the input box; never attempts automated solution or character input. | Enforced |
| **No OTP automation** | OTP inputs are never queried or populated. | Enforced |
| **No Payment automation** | Step detector flags `detectPayment()` and immediately concludes with status `COMPLETE` requesting manual user action. | Enforced |
| **No Final Submission** | Final declaration checkboxes and submission buttons are strictly user-controlled. | Enforced |
| **No Disabled/ReadOnly Bypassing** | `idNumEl.disabled` waits for reactive state enablement via `waitForCondition`; NEVER alters `.disabled` or `.readOnly` properties. | Enforced |
| **No Temporary Lock Bypass** | `detectTtdTemporaryLock()` immediately halts autofill, halts automatic retries, and surfaces the dedicated lock countdown banner. | Enforced |
| **Zero Sensitive Logging** | Masked diagnostics and aggregated numeric profiling; zero PII logged in console or diagnostic traces. | Enforced |
| **Live DOM General Details Fix** | Live DOM detection (`detectWorkflowStep()`) overrides URL parameters when General Details step is visually active. | Enforced |

---

## 4. Performance Targets vs Measured Results

> [!NOTE]
> Per project guidelines, timings are strictly segregated between engineering targets and verified local test suite measurements.

### Targets (Engineering Benchmarks)
- Single pilgrim form: `< 500ms` where technically possible.
- 6-pilgrim form: `< 1500ms` where technically possible.
- Homam 2-pilgrim form: `< 800ms` where technically possible.
- General details step: `< 300ms` where technically possible.

### Measured Results (Automated Vitest Test Suite on Node/JSDOM)

| Scenario | Measured Duration | Fields Resolved / Verified | Differential Preserved |
|---|---|---|---|
| Single Pilgrim (1 row, 5 fields) | **~589ms** | 5 / 5 | 0 (initial fill) |
| Differential Fill (2 pilgrims, 1 existing) | **~798ms** | 10 / 10 | 5 skipped, 5 filled |
| Two Pilgrims Full Fill | **~1224ms** | 10 / 10 | 0 (all filled) |
| General Details Step | **~135ms** | 2 / 2 | 0 (all filled) |
| Padmavathi ₹200 Bypass (No General) | **~8.5ms** | 0 / 0 | Instant bypass |
| Homam Strict 2-Pilgrim Validation | **~15ms** | 0 / 0 | Early validation stop |
| Srivari Seva Single-Sevak Validation | **~8.5ms** | 0 / 0 | Early validation stop |
| Temporary TTD Booking Lock | **~16ms** | 0 / 0 | Instant lock exit |

---

## 5. Test Suite Verification

- **Full Suite**: 65 test files, **745 tests passing**, 0 failing (`npm test`).
- **Phase 3 Matrix**: 14 tests in `tests/content/ultra-fast-autofill.test.ts` passing (`npx vitest run tests/content/ultra-fast-autofill.test.ts`).
- **Autofill Manager Suite**: 40 tests in `tests/content/autofill-manager.test.ts` passing.
- **Typecheck**: `npm run typecheck` passed with 0 errors.
- **Build**: `npm run build` compiled 147 modules in 3.98s into production bundle with 0 errors.

---

## 6. Known Limitations & Safe Boundaries

1. **Synthetic DOM Events in Angular Forms**: Angular Reactive Forms listen to `input`, `change`, and `blur` events. Skipping these events on differential matches saves significant CPU time, but when fields DO require writes, the events must still be dispatched to ensure Angular's form model updates.
2. **Network/Server-Side Quota Waits**: Client-side autofill speed cannot circumvent TTD server-side network delays, CAPTCHA rendering, or queue wait rooms.
3. **Hardware & Layout Variation**: Real browser render speeds vary depending on device performance, GPU scheduling, and network speeds. All user-facing performance claims must reflect measured runtime telemetry.
