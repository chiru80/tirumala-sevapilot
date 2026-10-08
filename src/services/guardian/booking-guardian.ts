// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Guardian Orchestration Engine (Phase 8)
// Central booking state orchestrator, preflight verification,
// and strict human-boundary handoff layer.
// ─────────────────────────────────────────────────────────────

import type { Pilgrim, Profile } from '@shared/types';
import logger from '@shared/logger';
import { resolveCanonicalService, getCanonicalService } from '../canonical-service-registry';
import { ReadinessEngine } from '../readiness-engine';
import { executeAutofill, requestStop } from '../../content/autofill/autofill-manager';
import { bookingSession } from '../../content/autofill/booking-session';
import type { AutofillManagerResult, AutofillOptions } from '../../content/autofill/types';
import { detectGuardianPageStage } from './page-detector';
import { executeGuardianPreflight } from './preflight-engine';
import type {
  GuardianState,
  GuardianPageStage,
  GuardianSession,
  PageDetectionResult,
  GuardianPreflightReport,
  GuardianNotificationEvent,
  GuardianNotificationType,
} from './types';

export class BookingGuardian {
  private currentSession: GuardianSession | null = null;
  private notificationSubscribers: Set<(event: GuardianNotificationEvent) => void> = new Set();
  private lastNotifiedState: GuardianState | null = null;

