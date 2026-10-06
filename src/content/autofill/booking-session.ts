// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Session State & Concurrency Lock (Phase 6)
// Enforces single-session-per-tab, supports AbortController cancellation,
// and emits zero-PII diagnostic events.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

export type SessionStatus =
  | 'IDLE'
  | 'READY'
  | 'FILLING'
  | 'VERIFYING'
  | 'PARTIAL_SUCCESS'
  | 'COMPLETE'
  | 'ERROR'
  | 'STOPPED';

export interface BookingSessionState {
  sessionId: string;
  serviceId?: string;
  workflowId?: string;
  currentStep: string;
  selectedPilgrims: string[];
  status: SessionStatus;
  completedFields: string[];
  failedFields: string[];
  userModifiedFields: string[];
  startedAt: number;
  updatedAt: number;
}

export type SessionDiagnosticEventType =
  | 'FIELD_RESOLVED'
  | 'FIELD_FILLED'
  | 'FIELD_VERIFIED'
  | 'FIELD_FAILED'
  | 'DOM_RERENDER'
  | 'STEP_CHANGED'
  | 'SERVICE_DETECTED'
  | 'VALIDATION_ERROR'
  | 'AUTOFILL_CANCELLED'
  | 'USER_MODIFIED_FIELD';

export interface SessionDiagnosticEvent {
  type: SessionDiagnosticEventType;
  timestamp: number;
  sessionId: string;
  field?: string;
  pilgrimIndex?: number;
  step?: string;
  strategy?: string;
  confidence?: number;
  attempts?: number;
  durationMs?: number;
  message?: string;
}

class BookingSessionManager {
  private activeState: BookingSessionState | null = null;
  private abortController: AbortController | null = null;
  private userValueStore: Map<string, string> = new Map(); // Fingerprint -> user entered value

  /**
   * Checks whether an autofill session is currently active.
   */
  public isRunning(): boolean {
    return Boolean(this.activeState && ['FILLING', 'VERIFYING'].includes(this.activeState.status));
  }

  public isSessionActive(): boolean {
    return this.isRunning();
  }

