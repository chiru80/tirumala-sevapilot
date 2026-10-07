// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Service Intelligence Engine (Phase 3)
// Centralized rules, strict limits, compatibility analysis,
// and canonical enforcement across all 4 supported TTD services.
// ─────────────────────────────────────────────────────────────

import type { Profile, Pilgrim } from '@shared/types';
import {
  getCanonicalService,
  getAllCanonicalServices,
  getCanonicalServiceLimits,
  getCanonicalFieldRules,
  hasGeneralDetails,
  isFieldRequiredForService,
  isFieldUserControlled,
  CanonicalServiceDefinition,
} from './canonical-service-registry';

export interface PilgrimCountValidation {
  isValid: boolean;
  reason?: string;
  count: number;
  min: number;
  max: number;
  exact?: number;
}

export interface ServiceRulesSummary {
  serviceId: string;
  displayName: string;
  ticketPrice: number;
  minPilgrims: number;
  maxPilgrims: number;
  exactPilgrims?: number;
  hasGeneralDetails: boolean;
  requiredPilgrimFields: string[];
  optionalPilgrimFields: string[];
  requiredGeneralFields: string[];
  optionalGeneralFields: string[];
  userControlledFields: string[];
  specialRequirements?: {
    gothram?: boolean;
    photo?: boolean;
    declaration?: boolean;
    fitness?: boolean;
    passport?: boolean;
    visa?: boolean;
  };
}

export interface ServiceCompatibilityResult {
  isCompatible: boolean;
  serviceId: string;
  serviceName: string;
  countValidation: PilgrimCountValidation;
  missingPilgrimFields: { pilgrimIndex: number; pilgrimName: string; missing: string[] }[];
  missingGeneralFields: string[];
  userControlledWarnings: string[];
  recommendations: string[];
}

export class ServiceIntelligence {
  /**
   * Retrieves authoritative service rules for any supported TTD service or alias.
   */
  public static getRules(serviceIdOrType: string): ServiceRulesSummary | undefined {
    const canonical = getCanonicalService(serviceIdOrType);
    if (!canonical) return undefined;

    return {
      serviceId: canonical.serviceId,
      displayName: canonical.displayName,
      ticketPrice: canonical.ticketPrice,
      minPilgrims: canonical.minPilgrims,
      maxPilgrims: canonical.maxPilgrims,
      exactPilgrims: canonical.exactPilgrims,
      hasGeneralDetails: canonical.hasGeneralDetailsStep,
      requiredPilgrimFields: [...canonical.requiredPilgrimFields],
      optionalPilgrimFields: [...canonical.optionalPilgrimFields],
      requiredGeneralFields: [...canonical.requiredGeneralFields],
      optionalGeneralFields: [...canonical.optionalGeneralFields],
      userControlledFields: [...canonical.userControlledFields],
      specialRequirements: canonical.specialRequirements ? { ...canonical.specialRequirements } : undefined,
    };
  }

  /**
   * Enforces exact and bounded pilgrim count limits for a service.
   * - ₹300 SED: 1..6
   * - ₹200 SPAT: 1..6
   * - ₹1600 Homam: STRICTLY 2 (Householders)
   * - Srivari Seva: STRICTLY 1 (Individual devotee slot)
   */
  public static validatePilgrimCount(serviceId: string, count: number): PilgrimCountValidation {
    const canonical = getCanonicalService(serviceId);
    const min = canonical?.minPilgrims ?? 1;
    const max = canonical?.maxPilgrims ?? 6;
    const exact = canonical?.exactPilgrims;

    if (count <= 0) {
      return {
        isValid: false,
        reason: 'At least 1 devotee must be selected.',
        count,
        min,
        max,
        exact,
      };
    }

    if (exact !== undefined) {
      if (count !== exact) {
        let reason = `${canonical?.displayName || 'Service'} requires exactly ${exact} devotee${exact > 1 ? 's' : ''}.`;
        if (canonical?.serviceId === 'sri-srinivasa-divyanugraha-homam') {
          reason = 'Sri Srinivasa Divyanugraha Vishesha Homam (₹1600) requires exactly 2 devotees (Householders).';
        } else if (canonical?.serviceId === 'srivari-seva') {
          reason = 'Srivari Seva voluntary enrollment is issued strictly on an individual basis (exactly 1 devotee).';
        }
        return {
          isValid: false,
          reason,
          count,
          min,
          max,
          exact,
        };
      }
      return { isValid: true, count, min, max, exact };
    }

    if (count > max) {
      return {
        isValid: false,
        reason: `${canonical?.displayName || 'Service'} allows a maximum of ${max} devotees per booking.`,
        count,
        min,
        max,
        exact,
      };
    }

    if (count < min) {
      return {
        isValid: false,
        reason: `${canonical?.displayName || 'Service'} requires at least ${min} devotee(s).`,
        count,
        min,
        max,
        exact,
      };
    }

    return { isValid: true, count, min, max, exact };
  }

