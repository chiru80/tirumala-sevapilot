// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Smart Wait System
// Dynamic DOM synchronization with MutationObserver,
// requestAnimationFrame, timeout safety, and retry mechanics
// ─────────────────────────────────────────────────

import { isElementVisible } from './autofill/field-resolver';
import type { ServiceType } from '@shared/types';
import logger from '@shared/logger';

// Local field finder to avoid circular dependency with ttd-pilgrim-autofill
function findFieldLocal(
  labels: string[],
  type?: 'text' | 'number' | 'select' | 'any',
  doc: Document = document,
): HTMLElement | null {
  const normalizedLabels = labels.map(l => l.toLowerCase().replace(/[*:_]/g, ' ').replace(/\s+/g, ' ').trim());

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, mat-select, [role="combobox"]'
  )).filter(el => isElementVisible(el));

  for (const el of candidates) {
    const attrs = [
      el.getAttribute('name'), el.getAttribute('placeholder'),
      el.getAttribute('formcontrolname'), el.getAttribute('aria-label'), el.id,
    ].filter(Boolean).join(' ').toLowerCase();

    if (normalizedLabels.some(l => attrs.includes(l))) {
      return el;
    }

    // Check label
    if (el.id) {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl?.textContent) {
        const lblText = labelEl.textContent.toLowerCase();
        if (normalizedLabels.some(l => lblText.includes(l))) return el;
      }
    }
  }
  return null;
}

export interface SmartWaitOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
  doc?: Document;
  signal?: AbortSignal;
}


const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_RETRY_INTERVAL_MS = 100;

/**
 * Wait for a DOM element matching a CSS selector to appear and become visible.
 * Uses MutationObserver where possible, falling back to requestAnimationFrame pacing.
 */
export async function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  options: SmartWaitOptions = {},
): Promise<T | null> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = performance.now();

  // Immediate check
  const existing = doc.querySelector<T>(selector);
  if (existing && isElementVisible(existing)) {
    return existing;
  }

  return new Promise((resolve) => {
    let resolved = false;
    let observer: MutationObserver | null = null;
    let timeoutId: any = null;
    let intervalId: any = null;

    const cleanup = () => {
      resolved = true;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const check = () => {
      if (resolved) return;
      const el = doc.querySelector<T>(selector);
      if (el && isElementVisible(el)) {
        cleanup();
        resolve(el);
      }
    };

    // Use MutationObserver if supported
    if (typeof MutationObserver !== 'undefined' && doc.body) {
      observer = new MutationObserver(() => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(check);
        } else {
          check();
        }
      });

      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'disabled'],
      });
    }

    // Polling fallback
    intervalId = setInterval(() => {
      if (resolved) {
        clearInterval(intervalId);
        intervalId = null;
        return;
      }
      check();
      if (performance.now() - startTime >= timeoutMs) {
        cleanup();
        logger.debug(`waitForElement timed out after ${timeoutMs}ms for selector: ${selector}`);
        resolve(null);
      }
    }, options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS);

    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      cleanup();
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Wait for a semantic form field to appear (e.g. 'name', 'age', 'gender', 'photoIdProof', 'photoIdNumber')
 */
export async function waitForField(
  labels: string[],
  options: SmartWaitOptions & { type?: 'text' | 'number' | 'select' | 'any'; index?: number } = {},
): Promise<HTMLElement | null> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = performance.now();

  while (performance.now() - startTime < timeoutMs) {
    const field = findFieldLocal(
      labels,
      options.type,
      doc,
    );

    if (field && isElementVisible(field)) {
      return field;
    }

    await new Promise((r) => setTimeout(r, options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS));
  }

  logger.debug(`waitForField timed out after ${timeoutMs}ms for labels: ${labels.join(', ')}`);
  return null;
}

/**
 * Wait for a TTD Booking Form to load with active input elements.
 */
export async function waitForForm(
  options: SmartWaitOptions = {},
): Promise<HTMLElement | null> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = performance.now();

  while (performance.now() - startTime < timeoutMs) {
    const nameField = findFieldLocal(
      ['name', 'full name', 'pilgrim name', 'devotee name'],
      'text',
      doc,
    );

    const ageField = findFieldLocal(
      ['age', 'pilgrim age'],
      'number',
      doc,
    );

    if (nameField && ageField) {
      const container = (nameField.closest('form, table, .card, .pilgrim-row, [role="table"]') || doc.body) as HTMLElement;
      return container;
    }

    await new Promise((r) => setTimeout(r, options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS));
  }

  logger.debug(`waitForForm timed out after ${timeoutMs}ms`);
  return null;
}

/**
 * Wait for specific TTD Service header or container to appear in the DOM.
 */
export async function waitForService(
  serviceType: ServiceType,
  options: SmartWaitOptions = {},
): Promise<boolean> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return false;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = performance.now();

  const serviceKeywords: Record<ServiceType, string[]> = {
    darshan: ['darshan', 'special entry darshan', 'sed', 'sri pat'],
    'arjitha-seva': ['arjitha', 'seva', 'suprabhatham', 'tomala', 'archana', 'kalyanotsavam'],
    accommodation: ['accommodation', 'room', 'cottage', 'choultry', 'guest house'],
    srivani: ['srivani', 'trust donation', 'donor'],
    'srivari-seva': ['srivari seva', 'voluntary service'],
    angapradakshinam: ['angapradakshinam'],
    'kalyana-vedika': ['kalyana vedika'],
  'senior-citizen': ['senior citizen', 'differently abled'],
    generic: ['booking', 'pilgrim', 'devotee'],
  };

const keywords = serviceKeywords[serviceType] || ['booking'];

