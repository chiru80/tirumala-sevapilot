// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 3 Workflow Engine
// Evaluates active step, field schemas, and dynamic readiness
// ─────────────────────────────────────────────────────────────

import type { Profile, Pilgrim } from '@shared/types';
import type {
  ServiceWorkflow,
  WorkflowStepDefinition,
  DynamicStepReadiness,
  WorkflowStepType,
} from './types';
import { checkPilgrimHealth } from '../profile-health';

/**
 * Resolve the current active step in the specified workflow.
 */
export function resolveActiveStep(
  workflow: ServiceWorkflow,
  doc: Document = document,
  url: string = window.location.href,
): WorkflowStepDefinition | undefined {
  let highestConfidence = 0;
  let activeStep: WorkflowStepDefinition | undefined = undefined;

  for (const step of workflow.steps) {
    const { isCurrentStep, confidence } = step.detect(doc, url);
    if (isCurrentStep && confidence > highestConfidence) {
      highestConfidence = confidence;
      activeStep = step;
    }
  }

  return activeStep;
}

import { detectPageTicketLimit } from './step-detectors';

/**
 * Determine whether autofill can safely execute at the current state.
 */
export function canExecuteAutofill(
  workflow: ServiceWorkflow | undefined,
  currentStep: WorkflowStepDefinition | undefined,
  isUncertain: boolean = false,
  doc?: Document,
): { canFill: boolean; reason?: string } {
  if (isUncertain) {
    return {
      canFill: false,
      reason: 'Service workflow not confidently identified. Review before autofill.',
    };
  }

  // Requirement 19 - Test E: Unknown service handling
  if (!workflow) {
    return {
      canFill: false,
      reason: 'Service workflow not recognized. Autofill is paused.',
    };
  }

  if (!currentStep) {
    return {
      canFill: false,
      reason: 'Pilgrim fields could not be safely identified.',
    };
  }

  // Two-person / exact ticket limit check (Section 20)
  if (doc && workflow.exactPilgrims) {
    const reportedLimit = detectPageTicketLimit(doc);
    if (reportedLimit !== null && reportedLimit !== workflow.exactPilgrims) {
      return {
        canFill: false,
        reason: 'TTD page reports a different ticket limit. Review required.',
      };
    }
  }

  // Digital Queue handling (Passive waiting only)
  if (currentStep.stepType === 'DIGITAL_QUEUE') {
    return {
      canFill: false,
      reason: workflow.queueConfig.statusMessages.detected,
    };
  }

  // Payment safety enforcement
  if (currentStep.stepType === 'PAYMENT') {
    return {
      canFill: false,
      reason: 'Payment page reached. The final payment action remains user-controlled.',
    };
  }

  // Services without general details step (e.g. Padmavathi-200)
  if (currentStep.stepType === 'GENERAL_DETAILS' && !workflow.hasGeneralDetailsStep) {
    return {
      canFill: false,
      reason: `Service "${workflow.serviceName}" does not have a General Details step.`,
    };
  }

  if (!currentStep.isAutomatedAutofill) {
    return {
      canFill: false,
      reason: `Step "${currentStep.name}" is user-controlled.`,
    };
  }

  return { canFill: true };
}

/**
 * Dynamically evaluate readiness for the current step according to Phase 3 rules:
 * - Readiness represents the ACTUAL fields required by current page/workflow.
 * - Optional fields do NOT decrease readiness.
 * - Unknown fields do NOT decrease readiness.
 * - Fields belonging to future steps do NOT decrease current-step readiness.
 */
