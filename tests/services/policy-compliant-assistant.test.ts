// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  CanonicalAutomationPolicy,
  getServiceAutomationPolicy,
  isServiceAutofillAllowed,
  isServiceManualOnly,
  CANONICAL_SRIVANI_TRUST,
  CANONICAL_SPECIAL_ENTRY_300,
  getCanonicalService,
} from '../../src/services/canonical-service-registry';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import { testProfileReadiness } from '../../src/sidepanel/presentation/profile-readiness-tester';
import { computeNextAction } from '../../src/sidepanel/presentation/next-action';
import { sanitizeForLogging } from '../../src/shared/logger';
import { Profile, Pilgrim, Gender, IdType, ServiceType } from '../../src/shared/types';

describe('Phase 15 — Policy-Compliant Booking Assistant', () => {
  const samplePilgrim: Pilgrim = {
    id: 'pilgrim-1',
    firstName: 'Govinda',
    lastName: 'Rao',
    fullName: 'Govinda Rao',
    age: 42,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '234567890124',
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  const sampleProfile: Profile = {
    id: 'profile-1',
    name: 'Srivani Devotees',
    serviceType: ServiceType.DARSHAN,
    pilgrims: [samplePilgrim],
    general: {
      email: 'devotee@tirumala.org',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      pinCode: '517501',
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Canonical Service Registry & Automation Policy
  // ─────────────────────────────────────────────────────────────
  describe('Canonical Service Registry & Automation Policies', () => {
    it('Srivani Trust is explicitly registered with RESTRICTED_MANUAL_ONLY policy', () => {
      const srivani = getCanonicalService('srivani-trust');
      expect(srivani).toBeDefined();
      expect(srivani?.serviceId).toBe('srivani');
      expect(srivani?.automationPolicy).toBe(CanonicalAutomationPolicy.RESTRICTED_MANUAL_ONLY);
      expect(CANONICAL_SRIVANI_TRUST.automationPolicy).toBe(CanonicalAutomationPolicy.RESTRICTED_MANUAL_ONLY);
    });

    it('SED ₹300 retains PERMITTED_USER_INITIATED policy', () => {
      const sed = getCanonicalService('special-entry-darshan-300');
      expect(sed).toBeDefined();
      expect(sed?.automationPolicy).toBe(CanonicalAutomationPolicy.PERMITTED_USER_INITIATED);
      expect(CANONICAL_SPECIAL_ENTRY_300.automationPolicy).toBe(CanonicalAutomationPolicy.PERMITTED_USER_INITIATED);
    });

    it('policy helper functions classify services correctly', () => {
      // Srivani
      expect(isServiceAutofillAllowed('srivani-trust')).toBe(false);
      expect(isServiceManualOnly('srivani-trust')).toBe(true);
      expect(getServiceAutomationPolicy('srivani-trust')).toBe(CanonicalAutomationPolicy.RESTRICTED_MANUAL_ONLY);

      // SED ₹300
      expect(isServiceAutofillAllowed('special-entry-darshan-300')).toBe(true);
      expect(isServiceManualOnly('special-entry-darshan-300')).toBe(false);
      expect(getServiceAutomationPolicy('special-entry-darshan-300')).toBe(CanonicalAutomationPolicy.PERMITTED_USER_INITIATED);

      // Unknown / Unconfirmed fails closed
      expect(isServiceAutofillAllowed('unrecognized-service-xyz')).toBe(false);
      expect(isServiceManualOnly('unrecognized-service-xyz')).toBe(true);
      expect(getServiceAutomationPolicy('unrecognized-service-xyz')).toBe(CanonicalAutomationPolicy.UNCONFIRMED_FAIL_CLOSED);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Autofill Manager Rejection & Protection
  // ─────────────────────────────────────────────────────────────
  describe('Autofill Manager Rejection & Defense', () => {
    it('blocks autofill execution for Srivani Trust per TTD May 2026 announcement', async () => {
      const result = await executeAutofill({
        pilgrims: [samplePilgrim],
        profile: sampleProfile,
        serviceId: 'srivani-trust',
        url: 'https://ttdevasthanams.ap.gov.in/srivani',
      } as any);

      expect(result.success).toBe(false);
      expect(result.state).toBe('ERROR');
      expect(result.errors.join(' ')).toMatch(/prohibited for Srivani/i);
    });

    it('blocks autofill execution for unknown unconfirmed services', async () => {
      const result = await executeAutofill({
        pilgrims: [samplePilgrim],
        profile: sampleProfile,
        serviceId: 'unknown-service-abc',
      } as any);

      expect(result.success).toBe(false);
      expect(result.state).toBe('ERROR');
      expect(result.errors.join(' ')).toMatch(/not authorized for autofill/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Profile Readiness for Srivani & Manual-Only Workflows
  // ─────────────────────────────────────────────────────────────
  describe('Profile Readiness Engine Integration', () => {
    it('marks Srivani readiness report with isManualOnly=true and appropriate notice', () => {
      const report = testProfileReadiness(sampleProfile, [samplePilgrim], 'srivani-trust');
      expect(report.isManualOnly).toBe(true);
      expect(report.automationPolicy).toBe(CanonicalAutomationPolicy.RESTRICTED_MANUAL_ONLY);
      expect(report.policyNotice).toBeDefined();
      expect(report.policyNotice).toMatch(/May 2026|Manual-entry/i);
      expect(report.isReady).toBe(true);
      expect(report.summary).toMatch(/Manual-Entry Assistant/i);
    });

    it('marks SED ₹300 readiness report with isManualOnly=false', () => {
      const report = testProfileReadiness(sampleProfile, [samplePilgrim], 'special-entry-darshan-300');
      expect(report.isManualOnly).toBe(false);
      expect(report.automationPolicy).toBe(CanonicalAutomationPolicy.PERMITTED_USER_INITIATED);
      expect(report.policyNotice).toMatch(/User-initiated assistance only/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Next Action Model Routing for Policy-Compliant Flow
  // ─────────────────────────────────────────────────────────────
  describe('Next Action Model Routing', () => {
    it('routes Srivani Trust with ready profile to START_MANUAL_ASSISTANT', () => {
      const readiness = {
        isReady: true,
        allPilgrimsReady: true,
        pilgrimCountReady: true,
        generalDetailsReady: true,
        checks: [],
        missingItems: [],
        firstMissingItem: null,
        totalChecks: 5,
        passedChecks: 5,
        failedChecks: 0,
        summary: 'Ready',
        serviceId: 'srivani-trust',
        isManualOnly: true,
        policyNotice: 'TTD policy active',
      };

      const nextAction = computeNextAction({
        activeProfile: sampleProfile,
        selectedPilgrims: [samplePilgrim],
        serviceId: 'srivani-trust',
        serviceDisplayName: 'Srivani Trust Donation & Darshan',
        pageDetected: true,
        productState: 'READY',
        fillStage: { stage: 'idle' },
        temporaryLock: false,
        readiness: readiness as any,
      });

      expect(nextAction.primaryAction.actionType).toBe('START_MANUAL_ASSISTANT');
      expect(nextAction.primaryAction.label).toMatch(/OPEN MANUAL ASSISTANT/i);
      expect(nextAction.headline).toMatch(/Manual-Entry/i);
    });

    it('never assigns TRIGGER_FILL to Srivani Trust even when pageDetected is true', () => {
      const readiness = {
        isReady: true,
        allPilgrimsReady: true,
        pilgrimCountReady: true,
        generalDetailsReady: true,
        checks: [],
        missingItems: [],
        firstMissingItem: null,
        totalChecks: 5,
        passedChecks: 5,
        failedChecks: 0,
        summary: 'Ready',
        serviceId: 'srivani-trust',
        isManualOnly: true,
      };

      const nextAction = computeNextAction({
        activeProfile: sampleProfile,
        selectedPilgrims: [samplePilgrim],
        serviceId: 'srivani-trust',
        serviceDisplayName: 'Srivani Trust',
        pageDetected: true,
        productState: 'READY',
        fillStage: { stage: 'idle' },
        temporaryLock: false,
        readiness: readiness as any,
      });

      expect(nextAction.primaryAction.actionType).not.toBe('TRIGGER_FILL');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Zero-PII Logger Sanitization
  // ─────────────────────────────────────────────────────────────
  describe('Zero-PII Logger Sanitization', () => {
    it('masks Aadhaar 12-digit numbers while preserving only last 4 digits in objects', () => {
      const payload = {
        idNumber: '999911112222',
        serviceId: 'srivani-trust',
      };
      const sanitized = sanitizeForLogging(payload) as any;
      expect(sanitized.idNumber).toBe('******2222');
      expect(sanitized.serviceId).toBe('srivani-trust');
    });

    it('masks 10-digit mobile numbers while preserving only last 2 digits', () => {
      const payload = {
        mobile: '9876543210',
        action: 'CHECK_SESSION',
      };
      const sanitized = sanitizeForLogging(payload) as any;
      expect(sanitized.mobile).toBe('******10');
      expect(sanitized.action).toBe('CHECK_SESSION');
    });

    it('redacts devotee name, email, and address from logged objects', () => {
      const devoteePayload = {
        name: 'Venkata Ramanuja',
        email: 'raman@example.com',
        address: '42 South Mada St, Tirumala',
        pincode: '517504',
        durationMs: 142,
      };
      const sanitized = sanitizeForLogging(devoteePayload) as any;
      expect(sanitized.name).toBe('[REDACTED_PII]');
      expect(sanitized.email).toBe('***@***');
      expect(sanitized.address).toBe('[REDACTED_PII]');
      expect(sanitized.durationMs).toBe(142);
    });

    it('handles nested objects recursively without mutating original data', () => {
      const complex = {
        profile: {
          pilgrims: [
            {
              name: 'Annamayya',
              idNumber: '123456789012',
            },
          ],
        },
        meta: { ok: true },
      };
      const sanitized = sanitizeForLogging(complex) as any;
      expect(sanitized.profile.pilgrims[0].name).toBe('[REDACTED_PII]');
      expect(sanitized.profile.pilgrims[0].idNumber).toBe('******9012');
      expect(sanitized.meta.ok).toBe(true);

      // Verify original is untouched
      expect(complex.profile.pilgrims[0].name).toBe('Annamayya');
      expect(complex.profile.pilgrims[0].idNumber).toBe('123456789012');
    });
  });
});