  /**
   * Starts a new autofill session. Enforces concurrency protection.
   */
  public startSession(
    paramsOrProfileId?: string | { serviceId?: string; workflowId?: string; currentStep?: string; selectedPilgrims?: string[] },
    serviceId?: string,
    workflowId?: string,
  ): boolean {
    if (this.isRunning()) {
      return false;
    }

    const params = typeof paramsOrProfileId === 'object' && paramsOrProfileId !== null
      ? paramsOrProfileId
      : { serviceId, workflowId };

    this.abortController = new AbortController();

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.activeState = {
      sessionId,
      serviceId: params.serviceId,
      workflowId: params.workflowId,
      currentStep: params.currentStep || 'UNKNOWN',
      selectedPilgrims: params.selectedPilgrims || [],
      status: 'FILLING',
      completedFields: [],
      failedFields: [],
      userModifiedFields: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    logger.info(`[BookingSession] Started session ${sessionId}`);
    return true;
  }

  /**
   * Ends the current session cleanly.
   */
  public endSession(): void {
    if (this.activeState && ['FILLING', 'VERIFYING'].includes(this.activeState.status)) {
      this.activeState.status = 'COMPLETE';
      this.activeState.updatedAt = Date.now();
    }
    this.abortController = null;
  }

  /**
   * Retrieves the cancellation signal for the active session.
   */
  public getSignal(): AbortSignal | null {
    return this.abortController?.signal || null;
  }

  public getAbortSignal(): AbortSignal | null {
    return this.getSignal();
  }


  /**
   * Checks if cancellation has been requested.
   */
  public isCancelled(): boolean {
    return Boolean(this.abortController?.signal.aborted);
  }

  /**
   * Cancels the currently running session.
   */
  public cancelSession(reason: string = 'User requested stop'): void {
    if (this.abortController) {
      this.abortController.abort(reason);
      this.abortController = null;
    }
    if (this.activeState) {
      this.activeState.status = 'STOPPED';
      this.activeState.updatedAt = Date.now();
      this.emitDiagnostic({
        type: 'AUTOFILL_CANCELLED',
        sessionId: this.activeState.sessionId,
        message: reason,
      });
    }
    logger.info(`[BookingSession] Cancelled session: ${reason}`);
  }

  /**
   * Updates current session state.
   */
  public updateStatus(status: SessionStatus): void {
    if (this.activeState) {
      this.activeState.status = status;
      this.activeState.updatedAt = Date.now();
    }
  }

  public recordCompletedField(fieldKey: string, pilgrimIndex?: number): void {
    if (!this.activeState) return;
    const tag = pilgrimIndex !== undefined ? `${fieldKey}#${pilgrimIndex}` : fieldKey;
    if (!this.activeState.completedFields.includes(tag)) {
      this.activeState.completedFields.push(tag);
    }
    this.emitDiagnostic({
      type: 'FIELD_VERIFIED',
      sessionId: this.activeState.sessionId,
      field: fieldKey,
      pilgrimIndex,
    });
  }

  public recordFailedField(fieldKey: string, pilgrimIndex?: number, errorMsg?: string): void {
    if (!this.activeState) return;
    const tag = pilgrimIndex !== undefined ? `${fieldKey}#${pilgrimIndex}` : fieldKey;
    if (!this.activeState.failedFields.includes(tag)) {
      this.activeState.failedFields.push(tag);
    }
    this.emitDiagnostic({
      type: 'FIELD_FAILED',
      sessionId: this.activeState.sessionId,
      field: fieldKey,
      pilgrimIndex,
      message: errorMsg,
    });
  }

  /**
   * Tracks user modified fields to prevent overwriting user input.
   */
  public recordUserModifiedField(fieldKey: string, pilgrimIndexOrVal?: number | string, value?: string): void {
    const tag = typeof pilgrimIndexOrVal === 'number' ? `${fieldKey}#${pilgrimIndexOrVal}` : fieldKey;
    const val = value ?? (typeof pilgrimIndexOrVal === 'string' ? pilgrimIndexOrVal : 'USER_ENTERED');
    this.userValueStore.set(tag, val);
    this.userValueStore.set(fieldKey, val);
    if (this.activeState) {
      if (!this.activeState.userModifiedFields.includes(tag)) {
        this.activeState.userModifiedFields.push(tag);
      }
      this.emitDiagnostic({
        type: 'USER_MODIFIED_FIELD',
        sessionId: this.activeState.sessionId,
        field: fieldKey,
        pilgrimIndex: typeof pilgrimIndexOrVal === 'number' ? pilgrimIndexOrVal : undefined,
      });
    }
  }

  public isUserModified(fieldKey: string, pilgrimIndex?: number): boolean {
    const tag = pilgrimIndex !== undefined ? `${fieldKey}#${pilgrimIndex}` : fieldKey;
    return this.userValueStore.has(tag) || this.userValueStore.has(fieldKey);
  }

  public hasUserModified(fieldKey: string, pilgrimIndex?: number): boolean {
    return this.isUserModified(fieldKey, pilgrimIndex);
  }

  public getUserModifiedValue(fieldKey: string): string | undefined {
    return this.userValueStore.get(fieldKey);
  }


  public getState(): BookingSessionState | null {
    return this.activeState ? { ...this.activeState } : null;
  }

  public reset(): void {
    this.cancelSession('Reset');
    this.activeState = null;
    this.userValueStore.clear();
  }

  /**
   * Emits zero-PII diagnostic event.
   */
  public emitDiagnostic(
    eventOrType: SessionDiagnosticEventType | Omit<SessionDiagnosticEvent, 'timestamp'>,
    data?: Partial<SessionDiagnosticEvent>,
  ): void {
    const diagnostic: SessionDiagnosticEvent = typeof eventOrType === 'string'
      ? { type: eventOrType, sessionId: this.activeState?.sessionId || 'unknown', timestamp: Date.now(), ...data }
      : { ...eventOrType, timestamp: Date.now() };

    logger.debug(`[Diagnostic] ${diagnostic.type}`, {
      field: diagnostic.field,
      pilgrimIndex: diagnostic.pilgrimIndex,
      message: diagnostic.message,
    });
  }
}

export { BookingSessionManager };
export const bookingSession = new BookingSessionManager();
export const bookingSessionManager = bookingSession;

