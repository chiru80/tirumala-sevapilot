// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Conflict Detector (Phase 7)
// Identifies inconsistencies across age/DOB, identities,
// devotee records, and general booking details.
// ─────────────────────────────────────────────────────────────

import type { Pilgrim, Profile } from '@shared/types';
import { calculateAge, getEffectiveAge } from '@shared/utils';
import { normalizeAadhaar, normalizeName } from './profile-normalizer';

export interface ProfileConflict {
  id?: string;
  code:
    | 'AGE_DOB_MISMATCH'
    | 'FUTURE_DOB'
    | 'IMPOSSIBLE_AGE'
    | 'MISSING_AGE_AND_DOB'
    | 'SAME_ID_DIFFERENT_NAME'
    | 'SAME_ID_DIFFERENT_GENDER'
    | 'SAME_NAME_DIFFERENT_DOB'
    | 'CONTACT_EMAIL_MISMATCH';
  conflictType?: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING';
  pilgrimId?: string;
  pilgrimIndex?: number;
  pilgrimName?: string;
  field: string;
  message: string;
  currentValue?: unknown;
  suggestedValue?: unknown;
  conflictingValues?: {
    current: unknown;
    expected: unknown;
  };
  resolutionSuggestion: string;
}

/**
 * Validates age and date of birth coherence for a pilgrim.
 */
export function detectAgeDobConflict(pilgrim: Pilgrim, index?: number): ProfileConflict | null {
  const name = pilgrim.fullName || pilgrim.firstName || `Pilgrim ${(index ?? 0) + 1}`;

  // 1. Check for future DOB
  if (pilgrim.dateOfBirth) {
    const dobDate = new Date(pilgrim.dateOfBirth);
    if (!isNaN(dobDate.getTime()) && dobDate > new Date()) {
      return {
        code: 'FUTURE_DOB',
        severity: 'CRITICAL',
        pilgrimId: pilgrim.id,
        pilgrimIndex: index,
        pilgrimName: name,
        field: 'dateOfBirth',
        message: `${name} has a future Date of Birth (${pilgrim.dateOfBirth}).`,
        conflictingValues: { current: pilgrim.dateOfBirth, expected: 'Past date' },
        resolutionSuggestion: 'Enter a valid past Date of Birth.',
      };
    }
  }

  // 2. Check for impossible age
  if (pilgrim.age !== undefined && (pilgrim.age < 0 || pilgrim.age > 125)) {
    return {
      code: 'IMPOSSIBLE_AGE',
      severity: 'CRITICAL',
      pilgrimId: pilgrim.id,
      pilgrimIndex: index,
      pilgrimName: name,
      field: 'age',
      message: `${name} has an impossible age (${pilgrim.age}). Age must be between 1 and 125.`,
      conflictingValues: { current: pilgrim.age, expected: '1-125' },
      resolutionSuggestion: 'Correct the age to a valid number between 1 and 125.',
    };
  }

  // 3. Check for missing age & DOB
  if (pilgrim.age === undefined && !pilgrim.dateOfBirth) {
    return {
      code: 'MISSING_AGE_AND_DOB',
      severity: 'ERROR',
      pilgrimId: pilgrim.id,
      pilgrimIndex: index,
      pilgrimName: name,
      field: 'age',
      message: `${name} is missing both Age and Date of Birth.`,
      resolutionSuggestion: 'Provide either Age or Date of Birth.',
    };
  }

  // 4. Age vs DOB Mismatch
  if (pilgrim.age !== undefined && pilgrim.dateOfBirth) {
    const computedAge = calculateAge(pilgrim.dateOfBirth);
    if (!isNaN(computedAge)) {
      // Discrepancy greater than 1 year indicates data entry mismatch
      if (Math.abs(computedAge - pilgrim.age) > 1) {
        return {
          code: 'AGE_DOB_MISMATCH',
          severity: 'ERROR',
          pilgrimId: pilgrim.id,
          pilgrimIndex: index,
          pilgrimName: name,
          field: 'age',
          message: `${name}'s recorded age (${pilgrim.age}) conflicts with Date of Birth (${pilgrim.dateOfBirth}, calculated age: ${computedAge}).`,
          conflictingValues: {
            current: pilgrim.age,
            expected: computedAge,
          },
          resolutionSuggestion: `Update age to ${computedAge} based on DOB, or adjust the Date of Birth.`,
        };
      }
    }
  }

  return null;
}

