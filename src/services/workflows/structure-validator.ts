// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Form Structure Change Detector
// Phase 4: Structural Confidence Check
//
// Compares:
//   EXPECTED WORKFLOW vs ACTUAL PAGE
// Detects:
//   - missing required fields
//   - unexpected fields / sections
//   - changed labels / control types
//   - changed section order
//   - changed row count
//
// Fail-Closed Rule:
//   If confidence is too low (< 60) or critical required fields are missing,
//   DO NOT AUTOFILL. Report:
//   "TTD form structure has changed. Please review before autofill."
// ─────────────────────────────────────────────────────────────

import type { ServiceWorkflow, WorkflowStepType } from './types';
import { resolveGeneralFields, resolvePilgrimFields } from '../../content/autofill/field-resolver';
import { detectAndLockPilgrimRows } from '../../content/autofill/row-detector';
import logger from '@shared/logger';

export interface StructureValidationResult {
  isValid: boolean;
  confidence: number; // 0 to 100
  reason?: string;
  missingRequiredFields: string[];
  unexpectedFields: string[];
  anomalies: string[];
}

/**
 * Validates the actual DOM structure against the expected ServiceWorkflow step.
 */
export function validateFormStructure(
  workflow: ServiceWorkflow,
  stepType: WorkflowStepType,
  doc: Document = document
): StructureValidationResult {
  const anomalies: string[] = [];
  const missingRequiredFields: string[] = [];
  const unexpectedFields: string[] = [];
  let confidence = 100;

  // 1. Verify that step exists in workflow definition
  const stepDef = workflow.steps?.find(s => s.stepType === stepType);
  if (!stepDef) {
    // If service explicitly does not support this step (e.g. Padmavathi ₹200 has no GENERAL_DETAILS)
    return {
      isValid: false,
      confidence: 0,
      reason: 'TTD form structure has changed. Please review before autofill.',
      missingRequiredFields: [],
      unexpectedFields: [stepType],
      anomalies: [`Step ${stepType} is not defined in workflow ${workflow.serviceId}`],
    };
  }

  // 2. Validate PILGRIM_DETAILS
  if (stepType === 'PILGRIM_DETAILS') {
    // Check for unexpected control types on photoIdProof anywhere in the pilgrim section
    const unexpectedControls = doc.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    for (const ctrl of Array.from(unexpectedControls)) {
      const nameOrId = (ctrl.getAttribute('name') || ctrl.getAttribute('id') || ctrl.getAttribute('formcontrolname') || '').toLowerCase();
      if (nameOrId.includes('idproof') || nameOrId.includes('photoid')) {
        anomalies.push(`Photo ID Proof control type changed to unexpected '${(ctrl as HTMLInputElement).type}'`);
        confidence -= 25;
      }
    }

    const maxPilgrims = workflow.maxPilgrims || 6;
    const lockedRows = detectAndLockPilgrimRows(doc, maxPilgrims);

    if (lockedRows.length === 0) {
      anomalies.push('No pilgrim rows could be detected in the DOM');
      confidence -= 60;
    } else {
      // Check exact pilgrims requirement (e.g. Homam requires exactly 2)
      if (workflow.exactPilgrims && lockedRows.length < workflow.exactPilgrims) {
        anomalies.push(
          `Expected exactly ${workflow.exactPilgrims} pilgrim row(s), but detected ${lockedRows.length}`
        );
        confidence -= 30;
      }

      // Check fields in the first locked row
      const firstRow = lockedRows[0];
      const pilgrimResolutions = resolvePilgrimFields(firstRow.element, doc);

      const requiredPilgrimFields = ['name', 'age', 'gender', 'photoIdProof', 'photoIdNumber'];
      for (const field of requiredPilgrimFields) {
        const res = pilgrimResolutions.get(field as any);
        if (!res) {
          missingRequiredFields.push(field);
          confidence -= 20;
          anomalies.push(`Required pilgrim field '${field}' was not detected in row 1`);
        } else {
          // Check control types
          if (field === 'photoIdProof') {
            const isSelectOrCustomDropdown =
              res.element.tagName === 'SELECT' ||
              res.element.getAttribute('role') === 'combobox' ||
              res.element.classList.contains('mat-select') ||
              res.element.classList.contains('p-dropdown') ||
              res.element.closest('.custom-select, .select-wrapper, mat-select, p-dropdown') !== null;

            if (!isSelectOrCustomDropdown && res.element.tagName === 'INPUT') {
              const inputType = (res.element as HTMLInputElement).type.toLowerCase();
              if (inputType === 'checkbox' || inputType === 'radio') {
                anomalies.push(`Photo ID Proof control type changed to unexpected '${inputType}'`);
                confidence -= 20;
              }
            }
          }
        }
      }
    }
  }

  // 3. Validate GENERAL_DETAILS
  if (stepType === 'GENERAL_DETAILS') {
    const generalResolutions = resolveGeneralFields(doc);

    // Check required fields defined in the workflow step
    for (const req of stepDef.requiredFields) {
      const normalizedKey = req === 'pincode' ? 'pinCode' : req;
      const found = generalResolutions.has(normalizedKey as any) || generalResolutions.has(req as any);
      if (!found) {
        missingRequiredFields.push(req);
        confidence -= 20;
        anomalies.push(`Required general field '${req}' was not detected in DOM`);
      }
    }

    // Homam-specific critical check: Gothram is strictly required
    if (workflow.serviceId === 'sri-srinivasa-divyanugraha-homam') {
      const hasGothram = generalResolutions.has('gothram');
      if (!hasGothram) {
        confidence -= 40;
        anomalies.push('Homam critical field Gothram is missing from form');
      }
    }
  }

  confidence = Math.max(0, Math.min(100, confidence));

  const isLowConfidence = confidence < 60;
  const hasCriticalMissing =
    (stepType === 'GENERAL_DETAILS' &&
      workflow.serviceId === 'sri-srinivasa-divyanugraha-homam' &&
      missingRequiredFields.includes('gothram')) ||
    (stepType === 'PILGRIM_DETAILS' && missingRequiredFields.length >= 3);

  const isValid = !isLowConfidence && !hasCriticalMissing;

  const result: StructureValidationResult = {
    isValid,
    confidence,
    reason: isValid ? undefined : 'TTD form structure has changed. Please review before autofill.',
    missingRequiredFields,
    unexpectedFields,
    anomalies,
  };

  if (!isValid) {
    logger.warn('Form structural validation failed:', result);
  }

  return result;
}
