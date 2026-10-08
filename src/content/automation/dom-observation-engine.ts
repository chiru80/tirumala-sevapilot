// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — DOM Observation Engine & Safe Traversal (Phase 11)
// Centralized, micro-batched, debounced MutationObserver with
// safe Shadow DOM traversal and targeted region invalidation.
// ─────────────────────────────────────────────────────────────

import type { DomMutationBatch } from './types';
import logger from '@shared/logger';

export type DomBatchListener = (batch: DomMutationBatch) => void;

/**
 * Safe Shadow DOM traversal abstraction.
 * Deeply searches normal DOM and accessible open shadow roots without breaking browser isolation.
 */
export class DomTraversalEngine {
  /**
   * Deep query selector finding the first element matching selector,
   * traversing open shadow roots safely.
   */
  public static querySelector<E extends HTMLElement = HTMLElement>(
    selector: string,
    root: ParentNode = document,
  ): E | null {
    try {
      const match = root.querySelector<E>(selector);
      if (match) return match;

      // Search inside accessible open shadow roots
      const allElements = root.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el && el.shadowRoot) {
          const shadowMatch = this.querySelector<E>(selector, el.shadowRoot);
          if (shadowMatch) return shadowMatch;
        }
      }
    } catch (e) {
      logger.debug('[DomTraversalEngine] QuerySelector error:', e);
    }
    return null;
  }

  /**
   * Deep query selector finding all matching elements, including inside open shadow roots.
   */
  public static querySelectorAll<E extends HTMLElement = HTMLElement>(
    selector: string,
    root: ParentNode = document,
  ): E[] {
    const results: E[] = [];
    try {
      const directMatches = Array.from(root.querySelectorAll<E>(selector));
      results.push(...directMatches);

      const allElements = root.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el && el.shadowRoot) {
          const shadowMatches = this.querySelectorAll<E>(selector, el.shadowRoot);
          results.push(...shadowMatches);
        }
      }
    } catch (e) {
      logger.debug('[DomTraversalEngine] QuerySelectorAll error:', e);
    }
    return results;
  }
}

/**
 * DomObservationEngine
 * Observes targeted DOM mutations with debouncing and micro-batching.
 * Never executes unbounded or duplicate whole-page scans.
 */
export class DomObservationEngine {
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceDelayMs: number;
  private pendingBatch: DomMutationBatch;
  private readonly listeners: Set<DomBatchListener> = new Set();
  private isObserving = false;

  constructor(debounceDelayMs = 60) {
    this.debounceDelayMs = debounceDelayMs;
    this.pendingBatch = this.createEmptyBatch();
  }

  private createEmptyBatch(): DomMutationBatch {
    return {
      addedNodesCount: 0,
      removedNodesCount: 0,
      attributeChanges: [],
      affectedSelectors: [],
      hasFormChanges: false,
      hasDisabledChanges: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Starts observation on the specified root element (default document.body).
   */
  public startObserving(root: Node = document.body || document.documentElement): void {
    if (this.isObserving || typeof window === 'undefined' || !root) return;
    this.isObserving = true;

    try {
      this.observer = new MutationObserver((mutations) => {
        this.processMutations(mutations);
      });

      this.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'readonly', 'aria-disabled', 'class', 'style', 'hidden', 'formcontrolname'],
      });

      logger.debug('[DomObservationEngine] Observer attached to DOM.');
    } catch (e) {
      logger.error('[DomObservationEngine] Failed to start MutationObserver:', e);
    }
  }

  /**
   * Processes raw mutation records and aggregates into pending micro-batch.
   */
  private processMutations(mutations: MutationRecord[]): void {
    for (const m of mutations) {
      if (m.type === 'childList') {
        this.pendingBatch.addedNodesCount += m.addedNodes.length;
        this.pendingBatch.removedNodesCount += m.removedNodes.length;

        // Check if added/removed nodes contain form elements
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i];
          if (node && node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName?.toLowerCase() || '';
            if (['input', 'select', 'textarea', 'mat-select', 'form'].includes(tag) || el.querySelector?.('input, select, mat-select')) {
              this.pendingBatch.hasFormChanges = true;
            }
          }
        }
      } else if (m.type === 'attributes') {
        const attrName = m.attributeName || '';
        if (!this.pendingBatch.attributeChanges.includes(attrName)) {
          this.pendingBatch.attributeChanges.push(attrName);
        }
        if (['disabled', 'readonly', 'aria-disabled'].includes(attrName)) {
          this.pendingBatch.hasDisabledChanges = true;
        }
      }
    }

    // Schedule debounced batch flush
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushBatch();
    }, this.debounceDelayMs);
  }

  /**
   * Emits the batched changes to listeners and resets batch state.
   */
  private flushBatch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const batch = { ...this.pendingBatch, timestamp: Date.now() };
    this.pendingBatch = this.createEmptyBatch();

    for (const listener of this.listeners) {
      try {
        listener(batch);
      } catch (e) {
        logger.error('[DomObservationEngine] Batch listener error:', e);
      }
    }
  }

  public onBatch(listener: DomBatchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Stops observation and clears pending timers.
   */
  public stopObserving(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.isObserving = false;
    this.pendingBatch = this.createEmptyBatch();
    this.listeners.clear();
    logger.debug('[DomObservationEngine] Observer disconnected.');
  }
}
