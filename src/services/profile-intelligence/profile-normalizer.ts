// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Normalizer (Phase 7)
// Sanitizes, normalizes, and computes canonical representations
// for profiles, devotee records, and general contact details.
// ─────────────────────────────────────────────────────────────

import type { Pilgrim, Profile, GeneralDetails } from '@shared/types';
import { Gender, IdType } from '@shared/types';

/**
 * Normalizes an Indian Aadhaar number (strips hyphens and whitespace to 12 digits).
 */
export function normalizeAadhaar(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[\s-]/g, '').trim();
}

/**
 * Normalizes a Passport number (capitalized, whitespace removed).
 */
export function normalizePassport(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').toUpperCase().trim();
}

/**
 * Canonical ID normalization by document type.
 */
export function normalizeIdNumber(idNumber: string, idType?: IdType): string {
  if (!idNumber) return '';
  const trimmed = idNumber.trim();
  if (idType === IdType.AADHAAR) {
    return normalizeAadhaar(trimmed);
  }
  if (idType === IdType.PASSPORT) {
    return normalizePassport(trimmed);
  }
  return trimmed.replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Normalizes a personal name: collapses excess whitespace and trims.
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes gender to standard Gender enum.
 */
export function normalizeGender(gender: string): Gender {
  if (!gender) return Gender.OTHER;
  const upper = gender.trim().toUpperCase();
  if (upper === 'M' || upper === 'MALE') return Gender.MALE;
  if (upper === 'F' || upper === 'FEMALE') return Gender.FEMALE;
  return Gender.OTHER;
}

/**
 * Normalizes phone numbers (extracts 10 Indian digits if prefixed by +91).
 */
export function normalizeMobile(mobile: string): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

/**
 * Normalizes email address (lowercase, trimmed).
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Normalizes 6-digit postal pincode.
 */
export function normalizePincode(pin: string): string {
  if (!pin) return '';
  return pin.replace(/\D/g, '').slice(0, 6);
}

/**
 * Normalizes date to ISO YYYY-MM-DD.
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // Check if DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}

export const normalizeDob = normalizeDate;

/**
 * Calculates current age from date of birth string.
 */
export function calculateAgeFromDob(dobStr: string): number | null {
  if (!dobStr) return null;
  const normalized = normalizeDate(dobStr);
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Normalizes an individual devotee record.
 */
export function normalizePilgrim(pilgrim: Pilgrim): Pilgrim {
  const firstName = normalizeName(pilgrim.firstName);
  const lastName = normalizeName(pilgrim.lastName);
  const fullName = normalizeName(pilgrim.fullName || `${firstName} ${lastName}`.trim());
  const idNumber = normalizeIdNumber(pilgrim.idNumber, pilgrim.idType);
  const gender = normalizeGender(pilgrim.gender);
  const dateOfBirth = pilgrim.dateOfBirth ? normalizeDate(pilgrim.dateOfBirth) : undefined;
  const mobile = pilgrim.mobile ? normalizeMobile(pilgrim.mobile) : undefined;
  const email = pilgrim.email ? normalizeEmail(pilgrim.email) : undefined;
  const pinCode = pilgrim.pinCode ? normalizePincode(pilgrim.pinCode) : undefined;

  return {
    ...pilgrim,
    firstName: firstName || fullName.split(' ')[0] || '',
    lastName: lastName || fullName.split(' ').slice(1).join(' ') || '',
    fullName,
    gender,
    idNumber,
    dateOfBirth,
    mobile,
    email,
    pinCode,
    city: pilgrim.city ? normalizeName(pilgrim.city) : undefined,
    state: pilgrim.state ? normalizeName(pilgrim.state) : undefined,
    country: pilgrim.country ? normalizeName(pilgrim.country) : 'India',
  };
}

/**
 * Normalizes booking-level general details.
 */
export function normalizeGeneralDetails(general?: GeneralDetails): GeneralDetails | undefined {
  if (!general) return undefined;
  return {
    ...general,
    gothram: general.gothram ? normalizeName(general.gothram) : undefined,
    email: general.email ? normalizeEmail(general.email) : undefined,
    mobile: general.mobile ? normalizeMobile(general.mobile) : undefined,
    city: general.city ? normalizeName(general.city) : undefined,
    state: general.state ? normalizeName(general.state) : undefined,
    country: general.country ? normalizeName(general.country) : 'India',
    pinCode: general.pinCode ? normalizePincode(general.pinCode) : undefined,
  };
}

/**
 * Computes a deterministic revision fingerprint for a profile.
 * Changes whenever devotee records, general details, or selections change.
 */
export function computeProfileRevision(profile: Profile): string {
  const seed = {
    id: profile.id,
    updatedAt: profile.updatedAt || profile.createdAt,
    pilgrimCount: profile.pilgrims.length,
    pilgrimFingerprints: profile.pilgrims.map(p => `${p.id}:${p.fullName}:${p.idNumber}:${p.age}:${p.dateOfBirth}`),
    general: profile.general,
    gothram: profile.gothram,
    selectedPilgrims: profile.selectedPilgrims,
  };

  // Fast string hash
  const str = JSON.stringify(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `rev-${Math.abs(hash).toString(16)}`;
}

/**
 * Normalizes an entire profile and attaches computed revision.
 */
export function normalizeProfile(profile: Profile): Profile & { revision: string } {
  const normalizedPilgrims = profile.pilgrims.map(normalizePilgrim);
  const normalizedGeneral = normalizeGeneralDetails(profile.general);
  const normalized: Profile = {
    ...profile,
    name: normalizeName(profile.name),
    gothram: profile.gothram ? normalizeName(profile.gothram) : normalizedGeneral?.gothram,
    pilgrims: normalizedPilgrims,
    general: normalizedGeneral,
  };

  const revision = computeProfileRevision(normalized);
  return {
    ...normalized,
    revision,
  };
}
