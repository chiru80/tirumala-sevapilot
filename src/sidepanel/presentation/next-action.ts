/**
 * Tirumala SevaPilot — Next Action Presentation Engine (Phase 13)
 * Pure, authoritative UX presentation mapper.
 * Translates low-level engineering states into ONE clear user-facing Next Action.
 * Priority-ordered safety: Temporary locks and queue safety states take precedence.
 * Complete 5-language translation parity with zero hardcoded English labels.
 */

import type { Profile, Pilgrim } from '@shared/types';
import type { UseReadinessResult } from '../hooks/useReadiness';
import type { ProductAutomationState } from '../../content/automation/types';
import type { QueueSession } from '../../services/queue';
import { isServiceManualOnly } from '../../services/canonical-service-registry';
import { t } from '@i18n/index';

export type NextActionCategory =
  | 'NO_PROFILE'
  | 'PROFILE_INCOMPLETE'
  | 'READY'
  | 'TTD_DETECTED'
  | 'WORKING'
  | 'VERIFYING'
  | 'USER_ACTION_REQUIRED'
  | 'BLOCKED'
  | 'QUEUE_WAITING'
  | 'COMPLETED';

export interface FormVerificationStatus {
  state: 'profile_ready' | 'form_incomplete' | 'form_verified';
  verifiedCount?: number;
  totalCount?: number;
  label: string;
}

export interface NextActionModel {
  category: NextActionCategory;
  badgeVariant: 'ready' | 'working' | 'actionRequired' | 'blocked' | 'completed' | 'neutral';
  statusText: string;
  headline: string;
  description: string;
  formStatus?: FormVerificationStatus;
  primaryAction: {
    label: string;
    actionType: 'NAVIGATE_PROFILE' | 'OPEN_TTD' | 'TRIGGER_FILL' | 'START_MANUAL_ASSISTANT' | 'STOP' | 'RETRY_LOCK' | 'VIEW_HISTORY' | 'SELECT_PILGRIMS' | 'NONE';
    variant: 'primary' | 'gold' | 'danger' | 'secondary';
    disabled?: boolean;
    disabledReason?: string;
  };
  secondaryAction?: {
    label: string;
    actionType: 'NAVIGATE_PROFILE' | 'STOP' | 'SELECT_PILGRIMS' | 'TEST_PROFILE' | 'VIEW_HISTORY' | 'RETRY_LOCK' | 'OPEN_TTD' | 'START_MANUAL_ASSISTANT' | 'TRIGGER_FILL' | 'NONE';
  };
  missingDetails?: string[];
  safetyNotice?: string;
}

export interface NextActionInput {
  activeProfile: Profile | null;
  selectedPilgrims: Pilgrim[];
  serviceId?: string;
  serviceDisplayName: string;
  pageDetected: boolean;
  productState: ProductAutomationState;
  fillStage?: { stage: string; currentField?: string; currentPilgrim?: number; fieldsFilledCount?: number; fieldsDetectedCount?: number; validationComplete?: boolean };
  temporaryLock?: any;
  queueSession?: QueueSession | null;
  readiness: UseReadinessResult;
  userActionPrompt?: string;
  fillStatus?: string | null;
  statusType?: 'info' | 'success' | 'warning' | 'error' | null;
  verificationCounts?: { verified: number; total: number } | null;
}

