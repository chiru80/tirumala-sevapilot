// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Guardian Page State Detector (Phase 8)
// Multi-signal DOM + URL semantic page classifier with strict human boundary checks
// ─────────────────────────────────────────────────────────────

import { isElementVisible } from '../../content/autofill/field-resolver';
import {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from '../workflows/step-detectors';
import { detectTtdTemporaryLock } from '../ttd-information/ttd-lock-detector';
import { detectQueueState } from '../queue/queue-detector';
import { domCache } from '../../content/automation/dom-cache';
import type { GuardianPageStage, PageDetectionResult } from './types';

/**
 * Detects presence of interactive CAPTCHA challenge in live DOM.
 */
export function detectCaptchaPresence(doc: Document = document): boolean {
  const captchaSelectors = [
    'img[src*="captcha" i]',
    'canvas[class*="captcha" i]',
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
    'input[formcontrolname*="captcha" i]',
    'input[placeholder*="captcha" i]',
    '.captcha-box',
    '.captcha-container',
    '.g-recaptcha',
    '.h-captcha',
    '.cf-turnstile',
    '[data-testid*="captcha" i]',
  ];

  for (const sel of captchaSelectors) {
    const els = Array.from(doc.querySelectorAll<HTMLElement>(sel));
    for (const el of els) {
      if (isElementVisible(el)) {
        return true;
      }
    }
  }

  // Check text hints near inputs
  const labels = Array.from(doc.querySelectorAll('label, span, div.mat-form-field-label-wrapper'));
  for (const l of labels) {
    const text = (l.textContent || '').toLowerCase();
    if (text.includes('enter captcha') || text.includes('security code')) {
      if (isElementVisible(l as HTMLElement)) return true;
    }
  }

  return false;
}

/**
 * Detects presence of interactive OTP verification challenge in live DOM.
 */
export function detectOtpPresence(doc: Document = document): boolean {
  const otpSelectors = [
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[formcontrolname*="otp" i]',
    'input[placeholder*="otp" i]',
    '.otp-container',
    '.otp-input',
    '#otpInput',
    '[data-testid*="otp" i]',
  ];

  for (const sel of otpSelectors) {
    const els = Array.from(doc.querySelectorAll<HTMLElement>(sel));
    for (const el of els) {
      if (isElementVisible(el)) {
        return true;
      }
    }
  }

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .title, .dialog-title'));
  for (const h of headings) {
    const text = (h.textContent || '').toLowerCase();
    if (text.includes('enter otp') || text.includes('verify otp') || text.includes('otp verification')) {
      if (isElementVisible(h as HTMLElement)) return true;
    }
  }

  return false;
}

/**
 * Detects official booking success markers.
 * Strictly requires definitive confirmation text/elements — NEVER optimistic click guesses.
 */
export function detectBookingSuccess(doc: Document = document, url: string = ''): boolean {
  const sanitizedUrl = url.toLowerCase();
  const hasSuccessUrl = /success|confirmation|receipt|booked|acknowledgement/i.test(sanitizedUrl);

  const successSelectors = [
    '.booking-success',
    '.success-container',
    '.receipt-container',
    '.acknowledgement-box',
    '#bookingConfirmation',
    '[data-testid*="booking-success" i]',
  ];

  for (const sel of successSelectors) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      return true;
    }
  }

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, .page-title, .header-title'));
  for (const h of headings) {
    const text = (h.textContent || '').toLowerCase();
    if (
      text.includes('booking successful') ||
      text.includes('payment successful') ||
      text.includes('transaction successful') ||
      text.includes('booking confirmed') ||
      text.includes('booking acknowledgement')
    ) {
      if (isElementVisible(h as HTMLElement)) return true;
    }
  }

  const bodyText = (doc.body?.innerText || '').toLowerCase();
  if (
    bodyText.includes('booking reference number') ||
    bodyText.includes('transaction id :') ||
    (bodyText.includes('download ticket') && (hasSuccessUrl || bodyText.includes('congratulations')))
  ) {
    return true;
  }

  return false;
}

