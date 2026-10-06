// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  getServiceConfig,
  SPECIAL_ENTRY_300_CONFIG,
  PADMAVATHI_200_CONFIG,
  HOMAM_1600_CONFIG,
} from '../../../src/services/ttd-information/ttd-service-rules';
import { ServiceRecognitionEngine } from '../../../src/services/service-recognition-engine';

describe('Phase 5 — Verified TTD Service Registry & Recognition', () => {
  describe('1. ₹300 Special Entry Darshan Registry & Rules', () => {
    it('retrieves verified configuration for special-entry-300', () => {
      const config = getServiceConfig('special-entry-300');
      expect(config).toBeDefined();
      expect(config?.serviceId).toBe('special-entry-300');
      expect(config?.workflowId).toBe('special-entry-v1');
      expect(config?.price).toBe(300);
      expect(config?.maxPilgrims).toBe(6);
      expect(config?.requiresPilgrims).toBe(true);

      // Pilgrim Details
      expect(config?.requiredPilgrimFields).toEqual(['fullName', 'age', 'gender', 'idType', 'idNumber']);

      // General Details: Email, City, State, Country, PinCode required
      expect(config?.requiredGeneralFields).toContain('email');
      expect(config?.requiredGeneralFields).toContain('city');
      expect(config?.requiredGeneralFields).toContain('state');
      expect(config?.requiredGeneralFields).toContain('country');
      expect(config?.requiredGeneralFields).toContain('pinCode');

      // Mobile is OPTIONAL per Phase 5 rules
      expect(config?.optionalGeneralFields).toContain('mobile');
      expect(config?.requiredGeneralFields).not.toContain('mobile');
      expect(config?.verified).toBe(true);
    });

    it('recognizes Special Entry Darshan from DOM and returns Phase 5 contract', () => {
      document.body.innerHTML = `
        <h1>Special Entry Darshan (Sri PAT)</h1>
        <label>Photo ID Proof</label>
        <label>Photo Id Number</label>
      `;
      document.title = 'TTD Online Booking - Special Entry Darshan';

      const result = ServiceRecognitionEngine.recognize(
        'https://ttdevasthanams.ap.gov.in/sed/pilgrim-details',
        document
      );

      expect(result.status).toBe('detected');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.strategy).toContain('multi-signal');
      expect(result.workflowId).toBe('special-entry-v1');
      expect(result.verified).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe('2. ₹200 Padmavathi Ammavari Special Entry Registry & Rules', () => {
    it('retrieves verified configuration with NO General Details required', () => {
      const config = getServiceConfig('padmavathi-special-entry-200');
      expect(config).toBeDefined();
      expect(config?.serviceId).toBe('padmavathi-special-entry-200');
      expect(config?.workflowId).toBe('padmavathi-v1');
      expect(config?.price).toBe(200);
      expect(config?.maxPilgrims).toBe(6);

      // In verified observed flow, General Details were NOT requested
      expect(config?.requiredGeneralFields.length).toBe(0);
      expect(config?.verified).toBe(true);
    });

    it('recognizes Padmavathi entry from DOM and sets workflowId and verified status', () => {
      document.body.innerHTML = `
        <h2>Sri Padmavathi Ammavari Supadham Entry ₹200</h2>
        <label>Devotee Name</label>
        <label>Photo ID Proof</label>
      `;
      document.title = 'Sri Padmavathi Ammavari Supadham Entry';

      const result = ServiceRecognitionEngine.recognize(
        'https://ttdevasthanams.ap.gov.in/padmavathi/booking',
        document
      );

      expect(result.status).toBe('detected');
      expect(result.workflowId).toBe('padmavathi-v1');
      expect(result.verified).toBe(true);
    });
  });

  describe('3. Sri Srinivasa Divyanugraha Homam Registry & Rules', () => {
    it('enforces exact 2 pilgrims and Gothram in General Details', () => {
      const config = getServiceConfig('sri-srinivasa-divyanugraha-homam');
      expect(config).toBeDefined();
      expect(config?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
      expect(config?.workflowId).toBe('homam-v1');
      expect(config?.price).toBe(1600);
      expect(config?.exactPilgrims).toBe(2);
      expect(config?.minPilgrims).toBe(2);
      expect(config?.maxPilgrims).toBe(2);

      // Gothram required
      expect(config?.specialRequirements?.gothram).toBe(true);
      expect(config?.requiredGeneralFields).toContain('gothram');
      expect(config?.requiredGeneralFields).toContain('email');

      // Mobile is OPTIONAL per Phase 5 rules
      expect(config?.requiredGeneralFields).not.toContain('mobile');
      expect(config?.optionalGeneralFields).toContain('mobile');
      expect(config?.verified).toBe(true);
    });

    it('recognizes Homam from DOM and sets homam-v1 workflow', () => {
      document.body.innerHTML = `
        <h1>Sri Srinivasa Divyanugraha Homam</h1>
        <label>Gothram</label>
        <label>Photo ID Proof</label>
      `;
      document.title = 'TTD Divyanugraha Homam Booking';

      const result = ServiceRecognitionEngine.recognize(
        'https://ttdevasthanams.ap.gov.in/divyanugraha/booking',
        document
      );

      expect(result.status).toBe('detected');
      expect(result.workflowId).toBe('homam-v1');
      expect(result.verified).toBe(true);
    });
  });

  describe('4. Future / Unverified Services Safety', () => {
    it('returns workflowId = UNKNOWN and verified = false for unconfirmed services', () => {
      const srivani = getServiceConfig('srivani');
      expect(srivani).toBeDefined();
      expect(srivani?.workflowId).toBe('UNKNOWN');
      expect(srivani?.verified).toBe(false);

      const accommodation = getServiceConfig('accommodation');
      expect(accommodation).toBeDefined();
      expect(accommodation?.workflowId).toBe('UNKNOWN');
      expect(accommodation?.verified).toBe(false);
    });

    it('returns undefined for non-existent service ID without crashing', () => {
      expect(getServiceConfig('non-existent-service-999')).toBeUndefined();
    });
  });
});
