// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Autofill Manager (State Machine)
// Single authoritative autofill engine with the pipeline:
// content.ts → step detector → autofill manager → row detector
// → field resolver → field transaction → verification → retry → report
// ─────────────────────────────────────────────────

import type { Pilgrim, Profile } from '@shared/types';
import { resolveGeneralDetails, getEffectiveAge } from '@shared/utils';
import { getAdapterForUrl, getAdapterForService } from '../../services/registry';
import type { ServiceAdapter } from '../../services/types';
import { detectAndLockPilgrimRows, isRowValidInDOM, reDetectRow } from './row-detector';
import type { PilgrimRowContext } from './row-detector';
import { resolvePilgrimFields, resolveGeneralFields, isElementVisible, reResolveField } from './field-resolver';
import type { FieldResolution } from './field-resolver';
import { performTextTransaction, performDropdownTransaction, executeTextTransaction, executeDropdownTransaction } from './field-transaction';
import { retryWithVerification, waitForElementInContainer } from './retry-engine';
import { verifyField } from './verification';
import { detectWorkflowStep } from './page-workflow';
import { getWorkflowById, detectActiveWorkflow, resolveWorkflowWithConfidence } from '../../services/workflows/registry';
import { getCanonicalService } from '../../services/canonical-service-registry';
import {
  detectPageTicketLimit,
  detectDigitalQueue,
  detectPayment,
  detectReviewDetails,
  detectPilgrimDetails,
  detectDeclarationCheckbox,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from '../../services/workflows/step-detectors';
import {
  resolveSrivariEnrollmentFields,
  type SrivariFieldType,
} from './field-resolver';
import { detectTtdTemporaryLock, logSafeTtdLockDetected } from '../../services/ttd-information/ttd-lock-detector';
import { scanForm } from '../form-scanner';
import { FieldMappingEngine } from '../field-mapping-engine';
import { validateFormStructure } from '../../services/workflows/structure-validator';
import type { ServiceWorkflow } from '../../services/workflows/types';
import { waitForCondition } from '../smart-wait';
import logger from '@shared/logger';
import { bookingSessionManager } from './booking-session';
import type {
  PilgrimFieldType,
  GeneralFieldType,
  FieldStatus,
  FieldTransactionResult,
  PilgrimProgress,
  AutofillManagerResult,
  AutofillProgress,
  AutofillState,
  AutofillOptions,
  BookingStep,
} from './types';
import { PerformanceProfiler, type PerformanceMetrics } from './performance-profiler';
import { prewarmBookingProfile, type PrewarmedBookingPlan } from './profile-prewarm';
import { DomSnapshot } from './dom-snapshot';
import { FieldCache } from './field-cache';
import { isFieldSatisfied, buildExecutionPlan } from './execution-plan';
import { AutofillScheduler } from './autofill-scheduler';

export type {
  AutofillProgress,
  PilgrimProgress,
  AutofillManagerResult,
  AutofillState,
  AutofillOptions,
  FieldTransactionResult,
  PilgrimFieldType,
  GeneralFieldType,
  FieldStatus,
};
export function getFieldLabel(field: string): string {
  switch (field) {
    case 'gothram': return 'Gothram';
    case 'name': return 'Name';
    case 'age': return 'Age';
    case 'gender': return 'Gender';
    case 'photoIdProof':
    case 'idProofType': return 'ID Proof Type';
    case 'photoIdNumber':
    case 'idProofNumber': return 'ID Proof Number';
    case 'email': return 'Email';
    case 'mobile': return 'Mobile';
    case 'photo': return 'Photo';
    case 'fatherSpouseName': return 'Father/Spouse Name';
    case 'dateOfBirth': return 'Date of Birth';
    case 'bloodGroup': return 'Blood Group';
    case 'mentallyFit': return 'Mentally Fit';
    case 'physicallyFit': return 'Physically Fit';
    case 'qualification': return 'Qualification';
    case 'profession': return 'Profession';
    case 'areaOfInterest': return 'Area of Interest';
    case 'employeeId': return 'Employee ID';
    case 'designation': return 'Designation';
    case 'specialisation': return 'Specialisation';
    case 'placeOfWork': return 'Place of Work';
    case 'document': return 'Document';
    case 'country': return 'Country';
    case 'pincode':
    case 'pinCode': return 'PIN Code';
    case 'state': return 'State';
    case 'district': return 'District';
    case 'mandal': return 'Mandal';
    case 'city': return 'City';
    case 'street': return 'Street';
    case 'doorNumber': return 'Door Number';
    default: return field;
  }
}

const MAX_PILGRIMS = 6;
const WATCHDOG_TIMEOUT_MS = 25000;

// ─── Concurrency Lock ───
let isRunning = false;
let shouldStop = false;
let sessionStartTime = 0;

export function isAutofillRunning(): boolean {
  if (isRunning && sessionStartTime > 0 && Date.now() - sessionStartTime > WATCHDOG_TIMEOUT_MS) {
    logger.warn('Autofill session lock expired via watchdog. Auto-resetting lock.');
    isRunning = false;
    shouldStop = false;
    sessionStartTime = 0;
    bookingSessionManager.endSession();
  }
  return isRunning || bookingSessionManager.isSessionActive();
}

export function requestStop(): void {
  shouldStop = true;
  bookingSessionManager.cancelSession();
  logger.info('Autofill stop requested');
}

export function resetSessionLock(): void {
  isRunning = false;
  shouldStop = false;
  sessionStartTime = 0;
  bookingSessionManager.reset();
  logger.info('Autofill session lock manually reset');
}

/**
 * Execute the unified autofill pipeline.
 */
export async function executeAutofill(opts: AutofillOptions = {}): Promise<AutofillManagerResult> {
  const pilgrims = Array.isArray(opts?.pilgrims) ? opts.pilgrims : [];
  const profile: Profile = opts?.profile || {
    id: 'default',
    name: 'Default Profile',
    pilgrims,
    selectedPilgrims: {},
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const onProgress = opts?.onProgress;
  const doc = opts?.doc ?? document;
  const startedAt = performance.now();

  // AbortSignal support
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) {
      shouldStop = true;
    } else {
      opts.abortSignal.addEventListener('abort', () => {
        requestStop();
      });
    }
  }

  // ─── Guard: concurrency lock with stale watchdog auto-recovery ───
  if (isAutofillRunning()) {
    return {
      success: false,
      state: 'ERROR',
      step: 'unknown',
      pilgrimResults: [],
      generalResults: [],
      totalVerified: 0,
      totalFailed: 0,
      totalFields: 0,
      durationMs: 0,
      errors: ['Autofill already in progress. Wait for completion or press Stop.', 'AUTOFILL ALREADY RUNNING'],
      needsAttention: true,
      failedItems: [],
    };
  }

  // ─── Guard: pilgrim count (Strict V1: 1-6 pilgrims) ───
  if (pilgrims.length > MAX_PILGRIMS) {
    return {
      success: false,
      state: 'ERROR',
      step: 'unknown',
      pilgrimResults: [],
      generalResults: [],
      totalVerified: 0,
      totalFailed: 0,
      totalFields: 0,
      durationMs: 0,
      errors: [`Maximum ${MAX_PILGRIMS} pilgrims supported in V1. Received ${pilgrims.length}. Please select 6 or fewer.`],
      needsAttention: true,
      failedItems: [],
    };
  }

  isRunning = true;
  shouldStop = false;
  sessionStartTime = Date.now();
  bookingSessionManager.startSession(profile.id, (opts as any).serviceId, (opts as any).workflow?.id);

  const bookingSignal = bookingSessionManager.getAbortSignal();
  if (bookingSignal) {
    bookingSignal.addEventListener('abort', () => {
      requestStop();
    });
  }

  const progress: AutofillProgress = {
    state: 'DETECT_STEP',
    currentPilgrimIndex: 0,
    totalPilgrims: pilgrims.length,
    currentField: '',
    pilgrimResults: [],
    generalResults: [],
    errors: [],
    startedAt,
    elapsedMs: 0,
    percent: 5,
  };

  const emit = () => {
    progress.elapsedMs = Math.round(performance.now() - startedAt);
    onProgress?.({ ...progress });
  };

  const url = (opts as any).url || doc.location?.href || '';
  let workflow: ServiceWorkflow | undefined = (opts as any).workflow;

  try {
    // ─── DETECT_STEP ───
    progress.state = 'DETECT_STEP';
    emit();

    // CAPTCHA safety boundary (Priority 1 - Phase 6 Section 26)
    const captchaDetected = doc.querySelector('#captcha-container, .captcha-container, img[src*="captcha" i], input[placeholder*="captcha" i], .g-recaptcha, .cf-turnstile');
    if (captchaDetected) {
      progress.state = 'ERROR';
      progress.errors.push('CAPTCHA detected. Complete it manually.');
      emit();
      return buildResult(progress, 'unknown', startedAt);
    }

    // TTD Temporary Pilgrim/ID Lock safety boundary (Priority 2)
    const lockCheck = detectTtdTemporaryLock(doc, url);
    if (lockCheck.isLocked && lockCheck.lockState) {
      logSafeTtdLockDetected({
        serviceId: (opts as any).serviceId || workflow?.serviceId,
        workflowId: workflow?.workflowId || (opts as any).workflow?.id,
        elapsedSeconds: lockCheck.lockState.elapsedSeconds,
      });
      progress.state = 'TTD_TEMPORARY_BOOKING_LOCK';
      progress.temporaryLock = lockCheck.lockState;
      progress.errors = [lockCheck.lockState.message];
      emit();
      return buildResult(progress, 'unknown', startedAt, workflow);
    }

    // Phase 3: Service-Specific Workflow Engine (Priority 4)
    let isUncertain = false;
    let resolutionMessage: string | undefined;
    let detectedConfidence = 0;

    if (!workflow && (opts as any).serviceId) {
      workflow = getWorkflowById((opts as any).serviceId);
    }
    if (!workflow && url) {
      const resolution = resolveWorkflowWithConfidence(url, doc);
      workflow = resolution.workflow;
      isUncertain = resolution.isUncertain;
      resolutionMessage = resolution.message;
      detectedConfidence = resolution.confidence;
    }

    // Uncertain service detection with competing or ambiguous signals (Section 11)
    if (isUncertain && resolutionMessage && detectedConfidence > 0 && !(opts as any).workflow && !(opts as any).serviceId) {
      progress.state = 'ERROR';
      progress.errors.push(resolutionMessage);
      emit();
      return buildResult(progress, 'unknown', startedAt);
    }

    // Requirement 19 - Test E: If explicit unknown service was specified, pause with clear message
    if ((opts as any).serviceId && !workflow) {
      progress.state = 'ERROR';
      progress.errors.push('Service workflow not recognized. Autofill is paused.');
      emit();
      return buildResult(progress, 'unknown', startedAt);
    }

    // Digital Queue handling (Passive waiting only - Section 12 & Phase 6 Section 27)
    if (detectDigitalQueue(doc, url).isCurrentStep) {
      progress.state = 'ERROR';
      const queueMsg = workflow?.queueConfig?.statusMessages?.detected || 'Queue detected. Please wait passively without refreshing.';
      progress.errors.push(queueMsg);
      emit();
      return buildResult(progress, 'unknown', startedAt);
    }

    // Payment safety enforcement (Phase 6 Section 25)
    if (detectPayment(doc, url).isCurrentStep) {
      progress.state = 'COMPLETE';
      progress.percent = 100;
      progress.errors.push('Payment page reached. Complete payment manually.');
      emit();
      return buildResult(progress, 'unknown', startedAt);
    }

    // IMPORTANT: Use the canonical workflow detector first.
    // TTD keeps the pilgrim-details route while advancing to General Details,
    // so URL-based detection alone can incorrectly restart the pilgrim step.
    // detectWorkflowStep() checks the live DOM/step structure and gives
    // GENERAL_DETAILS precedence when that section is actually active.
    const bookingStep = detectWorkflowStep(doc, url, workflow);
    let step: 'pilgrim' | 'general' | 'unknown' | 'srivari_instructions' | 'srivari_enrollment' =
      bookingStep === 'PILGRIM_DETAILS' ? 'pilgrim'
        : bookingStep === 'GENERAL_DETAILS' ? 'general'
        : bookingStep === 'INSTRUCTIONS_REVIEW' ? 'srivari_instructions'
        : bookingStep === 'SRIVARI_SEVA_ENROLLMENT' ? 'srivari_enrollment'
        : 'unknown';

    if (step === 'unknown') {
      if (detectSrivariSevaInstructions(doc, url).isCurrentStep) {
        step = 'srivari_instructions';
      } else if (detectSrivariSevaEnrollment(doc, url).isCurrentStep) {
        step = 'srivari_enrollment';
      } else if (detectPilgrimDetails(doc, url).isCurrentStep) {
        step = 'pilgrim';
      } else if (workflow && detectWorkflowStep(doc, url, workflow) === 'PILGRIM_DETAILS') {
        step = 'pilgrim';
      }
    }

    logger.info(`Detected booking step: ${step} (raw: ${bookingStep})`);

    if (step === 'unknown') {
      const lockOnFail = detectTtdTemporaryLock(doc, url);
      if (lockOnFail.isLocked && lockOnFail.lockState) {
        logSafeTtdLockDetected({
          serviceId: (opts as any).serviceId || workflow?.serviceId,
          workflowId: workflow?.workflowId || (opts as any).workflow?.id,
          elapsedSeconds: lockOnFail.lockState.elapsedSeconds,
        });
        progress.state = 'TTD_TEMPORARY_BOOKING_LOCK';
        progress.temporaryLock = lockOnFail.lockState;
        progress.errors = [lockOnFail.lockState.message];
        emit();
        return buildResult(progress, step, startedAt, workflow);
      }
      progress.state = 'ERROR';
      progress.errors.push('Pilgrim fields could not be safely identified.');
      emit();
      return buildResult(progress, step, startedAt, workflow);
    }

    // Phase 1 / Phase 3: If service has NO General Details step (e.g. Padmavathi ₹200),
    // NEVER attempt or force general details autofill!
    const canonical = workflow?.serviceId ? getCanonicalService(workflow.serviceId) : undefined;
    if (step === 'general' && ((workflow && !workflow.hasGeneralDetailsStep) || (canonical && !canonical.hasGeneralDetailsStep))) {
      progress.state = 'COMPLETE';
      progress.percent = 100;
      emit();
      return buildResult(progress, 'general', startedAt);
    }

    const adapter: ServiceAdapter = (opts as any).adapter ||
      ((opts as any).serviceType ? getAdapterForService((opts as any).serviceType) : undefined) ||
      getAdapterForUrl(url, doc);

    if (workflow && workflow.maxPilgrims) {
      adapter.maxPilgrims = workflow.maxPilgrims;
    }

    // Two-person ticket quantity validation (Section 20)
    if (workflow && workflow.exactPilgrims) {
      const reportedLimit = detectPageTicketLimit(doc);
      if (reportedLimit !== null && reportedLimit !== workflow.exactPilgrims) {
        progress.state = 'ERROR';
        progress.errors.push('TTD page reports a different ticket limit. Review required.');
        emit();
        return buildResult(progress, step, startedAt);
      }
    }

    // ─── SRIVARI INSTRUCTIONS STEP ───
    if (step === 'srivari_instructions') {
      return await executeSrivariInstructionsStep(doc, progress, emit, startedAt, workflow);
    }

    // ─── SRIVARI ENROLLMENT STEP ───
    if (step === 'srivari_enrollment') {
      return await executeSrivariEnrollmentStep(pilgrims, profile, doc, progress, emit, startedAt, workflow);
    }

    // ─── PILGRIM STEP ───
    if (step === 'pilgrim') {
      return await executePilgrimStep(pilgrims, doc, progress, emit, startedAt, adapter, workflow);
    }

    // ─── GENERAL STEP ───
    if (step === 'general') {
      return await executeGeneralStep(profile, doc, progress, emit, startedAt, workflow);
    }

    progress.state = 'ERROR';
    progress.errors.push(`Unhandled step: ${step}`);
    emit();
    return buildResult(progress, step, startedAt);
  } catch (err) {
    logger.error('Autofill manager error:', err);
    const lockInCatch = detectTtdTemporaryLock(doc, url);
    if (lockInCatch.isLocked && lockInCatch.lockState) {
      logSafeTtdLockDetected({
        serviceId: (opts as any).serviceId || workflow?.serviceId,
        workflowId: workflow?.workflowId || (opts as any).workflow?.id,
        elapsedSeconds: lockInCatch.lockState.elapsedSeconds,
      });
      progress.state = 'TTD_TEMPORARY_BOOKING_LOCK';
      progress.temporaryLock = lockInCatch.lockState;
      progress.errors = [lockInCatch.lockState.message];
      return buildResult(progress, 'unknown', startedAt, workflow);
    }
    progress.state = 'ERROR';
    progress.errors.push(err instanceof Error ? err.message : 'Unknown error');
    return buildResult(progress, 'unknown', startedAt, workflow);
  } finally {
    isRunning = false;
    shouldStop = false;
    sessionStartTime = 0;
    bookingSessionManager.endSession();
  }

}

