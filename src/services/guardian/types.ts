// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Guardian Canonical Types (Phase 8)
// Production-grade Booking State Orchestration & Human Boundary Model
// ─────────────────────────────────────────────────────────────

import type { ServiceType, Pilgrim, Profile, TtdTemporaryLockState } from '@shared/types';
import type { AutofillManagerResult } from '../../content/autofill/types';

/** Canonical Booking Guardian Orchestration States */
export type GuardianState =
  | 'UNKNOWN'
  | 'TTD_PAGE_DETECTED'
  | 'SERVICE_DETECTED'
  | 'PROFILE_NOT_READY'
  | 'READY_TO_AUTOFILL'
  | 'AUTOFILLING'
  | 'VERIFYING'
  | 'AUTOFILL_COMPLETE'
  | 'USER_ACTION_REQUIRED'
  | 'CAPTCHA_REQUIRED'
  | 'OTP_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'SUBMISSION_READY'
  | 'SUBMISSION_MANUAL'
  | 'BOOKING_SUCCESS'
  | 'BOOKING_FAILED'
  | 'TTD_TEMPORARY_BOOKING_LOCK'
  | 'SESSION_EXPIRED'
  | 'PAGE_CHANGED'
  | 'BLOCKED';

/** Semantic TTD Page Stages */
export type GuardianPageStage =
  | 'UNKNOWN'
  | 'SERVICE_SELECTION'
  | 'SLOT_SELECTION'
  | 'GENERAL_DETAILS'
  | 'PILGRIM_DETAILS'
  | 'SRIVARI_INSTRUCTIONS'
  | 'SRIVARI_ENROLLMENT'
  | 'REVIEW'
  | 'CAPTCHA'
  | 'OTP'
  | 'PAYMENT'
  | 'SUCCESS'
  | 'ERROR'
  | 'LOCKED'
  | 'SESSION_EXPIRED';

/** Detailed Page Detection Evidence */
export interface PageDetectionResult {
  stage: GuardianPageStage;
  confidence: number;
  reasons: string[];
  url: string;
  hasInteractiveForm: boolean;
  isCaptchaPresent: boolean;
  isOtpPresent: boolean;
  isPaymentPresent: boolean;
  isReviewPresent: boolean;
  isSuccessPresent: boolean;
  isLocked: boolean;
  isSessionExpired: boolean;
  temporaryLock?: TtdTemporaryLockState;
}

/** Pre-flight Individual Check Result */
export interface GuardianPreflightCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** Comprehensive Pre-flight Evaluation */
export interface GuardianPreflightReport {
  isReady: boolean;
  checks: GuardianPreflightCheck[];
  errors: string[];
  warnings: string[];
  serviceId?: string;
  workflowId?: string;
  pilgrimCount: number;
}

/** Ephemeral, Bounded Booking Session */
export interface GuardianSession {
  sessionId: string;
  serviceId?: string;
  serviceName?: string;
  workflowId?: string;
  currentPageStage: GuardianPageStage;
  guardianState: GuardianState;
  selectedPilgrimCount: number;
  readinessScore: number;
  autofillStatus: 'IDLE' | 'STARTED' | 'IN_PROGRESS' | 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'STOPPED';
  userActionRequired: boolean;
  userActionReason?: string;
  lastVerifiedDomState?: {
    stage: GuardianPageStage;
    url: string;
    timestamp: number;
  };
  startedAt: number;
  updatedAt: number;
  preflightPassed: boolean;
  preflightErrors?: string[];
  lastAutofillResult?: AutofillManagerResult;
  temporaryLock?: TtdTemporaryLockState;
}

/** Zero-PII Diagnostic Notification Event */
export type GuardianNotificationType =
  | 'AUTOFILL_COMPLETE'
  | 'USER_ACTION_REQUIRED'
  | 'CAPTCHA_REQUIRED'
  | 'OTP_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'TEMPORARY_LOCK'
  | 'SESSION_EXPIRED'
  | 'BOOKING_SUCCESS'
  | 'BOOKING_FAILED';

export interface GuardianNotificationEvent {
  type: GuardianNotificationType;
  title: string;
  message: string;
  timestamp: number;
  sessionId?: string;
  serviceId?: string;
}
