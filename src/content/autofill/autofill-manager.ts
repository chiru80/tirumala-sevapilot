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
import { detectActiveBookingStep } from './page-workflow';
import { getWorkflowById, detectActiveWorkflow, resolveWorkflowWithConfidence } from '../../services/workflows/registry';
import { detectPageTicketLimit, detectDigitalQueue, detectPayment, detectReviewDetails } from '../../services/workflows/step-detectors';
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
    case 'photoIdProof': return 'Photo ID Proof';
    case 'photoIdNumber': return 'Photo ID Number';
    case 'email': return 'Email';
    case 'mobile': return 'Mobile';
    case 'city': return 'City';
    case 'state': return 'State';
    case 'country': return 'Country';
    case 'pincode':
    case 'pinCode': return 'PIN Code';
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

  try {
    // ─── DETECT_STEP ───
    progress.state = 'DETECT_STEP';
    emit();

    const url = (opts as any).url || doc.location?.href || '';

    // Phase 3: Service-Specific Workflow Engine
    let workflow: ServiceWorkflow | undefined = (opts as any).workflow;
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

    // CAPTCHA safety boundary (Phase 6 Section 26)
    const captchaDetected = doc.querySelector('#captcha-container, .captcha-container, img[src*="captcha" i], input[placeholder*="captcha" i], .g-recaptcha, .cf-turnstile');
    if (captchaDetected) {
      progress.state = 'ERROR';
      progress.errors.push('CAPTCHA detected. Complete it manually.');
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

    const bookingStep = detectActiveBookingStep(doc);
    const step: 'pilgrim' | 'general' | 'unknown' =
      bookingStep === 'PILGRIM_DETAILS' ? 'pilgrim'
        : bookingStep === 'GENERAL_DETAILS' ? 'general'
          : 'unknown';

    logger.info(`Detected booking step: ${step} (raw: ${bookingStep})`);

    if (step === 'unknown') {
      progress.state = 'ERROR';
      progress.errors.push('Pilgrim fields could not be safely identified.');
      emit();
      return buildResult(progress, step, startedAt);
    }

    // Phase 3 Section 3 & 4: If service has NO General Details step (e.g. Padmavathi ₹200),
    // NEVER attempt or force general details autofill!
    if (step === 'general' && workflow && !workflow.hasGeneralDetailsStep) {
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
    progress.state = 'ERROR';
    progress.errors.push(err instanceof Error ? err.message : 'Unknown error');
    return buildResult(progress, 'unknown', startedAt);
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
  const maxAllowed = workflow?.maxPilgrims ?? adapter?.maxPilgrims ?? 6;

  // Max pilgrim safety (Section 21): block before fill if user selects too many or wrong count
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

  const lockedRows = detectAndLockPilgrimRows(doc, targetPilgrims.length);
  logger.info(`Locked ${lockedRows.length} row(s) for ${targetPilgrims.length} pilgrim(s) (limit: ${maxAllowed})`);

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
    await waitForCondition(() => !idNumEl.disabled, { timeoutMs: 1200, pollMs: 50 });

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
  step: 'pilgrim' | 'general' | 'unknown',
  startedAt: number,
  workflow?: ServiceWorkflow,
): AutofillManagerResult {
  const allPilgrimResults = progress.pilgrimResults.flatMap(p => p.results);
  const allResults = [...allPilgrimResults, ...progress.generalResults];

  const totalVerified = allResults.filter(r => r.status === 'verified').length;
  const totalFailed = allResults.filter(r => r.status === 'failed').length;

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
  const finalState: AutofillState = isPartial ? 'PARTIAL_SUCCESS' : progress.state;

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
    needsAttention: !isSuccess && totalFailed > 0,
    failedItems,
  };
}
