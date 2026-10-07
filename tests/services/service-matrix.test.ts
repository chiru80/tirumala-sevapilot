// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  ServiceIntelligence,
  PilgrimCountValidation,
} from '../../src/services/service-intelligence';
import {
  getCanonicalService,
  getCanonicalServiceLimits,
  hasGeneralDetails,
  isFieldRequiredForService,
  isFieldUserControlled,
} from '../../src/services/canonical-service-registry';
import { ReadinessEngine } from '../../src/services/readiness-engine';
import { ServiceType, Profile, Pilgrim, Gender, IdType } from '../../src/shared/types';
import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';

function createMockDevotee(index: number, options: Partial<Pilgrim> = {}): Pilgrim {
  const aadhaarSeed = String(20000000000 + index).padStart(11, '0');
  const validAadhaar = aadhaarSeed + generateVerhoeffChecksum(aadhaarSeed);

  return {
    id: `devotee-${index}`,
    firstName: `Devotee`,
    lastName: `${index}`,
    fullName: `Devotee ${index}`,
    age: 30 + index,
    gender: index % 2 === 0 ? Gender.FEMALE : Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: validAadhaar,
    city: 'Tirupati',
    district: 'Chittoor',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
    mobile: `987654321${index % 10}`,
    email: `devotee${index}@example.com`,
    dateOfBirth: '1990-01-01',
    photo: 'data:image/jpeg;base64,mock',
    srivariSeva: {
      doorNumber: '10-2',
      street: 'Mada Street',
    },
    ...options,
    createdAt: options.createdAt || '2026-01-01',
    updatedAt: options.updatedAt || '2026-01-01',
  };
}

