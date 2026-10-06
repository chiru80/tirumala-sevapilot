import { describe, it, expect } from 'vitest';
import { validateAadhaar, verhoeffCheck, generateVerhoeffChecksum } from '../../src/validation/aadhaar';

describe('Aadhaar & Verhoeff Validation', () => {
  it('should generate valid Verhoeff checksums', () => {
    // 23456789012 + checksum
    const partial = '23456789012';
    const checksum = generateVerhoeffChecksum(partial);
    expect(verhoeffCheck(partial + checksum)).toBe(true);
  });

  it('should reject invalid length or characters', () => {
    expect(validateAadhaar('12345').valid).toBe(false);
    expect(validateAadhaar('1234567890123').valid).toBe(false);
    expect(validateAadhaar('1234abcd5678').valid).toBe(false);
  });

  it('should reject numbers starting with 0 or 1', () => {
    expect(validateAadhaar('012345678901').valid).toBe(false);
    expect(validateAadhaar('112345678901').valid).toBe(false);
  });

  it('should reject repeated identical digits like 999999999999', () => {
    expect(validateAadhaar('999999999999').valid).toBe(false);
  });

  it('should reject numbers with more than 12 digits', () => {
    expect(validateAadhaar('2345678901234').valid).toBe(false);
    expect(validateAadhaar('234567890123999').valid).toBe(false);
  });
});
