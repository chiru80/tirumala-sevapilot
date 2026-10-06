import { describe, it, expect } from 'vitest';
import {
  normalizeAadhaar,
  normalizeDob,
  normalizePincode,
  normalizeMobile,
  normalizeEmail,
  calculateAgeFromDob,
  computeProfileRevision,
  detectProfileConflicts,
  detectDuplicatePilgrims,
  mergePilgrims,
  validateDocumentLocally,
  buildProfileRepairPlan,
  applyProfileRepairs,
  evaluateProfileQuality,
  createAutofillSession,
  verifyAutofillSessionRevision,
  maskAadhaar,
  maskMobile,
  maskEmail,
} from '../../src/services/profile-intelligence';
import { IdType, Gender, Profile, Pilgrim } from '../../src/shared/types';

import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';

describe('Phase 7: Advanced Profile & Document Intelligence', () => {
  const validAadhaar1 = '23456789012' + generateVerhoeffChecksum('23456789012');
  const validAadhaar2 = '34567890123' + generateVerhoeffChecksum('34567890123');

  const samplePilgrim1: Pilgrim = {
    id: 'p-1',
    firstName: 'Venkat',
    lastName: 'Rao',
    fullName: 'Venkat Rao',
    gender: Gender.MALE,
    dateOfBirth: '1990-05-15',
    age: calculateAgeFromDob('1990-05-15')!,
    idType: IdType.AADHAAR,
    idNumber: validAadhaar1,
    mobile: '9876543210',
    email: 'venkat@example.com',
    country: 'India',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const samplePilgrim2: Pilgrim = {
    id: 'p-2',
    firstName: 'Lakshmi',
    lastName: 'Rao',
    fullName: 'Lakshmi Rao',
    gender: Gender.FEMALE,
    dateOfBirth: '1994-08-20',
    age: calculateAgeFromDob('1994-08-20')!,
    idType: IdType.AADHAAR,
    idNumber: validAadhaar2,
    country: 'India',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const sampleProfile: Profile = {
    id: 'prof-test-1',
    name: 'Family Pilgrimage',
    isDefault: true,
    pilgrims: [samplePilgrim1, samplePilgrim2],
    general: {
      email: 'contact@example.com',
      mobile: '9876543210',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pinCode: '500001',
    },
    createdAt: '2025-01-01T00:00:00Z',
  };

  describe('7.1 & 7.4 Profile Normalizer & ID Intelligence', () => {
    it('normalizes Aadhaar removing spaces and non-digits', () => {
      expect(normalizeAadhaar('5555 4444 3333')).toBe('555544443333');
      expect(normalizeAadhaar('5555-4444-3333')).toBe('555544443333');
    });

    it('normalizes dates of birth to YYYY-MM-DD', () => {
      expect(normalizeDob('15/05/1990')).toBe('1990-05-15');
      expect(normalizeDob('1990-05-15')).toBe('1990-05-15');
    });

    it('calculates deterministic profile revision hash', () => {
      const rev1 = computeProfileRevision(sampleProfile);
      const rev2 = computeProfileRevision(sampleProfile);
      expect(rev1).toBe(rev2);
      expect(rev1.startsWith('rev-')).toBe(true);

      const modifiedProfile: Profile = {
        ...sampleProfile,
        pilgrims: [{ ...samplePilgrim1, age: 35 }, samplePilgrim2],
      };
      const rev3 = computeProfileRevision(modifiedProfile);
      expect(rev3).not.toBe(rev1);
    });
  });

  describe('7.3 Age & DOB Conflict Detection', () => {
    it('detects Age and DOB mismatch (> 1 year difference)', () => {
      const mismatchedProfile: Profile = {
        ...sampleProfile,
        pilgrims: [
          {
            ...samplePilgrim1,
            dateOfBirth: '1990-01-01', // Age ~36
            age: 20, // Severe mismatch
          },
        ],
      };

      const conflicts = detectProfileConflicts(mismatchedProfile);
      const mismatch = conflicts.find((c) => c.conflictType === 'AGE_DOB_MISMATCH');
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe('ERROR');
    });

    it('detects impossible age (> 125 or < 0)', () => {
      const badAgeProfile: Profile = {
        ...sampleProfile,
        pilgrims: [{ ...samplePilgrim1, age: 140 }],
      };
      const conflicts = detectProfileConflicts(badAgeProfile);
      expect(conflicts.some((c) => c.conflictType === 'IMPOSSIBLE_AGE')).toBe(true);
    });

    it('detects future date of birth', () => {
      const futureDobProfile: Profile = {
        ...sampleProfile,
        pilgrims: [{ ...samplePilgrim1, dateOfBirth: '2099-01-01' }],
      };
      const conflicts = detectProfileConflicts(futureDobProfile);
      expect(conflicts.some((c) => c.conflictType === 'FUTURE_DOB')).toBe(true);
    });
  });

  describe('7.5 Duplicate Detection & Merge', () => {
    it('flags exact ID number match with 100% confidence', () => {
      const dupPilgrim: Pilgrim = {
        ...samplePilgrim2,
        id: 'p-dup',
        idNumber: samplePilgrim1.idNumber, // Same ID
      };
      const result = detectDuplicatePilgrims([samplePilgrim1, dupPilgrim]);
      expect(result.hasDuplicates).toBe(true);
      expect(result.matches[0].confidence).toBe('EXACT_ID');
      expect(result.matches[0].confidenceScore).toBe(100);
      expect(result.matches[0].supportedActions).toContain('MERGE');
    });

    it('merges pilgrims safely without dropping fields', () => {
      const merged = mergePilgrims(samplePilgrim1, {
        ...samplePilgrim2,
        address: '123 Temple Road',
      });
      expect(merged.fullName).toBe('Venkat Rao');
      expect(merged.address).toBe('123 Temple Road');
      expect(merged.idNumber).toBe(samplePilgrim1.idNumber);
    });
  });

  describe('7.7 Profile Repair Engine', () => {
    it('builds repair plan and identifies unnormalized and missing fields', () => {
      const messyProfile: Profile = {
        ...sampleProfile,
        general: {
          ...sampleProfile.general!,
          pinCode: '500 001', // Needs space removal
        },
        pilgrims: [
          {
            ...samplePilgrim1,
            idNumber: `${validAadhaar1.slice(0, 4)} ${validAadhaar1.slice(4, 8)} ${validAadhaar1.slice(8)}`, // Needs format
            age: undefined, // Missing age with valid DOB
          },
        ],
      };

      const plan = buildProfileRepairPlan(messyProfile);
      expect(plan.repairs.length).toBeGreaterThan(0);
      expect(plan.autoFixableCount).toBeGreaterThan(0);

      // Apply approved repairs
      const approvedIds = plan.repairs.map((r) => r.id);
      const { updatedProfile, appliedCount } = applyProfileRepairs(messyProfile, approvedIds, plan);
      expect(appliedCount).toBeGreaterThan(0);
      expect(updatedProfile.pilgrims[0].age).toBeDefined();
      expect(updatedProfile.pilgrims[0].idNumber).toBe(validAadhaar1);
      expect(updatedProfile.general?.pinCode).toBe('500001');
    });
  });

  describe('7.8 Document Intelligence', () => {
    it('validates supported image formats locally without external calls', () => {
      // 12KB base64 string
      const dummyBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(16 * 1024);
      const result = validateDocumentLocally(dummyBase64);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('rejects unsupported MIME types or undersized files', () => {
      const tinyFile = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const result = validateDocumentLocally(tinyFile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('7.2 & 7.9 & 7.10 Profile Quality, Revision Tracking & Masking', () => {
    it('evaluates profile quality dynamically per service', () => {
      const quality = evaluateProfileQuality({
        profile: sampleProfile,
        serviceId: 'special-entry-darshan-300',
      });
      expect(quality.score).toBeGreaterThan(0);
      expect(quality.status).toBe('READY');
      expect(quality.selectedPilgrimCount).toBe(2);
    });

    it('tracks session revision and detects modification', () => {
      const session = createAutofillSession(sampleProfile, 'special-entry-darshan-300', ['p-1']);
      expect(session.profileRevision).toBeDefined();

      // Current matches
      const check1 = verifyAutofillSessionRevision(session, sampleProfile);
      expect(check1.valid).toBe(true);

      // Profile edited after session creation
      const alteredProfile: Profile = {
        ...sampleProfile,
        general: { ...sampleProfile.general!, pinCode: '524001' },
      };
      const check2 = verifyAutofillSessionRevision(session, alteredProfile);
      expect(check2.valid).toBe(false);
      expect(check2.reason).toContain('Stale profile revision');
    });

    it('masks sensitive PII correctly', () => {
      expect(maskAadhaar('5555 4444 9012')).toBe('•••• •••• 9012');
      expect(maskMobile('9876543210')).toBe('••••••3210');
      expect(maskEmail('chaitanya@example.com')).toBe('c***@example.com');
    });
  });
});
