// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Temporary Pilgrim/ID Lock Detector
// Detects server-side lock when previous booking attempts still hold
// pilgrim details (e.g. after reaching payment and restarting).
// Strictly Zero-PII: Never logs or stores Aadhaar, ID, phone, email.
// ─────────────────────────────────────────────────────────────

import type { TtdTemporaryLockState } from '@shared/types';
import logger from '@shared/logger';
import { isElementVisible } from '../../content/autofill/field-resolver';

export interface TtdLockDetectionResult {
  isLocked: boolean;
  confidence: number;
  lockState: TtdTemporaryLockState | null;
  matchedPattern?: string;
  sourceText?: string;
}

/**
 * Normalizes text for semantic pattern matching:
 * - lowercase
 * - collapses whitespace
 * - normalizes curly apostrophes, quotes, dashes
 */
export function normalizeLockText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”"]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Core signal patterns for detecting TTD Temporary Booking Lock.
 * Built to be semantic and bounded so minor variations in TTD wording are caught.
 */
const TTD_LOCK_PATTERNS: Array<{
  id: string;
  regex: RegExp;
  confidence: number;
}> = [
  // Signal 1: "Your own previous attempt is still holding these pilgrims"
  {
    id: 'previous-attempt-holding',
    regex: /(?:your\s+own\s+)?previous\s+attempt\s+(?:is\s+)?still\s+holding(?:\s+these\s+pilgrims)?/i,
    confidence: 1.0,
  },
  // Signal 1b: "holding these pilgrims" / "attempt is still holding"
  {
    id: 'holding-pilgrims',
    regex: /(?:still\s+)?holding\s+these\s+pilgrims/i,
    confidence: 0.95,
  },
  // Signal 1c: "your last try still has these ID numbers locked" / "ID numbers locked"
  {
    id: 'id-numbers-locked',
    regex: /(?:last\s+try\s+still\s+has\s+these\s+)?id\s+numbers?\s+locked/i,
    confidence: 1.0,
  },
  // Signal 1d: "Not contention — your last try still has these ID numbers locked"
  {
    id: 'not-contention-locked',
    regex: /not\s+contention\s*-\s*your\s+last\s+try/i,
    confidence: 1.0,
  },
  // Signal 1e: "Retrying now cannot work"
  {
    id: 'retrying-cannot-work',
    regex: /retrying\s+now\s+cannot\s+work/i,
    confidence: 0.95,
  },
  // Signal 2: "Booking with same pilgrim id is in progress"
  {
    id: 'same-pilgrim-in-progress',
    regex: /booking\s+with\s+(?:the\s+)?same\s+pilgrim\s*(?:id)?\s+is\s+in\s+progress/i,
    confidence: 1.0,
  },
  // Signal 2b: "booking ... in progress" combined with pilgrim / ID reference
  {
    id: 'booking-pilgrim-in-progress',
    regex: /booking\s+(?:with\s+)?(?:same\s+)?(?:pilgrim|devotee|id)\b[^\.\n\r]*in\s+progress/i,
    confidence: 0.9,
  },
  // Signal 3: "Locked 23s ago — usually clears in about 5 minutes"
  {
    id: 'locked-duration-clears',
    regex: /locked\s+\d+\s*[smh]?\s*ago\s*-\s*usually\s+clears/i,
    confidence: 1.0,
  },
  // Signal 3b: "Locked ... usually clears in about X minutes"
  {
    id: 'locked-clears-in',
    regex: /locked\b[^\.\n\r]*usually\s+clears\s+in\s+about\s+\d+\s*minutes?/i,
    confidence: 0.95,
  },
  // Signal 4: Combination: "Please try again after some time" with pilgrim lock context
  {
    id: 'try-again-lock-context',
    regex: /(?:booking\s+with\s+same|pilgrim\s+id\s+is\s+in\s+progress)[^\.\n\r]*please\s+try\s+again\s+after\s+some\s+time/i,
    confidence: 0.95,
  },
  // Signal 5: "Wait a few minutes for it to expire, then try again" with locked context
  {
    id: 'wait-expire-locked',
    regex: /wait\s+a\s+few\s+minutes\s+for\s+it\s+to\s+expire[^\.\n\r]*try\s+again/i,
    confidence: 0.95,
  },
];

/**
 * Phrases that indicate standard generic errors and should NEVER be misclassified as a temporary lock.
 */
const EXCLUSION_PATTERNS: RegExp[] = [
  /could\s+not\s+be\s+safely\s+identified/i,
  /fields?\s+could\s+not\s+be/i,
  /field\s+detection\s+failure/i,
  /please\s+enter\s+valid\s+id/i,
  /invalid\s+aadhaar/i,
  /captcha\s+verification\s+failed/i,
  /profile\s+incomplete/i,
];

