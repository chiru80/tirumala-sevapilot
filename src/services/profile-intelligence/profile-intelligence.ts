// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Intelligence Service
// Phase 7: Advanced Profile & Document Intelligence
// ─────────────────────────────────────────────────

import { Profile, Pilgrim, IdType } from '../../shared/types';
import {
  computeProfileRevision,
  normalizeAadhaar,
  normalizeMobile,
  normalizeEmail,
} from './profile-normalizer';
import { detectProfileConflicts, ProfileConflict } from './profile-conflict-detector';
import { detectDuplicatePilgrims, DuplicateDetectionResult } from './profile-duplicate-detector';
import { getServiceConfig } from '../ttd-information/ttd-service-rules';
import { getWorkflowById } from '../workflows/registry';
import { validateAadhaar } from '../../validation/aadhaar';

export type ProfileQualityStatus =
  | 'READY'
  | 'GOOD'
  | 'NEEDS_ATTENTION'
  | 'INCOMPLETE'
  | 'INVALID';

export interface ProfileIssue {
  id: string;
  field: string;
  pilgrimId?: string;
  pilgrimName?: string;
  type: 'ERROR' | 'WARNING';
  message: string;
  actionRequired?: string;
}

export interface ProfileRecommendation {
  id: string;
  title: string;
  description: string;
  actionType: 'REPAIR' | 'REVIEW' | 'ADD_DEVOTEE' | 'SELECT_PILGRIMS';
}

export interface ProfileQuality {
  score: number; // 0 to 100
  status: ProfileQualityStatus;
  errors: ProfileIssue[];
  warnings: ProfileIssue[];
  recommendations: ProfileRecommendation[];
  revision: string;
  serviceId?: string;
  selectedPilgrimCount: number;
}

export interface AutofillSessionTracking {
  sessionId: string;
  profileId: string;
  profileRevision: string;
  serviceId: string;
  selectedPilgrimIds: string[];
  createdAt: number;
}

/**
 * Mask sensitive Aadhaar to `•••• •••• 9012`
 */
