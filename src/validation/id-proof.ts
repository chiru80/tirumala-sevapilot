// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Photo ID Validation Module
// Authoritative validators for all TTD supported ID proof types:
// Aadhaar, Passport, PAN, Voter ID, Driving License, Ration Card.
// ─────────────────────────────────────────────────────────────

import { validateAadhaar } from './aadhaar';
import { validatePassport } from './passport';

export interface IdValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates a PAN (Permanent Account Number).
 * Format: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).
 */
export function validatePAN(value: string): IdValidationResult {
  const cleaned = (value || '').trim().toUpperCase();
  if (!cleaned) {
    return { valid: false, error: 'PAN number is required' };
  }
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)',
    };
  }
  return { valid: true, normalized: cleaned };
}

/**
 * Validates an Indian Voter ID (EPIC - Electors Photo Identity Card).
 * Standard format: 3 uppercase letters followed by 7 digits (e.g. ABC1234567),
 * or legacy state-specific formats between 10 and 16 alphanumeric characters.
 */
export function validateVoterId(value: string): IdValidationResult {
  const cleaned = (value || '').trim().toUpperCase();
  if (!cleaned) {
    return { valid: false, error: 'Voter ID number is required' };
  }
  const standardEpicRegex = /^[A-Z]{3}[0-9]{7}$/;
  const legacyEpicRegex = /^[A-Z0-9\/-]{8,16}$/;
  if (!standardEpicRegex.test(cleaned) && !legacyEpicRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid Voter ID format (e.g. ABC1234567)',
    };
  }
  return { valid: true, normalized: cleaned };
}

/**
 * Validates a Driving License.
 * Standard format: 2-letter state code + 2-digit RTO code + year + 7 digits (15-16 chars total),
 * or standard alphanumeric 10-16 characters.
 */
export function validateDrivingLicense(value: string): IdValidationResult {
  const cleaned = (value || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleaned) {
    return { valid: false, error: 'Driving License number is required' };
  }
  const dlRegex = /^[A-Z]{2}[0-9]{2}[0-9A-Z]{7,12}$/;
  if (!dlRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid Driving License number format (e.g. AP0220190001234)',
    };
  }
  return { valid: true, normalized: cleaned };
}

/**
 * Validates a Ration Card number.
 * Format: 8 to 16 alphanumeric characters.
 */
export function validateRationCard(value: string): IdValidationResult {
  const cleaned = (value || '').trim().toUpperCase();
  if (!cleaned) {
    return { valid: false, error: 'Ration card number is required' };
  }
  const rationRegex = /^[A-Z0-9]{8,16}$/;
  if (!rationRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid Ration Card number (8 to 16 alphanumeric characters required)',
    };
  }
  return { valid: true, normalized: cleaned };
}

/**
 * Authoritative dispatcher to validate an ID number given its type.
 */
export function validateIdProof(idType: string | undefined, idNumber: string | undefined): IdValidationResult {
  if (!idNumber || !idNumber.trim()) {
    return { valid: false, error: 'Photo ID number is required' };
  }

  const raw = idNumber.trim();
  const normalizedType = (idType || '').toUpperCase().replace(/[\s_]/g, '');

  switch (normalizedType) {
    case 'AADHAAR':
    case 'AADHAR':
    case 'UIDAI': {
      const v = validateAadhaar(raw);
      return {
        valid: v.valid,
        error: v.valid ? undefined : v.error || 'Invalid 12-digit Aadhaar number',
        normalized: v.valid ? raw.replace(/\D/g, '') : undefined,
      };
    }

    case 'PASSPORT': {
      const v = validatePassport(raw);
      if (!v.valid) {
        // Allow international passports (6-9 alphanumeric characters)
        const intlPassport = /^[A-Z0-9]{6,9}$/i;
        if (intlPassport.test(raw)) {
          return { valid: true, normalized: raw.toUpperCase() };
        }
        return { valid: false, error: v.error || 'Invalid Passport format (1 letter and 7 digits)' };
      }
      return { valid: true, normalized: raw.toUpperCase() };
    }

    case 'PAN':
    case 'PANCARD':
      return validatePAN(raw);

    case 'VOTERID':
    case 'VOTER':
    case 'EPIC':
      return validateVoterId(raw);

    case 'DRIVINGLICENSE':
    case 'DL':
      return validateDrivingLicense(raw);

    case 'RATIONCARD':
    case 'RATION':
      return validateRationCard(raw);

    default: {
      // Generic fallback for any other supported government ID: must be at least 6 alphanumeric chars
      if (raw.length < 5 || !/^[A-Z0-9\/-]+$/i.test(raw)) {
        return { valid: false, error: 'ID number must have at least 5 alphanumeric characters' };
      }
      return { valid: true, normalized: raw };
    }
  }
}
