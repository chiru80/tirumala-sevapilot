// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Repair Engine
// Phase 7: Advanced Profile & Document Intelligence
// ─────────────────────────────────────────────────

import { Profile, Pilgrim, IdType } from '../../shared/types';
import {
  normalizeAadhaar,
  normalizeDob,
  normalizePincode,
  normalizeMobile,
  calculateAgeFromDob,
  computeProfileRevision,
} from './profile-normalizer';
import { detectProfileConflicts } from './profile-conflict-detector';

export interface ProfileRepairAction {
  id: string;
  pilgrimId?: string;
  pilgrimName?: string;
  field: string;
  issueType:
    | 'INVALID_AADHAAR'
    | 'AGE_DOB_MISMATCH'
    | 'MISSING_PINCODE'
    | 'MISSING_NAME'
    | 'MISSING_ID_TYPE'
    | 'MISSING_AGE'
    | 'INVALID_MOBILE'
    | 'UNNORMALIZED_SPACING';
  description: string;
  currentValue: unknown;
  suggestedValue: unknown;
  requiresExplicitConfirmation: boolean;
}

export interface ProfileRepairPlan {
  profileId: string;
  repairs: ProfileRepairAction[];
  autoFixableCount: number;
  confirmationRequiredCount: number;
}

/**
 * Analyzes a Profile and builds an actionable repair plan.
 * Never silently applies changes; generates a proposal for user approval.
 */
export function buildProfileRepairPlan(profile: Profile): ProfileRepairPlan {
  const repairs: ProfileRepairAction[] = [];

  // Check general address fields
  if (profile.general) {
    if (!profile.general.pinCode || profile.general.pinCode.trim().length === 0) {
      repairs.push({
        id: `repair-general-pincode-${profile.id}`,
        field: 'general.pinCode',
        issueType: 'MISSING_PINCODE',
        description: 'Pincode is missing in General Details for booking',
        currentValue: profile.general.pinCode,
        suggestedValue: '',
        requiresExplicitConfirmation: true,
      });
    } else {
      const normPin = normalizePincode(profile.general.pinCode);
      if (normPin.length === 6 && normPin !== profile.general.pinCode) {
        repairs.push({
          id: `repair-general-pincode-norm-${profile.id}`,
          field: 'general.pinCode',
          issueType: 'UNNORMALIZED_SPACING',
          description: 'Format pincode to clean 6 digits',
          currentValue: profile.general.pinCode,
          suggestedValue: normPin,
          requiresExplicitConfirmation: false,
        });
      }
    }

    if (profile.general.mobile) {
      const normMob = normalizeMobile(profile.general.mobile);
      if (normMob.length === 10 && normMob !== profile.general.mobile) {
        repairs.push({
          id: `repair-general-mobile-norm-${profile.id}`,
          field: 'general.mobile',
          issueType: 'UNNORMALIZED_SPACING',
          description: 'Standardize contact mobile to 10-digit format',
          currentValue: profile.general.mobile,
          suggestedValue: normMob,
          requiresExplicitConfirmation: false,
        });
      }
    }
  }

  // Analyze each pilgrim
  for (const pilgrim of profile.pilgrims) {
    const pName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || 'Unnamed Pilgrim';

    // 1. Missing name
    if (!pilgrim.fullName && (!pilgrim.firstName || pilgrim.firstName.trim().length === 0)) {
      repairs.push({
        id: `repair-${pilgrim.id}-missing-name`,
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        field: 'fullName',
        issueType: 'MISSING_NAME',
        description: 'Devotee name is empty',
        currentValue: '',
        suggestedValue: '',
        requiresExplicitConfirmation: true,
      });
    }

    // 2. Missing ID Type
    if (!pilgrim.idType) {
      repairs.push({
        id: `repair-${pilgrim.id}-missing-id-type`,
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        field: 'idType',
        issueType: 'MISSING_ID_TYPE',
        description: 'Photo ID Type is not specified',
        currentValue: pilgrim.idType,
        suggestedValue: IdType.AADHAAR,
        requiresExplicitConfirmation: true,
      });
    }

    // 3. Aadhaar normalization/repair
    if (pilgrim.idType === IdType.AADHAAR && pilgrim.idNumber) {
      const normAadhaar = normalizeAadhaar(pilgrim.idNumber);
      if (normAadhaar.length === 12 && normAadhaar !== pilgrim.idNumber) {
        repairs.push({
          id: `repair-${pilgrim.id}-aadhaar-format`,
          pilgrimId: pilgrim.id,
          pilgrimName: pName,
          field: 'idNumber',
          issueType: 'UNNORMALIZED_SPACING',
          description: 'Format Aadhaar to clean 12 digits (remove dashes/spaces)',
          currentValue: pilgrim.idNumber,
          suggestedValue: normAadhaar,
          requiresExplicitConfirmation: false,
        });
      }
    }

    // 4. Age and DOB relationship
    if (pilgrim.dateOfBirth) {
      const normDob = normalizeDob(pilgrim.dateOfBirth);
      if (normDob) {
        const computedAge = calculateAgeFromDob(normDob);
        if (computedAge !== null) {
          if (pilgrim.age === undefined || pilgrim.age === null) {
            repairs.push({
              id: `repair-${pilgrim.id}-fill-age`,
              pilgrimId: pilgrim.id,
              pilgrimName: pName,
              field: 'age',
              issueType: 'MISSING_AGE',
              description: `Calculate age (${computedAge}) based on recorded Date of Birth (${normDob})`,
              currentValue: pilgrim.age,
              suggestedValue: computedAge,
              requiresExplicitConfirmation: false,
            });
          } else if (Math.abs(pilgrim.age - computedAge) > 1) {
            repairs.push({
              id: `repair-${pilgrim.id}-age-dob-mismatch`,
              pilgrimId: pilgrim.id,
              pilgrimName: pName,
              field: 'age',
              issueType: 'AGE_DOB_MISMATCH',
              description: `Synchronize age with DOB (recorded: ${pilgrim.age}, DOB calculation: ${computedAge})`,
              currentValue: pilgrim.age,
              suggestedValue: computedAge,
              requiresExplicitConfirmation: true,
            });
          }
        }
      }
    }
  }

  // Also include conflict detection results to flag any remaining conflicts
  const conflicts = detectProfileConflicts(profile);
  for (const conflict of conflicts) {
    if (!repairs.some((r) => r.pilgrimId === conflict.pilgrimId && r.field === conflict.field)) {
      const cId = conflict.id || `conflict-${conflict.code}-${conflict.pilgrimId || 'prof'}`;
      repairs.push({
        id: `repair-conflict-${cId}`,
        pilgrimId: conflict.pilgrimId,
        field: conflict.field,
        issueType: 'AGE_DOB_MISMATCH',
        description: conflict.message,
        currentValue: conflict.conflictingValues?.current ?? conflict.currentValue,
        suggestedValue: conflict.conflictingValues?.expected ?? conflict.suggestedValue,
        requiresExplicitConfirmation: true,
      });
    }
  }

  const autoFixableCount = repairs.filter((r) => !r.requiresExplicitConfirmation).length;
  const confirmationRequiredCount = repairs.filter((r) => r.requiresExplicitConfirmation).length;

  return {
    profileId: profile.id,
    repairs,
    autoFixableCount,
    confirmationRequiredCount,
  };
}

