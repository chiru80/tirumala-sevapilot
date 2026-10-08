// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Resilient Retry Engine (Phase 11)
// Bounded exponential backoff with jitter, AbortSignal support,
// and strict hard safety exclusion boundaries.
// ─────────────────────────────────────────────────────────────

import type { RetryPolicy } from './types';
import { AutomationAbortedError } from './types';
import logger from '@shared/logger';

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  elapsedMs: number;
}

/**
 * Operations that must NEVER be automatically retried under any circumstances.
 */
export const NON_RETRYABLE_OPERATIONS: readonly string[] = [
  'captcha',
  'otp',
  'payment',
  'final_submission',
  'ttd_temporary_booking_lock',
  'declaration',
  'mentally_fit',
  'physically_fit',
];

export class ResilientRetryEngine {
  private readonly defaultPolicy: RetryPolicy = {
    maxAttempts: 5,
    maxElapsedMs: 6000,
    baseDelayMs: 100,
    maxDelayMs: 2000,
    jitter: true,
  };

  /**
   * Executes an asynchronous task with bounded exponential backoff.
   * Immediately aborts if AbortSignal fires or if an exclusion boundary is hit.
   */
  public async executeWithRetry<T>(
    operationName: string,
    operationFn: (attempt: number) => Promise<T>,
    policyOverride?: Partial<RetryPolicy>,
  ): Promise<RetryResult<T>> {
    const policy: RetryPolicy = { ...this.defaultPolicy, ...policyOverride };
    const startTime = Date.now();

    // Check exclusion boundary
    const isForbidden = NON_RETRYABLE_OPERATIONS.some((op) =>
      operationName.toLowerCase().includes(op),
    );
    if (isForbidden) {
      logger.warn(`[ResilientRetryEngine] Automated retry strictly forbidden for: ${operationName}`);
      try {
        const value = await operationFn(1);
        return { success: true, value, attempts: 1, elapsedMs: Date.now() - startTime };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
          attempts: 1,
          elapsedMs: Date.now() - startTime,
        };
      }
    }

    let attempt = 0;
    let lastError: Error | undefined;

    const runAttempts = async (): Promise<RetryResult<T>> => {
      while (attempt < policy.maxAttempts) {
        attempt++;

        // Check AbortSignal
        if (policy.signal?.aborted) {
          throw new AutomationAbortedError(`Retry aborted during operation '${operationName}'`);
        }

        // Check max elapsed time
        const elapsed = Date.now() - startTime;
        if (elapsed > policy.maxElapsedMs) {
          logger.warn(`[ResilientRetryEngine] Max elapsed time exceeded (${elapsed}ms > ${policy.maxElapsedMs}ms) for ${operationName}`);
          break;
        }

        try {
          const result = await operationFn(attempt);
          if (policy.signal?.aborted) {
            throw new AutomationAbortedError(`Retry aborted during operation '${operationName}'`);
          }
          return {
            success: true,
            value: result,
            attempts: attempt,
            elapsedMs: Date.now() - startTime,
          };
        } catch (err) {
          if (err instanceof AutomationAbortedError || policy.signal?.aborted) {
            throw new AutomationAbortedError(`Retry aborted during operation '${operationName}'`);
          }
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt >= policy.maxAttempts) {
            break;
          }

          // Calculate exponential backoff delay with jitter
          const delay = this.calculateBackoffDelay(attempt, policy);
          logger.debug(`[ResilientRetryEngine] Attempt ${attempt} failed for '${operationName}'. Retrying in ${delay}ms...`, err);

          await this.delay(delay, policy.signal);
        }
      }

      return {
        success: false,
        error: lastError || new Error(`Failed '${operationName}' after ${attempt} attempts`),
        attempts: attempt,
        elapsedMs: Date.now() - startTime,
      };
    };

    if (!policy.signal) {
      return runAttempts();
    }

    const abortPromise = new Promise<never>((_, reject) => {
      if (policy.signal?.aborted) {
        reject(new AutomationAbortedError(`Retry aborted during operation '${operationName}'`));
        return;
      }
      policy.signal?.addEventListener(
        'abort',
        () => reject(new AutomationAbortedError(`Retry aborted during operation '${operationName}'`)),
        { once: true },
      );
    });

    return Promise.race([runAttempts(), abortPromise]);
  }

  private calculateBackoffDelay(attempt: number, policy: RetryPolicy): number {
    const expDelay = policy.baseDelayMs * Math.pow(2, attempt - 1);
    const clampedDelay = Math.min(expDelay, policy.maxDelayMs);

    if (!policy.jitter) {
      return clampedDelay;
    }

    // Full jitter: uniformly distributed between 0 and clampedDelay
    const jitterFactor = 0.5 + Math.random() * 0.5;
    return Math.round(clampedDelay * jitterFactor);
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new AutomationAbortedError());
      }

      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const onAbort = () => {
        cleanup();
        reject(new AutomationAbortedError());
      };

      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      signal?.addEventListener('abort', onAbort);
    });
  }
}
