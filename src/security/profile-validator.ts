// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Profile & Devotee Schema Validator (Phase 9)
// Deep runtime schema validation, prototype pollution defense,
// and zero invented personal defaults enforcement.
// ─────────────────────────────────────────────────────────────

import { Gender, IdType } from '@shared/types';
import type { Profile, Pilgrim, GeneralDetails } from '@shared/types';
import { isValidImageDataUri } from './file-security';
import logger from '@shared/logger';

/** Strip HTML tags and control characters to prevent stored XSS */
export function sanitizeText(val: unknown, maxLength = 250): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>]/g, '') // Strip HTML brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Strip control chars
    .trim()
    .slice(0, maxLength);
}

/** Check and strip prototype pollution keys */
export function stripPrototypePollution<T>(input: T): T {
  if (!input || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map(stripPrototypePollution) as unknown as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      logger.warn('[ProfileValidator] Stripped forbidden object key:', key);
      continue;
    }
    cleaned[key] = stripPrototypePollution(value);
  }
  return cleaned as T;
}

/**
 * Validates and sanitizes a single Pilgrim record loaded from storage or messages.
 * Returns null if the record is fundamentally corrupted or unrecoverable.
 */
export function validateAndSanitizePilgrim(raw: unknown): Pilgrim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const p = stripPrototypePollution(raw) as Record<string, unknown>;

  const id = sanitizeText(p.id, 64);
  if (!id) return null;

  const firstName = sanitizeText(p.firstName, 50);
  const lastName = sanitizeText(p.lastName, 50);
  const fullName = sanitizeText(p.fullName, 100) || `${firstName} ${lastName}`.trim();

  // Validate Gender
  const rawGender = String(p.gender || '').toUpperCase();
  let gender: Gender = Gender.MALE;
  if (Object.values(Gender).includes(rawGender as Gender)) {
    gender = rawGender as Gender;
  } else if (rawGender.includes('FEMALE')) {
    gender = Gender.FEMALE;
  } else if (rawGender.includes('OTHER')) {
    gender = Gender.OTHER;
  } else {
    gender = Gender.MALE;
  }

  // Validate Age
  let age: number | undefined;
  if (typeof p.age === 'number' && Number.isInteger(p.age) && p.age >= 1 && p.age <= 125) {
    age = p.age;
  } else if (typeof p.age === 'string' && /^\d+$/.test(p.age)) {
    const parsed = parseInt(p.age, 10);
    if (parsed >= 1 && parsed <= 125) age = parsed;
  }

  // Validate ID Type
  const rawIdType = String(p.idType || '').trim();
  let idType: IdType = IdType.AADHAAR;
  if (Object.values(IdType).includes(rawIdType as IdType)) {
    idType = rawIdType as IdType;
  }

  // ID Number (keep only alphanumeric / hyphens / spaces, max 30 chars)
  const idNumber = sanitizeText(p.idNumber, 30).replace(/[^a-zA-Z0-9 -]/g, '');

  // Photo (must be valid image data URI if present)
  let photo: string | undefined;
  if (typeof p.photo === 'string' && isValidImageDataUri(p.photo)) {
    photo = p.photo;
  }

  // Mobile (digits only, max 15)
  const mobile = sanitizeText(p.mobile, 15).replace(/\D/g, '');

  // Address fields
  const city = sanitizeText(p.city, 50);
  const state = sanitizeText(p.state, 50);
  const country = sanitizeText(p.country, 50);
  const pinCode = sanitizeText(p.pinCode, 10).replace(/\D/g, '');

  return {
    id,
    firstName,
    lastName,
    fullName,
    gender,
    age,
    dateOfBirth: sanitizeText(p.dateOfBirth, 20),
    idType,
    idNumber,
    mobile: mobile || undefined,
    email: sanitizeText(p.email, 100) || undefined,
    photo,
    city: city || undefined,
    district: sanitizeText(p.district, 50) || undefined,
    state: state || undefined,
    country: country || 'India',
    pinCode: pinCode || undefined,
    address: sanitizeText(p.address, 150) || undefined,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined,
    srivariSeva: p.srivariSeva && typeof p.srivariSeva === 'object' ? (p.srivariSeva as any) : undefined,
  };
}

/**
 * Validates and sanitizes GeneralDetails.
 */
export function validateAndSanitizeGeneralDetails(raw: unknown): GeneralDetails {
  if (!raw || typeof raw !== 'object') {
    return {
      mobile: '',
      email: '',
      city: '',
      state: '',
      country: '',
      pinCode: '',
    };
  }

  const g = stripPrototypePollution(raw) as Record<string, unknown>;

  return {
    mobile: sanitizeText(g.mobile, 15).replace(/\D/g, ''),
    email: sanitizeText(g.email, 100),
    city: sanitizeText(g.city, 50),
    state: sanitizeText(g.state, 50),
    country: sanitizeText(g.country, 50),
    pinCode: sanitizeText(g.pinCode, 10).replace(/\D/g, ''),
    gothram: sanitizeText(g.gothram, 50) || undefined,
  };
}

/**
 * Validates and sanitizes an entire Profile object.
 * Discards malformed profiles and prevents prototype pollution.
 */
export function validateAndSanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const p = stripPrototypePollution(raw) as Record<string, unknown>;

  const id = sanitizeText(p.id, 64);
  if (!id) return null;

  const name = sanitizeText(p.name, 100) || 'Devotee Profile';

  // Sanitize pilgrims list (max 6)
  const rawPilgrims = Array.isArray(p.pilgrims) ? p.pilgrims : [];
  const pilgrims: Pilgrim[] = [];
  for (const item of rawPilgrims.slice(0, 6)) {
    const valid = validateAndSanitizePilgrim(item);
    if (valid) pilgrims.push(valid);
  }

  // Sanitize selectedPilgrims mapping
  const selectedPilgrims: Record<string, string[]> = {};
  if (p.selectedPilgrims && typeof p.selectedPilgrims === 'object') {
    for (const [serviceKey, val] of Object.entries(p.selectedPilgrims as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        selectedPilgrims[sanitizeText(serviceKey, 64)] = val
          .filter(v => typeof v === 'string')
          .map(v => sanitizeText(v, 64));
      }
    }
  }

  return {
    id,
    name,
    description: sanitizeText(p.description, 200) || undefined,
    pilgrims,
    general: validateAndSanitizeGeneralDetails(p.general || (p as any).generalDetails),
    selectedPilgrims,
    isDefault: Boolean(p.isDefault),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined,
  };
}