// ─── Pilgrim Step Pipeline ───

async function executePilgrimStep(
  pilgrims: Pilgrim[],
  doc: Document,
  progress: AutofillProgress,
  emit: () => void,
  startedAt: number,
  adapter?: ServiceAdapter,
  workflow?: ServiceWorkflow,
): Promise<AutofillManagerResult> {
  const canonical = workflow?.serviceId ? getCanonicalService(workflow.serviceId) : undefined;
  const maxAllowed = canonical?.maxPilgrims ?? workflow?.maxPilgrims ?? adapter?.maxPilgrims ?? 6;
  const exactRequired = canonical?.exactPilgrims ?? workflow?.exactPilgrims;

  // Max pilgrim safety (Section 21): block before fill if workflow defines strict counts
  if (workflow?.exactPilgrims && pilgrims.length !== workflow.exactPilgrims) {
    progress.state = 'ERROR';
    progress.errors.push(`${workflow.serviceName} permits exactly ${workflow.exactPilgrims} pilgrims per booking.`);
    emit();
    return buildResult(progress, 'pilgrim', startedAt);
  }

  if (workflow?.maxPilgrims && pilgrims.length > workflow.maxPilgrims) {
    progress.state = 'ERROR';
    progress.errors.push(`${workflow.serviceName} allows a maximum of ${workflow.maxPilgrims} participants.`);
    emit();
    return buildResult(progress, 'pilgrim', startedAt);
  }

  const targetPilgrims = pilgrims.slice(0, maxAllowed);
  progress.totalPilgrims = targetPilgrims.length;

  // Phase 4: Structural Confidence Check
  if (workflow) {
    const structVal = validateFormStructure(workflow, 'PILGRIM_DETAILS', doc);
    if (!structVal.isValid) {
      progress.state = 'ERROR';
      progress.errors.push(structVal.reason || 'TTD form structure has changed. Please review before autofill.');
      emit();
      return buildResult(progress, 'pilgrim', startedAt);
    }
  }

  // ─── LOCK_ROWS ───
  progress.state = 'LOCK_ROWS';
  emit();

  let lockedRows = detectAndLockPilgrimRows(doc, targetPilgrims.length);
  logger.info(`Locked ${lockedRows.length} row(s) for ${targetPilgrims.length} pilgrim(s) (limit: ${maxAllowed})`);

  if (lockedRows.length === 0) {
    try {
      const scannedFields = scanForm(doc);
      const mappedResult = FieldMappingEngine.map(scannedFields);
      const pilgrimMappings = mappedResult.allMapped.filter(m => m.pilgrimKey !== null);
      if (pilgrimMappings.length >= 2) {
        const fieldKeyMap: Record<string, PilgrimFieldType> = {
          fullName: 'name',
          firstName: 'name',
          name: 'name',
          age: 'age',
          gender: 'gender',
          idType: 'photoIdProof',
          photoIdProof: 'photoIdProof',
          idNumber: 'photoIdNumber',
          photoIdNumber: 'photoIdNumber',
        };

        const fields = new Map<PilgrimFieldType, HTMLElement>();
        const fieldResolutions = new Map<PilgrimFieldType, FieldResolution>();

        for (const mapping of pilgrimMappings) {
          const pKey = fieldKeyMap[mapping.pilgrimKey as string];
          if (!pKey || fields.has(pKey)) continue;

          let targetEl: HTMLElement | null = null;
          if (mapping.scannedField.element) {
            try {
              targetEl = doc.querySelector(mapping.scannedField.element) as HTMLElement;
            } catch {}
          }
          if (!targetEl && mapping.scannedField.id) {
            targetEl = doc.getElementById(mapping.scannedField.id);
          }

          if (targetEl && isElementVisible(targetEl)) {
            fields.set(pKey, targetEl);
            fieldResolutions.set(pKey, {
              element: targetEl,
              field: pKey,
              confidence: mapping.confidence || 85,
              strategy: 'scannerMapping',
              reasons: mapping.matchReasons || ['Scanned form field match'],
            });
          }
        }

        if (fields.size >= 2) {
          const firstEl = Array.from(fields.values())[0];
          const rowContainer = (firstEl.closest('.card, .pilgrim-card, .devotee-card, mat-card, fieldset, section, form, div') as HTMLElement) || firstEl.parentElement || doc.body;
          lockedRows = [{
            index: 0,
            element: rowContainer,
            fingerprint: 'row-0:scanner-mapped',
            confidence: 85,
            fields,
            fieldResolutions,
            isLocked: true,
          }];
          logger.info(`Constructed fallback locked row with ${fields.size} scanner mapped fields`);
        }
      }
    } catch (e) {
      logger.warn('Fallback scanner mapping error:', e);
    }
  }

  if (lockedRows.length === 0) {
    progress.state = 'ERROR';
    progress.errors.push('Pilgrim fields could not be safely identified.');
    emit();
    return buildResult(progress, 'pilgrim', startedAt);
  }

  // Row order safety check (Section 28)
  if (workflow?.exactPilgrims && lockedRows.length < workflow.exactPilgrims) {
    progress.state = 'ERROR';
    progress.errors.push(`Could not detect all ${workflow.exactPilgrims} pilgrim rows safely.`);
    emit();
    return buildResult(progress, 'pilgrim', startedAt);
  }

  // Initialize pilgrim progress
  for (let i = 0; i < targetPilgrims.length; i++) {
    const pilgrim = targetPilgrims[i];
    progress.pilgrimResults.push({
      pilgrimIndex: i,
      pilgrimName: pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || `Pilgrim ${i + 1}`,
      fieldsTotal: 5,
      fieldsVerified: 0,
      fieldsFailed: 0,
      results: [],
      status: 'pending',
    });
  }

  // ─── FILLING_PILGRIMS ───
  progress.state = 'FILLING_PILGRIMS';
  emit();

  const rowCount = Math.min(targetPilgrims.length, lockedRows.length);

  for (let i = 0; i < rowCount; i++) {
    if (shouldStop) {
      progress.state = 'STOPPED';
      progress.errors.push('Autofill stopped by user.');
      emit();
      return buildResult(progress, 'pilgrim', startedAt);
    }

    const pilgrim = targetPilgrims[i];
    let row = lockedRows[i];
    const pp = progress.pilgrimResults[i];
    pp.status = 'filling';
    progress.currentPilgrimIndex = i;
    emit();

    // DOM re-render safety
    if (!isRowValidInDOM(row, doc)) {
      logger.warn(`Row ${i} detached from DOM. Re-scanning...`);
      const reDetected = reDetectRow(doc, targetPilgrims.length, i);
      if (reDetected) {
        row = reDetected;
        lockedRows[i] = row;
      } else {
        pp.status = 'failed';
        pp.results.push({
          field: 'row',
          pilgrimIndex: i,
          status: 'failed',
          attempts: 0,
          durationMs: 0,
          error: 'Row disappeared after DOM re-render',
        });
        continue;
      }
    }

    // Fill all 5 fields for this pilgrim
    await fillPilgrimRow(pilgrim, row, i, pp, progress, doc, emit);
  }

  // ─── VERIFYING_PILGRIMS ───
  progress.state = 'VERIFYING_PILGRIMS';
  emit();

  for (const pp of progress.pilgrimResults) {
    pp.fieldsVerified = pp.results.filter(r => r.status === 'verified').length;
    pp.fieldsFailed = pp.results.filter(r => r.status === 'failed').length;

    const requiredKeys = ['name', 'age', 'gender', 'photoIdProof', 'photoIdNumber'];
    const verifiedKeys = new Set(pp.results.filter(r => r.status === 'verified').map(r => r.field));
    const all5Verified = requiredKeys.every(k => verifiedKeys.has(k));

    pp.status = all5Verified && pp.fieldsFailed === 0
      ? 'verified'
      : (pp.fieldsVerified > 0 ? 'partial' : 'failed');
  }

  // ─── REPAIR FAILED FIELDS (V1 pipeline) ───
  const hasFailed = progress.pilgrimResults.some(pp => pp.fieldsFailed > 0);
  if (hasFailed && !shouldStop) {
    progress.state = 'REPAIRING_FAILED';
    progress.percent = 88;
    emit();

    await repairFailedPilgrimFields(lockedRows, targetPilgrims, progress, doc, emit);

    // Re-tally results after repair
    for (const pp of progress.pilgrimResults) {
      pp.fieldsVerified = pp.results.filter(r => r.status === 'verified').length;
      pp.fieldsFailed = pp.results.filter(r => r.status === 'failed').length;

      const requiredKeys = ['name', 'age', 'gender', 'photoIdProof', 'photoIdNumber'];
      const verifiedKeys = new Set(pp.results.filter(r => r.status === 'verified').map(r => r.field));
      const all5Verified = requiredKeys.every(k => verifiedKeys.has(k));

      pp.status = all5Verified && pp.fieldsFailed === 0
        ? 'verified'
        : (pp.fieldsVerified > 0 ? 'partial' : 'failed');
    }
  }

  // ─── COMPLETE ───
  progress.state = 'COMPLETE';
  progress.percent = 100;
  emit();

  // Autofocus captcha (user responsibility)
  autofocusCaptcha(doc);

  return buildResult(progress, 'pilgrim', startedAt);
}