export function evaluateStepReadiness(
  workflow: ServiceWorkflow | undefined,
  currentStep: WorkflowStepDefinition | undefined,
  profile: Profile | null,
  selectedPilgrims: Pilgrim[] = profile?.pilgrims || [],
): DynamicStepReadiness {
  // Fallback if workflow is unknown
  if (!workflow || !currentStep) {
    return {
      stepType: 'UNKNOWN',
      serviceId: workflow?.serviceId || 'unknown',
      isComplete: false,
      score: 0,
      requiredFields: [],
      missingFields: [],
      completedFields: [],
      optionalFields: [],
      statusMessage: workflow
        ? 'Pilgrim fields could not be safely identified.'
        : 'Service workflow not recognized. Autofill is paused.',
    };
  }

  // 1. Digital Queue step
  if (currentStep.stepType === 'DIGITAL_QUEUE') {
    return {
      stepType: 'DIGITAL_QUEUE',
      serviceId: workflow.serviceId,
      isComplete: false,
      score: 50,
      requiredFields: [],
      missingFields: [],
      completedFields: [],
      optionalFields: [],
      statusMessage: workflow.queueConfig.statusMessages.detected,
    };
  }

  // 2. Pilgrim Details step
  if (currentStep.stepType === 'PILGRIM_DETAILS') {
    const required = currentStep.requiredFields; // ['fullName', 'age', 'gender', 'idType', 'idNumber']
    const missing: string[] = [];
    const completed: string[] = [];

    if (selectedPilgrims.length === 0) {
      return {
        stepType: 'PILGRIM_DETAILS',
        serviceId: workflow.serviceId,
        isComplete: false,
        score: 0,
        requiredFields: required,
        missingFields: ['Select at least 1 devotee'],
        completedFields: [],
        optionalFields: currentStep.optionalFields,
        statusMessage: 'Please select devotees from your profile.',
      };
    }

    let allDevoteesReady = true;

    selectedPilgrims.forEach((pilgrim, idx) => {
      const pName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || `Devotee ${idx + 1}`;
      const health = checkPilgrimHealth(pilgrim);

      if (!health.isReady) {
        allDevoteesReady = false;
        health.missingFields.forEach(f => {
          missing.push(`${pName}: ${f}`);
        });
      } else {
        completed.push(pName);
      }
    });

    const isComplete = allDevoteesReady && missing.length === 0;
    const score = isComplete ? 100 : Math.round((completed.length / selectedPilgrims.length) * 100);

    return {
      stepType: 'PILGRIM_DETAILS',
      serviceId: workflow.serviceId,
      isComplete,
      score,
      requiredFields: required,
      missingFields: missing,
      completedFields: completed,
      optionalFields: currentStep.optionalFields,
      statusMessage: isComplete
        ? `${selectedPilgrims.length} of ${selectedPilgrims.length} devotees ready (100%)`
        : `${missing.length} required devotee field(s) need attention`,
    };
  }

  // 3. General Details step
  if (currentStep.stepType === 'GENERAL_DETAILS') {
    // If the workflow does not include a General Details step, it's immediately complete (skipped)
    if (!workflow.hasGeneralDetailsStep) {
      return {
        stepType: 'GENERAL_DETAILS',
        serviceId: workflow.serviceId,
        isComplete: true,
        score: 100,
        requiredFields: [],
        missingFields: [],
        completedFields: [],
        optionalFields: [],
        statusMessage: 'General Details not required for this service.',
      };
    }

    // Fully data-driven: required fields come from the STEP DEFINITION, not hardcoded.
    // This correctly handles:
    //   SED-300: requiredFields = ['city', 'state', 'country', 'pinCode']
    //   Homam:   requiredFields = ['gothram', 'mobile', 'email', 'country', 'state', 'city', 'pinCode']
    const required = currentStep.requiredFields;
    const general = profile?.general;
    const missing: string[] = [];
    const completed: string[] = [];

    for (const field of required) {
      const val = general ? (general as Record<string, unknown>)[field] : undefined;
      if (val && typeof val === 'string' && val.trim().length > 0) {
        completed.push(field);
      } else {
        missing.push(field);
      }
    }

    const isComplete = missing.length === 0;
    const score = required.length > 0 ? Math.round((completed.length / required.length) * 100) : 100;

    return {
      stepType: 'GENERAL_DETAILS',
      serviceId: workflow.serviceId,
      isComplete,
      score,
      requiredFields: required,
      missingFields: missing,
      completedFields: completed,
      optionalFields: currentStep.optionalFields,
      statusMessage: isComplete
        ? `All ${required.length} required booking details complete (100%)`
        : `Missing required booking fields: ${missing.join(', ')}`,
    };
  }

  // 4. Payment step
  if (currentStep.stepType === 'PAYMENT') {
    return {
      stepType: 'PAYMENT',
      serviceId: workflow.serviceId,
      isComplete: true,
      score: 100,
      requiredFields: [],
      missingFields: [],
      completedFields: [],
      optionalFields: [],
      statusMessage: 'Payment page reached. Please submit payment manually.',
    };
  }

  // Other non-automated steps (Review, Availability, Slot)
  return {
    stepType: currentStep.stepType,
    serviceId: workflow.serviceId,
    isComplete: true,
    score: 100,
    requiredFields: currentStep.requiredFields,
    missingFields: [],
    completedFields: currentStep.requiredFields,
    optionalFields: currentStep.optionalFields,
    statusMessage: `${currentStep.name} ready.`,
  };
}
