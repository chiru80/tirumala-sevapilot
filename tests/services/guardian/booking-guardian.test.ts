// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 8: Booking Guardian Test Suite
// Verifies state machine orchestration, preflight verification,
// and strict human-boundary handoff layer.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BookingGuardian,
  bookingGuardian,
  detectGuardianPageStage,
  invalidateGuardianPageStageCache,
  detectCaptchaPresence,
  detectOtpPresence,
  detectBookingSuccess,
  detectSessionExpired,
  executeGuardianPreflight,
  type GuardianState,
  type GuardianPageStage,
} from '../../../src/services/guardian';
import { ServiceType, Gender, IdType, type Profile, type Pilgrim } from '../../../src/shared/types';
import { bookingSession } from '../../../src/content/autofill/booking-session';
import * as autofillManager from '../../../src/content/autofill/autofill-manager';

describe('Phase 8 — Booking Guardian Orchestration Suite', () => {
  let guardian: BookingGuardian;

  const validPilgrim1: Pilgrim = {
    id: 'p1',
    firstName: 'Chiranjeevi',
    lastName: 'Rao',
    fullName: 'Chiranjeevi Rao',
    dateOfBirth: '1988-06-12',
    age: 38,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '999999990019',
    mobile: '9876543210',
    country: 'India',
    state: 'Andhra Pradesh',
    city: 'Tirupati',
    pinCode: '517501',
    createdAt: '2026-01-01',
  };

  const validPilgrim2: Pilgrim = {
    id: 'p2',
    firstName: 'Lakshmi',
    lastName: 'Rao',
    fullName: 'Lakshmi Rao',
    dateOfBirth: '1992-04-10',
    age: 34,
    gender: Gender.FEMALE,
    idType: IdType.AADHAAR,
    idNumber: '999999990026',
    mobile: '9876543210',
    country: 'India',
    state: 'Andhra Pradesh',
    city: 'Tirupati',
    pinCode: '517501',
    createdAt: '2026-01-01',
  };

  const validProfile: Profile = {
    id: 'prof-sed',
    name: 'Family Profile',
    pilgrims: [validPilgrim1, validPilgrim2],
    selectedPilgrims: { 'special-entry-darshan-300': ['p1', 'p2'] },
    isDefault: true,
    general: {
      email: 'chiru@example.com',
      mobile: '9876543210',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
    },
    createdAt: '2026-01-01',
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    invalidateGuardianPageStageCache();
    guardian = new BookingGuardian();
    bookingSession.reset();
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. PAGE DETECTION
  // ─────────────────────────────────────────────────────────────
  describe('1. Page Detection (Multi-signal)', () => {
    it('detects CAPTCHA challenge in live DOM', () => {
      document.body.innerHTML = `
        <form>
          <img src="/api/captcha/generate" alt="captcha" />
          <input type="text" name="captchaCode" id="captchaInput" placeholder="Enter CAPTCHA" />
        </form>
      `;
      expect(detectCaptchaPresence(document)).toBe(true);

      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');
      expect(detection.stage).toBe('CAPTCHA');
      expect(detection.isCaptchaPresent).toBe(true);
    });

    it('detects OTP verification challenge', () => {
      document.body.innerHTML = `
        <div class="otp-dialog">
          <h2>Enter OTP</h2>
          <input type="text" name="mobileOtp" placeholder="6-digit OTP" />
        </div>
      `;
      expect(detectOtpPresence(document)).toBe(true);

      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/login');
      expect(detection.stage).toBe('OTP');
      expect(detection.isOtpPresent).toBe(true);
    });

    it('detects Payment gateway step and respects human boundary', () => {
      document.body.innerHTML = `
        <div class="payment-container">
          <h2>Select Payment Option</h2>
          <button id="btnPayNow">Proceed to Pay</button>
        </div>
      `;
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/pgi/checkout');
      expect(detection.stage).toBe('PAYMENT');
      expect(detection.isPaymentPresent).toBe(true);
    });

    it('detects Review summary page', () => {
      document.body.innerHTML = `
        <div class="booking-summary">
          <h1>Review Booking Details</h1>
          <div class="devotee-card">Chiranjeevi Rao</div>
        </div>
      `;
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/booking/review');
      expect(detection.stage).toBe('REVIEW');
      expect(detection.isReviewPresent).toBe(true);
    });

    it('detects official Booking Success only from definitive confirmation markers', () => {
      document.body.innerHTML = `
        <div class="booking-success">
          <h2>Booking Successful</h2>
          <p>Booking Reference Number: TTD-SED-9823412</p>
          <button>Download Receipt</button>
        </div>
      `;
      expect(detectBookingSuccess(document, 'https://ttdevasthanams.ap.gov.in/booking/receipt')).toBe(true);

      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/booking/receipt');
      expect(detection.stage).toBe('SUCCESS');
      expect(detection.isSuccessPresent).toBe(true);
    });

    it('rejects optimistic success when only a button is clicked or form disappears', () => {
      document.body.innerHTML = `
        <div>
          <p>Loading next step...</p>
        </div>
      `;
      expect(detectBookingSuccess(document, 'https://ttdevasthanams.ap.gov.in/booking/submit')).toBe(false);
    });

    it('detects Session Expiration notice', () => {
      document.body.innerHTML = `
        <div class="alert alert-danger">
          <p>Your session has expired. Please login again to continue.</p>
        </div>
      `;
      expect(detectSessionExpired(document)).toBe(true);

      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');
      expect(detection.stage).toBe('SESSION_EXPIRED');
      expect(detection.isSessionExpired).toBe(true);
    });

    it('detects Temporary TTD Booking Lock with highest safety priority', () => {
      document.body.innerHTML = `
        <div class="toast-error">
          <p>Booking with same pilgrim id is in progress. Please try again after some time</p>
        </div>
      `;
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');
      expect(detection.stage).toBe('LOCKED');
      expect(detection.isLocked).toBe(true);
      expect(detection.temporaryLock).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. PREFLIGHT VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe('2. 10-Point Preflight Verification', () => {
    it('passes all 10 checks for valid Special Entry Darshan configuration', () => {
      document.body.innerHTML = `
        <div class="pilgrim-form">
          <input name="name" />
        </div>
      `;
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');

      const preflight = executeGuardianPreflight({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        pageDetection: detection,
        serviceId: 'special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1, validPilgrim2],
      });

      expect(preflight.isReady).toBe(true);
      expect(preflight.errors).toHaveLength(0);
      expect(preflight.checks).toHaveLength(10);
      expect(preflight.checks.every(c => c.passed)).toBe(true);
    });

    it('fails preflight when pilgrim count exceeds service limits (e.g. Srivari Seva exact 1 rule)', () => {
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile');

      const preflight = executeGuardianPreflight({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile',
        pageDetection: detection,
        serviceId: 'srivari-seva',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1, validPilgrim2], // 2 pilgrims selected for Srivari Seva (limit is exactly 1)
      });

      expect(preflight.isReady).toBe(false);
      expect(preflight.errors.some(e => e.includes('requires exactly 1 devotee'))).toBe(true);
    });

    it('fails preflight for Homam when count is not strictly 2', () => {
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/homam/booking');

      const preflight = executeGuardianPreflight({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/homam/booking',
        pageDetection: detection,
        serviceId: 'sri-srinivasa-divyanugraha-homam',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1], // 1 pilgrim selected, Homam requires strictly 2
      });

      expect(preflight.isReady).toBe(false);
      expect(preflight.errors.some(e => e.includes('requires exactly 2'))).toBe(true);
    });

    it('fails preflight when page is blocked by CAPTCHA', () => {
      document.body.innerHTML = `
        <div>
          <img src="/captcha.jpg" />
          <input name="captcha" />
        </div>
      `;
      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');

      const preflight = executeGuardianPreflight({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        pageDetection: detection,
        serviceId: 'special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(preflight.isReady).toBe(false);
      expect(preflight.errors.some(e => e.includes('CAPTCHA'))).toBe(true);
    });

    it('fails preflight when a concurrent session is already running', () => {
      bookingSession.startSession({ serviceId: 'special-entry-darshan-300' });

      const detection = detectGuardianPageStage(document, 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');
      const preflight = executeGuardianPreflight({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        pageDetection: detection,
        serviceId: 'special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(preflight.isReady).toBe(false);
      expect(preflight.errors.some(e => e.includes('Conflicting autofill session'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. STATE MACHINE EVALUATION & HUMAN BOUNDARIES
  // ─────────────────────────────────────────────────────────────
  describe('3. State Machine & Human Boundaries', () => {
    it('evaluates READY_TO_AUTOFILL on valid pilgrim details page', () => {
      document.body.innerHTML = `
        <div class="pilgrim-details">
          <h2>Pilgrim Details</h2>
          <input name="name" />
          <input name="age" />
        </div>
      `;
      const evalResult = guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1, validPilgrim2],
        explicitServiceId: 'special-entry-darshan-300',
      });

      expect(evalResult.guardianState).toBe('READY_TO_AUTOFILL');
    });

    it('evaluates CAPTCHA_REQUIRED and does NOT auto-submit or solve', () => {
      document.body.innerHTML = `
        <div class="captcha-form">
          <img src="/captcha.jpg" />
          <input name="captcha" id="captchaInput" />
        </div>
      `;
      const evalResult = guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
        explicitServiceId: 'special-entry-darshan-300',
      });

      expect(evalResult.guardianState).toBe('CAPTCHA_REQUIRED');
      expect(evalResult.actionMessage).toContain('Complete the CAPTCHA on TTD');
    });

    it('evaluates OTP_REQUIRED and enforces manual user input', () => {
      document.body.innerHTML = `
        <div>
          <h2>Enter OTP</h2>
          <input name="otp" />
        </div>
      `;
      const evalResult = guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/login',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(evalResult.guardianState).toBe('OTP_REQUIRED');
      expect(evalResult.actionMessage).toContain('Enter the OTP manually');
    });

    it('evaluates PAYMENT_REQUIRED and preserves human payment control', () => {
      document.body.innerHTML = `
        <div class="payment-form">
          <input name="paymentMode" />
        </div>
      `;
      const evalResult = guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/payment/gateway',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(evalResult.guardianState).toBe('PAYMENT_REQUIRED');
      expect(evalResult.actionMessage).toContain('complete payment manually');
    });

    it('evaluates REVIEW_REQUIRED before final submission', () => {
      document.body.innerHTML = `
        <div class="booking-summary">
          <h2>Review Details</h2>
        </div>
      `;
      const evalResult = guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/review',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(evalResult.guardianState).toBe('REVIEW_REQUIRED');
      expect(evalResult.actionMessage).toContain('Review your details before continuing');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. AUTOFILL HANDOFF & VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe('4. Autofill Handoff & Human Submission Handoff', () => {
    it('successfully executes autofill and transitions to SUBMISSION_MANUAL (never auto-submits)', async () => {
      document.body.innerHTML = `
        <div class="pilgrim-form">
          <input name="name" />
        </div>
      `;

      vi.spyOn(autofillManager, 'executeAutofill').mockResolvedValue({
        success: true,
        state: 'COMPLETE',
        step: 'pilgrim',
        totalVerified: 2,
        totalFailed: 0,
        totalFields: 2,
        durationMs: 150,
        errors: [],
        needsAttention: false,
        failedItems: [],
        pilgrimResults: [],
        generalResults: [],
      });

      const res = await guardian.executeAutofillHandoff({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1, validPilgrim2],
        serviceId: 'special-entry-darshan-300',
      });

      expect(res.success).toBe(true);
      expect(res.state).toBe('SUBMISSION_MANUAL');
      expect(res.message).toContain('Review and continue manually on TTD');
    });

    it('handles partial failures by transitioning to USER_ACTION_REQUIRED without exposing PII', async () => {
      document.body.innerHTML = `
        <div class="pilgrim-form">
          <input name="name" />
        </div>
      `;

      vi.spyOn(autofillManager, 'executeAutofill').mockResolvedValue({
        success: false,
        state: 'PARTIAL_SUCCESS',
        step: 'pilgrim',
        totalVerified: 4,
        totalFailed: 1,
        totalFields: 5,
        durationMs: 300,
        errors: ['Photo ID Number could not be verified'],
        needsAttention: true,
        actionRequired: true,
        actionMessage: 'Please verify photoIdNumber on row 1.',
        failedItems: [
          {
            pilgrimIndex: 0,
            field: 'photoIdNumber',
            fieldLabel: 'Photo ID Number',
            error: 'Verification failed',
          },
        ],
        pilgrimResults: [],
        generalResults: [],
      });

      const res = await guardian.executeAutofillHandoff({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
        serviceId: 'special-entry-darshan-300',
      });

      expect(res.success).toBe(false);
      expect(res.state).toBe('USER_ACTION_REQUIRED');
      // Must not contain raw PII
      expect(res.message).not.toContain(validPilgrim1.idNumber);
    });

    it('transitions to TTD_TEMPORARY_BOOKING_LOCK when server-side hold is encountered', async () => {
      document.body.innerHTML = `<div></div>`;

      vi.spyOn(autofillManager, 'executeAutofill').mockResolvedValue({
        success: false,
        state: 'TTD_TEMPORARY_BOOKING_LOCK',
        step: 'unknown',
        totalVerified: 0,
        totalFailed: 0,
        totalFields: 0,
        durationMs: 10,
        errors: ['Booking with same pilgrim id is in progress'],
        needsAttention: true,
        temporaryLock: {
          status: 'temporary-lock',
          message: 'Your own previous attempt is still holding these pilgrims',
          supportingMessage: 'Please try again after some time',
          detectedAt: Date.now(),
          detectedAtIso: new Date().toISOString(),
          hasExplicitTimer: false,
        },
        failedItems: [],
        pilgrimResults: [],
        generalResults: [],
      });

      const res = await guardian.executeAutofillHandoff({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
        serviceId: 'special-entry-darshan-300',
      });

      expect(res.success).toBe(false);
      expect(res.state).toBe('TTD_TEMPORARY_BOOKING_LOCK');
      expect(res.message).toContain('holding these pilgrims');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. EMERGENCY STOP & PAGE TRANSITIONS
  // ─────────────────────────────────────────────────────────────
  describe('5. Emergency Stop & Page Transitions', () => {
    it('emergencyStop cancels session, halts retries, and transitions to BLOCKED', () => {
      const stopSpy = vi.spyOn(autofillManager, 'requestStop');
      guardian.startSession({ serviceId: 'special-entry-darshan-300' });

      guardian.emergencyStop('User clicked stop button');

      expect(stopSpy).toHaveBeenCalled();
      expect(guardian.getSession()?.guardianState).toBe('BLOCKED');
      expect(guardian.getSession()?.autofillStatus).toBe('STOPPED');
      expect(bookingSession.isRunning()).toBe(false);
    });

    it('detects page transition during session and invalidates stale state', () => {
      const stopSpy = vi.spyOn(guardian, 'emergencyStop');
      const session = guardian.startSession({ serviceId: 'special-entry-darshan-300' });
      session.lastVerifiedDomState = {
        stage: 'PILGRIM_DETAILS',
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        timestamp: Date.now() - 5000,
      };

      // Mock session running
      bookingSession.startSession({ serviceId: 'special-entry-darshan-300' });

      // User navigates away to home page
      guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/home',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });

      expect(stopSpy).toHaveBeenCalledWith(expect.stringContaining('Page navigation detected'));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. NOTIFICATION INTEGRITY (ZERO NOTIFICATION SPAM)
  // ─────────────────────────────────────────────────────────────
  describe('6. Notification Integrity', () => {
    it('dispatches notification only on state transitions and deduplicates repeated calls', () => {
      const notifications: any[] = [];
      guardian.onNotification((n) => notifications.push(n));

      document.body.innerHTML = `<div><img src="/captcha.jpg"/><input name="captcha" /></div>`;

      // Call 1: transitions to CAPTCHA_REQUIRED
      guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('CAPTCHA_REQUIRED');

      // Call 2: same state, should NOT emit duplicate notification
      guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1],
      });
      expect(notifications).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. SECURITY & ZERO PII LOGGING
  // ─────────────────────────────────────────────────────────────
  describe('7. Security & Zero PII Logging', () => {
    it('session state and diagnostic messages contain ZERO raw Aadhaar numbers or phone numbers', () => {
      const session = guardian.startSession({
        serviceId: 'special-entry-darshan-300',
        selectedPilgrimCount: 2,
      });

      guardian.evaluateState({
        doc: document,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan-300',
        profile: validProfile,
        selectedPilgrims: [validPilgrim1, validPilgrim2],
      });

      const serializedSession = JSON.stringify(session);
      expect(serializedSession).not.toContain(validPilgrim1.idNumber);
      expect(serializedSession).not.toContain(validPilgrim2.idNumber);
      expect(serializedSession).not.toContain(validPilgrim1.mobile);
    });
  });
});
