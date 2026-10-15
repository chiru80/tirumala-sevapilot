// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CANONICAL_SPECIAL_ENTRY_300,
  CANONICAL_PADMAVATHI_200,
  CANONICAL_HOMAM_1600,
  CANONICAL_SRIVARI_SEVA,
  CANONICAL_SRIVANI_TRUST,
  CANONICAL_ACCOMMODATION,
  SAFE_CANONICAL_UNKNOWN_SERVICE,
  getCanonicalService,
  resolveCanonicalService,
  isServiceAutofillAllowed,
  isServiceManualOnly,
  getCanonicalFieldRules,
} from '../../src/services/canonical-service-registry';
import {
  performTextTransaction,
  performDropdownTransaction,
  executeDropdownTransaction,
} from '../../src/content/autofill/field-transaction';
import { Gender, IdType, ServiceType } from '../../src/shared/types';

describe('Phase 2: Multi-Service Form Compatibility & Hardening', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Portal Phase 2');
    doc.body.innerHTML = '';
  });

  // ─── 1. Canonical Service Registry Multi-Flow Verification ───
  describe('1. Multi-Flow Canonical Service Registry', () => {
    it('SED ₹300: enforces 1–6 devotee party limits and required fields', () => {
      const sed = getCanonicalService('special-entry-300');
      expect(sed).toBeDefined();
      expect(sed?.serviceId).toBe('special-entry-darshan-300');
      expect(sed?.maxPilgrims).toBe(6);
      expect(sed?.exactPilgrims).toBeUndefined();
      expect(sed?.automationPolicy).toBe('PERMITTED_USER_INITIATED');
      expect(sed?.requiredPilgrimFields).toContain('name');
      expect(sed?.requiredPilgrimFields).toContain('age');
      expect(sed?.requiredPilgrimFields).toContain('gender');
      expect(sed?.requiredPilgrimFields).toContain('idProofType');
      expect(sed?.requiredPilgrimFields).toContain('idProofNumber');
    });

    it('Homam ₹1600: enforces EXACT 2 devotee party size and gothram field rules', () => {
      const homam = getCanonicalService('homam-1600');
      expect(homam).toBeDefined();
      expect(homam?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
      expect(homam?.maxPilgrims).toBe(2);
      expect(homam?.exactPilgrims).toBe(2); // Strict exact-2 rule
      expect(homam?.automationPolicy).toBe('PERMITTED_USER_INITIATED');
      const rules = getCanonicalFieldRules('homam-1600');
      expect(rules.generalFields['gothram']).toBeDefined();
    });

    it('Accommodation: supports 1–4 devotees, cottage/room flows, and general contact details', () => {
      const accom = getCanonicalService('accommodation');
      expect(accom).toBeDefined();
      expect(accom?.serviceId).toBe('accommodation');
      expect(accom?.maxPilgrims).toBe(4);
      expect(accom?.hasGeneralDetailsStep).toBe(true);
      expect(accom?.automationPolicy).toBe('PERMITTED_USER_INITIATED');
      expect(accom?.userControlledFields).toContain('roomSelection');
    });

    it('Srivani: strictly enforces RESTRICTED_MANUAL_ONLY policy', () => {
      const srivani = getCanonicalService('srivani');
      expect(srivani).toBeDefined();
      expect(srivani?.automationPolicy).toBe('RESTRICTED_MANUAL_ONLY');
      expect(isServiceAutofillAllowed('srivani')).toBe(false);
      expect(isServiceManualOnly('srivani')).toBe(true);
    });

    it('Unknown flow: fails closed to SAFE_CANONICAL_UNKNOWN_SERVICE', () => {
      const unknown = getCanonicalService('completely-unknown-service');
      expect(unknown).toBeUndefined();
      expect(isServiceAutofillAllowed('completely-unknown-service')).toBe(false);
      expect(isServiceManualOnly('completely-unknown-service')).toBe(true);

      const resolved = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/unknown-custom-route', doc);
      expect(resolved.isUncertain).toBe(true);
      expect(isServiceAutofillAllowed(resolved.service?.serviceId || '')).toBe(false);
    });

    it('Route Dominance: accurately resolves accommodation URLs', () => {
      const resolved = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/accommodation/booking?flow=rooms', doc);
      expect(resolved.service?.serviceId).toBe('accommodation');
      expect(resolved.confidence).toBe(100);
      expect(resolved.isUncertain).toBe(false);
    });
  });

  // ─── 2. Mobile Number ISD Normalization ───
  describe('2. Mobile Number ISD Normalization', () => {
    it('normalizes +91 country code into 10 digits when field has maxLength 10', async () => {
      const mobileInput = doc.createElement('input');
      mobileInput.type = 'tel';
      mobileInput.name = 'mobileNumber';
      mobileInput.setAttribute('formcontrolname', 'mobile');
      mobileInput.maxLength = 10;
      doc.body.appendChild(mobileInput);

      await performTextTransaction(mobileInput, '+919876543210');
      expect(mobileInput.value).toBe('9876543210');
    });

    it('normalizes 91 prefix into 10 digits when field has maxLength 10', async () => {
      const mobileInput = doc.createElement('input');
      mobileInput.type = 'tel';
      mobileInput.name = 'mobile';
      mobileInput.maxLength = 10;
      doc.body.appendChild(mobileInput);

      await performTextTransaction(mobileInput, '919876543210');
      expect(mobileInput.value).toBe('9876543210');
    });

    it('leaves standard 10-digit mobile numbers untouched', async () => {
      const mobileInput = doc.createElement('input');
      mobileInput.type = 'tel';
      mobileInput.name = 'mobile';
      mobileInput.maxLength = 10;
      doc.body.appendChild(mobileInput);

      await performTextTransaction(mobileInput, '9876543210');
      expect(mobileInput.value).toBe('9876543210');
    });
  });

  // ─── 3. Dynamic PrimeNG & CDK Dropdown Resilience ───
  describe('3. Dynamic PrimeNG & CDK Dropdown Resilience', () => {
    it('successfully triggers and selects option from PrimeNG .p-dropdown structure', async () => {
      const dropdownContainer = doc.createElement('div');
      dropdownContainer.className = 'p-dropdown p-component';
      dropdownContainer.setAttribute('role', 'combobox');

      const trigger = doc.createElement('div');
      trigger.className = 'p-dropdown-trigger';
      dropdownContainer.appendChild(trigger);
      doc.body.appendChild(dropdownContainer);

      // Simulate PrimeNG dynamic overlay mounting upon trigger interaction
      dropdownContainer.addEventListener('click', () => {
        let panel = doc.querySelector('.p-dropdown-panel');
        if (!panel) {
          panel = doc.createElement('div');
          panel.className = 'p-dropdown-panel';
          panel.innerHTML = `
            <ul class="p-dropdown-items" role="listbox">
              <li class="p-dropdown-item" role="option" data-value="Aadhaar" ng-reflect-label="Aadhaar Card">Aadhaar Card</li>
              <li class="p-dropdown-item" role="option" data-value="Passport" ng-reflect-label="Passport">Passport</li>
              <li class="p-dropdown-item" role="option" data-value="Voter ID" ng-reflect-label="Voter ID">Voter ID</li>
            </ul>
          `;
          doc.body.appendChild(panel);
        }
      });

      await performDropdownTransaction(dropdownContainer, 'Aadhaar Card', 'photoIdProof', doc);

      // Verify dropdown transaction set value and data-selected-value
      expect(dropdownContainer.getAttribute('data-selected-value')).toBe('Aadhaar Card');
    });

    it('executes PrimeNG dropdown transaction and verifies with executeDropdownTransaction', async () => {
      const dropdownContainer = doc.createElement('div');
      dropdownContainer.className = 'p-dropdown';

      const trigger = doc.createElement('div');
      trigger.className = 'p-dropdown-trigger';
      dropdownContainer.appendChild(trigger);
      doc.body.appendChild(dropdownContainer);

      dropdownContainer.addEventListener('click', () => {
        const panel = doc.createElement('div');
        panel.className = 'p-dropdown-panel';
        panel.innerHTML = `
          <ul class="p-dropdown-items">
            <li class="p-dropdown-item" data-value="Male">Male</li>
            <li class="p-dropdown-item" data-value="Female">Female</li>
          </ul>
        `;
        doc.body.appendChild(panel);
      });

      const res = await executeDropdownTransaction(dropdownContainer, 'Male', 'gender', 0, doc);
      expect(res.status).toBe('verified');
      expect(res.verified).toBe(true);
      expect(res.field).toBe('gender');
    });
  });
});
