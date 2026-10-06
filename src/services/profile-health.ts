// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Health Service
// Centralized profile completeness and readiness calculation
// ─────────────────────────────────────────────────

import { Gender, IdType } from '../shared/types';
import type { Pilgrim, Profile, GeneralDetails } from '../shared/types';

export interface PilgrimHealthItem {
  pilgrimId: string;
  pilgrimName: string;
  isReady: boolean;
  missingFields: string[];
}

export interface GeneralHealthItem {
  isReady: boolean;
  missingFields: string[];
}

export interface ProfileHealth {
  total: number;
  ready: number;
  incomplete: number;
  percentage: number;
  missingByField: Record<string, number>;
  pilgrimHealth?: PilgrimHealthItem[];
  generalHealth?: GeneralHealthItem;
}

/**
 * Validate a single pilgrim's readiness for supported TTD workflows.
 * Evaluates strictly the 5 core pilgrim table fields:
 * - Full name (or first + last name)
 * - Gender
 * - Age or Date of Birth
 * - Photo ID Type
 * - Photo ID Number (valid length / 12 digits for Aadhaar)
 * 
 * NOTE: Mobile is NOT required here as mobile belongs to General Details.
 */
export function checkPilgrimHealth(pilgrim: Pilgrim): PilgrimHealthItem {
  const missingFields: string[] = [];
  const name = (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim();

  // 1. Name check
  if (!name) {
    missingFields.push('fullName');
  }

  // 2. Gender check
  if (!pilgrim.gender || !Object.values(Gender).includes(pilgrim.gender)) {
    missingFields.push('gender');
  }

  // 3. Age / DOB check
  const hasValidAge = typeof pilgrim.age === 'number' && pilgrim.age > 0 && pilgrim.age < 125;
  const hasValidDob = Boolean(pilgrim.dateOfBirth && !isNaN(Date.parse(pilgrim.dateOfBirth)));
  if (!hasValidAge && !hasValidDob) {
    missingFields.push('age');
  }

  // 4. ID Type check
  if (!pilgrim.idType || !Object.values(IdType).includes(pilgrim.idType)) {
    missingFields.push('idType');
  }

  // 5. ID Number check
  const idNum = (pilgrim.idNumber || '').trim();
  if (!idNum) {
    missingFields.push('idNumber');
  } else if (pilgrim.idType === IdType.AADHAAR || (pilgrim.idType as string) === 'Aadhaar') {
    const digits = idNum.replace(/\D/g, '');
    if (digits.length !== 12) {
      missingFields.push('idNumber');
    }
  } else if (idNum.length < 4) {
    missingFields.push('idNumber');
  }


  return {
    pilgrimId: pilgrim.id,
    pilgrimName: name || 'Unnamed Devotee',
    isReady: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate General Details separately (Step 2 booking details).
 * Evaluates:
 * - mobile (10 digits)
 * - email (when required)
 * - gothram (when required — e.g. Sri Srinivasa Divyanugraha Homam)
 * - city
 * - state
 * - country
 * - PIN (6 digits)
 */
export function checkGeneralHealth(
  general?: Partial<GeneralDetails> | null,
  requireEmail: boolean = false,
  requireGothram: boolean = false,
  requireMobile: boolean = true,
): GeneralHealthItem {
  const missingFields: string[] = [];
  if (!general) {
    const baseMissing: string[] = [];
    if (requireGothram) baseMissing.push('gothram');
    if (requireEmail) baseMissing.push('email');
    if (requireMobile) baseMissing.push('mobile');
    baseMissing.push('city', 'state', 'country', 'pinCode');
    return {
      isReady: false,
      missingFields: baseMissing,
    };
  }

  // 0. Gothram (when required by service — e.g. Homam)
  if (requireGothram) {
    const gothram = (general.gothram || '').trim();
    if (!gothram) {
      missingFields.push('gothram');
    }
  }

  // 1. Mobile (10 digits) — only when required by the service (Homam does NOT require mobile)
  if (requireMobile) {
    const mobileDigits = (general.mobile || '').replace(/\D/g, '');
    if (!mobileDigits || mobileDigits.length !== 10) {
      missingFields.push('mobile');
    }
  }

  // 2. Email (when required or if provided)
  const email = (general.email || '').trim();
  if (requireEmail && !email) {
    missingFields.push('email');
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    missingFields.push('email');
  }

  // 3. City
  if (!general.city || !general.city.trim()) {
    missingFields.push('city');
  }

  // 4. State
  if (!general.state || !general.state.trim()) {
    missingFields.push('state');
  }

  // 5. Country
  if (!general.country || !general.country.trim()) {
    missingFields.push('country');
  }

  // 6. PIN code (6 digits)
  const pinDigits = (general.pinCode || (general as { pincode?: string }).pincode || '').replace(/\D/g, '');
  if (!pinDigits || pinDigits.length !== 6) {
    missingFields.push('pinCode');
  }


  return {
    isReady: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Calculate comprehensive profile health for a profile or list of pilgrims.
 */
export function calculateProfileHealth(
  profileOrPilgrims: Profile | Pilgrim[] | null | undefined,
  requireEmail: boolean = false,
): ProfileHealth {
  if (!profileOrPilgrims) {
    return {
      total: 0,
      ready: 0,
      incomplete: 0,
      percentage: 0,
      missingByField: {},
      pilgrimHealth: [],
    };
  }

  const pilgrims: Pilgrim[] = Array.isArray(profileOrPilgrims)
    ? profileOrPilgrims
    : profileOrPilgrims.pilgrims || [];

  const generalDetails = !Array.isArray(profileOrPilgrims)
    ? profileOrPilgrims.general
    : undefined;

  const total = pilgrims.length;
  if (total === 0) {
    return {
      total: 0,
      ready: 0,
      incomplete: 0,
      percentage: 0,
      missingByField: {},
      pilgrimHealth: [],
      generalHealth: checkGeneralHealth(generalDetails, requireEmail),
    };
  }

  const missingByField: Record<string, number> = {};
  const pilgrimHealth: PilgrimHealthItem[] = [];
  let ready = 0;

  for (const pilgrim of pilgrims) {
    const health = checkPilgrimHealth(pilgrim);
    pilgrimHealth.push(health);

    if (health.isReady) {
      ready++;
    } else {
      for (const field of health.missingFields) {
        missingByField[field] = (missingByField[field] || 0) + 1;
      }
    }
  }

  const incomplete = total - ready;
  const percentage = Math.round((ready / total) * 100);

  return {
    total,
    ready,
    incomplete,
    percentage,
    missingByField,
    pilgrimHealth,
    generalHealth: checkGeneralHealth(generalDetails, requireEmail),
  };
}
