// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Date of Birth Validator
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

/**
 * Validate a date of birth.
 * - Must be a valid date
 * - Must not be in the future
 * - Must not be impossibly old (>150 years)
 * - Optionally checks service-specific age constraints
 */
export function validateDob(
  value: string,
  options?: { minAge?: number; maxAge?: number },
): ValidationResult {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: 'Invalid date format',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date > today) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: 'Date of birth cannot be in the future',
    };
  }

  // Calculate age
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }

  if (age > 150) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: 'Date of birth appears impossibly old',
    };
  }

  if (age < 0) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: 'Date of birth is in the future',
    };
  }

  if (options?.minAge !== undefined && age < options.minAge) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: `Minimum age requirement is ${options.minAge} years (current age: ${age})`,
    };
  }

  if (options?.maxAge !== undefined && age > options.maxAge) {
    return {
      field: 'dateOfBirth',
      valid: false,
      error: `Maximum age limit is ${options.maxAge} years (current age: ${age})`,
    };
  }

  return { field: 'dateOfBirth', valid: true };
}
