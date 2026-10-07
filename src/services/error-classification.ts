// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Centralized Error Classification System
// Enforces strict priority order per specification:
// 1. CAPTCHA / Security restriction
// 2. TTD temporary booking lock
// 3. TTD validation error
// 4. Service recognition error
// 5. Field detection error
// 6. Autofill error
// 7. Verification error
// 8. Generic error
// ─────────────────────────────────────────────────────────────

import type { TtdTemporaryLockState } from '@shared/types';
import { detectTtdTemporaryLock } from './ttd-information/ttd-lock-detector';

export type ErrorCategory =
  | 'security'
  | 'ttd-state'
  | 'ttd-validation'
  | 'service-recognition'
  | 'field-detection'
  | 'autofill'
  | 'verification'
  | 'generic';

export interface ErrorClassification {
  code: string;
  category: ErrorCategory;
  severity: 'error' | 'warning' | 'info';
  priority: number; // 1 (highest) to 8 (lowest)
  retryable: boolean;
  automaticRetry: boolean;
  userActionRequired: boolean;
  bookingSubmissionBlocked: boolean;
  message: string;
  recommendedAction: 'check-booking-history' | 'wait-and-retry' | 'fix-profile' | 'solve-captcha' | 'refresh-page' | 'manual-review';
  metadata?: Record<string, unknown>;
}

/**
 * Creates the official classification for TTD_TEMPORARY_BOOKING_LOCK.
 */
export function createTtdTemporaryLockClassification(lockState: TtdTemporaryLockState): ErrorClassification {
  return {
    code: 'TTD_TEMPORARY_BOOKING_LOCK',
    category: 'ttd-state',
    severity: 'warning',
    priority: 2,
    retryable: true,
    automaticRetry: false,
    userActionRequired: true,
    bookingSubmissionBlocked: true,
    message: lockState.message,
    recommendedAction: 'check-booking-history',
    metadata: {
      status: lockState.status,
      detectedAt: lockState.detectedAt,
      durationMinutes: lockState.durationMinutes,
      elapsedSeconds: lockState.elapsedSeconds,
      remainingSeconds: lockState.remainingSeconds,
      hasExplicitTimer: lockState.hasExplicitTimer,
    },
  };
}

/**
 * Classifies an error input with priority resolution against page context.
 * If a temporary booking lock is visible on the page or in text,
 * it is ALWAYS prioritized over field detection, autofill, verification, or generic errors.
 */
export function classifyError(
  errorInput: unknown,
  context?: {
    doc?: Document | null;
    url?: string;
    lockState?: TtdTemporaryLockState | null;
  },
): ErrorClassification {
  const errorMessage = typeof errorInput === 'string'
    ? errorInput
    : errorInput instanceof Error
    ? errorInput.message
    : (errorInput as any)?.message || String(errorInput || 'Unknown error');

  // Priority 1: CAPTCHA / Security restriction
  if (/captcha/i.test(errorMessage) || (context?.doc && context.doc.querySelector('#captcha-container, .captcha-container, img[src*="captcha" i], .g-recaptcha, .cf-turnstile'))) {
    return {
      code: 'CAPTCHA_DETECTED',
      category: 'security',
      severity: 'warning',
      priority: 1,
      retryable: true,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: true,
      message: 'CAPTCHA detected. Complete it manually.',
      recommendedAction: 'solve-captcha',
    };
  }

  // Priority 2: TTD Temporary Booking Lock
  if (context?.lockState) {
    return createTtdTemporaryLockClassification(context.lockState);
  }

  if (context?.doc) {
    const lockCheck = detectTtdTemporaryLock(context.doc, context.url || '');
    if (lockCheck.isLocked && lockCheck.lockState) {
      return createTtdTemporaryLockClassification(lockCheck.lockState);
    }
  }

  const textLockCheck = detectTtdTemporaryLock(errorMessage);
  if (textLockCheck.isLocked && textLockCheck.lockState) {
    return createTtdTemporaryLockClassification(textLockCheck.lockState);
  }

  // Priority 3: TTD validation error (server side rules rejection)
  if (/quota\s+exceeded|already\s+booked|maximum\s+limit|different\s+ticket\s+limit/i.test(errorMessage)) {
    return {
      code: 'TTD_VALIDATION_ERROR',
      category: 'ttd-validation',
      severity: 'error',
      priority: 3,
      retryable: false,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: true,
      message: errorMessage,
      recommendedAction: 'manual-review',
    };
  }

  // Priority 4: Service recognition error
  if (/service\s+workflow\s+not\s+recognized|uncertain\s+service/i.test(errorMessage)) {
    return {
      code: 'SERVICE_NOT_RECOGNIZED',
      category: 'service-recognition',
      severity: 'warning',
      priority: 4,
      retryable: true,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: true,
      message: errorMessage,
      recommendedAction: 'manual-review',
    };
  }

  // Priority 5: Field detection error
  if (/could\s+not\s+be\s+safely\s+identified|no\s+row\s+containers|unresolved\s+field/i.test(errorMessage)) {
    return {
      code: 'FIELD_DETECTION_ERROR',
      category: 'field-detection',
      severity: 'error',
      priority: 5,
      retryable: true,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: true,
      message: errorMessage,
      recommendedAction: 'refresh-page',
    };
  }

  // Priority 6: Autofill error
  if (/autofill\s+failed|fill\s+failed|could\s+not\s+populate/i.test(errorMessage)) {
    return {
      code: 'AUTOFILL_ERROR',
      category: 'autofill',
      severity: 'error',
      priority: 6,
      retryable: true,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: false,
      message: errorMessage,
      recommendedAction: 'wait-and-retry',
    };
  }

  // Priority 7: Verification error
  if (/verification\s+failed|could\s+not\s+be\s+verified|angular\s+validation/i.test(errorMessage)) {
    return {
      code: 'VERIFICATION_ERROR',
      category: 'verification',
      severity: 'warning',
      priority: 7,
      retryable: true,
      automaticRetry: false,
      userActionRequired: true,
      bookingSubmissionBlocked: false,
      message: errorMessage,
      recommendedAction: 'wait-and-retry',
    };
  }

  // Priority 8: Generic error
  return {
    code: 'GENERIC_ERROR',
    category: 'generic',
    severity: 'error',
    priority: 8,
    retryable: true,
    automaticRetry: false,
    userActionRequired: true,
    bookingSubmissionBlocked: false,
    message: errorMessage,
    recommendedAction: 'manual-review',
  };
}
