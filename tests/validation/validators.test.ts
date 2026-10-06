import { describe, it, expect } from 'vitest';
import { validateMobile } from '../../src/validation/mobile';
import { validateEmail } from '../../src/validation/email';
import { validatePinCode } from '../../src/validation/pincode';
import { validateDob } from '../../src/validation/dob';
import { calculateAge } from '../../src/shared/utils';
import { detectDuplicateIds } from '../../src/validation/duplicates';
import { Gender, IdType } from '../../src/shared/types';
import type { Pilgrim } from '../../src/shared/types';

describe('General Pilgrims Field Validators', () => {
  it('should validate Indian mobile numbers', () => {
    expect(validateMobile('9876543210').valid).toBe(true);
    expect(validateMobile('8123456789').valid).toBe(true);
    expect(validateMobile('5123456789').valid).toBe(false); // starts with 5
    expect(validateMobile('987654321').valid).toBe(false); // 9 digits
    expect(validateMobile('98765432101').valid).toBe(false); // 11 digits (more digits rejected)
    expect(validateMobile('9876543210123').valid).toBe(false); // 13 digits (more digits rejected)
    expect(validateMobile('+91 9876543210').valid).toBe(true); // handles whitespace / prefix
  });

  it('should validate email addresses', () => {
    expect(validateEmail('pilgrim@example.com').valid).toBe(true);
    expect(validateEmail('test.name+tag@sub.domain.org').valid).toBe(true);
    expect(validateEmail('invalid-email').valid).toBe(false);
    expect(validateEmail('@domain.com').valid).toBe(false);
  });

  it('should validate Indian postal PIN codes', () => {
    expect(validatePinCode('517504').valid).toBe(true); // Tirumala PIN
    expect(validatePinCode('517501').valid).toBe(true); // Tirupati PIN
    expect(validatePinCode('017501').valid).toBe(false); // Starts with 0
    expect(validatePinCode('51750').valid).toBe(false); // 5 digits
  });

  it('should calculate age correctly from DOB', () => {
    const today = new Date();
    const twentyYearsAgo = `${today.getFullYear() - 20}-01-01`;
    expect(calculateAge(twentyYearsAgo)).toBeGreaterThanOrEqual(19);
    expect(validateDob(twentyYearsAgo).valid).toBe(true);
  });

  it('should detect duplicate ID numbers within a profile', () => {
    const pilgrims: Pilgrim[] = [
      {
        id: '1',
        firstName: 'Govinda',
        lastName: 'Rao',
        fullName: 'Govinda Rao',
        gender: Gender.MALE,
        dateOfBirth: '1985-01-01',
        idType: IdType.AADHAAR,
        idNumber: '234567890123',
        mobile: '9876543210',
        country: 'India',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: '2',
        firstName: 'Rama',
        lastName: 'Rao',
        fullName: 'Rama Rao',
        gender: Gender.MALE,
        dateOfBirth: '1990-01-01',
        idType: IdType.AADHAAR,
        idNumber: '234567890123', // duplicate
        mobile: '9876543211',
        country: 'India',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    const dupes = detectDuplicateIds(pilgrims);
    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0].valid).toBe(false);
  });
});
