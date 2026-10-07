// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Autofill Execution Plan (Phase 3)
// Precomputed, dependency-aware plan resolving all pilgrim rows
// in a single pass. Separates independent vs dependent field actions.
// ─────────────────────────────────────────────────

import type { PilgrimRowContext } from './row-detector';
import type { PrewarmedBookingPlan, PrewarmedPilgrimData } from './profile-prewarm';
import type { PilgrimFieldType, GeneralFieldType } from './types';
import { resolvePilgrimFields, resolveGeneralFields, type FieldResolution } from './field-resolver';
import { verifyTextValue, verifyDropdownSelection } from './verification';
import { DomSnapshot } from './dom-snapshot';
import logger from '@shared/logger';

export interface PlannedFieldAction {
  field: string;
  pilgrimIndex?: number;
  element: HTMLElement;
  expectedValue: string;
  isDropdown: boolean;
  isAlreadySatisfied: boolean;
  confidence: number;
  strategy: string;
}

export interface PlannedRow {
  index: number;
  rowContext: PilgrimRowContext;
  pilgrimData: PrewarmedPilgrimData;
  independentActions: PlannedFieldAction[];
  idProofAction?: PlannedFieldAction;
  idNumberAction?: PlannedFieldAction;
}

export interface AutofillExecutionPlan {
  serviceId?: string;
  workflowId?: string;
  rows: PlannedRow[];
  generalActions: PlannedFieldAction[];
  totalFieldsCount: number;
  satisfiedFieldsCount: number;
  timestamp: number;
}

/**
 * Checks if a field currently in the DOM already matches the expected value.
 */
export function isFieldSatisfied(element: HTMLElement, expectedValue: string, field: string, isDropdown: boolean): boolean {
  if (!element || !expectedValue) return false;
  try {
    if (isDropdown) {
      const doc = element.ownerDocument || document;
      const res = verifyDropdownSelection(element, expectedValue, field, doc);
      return res.status === 'verified';
    } else {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const res = verifyTextValue(element, expectedValue, field);
        return res.status === 'verified';
      }
    }
  } catch (e) {
    logger.debug(`Error checking differential equality for ${field}:`, e);
  }
  return false;
}

/**
 * Build a complete execution plan across all locked pilgrim rows in ONE pass.
 */