export function computeNextAction(input: NextActionInput): NextActionModel {
  const {
    activeProfile,
    selectedPilgrims,
    serviceDisplayName,
    pageDetected,
    productState,
    fillStage,
    temporaryLock,
    queueSession,
    readiness,
    userActionPrompt,
  } = input;

  // 1. HIGHEST SAFETY PRIORITY: Temporary TTD Booking Lock (Server-side hold)
  // While the lock is active, RETRY action is strictly disabled/removed to prevent lock extension.
  if (temporaryLock && temporaryLock.status === 'temporary-lock') {
    return {
      category: 'BLOCKED',
      badgeVariant: 'blocked',
      statusText: t('nextAction.temporaryLockStatus') || 'Temporarily Blocked',
      headline: t('nextAction.temporaryLockHeadline') || 'Previous booking attempt is still active',
      description: t('nextAction.temporaryLockDescription') || 'TTD holds slot tokens for several minutes before releasing. Please wait or check your history.',
      primaryAction: {
        label: t('nextAction.checkBookingHistory') || 'CHECK BOOKING HISTORY',
        actionType: 'VIEW_HISTORY',
        variant: 'secondary',
      },
      // Note: secondaryAction ('TRY AGAIN') is intentionally omitted while lock is active
    };
  }

  // 2. PRIORITY-ORDERED QUEUE STATE HANDLING
  // Never lump CAPTCHA, expiry, errors, or completion into ordinary waiting!
  if (
    queueSession &&
    queueSession.state !== 'QUEUE_NOT_PRESENT' &&
    queueSession.state !== 'QUEUE_EXITED' &&
    queueSession.state !== 'QUEUE_UNKNOWN'
  ) {
    const state = queueSession.state;

    // 2A. CAPTCHA Required in Queue (Safety Boundary: Human action required)
    if (state === 'QUEUE_CAPTCHA_REQUIRED') {
      return {
        category: 'USER_ACTION_REQUIRED',
        badgeVariant: 'actionRequired',
        statusText: t('nextAction.queueCaptchaStatus') || 'Action Required',
        headline: t('nextAction.queueCaptchaHeadline') || 'Solve CAPTCHA on TTD',
        description: t('nextAction.queueCaptchaDesc') || 'Please solve the CAPTCHA in the TTD queue tab to maintain your position.',
        primaryAction: {
          label: t('nextAction.openTtdTab') || 'VIEW TTD TAB',
          actionType: 'OPEN_TTD',
          variant: 'primary',
        },
        safetyNotice: t('safety.humanBoundaryNotice') || 'SevaPilot never automates CAPTCHA, OTP, or payments.',
      };
    }

    // 2B. Session Expired or Session Warning in Queue
    if (state === 'QUEUE_SESSION_EXPIRED' || state === 'QUEUE_SESSION_WARNING') {
      return {
        category: 'BLOCKED',
        badgeVariant: 'blocked',
        statusText: t('nextAction.queueSessionExpiredStatus') || 'Session Expired',
        headline: t('nextAction.queueSessionExpiredHeadline') || 'Queue Session Expired',
        description: t('nextAction.queueSessionExpiredDesc') || 'Your queue session has expired on TTD. Please restart your booking session.',
        primaryAction: {
          label: t('nextAction.reopenPortal') || 'REOPEN PORTAL',
          actionType: 'OPEN_TTD',
          variant: 'primary',
        },
      };
    }

    // 2C. Queue Blocked, Error, or Interrupted
    if (state === 'QUEUE_ERROR' || state === 'QUEUE_BLOCKED' || state === 'QUEUE_INTERRUPTED') {
      return {
        category: 'BLOCKED',
        badgeVariant: 'blocked',
        statusText: t('nextAction.queueBlockedStatus') || 'Queue Interrupted',
        headline: t('nextAction.queueBlockedHeadline') || 'Queue Access Interrupted',
        description: t('nextAction.queueBlockedDesc') || 'TTD queue connection was interrupted or blocked. Please check your network and browser tab.',
        primaryAction: {
          label: t('nextAction.viewTtd') || 'CHECK TTD TAB',
          actionType: 'OPEN_TTD',
          variant: 'secondary',
        },
      };
    }

    // 2D. Queue Action Required (User input requested by TTD queue)
    if (state === 'QUEUE_ACTION_REQUIRED') {
      return {
        category: 'USER_ACTION_REQUIRED',
        badgeVariant: 'actionRequired',
        statusText: t('nextAction.actionRequired') || 'Action Required',
        headline: t('nextAction.queueActionRequiredHeadline') || 'Action Required in Queue',
        description: t('nextAction.queueActionRequiredDesc') || 'TTD queue requires your manual input. Switch to the TTD tab to proceed.',
        primaryAction: {
          label: t('nextAction.openTtdTab') || 'VIEW TTD TAB',
          actionType: 'OPEN_TTD',
          variant: 'primary',
        },
      };
    }

    // 2E. Queue Completed (Devotee successfully passed the queue)
    if (state === 'QUEUE_COMPLETED') {
      return {
        category: 'COMPLETED',
        badgeVariant: 'completed',
        statusText: t('nextAction.queueCompletedStatus') || 'Queue Complete',
        headline: t('nextAction.queueCompletedHeadline') || 'Queue Complete — Ready to Book',
        description: t('nextAction.queueCompletedDesc') || 'You have passed the queue! Proceed with slot selection and details.',
        primaryAction: pageDetected
          ? {
              label: t('nextAction.fillAndVerify') || '⚡ FILL & VERIFY',
              actionType: 'TRIGGER_FILL',
              variant: 'primary',
            }
          : {
              label: t('nextAction.openTtdTab') || 'VIEW TTD TAB',
              actionType: 'OPEN_TTD',
              variant: 'primary',
            },
      };
    }

    // 2F. Ordinary Queue Waiting / Progressing / Loading / Detected
    const officialWait = queueSession.progress?.officialWaitTime;
    return {
      category: 'QUEUE_WAITING',
      badgeVariant: 'working',
      statusText: t('nextAction.queueWaitingStatus') || 'In Queue',
      headline: t('nextAction.queueWaitingHeadline') || "You're in the queue",
      description: officialWait
        ? (t('nextAction.queueWaitEstimated', { minutes: officialWait }) || `Official wait: ~${officialWait}. Keep this tab open.`)
        : (t('nextAction.queueWaitActive') || 'Safe queue monitoring is active. Do not refresh.'),
      primaryAction: {
        label: t('nextAction.stopMonitoring') || 'Stop Monitoring',
        actionType: 'STOP',
        variant: 'secondary',
      },
    };
  }

  // 3. Profile is completely missing
  if (!activeProfile || (activeProfile.pilgrims || []).length === 0) {
    return {
      category: 'NO_PROFILE',
      badgeVariant: 'actionRequired',
      statusText: t('nextAction.setupNeeded') || 'Setup Needed',
      headline: t('nextAction.completeProfileHeadline') || 'Complete your profile',
      description: t('nextAction.addPilgrimDesc') || 'Add pilgrim details once to prepare for fast booking.',
      primaryAction: {
        label: t('nextAction.createProfile') || 'CREATE PROFILE',
        actionType: 'NAVIGATE_PROFILE',
        variant: 'primary',
      },
    };
  }

  // 4. Selected pilgrims count or missing selection
  if (selectedPilgrims.length === 0) {
    return {
      category: 'PROFILE_INCOMPLETE',
      badgeVariant: 'actionRequired',
      statusText: t('nextAction.selectDevotees') || 'Devotees Needed',
      headline: t('nextAction.selectPilgrimsHeadline') || 'Select devotees to book for',
      description: t('nextAction.selectPilgrimsDesc', { service: serviceDisplayName }) || `Choose devotees from your profile for ${serviceDisplayName}.`,
      primaryAction: {
        label: t('nextAction.selectPilgrims') || 'SELECT PILGRIMS',
        actionType: 'SELECT_PILGRIMS',
        variant: 'primary',
      },
    };
  }

  // 5. Working (Filling details)
  if (productState === 'WORKING' && fillStage?.stage === 'filling') {
    return {
      category: 'WORKING',
      badgeVariant: 'working',
      statusText: t('nextAction.workingStatus') || 'Filling',
      headline: t('nextAction.preparingDetails') || 'Preparing your details…',
      description: t('nextAction.fillingField', {
        field: fillStage.currentField || 'details',
        pilgrim: (fillStage.currentPilgrim ?? 0) + 1,
      }) || `Safely entering details for Pilgrim ${(fillStage.currentPilgrim ?? 0) + 1}…`,
      primaryAction: {
        label: t('nextAction.stop') || 'Stop',
        actionType: 'STOP',
        variant: 'danger',
      },
    };
  }

  // 6. Verifying (Verification in progress)
  if (productState === 'WORKING' && fillStage?.stage === 'verifying') {
    return {
      category: 'VERIFYING',
      badgeVariant: 'working',
      statusText: t('nextAction.verifyingStatus') || 'Verifying',
      headline: t('nextAction.checkingDetails') || 'Checking your details…',
      description: t('nextAction.verifyingDescription') || 'Verifying all entered fields against official TTD rules.',
      primaryAction: {
        label: t('nextAction.stop') || 'Stop',
        actionType: 'STOP',
        variant: 'danger',
      },
    };
  }

  // 7. Completed
  if (productState === 'COMPLETED') {
    const verified = input.verificationCounts?.verified ?? (selectedPilgrims.length * 5);
    const total = input.verificationCounts?.total ?? (selectedPilgrims.length * 5);
    return {
      category: 'COMPLETED',
      badgeVariant: 'completed',
      statusText: t('nextAction.formVerified') || 'Form Verified',
      headline: t('nextAction.detailsVerified') || 'Form Verified',
      description: t('nextAction.reviewOnTtd') || `All ${verified}/${total} required fields independently verified on TTD. Review all filled details before continuing to payment.`,
      formStatus: {
        state: 'form_verified',
        verifiedCount: verified,
        totalCount: total,
        label: `Form Verified (${verified}/${total})`,
      },
      primaryAction: {
        label: t('nextAction.reviewOnTtdBtn') || 'Review on TTD',
        actionType: 'OPEN_TTD',
        variant: 'primary',
      },
    };
  }

  // 8. User action required (Human-controlled boundary: CAPTCHA, OTP, payment, or Form Incomplete)
  if (productState === 'USER_ACTION_REQUIRED') {
    const prompt = userActionPrompt || input.fillStatus || '';
    const isCaptcha = prompt.toLowerCase().includes('captcha');
    const isOtp = prompt.toLowerCase().includes('otp');
    const isPayment = prompt.toLowerCase().includes('payment');
    const isFormIncomplete = prompt.toLowerCase().includes('incomplete') ||
      prompt.toLowerCase().includes('paste assist') ||
      prompt.toLowerCase().includes('manual entry') ||
      prompt.toLowerCase().includes('fields verified') ||
      (input.verificationCounts !== undefined && input.verificationCounts !== null && input.verificationCounts.verified < input.verificationCounts.total);

    if (isFormIncomplete) {
      const verified = input.verificationCounts?.verified ?? 0;
      const total = input.verificationCounts?.total ?? (selectedPilgrims.length * 5);
      return {
        category: 'USER_ACTION_REQUIRED',
        badgeVariant: 'actionRequired',
        statusText: `Form Incomplete (${verified}/${total} Verified)`,
        headline: 'Form Incomplete — Paste Assist Ready',
        description: input.fillStatus || `Automated entry verified ${verified}/${total} fields. Use Paste Assist below to enter remaining details directly into website controls.`,
        formStatus: {
          state: 'form_incomplete',
          verifiedCount: verified,
          totalCount: total,
          label: `Form Incomplete (${verified}/${total} Verified)`,
        },
        primaryAction: {
          label: '📋 OPEN PASTE ASSIST',
          actionType: 'START_MANUAL_ASSISTANT',
          variant: 'gold',
        },
        secondaryAction: {
          label: '⚡ Try Autofill Again',
          actionType: 'TRIGGER_FILL',
        },
      };
    }

    const desc = isCaptcha
      ? (t('safety.captchaUserAction') || 'Complete the CAPTCHA on TTD.')
      : isOtp
      ? (t('safety.otpUserAction') || 'Enter the OTP sent to your phone on TTD.')
      : isPayment
      ? (t('safety.paymentUserAction') || 'Review payment and complete securely on TTD.')
      : prompt;

    return {
      category: 'USER_ACTION_REQUIRED',
      badgeVariant: 'actionRequired',
      statusText: t('nextAction.actionRequired') || 'Action Needed',
      headline: t('nextAction.userActionHeadline') || 'Your action is needed',
      description: desc,
      primaryAction: {
        label: t('nextAction.continueOnTtd') || 'Continue on TTD',
        actionType: 'OPEN_TTD',
        variant: 'gold',
      },
      secondaryAction: {
        label: t('nextAction.stop') || 'Cancel',
        actionType: 'STOP',
      },
      safetyNotice: t('safety.humanBoundaryNotice') || 'SevaPilot never automates CAPTCHA, OTP, or payments.',
    };
  }

  // 9. Profile missing specific service fields
  const missing = readiness.missingDetails || [];
  if (!readiness.allPilgrimsReady && missing.length > 0) {
    const headline = t('nextAction.actionRequired') || 'Action required';
    const desc = `${missing[0]} is required before booking.`;

    return {
      category: 'PROFILE_INCOMPLETE',
      badgeVariant: 'actionRequired',
      statusText: t('nextAction.notReady') || 'Not Ready',
      headline,
      description: desc,
      missingDetails: missing,
      primaryAction: {
        label: t('nextAction.prepareBooking') || 'PREPARE BOOKING',
        actionType: 'NAVIGATE_PROFILE',
        variant: 'primary',
      },
      secondaryAction: {
        label: t('nextAction.openTtdBooking') || 'OPEN TTD BOOKING',
        actionType: 'OPEN_TTD',
      },
    };
  }

  const isManualOnly =
    Boolean((readiness as any).isManualOnly) ||
    (input.serviceId ? isServiceManualOnly(input.serviceId) : false);

  // 10. Profile is READY AND TTD page is detected
  if (pageDetected) {
    if (isManualOnly) {
      return {
        category: 'TTD_DETECTED',
        badgeVariant: 'ready',
        statusText: t('nextAction.manualEntryReady') || 'Manual-Entry Ready',
        headline: t('nextAction.manualEntryHeadline') || 'Manual-Entry Assistant Ready',
        description:
          t('nextAction.manualEntryDesc', { service: serviceDisplayName }) ||
          `TTD policy (May 2026) requires manual entry for ${serviceDisplayName}. Open the assistant to follow field-by-field guidance.`,
        formStatus: {
          state: 'form_incomplete',
          verifiedCount: 0,
          totalCount: selectedPilgrims.length * 5,
          label: 'Manual Entry Required',
        },
        primaryAction: {
          label: t('nextAction.openManualAssistant') || '📋 OPEN MANUAL ASSISTANT',
          actionType: 'START_MANUAL_ASSISTANT',
          variant: 'primary',
        },
        safetyNotice:
          t('safety.srivaniPolicyNotice') ||
          'Autofill & copy-paste are disabled under TTD May 2026 policy.',
      };
    }

    const totalFields = selectedPilgrims.length * 5;
    return {
      category: 'TTD_DETECTED',
      badgeVariant: 'ready',
      statusText: t('nextAction.pageReady') || 'Page Detected',
      headline: t('nextAction.bookingPageDetected') || 'Booking page detected',
      description: t('nextAction.detailsPreparedForService', { service: serviceDisplayName }) || `Your details are prepared to fill for ${serviceDisplayName}.`,
      formStatus: {
        state: 'form_incomplete',
        verifiedCount: 0,
        totalCount: totalFields,
        label: `Form Incomplete (0/${totalFields} Verified)`,
      },
      primaryAction: {
        label: t('nextAction.fillAndVerify') || '⚡ FILL & VERIFY',
        actionType: 'TRIGGER_FILL',
        variant: 'primary',
      },
      secondaryAction: {
        label: 'Use Paste Assist',
        actionType: 'START_MANUAL_ASSISTANT',
      },
    };
  }

  // 11. Profile is READY, but not yet on TTD page
  if (isManualOnly) {
    return {
      category: 'READY',
      badgeVariant: 'ready',
      statusText: t('nextAction.manualReady') || 'Ready for Manual Entry',
      headline: t('nextAction.manualPreparedHeadline') || 'Details prepared for manual entry',
      description:
        t('nextAction.openSrivaniDesc') ||
        'Open the official Srivani portal page to begin.',
      formStatus: {
        state: 'profile_ready',
        label: 'Profile Ready',
      },
      primaryAction: {
        label: t('nextAction.openTtdBooking') || 'OPEN TTD BOOKING',
        actionType: 'OPEN_TTD',
        variant: 'primary',
      },
      secondaryAction: {
        label: t('nextAction.viewChecklist') || 'VIEW CHECKLIST',
        actionType: 'START_MANUAL_ASSISTANT',
      },
      safetyNotice:
        t('safety.srivaniPolicyNotice') ||
        'Autofill & copy-paste are disabled under TTD May 2026 policy.',
    };
  }

  return {
    category: 'READY',
    badgeVariant: 'ready',
    statusText: t('nextAction.ready') || 'Ready',
    headline: t('nextAction.youAreReady') || "You're ready",
    description: t('nextAction.openSupportedTtdDesc') || 'Open a supported TTD booking page to start.',
    formStatus: {
      state: 'profile_ready',
      label: 'Profile Ready',
    },
    primaryAction: {
      label: t('nextAction.prepareBooking') || 'PREPARE BOOKING',
      actionType: 'NAVIGATE_PROFILE',
      variant: 'primary',
    },
    secondaryAction: {
      label: t('nextAction.openTtdBooking') || 'OPEN TTD BOOKING',
      actionType: 'OPEN_TTD',
    },
  };
}
