# Tirumala SevaPilot — Performance Baseline & Performance Budgets (Phase 12)

## 1. Executive Summary

This document establishes the empirical performance baselines, measurement methodologies, and strict performance budgets for **Phase 12: Performance Engineering & Zero-Lag Runtime**. 

The goal is to provide **sub-50ms devotee UI interactions**, **sub-100ms DOM field resolution**, **sub-500ms autofill completion**, and **near-zero idle content-script CPU usage** across all official TTD booking workflows without ever compromising safety boundaries (CAPTCHA, OTP, Payment, Declarations, or Temporary Booking Locks).

---

## 2. Empirical Performance Baseline Measurements

Measured on standard environment (Chrome MV3 / Node v20+ / jsdom benchmark suite):

| Metric / Subsystem | Measured Baseline | Baseline Behavior | Target Optimization Budget |
| :--- | :---: | :--- | :--- |
| **UI Interaction Latency** (Popup / SidePanel) | ~35ms – 65ms | State re-evaluations trigger multiple unmemoized renders | **< 50ms** |
| **Field Resolution Cost** (per pilgrim) | ~18ms – 45ms | Full selector iteration across un-indexed DOM elements | **< 15ms** (< 100ms full form) |
| **Normal Autofill Duration** (DOM ready) | ~250ms – 450ms | Sequential filling with synthetic micro-ticks | **< 350ms** (target < 500ms budget) |
| **Verification Duration** (per field) | ~5ms – 12ms | DOM value reading + Angular FormControl status check | **< 5ms** |
| **Queue Detection Scan** | **~12.13ms** | Evaluates multiple token regexes & DOM selectors per scan | **< 4ms** (short-circuiting + signal cache) |
| **Mutation Batching & Ingestion** (500 nodes) | 1 batch / 308ms | Micro-batched at 20-60ms debounce window | **< 150ms** |
| **Storage Read Latency** (Profiles) | ~0.11ms – 0.26ms | In-memory mock / local storage deserialization | **< 5ms** |
| **Storage Read Latency** (Settings) | ~0.48ms | Reads entire setting object on demand | **< 2ms** |
| **Storage Write Serialization** | Enqueued promises | Sequential write queue prevents race conditions | Batched writes + sync storage separation |
| **Message Round-Trip Latency** | ~2ms – 8ms | Background <-> Content script message validation | **< 5ms** |
| **Content Script Idle CPU** | 0.0% – 0.2% | Passive MutationObserver waiting, no setInterval polling | **0.0%** (zero unbounded timers) |

---

## 3. Strict Performance Budgets

| Budget Domain | Strict Target | Safety & Correctness Invariant |
| :--- | :--- | :--- |
| **Devotee UI Actions** | **< 50ms** | UI clicks, modal toggles, language switches must feel instant. |
| **DOM Field Resolution** | **< 100ms** | For pre-rendered forms, field resolution must complete in < 100ms. |
| **Form Autofill Pipeline** | **< 500ms** | Complete idempotent fill for up to 6 devotees within 500ms. |
| **Mutation Overhead** | **Debounced & Classified** | Never perform full-document `querySelectorAll` on mutation ticks. |
| **Idle CPU Utilization** | **Near Zero (0%)** | Zero `setInterval` polling loops; strictly event-driven. |
| **Memory Footprint** | **Deterministic Lifecycle** | Every listener, observer, and timer must have an explicit `dispose()` / `cleanup()`. |
| **Storage Access** | **Batched & Sensitive-Separated** | `storage.sync` for user preferences, `storage.session` for ephemeral state. |

---

## 4. Key Performance Pillars for Phase 12

1. **DOM Invalidation Cache**:
   - Cache resolved input, select, and container elements keyed by `serviceId` + `documentId`.
   - Invalidate immediately on DOM node removal, subtree replacement, or SPA navigation.

2. **MutationObserver Filter Pipeline**:
   - Filter out style changes, irrelevant text mutations, and non-form mutations before triggering field evaluation.
   - Ignore mutations inside extension's own UI containers.

3. **Message Deduplication & Coalescing**:
   - Deduplicate sequential identical queue states (e.g. repetitive `QUEUE_PROGRESSING` updates) to avoid UI re-render storms.

4. **React Rendering Optimization**:
   - Memoize heavyweight dashboard cards (`ReleaseCountdownCard`, `QueueCard`, `BookingCockpit`).
   - Use stable callbacks and selector-based subscriptions so unrelated storage updates do not cause whole-dashboard renders.

5. **Storage Architecture Separation**:
   - Route lightweight UI settings (`language`, `theme`, `compactView`) to `chrome.storage.sync` with automatic fallback to `chrome.storage.local`.
   - Debounce rapid preference writes.

6. **Deterministic Memory Cleanup**:
   - Audit all `setTimeout`, `setInterval`, `addEventListener`, `MutationObserver`, and `AbortController` references to guarantee deterministic cleanup.
