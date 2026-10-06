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

export class ReadinessEngine {
  /**
   * Evaluate booking readiness for an active profile and target service.
   * Strictly enforces that 100% is only awarded when all required fields and validations pass.
   */
  public static evaluate(
    profile: Profile | null | undefined,
    serviceType: ServiceType | string = ServiceType.DARSHAN,
    serviceId?: string,
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
    const configured = profile.selectedPilgrims?.[selectionKey as any] ??
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
      const hasAge = Boolean((pilgrim.age && pilgrim.age > 0) || pilgrim.dateOfBirth);
      if (hasAge) {
        pilgrimPoints += 1;
      } else {
        allPilgrimsValid = false;
        pilgrimErrors.push('Missing Age');
        missingFields.push(`${pilgrimName}: Age`);
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

      // 6. Optional Mobile format check:
      // In Phase 5, mobile is OPTIONAL for pilgrims and must NOT make readiness fail if omitted!
      if (pilgrim.mobile && String(pilgrim.mobile).trim()) {
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
}
