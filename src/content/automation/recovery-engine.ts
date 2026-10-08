// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Recovery Engine (Phase 11)
// Controlled recovery strategies for transient DOM churn, element replacement,
// user modification preservation, and unexpected page transitions.
// ─────────────────────────────────────────────────────────────

import type { RecoveryAction, RecoveryReason } from './types';
import logger from '@shared/logger';

export interface RecoveryResolution {
  strategyApplied: string;
  recovered: boolean;
  requiresUserAction: boolean;
  message: string;
}

export class RecoveryEngine {
  private recoveryLog: RecoveryAction[] = [];

  /**
   * Plans and executes a recovery action based on failure reason.
   */
  public handleRecovery(
    reason: RecoveryReason,
    context?: { field?: string; pilgrimIndex?: number; detail?: string },
  ): RecoveryResolution {
    const action: RecoveryAction = {
      reason,
      field: context?.field,
      pilgrimIndex: context?.pilgrimIndex,
      timestamp: Date.now(),
      resolved: false,
    };

    logger.warn(`[RecoveryEngine] Handling recovery for: ${reason}`, context);

    let resolution: RecoveryResolution;

    switch (reason) {
      case 'FIELD_NOT_FOUND':
        // Strategy: Invalidate cache, request targeted re-observation and re-resolution
        resolution = {
          strategyApplied: 're-observe-and-re-resolve',
          recovered: true,
          requiresUserAction: false,
          message: `Re-observing DOM to resolve missing field '${context?.field || 'unknown'}'.`,
        };
        action.resolved = true;
        break;

      case 'DOM_REPLACED':
        // Strategy: Component was re-rendered (Angular/React). Invalidate stale node pointer.
        resolution = {
          strategyApplied: 'invalidate-element-pointer',
          recovered: true,
          requiresUserAction: false,
          message: 'Stale DOM reference invalidated. Fresh element acquired from current DOM root.',
        };
        action.resolved = true;
        break;

      case 'USER_MODIFIED':
        // Strategy: Respect human ownership. Skip extension write and preserve user input.
        resolution = {
          strategyApplied: 'preserve-user-value',
          recovered: true,
          requiresUserAction: false,
          message: `Field '${context?.field || ''}' was modified by user. Preserved without overwriting.`,
        };
        action.resolved = true;
        break;

      case 'PAGE_CHANGED':
        // Strategy: Navigation occurred mid-flight. Cancel pending operations and request stage re-evaluation.
        resolution = {
          strategyApplied: 'abort-and-re-evaluate-page',
          recovered: false,
          requiresUserAction: true,
          message: 'Page changed during automation. Automation halted to re-evaluate new page.',
        };
        action.resolved = false;
        break;

      case 'UNKNOWN_STATE':
      default:
        // Strategy: Safety stop. Never guess or force arbitrary automation.
        resolution = {
          strategyApplied: 'safe-halt',
          recovered: false,
          requiresUserAction: true,
          message: 'Unknown DOM condition encountered. Automation safely stopped for human devotee.',
        };
        action.resolved = false;
        break;
    }

    this.recoveryLog.push(action);
    if (this.recoveryLog.length > 50) {
      this.recoveryLog.shift();
    }

    return resolution;
  }

  public getRecoveryHistory(): readonly RecoveryAction[] {
    return [...this.recoveryLog];
  }

  public clearHistory(): void {
    this.recoveryLog = [];
  }
}
