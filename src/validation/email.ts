// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Email Validator
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

/**
 * Validate an email address.
 * Uses a practical (not overly strict) RFC-like pattern.
 */
export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { field: 'email', valid: false, error: 'Email is required' };
  }

  // Practical email regex — covers 99.9% of real emails
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  if (!emailPattern.test(trimmed)) {
    return {
      field: 'email',
      valid: false,
      error: 'Invalid email format',
    };
  }

  return { field: 'email', valid: true };
}
