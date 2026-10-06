// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Mobile Number Validator
// Indian 10-digit mobile number validation
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

/**
 * Validate an Indian mobile number.
 * Must be 10 digits starting with 6, 7, 8, or 9.
 */
export function validateMobile(value: string): ValidationResult {
  const cleaned = value.replace(/[\s-+]/g, '');

  // Remove country code prefix if present
  const number = cleaned.startsWith('91') && cleaned.length === 12
    ? cleaned.slice(2)
    : cleaned;

  if (!/^\d{10}$/.test(number)) {
    return {
      field: 'mobile',
      valid: false,
      error: 'Mobile number must be exactly 10 digits',
    };
  }

  if (!/^[6-9]/.test(number)) {
    return {
      field: 'mobile',
      valid: false,
      error: 'Indian mobile numbers must start with 6, 7, 8, or 9',
    };
  }

  return {
    field: 'mobile',
    valid: true,
  };
}
