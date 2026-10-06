// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 3 Service Workflow Types
// Strict service-specific workflow abstraction & field schemas
// ─────────────────────────────────────────────────────────────

import type { ServiceType, Pilgrim, GeneralDetails } from '@shared/types';

/**
 * Universal field classification according to Phase 3 Section 6.
 * Every field in every workflow step must be explicitly classified.
 */
export type FieldClassification =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'CONDITIONAL'
  | 'NOT_PRESENT'
  | 'USER_CONTROLLED'
  | 'SYSTEM_GENERATED'
  | 'UNKNOWN';

/**
 * Step types observed across official TTD booking workflows.
 */
export type WorkflowStepType =
  | 'DIGITAL_QUEUE'         // Step 0: Digital waiting room / virtual queue
  | 'AVAILABILITY'          // Step 1: Calendar & quota check
  | 'SLOT_SELECTION'        // Step 2: Time slot & ticket count
  | 'HOMAM_SELECTION'       // Step 2b: Homam / Seva booking option selection (Homam services only)
  | 'ADDITIONAL_SERVICES'   // Step 3: Additional Laddus, Hundi, etc. (Optional)
  | 'PILGRIM_DETAILS'       // Step 4: Primary devotee identity inputs
  | 'GENERAL_DETAILS'       // Step 5: Booking contact & address (order is service-specific)
  | 'REVIEW_DETAILS'        // Step 6: Confirmation & verification summary
  | 'PAYMENT'               // Step 7: Payment gateway transition (Strictly user-controlled)
  | 'COMPLETED'             // Step 8: Booking receipt / confirmation
  | 'UNKNOWN';

/**
 * Detailed definition of an individual step in a booking workflow.
 */
export interface WorkflowStepDefinition {
  stepId: string;
  stepType: WorkflowStepType;
  name: string;
  order: number;
  description: string;
  isAutomatedAutofill: boolean; // True for Pilgrim / General steps; False for Queue / Review / Payment
  requiredFields: string[];
  optionalFields: string[];
  prohibitedFields: string[];   // Fields that must NEVER be filled at this step
  fieldClassifications: Record<string, FieldClassification>;
  detect: (doc: Document, url: string) => { isCurrentStep: boolean; confidence: number };
}

/**
 * Queue handling behavior configuration for a service.
 */
export interface WorkflowQueueConfig {
  canHaveQueue: boolean;
  queueSelectors: string[];
  queueTextTokens: string[];
  statusMessages: {
    waiting: string;
    detected: string;
    ready: string;
  };
}

/**
 * Payment gateway detection and non-automation enforcement.
 */
export interface WorkflowPaymentConfig {
  detectPayment: (doc: Document, url: string) => boolean;
  gatewaySelectors: string[];
  gatewayUrlPatterns: RegExp[];
  strictNonAutomation: true; // Enforces extension will never enter credentials or click pay
}

/**
 * Additional optional services configuration (e.g. Laddus, Hundi).
 */
export interface AdditionalServiceItem {
  id: string;
  name: string;
  isOptional: true;
  maxCount?: number;
  unitPrice?: number;
}

/**
 * Canonical definition of a TTD booking service workflow.
 */
export interface ServiceWorkflow {
  serviceId: string;           // e.g. 'special-entry-darshan-300', 'padmavathi-supadham-entry-200'
  serviceName: string;         // Human-readable title
  workflowVersion: string;     // Explicit workflow schema version (e.g. '1.0.0')
  serviceType: ServiceType;    // Underlying enum for backward compatibility
  temple: string;              // e.g. 'Sri Venkateswara Swamy Temple, Tirumala'
  ticketPrice: number;         // Base ticket price in INR
  maxPilgrims: number;         // Quota limit per booking
  exactPilgrims?: number;      // Exact required pilgrim count (e.g. 2 for Homam)
  minPilgrims?: number;        // Minimum pilgrim count
  hasGeneralDetailsStep: boolean; // True for SED ₹300, FALSE for Padmavathi ₹200
  releaseWindow?: {
    type: 'approximate-month-ahead' | 'fixed-schedule' | 'rolling' | 'unknown';
    description?: string;
  };
  steps: WorkflowStepDefinition[];
  additionalServices: AdditionalServiceItem[];
  queueConfig: WorkflowQueueConfig;
  paymentConfig: WorkflowPaymentConfig;
  detectService: (url: string, doc: Document) => { matches: boolean; confidence: number };
}

/**
 * Comprehensive execution status for the workflow engine.
 */
export type WorkflowStatus =
  | 'READY'
  | 'WAITING'
  | 'DETECTING'
  | 'FILLING'
  | 'VERIFYING'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'ERROR'
  | 'PAYMENT_READY'
  | 'COMPLETED';

/**
 * Dynamic readiness evaluation result for the current step.
 */
export interface DynamicStepReadiness {
  stepType: WorkflowStepType;
  serviceId: string;
  isComplete: boolean;
  score: number;
  requiredFields: string[];
  missingFields: string[];
  completedFields: string[];
  optionalFields: string[];
  statusMessage: string;
}