  /**
   * Evaluates the current TTD DOM and user booking state without executing writes.
   * Pure evaluation function.
   */
  public evaluateState(options: {
    doc?: Document;
    url?: string;
    profile?: Profile | null;
    selectedPilgrims?: Pilgrim[];
    explicitServiceId?: string;
  }): {
    guardianState: GuardianState;
    pageDetection: PageDetectionResult;
    preflight: GuardianPreflightReport;
    session: GuardianSession | null;
    serviceId?: string;
    serviceName?: string;
    actionMessage?: string;
  } {
    const doc = options.doc || document;
    const targetUrl = options.url || (doc as any)?.location?.href || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    const profile = options.profile || null;
    const selectedPilgrims = options.selectedPilgrims || [];

    // 1. Detect live page stage & boundaries
    const pageDetection = detectGuardianPageStage(doc, targetUrl);

    // 2. Identify canonical service
    let serviceResolution = options.explicitServiceId ? getCanonicalService(options.explicitServiceId) : undefined;
    if (!serviceResolution) {
      const canonicalMatch = resolveCanonicalService(targetUrl, doc);
      serviceResolution = canonicalMatch.service;
    }
    const serviceId = serviceResolution?.serviceId || options.explicitServiceId;
    const serviceName = serviceResolution?.displayName || serviceResolution?.serviceName;

    // 3. Run Preflight
    const preflight = executeGuardianPreflight({
      doc,
      url: targetUrl,
      pageDetection,
      serviceId,
      workflowId: serviceResolution?.workflowId,
      profile,
      selectedPilgrims,
    });

    // 4. Detect Page Change Transition
    if (this.currentSession && this.currentSession.lastVerifiedDomState) {
      const last = this.currentSession.lastVerifiedDomState;
      const urlChanged = last.url !== targetUrl;
      const stageChanged = last.stage !== pageDetection.stage;

      if ((urlChanged || stageChanged) && bookingSession.isRunning()) {
        logger.info(`[BookingGuardian] Page transitioned from ${last.stage} to ${pageDetection.stage}. Invalidating stale session.`);
        this.currentSession.guardianState = 'PAGE_CHANGED';
        this.emergencyStop('Page navigation detected during autofill');
      }
    }

    // 5. Determine State Machine State
    let guardianState: GuardianState = 'UNKNOWN';
    let actionMessage: string | undefined;

    if (pageDetection.isSessionExpired) {
      guardianState = 'SESSION_EXPIRED';
      actionMessage = 'Your TTD session has expired. Please log in again to continue.';
    } else if (pageDetection.isLocked) {
      guardianState = 'TTD_TEMPORARY_BOOKING_LOCK';
      actionMessage = pageDetection.temporaryLock?.message || 'TTD server is temporarily holding your previous booking attempt.';
    } else if (pageDetection.isSuccessPresent) {
      guardianState = 'BOOKING_SUCCESS';
      actionMessage = 'Booking confirmed successfully on official TTD portal.';
    } else if (pageDetection.isPaymentPresent) {
      guardianState = 'PAYMENT_REQUIRED';
      actionMessage = 'Payment gateway reached. Please complete payment manually.';
    } else if (pageDetection.isReviewPresent) {
      guardianState = 'REVIEW_REQUIRED';
      actionMessage = 'Review your details before continuing.';
    } else if (pageDetection.isCaptchaPresent) {
      guardianState = 'CAPTCHA_REQUIRED';
      actionMessage = 'Complete the CAPTCHA on TTD.';
    } else if (pageDetection.isOtpPresent) {
      guardianState = 'OTP_REQUIRED';
      actionMessage = 'Enter the OTP manually.';
    } else if (pageDetection.stage === 'DIGITAL_QUEUE') {
      guardianState = 'USER_ACTION_REQUIRED';
      const posText = pageDetection.queuePosition ? ` (Position: ${pageDetection.queuePosition})` : '';
      actionMessage = `TTD Digital Queue detected${posText}. Please wait in the virtual waiting room without refreshing.`;
    } else if (pageDetection.stage === 'SRIVARI_INSTRUCTIONS') {
      guardianState = 'USER_ACTION_REQUIRED';
      actionMessage = 'Please review Srivari Seva instructions and confirm the declaration checkbox.';
    } else if (bookingSession.isRunning()) {
      guardianState = 'AUTOFILLING';
      actionMessage = 'Populating verified devotee information...';
    } else if (!serviceResolution) {
      guardianState = pageDetection.stage === 'SERVICE_SELECTION' ? 'TTD_PAGE_DETECTED' : 'UNKNOWN';
      actionMessage = 'Navigate to your desired TTD service to begin.';
    } else if (!preflight.isReady) {
      guardianState = 'PROFILE_NOT_READY';
      actionMessage = preflight.errors[0] || 'Complete required devotee details to enable autofill.';
    } else if (
      pageDetection.stage === 'PILGRIM_DETAILS' ||
      pageDetection.stage === 'GENERAL_DETAILS' ||
      pageDetection.stage === 'SRIVARI_ENROLLMENT'
    ) {
      guardianState = 'READY_TO_AUTOFILL';
      actionMessage = 'Details verified and ready to fill.';
    } else {
      guardianState = 'SERVICE_DETECTED';
      actionMessage = `Active service: ${serviceName}. Proceed to devotee details on TTD.`;
    }

    // Update active session metadata
    if (this.currentSession) {
      this.currentSession.currentPageStage = pageDetection.stage;
      this.currentSession.guardianState = guardianState;
      this.currentSession.serviceId = serviceId;
      this.currentSession.serviceName = serviceName;
      this.currentSession.selectedPilgrimCount = selectedPilgrims.length;
      this.currentSession.userActionRequired = [
        'USER_ACTION_REQUIRED',
        'CAPTCHA_REQUIRED',
        'OTP_REQUIRED',
        'PAYMENT_REQUIRED',
        'REVIEW_REQUIRED',
        'SUBMISSION_MANUAL',
      ].includes(guardianState);
      this.currentSession.userActionReason = actionMessage;
      this.currentSession.updatedAt = Date.now();
      this.currentSession.lastVerifiedDomState = {
        stage: pageDetection.stage,
        url: targetUrl,
        timestamp: Date.now(),
      };
      this.currentSession.preflightPassed = preflight.isReady;
      this.currentSession.preflightErrors = preflight.errors;
    }

    this.checkAndDispatchNotification(guardianState, actionMessage, serviceId);

    return {
      guardianState,
      pageDetection,
      preflight,
      session: this.currentSession,
      serviceId,
      serviceName,
      actionMessage,
    };
  }