export function maskAadhaar(raw: string): string {
  const norm = normalizeAadhaar(raw);
  if (norm.length < 4) return '•••• •••• ••••';
  const last4 = norm.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Mask mobile to `••••••3210`
 */
export function maskMobile(raw: string): string {
  const norm = normalizeMobile(raw);
  if (norm.length < 4) return '••••••••••';
  const last4 = norm.slice(-4);
  return `••••••${last4}`;
}

/**
 * Mask email to `c***@example.com`
 */
export function maskEmail(raw: string): string {
  const norm = normalizeEmail(raw);
  const atIdx = norm.indexOf('@');
  if (atIdx <= 1) return '***@***';
  const firstChar = norm.charAt(0);
  const domain = norm.slice(atIdx);
  return `${firstChar}***${domain}`;
}

/**
 * Generic ID mask helper
 */
export function maskId(idNumber: string, idType?: IdType): string {
  if (idType === IdType.AADHAAR) {
    return maskAadhaar(idNumber);
  }
  const clean = (idNumber || '').trim();
  if (clean.length <= 4) return '••••';
  return `••••${clean.slice(-4)}`;
}

export interface ProfileQualityEvaluationParams {
  profile: Profile;
  serviceId?: string;
  selectedPilgrimIds?: string[];
  workflowId?: string;
}

/**
 * Evaluates profile quality based on:
 * profile + service + workflow + selected pilgrims
 */
export function evaluateProfileQuality(
  params: ProfileQualityEvaluationParams
): ProfileQuality {
  const { profile, serviceId, selectedPilgrimIds, workflowId } = params;
  const errors: ProfileIssue[] = [];
  const warnings: ProfileIssue[] = [];
  const recommendations: ProfileRecommendation[] = [];

  const revision = computeProfileRevision(profile);

  // 1. Identify active pilgrims to check
  const activePilgrims: Pilgrim[] =
    selectedPilgrimIds && selectedPilgrimIds.length > 0
      ? profile.pilgrims.filter((p) => selectedPilgrimIds.includes(p.id))
      : profile.pilgrims;

  const selectedPilgrimCount = activePilgrims.length;

  if (selectedPilgrimCount === 0) {
    errors.push({
      id: 'err-no-pilgrims',
      field: 'pilgrims',
      type: 'ERROR',
      message: 'No pilgrims are configured or selected in this profile.',
      actionRequired: 'Add or select at least one devotee.',
    });
  }

  // 2. Service constraints checking
  const serviceConfig = serviceId ? getServiceConfig(serviceId) : undefined;
  if (serviceConfig) {
    if (serviceConfig.exactPilgrims && selectedPilgrimCount !== serviceConfig.exactPilgrims) {
      errors.push({
        id: 'err-exact-pilgrims',
        field: 'selectedPilgrimCount',
        type: 'ERROR',
        message: `${serviceConfig.displayName} requires exactly ${serviceConfig.exactPilgrims} devotees. Currently ${selectedPilgrimCount} selected.`,
        actionRequired: `Select exactly ${serviceConfig.exactPilgrims} devotees.`,
      });
    } else {
      if (serviceConfig.minPilgrims && selectedPilgrimCount < serviceConfig.minPilgrims) {
        errors.push({
          id: 'err-min-pilgrims',
          field: 'selectedPilgrimCount',
          type: 'ERROR',
          message: `${serviceConfig.displayName} requires at least ${serviceConfig.minPilgrims} devotee(s). Currently ${selectedPilgrimCount} selected.`,
          actionRequired: `Select at least ${serviceConfig.minPilgrims} devotees.`,
        });
      }
      if (serviceConfig.maxPilgrims && selectedPilgrimCount > serviceConfig.maxPilgrims) {
        errors.push({
          id: 'err-max-pilgrims',
          field: 'selectedPilgrimCount',
          type: 'ERROR',
          message: `${serviceConfig.displayName} allows maximum ${serviceConfig.maxPilgrims} devotees. Currently ${selectedPilgrimCount} selected.`,
          actionRequired: `Reduce selection to at most ${serviceConfig.maxPilgrims} devotees.`,
        });
      }
    }

    // Homam Gothram requirement check
    if (serviceConfig.specialRequirements?.gothram) {
      const hasGothram =
        Boolean(profile.gothram && profile.gothram.trim().length > 0) ||
        Boolean(profile.general?.gothram && profile.general.gothram.trim().length > 0);
      if (!hasGothram) {
        errors.push({
          id: 'err-missing-gothram',
          field: 'gothram',
          type: 'ERROR',
          message: `Gothram is mandatory for ${serviceConfig.displayName}.`,
          actionRequired: 'Provide Gothram in profile or general details.',
        });
      }
    }
  }

  // 3. Pilgrim-level integrity
  for (const pilgrim of activePilgrims) {
    const pName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || 'Devotee';

    // Name
    if (!pilgrim.fullName && (!pilgrim.firstName || pilgrim.firstName.trim().length === 0)) {
      errors.push({
        id: `err-pilgrim-name-${pilgrim.id}`,
        field: 'fullName',
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        type: 'ERROR',
        message: `${pName}: Devotee name is required.`,
        actionRequired: 'Enter devotee full name.',
      });
    }

    // Gender
    if (!pilgrim.gender) {
      errors.push({
        id: `err-pilgrim-gender-${pilgrim.id}`,
        field: 'gender',
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        type: 'ERROR',
        message: `${pName}: Gender is required.`,
        actionRequired: 'Select gender.',
      });
    }

    // Age / DOB
    if (!pilgrim.age && !pilgrim.dateOfBirth) {
      errors.push({
        id: `err-pilgrim-age-${pilgrim.id}`,
        field: 'age',
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        type: 'ERROR',
        message: `${pName}: Age or Date of Birth is required.`,
        actionRequired: 'Provide age or Date of Birth.',
      });
    }

    // ID Type & ID Number
    if (!pilgrim.idType) {
      errors.push({
        id: `err-pilgrim-idtype-${pilgrim.id}`,
        field: 'idType',
        pilgrimId: pilgrim.id,
        pilgrimName: pName,
        type: 'ERROR',
        message: `${pName}: Photo ID proof type is required.`,
        actionRequired: 'Select photo ID type (Aadhaar, Passport, etc.).',
      });
    } else if (pilgrim.idType === IdType.AADHAAR) {
      if (!pilgrim.idNumber) {
        errors.push({
          id: `err-pilgrim-idnum-${pilgrim.id}`,
          field: 'idNumber',
          pilgrimId: pilgrim.id,
          pilgrimName: pName,
          type: 'ERROR',
          message: `${pName}: Aadhaar number is missing.`,
          actionRequired: 'Enter 12-digit Aadhaar number.',
        });
      } else {
        const aadhRes = validateAadhaar(pilgrim.idNumber);
        if (!aadhRes.valid) {
          errors.push({
            id: `err-pilgrim-aadh-val-${pilgrim.id}`,
            field: 'idNumber',
            pilgrimId: pilgrim.id,
            pilgrimName: pName,
            type: 'ERROR',
            message: `${pName}: ${aadhRes.error || 'Invalid Aadhaar number.'}`,
            actionRequired: 'Correct the Aadhaar number.',
          });
        }
      }
    } else {
      if (!pilgrim.idNumber || pilgrim.idNumber.trim().length === 0) {
        errors.push({
          id: `err-pilgrim-idnum-${pilgrim.id}`,
          field: 'idNumber',
          pilgrimId: pilgrim.id,
          pilgrimName: pName,
          type: 'ERROR',
          message: `${pName}: ${pilgrim.idType} number is missing.`,
          actionRequired: `Enter ${pilgrim.idType} number.`,
        });
      }
    }
  }

  // 4. Conflicts check
  const conflicts: ProfileConflict[] = detectProfileConflicts(profile);
  for (const c of conflicts) {
    const conflictId = c.id || `conflict-${c.code}-${c.pilgrimId || 'prof'}`;
    if (c.severity === 'ERROR' || c.severity === 'CRITICAL') {
      errors.push({
        id: `err-${conflictId}`,
        field: c.field,
        pilgrimId: c.pilgrimId,
        type: 'ERROR',
        message: c.message,
        actionRequired: c.resolutionSuggestion || 'Resolve conflict before booking.',
      });
    } else {
      warnings.push({
        id: `warn-${conflictId}`,
        field: c.field,
        pilgrimId: c.pilgrimId,
        type: 'WARNING',
        message: c.message,
        actionRequired: c.resolutionSuggestion || 'Review details.',
      });
    }
  }

  // 5. Duplicate check
  const dupResult: DuplicateDetectionResult = detectDuplicatePilgrims(activePilgrims);
  if (dupResult.hasDuplicates) {
    for (const match of dupResult.matches) {
      if (match.confidence === 'EXACT_ID') {
        errors.push({
          id: `err-dup-${match.id}`,
          field: 'idNumber',
          type: 'ERROR',
          message: `Duplicate identity: ${match.pilgrimAName} and ${match.pilgrimBName} have the same ID number.`,
          actionRequired: 'Compare and remove or merge duplicate devotees.',
        });
      } else {
        warnings.push({
          id: `warn-dup-${match.id}`,
          field: 'fullName',
          type: 'WARNING',
          message: `Potential duplicate: ${match.pilgrimAName} and ${match.pilgrimBName} (${match.reasons.join(', ')}).`,
          actionRequired: 'Verify devotees are distinct individuals.',
        });
      }
    }
  }

  // 6. Workflow-specific check if provided
  if (workflowId) {
    const wf = getWorkflowById(workflowId);
    if (wf?.serviceId === 'sri-srinivasa-divyanugraha-homam') {
      const hasGothram = Boolean(profile.gothram?.trim() || profile.general?.gothram?.trim());
      if (!hasGothram && !errors.some((e) => e.field === 'gothram')) {
        errors.push({
          id: 'err-wf-missing-gothram',
          field: 'gothram',
          type: 'ERROR',
          message: `Gothram is mandatory for ${wf.serviceName}.`,
          actionRequired: 'Provide Gothram.',
        });
      }
    }
  }

  // Calculate score and status
  let score = 100;
  score -= errors.length * 25;
  score -= warnings.length * 10;
  if (score < 0) score = 0;

  let status: ProfileQualityStatus;
  if (errors.length > 0) {
    status = errors.some((e) => e.id.includes('aadh-val') || e.id.includes('dup-'))
      ? 'INVALID'
      : 'INCOMPLETE';
  } else if (warnings.length > 0) {
    status = 'NEEDS_ATTENTION';
  } else if (score >= 95) {
    status = 'READY';
  } else {
    status = 'GOOD';
  }

  if (errors.length > 0) {
    recommendations.push({
      id: 'rec-repair-errors',
      title: 'Repair Incomplete Fields',
      description: `Resolve ${errors.length} error(s) to make profile booking-ready.`,
      actionType: 'REPAIR',
    });
  }

  if (dupResult.hasDuplicates) {
    recommendations.push({
      id: 'rec-resolve-duplicates',
      title: 'Resolve Devotee Duplicates',
      description: `${dupResult.totalDuplicates} duplicate devotee match(es) detected. Review and merge.`,
      actionType: 'REVIEW',
    });
  }

  return {
    score,
    status,
    errors,
    warnings,
    recommendations,
    revision,
    serviceId,
    selectedPilgrimCount,
  };
}

/**
 * Initializes an autofill session token tracking profile revision and selected pilgrims.
 */
export function createAutofillSession(
  profile: Profile,
  serviceId: string,
  selectedPilgrimIds: string[]
): AutofillSessionTracking {
  return {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    profileId: profile.id,
    profileRevision: computeProfileRevision(profile),
    serviceId,
    selectedPilgrimIds: [...selectedPilgrimIds],
    createdAt: Date.now(),
  };
}

/**
 * Validates that the active profile has not changed since the autofill session was created.
 * Prevents autofilling with stale profile data.
 */
export function verifyAutofillSessionRevision(
  session: AutofillSessionTracking,
  currentProfile: Profile
): { valid: boolean; currentRevision: string; reason?: string } {
  if (session.profileId !== currentProfile.id) {
    return {
      valid: false,
      currentRevision: computeProfileRevision(currentProfile),
      reason: 'Active profile changed. Current profile does not match session profile.',
    };
  }

  const currentRevision = computeProfileRevision(currentProfile);
  if (session.profileRevision !== currentRevision) {
    return {
      valid: false,
      currentRevision,
      reason: 'Profile was modified after session start. Stale profile revision detected.',
    };
  }

  return {
    valid: true,
    currentRevision,
  };
}
