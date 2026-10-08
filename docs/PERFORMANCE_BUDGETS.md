# Tirumala SevaPilot — Performance Budgets & Regression Strategy (Phase 12)

## 1. Executive Summary

This document establishes the official quantitative performance budgets and continuous regression prevention strategy for **Tirumala SevaPilot**. 

Every runtime subsystem has a strict upper-bound latency budget. Any commit or PR that exceeds these budgets or violates core safety invariants (Zero CAPTCHA/OTP/Payment automation, Zero PII telemetry, Zero fake queues) must be rejected during verification.

---

## 2. Quantitative Performance Budgets

| Subsystem / Metric | Budget Target | Critical Threshold (Alert) | Measurement Method | Invariant / Boundary |
| :--- | :---: | :---: | :--- | :--- |
| **Extension Startup** | **< 150ms** | > 250ms | Background Service Worker initialization | No synchronous storage blocking |
| **Sidepanel First Render** | **< 50ms** | > 80ms | React hydration & initial render | Zero layout shift |
| **Page / Stage Detection** | **< 15ms** | > 30ms | `detectStage()` with `textContent` (< 0.1ms cache hit) | Anti-reflow; no `innerText` |
| **Service Detection** | **< 20ms** | > 40ms | URL + DOM service signature matching | Canonical service registry rules |
| **DOM Observation Cost** | **< 5ms** | > 10ms | Single micro-batch filter pass | Filters internal extension UI `#sp-*` |
| **Mutation Processing (500+ nodes)** | **< 150ms** | > 300ms | Accumulated debounce batch evaluation | Maximum 1–3 batches per burst |
| **Field Resolution (per field)** | **< 15ms** | > 30ms | Cascading selector lookup | Deterministic first; cached resolution |
| **Field Resolution (full form, 6 devotees)**| **< 100ms** | > 200ms | Complete form schema resolution | Zero whole-document `querySelectorAll` |
| **Autofill Pipeline Execution** | **< 350ms** | > 500ms | Plan -> Act -> Verify sequence (DOM ready) | Skips already-correct; user fields protected |
| **Field Verification (per field)** | **< 5ms** | > 10ms | DOM value reading + Angular validity state | Targeted check; no full-doc rescan |
| **Message Round-Trip Latency** | **< 5ms** | > 15ms | Content <-> Background <-> UI message dispatch | Message coalescer suppresses spam |
| **Storage Read (Settings / Preferences)** | **< 0.1ms** | > 2ms | In-memory cache over `storage.sync` | Non-blocking read |
| **Storage Read (Profiles & Backups)** | **< 5ms** | > 15ms | `storage.local` decryption & load | Sensitive data encrypted |
| **Storage Write Latency** | **< 25ms** | > 50ms | Batched serialization queue | Debounced preference writes |
| **React Re-render Count** | **0 per sec** | > 1 per sec | Interval ticks on idle dashboard | `React.memo` isolates timer cards |
| **Memory Growth (1-hour idle)** | **< 5MB** | > 15MB | Heap snapshot delta | Deterministic `TimerManager` cleanup |
| **Queue Monitoring CPU Usage** | **0.0%** | > 0.5% | Passive observer when queue static | Zero polling; short-circuit token scan |

---

## 3. Zero-PII Performance Telemetry

Telemetry records anonymous operational metrics only. Under no circumstances is personally identifiable information (PII) permitted in performance logs or telemetry stores.

### 3.1 Prohibited Data
- ❌ Devotee full name or partial name
- ❌ Age or date of birth
- ❌ Gender
- ❌ Aadhaar, Passport, Voter ID, or other government identity numbers
- ❌ Mobile phone numbers or email addresses
- ❌ Residential addresses
- ❌ Devotee photos
- ❌ CAPTCHA answers or OTPs
- ❌ Payment credentials, card numbers, UPI IDs, or transaction tokens

### 3.2 Permitted Telemetry Schema
```typescript
interface PerformanceMetric {
  operation: 'dom-scan' | 'field-resolution' | 'fill' | 'verification' | 'recovery' | 'navigation';
  durationMs: number;
  success: boolean;
  retryCount?: number;
  failureCategory?: string;
  timestamp: number;
}
```

---

## 4. Regression Prevention Strategy

To guarantee that performance does not degrade over future development phases (including Phase 13 Professional UI/UX), SevaPilot incorporates an automated multi-layer regression prevention system:

### 4.1 Automated Performance Suites
1. **`tests/content/automation/performance-regression.test.ts`**:
   - Asserts field resolution completes within budget on single and 6-pilgrim forms.
   - Verifies DOM Invalidation Cache hit speed (< 0.1ms) and invalidation correctness upon node removal.
   - Validates that already-correct fields are skipped without redundant DOM dispatch.
   - Confirms user-modified fields are untouched.
   - Verifies `TimerManager` bulk-cleans all registered timers.
   - Verifies `storage.sync` priority and in-memory cache speed.

2. **`tests/content/automation/chaos-performance.test.ts`**:
   - **Stress Test 1: 1,000 Rapid DOM Mutations**: Verifies micro-batching limits evaluations to $\le 3$ batches.
   - **Stress Test 2: Message Storm (200 rapid dispatches)**: Verifies `MessageCoalescer` suppresses redundant identical updates by $> 99\%$.
   - **Stress Test 3: Fast DOM Replacement During Resolution**: Asserts cache drops detached nodes and re-resolves safely without errors.
   - **Stress Test 4: High-Frequency Cache Invalidation**: Asserts zero memory leaks and sub-10ms garbage-free operation.
   - **Stress Test 5: Aborted Session Cleanup**: Verifies all timers, observers, and pending tasks are aborted immediately without lingering promises.

### 4.2 Automated Invariant Gates in CI
Every pull request is automatically verified against:
- `npm run typecheck`: 0 TypeScript errors.
- `npm test`: 100% pass rate across all test files (944+ unit and integration tests).
- `npm run build`: Vite production bundle compiles cleanly.

### 4.3 Code Review Guidelines for Performance
- **No Synchronous Reflows**: Any use of `element.innerText`, `element.offsetHeight`, or `element.getBoundingClientRect()` in hot observation loops must be rejected. Use `textContent` or cached bounds.
- **No Unbounded Polling**: Any `setInterval` or recursive `setTimeout` without registration in `TimerManager` must be rejected.
- **No Whole-Document Queries in Mutations**: `document.querySelectorAll()` is prohibited inside MutationObserver callbacks; mutations must be inspected targetedly from the `MutationRecord[]` batch.
- **No Unmemoized Dashboard Cards**: Any component receiving frequent timer updates must be isolated with `React.memo` or use targeted local state.