async function fillPilgrimRow(
  pilgrim: Pilgrim,
  row: PilgrimRowContext,
  pilgrimIndex: number,
  pp: PilgrimProgress,
  progress: AutofillProgress,
  doc: Document,
  emit: () => void,
): Promise<void> {
  if (shouldStop) return;
  const container = row.element;
  const excludeElements = new Set<HTMLElement>();

  // 1. Initial semantic resolution
  let resolutions = resolvePilgrimFields(container, doc);

  const getRes = (type: PilgrimFieldType): FieldResolution | null => {
    const res = resolutions.get(type);
    if (res && doc.contains(res.element)) return res;
    const locked = row.fieldResolutions.get(type);
    if (locked && doc.contains(locked.element)) return locked;
    return null;
  };

  // ─── 1. Name ───
  if (shouldStop) return;
  progress.currentField = `Pilgrim ${pilgrimIndex + 1}: Name`;
  emit();
  const nameRes = getRes('name');
  const nameVal = (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim();

  if (bookingSessionManager.isUserModified('name', pilgrimIndex)) {
    logger.info(`Pilgrim ${pilgrimIndex + 1}: Name was manually entered by user. Preserving user value.`);
    pp.results.push({
      field: 'name',
      pilgrimIndex,
      status: 'verified',
      attempts: 0,
      durationMs: 0,
      maskedValue: nameVal,
      detected: true,
      confidence: 100,
      strategy: 'userPreserved',
      filled: false,
      verified: true,
      reasons: ['Your manually entered value was preserved.'],
    });
    bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: 'name', pilgrimIndex });
  } else if (nameVal && nameRes) {
    bookingSessionManager.emitDiagnostic('FIELD_RESOLVED', { field: 'name', pilgrimIndex, strategy: nameRes.strategy, confidence: nameRes.confidence });
    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: 'name',
      element: nameRes.element,
      expectedValue: nameVal,
      container,
      excludeElements,
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        await performTextTransaction(el as HTMLInputElement, nameVal);
      },
    });
    excludeElements.add(retryRes.retriedElement || nameRes.element);
    bookingSessionManager.emitDiagnostic(retryRes.success ? 'FIELD_VERIFIED' : 'FIELD_FAILED', { field: 'name', pilgrimIndex });

    pp.results.push({
      field: 'name',
      pilgrimIndex,
      status: retryRes.success ? 'verified' : 'failed',
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: nameVal,
      error: retryRes.success ? undefined : (retryRes.error || 'Name verification failed'),
      detected: true,
      confidence: nameRes.confidence,
      strategy: nameRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  } else {
    pp.results.push({
      field: 'name',
      pilgrimIndex,
      status: nameVal ? 'failed' : 'skipped',
      attempts: 0,
      durationMs: 0,
      error: nameVal ? 'Name field could not be safely detected' : 'Name is empty in profile',
      detected: Boolean(nameRes),
      confidence: nameRes?.confidence || 0,
      strategy: nameRes?.strategy || 'none',
      filled: false,
      verified: false,
    });
  }

  // ─── 2. Age ───
  if (shouldStop) return;
  progress.currentField = `Pilgrim ${pilgrimIndex + 1}: Age`;
  emit();
  const ageRes = getRes('age');
  const effectiveAge = getEffectiveAge(pilgrim);
  const ageStr = effectiveAge !== undefined ? String(effectiveAge) : '';

  if (bookingSessionManager.isUserModified('age', pilgrimIndex)) {
    logger.info(`Pilgrim ${pilgrimIndex + 1}: Age was manually entered by user. Preserving user value.`);
    pp.results.push({
      field: 'age',
      pilgrimIndex,
      status: 'verified',
      attempts: 0,
      durationMs: 0,
      maskedValue: ageStr,
      detected: true,
      confidence: 100,
      strategy: 'userPreserved',
      filled: false,
      verified: true,
      reasons: ['Your manually entered value was preserved.'],
    });
    bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: 'age', pilgrimIndex });
  } else if (ageStr && ageRes) {
    bookingSessionManager.emitDiagnostic('FIELD_RESOLVED', { field: 'age', pilgrimIndex, strategy: ageRes.strategy, confidence: ageRes.confidence });
    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: 'age',
      element: ageRes.element,
      expectedValue: ageStr,
      container,
      excludeElements,
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        await performTextTransaction(el as HTMLInputElement, ageStr);
      },
    });
    excludeElements.add(retryRes.retriedElement || ageRes.element);
    bookingSessionManager.emitDiagnostic(retryRes.success ? 'FIELD_VERIFIED' : 'FIELD_FAILED', { field: 'age', pilgrimIndex });
    pp.results.push({
      field: 'age',
      pilgrimIndex,
      status: retryRes.success ? 'verified' : 'failed',
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: ageStr,
      error: retryRes.success ? undefined : (retryRes.error || 'Age verification failed'),
      detected: true,
      confidence: ageRes.confidence,
      strategy: ageRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  } else {
    pp.results.push({
      field: 'age',
      pilgrimIndex,
      status: ageStr ? 'failed' : 'skipped',
      attempts: 0,
      durationMs: 0,
      error: ageStr ? 'Age field could not be safely detected' : 'Age is empty in profile',
      detected: Boolean(ageRes),
      confidence: ageRes?.confidence || 0,
      strategy: ageRes?.strategy || 'none',
      filled: false,
      verified: false,
    });
  }

  // ─── 3. Gender ───
  if (shouldStop) return;
  progress.currentField = `Pilgrim ${pilgrimIndex + 1}: Gender`;
  emit();
  const genderRes = getRes('gender');
  const genderStr = pilgrim.gender || 'Male';

  if (bookingSessionManager.isUserModified('gender', pilgrimIndex)) {
    logger.info(`Pilgrim ${pilgrimIndex + 1}: Gender was manually entered by user. Preserving user value.`);
    pp.results.push({
      field: 'gender',
      pilgrimIndex,
      status: 'verified',
      attempts: 0,
      durationMs: 0,
      maskedValue: genderStr,
      detected: true,
      confidence: 100,
      strategy: 'userPreserved',
      filled: false,
      verified: true,
      reasons: ['Your manually entered value was preserved.'],
    });
    bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: 'gender', pilgrimIndex });
  } else if (genderRes) {
    bookingSessionManager.emitDiagnostic('FIELD_RESOLVED', { field: 'gender', pilgrimIndex, strategy: genderRes.strategy, confidence: genderRes.confidence });
    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: 'gender',
      element: genderRes.element,
      expectedValue: genderStr,
      container,
      excludeElements,
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        await performDropdownTransaction(el, genderStr, 'gender', doc);
      },
    });
    excludeElements.add(retryRes.retriedElement || genderRes.element);
    bookingSessionManager.emitDiagnostic(retryRes.success ? 'FIELD_VERIFIED' : 'FIELD_FAILED', { field: 'gender', pilgrimIndex });

    pp.results.push({
      field: 'gender',
      pilgrimIndex,
      status: retryRes.success ? 'verified' : 'failed',
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: genderStr,
      error: retryRes.success ? undefined : (retryRes.error || 'Gender verification failed'),
      detected: true,
      confidence: genderRes.confidence,
      strategy: genderRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  } else {
    // Check for radio buttons in container
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const normTarget = genderStr.toLowerCase().trim();
    const targetRadio = radios.find(r => {
      const val = (r.value || '').toLowerCase();
      const lbl = (r.parentElement?.textContent || '').toLowerCase();
      if (normTarget === 'male' || normTarget === 'm') {
        if (val.includes('female') || lbl.includes('female')) return false;
        return val === 'male' || val === 'm' || lbl === 'male' || /\bmale\b/i.test(lbl);
      }
      if (normTarget === 'female' || normTarget === 'f') {
        return val === 'female' || val === 'f' || lbl === 'female' || /\bfemale\b/i.test(lbl);
      }
      return val === normTarget || lbl.includes(normTarget);
    });

    if (targetRadio) {
      targetRadio.click();
      targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      pp.results.push({
        field: 'gender',
        pilgrimIndex,
        status: 'verified',
        attempts: 1,
        durationMs: 15,
        maskedValue: genderStr,
        detected: true,
        confidence: 80,
        strategy: 'radioGroup',
        filled: true,
        verified: true,
      });
    } else {
      pp.results.push({
        field: 'gender',
        pilgrimIndex,
        status: 'failed',
        attempts: 0,
        durationMs: 0,
        error: 'Gender field could not be safely detected',
        detected: false,
        confidence: 0,
        strategy: 'none',
        filled: false,
        verified: false,
      });
    }
  }

  // DOM stabilization pause after Gender
  await new Promise(r => setTimeout(r, 120));

  // Re-resolve affected row after gender dependency change
  resolutions = resolvePilgrimFields(container, doc);

  // ─── 4. Photo ID Proof ───
  if (shouldStop) return;
  progress.currentField = `Pilgrim ${pilgrimIndex + 1}: Photo ID Proof`;
  emit();
  const idProofRes = getRes('photoIdProof');
  const idType = pilgrim.idType || 'Aadhaar Card';

  if (bookingSessionManager.isUserModified('photoIdProof', pilgrimIndex)) {
    logger.info(`Pilgrim ${pilgrimIndex + 1}: Photo ID Proof was manually entered by user. Preserving user value.`);
    pp.results.push({
      field: 'photoIdProof',
      pilgrimIndex,
      status: 'verified',
      attempts: 0,
      durationMs: 0,
      maskedValue: idType,
      detected: true,
      confidence: 100,
      strategy: 'userPreserved',
      filled: false,
      verified: true,
      reasons: ['Your manually entered value was preserved.'],
    });
    bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: 'photoIdProof', pilgrimIndex });
  } else if (idProofRes) {
    bookingSessionManager.emitDiagnostic('FIELD_RESOLVED', { field: 'photoIdProof', pilgrimIndex, strategy: idProofRes.strategy, confidence: idProofRes.confidence });
    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: 'photoIdProof',
      element: idProofRes.element,
      expectedValue: idType,
      container,
      excludeElements,
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        await performDropdownTransaction(el, idType, 'photoIdProof', doc);
      },
    });
    excludeElements.add(retryRes.retriedElement || idProofRes.element);
    bookingSessionManager.emitDiagnostic(retryRes.success ? 'FIELD_VERIFIED' : 'FIELD_FAILED', { field: 'photoIdProof', pilgrimIndex });

    pp.results.push({
      field: 'photoIdProof',
      pilgrimIndex,
      status: retryRes.success ? 'verified' : 'failed',
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: idType,
      error: retryRes.success ? undefined : (retryRes.error || 'Photo ID Proof verification failed'),
      detected: true,
      confidence: idProofRes.confidence,
      strategy: idProofRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  } else {
    // Critical: NEVER fall back to first remaining dropdown in production
    pp.results.push({
      field: 'photoIdProof',
      pilgrimIndex,
      status: 'failed',
      attempts: 0,
      durationMs: 0,
      error: 'Photo ID Proof dropdown could not be safely detected',
      detected: false,
      confidence: 0,
      strategy: 'none',
      filled: false,
      verified: false,
    });
  }

  // ─── 5. Photo ID Number (Sequential dependency: wait for Angular Reactive Form to enable) ───
  if (shouldStop) return;
  progress.currentField = `Pilgrim ${pilgrimIndex + 1}: Photo ID Number`;
  emit();

  // Wait for framework/DOM stabilization after ID Proof selection
  await new Promise(r => setTimeout(r, 150));
  if (shouldStop) return;

  // Re-resolve the current row
  resolutions = resolvePilgrimFields(container, doc);
  let idNumRes = getRes('photoIdNumber');

  // If not immediately found, wait for dynamic insertion in container
  if (!idNumRes) {
    idNumRes = await waitForElementInContainer('photoIdNumber', container, excludeElements, doc, 1200);
  }

  if (shouldStop) return;

  // Critical: NEVER fall back to last input in production
  if (!idNumRes) {
    pp.results.push({
      field: 'photoIdNumber',
      pilgrimIndex,
      status: 'failed',
      attempts: 0,
      durationMs: 0,
      error: 'Photo ID Number field could not be safely detected',
      detected: false,
      confidence: 0,
      strategy: 'none',
      filled: false,
      verified: false,
    });
    return;
  }

  // Wait for enabled state if necessary — NEVER force disabled=false or remove disabled attribute
  let idNumEl = idNumRes.element as HTMLInputElement;
  if (idNumEl.disabled) {
    const startWait = Date.now();
    await waitForCondition(() => {
      if (!idNumEl.disabled) return true;
      // Re-resolve in case Angular replaced the element or updated reactive form state
      resolutions = resolvePilgrimFields(container, doc);
      const refRes = getRes('photoIdNumber');
      if (refRes && !(refRes.element as HTMLInputElement).disabled) {
        idNumEl = refRes.element as HTMLInputElement;
        idNumRes = refRes;
        return true;
      }
      return false;
    }, { timeoutMs: 2500, pollMs: 50 });

    if (shouldStop) return;

    if (idNumEl.disabled) {
      pp.results.push({
        field: 'photoIdNumber',
        pilgrimIndex,
        status: 'failed',
        attempts: 1,
        durationMs: Math.round(Date.now() - startWait),
        error: 'Photo ID Number field is disabled — cannot fill without overriding website control state',
        detected: true,
        confidence: idNumRes.confidence,
        strategy: idNumRes.strategy,
        filled: false,
        verified: false,
      });
      return;
    }
  }

  let idNum = String(pilgrim.idNumber || '').trim();
  const isAadhaar = (pilgrim.idType || '').toLowerCase().includes('aadhaar') ||
    (pilgrim.idType || '').toLowerCase().includes('aadhar') ||
    idNum.replace(/\D/g, '').length === 12;

  if (isAadhaar) {
    idNum = idNum.replace(/\D/g, '').slice(0, 12);
  } else {
    idNum = idNum.replace(/\s+/g, '').replace(/-/g, '');
  }

  if (bookingSessionManager.isUserModified('photoIdNumber', pilgrimIndex)) {
    logger.info(`Pilgrim ${pilgrimIndex + 1}: Photo ID Number was manually entered by user. Preserving user value.`);
    pp.results.push({
      field: 'photoIdNumber',
      pilgrimIndex,
      status: 'verified',
      attempts: 0,
      durationMs: 0,
      maskedValue: idNum.length >= 4 ? `••••${idNum.slice(-4)}` : '••••',
      detected: true,
      confidence: 100,
      strategy: 'userPreserved',
      filled: false,
      verified: true,
      reasons: ['Your manually entered value was preserved.'],
    });
    bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: 'photoIdNumber', pilgrimIndex });
    return;
  }

  if (idNum) {
    bookingSessionManager.emitDiagnostic('FIELD_RESOLVED', { field: 'photoIdNumber', pilgrimIndex, strategy: idNumRes.strategy, confidence: idNumRes.confidence });
    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: 'photoIdNumber',
      element: idNumEl,
      expectedValue: idNum,
      container,
      excludeElements,
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        await performTextTransaction(el as HTMLInputElement, idNum);
      },
    });
    excludeElements.add(retryRes.retriedElement || idNumEl);
    bookingSessionManager.emitDiagnostic(retryRes.success ? 'FIELD_VERIFIED' : 'FIELD_FAILED', { field: 'photoIdNumber', pilgrimIndex });
    pp.results.push({
      field: 'photoIdNumber',
      pilgrimIndex,
      status: retryRes.success ? 'verified' : 'failed',

      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: idNum.length >= 4 ? `••••${idNum.slice(-4)}` : '••••',
      error: retryRes.success ? undefined : (retryRes.error || 'Photo ID Number verification failed'),
      detected: true,
      confidence: idNumRes.confidence,
      strategy: idNumRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  } else {
    pp.results.push({
      field: 'photoIdNumber',
      pilgrimIndex,
      status: 'skipped',
      attempts: 0,
      durationMs: 0,
      error: 'Photo ID Number is empty in profile',
      detected: true,
      confidence: idNumRes.confidence,
      strategy: idNumRes.strategy,
      filled: false,
      verified: false,
    });
  }
}

