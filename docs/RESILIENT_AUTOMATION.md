# Tirumala SevaPilot — Resilient Automation Engine (Phase 11)

## Executive Summary

Phase 11 transforms SevaPilot from a collection of DOM filling scripts into a **production-grade, resilient, event-driven Chrome MV3 automation engine**. Rather than relying on fragile linear execution:

$$\text{Find input} \longrightarrow \text{Set value} \longrightarrow \text{Click next}$$

SevaPilot operates as an intelligent closed-loop control system:

$$\text{Observe} \longrightarrow \text{Understand} \longrightarrow \text{Resolve} \longrightarrow \text{Plan} \longrightarrow \text{Act} \longrightarrow \text{Verify} \longrightarrow \text{Recover} \longrightarrow \text{Re-observe}$$

---

## Core Pillars of the Resilient Engine

### 1. Strongly Typed State Machine
Scattered boolean flags (`isScanning`, `isFilling`, `isResolving`) are replaced by the canonical [AutomationStateMachine](file:///src/content/automation/state-machine.ts#L22):
- **14 Explicit States**: `IDLE`, `OBSERVING`, `PAGE_IDENTIFIED`, `FORM_DETECTED`, `FIELD_RESOLUTION`, `ACTION_PLANNING`, `FILLING`, `VERIFYING`, `RECOVERY`, `USER_ACTION_REQUIRED`, `BLOCKED`, `STOPPED`, `COMPLETED`, `FAILED`.
- Transitions are strictly validated against an immutable adjacency matrix; illegal jumps throw immediate errors and prevent state corruption.

### 2. Document Identity & SPA Navigation
- In single-page applications (Angular/React), content frequently swaps without a full page reload (`popstate`, `pushState`, `replaceState`).
- Every session generates a unique `documentId` and binds a `NavigationContext`.
- If the document instance changes during execution, the engine **immediately halts** stale automation, preventing cross-page data pollution.

### 3. Targeted DOM Mutation Intelligence
- **No Periodic Whole-Page Scanning**: Bounded `MutationObserver` captures DOM mutations (`childList`, `attributes`).
- Mutations are micro-batched and debounced (50ms).
- Safe Shadow DOM traversal via [DomTraversalEngine](file:///src/content/automation/dom-observation-engine.ts#L16) inspects open shadow roots without breaking browser isolation boundaries.

### 4. Human Field Ownership & Idempotency
- **Human Modification Priority**: Real devotee keystrokes and changes are flagged as `USER_MODIFIED`.
- **Zero Silent Overwrites**: When the devotee customizes an auto-filled field (e.g. changes city from Tirupati to Bangalore), SevaPilot preserves the user's value.
- **Idempotent Autofill**: Repeated invocations (`fill() -> fill()`) safely skip `ALREADY_CORRECT` fields, eliminating duplicate DOM mutations.

### 5. Structured Concurrency & Abortable Everything
- Every automation session is owned by an [AutomationSession](file:///src/content/automation/types.ts#L67) containing an active `AbortController`.
- All operations (DOM querying, retry loops, verification) take an `AbortSignal`.
- Emergency Stop immediately fires `abortController.abort()`, releasing timers and workers deterministically.

### 6. Bounded Retry & Self-Healing Recovery
- Exponential backoff with full jitter (100ms, 250ms, 500ms, 1s, 2s).
- **Strict Exclusion Boundary**: Never automatically retries CAPTCHAs, OTPs, payments, booking locks, or human declarations.
- Controlled recovery strategies handle transient DOM churn (`FIELD_NOT_FOUND`, `DOM_REPLACED`, `PAGE_CHANGED`).

---

## Architectural Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   TTD Web Application                  │
└───────────────────────────┬────────────────────────────┘
                            │ DOM Mutations / Events
                            ▼
┌────────────────────────────────────────────────────────┐
│              DomObservationEngine                      │
│        (Debounced Micro-batching, 50ms)                │
└───────────────────────────┬────────────────────────────┘
                            │ Batch Notification
                            ▼
┌────────────────────────────────────────────────────────┐
│              SPANavigationDetector                     │
│      (pushState, replaceState, popstate, DocId)        │
└───────────────────────────┬────────────────────────────┘
                            │ Document Validated
                            ▼
┌────────────────────────────────────────────────────────┐
│              AutomationStateMachine                    │
│      OBSERVING ──► FORM_DETECTED ──► FIELD_RESOLUTION  │
└───────────────────────────┬────────────────────────────┘
                            │ Action Plan
                            ▼
┌────────────────────────────────────────────────────────┐
│              FieldOwnershipTracker                     │
│         USER_MODIFIED ──► Preserve                     │
│         ALREADY_CORRECT ──► Idempotent Skip            │
│         EMPTY / WRONG_VALUE ──► Target Fill            │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   ResilientRetryEngine    │ │      RecoveryEngine      │
│  (Bounded Exponential,    │ │ (DOM_REPLACED,           │
│   Safety Exclusion)       │ │  FIELD_NOT_FOUND)        │
└───────────────────────────┘ └──────────────────────────┘
```

---

## Security & Privacy Guarantee

1. **Zero Queue Bypass**: No token manipulation, spoofing, or queue circumvention.
2. **Untrusted DOM**: Page elements are treated as untrusted; no `eval()`, no `new Function()`, no unescaped HTML injection.
3. **Zero PII Telemetry**: Performance metrics track operation name and duration in milliseconds. Names, Aadhaar numbers, phone numbers, and addresses are strictly excluded.