  /**
   * Checks whether General Details step is expected for this service.
   */
  public static isGeneralDetailsExpected(serviceId: string): boolean {
    return hasGeneralDetails(serviceId);
  }

  /**
   * Returns whether a field is strictly user-controlled for this service.
   */
  public static isUserControlled(serviceId: string, fieldKey: string): boolean {
    return isFieldUserControlled(serviceId, fieldKey);
  }

  /**
   * Comprehensive compatibility evaluation of a profile for a target service.
   */
  public static checkCompatibility(
    profile: Profile,
    serviceId: string,
    selectedPilgrims?: Pilgrim[],
  ): ServiceCompatibilityResult {
    const canonical = getCanonicalService(serviceId);
    const serviceName = canonical?.displayName || serviceId;
    const activePilgrims = selectedPilgrims ?? profile.pilgrims ?? [];
    const countValidation = this.validatePilgrimCount(serviceId, activePilgrims.length);

    const missingPilgrimFields: { pilgrimIndex: number; pilgrimName: string; missing: string[] }[] = [];
    const missingGeneralFields: string[] = [];
    const recommendations: string[] = [];
    const userControlledWarnings: string[] = [];

    // Check pilgrim fields
    const reqPilgrimFields = canonical?.requiredPilgrimFields ?? ['name', 'age', 'gender', 'idProofType', 'idProofNumber'];
    activePilgrims.forEach((p, idx) => {
      const pName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || `Pilgrim ${idx + 1}`;
      const missing: string[] = [];

      for (const field of reqPilgrimFields) {
        if (field === 'name' || field === 'fullName') {
          if (!p.fullName && !p.firstName) missing.push('name');
        } else if (field === 'age') {
          if (p.age === undefined || p.age === null) missing.push('age');
        } else if (field === 'gender') {
          if (!p.gender) missing.push('gender');
        } else if (field === 'idProofType' || field === 'idType') {
          if (!p.idType) missing.push('idProofType');
        } else if (field === 'idProofNumber' || field === 'idNumber') {
          if (!p.idNumber || p.idNumber.trim().length === 0) missing.push('idProofNumber');
        } else if (field === 'dateOfBirth') {
          if (!p.dateOfBirth) missing.push('dateOfBirth');
        } else if (field === 'mobile') {
          if (!p.mobile) missing.push('mobile');
        } else if (field === 'photo') {
          if (!p.photo) missing.push('photo');
        } else if (['country', 'state', 'district', 'city', 'street', 'doorNumber', 'pincode'].includes(field)) {
          // Srivari address fields
          const val = (p as any)[field] || (p.srivariSeva as any)?.[field] || (profile.general as any)?.[field];
          if (!val) missing.push(field);
        }
      }

      if (missing.length > 0) {
        missingPilgrimFields.push({ pilgrimIndex: idx, pilgrimName: pName, missing });
      }
    });

    // Check General Details if required
    if (canonical?.hasGeneralDetailsStep) {
      const general = profile.general;
      const reqGeneral = canonical.requiredGeneralFields;

      for (const f of reqGeneral) {
        if (f === 'gothram') {
          const hasGothram = Boolean(profile.gothram?.trim() || general?.gothram?.trim());
          if (!hasGothram) missingGeneralFields.push('gothram');
        } else if (f === 'email') {
          if (!general?.email) missingGeneralFields.push('email');
        } else if (f === 'city') {
          if (!general?.city) missingGeneralFields.push('city');
        } else if (f === 'state') {
          if (!general?.state) missingGeneralFields.push('state');
        } else if (f === 'country') {
          if (!general?.country) missingGeneralFields.push('country');
        } else if (f === 'pincode' || f === 'pinCode') {
          if (!general?.pinCode) missingGeneralFields.push('pincode');
        }
      }
    }

    // User controlled reminders
    if (canonical?.userControlledFields && canonical.userControlledFields.length > 0) {
      for (const field of canonical.userControlledFields) {
        if (field === 'declaration') {
          userControlledWarnings.push('Declaration checkbox must be reviewed and checked manually.');
        } else if (field === 'mentallyFit' || field === 'physicallyFit') {
          userControlledWarnings.push('Fitness attestations must be confirmed manually by the devotee.');
        }
      }
    }

    if (!countValidation.isValid && countValidation.reason) {
      recommendations.push(countValidation.reason);
    }
    if (missingPilgrimFields.length > 0) {
      recommendations.push(`Complete required photo ID and profile fields for ${missingPilgrimFields.length} devotee(s).`);
    }
    if (missingGeneralFields.length > 0) {
      recommendations.push(`Complete general details: ${missingGeneralFields.join(', ')}.`);
    }

    const isCompatible =
      countValidation.isValid &&
      missingPilgrimFields.length === 0 &&
      missingGeneralFields.length === 0;

    return {
      isCompatible,
      serviceId: canonical?.serviceId || serviceId,
      serviceName,
      countValidation,
      missingPilgrimFields,
      missingGeneralFields,
      userControlledWarnings,
      recommendations,
    };
  }

