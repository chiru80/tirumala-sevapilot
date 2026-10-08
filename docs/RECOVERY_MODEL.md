# Tirumala SevaPilot — Recovery Model (Phase 11)

## Overview

The Recovery Model defines how SevaPilot gracefully absorbs transient errors, asynchronous rendering delays, and human interventions on dynamic TTD pages.

---

## 1. Reason-Aware Recovery Strategies

| Failure Trigger | Recovery Strategy | Action Taken |
|---|---|---|
| `FIELD_NOT_FOUND` | `re-observe-and-re-resolve` | Invalidates local selector cache. Requests a targeted DOM re-scan through `DomObservationEngine` and retries field resolution boundedly. |
| `DOM_REPLACED` | `invalidate-element-pointer` | Reactive framework (Angular / React) unmounted and re-mounted the container. Discards the stale DOM node pointer and queries fresh element from the current root. |
| `USER_MODIFIED` | `preserve-user-value` | Human devotee edited or adjusted the input value. Automation marks field as `USER_MODIFIED` and skips writing, preserving devotee choice. |
| `PAGE_CHANGED` | `abort-and-re-evaluate-page` | SPA route or history navigation detected (`pushState`/`popstate`). Cancels active session and triggers stage re-evaluation. |
| `UNKNOWN_STATE` | `safe-halt` | Ambiguous DOM condition. Halts automation immediately and transitions to `USER_ACTION_REQUIRED`. Never guesses. |

---

## 2. Hard Exclusion Boundaries (Never Automatically Retried)

Under no circumstances does the engine automatically retry:

1. **CAPTCHA Challenges**: User must solve manually.
2. **OTP Verification**: User must enter OTP manually.
3. **Payment Gateways**: User must approve payments manually.
4. **Final Booking Submission**: User must click submit manually.
5. **Temporary TTD Booking Locks**: Requires waiting for TTD server hold expiration.
6. **Srivari Seva Declarations**: User must personally confirm attestations.

---

## 3. Bounded Exponential Backoff Parameters

The retry engine utilizes full jitter to avoid stampeding server resources:

$$\text{delay} = \min(\text{baseDelay} \times 2^{\text{attempt} - 1}, \text{maxDelay}) \times \text{jitterFactor}$$

- `baseDelayMs`: 100 ms
- `maxDelayMs`: 2000 ms
- `maxAttempts`: 5
- `maxElapsedMs`: 6000 ms
- `jitter`: Enabled ($0.5 \le \text{jitterFactor} \le 1.0$)
- `signal`: AbortSignal checked on every step
