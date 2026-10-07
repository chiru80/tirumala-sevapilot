// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: TTD Temporary Pilgrim/ID Lock
// Comprehensive verification of all test cases (A through I)
// and error priority & safety requirements.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectTtdTemporaryLock,
  checkTextForTtdLock,
  extractLockTimerDetails,
  normalizeLockText,
  logSafeTtdLockDetected,
} from '../../src/services/ttd-information/ttd-lock-detector';
import {
  classifyError,
  createTtdTemporaryLockClassification,
} from '../../src/services/error-classification';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';
import logger from '../../src/shared/logger';

describe('TTD Temporary Pilgrim/ID Lock Handling & Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Test Case A ───
  it('A: detects exact observed message "Your own previous attempt is still holding these pilgrims"', () => {
    const message = 'Your own previous attempt is still holding these pilgrims';
    const result = checkTextForTtdLock(message);

    expect(result.isLocked).toBe(true);
    expect(result.lockState).toBeDefined();
    expect(result.lockState?.status).toBe('temporary-lock');
    expect(result.lockState?.message).toBe('Your previous booking attempt is still holding this pilgrim.');

    const errorClass = classifyError(message);
    expect(errorClass.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
    expect(errorClass.category).toBe('ttd-state');
    expect(errorClass.severity).toBe('warning');
    expect(errorClass.retryable).toBe(true);
    expect(errorClass.automaticRetry).toBe(false);
    expect(errorClass.userActionRequired).toBe(true);
    expect(errorClass.bookingSubmissionBlocked).toBe(true);
  });

  // ─── Test Case B ───
  it('B: detects exact observed message "Booking with same pilgrim id is in progress"', () => {
    const message = 'Booking with same pilgrim id is in progress. Please try again after some time';
    const result = checkTextForTtdLock(message);

    expect(result.isLocked).toBe(true);
    expect(result.lockState?.status).toBe('temporary-lock');

    const errorClass = classifyError(message);
    expect(errorClass.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
    expect(errorClass.category).toBe('ttd-state');
  });

  // ─── Test Case C ───
  it('C: detects message containing "ID numbers locked"', () => {
    const message = 'Not contention — your last try still has these ID numbers locked. Wait a few minutes for it to expire, then try again. Retrying now cannot work.';
    const result = checkTextForTtdLock(message);

    expect(result.isLocked).toBe(true);
    expect(result.lockState?.status).toBe('temporary-lock');

    const errorClass = classifyError(message);
    expect(errorClass.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
    expect(errorClass.category).toBe('ttd-state');
  });

  // ─── Test Case D ───
  it('D: does NOT classify generic field detection error as temporary lock', () => {
    const message = 'Pilgrim fields could not be safely identified.';
    const result = checkTextForTtdLock(message);

    expect(result.isLocked).toBe(false);
    expect(result.lockState).toBeNull();

    const errorClass = classifyError(message);
    expect(errorClass.code).not.toBe('TTD_TEMPORARY_BOOKING_LOCK');
    expect(errorClass.category).toBe('field-detection');
  });

  // ─── Test Case E ───
  it('E: does NOT classify generic validation error as temporary lock unless lock message is detected', () => {
    const invalidIdMsg = 'Invalid ID: Please enter a valid 12-digit Aadhaar number';
    const result1 = checkTextForTtdLock(invalidIdMsg);

    expect(result1.isLocked).toBe(false);
    expect(result1.lockState).toBeNull();

    const errorClass1 = classifyError(invalidIdMsg);
    expect(errorClass1.code).not.toBe('TTD_TEMPORARY_BOOKING_LOCK');

    // But if lock message is also present, lock takes precedence
    const combinedMsg = 'Invalid ID — Booking with same pilgrim id is in progress. Please try again after some time';
    const result2 = checkTextForTtdLock(combinedMsg);
    expect(result2.isLocked).toBe(true);

    const errorClass2 = classifyError(combinedMsg);
    expect(errorClass2.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
  });

  // ─── Test Case F ───
  it('F: extracts informational duration and elapsed timer from "Locked 23s ago — usually clears in about 5 minutes."', () => {
    const message = 'Locked 23s ago — usually clears in about 5 minutes.';
    const timer = extractLockTimerDetails(normalizeLockText(message));

    expect(timer.hasExplicitTimer).toBe(true);
    expect(timer.elapsedSeconds).toBe(23);
    // 5 minutes = 300s. 300 - 23 = 277s -> ceil(277/60) = 5 or 4 minutes remaining
    expect(timer.remainingSeconds).toBe(277);
    expect(timer.durationMinutes).toBe(5);

    const result = checkTextForTtdLock(message);
    expect(result.isLocked).toBe(true);
    expect(result.lockState?.hasExplicitTimer).toBe(true);
    expect(result.lockState?.durationMinutes).toBe(5);
    expect(result.lockState?.supportingMessage).toContain('Try again in about 5 minutes');
  });

  // ─── Test Case G ───
  it('G: ensures NO automatic retry is scheduled or initiated on timer expiration', () => {
    // Verify error classification dictates automaticRetry = false
    const lockState = checkTextForTtdLock('Locked 23s ago — usually clears in about 5 minutes.').lockState!;
    const classification = createTtdTemporaryLockClassification(lockState);

    expect(classification.automaticRetry).toBe(false);
    expect(classification.retryable).toBe(true);
    expect(classification.userActionRequired).toBe(true);
    expect(classification.bookingSubmissionBlocked).toBe(true);
  });

  // ─── Test Case H ───
  it('H: recommends Check Booking History as primary action requiring user interaction', () => {
    const lockState = checkTextForTtdLock('Your own previous attempt is still holding these pilgrims').lockState!;
    const classification = createTtdTemporaryLockClassification(lockState);

    expect(classification.recommendedAction).toBe('check-booking-history');
    expect(classification.userActionRequired).toBe(true);
  });

  // ─── Test Case I ───
  it('I: preserves pilgrim profile and selected details without deletion or modification', async () => {
    const mockPilgrim: Pilgrim = {
      id: 'pilgrim-test-123',
      firstName: 'Venkata',
      lastName: 'Raman',
      fullName: 'Venkata Raman',
      gender: Gender.MALE,
      idType: IdType.AADHAAR,
      idNumber: '999988887777',
      age: 45,
      country: 'India',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const mockProfile: Profile = {
      id: 'profile-test-999',
      name: 'Family Profile',
      pilgrims: [{ ...mockPilgrim }],
      isDefault: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    // Deep clone before lock detection to verify immutability
    const originalPilgrimJson = JSON.stringify(mockPilgrim);
    const originalProfileJson = JSON.stringify(mockProfile);

    // Create a DOM fixture where TTD temporary lock alert is displayed
    const doc = document.implementation.createHTMLDocument('TTD Page');
    const alertDiv = doc.createElement('div');
    alertDiv.className = 'alert alert-warning';
    alertDiv.textContent = 'Your own previous attempt is still holding these pilgrims. Please wait a few minutes.';
    doc.body.appendChild(alertDiv);

    // Run executeAutofill against DOM containing temporary lock
    const res = await executeAutofill({
      doc,
      pilgrims: mockProfile.pilgrims,
      profile: mockProfile,
      url: 'https://ttdevasthanams.ap.gov.in/booking/sed',
    });

    // 1. Must fail gracefully with dedicated lock state
    expect(res.success).toBe(false);
    expect(res.state).toBe('TTD_TEMPORARY_BOOKING_LOCK');
    expect(res.temporaryLock).toBeDefined();
    expect(res.temporaryLock?.status).toBe('temporary-lock');

    // 2. Profile and Pilgrim data must be 100% UNTOUCHED
    expect(JSON.stringify(mockProfile.pilgrims[0])).toBe(originalPilgrimJson);
    expect(JSON.stringify(mockProfile)).toBe(originalProfileJson);
    expect(mockProfile.pilgrims[0].idNumber).toBe('999988887777');
  });

  // ─── Additional Architecture & Safety Tests ───
  describe('Error Priority & Safety Guardrails', () => {
    it('prioritizes CAPTCHA (Priority 1) over TTD Lock (Priority 2)', () => {
      const doc = document.implementation.createHTMLDocument('CAPTCHA Page');
      const captchaEl = doc.createElement('div');
      captchaEl.id = 'captcha-container';
      doc.body.appendChild(captchaEl);

      const error = classifyError('Your own previous attempt is still holding these pilgrims', { doc });
      expect(error.code).toBe('CAPTCHA_DETECTED');
      expect(error.priority).toBe(1);
    });

    it('prioritizes TTD Lock (Priority 2) over generic field detection errors (Priority 5)', () => {
      const doc = document.implementation.createHTMLDocument('Locked Page');
      const modal = doc.createElement('div');
      modal.className = 'mat-dialog-container';
      modal.textContent = 'Booking with same pilgrim id is in progress. Please try again after some time';
      doc.body.appendChild(modal);

      // Even if raw error string is about field identification failure
      const error = classifyError('Pilgrim fields could not be safely identified', { doc });
      expect(error.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
      expect(error.priority).toBe(2);
      expect(error.category).toBe('ttd-state');
    });

    it('strictly avoids logging any PII during lock detection', () => {
      const warnSpy = vi.spyOn(logger, 'warn');

      logSafeTtdLockDetected({
        serviceId: 'padmavathi-supadham-entry-200',
        workflowId: 'padmavathi-v1',
        elapsedSeconds: 23,
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [msg, payload] = warnSpy.mock.calls[0] as [string, any];

      expect(msg).toBe('[TTD] Temporary booking lock detected');
      expect(payload).toEqual({
        service: 'padmavathi-supadham-entry-200',
        workflow: 'padmavathi-v1',
        state: 'temporary-lock',
        timestamp: expect.any(String),
        elapsedLockDuration: '23s',
      });

      // Assert zero PII in logged output
      const json = JSON.stringify(payload);
      expect(json).not.toContain('aadhaar');
      expect(json).not.toContain('idNumber');
      expect(json).not.toContain('mobile');
      expect(json).not.toContain('email');
    });

    it('does not alter or sanitize user ID to bypass server lock', () => {
      const lockRes = checkTextForTtdLock('Your own previous attempt is still holding these pilgrims');
      expect(lockRes.lockState?.message).not.toContain('Use another ID');
      expect(lockRes.lockState?.supportingMessage).not.toContain('Use another ID');
    });
  });
});
