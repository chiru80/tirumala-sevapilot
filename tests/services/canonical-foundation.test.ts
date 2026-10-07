// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  getCanonicalService,
  getAllCanonicalServices,
  resolveCanonicalService,
  getCanonicalServiceLimits,
  getCanonicalFieldRules,
  hasGeneralDetails,
  isFieldRequiredForService,
  isFieldUserControlled,
  CANONICAL_SPECIAL_ENTRY_300,
  CANONICAL_PADMAVATHI_200,
  CANONICAL_HOMAM_1600,
  CANONICAL_SRIVARI_SEVA,
} from '../../src/services/canonical-service-registry';
import {
  ReadinessEngine,
  BookingReadiness,
} from '../../src/services/readiness-engine';
import { srivariSevaAdapter } from '../../src/services/srivari-seva';
import { darshanAdapter } from '../../src/services/darshan';
import { ServiceType, Profile, Pilgrim, Gender, IdType } from '../../src/shared/types';
import { detectActiveBookingStep } from '../../src/content/autofill/page-workflow';
import { detectTtdTemporaryLock } from '../../src/services/ttd-information/ttd-lock-detector';
import { classifyError } from '../../src/services/error-classification';
import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';

describe('Phase 1 — Canonical Service Foundation', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Service Registry Resolution & Safety
  // ─────────────────────────────────────────────────────────────
  describe('Service Registry Resolution', () => {
    it('₹300 Special Entry Darshan resolves correctly by ID and aliases', () => {
      const canonical = getCanonicalService('special-entry-darshan-300');
      expect(canonical).toBeDefined();
      expect(canonical?.serviceId).toBe('special-entry-darshan-300');
      expect(canonical?.displayName).toBe('Special Entry Darshan ₹300');
      expect(getCanonicalService('special-entry-300')?.serviceId).toBe('special-entry-darshan-300');
      expect(getCanonicalService('sed-300')?.serviceId).toBe('special-entry-darshan-300');
    });

    it('₹200 Padmavathi / Sri PAT resolves correctly with route dominance', () => {
      const canonical = getCanonicalService('padmavathi-supadham-entry-200');
      expect(canonical).toBeDefined();
      expect(canonical?.serviceId).toBe('padmavathi-supadham-entry-200');
      expect(canonical?.displayName).toBe('Padmavathi / Sri PAT');
      expect(getCanonicalService('spat')?.serviceId).toBe('padmavathi-supadham-entry-200');

      // SPAT route dominance over generic darshan
      const spatRes = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/spat/booking');
      expect(spatRes.service?.serviceId).toBe('padmavathi-supadham-entry-200');
      expect(spatRes.confidence).toBe(100);
      expect(spatRes.isUncertain).toBe(false);
    });

    it('₹1600 Homam resolves correctly without generic darshan collision', () => {
      const canonical = getCanonicalService('sri-srinivasa-divyanugraha-homam');
      expect(canonical).toBeDefined();
      expect(canonical?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
      expect(canonical?.ticketPrice).toBe(1600);
      expect(getCanonicalService('homam-1600')?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    });

    it('Srivari Seva resolves correctly with route dominance', () => {
      const canonical = getCanonicalService('srivari-seva');
      expect(canonical).toBeDefined();
      expect(canonical?.serviceId).toBe('srivari-seva');
      expect(canonical?.displayName).toBe('Srivari Seva');

      const srivariRes = resolveCanonicalService('https://srivariseva.tirumala.org/srivari-seva/enroll');
      expect(srivariRes.service?.serviceId).toBe('srivari-seva');
      expect(srivariRes.confidence).toBe(100);
    });

    it('ambiguous or unknown URLs resolve with uncertainty', () => {
      const res = resolveCanonicalService('https://google.com');
      expect(res.service).toBeUndefined();
      expect(res.isUncertain).toBe(true);
      expect(res.confidence).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Canonical Pilgrim Limits (K02 Srivari Seva Resolution)
  // ─────────────────────────────────────────────────────────────
  describe('Canonical Pilgrim Limits', () => {
    it('₹300 Special Entry Darshan limits: 1 to 6 pilgrims', () => {
      const limits = getCanonicalServiceLimits('special-entry-darshan-300');
      expect(limits.minPilgrims).toBe(1);
      expect(limits.maxPilgrims).toBe(6);
      expect(limits.exactPilgrims).toBeUndefined();
    });

    it('₹200 Padmavathi / SPAT limits: 1 to 6 pilgrims', () => {
      const limits = getCanonicalServiceLimits('padmavathi-supadham-entry-200');
      expect(limits.minPilgrims).toBe(1);
      expect(limits.maxPilgrims).toBe(6);
    });

    it('₹1600 Homam limits: STRICTLY exact 2 householders', () => {
      const limits = getCanonicalServiceLimits('sri-srinivasa-divyanugraha-homam');
      expect(limits.minPilgrims).toBe(2);
      expect(limits.maxPilgrims).toBe(2);
      expect(limits.exactPilgrims).toBe(2);
    });

    it('K02 Resolution: Srivari Seva canonical limit is STRICTLY 1 pilgrim (NOT 10)', () => {
      const limits = getCanonicalServiceLimits('srivari-seva');
      expect(limits.minPilgrims).toBe(1);
      expect(limits.maxPilgrims).toBe(1);
      expect(limits.exactPilgrims).toBe(1);

      // Verify that legacy adapter derives directly from canonical service definition
      expect(srivariSevaAdapter.maxPilgrims).toBe(1);
    });

    it('darshanAdapter derives maxPilgrims from canonical SED definition', () => {
      expect(darshanAdapter.maxPilgrims).toBe(6);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. General Details Domain Presence (K06 Resolution)
  // ─────────────────────────────────────────────────────────────
  describe('General Details Domain Rules', () => {
    it('₹300 SED requires General Details step', () => {
      expect(hasGeneralDetails('special-entry-darshan-300')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'email')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'city')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'state')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'country')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'pincode')).toBe(true);
      expect(isFieldRequiredForService('special-entry-darshan-300', 'general', 'mobile')).toBe(false); // optional
    });

    it('₹200 Padmavathi / SPAT does NOT have General Details step in verified flow', () => {
      expect(hasGeneralDetails('padmavathi-supadham-entry-200')).toBe(false);
      // Fields are marked NOT_PRESENT and are not required
      expect(isFieldRequiredForService('padmavathi-supadham-entry-200', 'general', 'email')).toBe(false);
      expect(isFieldRequiredForService('padmavathi-supadham-entry-200', 'general', 'city')).toBe(false);
      expect(isFieldRequiredForService('padmavathi-supadham-entry-200', 'general', 'pincode')).toBe(false);
    });

    it('₹1600 Homam requires General Details with GOTHRAM mandatory', () => {
      expect(hasGeneralDetails('sri-srinivasa-divyanugraha-homam')).toBe(true);
      expect(isFieldRequiredForService('sri-srinivasa-divyanugraha-homam', 'general', 'gothram')).toBe(true);
      expect(isFieldRequiredForService('sri-srinivasa-divyanugraha-homam', 'general', 'email')).toBe(true);
      expect(isFieldRequiredForService('sri-srinivasa-divyanugraha-homam', 'general', 'city')).toBe(true);
    });

    it('Srivari Seva uses unified enrollment rules with required full address', () => {
      expect(hasGeneralDetails('srivari-seva')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'doorNumber')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'street')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'district')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'pincode')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'state')).toBe(true);
      expect(isFieldRequiredForService('srivari-seva', 'pilgrim', 'country')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Field Classifications & Safety Controls
  // ─────────────────────────────────────────────────────────────
  describe('Field Classifications & Safety Controls', () => {
    it('Srivari Seva declarations and fitness attestations are USER_CONTROLLED', () => {
      expect(isFieldUserControlled('srivari-seva', 'declaration')).toBe(true);
      expect(isFieldUserControlled('srivari-seva', 'mentallyFit')).toBe(true);
      expect(isFieldUserControlled('srivari-seva', 'physicallyFit')).toBe(true);
    });

    it('SED declaration is USER_CONTROLLED and must never be auto-ticked', () => {
      expect(isFieldUserControlled('special-entry-darshan-300', 'declaration')).toBe(true);
    });

    it('Prohibited fields contain sensitive items across all canonical services', () => {
      const allServices = getAllCanonicalServices();
      for (const service of allServices) {
        expect(service.fieldRules.prohibitedFields).toContain('otp');
        expect(service.fieldRules.prohibitedFields).toContain('password');
      }
    });

    it('Optional fields for Srivari Seva are correctly classified', () => {
      const rules = getCanonicalFieldRules('srivari-seva');
      expect(rules.pilgrimFields['fatherSpouseName']).toBe('OPTIONAL');
      expect(rules.pilgrimFields['email']).toBe('OPTIONAL');
      expect(rules.pilgrimFields['bloodGroup']).toBe('OPTIONAL');
      expect(rules.pilgrimFields['profession']).toBe('OPTIONAL');
      expect(rules.pilgrimFields['qualification']).toBe('OPTIONAL');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Canonical Readiness Contract (K04 & K12)
  // ─────────────────────────────────────────────────────────────
  describe('Canonical Booking Readiness Evaluations', () => {
    const validAadhaar1 = '23456789012' + generateVerhoeffChecksum('23456789012');
    const validAadhaar2 = '34567890123' + generateVerhoeffChecksum('34567890123');

    const validDevotee1: Pilgrim = {
      id: 'p1',
      firstName: 'Venkata',
      lastName: 'Raman',
      fullName: 'Venkata Raman',
      age: 42,
      gender: Gender.MALE,
      idType: IdType.AADHAAR,
      idNumber: validAadhaar1,
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
      mobile: '9876543210',
      email: 'devotee@example.com',
      district: 'Chittoor',
      dateOfBirth: '1982-05-15',
      photo: 'data:image/jpeg;base64,sample',
      srivariSeva: {
        doorNumber: '12-3',
        street: 'Temple Street',
      },
      createdAt: '2026-01-01',
    };

    const validDevotee2: Pilgrim = {
      id: 'p2',
      firstName: 'Lakshmi',
      lastName: 'Raman',
      fullName: 'Lakshmi Raman',
      age: 38,
      gender: Gender.FEMALE,
      idType: IdType.AADHAAR,
      idNumber: validAadhaar2,
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
      mobile: '9876543211',
      email: 'devotee2@example.com',
      district: 'Chittoor',
      dateOfBirth: '1986-08-20',
      photo: 'data:image/jpeg;base64,sample2',
      srivariSeva: {
        doorNumber: '12-3',
        street: 'Temple Street',
      },
      createdAt: '2026-01-01',
    };

    const validProfile: Profile = {
      id: 'prof-1',
      name: 'Family Profile',
      pilgrims: [validDevotee1],
      isDefault: true,
      general: {
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
        email: 'contact@example.com',
        mobile: '9876543210',
        gothram: 'Kashyapa',
      },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('returns NOT_READY when profile is null', () => {
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        null,
        ServiceType.DARSHAN,
        'special-entry-darshan-300',
      );
      expect(readiness.status).toBe('NOT_READY');
      expect(readiness.canFill).toBe(false);
      expect(readiness.headline).toContain('No pilgrim profile');
    });

    it('returns ACTION_REQUIRED when required pilgrim fields are incomplete', () => {
      const incompleteProfile: Profile = {
        ...validProfile,
        pilgrims: [{
          ...validDevotee1,
          idNumber: '', // missing ID number
        }],
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        incompleteProfile,
        ServiceType.DARSHAN,
        'special-entry-darshan-300',
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.canFill).toBe(false);
      expect(readiness.diagnostics?.missingFields.length).toBeGreaterThan(0);
    });

    it('returns READY for complete ₹300 profile', () => {
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        validProfile,
        ServiceType.DARSHAN,
        'special-entry-darshan-300',
        undefined,
        true, // pageDetected
      );
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
      expect(readiness.maxPilgrims).toBe(6);
    });

    it('returns READY for ₹200 Padmavathi even without general details email/address', () => {
      const profileNoGeneral: Profile = {
        ...validProfile,
        general: undefined,
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        profileNoGeneral,
        ServiceType.DARSHAN,
        'padmavathi-supadham-entry-200',
        undefined,
        true, // pageDetected
      );
      // In ₹200, General Details is NOT_PRESENT, so missing general details does NOT block readiness
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
    });

    it('enforces exact 2 pilgrims for Homam: 1 devotee yields ACTION_REQUIRED', () => {
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        validProfile, // only 1 devotee in validProfile
        ServiceType.ARJITHA_SEVA,
        'sri-srinivasa-divyanugraha-homam',
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.exactPilgrims).toBe(2);
      expect(readiness.headline).toContain('2');
    });

    it('accepts exact 2 pilgrims for Homam when 2 are provided with Gothram', () => {
      const homamProfile: Profile = {
        ...validProfile,
        pilgrims: [validDevotee1, validDevotee2],
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        homamProfile,
        ServiceType.ARJITHA_SEVA,
        'sri-srinivasa-divyanugraha-homam',
        undefined,
        true, // pageDetected
      );
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
    });

    it('enforces Gothram for Homam: missing Gothram yields ACTION_REQUIRED', () => {
      const homamNoGothram: Profile = {
        ...validProfile,
        pilgrims: [validDevotee1, validDevotee2],
        general: {
          ...validProfile.general!,
          gothram: undefined,
        },
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        homamNoGothram,
        ServiceType.ARJITHA_SEVA,
        'sri-srinivasa-divyanugraha-homam',
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.headline).toContain('Gothram');
    });

    it('enforces strictly 1 devotee for Srivari Seva: 2 devotees yields ACTION_REQUIRED', () => {
      const srivariMulti: Profile = {
        ...validProfile,
        pilgrims: [validDevotee1, validDevotee2],
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        srivariMulti,
        ServiceType.SRIVARI_SEVA,
        'srivari-seva',
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.maxPilgrims).toBe(1);
    });

    it('accepts valid 1 devotee for Srivari Seva with full enrollment address', () => {
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        validProfile,
        ServiceType.SRIVARI_SEVA,
        'srivari-seva',
        undefined,
        true, // pageDetected
      );
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
      expect(readiness.maxPilgrims).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Service Isolation Tests
  // ─────────────────────────────────────────────────────────────
  describe('Service Isolation', () => {
    it('₹200 does NOT inherit ₹300 General Details requirements', () => {
      const sedRules = getCanonicalFieldRules('special-entry-darshan-300');
      const spatRules = getCanonicalFieldRules('padmavathi-supadham-entry-200');

      expect(sedRules.generalFields['email']).toBe('REQUIRED');
      expect(spatRules.generalFields['email']).toBe('NOT_PRESENT');
    });

    it('Homam does NOT inherit generic Darshan limits (strictly 2, not 6)', () => {
      const homamLimits = getCanonicalServiceLimits('sri-srinivasa-divyanugraha-homam');
      const sedLimits = getCanonicalServiceLimits('special-entry-darshan-300');

      expect(homamLimits.exactPilgrims).toBe(2);
      expect(homamLimits.maxPilgrims).toBe(2);
      expect(sedLimits.maxPilgrims).toBe(6);
    });

    it('Srivari does NOT inherit generic Darshan limits (strictly 1, not 6)', () => {
      const srivariLimits = getCanonicalServiceLimits('srivari-seva');
      const sedLimits = getCanonicalServiceLimits('special-entry-darshan-300');

      expect(srivariLimits.exactPilgrims).toBe(1);
      expect(srivariLimits.maxPilgrims).toBe(1);
      expect(sedLimits.maxPilgrims).toBe(6);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. General Details Live Step & Stale URL Invariant
  // ─────────────────────────────────────────────────────────────
  describe('General Details Live Step vs URL', () => {
    it('live General Details DOM wins over stale URL containing /pilgrim-details', () => {
      // Mock DOM with visible General Details heading and inputs
      const mockDoc = document.implementation.createHTMLDocument('TTD Booking');
      const genSection = mockDoc.createElement('div');
      genSection.className = 'general-details-container';

      const heading = mockDoc.createElement('h2');
      heading.className = 'section-title';
      heading.textContent = 'General Details';
      genSection.appendChild(heading);

      const emailInput = mockDoc.createElement('input');
      emailInput.type = 'email';
      emailInput.name = 'email';
      genSection.appendChild(emailInput);

      const cityInput = mockDoc.createElement('input');
      cityInput.name = 'city';
      genSection.appendChild(cityInput);

      mockDoc.body.appendChild(genSection);

      // Stale URL claiming /pilgrim-details
      const staleUrl = 'https://ttdevasthanams.ap.gov.in/sed/pilgrim-details';

      const detectedStep = detectActiveBookingStep(mockDoc, staleUrl);
      expect(detectedStep).toBe('GENERAL_DETAILS');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Temporary Booking Lock Invariant
  // ─────────────────────────────────────────────────────────────
  describe('Temporary Booking Lock Invariant', () => {
    it('detects TTD lock message accurately without auto-retry', () => {
      const mockDoc = document.implementation.createHTMLDocument('TTD Booking');
      const alertDiv = mockDoc.createElement('div');
      alertDiv.className = 'alert alert-danger';
      alertDiv.textContent = 'Your previous booking attempt is still holding these pilgrims. Please try after 10 minutes.';
      mockDoc.body.appendChild(alertDiv);

      const lockStatus = detectTtdTemporaryLock(mockDoc);
      expect(lockStatus.isLocked).toBe(true);
      expect(lockStatus.lockState?.status).toBe('temporary-lock');

      const classification = classifyError(null, { doc: mockDoc });
      expect(classification.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
      expect(classification.automaticRetry).toBe(false);
      expect(classification.userActionRequired).toBe(true);
      expect(classification.recommendedAction).toBe('check-booking-history');
    });
  });
});
