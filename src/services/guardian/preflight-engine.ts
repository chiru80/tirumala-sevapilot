// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Guardian Preflight Engine (Phase 8)
// 10-point comprehensive pre-flight verification before any autofill handoff
// ─────────────────────────────────────────────────────────────

import { ServiceType, type Profile, type Pilgrim } from '@shared/types';
import {
  getCanonicalService,
  getCanonicalServiceLimits,
} from '../canonical-service-registry';
import { ReadinessEngine } from '../readiness-engine';
import { bookingSession } from '../../content/autofill/booking-session';
import type { PageDetectionResult, GuardianPreflightReport, GuardianPreflightCheck } from './types';

export interface PreflightOptions {
  doc?: Document;
  url?: string;
  pageDetection: PageDetectionResult;
  serviceId?: string;
  workflowId?: string;
  profile: Profile | null | undefined;
  selectedPilgrims: Pilgrim[];
}

/**
 * Executes authoritative 10-point preflight check for Booking Guardian.
 */
export function executeGuardianPreflight(options: PreflightOptions): GuardianPreflightReport {
  const {
    doc = document,
    url = '',
    pageDetection,
    serviceId,
    workflowId,
    profile,
    selectedPilgrims,
  } = options;

  const checks: GuardianPreflightCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetUrl = url || (doc as any)?.location?.href || (typeof window !== 'undefined' ? window.location?.href : '') || '';
  const isTtdDomain = /ttdevasthanams\.ap\.gov\.in|tirupatibalaji\.ap\.gov\.in/i.test(targetUrl);

  // 1. TTD Page Recognized
  const isTtdRecognized = isTtdDomain || pageDetection.stage !== 'UNKNOWN';
  checks.push({
    id: 'ttd-page-recognized',
    name: 'TTD Portal Recognized',
    passed: isTtdRecognized,
    severity: 'error',
    message: isTtdRecognized ? 'Official TTD portal recognized' : 'Active tab is not a recognized TTD booking page',
  });
  if (!isTtdRecognized) errors.push('Page is not recognized as official TTD portal');

  // 2. Service Recognized
  const canonicalService = serviceId ? getCanonicalService(serviceId) : undefined;
  const isServiceRecognized = Boolean(canonicalService);
  checks.push({
    id: 'service-recognized',
    name: 'Canonical Service Identified',
    passed: isServiceRecognized,
    severity: 'error',
    message: isServiceRecognized
      ? `Recognized service: ${canonicalService?.displayName || canonicalService?.serviceName}`
      : 'Unknown TTD service. Service-specific autofill cannot proceed.',
  });
  if (!isServiceRecognized) errors.push('Service could not be safely identified');

  // 3. Workflow Recognized
  const isWorkflowRecognized = Boolean(workflowId || canonicalService?.workflowId);
  checks.push({
    id: 'workflow-recognized',
    name: 'Booking Workflow Mapped',
    passed: isWorkflowRecognized,
    severity: 'error',
    message: isWorkflowRecognized
      ? `Mapped workflow: ${workflowId || canonicalService?.workflowId}`
      : 'No workflow mapped for this service',
  });
  if (!isWorkflowRecognized) errors.push('No booking workflow mapped');

  // 4. Correct Pilgrim Count (Service Limits Enforcement)
  const pilgrimCount = selectedPilgrims.length;
  let isCountValid = false;
  let countMessage = '';

  if (canonicalService) {
    const limits = getCanonicalServiceLimits(canonicalService.serviceId);
    if (limits.exactPilgrims !== undefined) {
      isCountValid = pilgrimCount === limits.exactPilgrims;
      countMessage = isCountValid
        ? `Devotee count matches exact requirement (${limits.exactPilgrims})`
        : `${canonicalService.displayName || canonicalService.serviceName} requires exactly ${limits.exactPilgrims} devotee(s), but ${pilgrimCount} selected`;
    } else {
      isCountValid = pilgrimCount >= limits.minPilgrims && pilgrimCount <= limits.maxPilgrims;
      countMessage = isCountValid
        ? `Devotee count (${pilgrimCount}) is within allowed range (${limits.minPilgrims}-${limits.maxPilgrims})`
        : `Allowed devotees: ${limits.minPilgrims}-${limits.maxPilgrims}, but ${pilgrimCount} selected`;
    }
  } else {
    isCountValid = pilgrimCount > 0 && pilgrimCount <= 6;
    countMessage = isCountValid ? `${pilgrimCount} devotee(s) selected` : 'Select between 1 and 6 devotees';
  }

  checks.push({
    id: 'pilgrim-count-valid',
    name: 'Devotee Count Limits',
    passed: isCountValid,
    severity: 'error',
    message: countMessage,
  });
  if (!isCountValid) errors.push(countMessage);

  // 5. Required Profile Data Available
  let isProfileDataComplete = false;
  let profileMessage = '';
  if (!profile) {
    profileMessage = 'No active profile loaded';
  } else if (selectedPilgrims.length === 0) {
    profileMessage = 'No devotees selected for booking';
  } else {
    const canonicalId = canonicalService?.serviceId || serviceId;
    const readiness = ReadinessEngine.evaluate(profile, ServiceType.DARSHAN, canonicalId, selectedPilgrims);
    isProfileDataComplete = readiness.isBookingReady;
    const missing = readiness.missingFields || [];
    profileMessage = isProfileDataComplete
      ? 'All required devotee details are complete'
      : `Missing required profile details (${missing.slice(0, 3).join(', ')})`;
  }

  checks.push({
    id: 'profile-data-complete',
    name: 'Required Profile Details',
    passed: isProfileDataComplete,
    severity: 'error',
    message: profileMessage,
  });
  if (!isProfileDataComplete) errors.push(profileMessage);

  // 6. Required Files Available (Photos/Documents for Srivari Seva or services requiring photos)
  let areFilesAvailable = true;
  let filesMessage = 'No mandatory file attachments required';
  if (serviceId === 'srivari-seva' || canonicalService?.serviceId === 'srivari-seva') {
    const missingPhoto = selectedPilgrims.some(p => !p.photo);
    if (missingPhoto) {
      areFilesAvailable = false;
      filesMessage = 'Srivari Seva requires a photo attachment for the selected devotee';
    } else {
      filesMessage = 'Required devotee photo attached';
    }
  }

  checks.push({
    id: 'required-files-available',
    name: 'Required File Attachments',
    passed: areFilesAvailable,
    severity: 'error',
    message: filesMessage,
  });
  if (!areFilesAvailable) errors.push(filesMessage);

  // 7. Page is Not Blocked by CAPTCHA
  const isNotCaptcha = !pageDetection.isCaptchaPresent && pageDetection.stage !== 'CAPTCHA';
  checks.push({
    id: 'not-captcha-page',
    name: 'CAPTCHA Boundary',
    passed: isNotCaptcha,
    severity: 'error',
    message: isNotCaptcha ? 'No active CAPTCHA blocking entry' : 'CAPTCHA present. User must solve CAPTCHA manually.',
  });
  if (!isNotCaptcha) errors.push('Page is blocked by CAPTCHA; human completion required');

  // 8. Page is Not Payment Gateway
  const isNotPayment = !pageDetection.isPaymentPresent && pageDetection.stage !== 'PAYMENT';
  checks.push({
    id: 'not-payment-page',
    name: 'Payment Boundary',
    passed: isNotPayment,
    severity: 'error',
    message: isNotPayment ? 'Safe booking data entry phase' : 'Payment page reached. Manual user payment required.',
  });
  if (!isNotPayment) errors.push('Payment page reached; manual payment required');

  // 9. No Temporary Booking Lock
  const isNotLocked = !pageDetection.isLocked && pageDetection.stage !== 'LOCKED';
  checks.push({
    id: 'no-temporary-lock',
    name: 'Server Cooldown & Lock Guard',
    passed: isNotLocked,
    severity: 'error',
    message: isNotLocked
      ? 'No server-side pilgrim hold detected'
      : `Temporary TTD lock active: ${pageDetection.temporaryLock?.message || 'Held pilgrim ID'}`,
  });
  if (!isNotLocked) errors.push('TTD server is temporarily locking these devotee IDs');

  // 10. Session Valid (No Concurrent Clashing Session)
  const isSessionNotConflicting = !bookingSession.isRunning();
  checks.push({
    id: 'session-valid',
    name: 'Concurrency Lock Check',
    passed: isSessionNotConflicting,
    severity: 'error',
    message: isSessionNotConflicting
      ? 'Single active session verified'
      : 'Another autofill session is already running in this tab',
  });
  if (!isSessionNotConflicting) errors.push('Conflicting autofill session in progress');

  const isReady = checks.every(c => c.passed);

  return {
    isReady,
    checks,
    errors,
    warnings,
    serviceId: canonicalService?.serviceId || serviceId,
    workflowId: canonicalService?.workflowId || workflowId,
    pilgrimCount,
  };
}
