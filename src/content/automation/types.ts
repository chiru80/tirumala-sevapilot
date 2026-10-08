// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Resilient Automation Engine Types (Phase 11)
// Strongly typed state machine, session ownership, field lifecycle,
// and zero-PII performance telemetry.
// ─────────────────────────────────────────────────────────────

/**
 * Strongly typed Canonical Automation States.
 * Arbitrary string mutations are strictly forbidden.
 */
export type AutomationState =
  | 'IDLE'
  | 'OBSERVING'
  | 'PAGE_IDENTIFIED'
  | 'FORM_DETECTED'
  | 'FIELD_RESOLUTION'
  | 'ACTION_PLANNING'
  | 'FILLING'
  | 'VERIFYING'
  | 'RECOVERY'
  | 'USER_ACTION_REQUIRED'
  | 'BLOCKED'
  | 'STOPPED'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Valid state transition matrix.
 * Enforces explicit progression: OBSERVING -> FORM_DETECTED -> FIELD_RESOLUTION -> FILLING -> VERIFYING.
 */
export const VALID_AUTOMATION_TRANSITIONS: Readonly<Record<AutomationState, readonly AutomationState[]>> = {
  IDLE: ['OBSERVING', 'STOPPED'],
  OBSERVING: ['PAGE_IDENTIFIED', 'FORM_DETECTED', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  PAGE_IDENTIFIED: ['FORM_DETECTED', 'OBSERVING', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  FORM_DETECTED: ['FIELD_RESOLUTION', 'OBSERVING', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  FIELD_RESOLUTION: ['ACTION_PLANNING', 'RECOVERY', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  ACTION_PLANNING: ['FILLING', 'RECOVERY', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  FILLING: ['VERIFYING', 'RECOVERY', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  VERIFYING: ['COMPLETED', 'RECOVERY', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  RECOVERY: ['FIELD_RESOLUTION', 'FILLING', 'ACTION_PLANNING', 'USER_ACTION_REQUIRED', 'BLOCKED', 'STOPPED', 'FAILED'],
  USER_ACTION_REQUIRED: ['OBSERVING', 'FIELD_RESOLUTION', 'STOPPED', 'COMPLETED', 'FAILED'],
  BLOCKED: ['OBSERVING', 'STOPPED', 'FAILED'],
  STOPPED: ['IDLE', 'OBSERVING'],
  COMPLETED: ['IDLE', 'OBSERVING'],
  FAILED: ['IDLE', 'OBSERVING', 'RECOVERY', 'STOPPED'],
};

/**
 * Field Lifecycle status representing dynamic DOM state.
 * Prevents destructive blind overwriting.
 */
export type FieldLifecycleState =
  | 'EMPTY'
  | 'EXPECTED'
  | 'ALREADY_CORRECT'
  | 'USER_MODIFIED'
  | 'WRONG_VALUE'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

/**
 * Field ownership tracker.
 * User modification takes strict precedence over automation.
 */
export type FieldOwnership = 'EXTENSION' | 'USER' | 'UNKNOWN';

/**
 * Unique Document and Navigation Context for tracking SPA transitions
 * and preventing stale automation against replaced documents.
 */
export interface NavigationContext {
  tabId: number;
  frameId: number;
  documentId: string;
  url: string;
  timestamp: number;
}

/**
 * Active Automation Session owning all asynchronous tasks and AbortSignal.
 */
export interface AutomationSession {
  sessionId: string;
  tabId: number;
  frameId: number;
  documentId: string;
  serviceId?: string;
  startedAt: string;
  state: AutomationState;
  abortController: AbortController;
  createdAt: number;
}

/**
 * Bounded Retry Policy with jitter and cancellation.
 */
export interface RetryPolicy {
  maxAttempts: number;
  maxElapsedMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  signal?: AbortSignal;
}

/**
 * Reason-aware recovery actions.
 */
export type RecoveryReason =
  | 'FIELD_NOT_FOUND'
  | 'DOM_REPLACED'
  | 'PAGE_CHANGED'
  | 'USER_MODIFIED'
  | 'UNKNOWN_STATE';

export interface RecoveryAction {
  reason: RecoveryReason;
  field?: string;
  pilgrimIndex?: number;
  timestamp: number;
  resolved: boolean;
}

/**
 * Zero-PII Performance Telemetry record.
 * Strictly never records Aadhaar, ID numbers, phone, names, or addresses.
 */
export interface PerformanceMetric {
  operation: 'dom-scan' | 'field-resolution' | 'fill' | 'verification' | 'recovery' | 'navigation';
  durationMs: number;
  success: boolean;
  retryCount?: number;
  failureCategory?: string;
  timestamp: number;
}

/**
 * Micro-batched DOM Mutation record for targeted re-evaluation.
 */
export interface DomMutationBatch {
  addedNodesCount: number;
  removedNodesCount: number;
  attributeChanges: string[];
  affectedSelectors: string[];
  hasFormChanges: boolean;
  hasDisabledChanges: boolean;
  timestamp: number;
}

/**
 * Error thrown when an asynchronous operation is cancelled via AbortSignal.
 */
export class AutomationAbortedError extends Error {
  constructor(message = 'Automation operation was aborted') {
    super(message);
    this.name = 'AutomationAbortedError';
  }
}