  /**
   * Initiates a new Guardian booking session.
   */
  public startSession(params: {
    serviceId?: string;
    serviceName?: string;
    workflowId?: string;
    selectedPilgrimCount?: number;
  }): GuardianSession {
    const sessionId = `guardian-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.currentSession = {
      sessionId,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      workflowId: params.workflowId,
      currentPageStage: 'UNKNOWN',
      guardianState: 'UNKNOWN',
      selectedPilgrimCount: params.selectedPilgrimCount || 0,
      readinessScore: 0,
      autofillStatus: 'IDLE',
      userActionRequired: false,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      preflightPassed: false,
    };
    logger.info(`[BookingGuardian] Started Guardian session ${sessionId}`);
    return this.currentSession;
  }

  /**
   * Executes Preflight and delegates to authoritative Autofill Manager.
   * Strictly respects human boundaries on completion.
   */
  public async executeAutofillHandoff(options: {
    doc?: Document;
    url?: string;
    profile: Profile;
    selectedPilgrims: Pilgrim[];
    serviceId?: string;
    workflowId?: string;
    onProgress?: (percent: number, message: string) => void;
  }): Promise<{
    success: boolean;
    state: GuardianState;
    autofillResult?: AutofillManagerResult;
    message?: string;
  }> {
    const { doc = document, url = '', profile, selectedPilgrims, serviceId, workflowId, onProgress } = options;
    const targetUrl = url || (doc as any)?.location?.href || (typeof window !== 'undefined' ? window.location?.href : '') || '';

    // 1. Evaluate State & Preflight
    const evaluation = this.evaluateState({
      doc,
      url: targetUrl,
      profile,
      selectedPilgrims,
      explicitServiceId: serviceId,
    });

    if (!evaluation.preflight.isReady) {
      logger.warn('[BookingGuardian] Autofill handoff rejected by Preflight:', evaluation.preflight.errors);
      return {
        success: false,
        state: 'BLOCKED',
        message: evaluation.preflight.errors.join(' • '),
      };
    }

    // 2. Ensure session exists
    if (!this.currentSession) {
      this.startSession({
        serviceId: evaluation.serviceId,
        serviceName: evaluation.serviceName,
        workflowId: evaluation.preflight.workflowId || workflowId,
        selectedPilgrimCount: selectedPilgrims.length,
      });
    }

    if (this.currentSession) {
      this.currentSession.autofillStatus = 'STARTED';
      this.currentSession.guardianState = 'AUTOFILLING';
      this.currentSession.updatedAt = Date.now();
    }

    // 3. Delegate to Autofill Manager
    logger.info(`[BookingGuardian] Handing off to AutofillManager for service: ${evaluation.serviceId}`);
    try {
      const autofillResult = await executeAutofill({
        doc,
        url: targetUrl,
        profile,
        pilgrims: selectedPilgrims,
        serviceId: evaluation.serviceId,
        workflow: evaluation.preflight.workflowId || workflowId,
        onProgress: (p) => {
          if (onProgress) {
            onProgress(p.percent, `Filling devotee details (${p.percent}%)`);
          }
        },
      });

      // 4. Post-autofill State Verification & Boundary Enforcement
      if (this.currentSession) {
        this.currentSession.lastAutofillResult = autofillResult;
        this.currentSession.updatedAt = Date.now();
      }

      // Handle Temporary Lock
      if (autofillResult.temporaryLock) {
        if (this.currentSession) {
          this.currentSession.guardianState = 'TTD_TEMPORARY_BOOKING_LOCK';
          this.currentSession.temporaryLock = autofillResult.temporaryLock;
          this.currentSession.autofillStatus = 'FAILED';
        }
        return {
          success: false,
          state: 'TTD_TEMPORARY_BOOKING_LOCK',
          autofillResult,
          message: autofillResult.temporaryLock.message || 'TTD temporary booking lock detected',
        };
      }

      // Handle Required User Action
      if (autofillResult.actionRequired) {
        if (this.currentSession) {
          this.currentSession.guardianState = 'USER_ACTION_REQUIRED';
          this.currentSession.userActionRequired = true;
          this.currentSession.userActionReason = autofillResult.actionMessage;
          this.currentSession.autofillStatus = 'PARTIAL';
        }
        return {
          success: false,
          state: 'USER_ACTION_REQUIRED',
          autofillResult,
          message: autofillResult.actionMessage || 'Some required fields require your manual attention.',
        };
      }

      // Handle Partial Failure
      if (autofillResult.totalFailed > 0 || (autofillResult.failedItems && autofillResult.failedItems.length > 0)) {
        if (this.currentSession) {
          this.currentSession.guardianState = 'USER_ACTION_REQUIRED';
          this.currentSession.userActionRequired = true;
          this.currentSession.userActionReason = 'Please review partially filled fields on TTD.';
          this.currentSession.autofillStatus = 'PARTIAL';
        }
        return {
          success: false,
          state: 'USER_ACTION_REQUIRED',
          autofillResult,
          message: 'Autofill partially complete. Please inspect remaining fields manually.',
        };
      }

      // 5. Successful Autofill -> Hand off to user for manual review and submission
      if (this.currentSession) {
        this.currentSession.guardianState = 'SUBMISSION_MANUAL';
        this.currentSession.autofillStatus = 'VERIFIED';
        this.currentSession.userActionRequired = true;
        this.currentSession.userActionReason = 'All details verified. Review and continue manually on TTD.';
      }

      logger.info('[BookingGuardian] Autofill verified successfully. Handing off to user for manual submission.');
      return {
        success: true,
        state: 'SUBMISSION_MANUAL',
        autofillResult,
        message: 'All details verified and populated. Review and continue manually on TTD.',
      };
    } catch (err: any) {
      logger.error('[BookingGuardian] Autofill handoff execution failed:', err);
      if (this.currentSession) {
        this.currentSession.guardianState = 'BOOKING_FAILED';
        this.currentSession.autofillStatus = 'FAILED';
      }
      return {
        success: false,
        state: 'BOOKING_FAILED',
        message: err?.message || 'Autofill encountered an error.',
      };
    }
  }

  /**
   * Emergency Stop: Aborts retries, halts active sessions, and preserves all user-entered data.
   */
  public emergencyStop(reason: string = 'User triggered emergency stop'): void {
    logger.warn(`[BookingGuardian] Emergency Stop invoked: ${reason}`);
    requestStop();
    bookingSession.cancelSession(reason);

    if (this.currentSession) {
      this.currentSession.guardianState = 'BLOCKED';
      this.currentSession.autofillStatus = 'STOPPED';
      this.currentSession.userActionRequired = true;
      this.currentSession.userActionReason = `Autofill halted: ${reason}`;
      this.currentSession.updatedAt = Date.now();
    }
  }

  /**
   * Resets the Guardian session state.
   */
  public reset(): void {
    this.emergencyStop('Session reset');
    this.currentSession = null;
    this.lastNotifiedState = null;
  }

  /**
   * Current Guardian Session getter.
   */
  public getSession(): GuardianSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Subscribes to meaningful, debounced Guardian notification events.
   */
  public onNotification(subscriber: (event: GuardianNotificationEvent) => void): () => void {
    this.notificationSubscribers.add(subscriber);
    return () => {
      this.notificationSubscribers.delete(subscriber);
    };
  }

  private checkAndDispatchNotification(state: GuardianState, message?: string, serviceId?: string): void {
    if (state === this.lastNotifiedState) return;

    let notifType: GuardianNotificationType | null = null;
    let title = '';

    switch (state) {
      case 'AUTOFILL_COMPLETE':
      case 'SUBMISSION_MANUAL':
        notifType = 'AUTOFILL_COMPLETE';
        title = 'Details Verified & Ready';
        break;
      case 'USER_ACTION_REQUIRED':
        notifType = 'USER_ACTION_REQUIRED';
        title = 'User Action Required';
        break;
      case 'CAPTCHA_REQUIRED':
        notifType = 'CAPTCHA_REQUIRED';
        title = 'CAPTCHA Detected';
        break;
      case 'OTP_REQUIRED':
        notifType = 'OTP_REQUIRED';
        title = 'OTP Verification Required';
        break;
      case 'PAYMENT_REQUIRED':
        notifType = 'PAYMENT_REQUIRED';
        title = 'Payment Gateway Reached';
        break;
      case 'TTD_TEMPORARY_BOOKING_LOCK':
        notifType = 'TEMPORARY_LOCK';
        title = 'TTD Temporary Lock Active';
        break;
      case 'SESSION_EXPIRED':
        notifType = 'SESSION_EXPIRED';
        title = 'TTD Session Expired';
        break;
      case 'BOOKING_SUCCESS':
        notifType = 'BOOKING_SUCCESS';
        title = 'Booking Successful!';
        break;
      case 'BOOKING_FAILED':
        notifType = 'BOOKING_FAILED';
        title = 'Booking Action Failed';
        break;
      default:
        notifType = null;
    }

    if (notifType) {
      this.lastNotifiedState = state;
      const event: GuardianNotificationEvent = {
        type: notifType,
        title,
        message: message || title,
        timestamp: Date.now(),
        sessionId: this.currentSession?.sessionId,
        serviceId,
      };

      for (const sub of this.notificationSubscribers) {
        try {
          sub(event);
        } catch (e) {
          logger.debug('Notification subscriber error:', e);
        }
      }
    }
  }
}

export const bookingGuardian = new BookingGuardian();