while (performance.now() - startTime < timeoutMs) {
  const text = (doc.body?.textContent || '').toLowerCase();
  const hasMatch = keywords.some(kw => text.includes(kw));
  if (hasMatch) {
    return true;
  }

  await new Promise((r) => setTimeout(r, options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS));
}

return false;
}

// isElementVisible is now imported from field-resolver

/**
 * Observe DOM mutations and invoke callback as soon as an element matches the selector.
 * Disconnects automatically on first match to conserve CPU cycles.
 */
export function observeAndFill(
  selector: string,
  onFound: (el: HTMLElement) => void,
  doc: Document = document,
): MutationObserver {
  const existing = doc.querySelector<HTMLElement>(selector);
  if (existing) {
    onFound(existing);
  }

  const observer = new MutationObserver((_, obs) => {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) {
      onFound(el);
      obs.disconnect(); // Disconnect once filled
    }
  });

  if (doc.body) {
    observer.observe(doc.body, { childList: true, subtree: true });
  }
  return observer;
}

export interface WaitForConditionOptions {
  timeoutMs?: number;
  pollMs?: number;
}

/**
 * Wait for an arbitrary condition to become truthy.
 * Checks immediately, then uses polling/rAF, with a safety timeout.
 * Replaces hardcoded fixed delays (wait(120), wait(80)).
 */
export async function waitForCondition<T>(
  predicate: () => T | Promise<T>,
  options: WaitForConditionOptions = {},
): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? 1500;
  const pollMs = options.pollMs ?? 16;

  try {
    const immediate = await predicate();
    if (immediate) return immediate;
  } catch {}

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      resolved = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const intervalId = setInterval(async () => {
      if (resolved) return;
      try {
        const val = await predicate();
        if (val) {
          cleanup();
          resolve(val);
        }
      } catch {}
    }, pollMs);

    const timeoutId = setTimeout(() => {
      if (resolved) return;
      cleanup();
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Adaptive retry with progressive backoff:
 * Attempts immediately (0ms), then 50ms, 100ms, 200ms, 400ms.
 * Stops the instant the action succeeds.
 */
export async function adaptiveRetry<T>(
  action: (attemptIndex: number) => Promise<T | null | undefined | false>,
  backoffSchedule: number[] = [0, 50, 100, 200, 400],
): Promise<T | null> {
  for (let i = 0; i < backoffSchedule.length; i++) {
    const delay = backoffSchedule[i];
    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const res = await action(i);
      if (res) return res;
    } catch (err) {
      logger.debug(`Adaptive retry attempt ${i + 1} failed:`, err);
    }
  }
  return null;
}

/**
 * Wait for an element to become visible in the DOM.
 */
export async function waitForVisible<T extends HTMLElement = HTMLElement>(
  target: string | T,
  options: SmartWaitOptions = {},
): Promise<T | null> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  return waitForCondition<T>(() => {
    if (options.signal?.aborted) return null as any;
    const el = typeof target === 'string' ? doc.querySelector<T>(target) : target;
    return (el && isElementVisible(el)) ? el : null;
  }, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
  });
}

/**
 * Wait for an element to become enabled (not disabled, not readOnly, not aria-disabled).
 */
export async function waitForEnabled<T extends HTMLElement = HTMLElement>(
  target: string | T,
  options: SmartWaitOptions = {},
): Promise<T | null> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  return waitForCondition<T>(() => {
    if (options.signal?.aborted) return null as any;
    const el = typeof target === 'string' ? doc.querySelector<T>(target) : target;
    if (!el || !isElementVisible(el)) return null;

    const isDisabled = el.hasAttribute('disabled') ||
      Boolean((el as unknown as HTMLInputElement).disabled) ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.classList.contains('mat-select-disabled');

    return !isDisabled ? el : null;
  }, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
  });
}

/**
 * Wait for an input/select element to have a specific value.
 */
export async function waitForValue(
  target: string | HTMLInputElement | HTMLSelectElement,
  expectedValue: string,
  options: SmartWaitOptions = {},
): Promise<boolean> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return false;

  const result = await waitForCondition<boolean>(() => {
    if (options.signal?.aborted) return null as any;
    const el = typeof target === 'string'
      ? doc.querySelector<HTMLInputElement | HTMLSelectElement>(target)
      : target;
    if (!el) return null;

    const cleanExpected = expectedValue.trim().toLowerCase();
    const cleanActual = (el.value || '').trim().toLowerCase();
    return cleanActual === cleanExpected ? true : null;
  }, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
  });

  return Boolean(result);
}

/**
 * Wait for a DOM mutation satisfying a custom predicate.
 */
export async function waitForMutation(
  target: HTMLElement,
  predicate: (mutations: MutationRecord[]) => boolean,
  options: SmartWaitOptions = {},
): Promise<boolean> {
  if (typeof MutationObserver === 'undefined' || !target) return false;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const cleanup = () => {
      resolved = true;
      observer.disconnect();
      clearTimeout(timer);
    };

    const observer = new MutationObserver((mutations) => {
      if (options.signal?.aborted) {
        cleanup();
        resolve(false);
        return;
      }
      if (predicate(mutations)) {
        cleanup();
        resolve(true);
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    }, timeoutMs);
  });
}

/**
 * Wait for a specific step transition to become active in the DOM.
 */
export async function waitForStep(
  stepTextOrType: string,
  options: SmartWaitOptions = {},
): Promise<boolean> {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return false;

  const result = await waitForCondition<boolean>(() => {
    if (options.signal?.aborted) return null as any;
    const activeHeaders = doc.querySelectorAll('.mat-step-header[aria-selected="true"], .active-step, h1, h2');
    const targetClean = stepTextOrType.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let i = 0; i < activeHeaders.length; i++) {
      const text = (activeHeaders[i].textContent || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (text.includes(targetClean)) return true;
    }
    return null;
  }, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
  });

  return Boolean(result);
}

