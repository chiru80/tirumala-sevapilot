// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 3 Workflow Registry
// Manages verified TTD workflows & runtime resolution
// ─────────────────────────────────────────────────────────────

import type { ServiceWorkflow } from './types';
import { SPECIAL_ENTRY_DARSHAN_300 } from './special-entry-300';
import { PADMAVATHI_SUPADHAM_ENTRY_200 } from './padmavathi-200';
import { SRI_SRINIVASA_DIVYANUGRAHA_HOMAM } from './sri-srinivasa-divyanugraha-homam';

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
  if (serviceId === 'padmavati-special-entry-200' || serviceId === 'padmavathi-special-entry-200') {
    return PADMAVATHI_SUPADHAM_ENTRY_200;
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
