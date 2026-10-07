// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Retry Engine
// Bounded retry with progressive backoff,
// DOM re-scan, and field re-resolution
// ─────────────────────────────────────────────────

import logger from '@shared/logger';
import type { LogicalFieldType, FieldResolution } from './field-resolver';
import { reResolveField, isElementVisible } from './field-resolver';
import { verifyField, type VerificationResult } from './verification';

export interface RetryConfig {
  maxAttempts: number;
  delays: number[];   // ms between retries: [50, 100, 200, 400, 800]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delays: [50, 100, 200, 400, 800],
};

export interface RetryResult {
  success: boolean;
  attempts: number;
  verification: VerificationResult | null;
  error?: string;
  retriedElement?: HTMLElement;
}

/**
 * Execute a fill action with bounded retries, verification, and DOM re-scan.
 *
 * Workflow:
 * 1. Attempt fill
 * 2. Verify
 * 3. If failed: wait, re-scan current row, re-resolve field
 * 4. Attempt fill again
 * 5. Verify
 * 6. Final failure report after max attempts
 */
export async function retryWithVerification(opts: {
  fieldType: LogicalFieldType;
  element: HTMLElement;
  expectedValue: string;
  container: HTMLElement;
  excludeElements: Set<HTMLElement>;
  doc: Document;
  fillAction: (element: HTMLElement) => Promise<void>;
  config?: RetryConfig;
  shouldStop?: () => boolean;
}): Promise<RetryResult> {
  const {
    fieldType,
    expectedValue,
    container,
    excludeElements,
    doc,
    fillAction,
    config = DEFAULT_RETRY_CONFIG,
    shouldStop,
  } = opts;

  let currentElement = opts.element;
  let lastVerification: VerificationResult | null = null;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    if (shouldStop?.()) {
      return {
        success: false,
        attempts: attempt,
        verification: null,
        error: 'Autofill stopped by user',
      };
    }

    // Wait between retries (skip wait on first attempt)
    if (attempt > 0) {
      const delayIndex = Math.min(attempt - 1, config.delays.length - 1);
      const delay = config.delays[delayIndex];
      await new Promise(r => setTimeout(r, delay));

      if (shouldStop?.()) {
        return {
          success: false,
          attempts: attempt,
          verification: null,
          error: 'Autofill stopped by user',
        };
      }
    }

    // DOM re-render safety: verify element is still in document
    if (!doc.contains(currentElement)) {
      logger.debug(`Retry ${attempt + 1}: Element for ${fieldType} detached, re-resolving...`);
      const reResolved = reResolveField(fieldType, container, excludeElements, doc);
      if (reResolved) {
        currentElement = reResolved.element;
      } else {
        return {
          success: false,
          attempts: attempt + 1,
          verification: null,
          error: `Element for ${fieldType} detached and could not be re-resolved`,
        };
      }
    }

    // Check if element is disabled or readonly — DO NOT force
    if (currentElement instanceof HTMLInputElement || currentElement instanceof HTMLTextAreaElement) {
      if (currentElement.disabled) {
        logger.debug(`Retry ${attempt + 1}: ${fieldType} field is disabled, waiting...`);
        // Wait for framework to potentially enable it
        const enableWait = await waitForEnabled(currentElement, 800);
        if (!enableWait) {
          if (attempt === config.maxAttempts - 1) {
            return {
              success: false,
              attempts: attempt + 1,
              verification: null,
              error: `${fieldType} field is still disabled after waiting`,
            };
          }
          continue;
        }
      }
      const isDropdownField = fieldType === 'gender' || fieldType === 'photoIdProof'
        || fieldType === 'state' || fieldType === 'country'
        || currentElement.getAttribute('role') === 'combobox'
        || currentElement.closest('mat-select, [role="combobox"], .mat-mdc-select, .p-dropdown, ng-select') !== null;

      if (currentElement.readOnly && !isDropdownField) {
        logger.debug(`Retry ${attempt + 1}: ${fieldType} field is readOnly`);
        if (attempt === config.maxAttempts - 1) {
          return {
            success: false,
            attempts: attempt + 1,
            verification: null,
            error: `${fieldType} field is readOnly`,
          };
        }
        continue;
      }
    }

    // Execute fill action
    try {
      await fillAction(currentElement);
    } catch (err) {
      logger.debug(`Retry ${attempt + 1}: Fill action for ${fieldType} threw:`, err);
      if (attempt === config.maxAttempts - 1) {
        return {
          success: false,
          attempts: attempt + 1,
          verification: null,
          error: `Fill action failed: ${err instanceof Error ? err.message : 'unknown'}`,
        };
      }
      continue;
    }

    // Brief stabilization pause for Angular
    await new Promise(r => setTimeout(r, 30));

    // Verify
    lastVerification = verifyField(currentElement, expectedValue, fieldType, doc);

    if (lastVerification.status === 'verified') {
      return {
        success: true,
        attempts: attempt + 1,
        verification: lastVerification,
        retriedElement: currentElement,
      };
    }

    // On failure: re-resolve field for next attempt
    if (attempt < config.maxAttempts - 1) {
      logger.debug(`Retry ${attempt + 1}: Verification failed for ${fieldType}, will re-resolve for next attempt`);
      const reResolved = reResolveField(fieldType, container, excludeElements, doc);
      if (reResolved) {
        currentElement = reResolved.element;
      }
    }
  }

  return {
    success: false,
    attempts: config.maxAttempts,
    verification: lastVerification,
    error: lastVerification
      ? `Verification failed after ${config.maxAttempts} attempts: ${lastVerification.reasons.join('; ')}`
      : `All ${config.maxAttempts} attempts failed`,
    retriedElement: currentElement,
  };
}

/**
 * Wait for an element to become enabled (not disabled).
 * Does NOT force-enable — just waits for the framework to do so.
 */
async function waitForEnabled(
  element: HTMLInputElement | HTMLTextAreaElement,
  timeoutMs: number = 800,
): Promise<boolean> {
  const start = Date.now();
  const pollMs = 50;

  while (Date.now() - start < timeoutMs) {
    if (!element.disabled) return true;
    await new Promise(r => setTimeout(r, pollMs));
  }

  return !element.disabled;
}

/**
 * Wait for an element to appear in a container (for dynamically inserted fields).
 * Does NOT continuously scan the entire document.
 */
export async function waitForElementInContainer(
  fieldType: LogicalFieldType,
  container: HTMLElement,
  excludeElements: Set<HTMLElement>,
  doc: Document,
  timeoutMs: number = 2000,
): Promise<FieldResolution | null> {
  const start = Date.now();
  const pollMs = 100;

  while (Date.now() - start < timeoutMs) {
    const resolved = reResolveField(fieldType, container, excludeElements, doc);
    if (resolved && isElementVisible(resolved.element)) {
      return resolved;
    }
    await new Promise(r => setTimeout(r, pollMs));
  }

  return null;
}
