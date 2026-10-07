// ─────────────────────────────────────────────────
// Tirumala SevaPilot — V1 Autofill Types & Contracts
// ─────────────────────────────────────────────────

import type { Pilgrim, Profile, TtdTemporaryLockState } from '@shared/types';
import type { PerformanceMetrics } from './performance-profiler';

/** Supported pilgrim fields in TTD V1 (strictly 1 to 6 pilgrims) */
export type PilgrimFieldType = 'name' | 'age' | 'gender' | 'photoIdProof' | 'photoIdNumber';

/** Supported general contact & address fields in TTD V1 */
export type GeneralFieldType = 'gothram' | 'email' | 'mobile' | 'city' | 'state' | 'country' | 'pincode' | 'pinCode';

/** All logical fields supported by the semantic field resolver */
export type LogicalFieldType = PilgrimFieldType | GeneralFieldType;

/** Explicit status for every field — never silently omit */
export type FieldStatus = 'verified' | 'failed' | 'skipped';

/** Confidence scoring categories */
export type ConfidenceCategory = 'very_high' | 'high' | 'medium' | 'low' | 'ambiguous';

/** Helper to categorize numeric confidence (0-100) */
export function getConfidenceCategory(score: number): ConfidenceCategory {
  if (score >= 95) return 'very_high';
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'low';
  return 'ambiguous';
}

/** Result of resolving a single logical field on the DOM */
export interface FieldResolution {
  element: HTMLElement;
  field: LogicalFieldType;
  confidence: number;
  strategy: string;
  reasons: string[];
  isAmbiguous?: boolean;
}

/** Failure to resolve a field */
export interface FieldResolutionFailure {
  field: LogicalFieldType;
  confidence: 0;
  strategy: 'none';
  reasons: string[];
  isAmbiguous: true;
}

export type FieldResolutionResult = FieldResolution | FieldResolutionFailure;

/** Context for a locked, isolated pilgrim row container */
export interface PilgrimRowContext {
  index: number;
  element: HTMLElement;
  fingerprint: string;
  confidence: number;
  fields: Map<PilgrimFieldType, HTMLElement>;
  fieldResolutions: Map<PilgrimFieldType, FieldResolution>;
  isLocked: boolean;
}

/** Result of executing and verifying a single field fill */
export interface FieldTransactionResult {
  field: string;
  pilgrimIndex?: number;
  status: FieldStatus;
  attempts: number;
  durationMs: number;
  expectedValue?: string;
  actualValue?: string;
  maskedValue?: string;
  error?: string;
  strategy?: string;
  confidence?: number;
  detected?: boolean;
  filled?: boolean;
  verified?: boolean;
  reasons?: string[];
  repaired?: boolean;
}

/** Progress and verification results for one pilgrim */
export interface PilgrimProgress {
  pilgrimIndex: number;
  pilgrimName: string;
  fieldsTotal: number;
  fieldsVerified: number;
  fieldsFailed: number;
  results: FieldTransactionResult[];
  status: 'pending' | 'filling' | 'verified' | 'partial' | 'failed';
}

/** Active booking step in the TTD workflow */
export type BookingStep =
  | 'PILGRIM_DETAILS'
  | 'GENERAL_DETAILS'
  | 'INSTRUCTIONS_REVIEW'
  | 'SRIVARI_SEVA_ENROLLMENT'
  | 'UNKNOWN';

/** Instructions review state machine for user-attested declarations */
export type InstructionsState =
  | 'NOT_REVIEWED'
  | 'READY_FOR_USER_CONFIRMATION'
  | 'USER_CONFIRMED'
  | 'BLOCKED';

/** State machine states for autofill manager */
export type AutofillState =
  | 'IDLE'
  | 'DETECT_STEP'
  | 'LOCK_ROWS'
  | 'RESOLVING_FIELDS'
  | 'FILLING_PILGRIMS'
  | 'VERIFYING_PILGRIMS'
  | 'REPAIRING_FAILED'
  | 'FILLING_GENERAL'
  | 'VERIFYING_GENERAL'
  | 'SRIVARI_INSTRUCTIONS'
  | 'SRIVARI_ENROLLMENT'
  | 'FIELDS_VERIFIED'
  | 'USER_ACTION_REQUIRED'
  | 'COMPLETE'
  | 'PARTIAL_SUCCESS'
  | 'ERROR'
  | 'STOPPED'
  | 'TTD_TEMPORARY_BOOKING_LOCK';

/** Progress payload emitted during execution */
export interface AutofillProgress {
  state: AutofillState;
  currentPilgrimIndex: number;
  totalPilgrims: number;
  currentField: string;
  pilgrimResults: PilgrimProgress[];
  generalResults: FieldTransactionResult[];
  errors: string[];
  startedAt: number;
  elapsedMs: number;
  percent: number;
  temporaryLock?: TtdTemporaryLockState;
}

/** Final comprehensive report returned by AutofillManager */
export interface AutofillManagerResult {
  success: boolean;
  state: AutofillState;
  step: 'pilgrim' | 'general' | 'unknown' | 'srivari_instructions' | 'srivari_enrollment';
  instructionsState?: InstructionsState;
  actionRequired?: boolean;
  actionMessage?: string;
  optionalFieldsSkipped?: string[];
  optionalFieldsFilled?: string[];
  pilgrimResults: PilgrimProgress[];
  generalResults: FieldTransactionResult[];
  totalVerified: number;
  totalFailed: number;
  totalFields: number;
  durationMs: number;
  errors: string[];
  needsAttention: boolean;
  failedItems: Array<{
    pilgrimIndex?: number;
    pilgrimName?: string;
    field: string;
    fieldLabel: string;
    error: string;
  }>;
  temporaryLock?: TtdTemporaryLockState;
  performanceMetrics?: PerformanceMetrics;
  metrics?: PerformanceMetrics;
}

/** Options provided to executeAutofill */
export interface AutofillOptions {
  pilgrims?: Pilgrim[];
  profile?: Profile | null;
  doc?: Document;
  url?: string;
  step?: 'pilgrim' | 'general' | 'srivari_instructions' | 'srivari_enrollment' | 'unknown' | string;
  abortSignal?: AbortSignal;
  onlyRepairFailed?: boolean;
  targetFailedItems?: Array<{ pilgrimIndex?: number; field: string }>;
  onProgress?: (progress: AutofillProgress) => void;
  serviceType?: string;
  serviceId?: string;
  workflow?: any;
}
