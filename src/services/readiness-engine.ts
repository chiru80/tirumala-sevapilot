// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Readiness Engine (Phase 5)
// Service-Specific Booking Readiness & Why Not Ready Engine
// Strictly User-Controlled — Zero PII Transmission
// ─────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim } from '@shared/types';
import { validateAadhaar } from '../validation/aadhaar';
import { validateMobile } from '../validation/mobile';
import { checkGeneralHealth } from './profile-health';
import { getWorkflowById } from './workflows/registry';
import { getServiceConfig, type TtdServiceConfig } from './ttd-information/ttd-service-rules';
import {
  detectDeclarationCheckbox,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from './workflows/step-detectors';
import { resolveSrivariEnrollmentFields } from '../content/autofill/field-resolver';

export interface ReadinessCheckItem {
  id: string;
  label: string;
  status: 'ready' | 'warning' | 'error';
  message: string;
  detail?: string;
}

export interface WhyNotReadyExplanationItem {
  type: 'pass' | 'fail';
  text: string;
}

export interface WhyNotReadyExplanation {
  status: 'READY' | 'NOT_READY';
  headline: string;
  items: WhyNotReadyExplanationItem[];
  recommendedActions: string[];
}

import { getEffectiveAge } from '@shared/utils';

export type DomReadinessStatus =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'USER_ACTION_REQUIRED'
  | 'BLOCKED'
  | 'UNKNOWN';

export interface DomReadinessEvaluation {
  isReady: boolean;
  status: DomReadinessStatus;
  step: 'INSTRUCTIONS_REVIEW' | 'SRIVARI_SEVA_ENROLLMENT' | 'UNKNOWN';
  actionRequired: boolean;
  actionMessage?: string;
  missingRequiredFields: string[];
  satisfiedRequiredFields: string[];
  optionalFieldsSkipped: string[];
  optionalFieldsAvailable: string[];
}

export interface ReadinessEvaluation {
  score: number; // 0 to 100
  isComplete: boolean;
  isProfileReady: boolean;
  isBookingReady: boolean;
  pilgrimCount: number;
  readyPilgrimsCount: number;
  checks: ReadinessCheckItem[];
  missingFields: string[];
  recommendations: string[];
  whyNotReady?: WhyNotReadyExplanation;
}

import { getCanonicalService } from './canonical-service-registry';

export type BookingReadinessStatus =
  | 'READY'
  | 'ACTION_REQUIRED'
  | 'NOT_READY'
  | 'UNKNOWN';

export interface InternalDiagnostics {
  score: number;
  checks: ReadinessCheckItem[];
  missingFields: string[];
  recommendations: string[];
  whyNotReady?: WhyNotReadyExplanation;
  evaluation?: ReadinessEvaluation;
  profileComplete?: boolean;
  pilgrimFieldsComplete?: boolean;
  idVerified?: boolean;
  generalDetailsComplete?: boolean;
  specialDetailsComplete?: boolean;
  serviceCountValid?: boolean;
  formDetected?: boolean;
  officialSourceVerified?: boolean;
}

export interface BookingReadiness {
  status: BookingReadinessStatus;
  headline: string;
  userAction?: string;
  serviceId?: string;
  pilgrimCount: number;
  maxPilgrims?: number;
  exactPilgrims?: number;
  canFill: boolean;
  diagnostics?: InternalDiagnostics;
}

export class ReadinessEngine {
  /**
   * Authoritative canonical readiness evaluation for product consumers.
   * Produces clean consumer statuses without percentage clutter.
   */
  public static evaluateBookingReadiness(
    profile: Profile | null | undefined,
    serviceType: ServiceType | string = ServiceType.DARSHAN,
    serviceId?: string,
    selectedPilgrims?: (string | Pilgrim)[],
    pageDetected: boolean = false,
  ): BookingReadiness {
    const effectiveServiceId =
      serviceId ||
      (typeof serviceType === 'string' &&
      serviceType !== ServiceType.DARSHAN &&
      serviceType !== ServiceType.GENERIC
        ? serviceType
        : undefined);
    const canonical = effectiveServiceId
      ? getCanonicalService(effectiveServiceId)
      : getCanonicalService(String(serviceType));

    const evaluation = ReadinessEngine.evaluate(
      profile,
      serviceType,
      effectiveServiceId,
      selectedPilgrims,
    );

    const diagnostics: InternalDiagnostics = {
      score: evaluation.score,
      checks: evaluation.checks,
      missingFields: evaluation.missingFields,
      recommendations: evaluation.recommendations,
      whyNotReady: evaluation.whyNotReady,
      evaluation,
    };

    if (!profile) {
      return {
        status: 'NOT_READY',
        headline: 'No pilgrim profile selected',
        userAction: 'Create or select a devotee profile',
        serviceId: effectiveServiceId,
        pilgrimCount: 0,
        maxPilgrims: canonical?.maxPilgrims,
        exactPilgrims: canonical?.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    if (evaluation.pilgrimCount === 0) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Select pilgrims',
        userAction: 'Select at least one devotee',
        serviceId: effectiveServiceId,
        pilgrimCount: 0,
        maxPilgrims: canonical?.maxPilgrims,
        exactPilgrims: canonical?.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    // Exact count violation (e.g. Homam requires exact 2, Srivari requires exact 1)
    const candidateCount = selectedPilgrims ? selectedPilgrims.length : (profile?.pilgrims?.length ?? 0);
    if (canonical?.exactPilgrims && candidateCount !== canonical.exactPilgrims) {
      return {
        status: 'ACTION_REQUIRED',
        headline: `Exact ${canonical.exactPilgrims} devotee${canonical.exactPilgrims > 1 ? 's' : ''} required`,
        userAction: `${canonical.displayName} requires exactly ${canonical.exactPilgrims} devotee${canonical.exactPilgrims > 1 ? 's' : ''}`,
        serviceId: effectiveServiceId,
        pilgrimCount: candidateCount,
        maxPilgrims: canonical.maxPilgrims,
        exactPilgrims: canonical.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    if (canonical?.maxPilgrims && candidateCount > canonical.maxPilgrims) {
      return {
        status: 'ACTION_REQUIRED',
        headline: `Max ${canonical.maxPilgrims} devotee${canonical.maxPilgrims > 1 ? 's' : ''} allowed`,
        userAction: `Select at most ${canonical.maxPilgrims} devotee for ${canonical.displayName}`,
        serviceId: effectiveServiceId,
        pilgrimCount: candidateCount,
        maxPilgrims: canonical.maxPilgrims,
        exactPilgrims: canonical.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    // Pilgrim details missing/invalid
    if (!evaluation.isProfileReady) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Devotee details need attention',
        userAction: "Complete your pilgrim's ID details",
        serviceId: effectiveServiceId,
        pilgrimCount: evaluation.pilgrimCount,
        maxPilgrims: canonical?.maxPilgrims,
        exactPilgrims: canonical?.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    // General details needed for services with general details step
    const generalOrAddrCheck = evaluation.checks.find(
      c => c.id === 'general_details' || c.id === 'srivari_address',
    );
    if (canonical?.hasGeneralDetailsStep && generalOrAddrCheck && generalOrAddrCheck.status !== 'ready') {
      const isGothramMissing = evaluation.missingFields.some(f => f.toLowerCase().includes('gothram'));
      return {
        status: 'ACTION_REQUIRED',
        headline: isGothramMissing ? 'Gothram required for sankalpam' : 'General details needed',
        userAction: isGothramMissing ? 'Enter family Gothram for Homam' : 'Complete general contact and address details',
        serviceId: effectiveServiceId,
        pilgrimCount: evaluation.pilgrimCount,
        maxPilgrims: canonical?.maxPilgrims,
        exactPilgrims: canonical?.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    if (!evaluation.isBookingReady) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Booking details need attention',
        userAction: evaluation.recommendations[0] || 'Review details before proceeding',
        serviceId: effectiveServiceId,
        pilgrimCount: evaluation.pilgrimCount,
        maxPilgrims: canonical?.maxPilgrims,
        exactPilgrims: canonical?.exactPilgrims,
        canFill: false,
        diagnostics,
      };
    }

    return {
      status: 'READY',
      headline: pageDetected ? 'Ready to fill & verify' : 'Booking details ready',
      userAction: pageDetected ? undefined : 'Open official TTD booking page',
      serviceId: effectiveServiceId,
      pilgrimCount: evaluation.pilgrimCount,
      maxPilgrims: canonical?.maxPilgrims,
      exactPilgrims: canonical?.exactPilgrims,
      canFill: pageDetected,
      diagnostics,
    };
  }
  /**
   * Evaluate booking readiness for an active profile and target service.
   * Strictly enforces that 100% is only awarded when all required fields and validations pass.
   */
  public static evaluate(
    profile: Profile | null | undefined,
    serviceType: ServiceType | string = ServiceType.DARSHAN,
    serviceId?: string,
    selectedPilgrims?: (string | Pilgrim)[],
  ): ReadinessEvaluation {
    const checks: ReadinessCheckItem[] = [];
    const missingFields: string[] = [];
    const recommendations: string[] = [];
    const explanationItems: WhyNotReadyExplanationItem[] = [];

    // Resolve service config if available
    // Note: When evaluated for specific serviceId (e.g. 'special-entry-300', 'sri-srinivasa-divyanugraha-homam'),
    // we use the Phase 5 service config rules.
    const resolvedServiceId = serviceId || (typeof serviceType === 'string' && serviceType !== ServiceType.DARSHAN && serviceType !== ServiceType.GENERIC ? serviceType : undefined);
    const serviceConfig: TtdServiceConfig | undefined = resolvedServiceId
      ? getServiceConfig(resolvedServiceId)
      : undefined;
    const isSrivariSeva = resolvedServiceId === 'srivari-seva' || serviceType === ServiceType.SRIVARI_SEVA;


    if (!profile) {
      explanationItems.push({
        type: 'fail',
        text: 'No pilgrim profile selected',
      });
      return {
        score: 0,
        isComplete: false,
        isProfileReady: false,
        isBookingReady: false,
        pilgrimCount: 0,
        readyPilgrimsCount: 0,
        checks: [
          {
            id: 'no_profile',
            label: 'Pilgrim Profile',
            status: 'error',
            message: 'No pilgrim profile selected',
            detail: 'Please create or select a profile in the Pilgrims tab.',
          },
        ],
        missingFields: ['Profile'],
        recommendations: ['Create a profile and add your devotee details.'],
        whyNotReady: {
          status: 'NOT_READY',
          headline: 'BOOKING NOT READY',
          items: explanationItems,
          recommendedActions: ['Create a profile and add your devotee details.'],
        },
      };
    }

    const pilgrims: Pilgrim[] = profile?.pilgrims || [];
    if (pilgrims.length === 0) {
      explanationItems.push({
        type: 'fail',
        text: '0 pilgrims added in profile',
      });
      return {
        score: 10,
        isComplete: false,
        isProfileReady: false,
        isBookingReady: false,
        pilgrimCount: 0,
        readyPilgrimsCount: 0,
        checks: [
          {
            id: 'empty_pilgrims',
            label: 'Devotee Records',
            status: 'error',
            message: 'No devotees added to this group',
            detail: 'At least 1 devotee is required to initiate booking.',
          },
        ],
        missingFields: ['Devotees'],
        recommendations: ['Click "+ Add Pilgrim" to enter devotee information.'],
        whyNotReady: {
          status: 'NOT_READY',
          headline: 'BOOKING NOT READY',
          items: explanationItems,
          recommendedActions: ['Click "+ Add Pilgrim" to enter devotee information.'],
        },
      };
    }

    // Check selected devotees for this service
    // Semantics:
    // undefined = service has never been configured (default: up to 6 pilgrims)
    // [] = user explicitly selected ZERO pilgrims (NEVER convert [] into all pilgrims)
    // [string IDs] = explicitly selected pilgrims (strictly capped by service rules)
    const selectionKey = serviceId || serviceType;
    const selectedIds = selectedPilgrims?.map(p => typeof p === 'string' ? p : p.id);
    const configured = selectedIds ??
      profile.selectedPilgrims?.[selectionKey as any] ??
      (serviceId ? profile.selectedPilgrims?.[serviceId as any] : undefined) ??
      (profile.selectedPilgrims?.[serviceType as any]);

    const maxAllowedPilgrims = serviceConfig?.maxPilgrims ?? 6;

    const targetPilgrims: Pilgrim[] = configured === undefined
      ? pilgrims.slice(0, maxAllowedPilgrims)
      : Array.isArray(configured)
      ? pilgrims.filter(p => configured.includes(p.id)).slice(0, maxAllowedPilgrims)
      : [];

    if (configured !== undefined && configured.length === 0) {
      explanationItems.push({
        type: 'fail',
        text: '0 pilgrims selected for this booking',
      });
      return {
        score: 0,
        isComplete: false,
        isProfileReady: false,
        isBookingReady: false,
        pilgrimCount: 0,
        readyPilgrimsCount: 0,
        checks: [
          {
            id: 'zero_selected',
            label: 'Devotee Selection',
            status: 'warning',
            message: 'No devotees selected for this booking',
            detail: `Select devotees in the selection list below.`,
          },
        ],
        missingFields: ['Selected Devotees'],
        recommendations: ['Select devotees from the list to autofill.'],
        whyNotReady: {
          status: 'NOT_READY',
          headline: 'BOOKING NOT READY',
          items: explanationItems,
          recommendedActions: ['Select devotees from the list to autofill.'],
        },
      };
    }

    if (targetPilgrims.length === 0) {
      explanationItems.push({
        type: 'fail',
        text: 'No active devotees match selection',
      });
      return {
        score: 0,
        isComplete: false,
        isProfileReady: false,
        isBookingReady: false,
        pilgrimCount: 0,
        readyPilgrimsCount: 0,
        checks: [
          {
            id: 'no_matching_devotees',
            label: 'Devotee Selection',
            status: 'warning',
            message: 'No active devotees match the current selection',
            detail: 'Select at least 1 devotee from your profile.',
          },
        ],
        missingFields: ['Selected Devotees'],
        recommendations: ['Check devotee selection for this service.'],
        whyNotReady: {
          status: 'NOT_READY',
          headline: 'BOOKING NOT READY',
          items: explanationItems,
          recommendedActions: ['Check devotee selection for this service.'],
        },
      };
    }

    let totalPoints = 0;
    const maxPointsPerPilgrim = 5; // Name, Age, Gender, Photo ID Proof, Photo ID Number
    const totalPossiblePoints = targetPilgrims.length * maxPointsPerPilgrim;

    let allPilgrimsValid = true;
    let readyPilgrimCount = 0;
    let idDetailsValidAcrossAll = true;

    targetPilgrims.forEach((pilgrim, idx) => {
      let pilgrimPoints = 0;
      const pilgrimName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || `Devotee ${idx + 1}`;
      const pilgrimErrors: string[] = [];

      // 1. Full Name check
      const hasName = Boolean(pilgrim.fullName?.trim() || pilgrim.firstName?.trim());
      if (hasName) {
        pilgrimPoints += 1;
      } else {
        allPilgrimsValid = false;
        pilgrimErrors.push('Missing Name');
        missingFields.push(`${pilgrimName}: Name`);
      }

      // 2. Age / Date of Birth check
      // For Srivari Seva, the official enrollment form strictly requires BOTH Age AND Date of Birth.
      if (isSrivariSeva) {
        const hasValidAge = Boolean(pilgrim.age && pilgrim.age > 0);
        const hasValidDob = Boolean(pilgrim.dateOfBirth && pilgrim.dateOfBirth.trim());
        if (hasValidAge && hasValidDob) {
          const calcAge = getEffectiveAge({ dateOfBirth: pilgrim.dateOfBirth });
          if (calcAge !== undefined && Math.abs(Number(pilgrim.age) - calcAge) > 10) {
            allPilgrimsValid = false;
            pilgrimErrors.push('Inconsistent Age and Date of Birth');
            missingFields.push(`${pilgrimName}: Consistent Age and Date of Birth`);
          } else {
            pilgrimPoints += 1;
          }
        } else {
          allPilgrimsValid = false;
          if (!hasValidAge) {
            pilgrimErrors.push('Missing Age');
            missingFields.push(`${pilgrimName}: Age`);
          }
          if (!hasValidDob) {
            pilgrimErrors.push('Missing Date of Birth');
            missingFields.push(`${pilgrimName}: Date of Birth`);
          }
        }
      } else {
        const hasAge = Boolean((pilgrim.age && pilgrim.age > 0) || pilgrim.dateOfBirth);
        if (hasAge) {
          pilgrimPoints += 1;
        } else {
          allPilgrimsValid = false;
          pilgrimErrors.push('Missing Age');
          missingFields.push(`${pilgrimName}: Age`);
        }
      }

      // 3. Gender check
      const hasGender = Boolean(pilgrim.gender && ['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other'].includes(pilgrim.gender));
      if (hasGender) {
        pilgrimPoints += 1;
      } else {
        allPilgrimsValid = false;
        pilgrimErrors.push('Missing Gender');
        missingFields.push(`${pilgrimName}: Gender`);
      }

      // 4. Photo ID Proof check
      const hasIdType = Boolean(pilgrim.idType);
      if (hasIdType) {
        pilgrimPoints += 1;
      } else {
        allPilgrimsValid = false;
        idDetailsValidAcrossAll = false;
        pilgrimErrors.push('Missing Photo ID Proof');
        missingFields.push(`${pilgrimName}: ID Proof`);
      }

      // 5. Photo ID Number validation
      const idNum = String(pilgrim.idNumber || '').trim();
      let isIdValid = false;
      if (idNum) {
        if (pilgrim.idType === 'Aadhaar' || idNum.replace(/\D/g, '').length === 12) {
          const aadhaarVal = validateAadhaar(idNum);
          isIdValid = aadhaarVal.valid;
          if (!aadhaarVal.valid) {
            pilgrimErrors.push('Invalid 12-digit Aadhaar');
            idDetailsValidAcrossAll = false;
          }
        } else {
          isIdValid = idNum.length >= 4;
        }
      }
      if (isIdValid) {
        pilgrimPoints += 1;
      } else {
        allPilgrimsValid = false;
        idDetailsValidAcrossAll = false;
        if (!idNum) pilgrimErrors.push('Missing ID Number');
        missingFields.push(`${pilgrimName}: Valid ID Number`);
      }

      // 6. Mobile check: Required for Srivari Seva, optional for standard Darshan/Padmavathi/Homam
      if (isSrivariSeva) {
        const mob = String(pilgrim.mobile || '').replace(/\D/g, '');
        if (mob.length !== 10) {
          allPilgrimsValid = false;
          pilgrimErrors.push('Missing 10-digit Mobile');
          missingFields.push(`${pilgrimName}: Mobile (10 digits)`);
        }
        if (!pilgrim.photo) {
          allPilgrimsValid = false;
          pilgrimErrors.push('Missing Photo');
          missingFields.push(`${pilgrimName}: Photo`);
        }
      } else if (pilgrim.mobile && String(pilgrim.mobile).trim()) {
        const mobile = String(pilgrim.mobile).trim();
        const mobileVal = validateMobile(mobile);
        if (!mobileVal.valid) {
          // Warning only if invalid digits entered
          allPilgrimsValid = false;
          pilgrimErrors.push('Invalid 10-digit Mobile');
          missingFields.push(`${pilgrimName}: Valid Mobile`);
        }
      }

      totalPoints += pilgrimPoints;

      if (pilgrimPoints === maxPointsPerPilgrim && pilgrimErrors.length === 0) {
        readyPilgrimCount++;
        checks.push({
          id: `pilgrim_${pilgrim.id}`,
          label: pilgrimName,
          status: 'ready',
          message: 'All details and ID verified',
          detail: `${pilgrim.gender} • Age ${pilgrim.age || '✓'} • ${pilgrim.idType}`,
        });
      } else {
        checks.push({
          id: `pilgrim_${pilgrim.id}`,
          label: pilgrimName,
          status: 'warning',
          message: `${pilgrimErrors.join(', ')}`,
          detail: 'Requires correction before booking rush.',
        });
      }
    });

    // Workflow resolution (for step order & limits)
    const workflow = resolvedServiceId ? getWorkflowById(resolvedServiceId) : getWorkflowById(serviceType as string);

    // Exact pilgrims enforcement (e.g. Homam requires exactly 2 participants)
    const exactPilgrimsRequired = serviceConfig?.exactPilgrims ?? workflow?.exactPilgrims;
    let pilgrimCountValid = true;

    if (exactPilgrimsRequired !== undefined) {
      if (targetPilgrims.length !== exactPilgrimsRequired) {
        allPilgrimsValid = false;
        pilgrimCountValid = false;
        explanationItems.push({
          type: 'fail',
          text: `${targetPilgrims.length} of ${exactPilgrimsRequired} required pilgrims selected`,
        });
        checks.push({
          id: 'exact_pilgrim_limit',
          label: `${serviceConfig?.displayName || workflow?.serviceName || 'Service'} Quota`,
          status: 'error',
          message: `Exactly ${exactPilgrimsRequired} devotees allowed per booking`,
          detail: `Currently ${targetPilgrims.length} selected. Requires exactly ${exactPilgrimsRequired} pilgrims per booking/login.`,
        });
        missingFields.push(`Exactly ${exactPilgrimsRequired} devotees required`);
        recommendations.push(`Select exactly ${exactPilgrimsRequired} pilgrims.`);
      } else {
        explanationItems.push({
          type: 'pass',
          text: `${exactPilgrimsRequired} of ${exactPilgrimsRequired} required pilgrims selected`,
        });
      }
    } else {
      // Min and max limits
      const minPilgrims = serviceConfig?.minPilgrims ?? 1;
      const maxPilgrims = serviceConfig?.maxPilgrims ?? (serviceType === 'darshan' ? 6 : 6);

      if (targetPilgrims.length < minPilgrims) {
        allPilgrimsValid = false;
        pilgrimCountValid = false;
        explanationItems.push({
          type: 'fail',
          text: `At least ${minPilgrims} pilgrim required`,
        });
        recommendations.push(`Select at least ${minPilgrims} pilgrim.`);
      } else if (targetPilgrims.length > maxPilgrims) {
        allPilgrimsValid = false;
        pilgrimCountValid = false;
        explanationItems.push({
          type: 'fail',
          text: `Max ${maxPilgrims} pilgrims allowed (currently ${targetPilgrims.length} selected)`,
        });
        checks.push({
          id: 'darshan_limit',
          label: 'Group Limit',
          status: 'error',
          message: `Max ${maxPilgrims} devotees allowed per booking`,
          detail: `Currently ${targetPilgrims.length} selected. Deselect devotees to match TTD quota rules.`,
        });
        recommendations.push(`Reduce selected pilgrims to ${maxPilgrims} or fewer.`);
      } else {
        explanationItems.push({
          type: 'pass',
          text: `${targetPilgrims.length} pilgrims selected (up to ${maxPilgrims} allowed)`,
        });
      }
    }

    // ID verification explanation item
    if (idDetailsValidAcrossAll && readyPilgrimCount === targetPilgrims.length) {
      explanationItems.push({
        type: 'pass',
        text: 'ID details verified',
      });
    } else {
      explanationItems.push({
        type: 'fail',
        text: 'ID details need verification',
      });
      recommendations.push('Verify ID number and photo proof details.');
    }

    const profileReady = allPilgrimsValid && pilgrimCountValid && targetPilgrims.length > 0 && readyPilgrimCount === targetPilgrims.length;

    // ── General Details & Special Requirements Evaluation ───────
    // Check if General Details are required for this service
    let requiresGeneralDetails = true;
    let requiredGeneralFields: string[] = ['city', 'state', 'country', 'pinCode'];
    let requiresMobile = false; // Phase 5 rule: Mobile is OPTIONAL unless explicitly required
    let requiresGothram = false;
    let requiresEmail = false;

    if (serviceConfig) {
      requiresGeneralDetails = serviceConfig.requiredGeneralFields.length > 0;
      requiredGeneralFields = serviceConfig.requiredGeneralFields;
      requiresMobile = requiredGeneralFields.includes('mobile');
      requiresGothram = Boolean(serviceConfig.specialRequirements?.gothram || requiredGeneralFields.includes('gothram'));
      requiresEmail = requiredGeneralFields.includes('email');
    } else if (workflow) {
      requiresGeneralDetails = workflow.hasGeneralDetailsStep;
      const generalStep = workflow.steps?.find(s => s.stepType === 'GENERAL_DETAILS');
      if (generalStep) {
        requiredGeneralFields = generalStep.requiredFields;
        requiresMobile = generalStep.requiredFields.includes('mobile');
        requiresGothram = generalStep.requiredFields.includes('gothram');
        requiresEmail = generalStep.requiredFields.includes('email');
      } else {
        requiresMobile = true;
      }
    } else {
      // Default generic Darshan without serviceConfig or workflow requires mobile
      requiresMobile = true;
    }

    let isBookingGeneralReady = true;

    if (!requiresGeneralDetails) {
      // e.g. Padmavathi Special Entry ₹200 does NOT have General Details step
      explanationItems.push({
        type: 'pass',
        text: 'General details not required for this service',
      });
      checks.push({
        id: 'general_details',
        label: 'Booking Details',
        status: 'ready',
        message: 'Not required for this service',
        detail: `${serviceConfig?.displayName || workflow?.serviceName || 'Service'} does not require a General Details step.`,
      });
    } else {
      const effectiveGeneral = {
        ...profile.general,
        gothram: (profile.general?.gothram || (profile as any).gothram || '').trim(),
      };

      // Gothram evaluation (e.g. for Homam)
      if (requiresGothram) {
        if (effectiveGeneral.gothram) {
          explanationItems.push({
            type: 'pass',
            text: 'Gothram ready',
          });
        } else {
          isBookingGeneralReady = false;
          explanationItems.push({
            type: 'fail',
            text: 'Gothram missing',
          });
          recommendations.push('Add Gothram');
        }
      }

      // Email evaluation
      if (requiresEmail) {
        const email = (effectiveGeneral.email || '').trim();
        const isEmailValid = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        if (isEmailValid) {
          explanationItems.push({
            type: 'pass',
            text: 'Email ready',
          });
        } else {
          isBookingGeneralReady = false;
          explanationItems.push({
            type: 'fail',
            text: 'Email missing or invalid',
          });
          recommendations.push('Enter a valid booking email address.');
        }
      }

      // Mobile check (Optional per Phase 5 for SED-300 and Homam)
      if (requiresMobile) {
        const mob = (effectiveGeneral.mobile || '').replace(/\D/g, '');
        if (mob.length === 10) {
          explanationItems.push({
            type: 'pass',
            text: 'Mobile ready',
          });
        } else {
          isBookingGeneralReady = false;
          explanationItems.push({
            type: 'fail',
            text: 'Mobile number (10 digits) required',
          });
          recommendations.push('Enter 10-digit mobile number.');
        }
      }

      if (isSrivariSeva) {
        const pilgrim = targetPilgrims[0];
        const effectiveCity = pilgrim?.city?.trim() || effectiveGeneral.city?.trim();
        const effectiveState = pilgrim?.state?.trim() || effectiveGeneral.state?.trim();
        const effectiveCountry = pilgrim?.country?.trim() || effectiveGeneral.country?.trim() || '';
        const effectivePin = (pilgrim?.pinCode || effectiveGeneral.pinCode || '').replace(/\D/g, '');
        const effectiveDistrict = pilgrim?.district?.trim();
        const effectiveStreet = pilgrim?.srivariSeva?.street?.trim() || (pilgrim as any)?.street?.trim() || pilgrim?.address?.trim();
        const effectiveDoor = pilgrim?.srivariSeva?.doorNumber?.trim() || (pilgrim as any)?.doorNumber?.trim();

        const missingSrivariAddr: string[] = [];
        if (!effectiveCountry) missingSrivariAddr.push('Country');
        if (effectivePin.length !== 6) missingSrivariAddr.push('6-digit PIN code');
        if (!effectiveState) missingSrivariAddr.push('State');
        if (!effectiveDistrict) missingSrivariAddr.push('District');
        if (!effectiveCity) missingSrivariAddr.push('City');
        if (!effectiveStreet) missingSrivariAddr.push('Street');
        if (!effectiveDoor) missingSrivariAddr.push('Door Number');

        if (missingSrivariAddr.length > 0) {
          isBookingGeneralReady = false;
          explanationItems.push({
            type: 'fail',
            text: `Address details missing: ${missingSrivariAddr.join(', ')}`,
          });
          missingFields.push(`Address Details: ${missingSrivariAddr.join(', ')} required`);
          checks.push({
            id: 'srivari_address',
            label: 'Address Details',
            status: 'warning',
            message: `Missing required address fields: ${missingSrivariAddr.join(', ')}`,
            detail: 'Complete address details before Srivari Seva enrollment.',
          });
          recommendations.push(`Complete required address fields: ${missingSrivariAddr.join(', ')}.`);
        } else {
          explanationItems.push({
            type: 'pass',
            text: 'Address details ready',
          });
          checks.push({
            id: 'srivari_address',
            label: 'Address Details',
            status: 'ready',
            message: 'All required address details verified',
            detail: `${effectiveDoor}, ${effectiveStreet}, ${effectiveCity}, ${effectiveDistrict}, ${effectiveState} - ${effectivePin}`,
          });
        }
      } else {
        // Address fields (city, state, country, pinCode)
        const missingAddrFields: string[] = [];
        if (requiredGeneralFields.includes('city') && !effectiveGeneral.city?.trim()) missingAddrFields.push('City');
        if (requiredGeneralFields.includes('state') && !effectiveGeneral.state?.trim()) missingAddrFields.push('State');
        if (requiredGeneralFields.includes('country') && !effectiveGeneral.country?.trim()) missingAddrFields.push('Country');
        if (requiredGeneralFields.includes('pinCode')) {
          const pin = (effectiveGeneral.pinCode || '').replace(/\D/g, '');
          if (pin.length !== 6) missingAddrFields.push('6-digit PIN code');
        }

        if (missingAddrFields.length > 0) {
          isBookingGeneralReady = false;
          explanationItems.push({
            type: 'fail',
            text: `Booking address missing: ${missingAddrFields.join(', ')}`,
          });
          recommendations.push(`Complete booking address: ${missingAddrFields.join(', ')}.`);
        } else if (requiredGeneralFields.some(f => ['city', 'state', 'country', 'pinCode'].includes(f))) {
          explanationItems.push({
            type: 'pass',
            text: 'Booking address ready',
          });
        }

        // Combine general health
        const generalHealth = checkGeneralHealth(effectiveGeneral, requiresEmail, requiresGothram, requiresMobile);
        if (!generalHealth.isReady) {
          isBookingGeneralReady = false;
          const missingLabels = generalHealth.missingFields.map(f => {
            switch (f) {
              case 'gothram': return 'Gothram';
              case 'email': return 'Email Address';
              case 'mobile': return 'Mobile (10 digits)';
              case 'city': return 'City';
              case 'state': return 'State';
              case 'country': return 'Country';
              case 'pinCode': return 'PIN Code (6 digits)';
              default: return f;
            }
          });
          if (generalHealth.missingFields.includes('mobile')) {
            missingFields.push('General Details: Mobile number required');
          }
          if (generalHealth.missingFields.includes('gothram')) {
            missingFields.push('General Details: Gothram required');
          }
          missingFields.push(`Booking Details: ${missingLabels.join(', ')} required`);

          checks.push({
            id: 'general_details',
            label: 'Booking Details',
            status: 'warning',
            message: `Missing required booking fields: ${missingLabels.join(', ')}`,
            detail: 'Booking details required before proceeding to payment.',
          });
        } else {
          checks.push({
            id: 'general_details',
            label: 'Booking Details',
            status: 'ready',
            message: 'All booking contact & address details verified',
            detail: `Booking details: ${effectiveGeneral.gothram ? `Gothram: ${effectiveGeneral.gothram} • ` : ''}${effectiveGeneral.email ? `${effectiveGeneral.email} • ` : ''}${effectiveGeneral.city}, ${effectiveGeneral.state}`,
          });
        }
      }
    }


    const isBookingReady = profileReady && isBookingGeneralReady;

    // Calculate score (0-100)
    let score = totalPossiblePoints > 0 ? Math.round((totalPoints / totalPossiblePoints) * 100) : 0;
    if (!isBookingReady && score >= 100) {
      score = 95;
    }

    const whyNotReady: WhyNotReadyExplanation = {
      status: isBookingReady ? 'READY' : 'NOT_READY',
      headline: isBookingReady ? '100% READY' : 'BOOKING NOT READY',
      items: explanationItems,
      recommendedActions: Array.from(new Set(recommendations)),
    };

    return {
      score,
      isComplete: isBookingReady,
      isProfileReady: profileReady,
      isBookingReady,
      pilgrimCount: targetPilgrims.length,
      readyPilgrimsCount: readyPilgrimCount,
      checks,
      missingFields,
      recommendations: whyNotReady.recommendedActions,
      whyNotReady,
    };
  }

  /**
   * Evaluate readiness against live DOM for Srivari Seva pages.
   * Inspects actual required markers (*) on the active form.
   */
  public static evaluateDomReadiness(
    doc: Document,
    profile: Profile | null | undefined,
    serviceId: string = 'srivari-seva',
  ): DomReadinessEvaluation {
    const isInstructions = detectSrivariSevaInstructions(doc).isCurrentStep;
    const isEnrollment = detectSrivariSevaEnrollment(doc).isCurrentStep;

    if (isInstructions && !isEnrollment) {
      const decl = detectDeclarationCheckbox(doc);
      if (decl.detected && decl.checked) {
        return {
          isReady: true,
          status: 'READY',
          step: 'INSTRUCTIONS_REVIEW',
          actionRequired: false,
          actionMessage: 'Declaration confirmed. You can proceed to continue.',
          missingRequiredFields: [],
          satisfiedRequiredFields: ['declarationConfirmed'],
          optionalFieldsSkipped: [],
          optionalFieldsAvailable: [],
        };
      }
      return {
        isReady: false,
        status: 'USER_ACTION_REQUIRED',
        step: 'INSTRUCTIONS_REVIEW',
        actionRequired: true,
        actionMessage: 'Please review Srivari Seva instructions and confirm the declaration checkbox to continue.',
        missingRequiredFields: ['declarationConfirmed'],
        satisfiedRequiredFields: [],
        optionalFieldsSkipped: [],
        optionalFieldsAvailable: [],
      };
    }

    if (isEnrollment) {
      const { fields, requiredMap } = resolveSrivariEnrollmentFields(doc);
      const pilgrim = profile?.pilgrims?.[0];

      const missingRequired: string[] = [];
      const satisfiedRequired: string[] = [];
      const optionalSkipped: string[] = [];
      const optionalAvail: string[] = [];

      let actionRequired = false;
      let actionMessage: string | undefined;

      // 1. Fitness section check: never auto-check, user must manually confirm
      const mentallyFitRes = fields.get('mentallyFit');
      const physicallyFitRes = fields.get('physicallyFit');
      let fitnessUnresolved = false;
      if (mentallyFitRes || physicallyFitRes) {
        const mCb = mentallyFitRes?.element as HTMLInputElement | undefined;
        const pCb = physicallyFitRes?.element as HTMLInputElement | undefined;
        if ((mCb && !mCb.checked) || (pCb && !pCb.checked)) {
          fitnessUnresolved = true;
          actionRequired = true;
          actionMessage = 'Please review and confirm Mentally Fit and Physically Fit checkboxes.';
        }
      }

      // 2. Declaration check if present on enrollment form
      const decl = detectDeclarationCheckbox(doc);
      let declarationUnresolved = false;
      if (decl.detected && !decl.checked) {
        declarationUnresolved = true;
        actionRequired = true;
        actionMessage = actionMessage || 'Please review and confirm the declaration checkbox.';
      }

      for (const [fieldKey, res] of fields.entries()) {
        const isReq = requiredMap.get(fieldKey) ?? false;
        let hasVal = false;
        if (pilgrim) {
          switch (fieldKey) {
            case 'idProofType':
            case 'photoIdProof':
              hasVal = Boolean(pilgrim.idType); break;
            case 'idProofNumber':
            case 'photoIdNumber':
              hasVal = Boolean(pilgrim.idNumber); break;
            case 'mobile': hasVal = Boolean(pilgrim.mobile || profile?.general?.mobile); break;
            case 'photo': hasVal = Boolean(pilgrim.photo); break;
            case 'name': hasVal = Boolean(pilgrim.fullName || pilgrim.firstName); break;
            case 'mentallyFit':
            case 'physicallyFit':
              hasVal = (res.element as HTMLInputElement)?.checked ?? false;
              break;
            case 'dateOfBirth': hasVal = Boolean(pilgrim.dateOfBirth && pilgrim.dateOfBirth.trim()); break;
            case 'age': hasVal = Boolean(pilgrim.age && pilgrim.age > 0); break;
            case 'gender': hasVal = Boolean(pilgrim.gender); break;
            case 'country': hasVal = Boolean(pilgrim.country || profile?.general?.country); break;
            case 'pincode':
            case 'pinCode':
              hasVal = Boolean(pilgrim.pinCode || profile?.general?.pinCode); break;
            case 'state': hasVal = Boolean(pilgrim.state || profile?.general?.state); break;
            case 'district': hasVal = Boolean(pilgrim.district); break;
            case 'city': hasVal = Boolean(pilgrim.city || profile?.general?.city); break;
            case 'street': hasVal = Boolean(pilgrim.srivariSeva?.street || pilgrim.address); break;
            case 'doorNumber': hasVal = Boolean(pilgrim.srivariSeva?.doorNumber); break;
            case 'fatherSpouseName': hasVal = Boolean(pilgrim.srivariSeva?.fatherSpouseName); break;
            case 'email': hasVal = Boolean(pilgrim.email || profile?.general?.email); break;
            case 'bloodGroup': hasVal = Boolean(pilgrim.srivariSeva?.bloodGroup); break;
            case 'qualification': hasVal = Boolean(pilgrim.srivariSeva?.qualification); break;
            case 'profession': hasVal = Boolean(pilgrim.srivariSeva?.profession); break;
            case 'areaOfInterest': hasVal = Boolean(pilgrim.srivariSeva?.areaOfInterest); break;
            case 'employeeId': hasVal = Boolean(pilgrim.srivariSeva?.employeeId); break;
            case 'designation': hasVal = Boolean(pilgrim.srivariSeva?.designation); break;
            case 'specialisation': hasVal = Boolean(pilgrim.srivariSeva?.specialisation); break;
            case 'placeOfWork': hasVal = Boolean(pilgrim.srivariSeva?.placeOfWork); break;
            case 'document': hasVal = Boolean(pilgrim.srivariSeva?.document); break;
            case 'mandal': hasVal = Boolean(pilgrim.srivariSeva?.mandal); break;
          }
        }

        if (isReq) {
          if (hasVal) {
            satisfiedRequired.push(fieldKey);
          } else {
            missingRequired.push(fieldKey);
          }
        } else {
          if (hasVal) {
            optionalAvail.push(fieldKey);
          } else {
            optionalSkipped.push(fieldKey);
          }
        }
      }

      // Check required photo missing
      if (requiredMap.get('photo') && !pilgrim?.photo) {
        actionRequired = true;
        actionMessage = actionMessage || 'Pilgrim photo is required for Srivari Seva.';
      }

      // Check required fields missing
      if (missingRequired.length > 0) {
        actionRequired = true;
        actionMessage = actionMessage || `Required fields missing: ${missingRequired.join(', ')}`;
      }

      // Party size check: strictly 1 devotee for Srivari Seva
      const pilgrimCount = profile?.pilgrims ? profile.pilgrims.length : (pilgrim ? 1 : 0);
      const isExactOne = pilgrimCount === 1;
      if (pilgrimCount > 1) {
        actionRequired = true;
        actionMessage = 'Srivari Seva allows exactly 1 devotee per booking slot.';
      } else if (pilgrimCount === 0) {
        actionRequired = true;
        actionMessage = 'No devotee profile selected for Srivari Seva.';
      }

      // Live readiness contract: isReady is strictly false if any user action or required field is unresolved
      const isReady = missingRequired.length === 0 && !actionRequired && !fitnessUnresolved && !declarationUnresolved && Boolean(pilgrim) && isExactOne;

      let status: DomReadinessStatus = 'UNKNOWN';
      if (!pilgrim || !isExactOne) {
        status = 'BLOCKED';
      } else if (actionRequired || fitnessUnresolved || declarationUnresolved) {
        status = 'USER_ACTION_REQUIRED';
      } else if (missingRequired.length > 0) {
        status = 'PARTIALLY_READY';
      } else if (isReady) {
        status = 'READY';
      }

      return {
        isReady,
        status,
        step: 'SRIVARI_SEVA_ENROLLMENT',
        actionRequired,
        actionMessage,
        missingRequiredFields: missingRequired,
        satisfiedRequiredFields: satisfiedRequired,
        optionalFieldsSkipped: optionalSkipped,
        optionalFieldsAvailable: optionalAvail,
      };
    }

    return {
      isReady: false,
      status: 'UNKNOWN',
      step: 'UNKNOWN',
      actionRequired: false,
      missingRequiredFields: [],
      satisfiedRequiredFields: [],
      optionalFieldsSkipped: [],
      optionalFieldsAvailable: [],
    };
  }
}

export type NormalizedReadinessStatus = 'READY' | 'ACTION_REQUIRED' | 'NOT_READY' | 'UNKNOWN';

export interface ServiceReadinessParams {
  serviceId?: string;
  serviceType?: ServiceType | string;
  profile?: Profile | null;
  selectedPilgrims?: (string | Pilgrim)[];
  workflowState?: string;
  currentPageState?: {
    pageDetected?: boolean;
    isSupported?: boolean;
    url?: string;
    formDetected?: boolean;
    dom?: Document;
  };
}



export interface NormalizedReadinessResult {
  status: NormalizedReadinessStatus;
  headline: string;
  userActionMessage?: string;
  diagnostics: InternalDiagnostics;
}

/**
 * Authoritative Canonical Service Readiness Engine (Section 5)
 * Encapsulates all backend diagnostic checks while returning
 * clean consumer-facing statuses: READY | ACTION_REQUIRED | NOT_READY | UNKNOWN.
 */
export class ServiceReadinessEngine {
  public static evaluate(params: ServiceReadinessParams): NormalizedReadinessResult {
    const {
      serviceId,
      serviceType = ServiceType.DARSHAN,
      profile,
      selectedPilgrims,
      currentPageState,
    } = params;

    const baseEval = ReadinessEngine.evaluate(
      profile,
      serviceType,
      serviceId,
      selectedPilgrims,
    );

    const hasProfile = Boolean(profile);
    const pilgrimsCount = selectedPilgrims ? selectedPilgrims.length : (profile?.pilgrims?.length ?? 0);
    const hasPilgrims = pilgrimsCount > 0;
    const pageDetected = currentPageState?.pageDetected ?? false;
    const formDetected = currentPageState?.formDetected ?? false;

    const profileComplete = hasProfile && (profile?.pilgrims?.length ?? 0) > 0;
    const pilgrimFieldsComplete = baseEval.isProfileReady;
    const idVerified = !baseEval.missingFields.some(f => f.toLowerCase().includes('id') || f.toLowerCase().includes('aadhaar'));
    const generalCheck = baseEval.checks.find(c => c.id === 'general_details' || c.id === 'srivari_address');
    const generalDetailsComplete = generalCheck ? generalCheck.status === 'ready' : true;
    const specialDetailsComplete = !baseEval.missingFields.some(f => f.toLowerCase().includes('gothram') || f.toLowerCase().includes('photo'));
    const countCheck = baseEval.checks.find(c => c.id === 'pilgrim_count' || c.id === 'exact_pilgrims');
    const serviceCountValid = countCheck ? countCheck.status === 'ready' : hasPilgrims;
    const officialSourceVerified = currentPageState?.url
      ? (currentPageState.url.includes('tirumala.org') || currentPageState.url.includes('ttdevasthanams.ap.gov.in') || currentPageState.url.includes('tirupatibalaji.ap.gov.in'))
      : false;

    const diagnostics: InternalDiagnostics = {
      profileComplete,
      pilgrimFieldsComplete,
      idVerified,
      generalDetailsComplete,
      specialDetailsComplete,
      serviceCountValid,
      formDetected,
      officialSourceVerified,
      score: baseEval.score,
      checks: baseEval.checks,
      missingFields: baseEval.missingFields,
      recommendations: baseEval.recommendations,
    };

    if (!hasProfile) {
      return {
        status: 'NOT_READY',
        headline: 'Create your pilgrim profile to begin',
        userActionMessage: 'Create profile',
        diagnostics,
      };
    }

    if (!hasPilgrims) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Select pilgrims for this service',
        userActionMessage: 'Select pilgrims',
        diagnostics,
      };
    }

    if (!serviceCountValid) {
      return {
        status: 'ACTION_REQUIRED',
        headline: countCheck?.message || 'Devotee count does not match service requirement',
        userActionMessage: 'Adjust pilgrim count',
        diagnostics,
      };
    }

    if (!pilgrimFieldsComplete || !idVerified || !specialDetailsComplete) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Complete required pilgrim details in your profile',
        userActionMessage: 'Fix profile details',
        diagnostics,
      };
    }

    if (!generalDetailsComplete) {
      return {
        status: 'ACTION_REQUIRED',
        headline: 'Complete booking contact details in your profile',
        userActionMessage: 'Complete contact details',
        diagnostics,
      };
    }

    if (currentPageState?.dom && (serviceId === 'srivari-seva' || serviceId?.includes('srivari'))) {
      const domEval = ReadinessEngine.evaluateDomReadiness(currentPageState.dom, profile, serviceId);
      if (domEval.actionRequired) {
        return {
          status: 'ACTION_REQUIRED',
          headline: domEval.actionMessage || 'User action required on enrollment page',
          userActionMessage: domEval.actionMessage || 'Complete required actions',
          diagnostics,
        };
      }
      if (!domEval.isReady) {
        return {
          status: 'ACTION_REQUIRED',
          headline: domEval.actionMessage || 'Complete required fields on page',
          userActionMessage: 'Complete required fields',
          diagnostics,
        };
      }
      if (domEval.isReady && baseEval.isBookingReady) {
        return {
          status: 'READY',
          headline: 'Details verified and ready to fill',
          userActionMessage: 'Fill & Verify',
          diagnostics,
        };
      }
    }

    if (pageDetected && baseEval.isBookingReady) {
      return {
        status: 'READY',
        headline: 'Details verified and ready to fill',
        userActionMessage: 'Fill & Verify',
        diagnostics,
      };
    }

    if (baseEval.isProfileReady) {
      return {
        status: 'READY',
        headline: 'Profile is ready for booking',
        userActionMessage: 'Open TTD booking page',
        diagnostics,
      };
    }

    return {
      status: 'UNKNOWN',
      headline: 'Checking readiness…',
      diagnostics,
    };
  }

  /**
   * Authoritative DOM readiness evaluator for Srivari Seva pages.
   */
  public static evaluateDomReadiness(
    doc: Document,
    profile: Profile | null | undefined,
    serviceId: string = 'srivari-seva',
  ): DomReadinessEvaluation {
    return ReadinessEngine.evaluateDomReadiness(doc, profile, serviceId);
  }
}
