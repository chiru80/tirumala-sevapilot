// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Duplicate Detector
// Phase 7: Advanced Profile & Document Intelligence
// ─────────────────────────────────────────────────

import { Pilgrim } from '../../shared/types';
import {
  normalizeIdNumber,
  normalizeName,
  normalizeGender,
  normalizeDob,
} from './profile-normalizer';

export type DuplicateConfidence = 'EXACT_ID' | 'HIGH_DEMOGRAPHIC' | 'MEDIUM_PROBABLE';

export type DuplicateAction = 'COMPARE' | 'KEEP_BOTH' | 'MERGE';

export interface FieldDifference {
  fieldName: string;
  valueA: unknown;
  valueB: unknown;
  resolutionHint: string;
}

export interface DuplicateMatch {
  id: string;
  pilgrimAId: string;
  pilgrimBId: string;
  pilgrimAName: string;
  pilgrimBName: string;
  confidence: DuplicateConfidence;
  confidenceScore: number; // 0 - 100
  reasons: string[];
  differences: FieldDifference[];
  supportedActions: DuplicateAction[];
  suggestedMergedPilgrim: Pilgrim;
}

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  totalDuplicates: number;
  matches: DuplicateMatch[];
}

/**
 * Detects duplicate pilgrims in a list.
 *
 * Rules:
 * - Highest confidence: identical ID Type + normalized ID Number (100%).
 * - High confidence: normalized Name + DOB + Gender match (85%).
 * - Medium confidence: normalized Name + Mobile match (70%).
 * - Never automatically deletes or modifies records.
 */
export function detectDuplicatePilgrims(pilgrims: Pilgrim[]): DuplicateDetectionResult {
  const matches: DuplicateMatch[] = [];

  for (let i = 0; i < pilgrims.length; i++) {
    for (let j = i + 1; j < pilgrims.length; j++) {
      const pA = pilgrims[i];
      const pB = pilgrims[j];

      const match = evaluatePair(pA, pB);
      if (match) {
        matches.push(match);
      }
    }
  }

  return {
    hasDuplicates: matches.length > 0,
    totalDuplicates: matches.length,
    matches,
  };
}

