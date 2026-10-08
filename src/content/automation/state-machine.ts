// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Automation State Machine (Phase 11)
// Strongly typed, transition-validated finite state machine.
// Enforces: OBSERVING -> FORM_DETECTED -> FIELD_RESOLUTION -> FILLING -> VERIFYING.
// ─────────────────────────────────────────────────────────────

import type { AutomationState } from './types';
import { VALID_AUTOMATION_TRANSITIONS } from './types';
import logger from '@shared/logger';

export interface StateTransitionRecord {
  from: AutomationState;
  to: AutomationState;
  reason?: string;
  timestamp: number;
}

export type StateChangeListener = (
  currentState: AutomationState,
  previousState: AutomationState,
  reason?: string,
) => void;

export class AutomationStateMachine {
  private currentState: AutomationState = 'IDLE';
  private transitionHistory: StateTransitionRecord[] = [];
  private readonly maxHistoryLength = 50;
  private readonly listeners: Set<StateChangeListener> = new Set();

  constructor(initialState: AutomationState = 'IDLE') {
    this.currentState = initialState;
  }

  /**
   * Returns current active state.
   */
  public getState(): AutomationState {
    return this.currentState;
  }

  /**
   * Attempts transition to target state with validation.
   * Throws Error if transition is invalid and strictly prevents state corruption.
   */
  public transition(nextState: AutomationState, reason?: string): boolean {
    if (this.currentState === nextState) {
      return true; // No-op idempotent transition
    }

    const allowedNextStates = VALID_AUTOMATION_TRANSITIONS[this.currentState] || [];
    if (!allowedNextStates.includes(nextState)) {
      const err = `[AutomationStateMachine] Invalid transition from '${this.currentState}' to '${nextState}' (Reason: ${reason || 'unspecified'})`;
      logger.error(err);
      throw new Error(err);
    }

    const prevState = this.currentState;
    this.currentState = nextState;

    const record: StateTransitionRecord = {
      from: prevState,
      to: nextState,
      reason,
      timestamp: Date.now(),
    };

    this.transitionHistory.push(record);
    if (this.transitionHistory.length > this.maxHistoryLength) {
      this.transitionHistory.shift();
    }

    logger.debug(`[AutomationStateMachine] State transition: ${prevState} -> ${nextState}`, { reason });

    // Notify registered listeners
    for (const listener of this.listeners) {
      try {
        listener(nextState, prevState, reason);
      } catch (e) {
        logger.error('[AutomationStateMachine] Listener error:', e);
      }
    }

    return true;
  }

  /**
   * Safely checks whether a transition to nextState would be valid without executing it.
   */
  public canTransitionTo(nextState: AutomationState): boolean {
    if (this.currentState === nextState) return true;
    const allowed = VALID_AUTOMATION_TRANSITIONS[this.currentState] || [];
    return allowed.includes(nextState);
  }

  /**
   * Registers a callback listener for state changes.
   */
  public onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Returns copy of transition history.
   */
  public getHistory(): readonly StateTransitionRecord[] {
    return [...this.transitionHistory];
  }

  /**
   * Resets the state machine back to IDLE.
   */
  public reset(): void {
    const prevState = this.currentState;
    this.currentState = 'IDLE';
    this.transitionHistory = [];
    logger.debug(`[AutomationStateMachine] Reset from ${prevState} to IDLE`);
  }
}
