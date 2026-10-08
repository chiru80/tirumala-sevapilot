// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Queue Intelligence Canonical Types (Phase 10)
// Production-grade TTD Digital Queue Awareness & Safe Waiting Model
// ─────────────────────────────────────────────────────────────

/**
 * Canonical TTD Digital Queue States.
 * Internal state machine values (never exposed raw to devotees).
 */
export type QueueState =
  | 'QUEUE_UNKNOWN'
  | 'QUEUE_NOT_PRESENT'
  | 'QUEUE_DETECTED'
  | 'QUEUE_LOADING'
  | 'QUEUE_WAITING'
  | 'QUEUE_PROGRESSING'
  | 'QUEUE_ACTION_REQUIRED'
  | 'QUEUE_CAPTCHA_REQUIRED'
  | 'QUEUE_SESSION_WARNING'
  | 'QUEUE_SESSION_EXPIRED'
  | 'QUEUE_COMPLETED'
  | 'QUEUE_ERROR'
  | 'QUEUE_BLOCKED'
  | 'QUEUE_INTERRUPTED'
  | 'QUEUE_CHANGED'
  | 'QUEUE_EXITED';

/**
 * Visible queue progress reported legitimately by official TTD DOM.
 */
export interface QueueProgressInfo {
  /** Verified numeric position (e.g. 124) if official page reports it */
  position?: number;
  /** Raw text description of position from official DOM */
  rawPositionText?: string;
  /** Explicit official wait time string (e.g. "10 minutes") only if provided by TTD */
  officialWaitTime?: string;
  /** Whether the wait time / position is an official TTD value (never synthetic) */
  isOfficialEstimate: boolean;
  /** Human-readable status hint */
  statusMessage?: string;
  /** Timestamp when position/time was read from DOM */
  lastUpdated: string;
}

/**
 * Isolated queue session representing an active waiting room instance.
 */
export interface QueueSession {
  sessionId: string;
  tabId?: number;
  state: QueueState;
  progress?: QueueProgressInfo;
  reasons: string[];
  startedAt: string;
  updatedAt: string;
  error?: string;
}

/**
 * Multi-signal detection result from analyzing live page DOM.
 */
export interface QueueDetectionResult {
  state: QueueState;
  isQueuePresent: boolean;
  confidence: number;
  reasons: string[];
  progress?: QueueProgressInfo;
  isCaptchaPresent: boolean;
  isSessionExpired: boolean;
  isTemporaryLock: boolean;
  errorMessage?: string;
}

/**
 * Bounded set of user-notifiable queue events (no spam, deduplicated).
 */
export type QueueNotificationEvent =
  | 'QUEUE_DETECTED'
  | 'QUEUE_PROGRESS'
  | 'QUEUE_ACTION_REQUIRED'
  | 'QUEUE_CAPTCHA_REQUIRED'
  | 'QUEUE_SESSION_WARNING'
  | 'QUEUE_COMPLETED'
  | 'QUEUE_INTERRUPTED'
  | 'QUEUE_ERROR';