function createMockProfile(devoteeCount: number, customGeneral = {}): Profile {
  const pilgrims = Array.from({ length: devoteeCount }, (_, i) => createMockDevotee(i + 1));
  return {
    id: 'test-profile-1',
    name: 'Test Group Profile',
    pilgrims,
    isDefault: true,
    gothram: 'Kashyapa',
    general: {
      email: 'organizer@example.com',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
      mobile: '9876543210',
      gothram: 'Kashyapa',
      ...customGeneral,
    },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('Phase 3 — Service Intelligence & Service Matrix', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. ₹300 Special Entry Darshan (1 to 6 Pilgrims + General Details)
  // ─────────────────────────────────────────────────────────────
  describe('₹300 Special Entry Darshan Matrix (1 to 6 devotees)', () => {
    const serviceId = 'special-entry-darshan-300';

    it('Service Intelligence rules match canonical definition', () => {
      const rules = ServiceIntelligence.getRules(serviceId);
      expect(rules).toBeDefined();
      expect(rules?.displayName).toBe('Special Entry Darshan ₹300');
      expect(rules?.ticketPrice).toBe(300);
      expect(rules?.minPilgrims).toBe(1);
      expect(rules?.maxPilgrims).toBe(6);
      expect(rules?.exactPilgrims).toBeUndefined();
      expect(rules?.hasGeneralDetails).toBe(true);
      expect(rules?.userControlledFields).toContain('declaration');
    });

    // Test matrix counts 1 to 6 are all valid
    for (let count = 1; count <= 6; count++) {
      it(`accepts exactly ${count} pilgrim(s) as valid count`, () => {
        const val = ServiceIntelligence.validatePilgrimCount(serviceId, count);
        expect(val.isValid).toBe(true);
        expect(val.count).toBe(count);
      });

      it(`evaluates readiness as READY for complete profile with ${count} devotee(s)`, () => {
        const profile = createMockProfile(count);
        const readiness = ReadinessEngine.evaluateBookingReadiness(
          profile,
          ServiceType.DARSHAN,
          serviceId,
          profile.pilgrims,
          true // pageDetected
        );
        expect(readiness.status).toBe('READY');
        expect(readiness.canFill).toBe(true);
        expect(readiness.pilgrimCount).toBe(count);
      });
    }

    it('rejects 0 pilgrims with ACTION_REQUIRED', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 0);
      expect(val.isValid).toBe(false);
      expect(val.reason).toContain('At least 1 devotee');
    });

    it('rejects 7 pilgrims (> max 6) with clear error', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 7);
      expect(val.isValid).toBe(false);
      expect(val.reason).toContain('maximum of 6');
    });

    it('requires General Details (email, city, state, country, pincode)', () => {
      expect(ServiceIntelligence.isGeneralDetailsExpected(serviceId)).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'general', 'email')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'general', 'city')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'general', 'pincode')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'general', 'mobile')).toBe(false); // optional
    });

    it('blocks readiness when General Details email/address are missing', () => {
      const incompleteProfile = createMockProfile(1, { email: '', city: '' });
      incompleteProfile.general = {
        email: '',
        city: '',
        state: '',
        country: '',
        pinCode: '',
      };
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        incompleteProfile,
        ServiceType.DARSHAN,
        serviceId,
        incompleteProfile.pilgrims,
        true
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.canFill).toBe(false);
      expect(readiness.headline).toContain('General details');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ₹200 Padmavathi / Sri PAT (1 to 6 Pilgrims, No General Details)
  // ─────────────────────────────────────────────────────────────
  describe('₹200 Padmavathi / Sri PAT Matrix (1 to 6 devotees, Zero General Details)', () => {
    const serviceId = 'padmavathi-supadham-entry-200';

    it('Service Intelligence rules match canonical definition', () => {
      const rules = ServiceIntelligence.getRules(serviceId);
      expect(rules).toBeDefined();
      expect(rules?.displayName).toBe('Padmavathi / Sri PAT');
      expect(rules?.ticketPrice).toBe(200);
      expect(rules?.minPilgrims).toBe(1);
      expect(rules?.maxPilgrims).toBe(6);
      expect(rules?.hasGeneralDetails).toBe(false); // Verified flow: no General Details
    });

    for (let count = 1; count <= 6; count++) {
      it(`accepts exactly ${count} devotee(s) as valid count`, () => {
        const val = ServiceIntelligence.validatePilgrimCount(serviceId, count);
        expect(val.isValid).toBe(true);
      });

      it(`evaluates readiness as READY even when General Details are completely empty (${count} devotees)`, () => {
        const profileNoGeneral = createMockProfile(count);
        profileNoGeneral.general = undefined; // No general details at all
        const readiness = ReadinessEngine.evaluateBookingReadiness(
          profileNoGeneral,
          ServiceType.DARSHAN,
          serviceId,
          profileNoGeneral.pilgrims,
          true
        );
        expect(readiness.status).toBe('READY');
        expect(readiness.canFill).toBe(true);
        expect(readiness.pilgrimCount).toBe(count);
      });
    }

    it('rejects 7 pilgrims (> max 6) with clear error', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 7);
      expect(val.isValid).toBe(false);
      expect(val.reason).toContain('maximum of 6');
    });

    it('confirms General Details are NOT expected for Padmavathi / SPAT', () => {
      expect(ServiceIntelligence.isGeneralDetailsExpected(serviceId)).toBe(false);
      expect(hasGeneralDetails(serviceId)).toBe(false);
      expect(isFieldRequiredForService(serviceId, 'general', 'email')).toBe(false);
      expect(isFieldRequiredForService(serviceId, 'general', 'city')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ₹1600 Divyanugraha Homam (STRICTLY Exact 2 Householders + Gothram)
  // ─────────────────────────────────────────────────────────────
  describe('₹1600 Divyanugraha Homam Matrix (STRICTLY Exact 2 Householders)', () => {
    const serviceId = 'sri-srinivasa-divyanugraha-homam';

    it('Service Intelligence rules enforce exact 2 devotees and Gothram', () => {
      const rules = ServiceIntelligence.getRules(serviceId);
      expect(rules).toBeDefined();
      expect(rules?.ticketPrice).toBe(1600);
      expect(rules?.minPilgrims).toBe(2);
      expect(rules?.maxPilgrims).toBe(2);
      expect(rules?.exactPilgrims).toBe(2);
      expect(rules?.hasGeneralDetails).toBe(true);
      expect(rules?.specialRequirements?.gothram).toBe(true);
    });

    it('1 devotee is INVALID: Homam requires exactly 2 householders', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 1);
      expect(val.isValid).toBe(false);
      expect(val.reason).toContain('exactly 2 devotees');

      const profile1 = createMockProfile(1);
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        profile1,
        ServiceType.ARJITHA_SEVA,
        serviceId,
        profile1.pilgrims,
        true
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.canFill).toBe(false);
      expect(readiness.headline).toContain('Exact 2 devotees');
    });

    it('2 devotees is VALID: passes count validation and readiness', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 2);
      expect(val.isValid).toBe(true);

      const profile2 = createMockProfile(2);
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        profile2,
        ServiceType.ARJITHA_SEVA,
        serviceId,
        profile2.pilgrims,
        true
      );
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
      expect(readiness.exactPilgrims).toBe(2);
    });

    // Counts 3 to 6 are all invalid for Homam
    for (let count = 3; count <= 6; count++) {
      it(`${count} devotees is INVALID: Homam requires strictly 2 householders`, () => {
        const val = ServiceIntelligence.validatePilgrimCount(serviceId, count);
        expect(val.isValid).toBe(false);
        expect(val.reason).toContain('exactly 2 devotees');

        const profileN = createMockProfile(count);
        const readiness = ReadinessEngine.evaluateBookingReadiness(
          profileN,
          ServiceType.ARJITHA_SEVA,
          serviceId,
          profileN.pilgrims,
          true
        );
        expect(readiness.status).toBe('ACTION_REQUIRED');
        expect(readiness.canFill).toBe(false);
      });
    }

    it('strictly requires Gothram for sankalpam; missing Gothram blocks readiness', () => {
      expect(isFieldRequiredForService(serviceId, 'general', 'gothram')).toBe(true);

      const profileNoGothram = createMockProfile(2);
      profileNoGothram.gothram = undefined;
      profileNoGothram.general = {
        ...profileNoGothram.general!,
        gothram: undefined,
      };

      const readiness = ReadinessEngine.evaluateBookingReadiness(
        profileNoGothram,
        ServiceType.ARJITHA_SEVA,
        serviceId,
        profileNoGothram.pilgrims,
        true
      );
      expect(readiness.status).toBe('ACTION_REQUIRED');
      expect(readiness.canFill).toBe(false);
      expect(readiness.headline.toLowerCase()).toContain('gothram');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Srivari Seva (STRICTLY Exact 1 Pilgrim Slot + Dedicated Enrollment)
  // ─────────────────────────────────────────────────────────────
  describe('Srivari Seva Matrix (STRICTLY Exact 1 Devotee Slot)', () => {
    const serviceId = 'srivari-seva';

    it('Service Intelligence rules enforce exact 1 devotee slot', () => {
      const rules = ServiceIntelligence.getRules(serviceId);
      expect(rules).toBeDefined();
      expect(rules?.displayName).toBe('Srivari Seva');
      expect(rules?.ticketPrice).toBe(0);
      expect(rules?.minPilgrims).toBe(1);
      expect(rules?.maxPilgrims).toBe(1);
      expect(rules?.exactPilgrims).toBe(1);
      expect(rules?.userControlledFields).toContain('declaration');
      expect(rules?.userControlledFields).toContain('mentallyFit');
      expect(rules?.userControlledFields).toContain('physicallyFit');
    });

    it('1 devotee is VALID for Srivari Seva voluntary enrollment', () => {
      const val = ServiceIntelligence.validatePilgrimCount(serviceId, 1);
      expect(val.isValid).toBe(true);

      const profile1 = createMockProfile(1);
      const readiness = ReadinessEngine.evaluateBookingReadiness(
        profile1,
        ServiceType.SRIVARI_SEVA,
        serviceId,
        profile1.pilgrims,
        true
      );
      expect(readiness.status).toBe('READY');
      expect(readiness.canFill).toBe(true);
      expect(readiness.exactPilgrims).toBe(1);
    });

    // Counts 2 to 6 are all invalid for Srivari individual slot
    for (let count = 2; count <= 6; count++) {
      it(`${count} devotees is INVALID: individual voluntary slot permits strictly 1 devotee`, () => {
        const val = ServiceIntelligence.validatePilgrimCount(serviceId, count);
        expect(val.isValid).toBe(false);
        expect(val.reason).toContain('exactly 1 devotee');

        const profileN = createMockProfile(count);
        const readiness = ReadinessEngine.evaluateBookingReadiness(
          profileN,
          ServiceType.SRIVARI_SEVA,
          serviceId,
          profileN.pilgrims,
          true
        );
        expect(readiness.status).toBe('ACTION_REQUIRED');
        expect(readiness.canFill).toBe(false);
      });
    }

    it('enforces that declarations and fitness attestations are strictly USER_CONTROLLED', () => {
      expect(ServiceIntelligence.isUserControlled(serviceId, 'declaration')).toBe(true);
      expect(ServiceIntelligence.isUserControlled(serviceId, 'mentallyFit')).toBe(true);
      expect(ServiceIntelligence.isUserControlled(serviceId, 'physicallyFit')).toBe(true);
      expect(isFieldUserControlled(serviceId, 'declaration')).toBe(true);
      expect(isFieldUserControlled(serviceId, 'mentallyFit')).toBe(true);
      expect(isFieldUserControlled(serviceId, 'physicallyFit')).toBe(true);
    });

    it('requires dedicated profile fields: DOB, Mobile, Photo, and full address', () => {
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'dateOfBirth')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'mobile')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'photo')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'doorNumber')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'street')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'district')).toBe(true);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'pincode')).toBe(true);
    });

    it('treats education, occupation, and mandal as optional (does NOT block readiness)', () => {
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'qualification')).toBe(false);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'profession')).toBe(false);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'bloodGroup')).toBe(false);
      expect(isFieldRequiredForService(serviceId, 'pilgrim', 'mandal')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Service Intelligence Profile Compatibility Checker
  // ─────────────────────────────────────────────────────────────
  describe('Service Intelligence Profile Compatibility Checker', () => {
    it('reports full compatibility for valid SED profile with 3 devotees', () => {
      const profile = createMockProfile(3);
      const res = ServiceIntelligence.checkCompatibility(profile, 'special-entry-darshan-300');
      expect(res.isCompatible).toBe(true);
      expect(res.missingPilgrimFields.length).toBe(0);
      expect(res.missingGeneralFields.length).toBe(0);
      expect(res.countValidation.isValid).toBe(true);
    });

    it('reports incompatibility when Homam has 3 devotees instead of exact 2', () => {
      const profile = createMockProfile(3);
      const res = ServiceIntelligence.checkCompatibility(profile, 'sri-srinivasa-divyanugraha-homam');
      expect(res.isCompatible).toBe(false);
      expect(res.countValidation.isValid).toBe(false);
      expect(res.recommendations.some(r => r.includes('exactly 2'))).toBe(true);
    });

    it('reports incompatibility when Homam is missing Gothram', () => {
      const profile = createMockProfile(2);
      profile.gothram = '';
      profile.general = { ...profile.general!, gothram: '' };
      const res = ServiceIntelligence.checkCompatibility(profile, 'sri-srinivasa-divyanugraha-homam');
      expect(res.isCompatible).toBe(false);
      expect(res.missingGeneralFields).toContain('gothram');
    });

    it('flags user-controlled warnings for Srivari Seva', () => {
      const profile = createMockProfile(1);
      const res = ServiceIntelligence.checkCompatibility(profile, 'srivari-seva');
      expect(res.userControlledWarnings.length).toBeGreaterThan(0);
      expect(res.userControlledWarnings.some(w => w.includes('Declaration'))).toBe(true);
      expect(res.userControlledWarnings.some(w => w.includes('Fitness'))).toBe(true);
    });
  });
});