/**
 * Parse timer and duration details from text if provided by TTD.
 * e.g., "Locked 23s ago — usually clears in about 5 minutes."
 */
export function extractLockTimerDetails(normalizedText: string): {
  durationMinutes?: number;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  hasExplicitTimer: boolean;
} {
  let elapsedSeconds: number | undefined;
  let totalDurationSeconds: number | undefined;

  // 1. Extract elapsed time: "Locked 23s ago" or "Locked 1m ago"
  const elapsedMatch = normalizedText.match(/locked\s+(\d+)\s*(s|sec|seconds?|m|min|minutes?)\s*ago/i);
  if (elapsedMatch) {
    const value = parseInt(elapsedMatch[1], 10);
    const unit = elapsedMatch[2].toLowerCase();
    if (unit.startsWith('m')) {
      elapsedSeconds = value * 60;
    } else {
      elapsedSeconds = value;
    }
  }

  // 2. Extract total clearance duration: "usually clears in about 5 minutes" or "clears in about 5 minutes"
  const totalMatch = normalizedText.match(/(?:usually\s+)?clears\s+in\s+(?:about\s+)?(\d+)\s*(m|min|minutes?|s|sec|seconds?)/i)
    || normalizedText.match(/expires\s+in\s+(?:about\s+)?(\d+)\s*(m|min|minutes?)/i);

  if (totalMatch) {
    const value = parseInt(totalMatch[1], 10);
    const unit = totalMatch[2].toLowerCase();
    if (unit.startsWith('s')) {
      totalDurationSeconds = value;
    } else {
      totalDurationSeconds = value * 60;
    }
  }

  if (totalDurationSeconds !== undefined) {
    const elapsed = elapsedSeconds ?? 0;
    const remaining = Math.max(0, totalDurationSeconds - elapsed);
    const durationMinutes = Math.ceil(remaining / 60);

    return {
      durationMinutes,
      elapsedSeconds,
      remainingSeconds: remaining,
      hasExplicitTimer: true,
    };
  }

  return {
    hasExplicitTimer: false,
    elapsedSeconds,
  };
}

/**
 * Builds user-facing copy per specification:
 * - Primary: "Your previous booking attempt is still holding this pilgrim."
 * - Secondary: "TTD usually releases the temporary lock after a few minutes."
 * - If duration available: "Try again in about X minutes."
 */
export function buildLockMessages(timerInfo: { durationMinutes?: number; hasExplicitTimer: boolean }): {
  message: string;
  supportingMessage: string;
} {
  const primaryMessage = 'Your previous booking attempt is still holding this pilgrim.';

  let supportingMessage = 'TTD usually releases the temporary lock after a few minutes.';
  if (timerInfo.hasExplicitTimer && timerInfo.durationMinutes && timerInfo.durationMinutes > 0) {
    supportingMessage = `Try again in about ${timerInfo.durationMinutes} minutes. TTD usually releases the lock after a few minutes.`;
  }

  return {
    message: primaryMessage,
    supportingMessage,
  };
}

/**
 * Evaluates whether a raw string snippet indicates a TTD temporary lock.
 */
export function checkTextForTtdLock(rawText: string): TtdLockDetectionResult {
  if (!rawText || typeof rawText !== 'string') {
    return { isLocked: false, confidence: 0, lockState: null };
  }

  const normalized = normalizeLockText(rawText);

  // Check if text exclusively matches generic error patterns without lock markers
  const hasLockSignal = TTD_LOCK_PATTERNS.some(p => p.regex.test(normalized));
  if (!hasLockSignal) {
    const hasExclusion = EXCLUSION_PATTERNS.some(p => p.test(normalized));
    if (hasExclusion) {
      return { isLocked: false, confidence: 0, lockState: null };
    }
    return { isLocked: false, confidence: 0, lockState: null };
  }

  // Find matching pattern
  for (const pattern of TTD_LOCK_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      const timerInfo = extractLockTimerDetails(normalized);
      const { message, supportingMessage } = buildLockMessages(timerInfo);

      const now = Date.now();
      const lockState: TtdTemporaryLockState = {
        status: 'temporary-lock',
        detectedAt: now,
        detectedAtIso: new Date(now).toISOString(),
        estimatedRetryAt: timerInfo.remainingSeconds !== undefined ? now + (timerInfo.remainingSeconds * 1000) : undefined,
        estimatedRetryAtIso: timerInfo.remainingSeconds !== undefined ? new Date(now + (timerInfo.remainingSeconds * 1000)).toISOString() : undefined,
        durationMinutes: timerInfo.durationMinutes,
        elapsedSeconds: timerInfo.elapsedSeconds,
        remainingSeconds: timerInfo.remainingSeconds,
        hasExplicitTimer: timerInfo.hasExplicitTimer,
        message,
        supportingMessage,
      };

      return {
        isLocked: true,
        confidence: pattern.confidence,
        lockState,
        matchedPattern: pattern.id,
      };
    }
  }

  return { isLocked: false, confidence: 0, lockState: null };
}

