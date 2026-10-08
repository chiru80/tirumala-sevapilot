/**
 * Tirumala SevaPilot — Next Action Presentation Engine (Phase 13)
 * Pure, authoritative UX presentation mapper.
 * Translates low-level engineering states into ONE clear user-facing Next Action.
 * Strictly never exposes technical state names (FIELD_RESOLUTION, DOM_REPLACED, etc.).
 */

import type { Profile, Pilgrim } from '@shared/types';
import type { UseReadinessResult } from '../hooks/useReadiness';
import type { ProductAutomationState } from '../../content/automation/types';
import type { QueueSession } from '../../services/queue';
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

export interface NextActionModel {
  category: NextActionCategory;
  badgeVariant: 'ready' | 'working' | 'actionRequired' | 'blocked' | 'completed' | 'neutral';
  statusText: string;
  headline: string;
  description: string;
  primaryAction: {
    label: string;
    actionType: 'NAVIGATE_PROFILE' | 'OPEN_TTD' | 'TRIGGER_FILL' | 'STOP' | 'RETRY_LOCK' | 'VIEW_HISTORY' | 'SELECT_PILGRIMS' | 'NONE';
    variant: 'primary' | 'gold' | 'danger' | 'secondary';
    disabled?: boolean;
    disabledReason?: string;
  };
  secondaryAction?: {
    label: string;
    actionType: 'NAVIGATE_PROFILE' | 'STOP' | 'SELECT_PILGRIMS' | 'TEST_PROFILE' | 'VIEW_HISTORY' | 'RETRY_LOCK' | 'OPEN_TTD' | 'NONE';
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
  fillStage?: { stage: string; currentField?: string; currentPilgrim?: number };
  temporaryLock?: any;
  queueSession?: QueueSession | null;
  readiness: UseReadinessResult;
  userActionPrompt?: string;
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

  // 1. Digital Queue active state
  if (
    queueSession &&
    queueSession.state !== 'QUEUE_NOT_PRESENT' &&
    queueSession.state !== 'QUEUE_EXITED' &&
    queueSession.state !== 'QUEUE_UNKNOWN'
  ) {
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

  // 2. Temporary TTD Booking Lock (Server-side hold)
  if (temporaryLock && temporaryLock.status === 'temporary-lock') {
    return {
      category: 'BLOCKED',
      badgeVariant: 'blocked',
      statusText: t('nextAction.temporaryLockStatus') || 'Temporarily Blocked',
      headline: t('nextAction.temporaryLockHeadline') || 'Previous booking attempt is still active',
      description: t('nextAction.temporaryLockDescription') || 'TTD holds slot tokens for several minutes before releasing. Please wait or check your history.',
      primaryAction: {
        label: 'CHECK BOOKING HISTORY',
        actionType: 'VIEW_HISTORY',
        variant: 'secondary',
      },
      secondaryAction: {
        label: 'TRY AGAIN',
        actionType: 'RETRY_LOCK',
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
        label: 'CREATE PROFILE',
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
        label: 'SELECT PILGRIMS',
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
    return {
      category: 'COMPLETED',
      badgeVariant: 'completed',
      statusText: t('nextAction.completedStatus') || 'Verified',
      headline: t('nextAction.detailsVerified') || 'Details verified',
      description: t('nextAction.reviewOnTtd') || 'Review all filled details on TTD before continuing to the next step.',
      primaryAction: {
        label: t('nextAction.reviewOnTtdBtn') || 'Review on TTD',
        actionType: 'OPEN_TTD',
        variant: 'primary',
      },
    };
  }

  // 8. User action required (Human-controlled boundary: CAPTCHA, OTP, payment)
  if (productState === 'USER_ACTION_REQUIRED' && userActionPrompt) {
    const isCaptcha = userActionPrompt.toLowerCase().includes('captcha');
    const isOtp = userActionPrompt.toLowerCase().includes('otp');
    const isPayment = userActionPrompt.toLowerCase().includes('payment');

    const desc = isCaptcha
      ? (t('safety.captchaUserAction') || 'Complete the CAPTCHA on TTD.')
      : isOtp
      ? (t('safety.otpUserAction') || 'Enter the OTP sent to your phone on TTD.')
      : isPayment
      ? (t('safety.paymentUserAction') || 'Review payment and complete securely on TTD.')
      : userActionPrompt;

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

  // 9. Profile missing specific service fields (excluding the 'ttd-page' check)
  const missing = readiness.missingDetails || [];
  if (!readiness.allPilgrimsReady && missing.length > 0) {
    const count = missing.length;
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
        label: 'PREPARE BOOKING',
        actionType: 'NAVIGATE_PROFILE',
        variant: 'primary',
      },
      secondaryAction: {
        label: 'OPEN TTD BOOKING',
        actionType: 'OPEN_TTD',
      },
    };
  }

  // 10. Profile is READY AND TTD page is detected
  if (pageDetected) {
    return {
      category: 'TTD_DETECTED',
      badgeVariant: 'ready',
      statusText: t('nextAction.pageReady') || 'Page Detected',
      headline: t('nextAction.bookingPageDetected') || 'Booking page detected',
      description: `Your details are prepared to fill for ${serviceDisplayName}.`,
      primaryAction: {
        label: '⚡ FILL & VERIFY',
        actionType: 'TRIGGER_FILL',
        variant: 'primary',
      },
    };
  }

  // 11. Profile is READY, but not yet on TTD page
  return {
    category: 'READY',
    badgeVariant: 'ready',
    statusText: t('nextAction.ready') || 'Ready',
    headline: t('nextAction.youAreReady') || "You're ready",
    description: 'Open a supported TTD booking page to start.',
    primaryAction: {
      label: 'PREPARE BOOKING',
      actionType: 'NAVIGATE_PROFILE',
      variant: 'primary',
    },
    secondaryAction: {
      label: 'OPEN TTD BOOKING',
      actionType: 'OPEN_TTD',
    },
  };
}
