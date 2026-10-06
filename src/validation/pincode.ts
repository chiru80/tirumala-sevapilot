// ─────────────────────────────────────────────────
// Tirumala SevaPilot — PIN Code Validator
// Indian 6-digit postal code validation
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

/**
 * Validate an Indian PIN code.
 * Must be 6 digits, first digit 1-9.
 */
export function validatePinCode(value: string): ValidationResult {
  const cleaned = value.replace(/[\s-]/g, '');

  if (!/^\d{6}$/.test(cleaned)) {
    return {
      field: 'pinCode',
      valid: false,
      error: 'PIN code must be exactly 6 digits',
    };
  }

  if (cleaned[0] === '0') {
    return {
      field: 'pinCode',
      valid: false,
      error: 'PIN code cannot start with 0',
    };
  }

  return { field: 'pinCode', valid: true };
}
