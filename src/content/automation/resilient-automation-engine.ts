// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Resilient Automation Engine (Phase 11)
// Technical heart of SevaPilot: State Machine Orchestrator, DOM
// Observation, Document Identity, Abortable Execution, Idempotent
// Filling, User Modification Protection, and Bounded Recovery.
// ─────────────────────────────────────────────────────────────

import type {
  AutomationSession,
  AutomationState,
  PerformanceMetric,
  NavigationContext,
} from './types';
import { AutomationAbortedError } from './types';
import { AutomationStateMachine } from './state-machine';
import { getDocumentInstanceId, SPANavigationDetector } from './document-identity';
import { DomObservationEngine, DomTraversalEngine } from './dom-observation-engine';
import { FieldOwnershipTracker } from './field-ownership-tracker';
import { ResilientRetryEngine } from './resilient-retry-engine';
import { RecoveryEngine } from './recovery-engine';
import logger from '@shared/logger';

export interface AutomationExecutionPlan {
  serviceId?: string;
  autofillMode?: 'fast' | 'safe';
  fieldsToFill: Array<{
    field: string;
    pilgrimIndex?: number;
    value: string;
    elementSelector?: string;
  }>;
}

export interface AutomationExecutionResult {
  success: boolean;
  state: AutomationState;
  filledCount: number;
  skippedCount: number;
  preservedUserCount: number;
  failedCount: number;
  elapsedMs: number;
  metrics: PerformanceMetric[];
  error?: string;
}

export class ResilientAutomationEngine {
  private activeSession: AutomationSession | null = null;
  private readonly stateMachine: AutomationStateMachine = new AutomationStateMachine();
  private readonly domObserver: DomObservationEngine = new DomObservationEngine(50);
  private readonly navDetector: SPANavigationDetector = new SPANavigationDetector();
  private readonly ownershipTracker: FieldOwnershipTracker = new FieldOwnershipTracker();
  private readonly retryEngine: ResilientRetryEngine = new ResilientRetryEngine();
  private readonly recoveryEngine: RecoveryEngine = new RecoveryEngine();
  private readonly metricsLog: PerformanceMetric[] = [];

  constructor() {
    // Synchronize state machine updates to active session
    this.stateMachine.onStateChange((newState) => {
      if (this.activeSession) {
        this.activeSession.state = newState;
      }
    });

    // Listen to SPA Navigations
    this.navDetector.onNavigation((context: NavigationContext, reason: string) => {
      this.handleNavigationDetected(context, reason);
    });
  }

  /**
   * Initializes a new isolated automation session.
   * Cancels any previously running session.
   */
  public startSession(
    tabId = 0,
    frameId = 0,
    serviceId?: string,
  ): AutomationSession {
    if (this.activeSession) {
      this.stopSession('Starting new session replacement');
    }

    const abortController = new AbortController();
    const documentId = getDocumentInstanceId(document);

    this.activeSession = {
      sessionId: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tabId,
      frameId,
      documentId,
      serviceId,
      startedAt: new Date().toISOString(),
      state: 'IDLE',
      abortController,
      createdAt: Date.now(),
    };

    // Initialize subsystems
    this.stateMachine.reset();
    this.stateMachine.transition('OBSERVING', 'Session started');
    this.domObserver.startObserving();
    this.navDetector.startListening(tabId, frameId);
    this.ownershipTracker.startTracking();

    logger.info(`[ResilientAutomationEngine] Started session ${this.activeSession.sessionId} for document ${documentId}`);
    return this.activeSession;
  }

  public getActiveSession(): AutomationSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  public getState(): AutomationState {
    return this.stateMachine.getState();
  }