/**
 * Applies approved repairs to a Profile producing an updated clone.
 * Does not mutate the input profile. Computes fresh revision hash.
 */
export function applyProfileRepairs(
  profile: Profile,
  approvedRepairIds: string[],
  repairPlan?: ProfileRepairPlan
): { updatedProfile: Profile; appliedCount: number; newRevision: string } {
  const plan = repairPlan || buildProfileRepairPlan(profile);
  const approvedSet = new Set(approvedRepairIds);
  const updatedProfile: Profile = JSON.parse(JSON.stringify(profile));
  let appliedCount = 0;

  for (const repair of plan.repairs) {
    if (!approvedSet.has(repair.id)) continue;

    if (repair.field.startsWith('general.') && updatedProfile.general) {
      const subField = repair.field.split('.')[1] as keyof typeof updatedProfile.general;
      (updatedProfile.general as Record<string, unknown>)[subField] = repair.suggestedValue;
      appliedCount++;
    } else if (repair.pilgrimId) {
      const pilgrim = updatedProfile.pilgrims.find((p) => p.id === repair.pilgrimId);
      if (pilgrim) {
        (pilgrim as unknown as Record<string, unknown>)[repair.field] = repair.suggestedValue;
        appliedCount++;
      }
    }
  }

  updatedProfile.updatedAt = new Date().toISOString();
  const newRevision = computeProfileRevision(updatedProfile);

  return {
    updatedProfile,
    appliedCount,
    newRevision,
  };
}
