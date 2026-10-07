// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Cockpit Context Hook (Phase 2)
// Thin UI Adapter Hook strictly consuming Phase 1 Canonical Readiness
// and Registry. Encapsulates CTA priority logic and service metadata
// without duplicating underlying domain business logic.
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim, ScanResult, TtdTemporaryLockState } from '@shared/types';
import { t } from '@i18n/index';
import { getCanonicalService } from '../../services/canonical-service-registry';
import { getWorkflowById } from '../../services/workflows/registry';
import type { UseReadinessResult } from './useReadiness';
import type { DashboardContextState } from '../components/dashboard/PrimaryAction';

export type BookingCockpitState =
  | 'TEMPORARY_LOCK'
  | 'FIRST_TIME'
  | 'FILLING'
  | 'REVIEW_READY'
  | 'ACTION_REQUIRED'
  | 'READY'
  | 'NO_TTD_PAGE'
  | 'UNKNOWN';

export interface BookingServiceInfo {
  serviceId?: string;
  serviceName: string;
  displayName: string;
  ticketPrice?: number;
  maxPilgrims?: number;
  exactPilgrims?: number;
  hasGeneralDetailsStep: boolean;
}

export interface BookingPrimaryAction {
  label: string;
  supportingText?: string;
  onClick: () => Promise<void> | void;
  isDisabled: boolean;
  isEmergencyStoppable: boolean;
  onStop?: () => void;
  secondary?: {
    label: string;
    onClick: () => void;
  };
}

export interface BookingStatusBadge {
  type: 'ready' | 'warning' | 'lock' | 'neutral';
  label: string;
  headline: string;
}

export interface UseBookingContextParams {
  activeProfile: Profile | null;
  selectedPilgrims: Pilgrim[];
  serviceType: ServiceType;
  serviceId?: string;
  pageDetected: boolean;
  scanResult: ScanResult | null;
  workflowId?: string;
  readiness: UseReadinessResult;
  isFilling: boolean;
  fillStage: { stage: string; error?: string };
  pilgrimReports: any[];
  temporaryLock: TtdTemporaryLockState | null;
  onNavigate?: (page: string) => void;
  openTtdWebsite: () => void;
  handlePrimaryAction: () => Promise<void> | void;
  handleEmergencyStop: () => void;
  handleRetryAfterLock: () => Promise<void>;
  handleCheckBookingHistory: () => Promise<void> | void;
  selectAllPilgrims: (serviceId?: string) => Promise<void> | void;
}

export interface UseBookingContextResult {
  state: BookingCockpitState;
  contextState: DashboardContextState;
  serviceInfo: BookingServiceInfo;
  primaryAction: BookingPrimaryAction;
  statusBadge: BookingStatusBadge;
  isFirstTime: boolean;
  isLocked: boolean;
  isReady: boolean;
  isFilling: boolean;
  isComplete: boolean;
  allVerified: boolean;
}