function evaluatePair(pA: Pilgrim, pB: Pilgrim): DuplicateMatch | null {
  const reasons: string[] = [];
  let confidence: DuplicateConfidence | null = null;
  let score = 0;

  const idNormA = normalizeIdNumber(pA.idNumber || '', pA.idType);
  const idNormB = normalizeIdNumber(pB.idNumber || '', pB.idType);
  const sameIdType = pA.idType && pB.idType && pA.idType === pB.idType;
  const sameIdNumber = idNormA.length > 0 && idNormB.length > 0 && idNormA === idNormB;

  const nameNormA = normalizeName(pA.fullName || `${pA.firstName || ''} ${pA.lastName || ''}`);
  const nameNormB = normalizeName(pB.fullName || `${pB.firstName || ''} ${pB.lastName || ''}`);
  const sameName = nameNormA.length > 0 && nameNormA === nameNormB;

  const dobNormA = pA.dateOfBirth ? normalizeDob(pA.dateOfBirth) : null;
  const dobNormB = pB.dateOfBirth ? normalizeDob(pB.dateOfBirth) : null;
  const sameDob = dobNormA !== null && dobNormB !== null && dobNormA === dobNormB;

  const genderNormA = pA.gender ? normalizeGender(pA.gender) : null;
  const genderNormB = pB.gender ? normalizeGender(pB.gender) : null;
  const sameGender = genderNormA !== null && genderNormB !== null && genderNormA === genderNormB;

  const mobileA = (pA.mobile || '').replace(/\D/g, '').slice(-10);
  const mobileB = (pB.mobile || '').replace(/\D/g, '').slice(-10);
  const sameMobile = mobileA.length === 10 && mobileB.length === 10 && mobileA === mobileB;

  // Signal 1: Exact ID type + exact ID number match -> 100%
  if (sameIdType && sameIdNumber) {
    confidence = 'EXACT_ID';
    score = 100;
    reasons.push(`Identical ${pA.idType} number: ending in ${idNormA.slice(-4)}`);
  }
  // Signal 2: Name + DOB + Gender match -> 85%
  else if (sameName && sameDob && sameGender) {
    confidence = 'HIGH_DEMOGRAPHIC';
    score = 85;
    reasons.push('Identical full name, date of birth, and gender');
  }
  // Signal 3: Name + Mobile match -> 70%
  else if (sameName && sameMobile) {
    confidence = 'MEDIUM_PROBABLE';
    score = 70;
    reasons.push(`Identical name and registered mobile ending in ${mobileA.slice(-4)}`);
  }

  if (!confidence) {
    return null;
  }

  // Calculate field differences
  const differences: FieldDifference[] = [];
  const fieldsToCheck: (keyof Pilgrim)[] = [
    'fullName',
    'firstName',
    'lastName',
    'gender',
    'dateOfBirth',
    'age',
    'idType',
    'idNumber',
    'mobile',
    'email',
    'city',
    'state',
    'country',
    'pinCode',
  ];

  for (const field of fieldsToCheck) {
    const valA = pA[field];
    const valB = pB[field];
    if (valA !== valB && (valA !== undefined || valB !== undefined)) {
      differences.push({
        fieldName: String(field),
        valueA: valA,
        valueB: valB,
        resolutionHint: valA ? `Value from ${pA.fullName || 'Pilgrim A'}` : `Value from ${pB.fullName || 'Pilgrim B'}`,
      });
    }
  }

  // Generate suggested merged pilgrim (prefers newer or more complete fields)
  const suggestedMergedPilgrim = mergePilgrims(pA, pB);

  return {
    id: `dup-${pA.id}-${pB.id}`,
    pilgrimAId: pA.id,
    pilgrimBId: pB.id,
    pilgrimAName: pA.fullName || `${pA.firstName || ''} ${pA.lastName || ''}`.trim(),
    pilgrimBName: pB.fullName || `${pB.firstName || ''} ${pB.lastName || ''}`.trim(),
    confidence,
    confidenceScore: score,
    reasons,
    differences,
    supportedActions: ['COMPARE', 'KEEP_BOTH', 'MERGE'],
    suggestedMergedPilgrim,
  };
}

/**
 * Creates a merged pilgrim object preferring non-empty and most complete values.
 * Does not mutate original records.
 */
export function mergePilgrims(primary: Pilgrim, secondary: Pilgrim): Pilgrim {
  const choose = <T>(valA: T | undefined | null | '', valB: T | undefined | null | ''): T => {
    if (valA !== undefined && valA !== null && valA !== '') return valA as T;
    return (valB !== undefined && valB !== null ? valB : ('' as unknown)) as T;
  };

  return {
    id: primary.id,
    firstName: choose(primary.firstName, secondary.firstName),
    middleName: choose(primary.middleName, secondary.middleName),
    lastName: choose(primary.lastName, secondary.lastName),
    fullName: choose(primary.fullName, secondary.fullName),
    gender: primary.gender || secondary.gender,
    dateOfBirth: choose(primary.dateOfBirth, secondary.dateOfBirth),
    age: primary.age || secondary.age,
    idType: primary.idType || secondary.idType,
    idNumber: choose(primary.idNumber, secondary.idNumber),
    mobile: choose(primary.mobile, secondary.mobile),
    email: choose(primary.email, secondary.email),
    address: choose(primary.address, secondary.address),
    city: choose(primary.city, secondary.city),
    district: choose(primary.district, secondary.district),
    state: choose(primary.state, secondary.state),
    country: choose(primary.country, secondary.country) || '',
    pinCode: choose(primary.pinCode, secondary.pinCode),
    photo: choose(primary.photo, secondary.photo),
    passportNumber: choose(primary.passportNumber, secondary.passportNumber),
    passportExpiry: choose(primary.passportExpiry, secondary.passportExpiry),
    visaNumber: choose(primary.visaNumber, secondary.visaNumber),
    visaExpiry: choose(primary.visaExpiry, secondary.visaExpiry),
    notes: choose(primary.notes, secondary.notes),
    createdAt: primary.createdAt || secondary.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