// ─── General Step Pipeline ───

async function executeGeneralStep(
  profile: Profile,
  doc: Document,
  progress: AutofillProgress,
  emit: () => void,
  startedAt: number,
  workflow?: ServiceWorkflow,
): Promise<AutofillManagerResult> {
  // Phase 4: Structural Confidence Check
  if (workflow) {
    const structVal = validateFormStructure(workflow, 'GENERAL_DETAILS', doc);
    if (!structVal.isValid) {
      progress.state = 'ERROR';
      progress.errors.push(structVal.reason || 'TTD form structure has changed. Please review before autofill.');
      emit();
      return buildResult(progress, 'general', startedAt, workflow);
    }
  }

  progress.state = 'FILLING_GENERAL';
  emit();

  const general = resolveGeneralDetails(profile);
  const results: FieldTransactionResult[] = [];

  const generalStep = workflow?.steps?.find(s => s.stepType === 'GENERAL_DETAILS');
  const isHomam = workflow?.serviceId === 'sri-srinivasa-divyanugraha-homam';

  // Semantic resolver is authoritative (NO secondary brittle selector system)
  const semanticFields = resolveGeneralFields(doc);

  // General field definitions: key, label, value
  // For Homam: Gothram is first and booking-level, mobile is NOT part of Homam workflow.
  const allFieldDefs: { key: GeneralFieldType; label: string; value: string; isExcluded?: boolean }[] = [
    { key: 'gothram', label: 'Gothram', value: general.gothram },
    { key: 'email', label: 'Email', value: general.email },
    { key: 'mobile', label: 'Mobile', value: general.mobile, isExcluded: isHomam },
    { key: 'city', label: 'City', value: general.city },
    { key: 'state', label: 'State', value: general.state },
    { key: 'country', label: 'Country', value: general.country },
    { key: 'pinCode', label: 'PIN Code', value: general.pinCode },
  ];

  const generalFieldDefs = allFieldDefs.filter(def => {
    if (def.isExcluded) return false;
    if (generalStep) {
      return generalStep.requiredFields.includes(def.key) || generalStep.optionalFields.includes(def.key);
    }
    // Backward compatibility if no workflow specified:
    if (def.key === 'gothram' && !def.value && !semanticFields.has('gothram')) {
      return false;
    }
    return true;
  });

  for (const def of generalFieldDefs) {
    if (shouldStop) break;

    progress.currentField = def.label;
    emit();

    const semanticRes = semanticFields.get(def.key);

    if (bookingSessionManager.isUserModified(def.key)) {
      logger.info(`General details: ${def.label} was manually entered by user. Preserving user value.`);
      results.push({
        field: def.key,
        pilgrimIndex: -1,
        status: 'verified',
        attempts: 0,
        durationMs: 0,
        maskedValue: def.key === 'mobile' ? `••••••${def.value.slice(-2)}` : (def.key === 'email' ? `${def.value[0]}•••@•••` : def.value),
        error: undefined,
        detected: true,
        confidence: 100,
        strategy: 'userPreserved',
        filled: false,
        verified: true,
        reasons: ['Your manually entered value was preserved.'],
      });
      bookingSessionManager.emitDiagnostic('FIELD_VERIFIED', { field: def.key });
      continue;
    }

    if (!def.value) {
      results.push({
        field: def.key,
        pilgrimIndex: -1,
        status: 'skipped',
        attempts: 0,
        durationMs: 0,
        error: `${def.label} is empty in profile`,
        detected: Boolean(semanticRes),
        confidence: semanticRes?.confidence || 0,
        strategy: semanticRes?.strategy || 'none',
        filled: false,
        verified: false,
      });
      continue;
    }

    if (!semanticRes || !doc.contains(semanticRes.element)) {
      results.push({
        field: def.key,
        pilgrimIndex: -1,
        status: 'failed',
        attempts: 0,
        durationMs: 0,
        error: `${def.label} field could not be safely detected`,
        detected: false,
        confidence: 0,
        strategy: 'none',
        filled: false,
        verified: false,
      });
      continue;
    }

    const isDropdown = def.key === 'state' || def.key === 'country';
    const start = performance.now();

    const retryRes = await retryWithVerification({
      fieldType: def.key,
      element: semanticRes.element,
      expectedValue: def.value,
      container: doc.body || doc.documentElement,
      excludeElements: new Set(),
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        if (isDropdown) {
          await performDropdownTransaction(el, def.value, def.key, doc);
        } else {
          await performTextTransaction(el as HTMLInputElement, def.value);
        }
      },
    });

    results.push({
      field: def.key,
      pilgrimIndex: -1,
      status: retryRes.success ? 'verified' : 'failed',
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: def.key === 'mobile' ? `••••••${def.value.slice(-2)}` : (def.key === 'email' ? `${def.value[0]}•••@•••` : def.value),
      error: retryRes.success ? undefined : (retryRes.error || `${def.label} verification failed`),
      detected: true,
      confidence: semanticRes.confidence,
      strategy: semanticRes.strategy,
      filled: true,
      verified: retryRes.success,
    });
  }

  progress.generalResults = results;

  // ─── VERIFYING_GENERAL ───
  progress.state = 'VERIFYING_GENERAL';
  emit();

  progress.state = 'COMPLETE';
  progress.percent = 100;
  emit();

  // Autofocus captcha
  autofocusCaptcha(doc);

  return buildResult(progress, 'general', startedAt, workflow);
}

