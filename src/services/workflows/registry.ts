// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 3 Workflow Registry
// Manages verified TTD workflows & runtime resolution
// ─────────────────────────────────────────────────────────────

import type { ServiceWorkflow } from './types';
import { SPECIAL_ENTRY_DARSHAN_300 } from './special-entry-300';
import { PADMAVATHI_SUPADHAM_ENTRY_200 } from './padmavathi-200';
import { SRI_SRINIVASA_DIVYANUGRAHA_HOMAM } from './sri-srinivasa-divyanugraha-homam';
import { SRIVARI_SEVA_WORKFLOW } from './srivari-seva-workflow';

const REGISTERED_WORKFLOWS: ServiceWorkflow[] = [
  SPECIAL_ENTRY_DARSHAN_300,
  PADMAVATHI_SUPADHAM_ENTRY_200,
  SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
];

/**
 * Get all registered Phase 3 booking workflows.
 */
export function getAllWorkflows(): ServiceWorkflow[] {
  return [...REGISTERED_WORKFLOWS];
}

/**
 * Retrieve a specific workflow by its unique serviceId.
 */
export function getWorkflowById(serviceId: string): ServiceWorkflow | undefined {
  if (!serviceId) return undefined;
  const id = serviceId.toLowerCase().trim();
  if (
    id === 'padmavathi-supadham-entry-200' ||
    id === 'padmavathi-special-entry-200' ||
    id === 'padmavati-special-entry-200' ||
    id === 'padmavathi-200' ||
    id === 'padmavathi-v1' ||
    id === 'spat' ||
    id === 'spat-200'
  ) {
    return PADMAVATHI_SUPADHAM_ENTRY_200;
  }
  if (
    id === 'special-entry-darshan-300' ||
    id === 'special-entry-300' ||
    id === 'special-entry-300-v1' ||
    id === 'special-entry-v1' ||
    id === 'sed-300'
  ) {
    return SPECIAL_ENTRY_DARSHAN_300;
  }
  if (
    id === 'sri-srinivasa-divyanugraha-homam' ||
    id === 'sri-srinivasa-divyanugraha-vishesha-homam' ||
    id === 'homam-1600' ||
    id === 'homam-v1' ||
    id === 'homam'
  ) {
    return SRI_SRINIVASA_DIVYANUGRAHA_HOMAM;
  }
  if (
    id === 'srivari-seva' ||
    id === 'srivari-seva-enrollment-v1' ||
    id === 'srivari-seva-voluntary-service' ||
    id === 'srivari_seva'
  ) {
    return SRIVARI_SEVA_WORKFLOW;
  }
  return REGISTERED_WORKFLOWS.find(w => w.serviceId === serviceId);
}

export interface WorkflowResolutionResult {
  workflow?: ServiceWorkflow;
  confidence: number;
  isUncertain: boolean;
  message?: string;
}

/**
 * Resolve the active workflow with confidence analysis.
 */
export function resolveWorkflowWithConfidence(url: string, doc: Document = document): WorkflowResolutionResult {
  const lowerUrl = (url || '').toLowerCase();

  // Route Dominance: SPAT URLs strictly resolve to Padmavathi / Sri PAT (₹200)
  if (lowerUrl.includes('/spat/') || lowerUrl.includes('flow=spat') || lowerUrl.includes('flowidentifier=spat')) {
    return {
      workflow: PADMAVATHI_SUPADHAM_ENTRY_200,
      confidence: 100,
      isUncertain: false,
    };
  }

  // Route Dominance: Srivari Seva route strictly resolves to Srivari Seva
  if (lowerUrl.includes('/srivari-seva') || lowerUrl.includes('/srivariseva') || lowerUrl.includes('flow=srivari-seva')) {
    return {
      workflow: SRIVARI_SEVA_WORKFLOW,
      confidence: 100,
      isUncertain: false,
    };
  }

  let bestMatch: ServiceWorkflow | undefined = undefined;
  let highestConfidence = 0;
  let secondConfidence = 0;

  for (const workflow of REGISTERED_WORKFLOWS) {
    const { matches, confidence } = workflow.detectService(url, doc);
    if (matches && confidence > highestConfidence) {
      secondConfidence = highestConfidence;
      highestConfidence = confidence;
      bestMatch = workflow;
    } else if (matches && confidence > secondConfidence) {
      secondConfidence = confidence;
    }
  }

  // Margin check: if competing workflows have close confidence scores (margin < 15), flag as uncertain
  const MINIMUM_MARGIN = 15;
  if (bestMatch && secondConfidence > 0 && (highestConfidence - secondConfidence) < MINIMUM_MARGIN && highestConfidence >= 50) {
    return {
      workflow: bestMatch,
      confidence: highestConfidence,
      isUncertain: true,
      message: 'Service workflow not confidently identified. Review before autofill.',
    };
  }

  if (highestConfidence >= 50 && bestMatch) {
    return {
      workflow: bestMatch,
      confidence: highestConfidence,
      isUncertain: false,
    };
  }

  if (highestConfidence > 0 && highestConfidence < 50) {
    return {
      workflow: bestMatch,
      confidence: highestConfidence,
      isUncertain: true,
      message: 'Service workflow not confidently identified. Review before autofill.',
    };
  }

  return {
    workflow: undefined,
    confidence: 0,
    isUncertain: true,
    message: 'Service workflow not recognized. Autofill is paused.',
  };
}

/**
 * Detect the active TTD workflow based on the live URL and DOM.
 * Returns undefined if no registered workflow matches with sufficient confidence.
 */
export function detectActiveWorkflow(url: string, doc: Document = document): ServiceWorkflow | undefined {
  const result = resolveWorkflowWithConfidence(url, doc);
  if (!result.isUncertain && result.workflow) {
    return result.workflow;
  }
  return undefined;
}

/**
 * Check if the current page matches a recognized service workflow.
 */
export function isServiceRecognized(url: string, doc: Document = document): boolean {
  return Boolean(detectActiveWorkflow(url, doc));
}