/**
 * Scans a profile for conflicts between devotees.
 */
export function detectProfileConflicts(profile: Profile): ProfileConflict[] {
  const conflicts: ProfileConflict[] = [];
  const pilgrims = profile.pilgrims || [];

  // 1. Check individual age/DOB conflicts
  for (let i = 0; i < pilgrims.length; i++) {
    const issue = detectAgeDobConflict(pilgrims[i], i);
    if (issue) conflicts.push(issue);
  }

  // 2. Cross-pilgrim identity conflicts (Same ID Number, Different Name or Gender)
  const idRegistry = new Map<string, { pilgrim: Pilgrim; index: number }>();

  for (let i = 0; i < pilgrims.length; i++) {
    const p = pilgrims[i];
    if (!p.idNumber) continue;

    const normalizedId = normalizeAadhaar(p.idNumber);
    const existing = idRegistry.get(normalizedId);

    if (existing) {
      const existingName = normalizeName(existing.pilgrim.fullName || existing.pilgrim.firstName);
      const currentName = normalizeName(p.fullName || p.firstName);

      if (existingName.toLowerCase() !== currentName.toLowerCase()) {
        conflicts.push({
          code: 'SAME_ID_DIFFERENT_NAME',
          severity: 'CRITICAL',
          pilgrimId: p.id,
          pilgrimIndex: i,
          pilgrimName: p.fullName,
          field: 'idNumber',
          message: `ID Number (${p.idType} ending in ${p.idNumber.slice(-4)}) is assigned to two different names: "${existing.pilgrim.fullName}" and "${p.fullName}".`,
          conflictingValues: {
            current: p.fullName,
            expected: existing.pilgrim.fullName,
          },
          resolutionSuggestion: 'Verify that each devotee has their own authentic ID proof.',
        });
      }

      if (existing.pilgrim.gender !== p.gender) {
        conflicts.push({
          code: 'SAME_ID_DIFFERENT_GENDER',
          severity: 'CRITICAL',
          pilgrimId: p.id,
          pilgrimIndex: i,
          pilgrimName: p.fullName,
          field: 'gender',
          message: `ID Number (${p.idType} ending in ${p.idNumber.slice(-4)}) has conflicting genders: ${existing.pilgrim.gender} vs ${p.gender}.`,
          resolutionSuggestion: 'Correct the gender mismatch for the devotee record.',
        });
      }
    } else {
      idRegistry.set(normalizedId, { pilgrim: p, index: i });
    }
  }

  // 3. Same Name with Different DOB (Possible twin or conflicting duplicate)
  const nameRegistry = new Map<string, { pilgrim: Pilgrim; index: number }>();
  for (let i = 0; i < pilgrims.length; i++) {
    const p = pilgrims[i];
    const normName = normalizeName(p.fullName || p.firstName).toLowerCase();
    if (!normName) continue;

    const existing = nameRegistry.get(normName);
    if (existing && existing.pilgrim.dateOfBirth && p.dateOfBirth && existing.pilgrim.dateOfBirth !== p.dateOfBirth) {
      conflicts.push({
        code: 'SAME_NAME_DIFFERENT_DOB',
        severity: 'WARNING',
        pilgrimId: p.id,
        pilgrimIndex: i,
        pilgrimName: p.fullName,
        field: 'dateOfBirth',
        message: `Two devotees named "${p.fullName}" have different Dates of Birth (${existing.pilgrim.dateOfBirth} vs ${p.dateOfBirth}).`,
        resolutionSuggestion: 'Review devotee profiles to ensure unique records or disambiguate names.',
      });
    } else if (!existing) {
      nameRegistry.set(normName, { pilgrim: p, index: i });
    }
  }

  return conflicts.map((c, idx) => ({
    ...c,
    id: c.id || `conflict-${c.code}-${c.pilgrimId || idx}`,
    conflictType: c.conflictType || c.code,
  }));
}