// ─── Captcha Autofocus ───

function autofocusCaptcha(doc: Document): void {
  try {
    const captchaSelectors = [
      'input[name*="captcha" i]',
      'input[placeholder*="captcha" i]',
      'input[formcontrolname*="captcha" i]',
      'input[id*="captcha" i]',
      'input[aria-label*="captcha" i]',
    ];
    for (const sel of captchaSelectors) {
      const el = doc.querySelector<HTMLInputElement>(sel);
      if (el && !el.disabled) {
        el.focus();
        return;
      }
    }
  } catch {
    // Silent — captcha focus is best-effort
  }
}

// ─── Srivari Seva Step Pipelines ───

/**
 * Execute Srivari Seva Instructions review step.
 * Strictly adheres to safety rules: NEVER auto-checks declaration.
 */
async function executeSrivariInstructionsStep(
  doc: Document,
  progress: AutofillProgress,
  emit: () => void,
  startedAt: number,
  workflow?: ServiceWorkflow,
): Promise<AutofillManagerResult> {
  progress.state = 'SRIVARI_INSTRUCTIONS';
  emit();

  const declaration = detectDeclarationCheckbox(doc);

  if (declaration.detected && declaration.element) {
    try {
      declaration.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      declaration.element.focus();
      declaration.element.style.outline = '2px solid #ff9800';
    } catch {}

    if (declaration.checked) {
      progress.state = 'COMPLETE';
      progress.percent = 100;
      emit();
      const res = buildResult(progress, 'srivari_instructions', startedAt, workflow);
      res.instructionsState = 'USER_CONFIRMED';
      res.actionRequired = false;
      res.actionMessage = 'Declaration confirmed by user. You may proceed to click Continue.';
      return res;
    } else {
      progress.state = 'USER_ACTION_REQUIRED';
      progress.percent = 50;
      emit();
      const res = buildResult(progress, 'srivari_instructions', startedAt, workflow);
      res.instructionsState = 'READY_FOR_USER_CONFIRMATION';
      res.actionRequired = true;
      res.success = false;
      res.needsAttention = true;
      res.actionMessage = 'Please review the Srivari Seva instructions and confirm the declaration checkbox to continue.';
      return res;
    }
  }

  progress.state = 'USER_ACTION_REQUIRED';
  progress.percent = 50;
  emit();
  const res = buildResult(progress, 'srivari_instructions', startedAt, workflow);
  res.instructionsState = 'NOT_REVIEWED';
  res.actionRequired = true;
  res.success = false;
  res.needsAttention = true;
  res.actionMessage = 'Please review the Srivari Seva instructions.';
  return res;
}

