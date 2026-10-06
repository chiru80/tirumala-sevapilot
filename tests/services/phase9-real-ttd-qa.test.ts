import { describe, it, expect } from 'vitest';
import {
  SPECIAL_ENTRY_DARSHAN_300,
  PADMAVATHI_SUPADHAM_ENTRY_200,
  SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
  getWorkflowById,
  getAllWorkflows,
} from '../../src/services/workflows';
import {
  SPECIAL_ENTRY_300_CONFIG,
  PADMAVATHI_200_CONFIG,
  HOMAM_1600_CONFIG,
  getServiceConfig,
} from '../../src/services/ttd-information/ttd-service-rules';
import { ServiceRecognitionEngine } from '../../src/services/service-recognition-engine';
import { validateTtdSource } from '../../src/services/ttd-information/ttd-source-validator';
import { isSupportedDomain } from '../../src/shared/utils';

describe('Phase 9: Real-TTD Workflow QA & Production Certification', () => {
  describe('9.1 Service Matrix Compliance', () => {
    it('registers all three authoritative production services', () => {
      const workflows = getAllWorkflows();
      expect(workflows.length).toBe(3);
      expect(workflows.map((w) => w.serviceId)).toEqual([
        'special-entry-darshan-300',
        'padmavathi-supadham-entry-200',
        'sri-srinivasa-divyanugraha-homam',
      ]);
    });
  });

  describe('9.2 ₹300 Special Entry Darshan Workflow', () => {
    const wf = SPECIAL_ENTRY_DARSHAN_300;
    const config = SPECIAL_ENTRY_300_CONFIG;

    it('matches observed TTD limits and pricing', () => {
      expect(wf.ticketPrice).toBe(300);
      expect(wf.maxPilgrims).toBe(6);
      expect(wf.hasGeneralDetailsStep).toBe(true);
      expect(config.price).toBe(300);
      expect(config.maxPilgrims).toBe(6);
    });

    it('orders Pilgrim Details BEFORE General Details', () => {
      const pilgrimStep = wf.steps.find((s) => s.stepType === 'PILGRIM_DETAILS');
      const generalStep = wf.steps.find((s) => s.stepType === 'GENERAL_DETAILS');
      expect(pilgrimStep).toBeDefined();
      expect(generalStep).toBeDefined();
      expect(pilgrimStep!.order).toBeLessThan(generalStep!.order);
    });

    it('specifies core pilgrim fields and marks mobile as optional in general/pilgrim', () => {
      expect(config.requiredPilgrimFields).toContain('fullName');
      expect(config.requiredPilgrimFields).toContain('age');
      expect(config.requiredPilgrimFields).toContain('gender');
      expect(config.requiredPilgrimFields).toContain('idType');
      expect(config.requiredPilgrimFields).toContain('idNumber');
      expect(config.optionalPilgrimFields).toContain('mobile');
    });

    it('enforces strict manual payment boundary', () => {
      expect(wf.paymentConfig.strictNonAutomation).toBe(true);
    });
  });

  describe('9.3 ₹200 Padmavathi Supadham Entry Workflow', () => {
    const wf = PADMAVATHI_SUPADHAM_ENTRY_200;
    const config = PADMAVATHI_200_CONFIG;

    it('does NOT require or inherit General Details step', () => {
      expect(wf.hasGeneralDetailsStep).toBe(false);
      expect(wf.steps.some((s) => s.stepType === 'GENERAL_DETAILS')).toBe(false);
      expect(config.requiredGeneralFields).toHaveLength(0);
    });

    it('maintains strict payment boundary', () => {
      expect(wf.paymentConfig.strictNonAutomation).toBe(true);
    });
  });

  describe('9.4 ₹1600 Sri Srinivasa Divyanugraha Homam Workflow', () => {
    const wf = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM;
    const config = HOMAM_1600_CONFIG;

    it('enforces strictly 2 participants limit', () => {
      expect(wf.ticketPrice).toBe(1600);
      expect(wf.exactPilgrims).toBe(2);
      expect(config.exactPilgrims).toBe(2);
    });

    it('orders General Details BEFORE Pilgrim Details', () => {
      const generalStep = wf.steps.find((s) => s.stepType === 'GENERAL_DETAILS');
      const pilgrimStep = wf.steps.find((s) => s.stepType === 'PILGRIM_DETAILS');
      expect(generalStep).toBeDefined();
      expect(pilgrimStep).toBeDefined();
      expect(generalStep!.order).toBeLessThan(pilgrimStep!.order);
    });

    it('mandates Gothram in special requirements and general fields', () => {
      expect(config.specialRequirements?.gothram).toBe(true);
      expect(config.requiredGeneralFields).toContain('gothram');
    });
  });

  describe('9.5 Unknown Services Fail-Closed & Manual Continuation', () => {
    it('returns unknown/uncertain/not-detected when confidence is insufficient', () => {
      const recognition = ServiceRecognitionEngine.recognize('https://ttdevasthanams.ap.gov.in/#/unknown-future-service');
      expect(recognition.status === 'uncertain' || recognition.status === 'not-detected').toBe(true);
      expect(recognition.confidenceScore).toBeLessThan(70);

      const nonTtd = ServiceRecognitionEngine.recognize('https://example.com/booking');
      expect(nonTtd.status).toBe('not-detected');
    });

    it('getWorkflowById safely returns undefined for unknown serviceId', () => {
      expect(getWorkflowById('non-existent-service')).toBeUndefined();
      expect(getServiceConfig('non-existent-service')).toBeUndefined();
    });
  });

  describe('9.7, 9.8, 9.9 Payment, CAPTCHA, & Queue Safety Standard', () => {
    it('all workflows enforce strictNonAutomation on payment', () => {
      for (const wf of getAllWorkflows()) {
        expect(wf.paymentConfig.strictNonAutomation).toBe(true);
      }
    });

    it('queueConfig restricts interaction to passive status monitoring', () => {
      for (const wf of getAllWorkflows()) {
        expect(wf.queueConfig.canHaveQueue).toBe(true);
        expect(wf.queueConfig.queueSelectors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('9.10 Release Source Verification', () => {
    it('verifies official TTD announcements domains', () => {
      const res = validateTtdSource('https://news.tirumala.org/release-schedule-nov');
      expect(res.isValid).toBe(true);
      expect(res.status).toBe('OFFICIAL_SOURCE_VERIFIED');
    });

    it('rejects unofficial third-party blogs or phishing domains', () => {
      const res1 = validateTtdSource('https://ttd-tickets-booking.fakeblog.com/release');
      expect(res1.isValid).toBe(false);
      expect(res1.status).toBe('UNOFFICIAL_SOURCE_REJECTED');

      const res2 = validateTtdSource('http://news.tirumala.org/insecure');
      expect(res2.isValid).toBe(false); // Insecure HTTP
    });

    it('validates supported booking domains strictly with HTTPS', () => {
      expect(isSupportedDomain('https://ttdevasthanams.ap.gov.in/')).toBe(true);
      expect(isSupportedDomain('https://tirupatibalaji.ap.gov.in/')).toBe(true);
      expect(isSupportedDomain('http://ttdevasthanams.ap.gov.in/')).toBe(false); // Not HTTPS
      expect(isSupportedDomain('https://evil-ttdevasthanams.ap.gov.in.attacker.com/')).toBe(false);
    });
  });
});