  /**
   * Automatically reconciles and selects eligible devotees matching a service's exact or max limit.
   * Prioritizes ready devotees first.
   */
  public static reconcilePilgrimSelection(profile: Profile, serviceId: string): string[] {
    const canonical = getCanonicalService(serviceId);
    const pilgrims = profile.pilgrims || [];
    if (pilgrims.length === 0) return [];

    const exact = canonical?.exactPilgrims;
    const max = canonical?.maxPilgrims ?? 6;
    const targetLimit = exact ?? max;

    // Check completeness of each devotee for this service
    const evaluated = pilgrims.map(p => {
      const pName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
      const hasName = Boolean(pName);
      const hasAge = Boolean((typeof p.age === 'number' && p.age > 0) || p.dateOfBirth);
      const hasGender = Boolean(p.gender);
      const hasIdType = Boolean(p.idType);
      const hasIdNum = Boolean(p.idNumber && p.idNumber.trim().length > 0);
      const isReady = hasName && hasAge && hasGender && hasIdType && hasIdNum;
      return { id: p.id, isReady };
    });

    // Pick ready devotees first, then fill up to targetLimit
    const readyIds = evaluated.filter(e => e.isReady).map(e => e.id);
    const otherIds = evaluated.filter(e => !e.isReady).map(e => e.id);

    return [...readyIds, ...otherIds].slice(0, targetLimit);
  }

  /**
   * Detailed per-devotee field readiness breakdown for a service.
   */
  public static getDevoteeReadiness(
    pilgrim: Pilgrim,
    serviceId: string,
  ): { isReady: boolean; missingFields: string[]; checklist: Record<string, boolean> } {
    const canonical = getCanonicalService(serviceId);
    const reqFields = canonical?.requiredPilgrimFields ?? ['name', 'age', 'gender', 'idProofType', 'idProofNumber'];
    const checklist: Record<string, boolean> = {};
    const missingFields: string[] = [];

    const pName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim();
    checklist['name'] = Boolean(pName);
    checklist['gender'] = Boolean(pilgrim.gender);
    checklist['age'] = Boolean((typeof pilgrim.age === 'number' && pilgrim.age > 0) || pilgrim.dateOfBirth);
    checklist['idProofType'] = Boolean(pilgrim.idType);
    checklist['idProofNumber'] = Boolean(pilgrim.idNumber && pilgrim.idNumber.trim().length > 0);

    if (serviceId.includes('srivari')) {
      checklist['dateOfBirth'] = Boolean(pilgrim.dateOfBirth);
      checklist['photo'] = Boolean(pilgrim.photo);
      checklist['mobile'] = Boolean(pilgrim.mobile && pilgrim.mobile.replace(/\D/g, '').length === 10);
      checklist['country'] = Boolean(pilgrim.country || 'India');
      checklist['state'] = Boolean(pilgrim.state);
      checklist['district'] = Boolean(pilgrim.district);
      checklist['city'] = Boolean(pilgrim.city);
      checklist['street'] = Boolean(pilgrim.srivariSeva?.street || pilgrim.address);
      checklist['doorNumber'] = Boolean(pilgrim.srivariSeva?.doorNumber);
      checklist['pincode'] = Boolean(pilgrim.pinCode);
    }

    for (const field of reqFields) {
      if (!checklist[field]) {
        missingFields.push(field);
      }
    }

    return {
      isReady: missingFields.length === 0,
      missingFields,
      checklist,
    };
  }
}