/**
 * Execute Srivari Seva Enrollment Step (Unified Profile).
 * Only fields with '*' in live DOM are required.
 * Optional fields (qualification, profession, mandal, etc.) never cause failure.
 * Fitness checkboxes are never auto-checked.
 */
async function executeSrivariEnrollmentStep(
  pilgrims: Pilgrim[],
  profile: Profile,
  doc: Document,
  progress: AutofillProgress,
  emit: () => void,
  startedAt: number,
  workflow?: ServiceWorkflow,
): Promise<AutofillManagerResult> {
  if (pilgrims.length === 0) {
    progress.state = 'ERROR';
    progress.errors.push('No devotee profile selected for Srivari Seva enrollment.');
    emit();
    return buildResult(progress, 'srivari_enrollment', startedAt, workflow);
  }

  const pilgrim = pilgrims[0];
  progress.state = 'SRIVARI_ENROLLMENT';
  progress.totalPilgrims = 1;
  progress.currentPilgrimIndex = 0;
  emit();

  const { sections, fields, requiredMap } = resolveSrivariEnrollmentFields(doc);

  const optionalFieldsSkipped: string[] = [];
  const optionalFieldsFilled: string[] = [];
  const results: FieldTransactionResult[] = [];
  let actionRequired = false;
  let actionMessage: string | undefined;

  // 1. Fitness section check: highlight controls, require user interaction, NEVER auto-check
  const mentallyFitRes = fields.get('mentallyFit');
  const physicallyFitRes = fields.get('physicallyFit');
  if (mentallyFitRes || physicallyFitRes) {
    let fitnessIncomplete = false;
    if (mentallyFitRes?.element) {
      const cb = mentallyFitRes.element as HTMLInputElement;
      if (!cb.checked) {
        fitnessIncomplete = true;
        try { cb.style.outline = '2px solid #ff9800'; } catch {}
      }
    }
    if (physicallyFitRes?.element) {
      const cb = physicallyFitRes.element as HTMLInputElement;
      if (!cb.checked) {
        fitnessIncomplete = true;
        try { cb.style.outline = '2px solid #ff9800'; } catch {}
      }
    }
    if (fitnessIncomplete) {
      actionRequired = true;
      actionMessage = 'Please affirm your fitness by reviewing and checking the Mentally Fit and Physically Fit checkboxes.';
    }
  }

  // Field values mapped from devotee & profile
  const fieldValues: Record<SrivariFieldType, string> = {
    idProofType: pilgrim.idType || 'Aadhaar',
    idProofNumber: pilgrim.idNumber || '',
    mobile: pilgrim.mobile || profile.general?.mobile || '',
    photo: pilgrim.photo || '',
    name: (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim(),
    fatherSpouseName: pilgrim.srivariSeva?.fatherSpouseName || '',
    dateOfBirth: pilgrim.dateOfBirth || '',
    age: pilgrim.age ? String(pilgrim.age) : (getEffectiveAge(pilgrim) ? String(getEffectiveAge(pilgrim)) : ''),
    gender: pilgrim.gender || 'Male',
    email: pilgrim.email || profile.general?.email || '',
    bloodGroup: pilgrim.srivariSeva?.bloodGroup || '',
    mentallyFit: '',
    physicallyFit: '',
    qualification: pilgrim.srivariSeva?.qualification || '',
    profession: pilgrim.srivariSeva?.profession || '',
    areaOfInterest: pilgrim.srivariSeva?.areaOfInterest || '',
    employeeId: pilgrim.srivariSeva?.employeeId || '',
    designation: pilgrim.srivariSeva?.designation || '',
    specialisation: pilgrim.srivariSeva?.specialisation || '',
    placeOfWork: pilgrim.srivariSeva?.placeOfWork || '',
    document: pilgrim.srivariSeva?.document || '',
    country: pilgrim.country || profile.general?.country || 'India',
    pincode: pilgrim.pinCode || profile.general?.pinCode || '',
    state: pilgrim.state || profile.general?.state || '',
    district: pilgrim.district || '',
    mandal: pilgrim.srivariSeva?.mandal || '',
    city: pilgrim.city || profile.general?.city || '',
    street: pilgrim.srivariSeva?.street || pilgrim.address || '',
    doorNumber: pilgrim.srivariSeva?.doorNumber || '',
  };

  const orderedFields: SrivariFieldType[] = [
    'idProofType',
    'idProofNumber',
    'mobile',
    'photo',
    'name',
    'fatherSpouseName',
    'dateOfBirth',
    'age',
    'gender',
    'email',
    'bloodGroup',
    'qualification',
    'profession',
    'areaOfInterest',
    'employeeId',
    'designation',
    'specialisation',
    'placeOfWork',
    'document',
    'country',
    'pincode',
    'state',
    'district',
    'mandal',
    'city',
    'street',
    'doorNumber',
  ];

  for (const fieldKey of orderedFields) {
    if (shouldStop) break;

    const label = getFieldLabel(fieldKey);
    progress.currentField = label;
    emit();

    const isRequired = requiredMap.get(fieldKey) ?? false;
    const res = fields.get(fieldKey);
    const value = fieldValues[fieldKey];

    if (bookingSessionManager.isUserModified(fieldKey, 0)) {
      results.push({
        field: fieldKey,
        pilgrimIndex: 0,
        status: 'verified',
        attempts: 0,
        durationMs: 0,
        maskedValue: value,
        detected: true,
        confidence: 100,
        strategy: 'userPreserved',
        filled: false,
        verified: true,
        reasons: ['Your manually entered value was preserved.'],
      });
      continue;
    }

    if (!res || !doc.contains(res.element)) {
      if (isRequired) {
        results.push({
          field: fieldKey,
          pilgrimIndex: 0,
          status: 'failed',
          attempts: 0,
          durationMs: 0,
          error: `${label} is required (*) but could not be detected on page`,
          detected: false,
          confidence: 0,
          strategy: 'none',
          filled: false,
          verified: false,
        });
      } else {
        optionalFieldsSkipped.push(fieldKey);
        results.push({
          field: fieldKey,
          pilgrimIndex: 0,
          status: 'skipped',
          attempts: 0,
          durationMs: 0,
          error: `${label} is optional and not present`,
          detected: false,
          confidence: 0,
          strategy: 'none',
          filled: false,
          verified: false,
        });
      }
      continue;
    }

    if (!value) {
      if (isRequired) {
        results.push({
          field: fieldKey,
          pilgrimIndex: 0,
          status: 'failed',
          attempts: 0,
          durationMs: 0,
          error: `${label} is required (*) but empty in profile`,
          detected: true,
          confidence: res.confidence,
          strategy: res.strategy,
          filled: false,
          verified: false,
        });
      } else {
        optionalFieldsSkipped.push(fieldKey);
        results.push({
          field: fieldKey,
          pilgrimIndex: 0,
          status: 'skipped',
          attempts: 0,
          durationMs: 0,
          error: `${label} is optional and empty in profile`,
          detected: true,
          confidence: res.confidence,
          strategy: res.strategy,
          filled: false,
          verified: false,
        });
      }
      continue;
    }

    // Handle photo & document file upload elements
    if (fieldKey === 'photo' || fieldKey === 'document') {
      const el = res.element as HTMLInputElement;
      let fileAttached = false;
      if (el.tagName === 'INPUT' && el.type === 'file' && value.startsWith('data:')) {
        try {
          const mime = value.split(';')[0].split(':')[1] || (fieldKey === 'photo' ? 'image/jpeg' : 'application/pdf');
          const bstr = atob(value.split(',')[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          const file = new File([u8arr], fieldKey === 'photo' ? 'photo.jpg' : 'document.pdf', { type: mime });
          const dt = new DataTransfer();
          dt.items.add(file);
          el.files = dt.files;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          fileAttached = el.files && el.files.length > 0;
        } catch {}
      }

      if (fileAttached || (el.files && el.files.length > 0)) {
        if (!isRequired) optionalFieldsFilled.push(fieldKey);
        results.push({
          field: fieldKey,
          pilgrimIndex: 0,
          status: 'verified',
          attempts: 1,
          durationMs: 30,
          maskedValue: 'Attached',
          detected: true,
          confidence: res.confidence,
          strategy: 'fileAttachment',
          filled: true,
          verified: true,
        });
      } else {
        // Highlighting for user action
        try { el.style.outline = '2px solid #ff9800'; } catch {}
        if (isRequired) {
          actionRequired = true;
          actionMessage = actionMessage || `Please select your ${label} file to upload.`;
          results.push({
            field: fieldKey,
            pilgrimIndex: 0,
            status: 'failed',
            attempts: 0,
            durationMs: 0,
            error: `${label} upload requires manual file selection`,
            detected: true,
            confidence: res.confidence,
            strategy: res.strategy,
            filled: false,
            verified: false,
          });
        } else {
          optionalFieldsSkipped.push(fieldKey);
          results.push({
            field: fieldKey,
            pilgrimIndex: 0,
            status: 'skipped',
            attempts: 0,
            durationMs: 0,
            error: `${label} upload skipped`,
            detected: true,
            confidence: res.confidence,
            strategy: res.strategy,
            filled: false,
            verified: false,
          });
        }
      }
      continue;
    }

    // Normal text or dropdown field
    const isDropdown =
      fieldKey === 'idProofType' ||
      fieldKey === 'gender' ||
      fieldKey === 'state' ||
      fieldKey === 'country' ||
      res.element.tagName === 'SELECT' ||
      res.element.tagName === 'MAT-SELECT' ||
      res.element.getAttribute('role') === 'combobox';

    const start = performance.now();
    const retryRes = await retryWithVerification({
      fieldType: fieldKey,
      element: res.element,
      expectedValue: value,
      container: doc.body || doc.documentElement,
      excludeElements: new Set(),
      doc,
      shouldStop: () => shouldStop,
      fillAction: async (el) => {
        if (isDropdown) {
          await performDropdownTransaction(el, value, fieldKey, doc);
        } else {
          await performTextTransaction(el as HTMLInputElement, value);
        }
      },
    });

    const isVerified = retryRes.success;
    if (isVerified) {
      if (!isRequired) optionalFieldsFilled.push(fieldKey);
    } else {
      if (!isRequired) optionalFieldsSkipped.push(fieldKey);
    }

    results.push({
      field: fieldKey,
      pilgrimIndex: 0,
      status: isVerified ? 'verified' : (isRequired ? 'failed' : 'skipped'),
      attempts: retryRes.attempts,
      durationMs: Math.round(performance.now() - start),
      maskedValue: fieldKey === 'mobile' ? `••••••${value.slice(-2)}` : (fieldKey === 'idProofNumber' ? `••••••••${value.slice(-4)}` : value),
      error: isVerified ? undefined : (isRequired ? (retryRes.error || `${label} verification failed`) : undefined),
      detected: true,
      confidence: res.confidence,
      strategy: res.strategy,
      filled: true,
      verified: isVerified,
    });
  }

  const pilgrimProgress: PilgrimProgress = {
    pilgrimIndex: 0,
    pilgrimName: pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || 'Devotee',
    fieldsTotal: results.length,
    fieldsVerified: results.filter(r => r.status === 'verified').length,
    fieldsFailed: results.filter(r => r.status === 'failed').length,
    results,
    status: results.filter(r => r.status === 'failed').length === 0 ? 'verified' : 'partial',
  };

  progress.pilgrimResults = [pilgrimProgress];
  progress.generalResults = results;
  if (actionRequired) {
    progress.state = 'USER_ACTION_REQUIRED';
    progress.percent = 95;
  } else {
    progress.state = 'COMPLETE';
    progress.percent = 100;
  }
  emit();

  const finalRes = buildResult(progress, 'srivari_enrollment', startedAt, workflow);
  finalRes.optionalFieldsSkipped = optionalFieldsSkipped;
  finalRes.optionalFieldsFilled = optionalFieldsFilled;
  if (actionRequired) {
    finalRes.actionRequired = true;
    finalRes.actionMessage = actionMessage;
    finalRes.success = false;
    finalRes.state = 'USER_ACTION_REQUIRED';
    finalRes.needsAttention = true;
  }
  return finalRes;
}

// ─── Repair Operations ───

async function repairSinglePilgrimField(
  pilgrim: Pilgrim,
  row: PilgrimRowContext,
  pilgrimIndex: number,
  field: PilgrimFieldType,
  doc: Document,
): Promise<FieldTransactionResult | null> {
  const container = row.element;
  const resolution = reResolveField(field, container, new Set(), doc);
  if (!resolution || !doc.contains(resolution.element)) {
    return null;
  }
  const el = resolution.element;

  switch (field) {
    case 'name': {
      const nameVal = (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim();
      if (!nameVal) return null;
      const res = await retryWithVerification({
        fieldType: 'name',
        element: el,
        expectedValue: nameVal,
        container,
        excludeElements: new Set(),
        doc,
        shouldStop: () => shouldStop,
        fillAction: async (target) => {
          await performTextTransaction(target as HTMLInputElement, nameVal);
        },
      });
      return {
        field: 'name',
        pilgrimIndex,
        status: res.success ? 'verified' : 'failed',
        attempts: res.attempts,
        durationMs: 50,
        maskedValue: nameVal,
        error: res.error,
        detected: true,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        filled: true,
        verified: res.success,
      };
    }
    case 'age': {
      const effectiveAge = getEffectiveAge(pilgrim);
      const ageStr = effectiveAge !== undefined ? String(effectiveAge) : '';
      if (!ageStr) return null;
      const res = await retryWithVerification({
        fieldType: 'age',
        element: el,
        expectedValue: ageStr,
        container,
        excludeElements: new Set(),
        doc,
        shouldStop: () => shouldStop,
        fillAction: async (target) => {
          await performTextTransaction(target as HTMLInputElement, ageStr);
        },
      });
      return {
        field: 'age',
        pilgrimIndex,
        status: res.success ? 'verified' : 'failed',
        attempts: res.attempts,
        durationMs: 50,
        maskedValue: ageStr,
        error: res.error,
        detected: true,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        filled: true,
        verified: res.success,
      };
    }
    case 'gender': {
      const genderStr = pilgrim.gender || 'Male';
      const res = await retryWithVerification({
        fieldType: 'gender',
        element: el,
        expectedValue: genderStr,
        container,
        excludeElements: new Set(),
        doc,
        shouldStop: () => shouldStop,
        fillAction: async (target) => {
          await performDropdownTransaction(target, genderStr, 'gender', doc);
        },
      });
      return {
        field: 'gender',
        pilgrimIndex,
        status: res.success ? 'verified' : 'failed',
        attempts: res.attempts,
        durationMs: 50,
        maskedValue: genderStr,
        error: res.error,
        detected: true,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        filled: true,
        verified: res.success,
      };
    }
    case 'photoIdProof': {
      const idType = pilgrim.idType || 'Aadhaar Card';
      const res = await retryWithVerification({
        fieldType: 'photoIdProof',
        element: el,
        expectedValue: idType,
        container,
        excludeElements: new Set(),
        doc,
        shouldStop: () => shouldStop,
        fillAction: async (target) => {
          await performDropdownTransaction(target, idType, 'photoIdProof', doc);
        },
      });
      return {
        field: 'photoIdProof',
        pilgrimIndex,
        status: res.success ? 'verified' : 'failed',
        attempts: res.attempts,
        durationMs: 50,
        maskedValue: idType,
        error: res.error,
        detected: true,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        filled: true,
        verified: res.success,
      };
    }
    case 'photoIdNumber': {
      let idNum = String(pilgrim.idNumber || '').trim();
      const isAadhaar = (pilgrim.idType || '').toLowerCase().includes('aadhaar') ||
        (pilgrim.idType || '').toLowerCase().includes('aadhar') ||
        idNum.replace(/\D/g, '').length === 12;
      if (isAadhaar) {
        idNum = idNum.replace(/\D/g, '').slice(0, 12);
      } else {
        idNum = idNum.replace(/\s+/g, '').replace(/-/g, '');
      }
      if (el instanceof HTMLInputElement && el.disabled) {
        await waitForCondition(() => !el.disabled, { timeoutMs: 1000, pollMs: 50 });
        if (el.disabled) return null;
      }
      const res = await retryWithVerification({
        fieldType: 'photoIdNumber',
        element: el,
        expectedValue: idNum,
        container,
        excludeElements: new Set(),
        doc,
        shouldStop: () => shouldStop,
        fillAction: async (target) => {
          await performTextTransaction(target as HTMLInputElement, idNum);
        },
      });
      return {
        field: 'photoIdNumber',
        pilgrimIndex,
        status: res.success ? 'verified' : 'failed',
        attempts: res.attempts,
        durationMs: 50,
        maskedValue: idNum.length >= 4 ? `••••${idNum.slice(-4)}` : '••••',
        error: res.error,
        detected: true,
        confidence: resolution.confidence,
        strategy: resolution.strategy,
        filled: true,
        verified: res.success,
      };
    }
    default:
      return null;
  }
}

async function repairFailedPilgrimFields(
  lockedRows: PilgrimRowContext[],
  pilgrims: Pilgrim[],
  progress: AutofillProgress,
  doc: Document,
  emit: () => void,
  targetFailedItems?: Array<{ pilgrimIndex?: number; field: string }>,
): Promise<void> {
  for (let i = 0; i < progress.pilgrimResults.length; i++) {
    if (shouldStop) break;
    const pp = progress.pilgrimResults[i];
    const failedResults = pp.results.filter(r => {
      if (r.status !== 'failed') return false;
      if (targetFailedItems && targetFailedItems.length > 0) {
        return targetFailedItems.some(tf => tf.pilgrimIndex === i && tf.field === r.field);
      }
      return true;
    });

    if (failedResults.length === 0) continue;

    const pilgrim = pilgrims[i];
    if (!pilgrim) continue;

    let row = lockedRows[i];
    if (!row || !isRowValidInDOM(row, doc)) {
      const redetected = reDetectRow(doc, pilgrims.length, i);
      if (redetected) {
        row = redetected;
        lockedRows[i] = row;
      } else {
        continue;
      }
    }

    for (const failedRes of failedResults) {
      if (shouldStop) break;
      const fieldKey = failedRes.field as PilgrimFieldType;
      progress.currentField = `Repairing Pilgrim ${i + 1}: ${getFieldLabel(fieldKey)}`;
      emit();

      const repaired = await repairSinglePilgrimField(pilgrim, row, i, fieldKey, doc);
      if (repaired && repaired.status === 'verified') {
        const idx = pp.results.findIndex(r => r.field === fieldKey);
        if (idx !== -1) {
          pp.results[idx] = {
            ...repaired,
            repaired: true,
          };
        }
      }
    }
  }
}

/**
 * Explicit repair function for only missing or failed fields.
 */
export async function repairFailedFields(opts: AutofillOptions = {}): Promise<AutofillManagerResult> {
  const doc = opts.doc ?? document;
  const startedAt = performance.now();
  const pilgrims = Array.isArray(opts.pilgrims) ? opts.pilgrims : [];

  if (isAutofillRunning()) {
    return {
      success: false,
      state: 'ERROR',
      step: 'unknown',
      pilgrimResults: [],
      generalResults: [],
      totalVerified: 0,
      totalFailed: 0,
      totalFields: 0,
      durationMs: 0,
      errors: ['Autofill already in progress. Wait for completion or press Stop.'],
      needsAttention: true,
      failedItems: [],
    };
  }

  isRunning = true;
  shouldStop = false;
  sessionStartTime = Date.now();

  const progress: AutofillProgress = {
    state: 'REPAIRING_FAILED',
    currentPilgrimIndex: 0,
    totalPilgrims: pilgrims.length,
    currentField: 'Starting repair...',
    pilgrimResults: [],
    generalResults: [],
    errors: [],
    startedAt,
    elapsedMs: 0,
    percent: 10,
  };

  const emit = () => {
    progress.elapsedMs = Math.round(performance.now() - startedAt);
    opts.onProgress?.({ ...progress });
  };

  try {
    const lockedRows = detectAndLockPilgrimRows(doc, pilgrims.length);

    for (let i = 0; i < pilgrims.length; i++) {
      const p = pilgrims[i];
      const targetItemsForPilgrim = (opts.targetFailedItems || []).filter(tf => tf.pilgrimIndex === i);
      progress.pilgrimResults.push({
        pilgrimIndex: i,
        pilgrimName: p.fullName || `Pilgrim ${i + 1}`,
        fieldsTotal: 5,
        fieldsVerified: 0,
        fieldsFailed: targetItemsForPilgrim.length,
        results: targetItemsForPilgrim.map(tf => ({
          field: tf.field,
          pilgrimIndex: i,
          status: 'failed' as FieldStatus,
          attempts: 0,
          durationMs: 0,
          error: 'Pending repair',
        })),
        status: 'partial',
      });
    }

    await repairFailedPilgrimFields(lockedRows, pilgrims, progress, doc, emit, opts.targetFailedItems);

    for (const pp of progress.pilgrimResults) {
      pp.fieldsVerified = pp.results.filter(r => r.status === 'verified').length;
      pp.fieldsFailed = pp.results.filter(r => r.status === 'failed').length;
      pp.status = pp.fieldsFailed === 0 && pp.fieldsVerified > 0 ? 'verified' : 'failed';
    }

    progress.state = 'COMPLETE';
    progress.percent = 100;
    emit();

    return buildResult(progress, 'pilgrim', startedAt);
  } catch (err) {
    progress.state = 'ERROR';
    progress.errors.push(err instanceof Error ? err.message : 'Unknown error during repair');
    return buildResult(progress, 'pilgrim', startedAt);
  } finally {
    isRunning = false;
    shouldStop = false;
    sessionStartTime = 0;
    bookingSessionManager.endSession();
  }
}

export const REQUIRED_GENERAL_FIELDS: GeneralFieldType[] = [
  'mobile',
  'city',
  'state',
  'country',
  'pinCode',
];

// ─── Result Builder ───

function buildResult(
  progress: AutofillProgress,
  step: 'pilgrim' | 'general' | 'unknown' | 'srivari_instructions' | 'srivari_enrollment',
  startedAt: number,
  workflow?: ServiceWorkflow,
  profiler?: PerformanceProfiler,
): AutofillManagerResult {
  const allPilgrimResults = progress.pilgrimResults.flatMap(p => p.results);
  const allResults = [...allPilgrimResults, ...progress.generalResults];

  const totalVerified = allResults.filter(r => r.status === 'verified').length;
  const totalFailed = allResults.filter(r => r.status === 'failed').length;

  if (step === 'srivari_instructions') {
    const isComplete = progress.state === 'COMPLETE';
    return {
      success: isComplete,
      state: isComplete ? 'COMPLETE' : (progress.state === 'USER_ACTION_REQUIRED' ? 'USER_ACTION_REQUIRED' : 'PARTIAL_SUCCESS'),
      step: 'srivari_instructions',
      pilgrimResults: progress.pilgrimResults,
      generalResults: progress.generalResults,
      totalVerified,
      totalFailed: isComplete ? 0 : 1,
      totalFields: 1,
      durationMs: Math.round(performance.now() - startedAt),
      errors: progress.errors,
      needsAttention: !isComplete,
      failedItems: [],
    };
  }

  if (step === 'srivari_enrollment') {
    const failedRequired = allResults.filter(r => r.status === 'failed');
    const isEnrollmentSuccess = failedRequired.length === 0 && progress.state !== 'USER_ACTION_REQUIRED';
    return {
      success: isEnrollmentSuccess,
      state: progress.state === 'USER_ACTION_REQUIRED' ? 'USER_ACTION_REQUIRED' : (isEnrollmentSuccess ? 'COMPLETE' : 'PARTIAL_SUCCESS'),
      step: 'srivari_enrollment',
      pilgrimResults: progress.pilgrimResults,
      generalResults: progress.generalResults,
      totalVerified,
      totalFailed: failedRequired.length,
      totalFields: allResults.length,
      durationMs: Math.round(performance.now() - startedAt),
      errors: failedRequired.map(f => f.error || `${f.field} failed to verify`),
      needsAttention: !isEnrollmentSuccess,
      failedItems: failedRequired.map(r => ({
        pilgrimIndex: r.pilgrimIndex,
        pilgrimName: r.pilgrimIndex !== undefined ? progress.pilgrimResults[r.pilgrimIndex]?.pilgrimName : undefined,
        field: r.field,
        fieldLabel: getFieldLabel(r.field),
        error: r.error || 'Could not verify',
      })),
      temporaryLock: progress.temporaryLock,
    };
  }

  const allPilgrimsFullyVerified = progress.pilgrimResults.length > 0 &&
    progress.pilgrimResults.every(p => p.status === 'verified');

  // General Step Integrity:
  // Dynamically consult workflow definition if available (e.g. Homam requires Gothram, excludes Mobile)
  const generalStep = workflow?.steps?.find(s => s.stepType === 'GENERAL_DETAILS');
  const requiredGeneralKeys: string[] = generalStep?.requiredFields || REQUIRED_GENERAL_FIELDS;

  const allRequiredGeneralVerified = requiredGeneralKeys.every(reqKey => {
    return progress.generalResults.some(r => r.field === reqKey && r.status === 'verified');
  });

  const hasFailedOrSkippedRequiredGeneral = requiredGeneralKeys.some(reqKey => {
    return progress.generalResults.some(r => r.field === reqKey && (r.status === 'failed' || r.status === 'skipped'));
  });

  const isGeneralSuccess = progress.state === 'COMPLETE' &&
    allRequiredGeneralVerified &&
    !hasFailedOrSkippedRequiredGeneral &&
    totalFailed === 0;

  const isSuccess = step === 'pilgrim'
    ? (progress.state === 'COMPLETE' && allPilgrimsFullyVerified && totalFailed === 0)
    : (step === 'general' ? isGeneralSuccess : false);

  const errors = [...progress.errors];
  if (!isSuccess && errors.length === 0) {
    const failedFields = allResults.filter(r => r.status === 'failed');
    const skippedRequired = progress.generalResults.filter(r => requiredGeneralKeys.includes(r.field) && r.status === 'skipped');
    if (failedFields.length > 0) {
      errors.push(...failedFields.map(f => f.error || `${f.field} failed to verify`));
    } else if (skippedRequired.length > 0) {
      errors.push(...skippedRequired.map(f => f.error || `Required field ${f.field} was skipped`));
    } else {
      errors.push('Some required fields could not be verified');
    }
  }

  const failedItems = allResults
    .filter(r => r.status === 'failed')
    .map(r => ({
      pilgrimIndex: r.pilgrimIndex,
      pilgrimName: r.pilgrimIndex !== undefined ? progress.pilgrimResults[r.pilgrimIndex]?.pilgrimName : undefined,
      field: r.field,
      fieldLabel: getFieldLabel(r.field),
      error: r.error || 'Could not verify',
    }));

  const isPartial = !isSuccess && totalVerified > 0 && totalFailed > 0;
  const finalState: AutofillState = progress.state === 'TTD_TEMPORARY_BOOKING_LOCK'
    ? 'TTD_TEMPORARY_BOOKING_LOCK'
    : (isPartial ? 'PARTIAL_SUCCESS' : progress.state);

  return {
    success: isSuccess,
    state: finalState,
    step,
    pilgrimResults: progress.pilgrimResults,
    generalResults: progress.generalResults,
    totalVerified,
    totalFailed,
    totalFields: allResults.length,
    durationMs: Math.round(performance.now() - startedAt),
    errors,
    needsAttention: !isSuccess && (totalFailed > 0 || progress.state === 'TTD_TEMPORARY_BOOKING_LOCK'),
    failedItems,
    temporaryLock: progress.temporaryLock,
    performanceMetrics: profiler ? profiler.finish(isSuccess) : undefined,
  };
}
