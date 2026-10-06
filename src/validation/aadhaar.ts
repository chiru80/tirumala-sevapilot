// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Aadhaar Validator
// Verhoeff checksum algorithm for 12-digit Aadhaar
// This is a local format check only — not official verification.
// ─────────────────────────────────────────────────

import type { ValidationResult } from '@shared/types';

// Verhoeff multiplication table
const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Verhoeff permutation table
const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Verhoeff inverse table
const inv: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Check if a number passes Verhoeff checksum */
export function verhoeffCheck(numStr: string): boolean {
  const digits = numStr.replace(/[\s-]/g, '').split('').map(Number).reverse();
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }
  return c === 0;
}

/** Generate a Verhoeff checksum digit for a number string */
export function generateVerhoeffChecksum(numStr: string): string {
  const digits = numStr.replace(/[\s-]/g, '').split('').map(Number).reverse();
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[(i + 1) % 8][digits[i]]];
  }
  return String(inv[c]);
}

/**
 * Validate an Aadhaar number using Verhoeff checksum.
 * Strips spaces and hyphens before validation.
 */
export function validateAadhaar(value: string): ValidationResult {
  // Strip spaces and hyphens
  const cleaned = value.replace(/[\s-]/g, '');

  // Must be exactly 12 digits
  if (!/^\d{12}$/.test(cleaned)) {
    return {
      field: 'aadhaar',
      valid: false,
      error: 'Aadhaar must be exactly 12 digits',
    };
  }

  // Reject all identical digits (e.g. 000000000000, 999999999999)
  if (/^(\d)\1{11}$/.test(cleaned)) {
    return {
      field: 'aadhaar',
      valid: false,
      error: 'Aadhaar cannot consist of all identical digits',
    };
  }

  // Must not start with 0 or 1
  if (cleaned[0] === '0' || cleaned[0] === '1') {
    return {
      field: 'aadhaar',
      valid: false,
      error: 'Aadhaar cannot start with 0 or 1',
    };
  }

  // Verhoeff checksum validation
  if (!verhoeffCheck(cleaned)) {
    return {
      field: 'aadhaar',
      valid: false,
      error: 'Invalid Aadhaar checksum — please verify the number',
    };
  }

  return {
    field: 'aadhaar',
    valid: true,
  };
}
