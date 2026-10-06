// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — DOM Lifecycle Engine (Phase 6)
// Scoped, debounced, event-driven DOM change detection for
// Angular rerenders, dynamic steps, and form state transitions.
// Zero continuous scanning — high performance & zero memory leaks.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

export type DomLifecycleEventType =
  | 'DOM_REPLACED'
  | 'DOM_RERENDERED'
  | 'FORM_APPEARED'
  | 'FORM_CHANGED'
  | 'STEP_CHANGED'
  | 'FIELD_APPEARED'
  | 'FIELD_REMOVED'
  | 'FIELD_DISABLED'
  | 'FIELD_ENABLED';

export interface DomLifecycleEvent {
  type: DomLifecycleEventType;
  timestamp: number;
  target?: HTMLElement;
  details?: Record<string, unknown>;
}

export type DomLifecycleListener = (event: DomLifecycleEvent) => void;

export interface DomLifecycleOptions {
  debounceMs?: number;
  scopeElement?: HTMLElement | null;
  trackFormsOnly?: boolean;
}

export class DomLifecycleEngine {
  private observer: MutationObserver | null = null;
  private listeners: Set<DomLifecycleListener> = new Set();
  private debounceTimer: any = null;
  private lastUrl: string = '';
  private lastStepFingerprint: string = '';
  private isObserving: boolean = false;
  private pendingEvents: DomLifecycleEvent[] = [];
  private debounceMs: number = 50;

  constructor(options: DomLifecycleOptions = {}) {
    this.debounceMs = options.debounceMs ?? 50;
    if (typeof window !== 'undefined') {
      this.lastUrl = window.location.href;
    }
  }

  /**
   * Start observing the DOM with a scoped observer.
   */
  public start(root: HTMLElement | Document = document): void {
    if (this.isObserving) return;
    if (typeof MutationObserver === 'undefined') return;

    const target = (root instanceof Document ? root.body : root) || document.body;
    if (!target) return;

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'readonly', 'class', 'hidden', 'aria-selected'],
    });

    this.isObserving = true;
    logger.debug('[DomLifecycle] Started scoped MutationObserver');
  }

  /**
   * Stop observing and clean up all resources.
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isObserving = false;
    this.pendingEvents = [];
    logger.debug('[DomLifecycle] Stopped MutationObserver');
  }

  /**
   * Subscribe to DOM lifecycle events.
   */
  public subscribe(listener: DomLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event immediately to all subscribers.
   */
  public emit(type: DomLifecycleEventType, target?: HTMLElement, details?: Record<string, unknown>): void {
    const event: DomLifecycleEvent = {
      type,
      timestamp: Date.now(),
      target,
      details,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('[DomLifecycle] Error in event listener:', err);
      }
    }
  }

  /**
   * Batched mutation processor with subtree filtering.
   */
  private handleMutations(mutations: MutationRecord[]): void {
    let hasFormAddition = false;
    let hasFormRemoval = false;
    let hasFieldAddition = false;
    let hasFieldRemoval = false;
    let hasFieldDisabled = false;
    let hasFieldEnabled = false;
    let hasFieldStatusChange = false;
    let hasRerender = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Inspect added nodes
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName?.toLowerCase();

            if (tag === 'form' || el.querySelector('form, table, .pilgrim-row, mat-form-field')) {
              hasFormAddition = true;
            }
            if (['input', 'select', 'textarea', 'mat-select'].includes(tag) || el.querySelector('input, select, textarea, mat-select')) {
              hasFieldAddition = true;
            }
          }
        }

        // Inspect removed nodes
        for (let i = 0; i < mutation.removedNodes.length; i++) {
          const node = mutation.removedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'form' || el.querySelector('form, table, .pilgrim-row')) {
              hasFormRemoval = true;
            }
            if (['input', 'select', 'textarea', 'mat-select'].includes(tag) || el.querySelector('input, select, textarea, mat-select')) {
              hasFieldRemoval = true;
            }
          }
        }
      } else if (mutation.type === 'attributes') {
        const attr = mutation.attributeName;
        const targetEl = mutation.target as HTMLElement;
        if (attr === 'disabled') {
          hasFieldStatusChange = true;
          if (targetEl.hasAttribute('disabled') || (targetEl as HTMLInputElement).disabled) {
            hasFieldDisabled = true;
          } else {
            hasFieldEnabled = true;
          }
        } else if (attr === 'readonly') {
          hasFieldStatusChange = true;
        }
      }
    }

    if ((hasFormAddition && hasFormRemoval) || (hasFieldAddition && hasFieldRemoval)) {
      hasRerender = true;
    }

    // Schedule debounced notifications
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (hasRerender) {
        this.emit('DOM_RERENDERED');
        this.emit('DOM_REPLACED');
      }
      if (hasFormAddition) {
        this.emit('FORM_APPEARED');
      }
      if (hasFieldAddition) {
        this.emit('FIELD_APPEARED');
      }
      if (hasFieldRemoval) {
        this.emit('FIELD_REMOVED');
      }
      if (hasFieldDisabled) {
        this.emit('FIELD_DISABLED');
      }
      if (hasFieldEnabled) {
        this.emit('FIELD_ENABLED');
      }
      if (hasFormAddition || hasFormRemoval || hasFieldAddition || hasFieldRemoval || hasFieldStatusChange) {
        this.emit('FORM_CHANGED');
      }

      // Check step changes via active headers or stepper
      this.checkStepChange();
    }, this.debounceMs);
  }

  /**
   * Detects SPA step changes (e.g. Angular Material steppers or URL changes).
   */
  private checkStepChange(): void {
    if (typeof window !== 'undefined' && window.location.href !== this.lastUrl) {
      this.lastUrl = window.location.href;
      this.emit('STEP_CHANGED', undefined, { reason: 'URL_CHANGED', url: this.lastUrl });
      return;
    }

    if (typeof document !== 'undefined') {
      const activeStepEl = document.querySelector('.mat-step-header[aria-selected="true"], .active-step, [aria-current="step"]');
      const stepFingerprint = activeStepEl ? (activeStepEl.textContent || '').trim() : '';
      if (stepFingerprint && stepFingerprint !== this.lastStepFingerprint) {
        this.lastStepFingerprint = stepFingerprint;
        this.emit('STEP_CHANGED', activeStepEl as HTMLElement, { step: stepFingerprint });
      }
    }
  }
}

export const domLifecycle = new DomLifecycleEngine();