export function buildExecutionPlan(
  lockedRows: PilgrimRowContext[],
  prewarmed: PrewarmedBookingPlan,
  doc: Document = document,
  workflowId?: string,
): AutofillExecutionPlan {
  const rows: PlannedRow[] = [];
  let totalFieldsCount = 0;
  let satisfiedFieldsCount = 0;

  const count = Math.min(lockedRows.length, prewarmed.pilgrims.length);

  for (let i = 0; i < count; i++) {
    const rowCtx = lockedRows[i];
    const pilgrim = prewarmed.pilgrims[i];
    const independentActions: PlannedFieldAction[] = [];
    let idProofAction: PlannedFieldAction | undefined;
    let idNumberAction: PlannedFieldAction | undefined;

    // Use fast DOM snapshot for the row
    DomSnapshot.takeSnapshot(rowCtx.element);

    // Resolve all 5 pilgrim fields in this row
    const resolutions = resolvePilgrimFields(rowCtx.element, doc);

    // Helper to find resolution
    const getRes = (type: PilgrimFieldType): FieldResolution | undefined => {
      const res = resolutions.get(type);
      if (res && doc.contains(res.element)) return res;
      const locked = rowCtx.fieldResolutions.get(type);
      if (locked && doc.contains(locked.element)) return locked;
      return undefined;
    };

    // 1. Name
    const nameRes = getRes('name');
    if (nameRes && pilgrim.fullName) {
      totalFieldsCount++;
      const isSatisfied = isFieldSatisfied(nameRes.element, pilgrim.fullName, 'name', false);
      if (isSatisfied) satisfiedFieldsCount++;
      independentActions.push({
        field: 'name',
        pilgrimIndex: i,
        element: nameRes.element,
        expectedValue: pilgrim.fullName,
        isDropdown: false,
        isAlreadySatisfied: isSatisfied,
        confidence: nameRes.confidence,
        strategy: nameRes.strategy,
      });
    }

    // 2. Age
    const ageRes = getRes('age');
    if (ageRes && pilgrim.ageStr) {
      totalFieldsCount++;
      const isSatisfied = isFieldSatisfied(ageRes.element, pilgrim.ageStr, 'age', false);
      if (isSatisfied) satisfiedFieldsCount++;
      independentActions.push({
        field: 'age',
        pilgrimIndex: i,
        element: ageRes.element,
        expectedValue: pilgrim.ageStr,
        isDropdown: false,
        isAlreadySatisfied: isSatisfied,
        confidence: ageRes.confidence,
        strategy: ageRes.strategy,
      });
    }

    // 3. Gender
    const genderRes = getRes('gender');
    if (genderRes && pilgrim.gender) {
      totalFieldsCount++;
      const isDropdown = genderRes.element.tagName.toLowerCase() !== 'input' || genderRes.element.getAttribute('type') !== 'text';
      const isSatisfied = isFieldSatisfied(genderRes.element, pilgrim.gender, 'gender', isDropdown);
      if (isSatisfied) satisfiedFieldsCount++;
      independentActions.push({
        field: 'gender',
        pilgrimIndex: i,
        element: genderRes.element,
        expectedValue: pilgrim.gender,
        isDropdown,
        isAlreadySatisfied: isSatisfied,
        confidence: genderRes.confidence,
        strategy: genderRes.strategy,
      });
    }

    // 4. Photo ID Proof (Dropdown)
    const idProofRes = getRes('photoIdProof');
    if (idProofRes && pilgrim.idType) {
      totalFieldsCount++;
      const isSatisfied = isFieldSatisfied(idProofRes.element, pilgrim.idType, 'photoIdProof', true);
      if (isSatisfied) satisfiedFieldsCount++;
      idProofAction = {
        field: 'photoIdProof',
        pilgrimIndex: i,
        element: idProofRes.element,
        expectedValue: pilgrim.idType,
        isDropdown: true,
        isAlreadySatisfied: isSatisfied,
        confidence: idProofRes.confidence,
        strategy: idProofRes.strategy,
      };
    }

    // 5. Photo ID Number (Dependent input)
    const idNumRes = getRes('photoIdNumber');
    if (idNumRes && pilgrim.idNumber) {
      totalFieldsCount++;
      const isSatisfied = isFieldSatisfied(idNumRes.element, pilgrim.idNumber, 'photoIdNumber', false);
      if (isSatisfied) satisfiedFieldsCount++;
      idNumberAction = {
        field: 'photoIdNumber',
        pilgrimIndex: i,
        element: idNumRes.element,
        expectedValue: pilgrim.idNumber,
        isDropdown: false,
        isAlreadySatisfied: isSatisfied,
        confidence: idNumRes.confidence,
        strategy: idNumRes.strategy,
      };
    }

    rows.push({
      index: i,
      rowContext: rowCtx,
      pilgrimData: pilgrim,
      independentActions,
      idProofAction,
      idNumberAction,
    });
  }

  // General Details actions (if applicable)
  const generalActions: PlannedFieldAction[] = [];
  if (prewarmed.hasGeneralDetailsStep) {
    const genResolutions = resolveGeneralFields(doc);

    const genPairs: Array<{ field: GeneralFieldType; val: string; isDropdown: boolean }> = [
      { field: 'email', val: prewarmed.general.email, isDropdown: false },
      { field: 'mobile', val: prewarmed.general.mobile, isDropdown: false },
      { field: 'city', val: prewarmed.general.city, isDropdown: false },
      { field: 'state', val: prewarmed.general.state, isDropdown: true },
      { field: 'country', val: prewarmed.general.country, isDropdown: true },
      { field: 'pinCode', val: prewarmed.general.pinCode, isDropdown: false },
      { field: 'gothram', val: prewarmed.general.gothram, isDropdown: false },
    ];

    for (const pair of genPairs) {
      if (!pair.val) continue;
      const res = genResolutions.get(pair.field);
      if (res && doc.contains(res.element)) {
        totalFieldsCount++;
        const isSatisfied = isFieldSatisfied(res.element, pair.val, pair.field, pair.isDropdown);
        if (isSatisfied) satisfiedFieldsCount++;
        generalActions.push({
          field: pair.field,
          element: res.element,
          expectedValue: pair.val,
          isDropdown: pair.isDropdown,
          isAlreadySatisfied: isSatisfied,
          confidence: res.confidence,
          strategy: res.strategy,
        });
      }
    }
  }

  return {
    serviceId: prewarmed.serviceId,
    workflowId,
    rows,
    generalActions,
    totalFieldsCount,
    satisfiedFieldsCount,
    timestamp: Date.now(),
  };
}
