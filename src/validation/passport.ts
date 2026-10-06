// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Passport Validator
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

/**
 * Validate an Indian passport number.
 * Format: 1 uppercase letter + 7 digits (e.g., J1234567)
 */
export function validatePassport(value: string): ValidationResult {
  const cleaned = value.trim().toUpperCase();

  if (!cleaned) {
    return {
      field: 'passport',
      valid: false,
      error: 'Passport number is required',
    };
  }

  // Indian passport: letter followed by 7 digits
  if (!/^[A-Z]\d{7}$/.test(cleaned)) {
    return {
      field: 'passport',
      valid: false,
      error: 'Indian passport format: 1 letter followed by 7 digits (e.g., J1234567)',
    };
  }

  return { field: 'passport', valid: true };
}

/**
 * Validate a visa expiry date.
 * Must be a valid date and not already expired.
 */
export function validateVisaExpiry(value: string): ValidationResult {
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return {
      field: 'visaExpiry',
      valid: false,
      error: 'Invalid visa expiry date',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return {
      field: 'visaExpiry',
      valid: false,
      error: 'Visa has expired',
    };
  }

  // Warn if expiring within 30 days
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (date < thirtyDays) {
    return {
      field: 'visaExpiry',
      valid: true,
      warning: 'Visa expires within 30 days',
    };
  }

  return { field: 'visaExpiry', valid: true };
}