export function useBookingContext(params: UseBookingContextParams): UseBookingContextResult {
  const {
    activeProfile,
    selectedPilgrims,
    serviceType,
    serviceId,
    pageDetected,
    scanResult,
    workflowId,
    readiness,
    isFilling,
    fillStage,
    pilgrimReports,
    temporaryLock,
    onNavigate,
    openTtdWebsite,
    handlePrimaryAction,
    handleEmergencyStop,
    handleRetryAfterLock,
    handleCheckBookingHistory,
    selectAllPilgrims,
  } = params;

  return useMemo(() => {
    // 1. Authoritative Service Metadata Resolution
    const effectiveServiceId = serviceId || scanResult?.serviceId;
    const canonicalDef = effectiveServiceId ? getCanonicalService(effectiveServiceId) : undefined;
    const workflow = effectiveServiceId
      ? getWorkflowById(effectiveServiceId)
      : getWorkflowById(serviceType as string);

    const serviceInfo: BookingServiceInfo = {
      serviceId: canonicalDef?.serviceId || effectiveServiceId,
      serviceName: canonicalDef?.serviceName || workflow?.serviceName || (serviceType ? String(serviceType) : 'TTD Booking'),
      displayName: canonicalDef?.displayName || workflow?.serviceName || 'Special Entry Darshan',
      ticketPrice: canonicalDef?.ticketPrice,
      maxPilgrims: canonicalDef?.maxPilgrims || workflow?.maxPilgrims,
      exactPilgrims: canonicalDef?.exactPilgrims || workflow?.exactPilgrims,
      hasGeneralDetailsStep: canonicalDef?.hasGeneralDetailsStep ?? true,
    };

    // 2. Flags & Completion State
    const allVerified = pilgrimReports.length > 0 && pilgrimReports.every(p => p.allValidated);
    const isComplete = fillStage.stage === 'complete' && pilgrimReports.length > 0;
    const isLocked = Boolean(temporaryLock && (temporaryLock.status === 'temporary-lock' || (temporaryLock as any).isLocked));
    const isFirstTime = !activeProfile || !activeProfile.pilgrims || activeProfile.pilgrims.length === 0;

    // 3. Strict CTA & Cockpit State Priority Order
    let state: BookingCockpitState;
    let contextState: DashboardContextState;
    let actionLabel: string;
    let supportingText: string | undefined;
    let onClick: () => Promise<void> | void = handlePrimaryAction;
    let secondary: { label: string; onClick: () => void } | undefined = undefined;
    let statusBadge: BookingStatusBadge;
    let isDisabled = false;

    // Priority 1: Temporary TTD Lock (Highest priority - hold active on server)
    if (isLocked) {
      state = 'TEMPORARY_LOCK';
      contextState = 'TEMPORARY_TTD_LOCK';
      actionLabel = t('home.tryAgain') || 'TRY AGAIN';
      supportingText =
        t('home.temporaryLockDesc') ||
        'Your previous booking attempt is still active. TTD usually releases the lock after a few minutes.';
      onClick = handleRetryAfterLock;
      secondary = {
        label: t('home.checkBookingHistory') || 'CHECK BOOKING HISTORY',
        onClick: handleCheckBookingHistory,
      };
      statusBadge = {
        type: 'lock',
        label: t('home.temporaryLock') || 'Temporary TTD lock',
        headline: 'Server-side hold active',
      };
    }
    // Priority 2: First-time User (No profile or 0 pilgrims created)
    else if (isFirstTime) {
      state = 'FIRST_TIME';
      contextState = 'FIRST_TIME_USER';
      actionLabel = t('home.createProfile') || 'CREATE PROFILE';
      supportingText =
        t('home.welcomeHeroSubtitle') ||
        'Save your pilgrim details once and prepare your booking faster.';
      onClick = () => onNavigate?.('profiles');
      secondary = {
        label: t('home.learnHowItWorks') || 'Learn how it works',
        onClick: () => {
          const el = document.getElementById('sp-how-it-works-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        },
      };
      statusBadge = {
        type: 'neutral',
        label: t('home.noProfileYet') || 'No profile yet',
        headline: 'Create profile to begin',
      };
    }
    // Priority 3: Filling in Progress
    else if (isFilling) {
      state = 'FILLING';
      contextState = 'FILLING';
      actionLabel = t('dashboard.fillingAndVerifying') || 'FILLING…';
      supportingText = t('dashboard.reviewNotice') || 'Filling and verifying details safely.';
      onClick = () => {};
      statusBadge = {
        type: 'neutral',
        label: t('dashboard.fillingAndVerifying') || 'Filling…',
        headline: 'Autofill session active',
      };
    }
    // Priority 4: Complete & Verified
    else if (isComplete && allVerified) {
      state = 'REVIEW_READY';
      contextState = 'READY_FOR_REVIEW';
      actionLabel = t('home.readyForReview') || '✓ READY FOR REVIEW';
      supportingText =
        t('home.readyForReviewDesc') ||
        'Your details have been filled and verified. Review before you submit.';
      onClick = handlePrimaryAction;
      statusBadge = {
        type: 'ready',
        label: t('home.ready') || 'Verified',
        headline: 'Details verified on form',
      };
    }
    // Priority 5: Complete but has unverified fields (Repair mode)
    else if (isComplete && !allVerified) {
      state = 'ACTION_REQUIRED';
      contextState = 'ACTION_REQUIRED';
      actionLabel = t('dashboard.repairMissingFields') || 'REPAIR MISSING FIELDS';
      supportingText =
        t('dashboard.detailsNeedAttention') ||
        'Some fields could not be verified automatically.';
      onClick = handlePrimaryAction;
      statusBadge = {
        type: 'warning',
        label: t('home.actionRequired') || 'Action required',
        headline: 'Missing fields need repair',
      };
    }
    // Priority 6: TTD Page Detected + Action Required / Ready
    else if (pageDetected) {
      if (selectedPilgrims.length === 0) {
        state = 'ACTION_REQUIRED';
        contextState = 'ACTION_REQUIRED';
        actionLabel = t('dashboard.selectPilgrims') || 'SELECT PILGRIMS';
        supportingText = t('home.selectPilgrimsPrompt') || 'Select at least one pilgrim.';
        onClick = () => {
          if (activeProfile?.pilgrims && activeProfile.pilgrims.length > 0) {
            selectAllPilgrims(effectiveServiceId || serviceType);
          } else {
            onNavigate?.('profiles');
          }
        };
        statusBadge = {
          type: 'warning',
          label: t('home.actionRequired') || 'Action required',
          headline: 'Select traveling pilgrims',
        };
      } else if (!readiness.allPilgrimsReady) {
        state = 'ACTION_REQUIRED';
        contextState = 'ACTION_REQUIRED';
        actionLabel = t('dashboard.fixProfile') || 'COMPLETE PROFILE';
        supportingText = t('home.completeIdPrompt') || "Complete your pilgrim's ID details.";
        onClick = () => onNavigate?.('profiles');
        statusBadge = {
          type: 'warning',
          label: t('home.actionRequired') || 'Action required',
          headline: 'Incomplete pilgrim details',
        };
      } else if (!readiness.hasValidGeneralContact) {
        state = 'ACTION_REQUIRED';
        contextState = 'ACTION_REQUIRED';
        actionLabel = t('dashboard.completeGeneralDetails') || 'COMPLETE PROFILE';
        supportingText = t('home.completeGeneralPrompt') || 'Complete general contact details.';
        onClick = () => onNavigate?.('profiles');
        statusBadge = {
          type: 'warning',
          label: t('home.actionRequired') || 'Action required',
          headline: 'Contact details needed',
        };
      } else if (readiness.isReady) {
        state = 'READY';
        contextState = 'TTD_PAGE_READY';
        actionLabel = t('dashboard.fillAndVerify') || '⚡ FILL & VERIFY';
        supportingText = t('home.readySupporting') || 'Your selected pilgrim details are ready.';
        onClick = handlePrimaryAction;
        statusBadge = {
          type: 'ready',
          label: t('home.readyToFill') || 'Ready to fill',
          headline: 'Form connected and verified',
        };
      } else {
        state = 'ACTION_REQUIRED';
        contextState = 'ACTION_REQUIRED';
        actionLabel = t('home.actionRequired') || 'COMPLETE PROFILE';
        supportingText = readiness.userAction || t('home.actionRequired');
        onClick = () => onNavigate?.('profiles');
        statusBadge = {
          type: 'warning',
          label: t('home.actionRequired') || 'Action required',
          headline: 'Check profile details',
        };
      }
    }
    // Priority 7: No TTD Page Detected + Profile Ready (Devotee preparation phase)
    else if (activeProfile && activeProfile.pilgrims && activeProfile.pilgrims.length > 0) {
      state = 'NO_TTD_PAGE';
      contextState = 'NO_TTD_PAGE';
      actionLabel = t('home.prepareBooking') || 'PREPARE BOOKING';
      supportingText = t('home.openTtdSubtitle') || 'Open a supported TTD booking page to start.';
      onClick = () => onNavigate?.('profiles');
      secondary = {
        label: t('home.openTtd') || 'OPEN TTD BOOKING ↗',
        onClick: openTtdWebsite,
      };
      statusBadge = {
        type: 'neutral',
        label: t('home.ready') || 'Profile Ready',
        headline: 'Open TTD when booking opens',
      };
    }
    // Priority 8: No TTD Page / Unknown (Fallback)
    else {
      state = 'NO_TTD_PAGE';
      contextState = 'NO_TTD_PAGE';
      actionLabel = t('home.openTtd') || 'OPEN TTD BOOKING ↗';
      supportingText = t('home.openTtdSubtitle') || 'Open a supported TTD booking page to start.';
      onClick = openTtdWebsite;
      statusBadge = {
        type: 'neutral',
        label: t('dashboard.ttdPage') || 'TTD Portal',
        headline: 'Open official TTD portal',
      };
    }

    return {
      state,
      contextState,
      serviceInfo,
      primaryAction: {
        label: actionLabel,
        supportingText,
        onClick,
        isDisabled,
        isEmergencyStoppable: isFilling,
        onStop: isFilling ? handleEmergencyStop : undefined,
        secondary,
      },
      statusBadge,
      isFirstTime,
      isLocked,
      isReady: Boolean(readiness.isReady),
      isFilling,
      isComplete,
      allVerified,
    };
  }, [
    activeProfile,
    selectedPilgrims,
    serviceType,
    serviceId,
    pageDetected,
    scanResult,
    workflowId,
    readiness,
    isFilling,
    fillStage,
    pilgrimReports,
    temporaryLock,
    onNavigate,
    openTtdWebsite,
    handlePrimaryAction,
    handleEmergencyStop,
    handleRetryAfterLock,
    handleCheckBookingHistory,
    selectAllPilgrims,
  ]);
}