function isElementVisibleForLock(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.getAttribute('type') === 'hidden' || el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const win = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
  if (win?.getComputedStyle) {
    try {
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch {
      // fallback
    }
  }
  return true;
}

/**
 * Safely inspects the DOM for TTD Temporary Booking Lock dialogs, modals, toasts, or banners.
 * Scans bounded elements first (dialogs, alerts, toast overlays) before main content.
 */
export function detectTtdTemporaryLock(
  docOrText?: Document | string | null,
  url: string = '',
): TtdLockDetectionResult {
  if (!docOrText) {
    return { isLocked: false, confidence: 0, lockState: null };
  }

  // Direct string input
  if (typeof docOrText === 'string') {
    return checkTextForTtdLock(docOrText);
  }

  const doc = docOrText;

  // 1. High priority: Inspect visible modal dialogs, alerts, snackbars, and banners
  const modalSelectors = [
    'mat-dialog-container',
    '.modal',
    '.modal-body',
    '.alert',
    '.alert-danger',
    '.alert-warning',
    '[role="alert"]',
    '[role="dialog"]',
    '.swal2-popup',
    '.swal2-container',
    '.cdk-overlay-pane',
    '.toast',
    '.mat-snack-bar-container',
    '.error-message',
    '.error-container',
    '.notification',
    '.lock-warning',
    '.status-message',
  ];

  for (const selector of modalSelectors) {
    const elements = doc.querySelectorAll<HTMLElement>(selector);
    for (const el of Array.from(elements)) {
      if (isElementVisibleForLock(el)) {
        const text = el.textContent || el.innerText || '';
        const res = checkTextForTtdLock(text);
        if (res.isLocked && res.lockState) {
          return res;
        }
      }
    }
  }

  // 2. Medium priority: Inspect main container visible paragraphs/headings
  const mainContainers = doc.querySelectorAll<HTMLElement>(
    'main, #main, .main-content, form, .booking-container, .card, .mat-card'
  );

  for (const container of Array.from(mainContainers)) {
    if (isElementVisibleForLock(container)) {
      const text = container.textContent || container.innerText || '';
      const res = checkTextForTtdLock(text);
      if (res.isLocked && res.lockState) {
        return res;
      }
    }
  }

  // 3. Last bounded fallback: Document body if bounded containers didn't catch it
  if (doc.body) {
    const bodyText = doc.body.innerText || doc.body.textContent || '';
    // Only check if candidate words exist to avoid expensive full scans
    const lowerBody = bodyText.toLowerCase();
    if (
      lowerBody.includes('previous attempt') ||
      lowerBody.includes('last try') ||
      lowerBody.includes('id numbers locked') ||
      lowerBody.includes('holding') ||
      lowerBody.includes('retrying now cannot work') ||
      (lowerBody.includes('same pilgrim') && lowerBody.includes('in progress')) ||
      (lowerBody.includes('locked') && (lowerBody.includes('clears') || lowerBody.includes('ago') || lowerBody.includes('minutes')))
    ) {
      const res = checkTextForTtdLock(bodyText);
      if (res.isLocked) {
        return res;
      }
    }
  }

  return { isLocked: false, confidence: 0, lockState: null };
}

/**
 * Safely logs lock detection with strict Zero-PII adherence.
 * Allowed: serviceId, workflowId, state, timestamp, elapsedLockDuration.
 * Never logged: Aadhaar, ID number, mobile, email, full pilgrim data.
 */
export function logSafeTtdLockDetected(params: {
  serviceId?: string;
  workflowId?: string;
  elapsedSeconds?: number;
}): void {
  logger.warn('[TTD] Temporary booking lock detected', {
    service: params.serviceId || 'unknown-service',
    workflow: params.workflowId || 'unknown-workflow',
    state: 'temporary-lock',
    timestamp: new Date().toISOString(),
    elapsedLockDuration: params.elapsedSeconds !== undefined ? `${params.elapsedSeconds}s` : undefined,
  });
}