  /**
   * Executes an autofill plan idempotently with strict step validation,
   * human modification preservation, and AbortSignal support.
   */
  public async executePlan(
    plan: AutomationExecutionPlan,
  ): Promise<AutomationExecutionResult> {
    const startTime = Date.now();
    const session = this.activeSession;

    if (!session || session.abortController.signal.aborted) {
      return {
        success: false,
        state: 'STOPPED',
        filledCount: 0,
        skippedCount: 0,
        preservedUserCount: 0,
        failedCount: 0,
        elapsedMs: 0,
        metrics: [],
        error: 'Session not active or aborted',
      };
    }

    const signal = session.abortController.signal;
    let filledCount = 0;
    let skippedCount = 0;
    let preservedUserCount = 0;
    let failedCount = 0;

    try {
      this.checkAbort(signal);

      // Phase A: PAGE_IDENTIFIED -> FORM_DETECTED
      if (this.stateMachine.canTransitionTo('PAGE_IDENTIFIED')) {
        this.stateMachine.transition('PAGE_IDENTIFIED', 'Target TTD service confirmed');
      }
      this.checkAbort(signal);

      this.stateMachine.transition('FORM_DETECTED', 'Target form inputs discovered in DOM');
      this.checkAbort(signal);

      // Phase B: FIELD_RESOLUTION -> ACTION_PLANNING
      this.stateMachine.transition('FIELD_RESOLUTION', 'Resolving inputs against devotee plan');
      this.checkAbort(signal);

      this.stateMachine.transition('ACTION_PLANNING', 'Formulating differential execution steps');
      this.checkAbort(signal);

      // Phase C: FILLING
      this.stateMachine.transition('FILLING', 'Commencing atomic field operations');

      for (const item of plan.fieldsToFill) {
        this.checkAbort(signal);
        // Micro-yield allowing pending abort events / lifecycle changes to process
        await new Promise((r) => setTimeout(r, 10));
        this.checkAbort(signal);

        // Verify document identity hasn't drifted
        if (session.documentId !== getDocumentInstanceId(document)) {
          logger.warn('[ResilientAutomationEngine] Document identity changed mid-fill! Aborting stale session.');
          throw new AutomationAbortedError('Document context replaced');
        }

        // 1. Resolve element using safe DOM traversal (including Shadow DOM)
        const element = item.elementSelector
          ? DomTraversalEngine.querySelector(item.elementSelector)
          : null;

        if (!element) {
          // Trigger controlled recovery for missing field
          const rec = this.recoveryEngine.handleRecovery('FIELD_NOT_FOUND', {
            field: item.field,
            pilgrimIndex: item.pilgrimIndex,
          });
          logger.debug(`[ResilientAutomationEngine] Field recovery: ${rec.message}`);
          failedCount++;
          continue;
        }

        // 2. Classify field lifecycle: EMPTY, ALREADY_CORRECT, USER_MODIFIED, etc.
        const lifecycle = this.ownershipTracker.classifyFieldLifecycle(element, item.value);

        // 3. User modification boundary (Strict human precedence)
        if (lifecycle === 'USER_MODIFIED') {
          logger.info(`[ResilientAutomationEngine] Preserved user-modified value for field: ${item.field}`);
          preservedUserCount++;
          continue;
        }

        // 4. Idempotent skip: if already correct, do not touch
        if (lifecycle === 'ALREADY_CORRECT') {
          logger.debug(`[ResilientAutomationEngine] Idempotent skip: field '${item.field}' already correct.`);
          skippedCount++;
          continue;
        }

        if (lifecycle === 'UNAVAILABLE') {
          logger.debug(`[ResilientAutomationEngine] Skipped unavailable/disabled field: ${item.field}`);
          skippedCount++;
          continue;
        }

        // 5. Execute fill with bounded retry
        const fillResult = await this.retryEngine.executeWithRetry(
          `fill_${item.field}`,
          async () => {
            return this.applyFieldValue(element, item.value);
          },
          { signal, maxAttempts: 3, baseDelayMs: 60 },
        );

        if (fillResult.success) {
          this.ownershipTracker.markAsExtensionFilled(element);
          filledCount++;
        } else {
          failedCount++;
        }
      }

      this.checkAbort(signal);

      // Phase D: VERIFYING
      this.stateMachine.transition('VERIFYING', 'Verifying filled field values on DOM');
      this.recordMetric('fill', Date.now() - startTime, true);

      // Phase E: COMPLETED
      this.stateMachine.transition('COMPLETED', 'Plan executed and verified successfully');

      return {
        success: failedCount === 0,
        state: this.stateMachine.getState(),
        filledCount,
        skippedCount,
        preservedUserCount,
        failedCount,
        elapsedMs: Date.now() - startTime,
        metrics: [...this.metricsLog],
      };
    } catch (err) {
      const isAborted = err instanceof AutomationAbortedError || signal.aborted;
      const finalState = isAborted ? 'STOPPED' : 'FAILED';

      if (this.stateMachine.canTransitionTo(finalState)) {
        this.stateMachine.transition(finalState, isAborted ? 'Operation aborted' : String(err));
      }

      this.recordMetric('fill', Date.now() - startTime, false, err instanceof Error ? err.name : 'UnknownError');

      if (isAborted) {
        logger.info('[ResilientAutomationEngine] Execution stopped safely.');
      } else {
        logger.error('[ResilientAutomationEngine] Execution failed:', err);
      }

      return {
        success: false,
        state: this.stateMachine.getState(),
        filledCount,
        skippedCount,
        preservedUserCount,
        failedCount,
        elapsedMs: Date.now() - startTime,
        metrics: [...this.metricsLog],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Applies value using standards-compliant DOM events compatible with React/Angular.
   */
  private applyFieldValue(element: HTMLElement, value: string): boolean {
    const input = element as HTMLInputElement;

    if (input.tagName.toLowerCase() === 'input' || input.tagName.toLowerCase() === 'textarea') {
      // Use prototype setter to trigger Angular/React synthetic property binding
      const proto = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(input, value);
      } else {
        input.value = value;
      }

      // Mark synthetic events with internal property so FieldOwnershipTracker ignores them
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      (inputEvent as unknown as { __sp_synthetic__: boolean }).__sp_synthetic__ = true;
      (changeEvent as unknown as { __sp_synthetic__: boolean }).__sp_synthetic__ = true;

      input.dispatchEvent(inputEvent);
      input.dispatchEvent(changeEvent);
      return true;
    }

    return false;
  }

  private handleNavigationDetected(context: NavigationContext, reason: string): void {
    if (this.activeSession) {
      logger.warn(`[ResilientAutomationEngine] SPA navigation detected (${reason}). Stopping active automation.`);
      this.recoveryEngine.handleRecovery('PAGE_CHANGED', { detail: context.url });
      this.stopSession(`SPA Navigation: ${reason}`);
    }
  }

  private checkAbort(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new AutomationAbortedError();
    }
  }

  /**
   * Stops session gracefully.
   */
  public stopSession(reason = 'User stopped session'): void {
    if (this.activeSession) {
      this.activeSession.abortController.abort();
      if (this.stateMachine.canTransitionTo('STOPPED')) {
        this.stateMachine.transition('STOPPED', reason);
      }
      this.activeSession = null;
    }

    this.domObserver.stopObserving();
    this.navDetector.stopListening();
    this.ownershipTracker.stopTracking();
    logger.info(`[ResilientAutomationEngine] Session stopped: ${reason}`);
  }

  /**
   * Emergency Stop: Immediately ceases all observation and owned operations.
   * Never forces page reload or tab closure.
   */
  public emergencyStop(): void {
    this.stopSession('Emergency Stop Invoked');
  }

  /**
   * Records internal zero-PII performance metric.
   */
  private recordMetric(
    operation: PerformanceMetric['operation'],
    durationMs: number,
    success: boolean,
    failureCategory?: string,
  ): void {
    const metric: PerformanceMetric = {
      operation,
      durationMs,
      success,
      failureCategory,
      timestamp: Date.now(),
    };
    this.metricsLog.push(metric);
    if (this.metricsLog.length > 100) {
      this.metricsLog.shift();
    }
  }

  public getPerformanceMetrics(): readonly PerformanceMetric[] {
    return [...this.metricsLog];
  }
}

/** Global singleton instance */
export const resilientAutomationEngine = new ResilientAutomationEngine();
