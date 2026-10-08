// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Queue Manager & Lifecycle Orchestrator (Phase 10)
// Manages safe passive waiting, multi-tab isolation, and guardian handoff.
// ─────────────────────────────────────────────────────────────

import { generateId } from '@shared/utils';
import logger from '@shared/logger';
import { detectQueueState } from './queue-detector';
import type {
  QueueDetectionResult,
  QueueNotificationEvent,
  QueueProgressInfo,
  QueueSession,
  QueueState,
} from './types';

export type QueueStateChangeCallback = (session: QueueSession, event?: QueueNotificationEvent) => void;
export type QueueCompletionCallback = (session: QueueSession) => void;

/**
 * Passive, non-intrusive Queue Orchestrator.
 * Adheres strictly to Zero Queue Bypass and Safe Passive Waiting.
 */
export class QueueManager {
  private activeSession: QueueSession | null = null;
  private observer: MutationObserver | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stateChangeListeners: Set<QueueStateChangeCallback> = new Set();
  private completionListeners: Set<QueueCompletionCallback> = new Set();
  private lastPositionLogged?: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly tabId?: number) {}

  /**
   * Current active queue session if any.
   */
  public getSession(): QueueSession | null {
    return this.activeSession;
  }

  /**
   * Returns the currently active queue session, or null if none.
   */
  public getActiveSession(): QueueSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  /**
   * Whether the manager is actively monitoring a live queue.
   */
  public isMonitoring(): boolean {
    return Boolean(
      this.activeSession &&
      ['QUEUE_DETECTED', 'QUEUE_WAITING', 'QUEUE_PROGRESSING', 'QUEUE_CAPTCHA_REQUIRED', 'QUEUE_ACTION_REQUIRED'].includes(
        this.activeSession.state,
      ),
    );
  }

  /**
   * Registers a listener for queue state transitions and progress.
   */
  public onStateChange(callback: QueueStateChangeCallback): () => void {
    this.stateChangeListeners.add(callback);
    return () => this.stateChangeListeners.delete(callback);
  }

  /**
   * Registers a listener for successful queue completion (ready for Booking Guardian).
   */
  public onQueueCompleted(callback: QueueCompletionCallback): () => void {
    this.completionListeners.add(callback);
    return () => this.completionListeners.delete(callback);
  }

  /**
   * Evaluates the current page state and starts passive monitoring if a queue is detected.
   */
  public evaluateAndStart(doc: Document = document, url: string = ''): QueueDetectionResult {
    const result = detectQueueState(doc, url);

    if (result.state === 'QUEUE_NOT_PRESENT') {
      if (this.activeSession && this.isMonitoring()) {
        // Queue was previously active and now disappeared -> Completion check
        this.handleQueueDisappeared(doc, url);
      }
      return result;
    }

    // Start or update existing session
    if (!this.activeSession) {
      this.activeSession = {
        sessionId: `qs-${generateId()}`,
        tabId: this.tabId,
        state: result.state,
        progress: result.progress,
        reasons: result.reasons,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: result.errorMessage,
      };

      this.notifyListeners('QUEUE_DETECTED');
      this.attachObserver(doc);
      this.startHeartbeat(doc);
    } else {
      this.updateSessionState(result);
    }

    return result;
  }

  /**
   * Records a detection result from an external scan (e.g. Booking Guardian page detector).
   */
  public recordDetection(result: QueueDetectionResult, tabId?: number): void {
    if (!result.isQueuePresent || result.state === 'QUEUE_NOT_PRESENT') {
      if (this.activeSession && this.activeSession.state !== 'QUEUE_NOT_PRESENT' && this.activeSession.state !== 'QUEUE_EXITED') {
        this.activeSession.state = 'QUEUE_COMPLETED';
        this.activeSession.updatedAt = new Date().toISOString();
        const completed = { ...this.activeSession };
        this.stopMonitoringInternal();
        this.notifyListeners('QUEUE_COMPLETED');
        for (const cb of this.completionListeners) {
          try {
            cb(completed);
          } catch (err) {
            logger.debug('[QueueManager] Completion callback error:', err);
          }
        }
        this.activeSession = null;
      }
      return;
    }

    if (!this.activeSession) {
      this.activeSession = {
        sessionId: `qs-${generateId()}`,
        tabId: tabId || this.tabId,
        state: result.state,
        progress: result.progress,
        reasons: result.reasons,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: result.errorMessage,
      };
      this.notifyListeners('QUEUE_DETECTED');
    } else {
      this.updateSessionState(result);
    }
  }

  /**
   * Updates current session state and triggers relevant notifications.
   */
  private updateSessionState(result: QueueDetectionResult): void {
    if (!this.activeSession) return;

    const prevState = this.activeSession.state;
    const prevPosition = this.activeSession.progress?.position;
    const newPosition = result.progress?.position;

    this.activeSession.state = result.state;
    this.activeSession.progress = result.progress;
    this.activeSession.reasons = result.reasons;
    this.activeSession.updatedAt = new Date().toISOString();
    this.activeSession.error = result.errorMessage;

    // Check for distinct notification events
    if (result.state === 'QUEUE_CAPTCHA_REQUIRED' && prevState !== 'QUEUE_CAPTCHA_REQUIRED') {
      this.notifyListeners('QUEUE_CAPTCHA_REQUIRED');
    } else if (result.state === 'QUEUE_SESSION_EXPIRED' && prevState !== 'QUEUE_SESSION_EXPIRED') {
      this.notifyListeners('QUEUE_SESSION_WARNING');
    } else if (result.state === 'QUEUE_ERROR' && prevState !== 'QUEUE_ERROR') {
      this.notifyListeners('QUEUE_ERROR');
    } else if (newPosition !== undefined && newPosition !== prevPosition) {
      // Significant progress update (e.g. position change)
      if (!this.lastPositionLogged || Math.abs(this.lastPositionLogged - newPosition) >= 5 || newPosition < 10) {
        this.lastPositionLogged = newPosition;
        this.notifyListeners('QUEUE_PROGRESS');
      } else {
        this.notifyListeners();
      }
    } else if (result.state !== prevState) {
      this.notifyListeners();
    }
  }

  /**
   * Called when queue elements disappear while previously waiting.
   */
  private handleQueueDisappeared(doc: Document, url: string): void {
    if (!this.activeSession) return;

    logger.info('[QueueManager] Queue DOM disappeared — transitioning to QUEUE_COMPLETED');
    this.activeSession.state = 'QUEUE_COMPLETED';
    this.activeSession.updatedAt = new Date().toISOString();

    const completedSession = { ...this.activeSession };
    this.stopMonitoringInternal();

    // Trigger completion callbacks
    for (const cb of this.completionListeners) {
      try {
        cb(completedSession);
      } catch (err) {
        logger.debug('[QueueManager] Completion listener error:', err);
      }
    }

    this.notifyListeners('QUEUE_COMPLETED');
  }

  /**
   * Attaches a passive MutationObserver to observe DOM changes without continuous full-page scans.
   */
  private attachObserver(doc: Document): void {
    if (this.observer) return;

    const targetNode = doc.body || doc.documentElement;
    if (!targetNode || typeof MutationObserver === 'undefined') return;

    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (this.activeSession && this.isMonitoring()) {
          const fresh = detectQueueState(doc);
          if (fresh.state === 'QUEUE_NOT_PRESENT') {
            this.handleQueueDisappeared(doc, '');
          } else {
            this.updateSessionState(fresh);
          }
        }
      }, 250);
    });

    try {
      this.observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch (e) {
      logger.debug('[QueueManager] Failed to attach MutationObserver:', e);
    }
  }

  /**
   * Conservative bounded heartbeat (every 6 seconds) as fallback in case MutationObserver misses dynamic text mutations.
   * NEVER makes network requests or aggressive reloads.
   */
  private startHeartbeat(doc: Document): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.activeSession && this.isMonitoring()) {
        const fresh = detectQueueState(doc);
        if (fresh.state === 'QUEUE_NOT_PRESENT') {
          this.handleQueueDisappeared(doc, '');
        } else {
          this.updateSessionState(fresh);
        }
      }
    }, 6000);
  }

  /**
   * Emits state change to all registered listeners.
   */
  private notifyListeners(event?: QueueNotificationEvent): void {
    if (!this.activeSession) return;
    const snapshot = { ...this.activeSession };
    for (const cb of this.stateChangeListeners) {
      try {
        cb(snapshot, event);
      } catch (err) {
        logger.debug('[QueueManager] State change listener error:', err);
      }
    }
  }

  /**
   * Stops DOM observers and background timers without mutating session state.
   */
  private stopMonitoringInternal(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * User-initiated stop monitoring CTA.
   */
  public stopMonitoring(): void {
    if (this.activeSession) {
      this.activeSession.state = 'QUEUE_EXITED';
      this.activeSession.updatedAt = new Date().toISOString();
      this.notifyListeners('QUEUE_INTERRUPTED');
    }
    this.stopMonitoringInternal();
    this.activeSession = null;
    logger.info('[QueueManager] Queue monitoring stopped by user.');
  }

  /**
   * Emergency Stop: Immediately ceases all observation and marks state as BLOCKED/INTERRUPTED.
   * Never closes tabs or forces page reload.
   */
  public emergencyStop(): void {
    if (this.activeSession) {
      this.activeSession.state = 'QUEUE_INTERRUPTED';
      this.activeSession.updatedAt = new Date().toISOString();
      this.notifyListeners('QUEUE_INTERRUPTED');
    }
    this.stopMonitoringInternal();
    this.activeSession = null;
    logger.warn('[QueueManager] Emergency stop invoked. Observers disconnected.');
  }
}

/** Global singleton instance */
export const queueManager = new QueueManager();