/**
 * Detects session timeout / expired state.
 */
export function detectSessionExpired(doc: Document = document, url: string = ''): boolean {
  const bodyText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
  if (
    bodyText.includes('session has expired') ||
    bodyText.includes('session expired') ||
    bodyText.includes('session timed out') ||
    bodyText.includes('please login again to continue') ||
    bodyText.includes('your session has timed out')
  ) {
    return true;
  }

  const modals = Array.from(doc.querySelectorAll('.modal, .dialog, .alert, mat-dialog-container'));
  for (const m of modals) {
    const text = (m.textContent || '').toLowerCase();
    if (text.includes('session expired') || text.includes('session timeout')) {
      if (isElementVisible(m as HTMLElement)) return true;
    }
  }

  return false;
}

/**
 * Authoritative Guardian Page Detector.
 * Evaluates live DOM signals with fallback priority and zero-lag domCache integration.
 */
export function detectGuardianPageStage(
  doc: Document = document,
  url: string = '',
  skipCache = false,
): PageDetectionResult {
  const targetUrl = url || (doc as any)?.location?.href || (typeof window !== 'undefined' ? window.location?.href : '') || '';
  const cacheKey = `guardianPageStage:${targetUrl}`;

  if (!skipCache) {
    const cached = domCache.get<PageDetectionResult>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = computeGuardianPageStage(doc, targetUrl);
  domCache.set(cacheKey, result, 150);
  return result;
}

/**
 * Explicitly invalidates cached page detection results on navigation or DOM replacement.
 */
export function invalidateGuardianPageStageCache(): void {
  domCache.invalidatePrefix('guardianPageStage:');
}

function computeGuardianPageStage(
  doc: Document,
  targetUrl: string,
): PageDetectionResult {
  const reasons: string[] = [];

  // 1. Session Expiration (P0)
  const isSessionExpired = detectSessionExpired(doc, targetUrl);
  if (isSessionExpired) {
    reasons.push('Session expiration notice detected');
    return {
      stage: 'SESSION_EXPIRED',
      confidence: 95,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: true,
    };
  }

  // 2. Temporary TTD Booking Lock (P0 safety guard)
  const lockRes = detectTtdTemporaryLock(doc, targetUrl);
  if (lockRes.isLocked && lockRes.lockState) {
    reasons.push(`TTD temporary booking lock detected: ${lockRes.lockState.message || 'Held pilgrim ID'}`);
    return {
      stage: 'LOCKED',
      confidence: Math.round(lockRes.confidence * 100),
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: true,
      isSessionExpired: false,
      temporaryLock: lockRes.lockState,
    };
  }

  // 3. Official Booking Success (Terminal state)
  const isSuccessPresent = detectBookingSuccess(doc, targetUrl);
  if (isSuccessPresent) {
    reasons.push('Official booking confirmation marker detected');
    return {
      stage: 'SUCCESS',
      confidence: 95,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: true,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 3b. Digital Queue / Virtual Waiting Room (Safe waiting mode)
  const queueRes = detectQueueState(doc, targetUrl);
  if (['QUEUE_WAITING', 'QUEUE_PROGRESSING', 'QUEUE_CAPTCHA_REQUIRED', 'QUEUE_DETECTED'].includes(queueRes.state)) {
    reasons.push(...queueRes.reasons);
    return {
      stage: 'DIGITAL_QUEUE',
      confidence: queueRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: queueRes.isCaptchaPresent,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
      isQueuePresent: true,
      queueState: queueRes.state,
      queuePosition: queueRes.progress?.position,
      queueWaitTime: queueRes.progress?.officialWaitTime,
    };
  }

  // 4. Payment Gateway (Human boundary)
  const paymentRes = detectPayment(doc, targetUrl);
  if (paymentRes.isCurrentStep) {
    reasons.push('Payment gateway or payment mode selection detected');
    return {
      stage: 'PAYMENT',
      confidence: paymentRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: true,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 5. Review / Summary Screen (Human boundary)
  const reviewRes = detectReviewDetails(doc, targetUrl);
  if (reviewRes.isCurrentStep) {
    reasons.push('Booking review or summary step detected');
    return {
      stage: 'REVIEW',
      confidence: reviewRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: true,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 6. Interactive CAPTCHA Challenge (Human boundary)
  const isCaptchaPresent = detectCaptchaPresence(doc);
  if (isCaptchaPresent) {
    reasons.push('Interactive CAPTCHA detected on page');
    return {
      stage: 'CAPTCHA',
      confidence: 90,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: true,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 7. Interactive OTP Challenge (Human boundary)
  const isOtpPresent = detectOtpPresence(doc);
  if (isOtpPresent) {
    reasons.push('Interactive OTP input detected on page');
    return {
      stage: 'OTP',
      confidence: 90,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: false,
      isOtpPresent: true,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 8. Srivari Seva Instructions Review Step (Human attestation)
  const instructionsRes = detectSrivariSevaInstructions(doc, targetUrl);
  const srivariEnrollRes = detectSrivariSevaEnrollment(doc, targetUrl);

  if (instructionsRes.isCurrentStep && (!srivariEnrollRes.isCurrentStep || /instructions/i.test(targetUrl) || instructionsRes.confidence >= srivariEnrollRes.confidence)) {
    reasons.push('Srivari Seva instructions review step detected');
    return {
      stage: 'SRIVARI_INSTRUCTIONS',
      confidence: instructionsRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 9. Srivari Seva Enrollment Form
  if (srivariEnrollRes.isCurrentStep) {
    reasons.push('Srivari Seva unified enrollment profile form detected');
    return {
      stage: 'SRIVARI_ENROLLMENT',
      confidence: srivariEnrollRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 10. Pilgrim Details Step
  const pilgrimRes = detectPilgrimDetails(doc, targetUrl);
  if (pilgrimRes.isCurrentStep) {
    reasons.push('Pilgrim details form detected');
    return {
      stage: 'PILGRIM_DETAILS',
      confidence: pilgrimRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 11. General Contact & Address Details Step
  const generalRes = detectGeneralDetails(doc, targetUrl);
  if (generalRes.isCurrentStep) {
    reasons.push('General contact and address details form detected');
    return {
      stage: 'GENERAL_DETAILS',
      confidence: generalRes.confidence,
      reasons,
      url: targetUrl,
      hasInteractiveForm: true,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 12. Slot & Date Selection
  const slotRes = detectSlotSelection(doc, targetUrl);
  const availRes = detectAvailability(doc, targetUrl);
  if (slotRes.isCurrentStep || availRes.isCurrentStep) {
    reasons.push('Calendar date and quota slot selection detected');
    return {
      stage: 'SLOT_SELECTION',
      confidence: Math.max(slotRes.confidence, availRes.confidence),
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  // 13. Service Selection (Landing / Portal Dashboard)
  const isTtdPortal = /ttdevasthanams\.ap\.gov\.in|tirupatibalaji\.ap\.gov\.in/i.test(targetUrl);
  if (isTtdPortal) {
    reasons.push('TTD portal service selection or navigation area detected');
    return {
      stage: 'SERVICE_SELECTION',
      confidence: 60,
      reasons,
      url: targetUrl,
      hasInteractiveForm: false,
      isCaptchaPresent: false,
      isOtpPresent: false,
      isPaymentPresent: false,
      isReviewPresent: false,
      isSuccessPresent: false,
      isLocked: false,
      isSessionExpired: false,
    };
  }

  reasons.push('No recognized TTD booking stage');
  return {
    stage: 'UNKNOWN',
    confidence: 0,
    reasons,
    url: targetUrl,
    hasInteractiveForm: false,
    isCaptchaPresent: false,
    isOtpPresent: false,
    isPaymentPresent: false,
    isReviewPresent: false,
    isSuccessPresent: false,
    isLocked: false,
    isSessionExpired: false,
  };
}
