// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Age Validator
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';
import { calculateAge } from '@shared/utils';

/**
 * Validate age consistency with DOB.
 * When both age and DOB are present, they should be consistent.
 */
export function validateAge(
  age: number,
  dob?: string,
): ValidationResult {
  if (age < 0 || age > 150) {
    return {
      field: 'age',
      valid: false,
      error: 'Age must be between 0 and 150',
    };
  }

  if (!Number.isInteger(age)) {
    return {
      field: 'age',
      valid: false,
      error: 'Age must be a whole number',
    };
  }

  if (dob) {
    const calculatedAge = calculateAge(dob);
    // Allow 1 year tolerance (birthday could have passed recently)
    if (Math.abs(calculatedAge - age) > 1) {
      return {
        field: 'age',
        valid: false,
        warning: `Age (${age}) does not match date of birth (calculated: ${calculatedAge})`,
      };
    }
  }

  return { field: 'age', valid: true };
}
