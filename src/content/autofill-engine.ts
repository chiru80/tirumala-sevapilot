// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Autofill Engine (Phase 3 Upgraded)
// Safe, Fast, and Manual execution modes with section pacing,
// non-blocking error recovery, and honest diagnostics
// ─────────────────────────────────────────────────

import {
  setNativeValue,
  dispatchAngularCompatibleEvents,
  triggerSelectChange,
  triggerRadioChange,
  setDateValue,
} from './dom-events';
import { resolveElement } from './form-scanner';
import { AngularFormObserver } from './angular-form-observer';
import type {
  Pilgrim,
  FieldMapping,
  FillResult,
  AutofillMode,
  PerformanceMetrics,
  FormSectionType,
} from '@shared/types';
import { calculateAge } from '@shared/utils';
import { FIELD_SECTION_MAP } from './field-mapping-engine';
import { FieldHighlighter } from './field-highlighter';
import logger from '@shared/logger';

export interface AutofillExecutionOptions {
  mode?: AutofillMode;
  overwrite?: boolean;
  onProgress?: (progress: {
    section: FormSectionType;
    completed: number;
    total: number;
    statusText: string;
  }) => void;
}

export interface AutofillSummaryReport {
  results: FillResult[];
  filledCount: number;
  conflictCount: number;
  failedCount: number;
  skippedCount: number;
  sections: Record<FormSectionType, { total: number; filled: number; failed: number }>;
  metrics: PerformanceMetrics;
  hasErrors: boolean;
}

/**
 * Fill form fields with pilgrim data according to the selected mode (Safe, Fast, Manual).
 */
export async function fillFields(
  pilgrims: Pilgrim[],
  mappings: FieldMapping[],
  doc: Document = document,
  options: AutofillExecutionOptions = { mode: 'safe', overwrite: true },
): Promise<FillResult[]> {
  const startTime = performance.now();
  const fillStartTime = performance.now();
  const results: FillResult[] = [];
  const mode = options.mode ?? 'safe';

  if (mode === 'manual') {
    // In manual mode, highlight detected fields on the page with legend
    FieldHighlighter.highlight(mappings, doc);
    logger.info('Manual mode: Highlighted fields on page. Awaiting user interaction.');
  }

  // Group mappings by form section for orderly filling and section reporting
  const sectionGroups: Record<FormSectionType, FieldMapping[]> = {
    personal: [],
    identity: [],
    contact: [],
    pilgrim: [],
    other: [],
  };

  for (const m of mappings) {
    const sec = m.pilgrimKey ? FIELD_SECTION_MAP[m.pilgrimKey] || 'other' : 'other';
    sectionGroups[sec].push(m);
  }

  const sectionsToProcess: FormSectionType[] = ['personal', 'identity', 'contact', 'pilgrim', 'other'];

  for (const sectionType of sectionsToProcess) {
    const sectionMappings = sectionGroups[sectionType];
    if (sectionMappings.length === 0) continue;

    options.onProgress?.({
      section: sectionType,
      completed: results.length,
      total: mappings.length,
      statusText: `Filling ${sectionType} details...`,
    });

    for (const mapping of sectionMappings) {
      if (!mapping.pilgrimKey) {
        results.push({
          field: mapping,
          status: 'skipped',
          error: 'No matching pilgrim field',
        });
        continue;
      }

      // Determine which pilgrim to use based on group index
      const pilgrimIndex = mapping.scannedField.groupIndex ?? 0;
      const pilgrim = pilgrims[pilgrimIndex];

      if (!pilgrim) {
        results.push({
          field: mapping,
          status: 'skipped',
          error: `No pilgrim data for group index ${pilgrimIndex}`,
        });
        continue;
      }

      const value = getPilgrimValue(pilgrim, mapping.pilgrimKey);
      if (value === undefined || value === null || value === '') {
        results.push({
          field: mapping,
          status: 'skipped',
          error: 'No value available in pilgrim data',
          suggestion: `Please enter ${mapping.pilgrimKey} manually`,
        });
        continue;
      }

      try {
        const result = await fillSingleField(mapping, String(value), doc, options.overwrite ?? true);
        results.push(result);
      } catch (err) {
        // Non-blocking error recovery: never abort whole process
        logger.error(`Error filling field ${mapping.pilgrimKey}:`, err);
        results.push({
          field: mapping,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown execution failure',
          suggestion: 'Field may be temporarily unavailable or protected by website validation.',
        });
      }
    }

    // In Safe Mode, apply subtle pacing between sections (80ms) for Angular/React reconciliation
    if (mode === 'safe') {
      await new Promise(r => setTimeout(r, 80));
    }
  }

  // Angular-Aware Verification phase
  const verifyStartTime = performance.now();
  const validationSummary = await AngularFormObserver.verifyForm(mappings, doc);

  for (const r of results) {
    if (r.status === 'filled') {
      const report = validationSummary.fields.find(
        f => f.fieldKey === r.field.pilgrimKey
      );

      if (report) {
        r.isAngularValid = report.isAngularValid;
        r.validationStatus = report.isAngularValid ? 'valid' : 'invalid';
        if (!report.isAngularValid) {
          r.validationMessage = report.errorMessage || 'Field marked invalid by Angular validators';
          // Attempt a single safe repair using dispatchAngularCompatibleEvents
          const val = r.newValue || '';
          if (val) {
            const repaired = await AngularFormObserver.repairField(r.field, val, doc);
            if (repaired) {
              r.isAngularValid = true;
              r.validationStatus = 'valid';
              r.validationMessage = undefined;
              logger.info(`Successfully repaired Angular validation state for field: ${r.field.pilgrimKey}`);
            }
          }
        }
      } else {
        r.validationStatus = 'unknown';
      }
    }
  }

  const verifyEndTime = performance.now();
  const fillEndTime = performance.now();
  const totalMs = Math.round(fillEndTime - startTime);

  const filled = results.filter(r => r.status === 'filled').length;
  const angularValidCount = results.filter(r => r.status === 'filled' && r.isAngularValid === true).length;
  const angularInvalidCount = results.filter(r => r.status === 'filled' && r.isAngularValid === false).length;
  const conflicts = results.filter(r => r.status === 'conflict').length;
  const failed = results.filter(r => r.status === 'failed').length;

  logger.info(
    `Autofill complete: ${filled} filled (${angularValidCount} Angular-valid, ${angularInvalidCount} invalid), ` +
    `${conflicts} conflicts, ${failed} failed in ${totalMs}ms`
  );

  return results;
}

/**
 * Helper to check if a value is an empty placeholder
 */
function isPlaceholder(val: string): boolean {
  if (!val) return true;
  const trimmed = val.trim().toLowerCase();
  if (trimmed === '' || trimmed === '--' || trimmed === 'none' || trimmed === 'null' || trimmed === 'undefined') return true;
  if (trimmed.startsWith('select') || trimmed.startsWith('choose') || trimmed.startsWith('--')) return true;
  return false;
}

/**
 * Compare two values for semantic equality on government forms
 */
function areValuesEquivalent(val1: string, val2: string, pilgrimKey?: string): boolean {
  const n1 = val1.trim().toLowerCase().replace(/[\s_-]/g, '');
  const n2 = val2.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (n1 === n2) return true;

  if (pilgrimKey === 'gender') {
    if ((n1 === 'm' || n1 === 'male') && (n2 === 'm' || n2 === 'male')) return true;
    if ((n1 === 'f' || n1 === 'female') && (n2 === 'f' || n2 === 'female')) return true;
  }

  if (pilgrimKey === 'idType') {
    if ((n1.includes('aadhaar') || n1.includes('aadhar')) && (n2.includes('aadhaar') || n2.includes('aadhar'))) return true;
    if (n1.includes('voter') && n2.includes('voter')) return true;
    if (n1.includes('passport') && n2.includes('passport')) return true;
    if (n1.includes('pan') && n2.includes('pan')) return true;
  }

  if (pilgrimKey === 'idNumber') {
    const d1 = val1.replace(/\D/g, '');
    const d2 = val2.replace(/\D/g, '');
    if (d1 && d2 && d1 === d2) return true;
  }

  return false;
}

/**
 * Fill a single form field with comprehensive diagnostics.
 */
async function fillSingleField(
  mapping: FieldMapping,
  value: string,
  doc: Document,
  overwrite: boolean,
): Promise<FillResult> {
  try {
    const element = resolveElement(mapping.scannedField.element, doc);
    if (!element) {
      return {
        field: mapping,
        status: 'failed',
        error: 'Element not found in DOM',
        suggestion: `The field "${mapping.pilgrimKey}" may have changed dynamically. Please enter manually.`,
      };
    }

    const currentValue = getCurrentFieldValue(element);
    const hasValue = currentValue && !isPlaceholder(currentValue);

    // If overwrite is false, check for genuine conflicts
    if (!overwrite && hasValue) {
      if (areValuesEquivalent(currentValue, value, mapping.pilgrimKey ?? undefined)) {
        return {
          field: mapping,
          status: 'filled',
          previousValue: currentValue,
          newValue: value,
        };
      }
      return {
        field: mapping,
        status: 'conflict',
        previousValue: currentValue,
        newValue: value,
        suggestion: `Field already contains "${currentValue}".`,
      };
    }

    // Fill field based on element type
    const fieldType = mapping.scannedField.type;

    switch (fieldType) {
      case 'text':
      case 'number':
      case 'email':
      case 'tel':
      case 'textarea': {
        const inputEl = element as HTMLInputElement | HTMLTextAreaElement;

        // If this field is gender or idType, it's a dropdown input component (like on TTD)
        if (mapping.pilgrimKey === 'gender' || mapping.pilgrimKey === 'idType') {
          const success = await triggerSelectChange(inputEl, value, doc);
          if (!success) {
            dispatchAngularCompatibleEvents(inputEl, value);
          }
        } else {
          dispatchAngularCompatibleEvents(inputEl, value);
        }
        break;
      }

      case 'date': {
        setDateValue(element as HTMLInputElement, value);
        break;
      }

      case 'select': {
        const success = await triggerSelectChange(element as HTMLElement, value, doc);
        if (!success) {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            dispatchAngularCompatibleEvents(element, value);
          } else {
            return {
              field: mapping,
              status: 'failed',
              error: `Could not find matching option for "${value}"`,
              suggestion: `Please select ${mapping.pilgrimKey} manually from the dropdown.`,
            };
          }
        }
        break;
      }

      case 'radio': {
        const name = (element as HTMLInputElement).name;
        if (name) {
          const success = triggerRadioChange(name, value, doc);
          if (!success) {
            return {
              field: mapping,
              status: 'failed',
              error: `Could not find matching radio option for "${value}"`,
              suggestion: `Please select ${mapping.pilgrimKey} manually.`,
            };
          }
        }
        break;
      }

      default: {
        return {
          field: mapping,
          status: 'manual',
          suggestion: `Field type "${fieldType}" requires manual devotee selection.`,
        };
      }
    }

    return {
      field: mapping,
      status: 'filled',
      previousValue: currentValue || undefined,
      newValue: value,
    };
  } catch (error) {
    return {
      field: mapping,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error during field entry',
      suggestion: `Please enter ${mapping.pilgrimKey} manually.`,
    };
  }
}

/** Get the current value from a form element */
function getCurrentFieldValue(element: Element): string {
  if (element instanceof HTMLSelectElement) {
    const selected = element.options[element.selectedIndex];
    if (!selected) return '';
    if (!selected.value || selected.value.trim() === '') return '';
    const text = (selected.textContent?.trim() ?? '').toLowerCase();
    if (text === 'select' || text.startsWith('select ') || text.startsWith('--') || text.startsWith('choose')) {
      return '';
    }
    return selected.textContent?.trim() || selected.value || '';
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? element.value : '';
    }
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  return '';
}

/** Get a value from a pilgrim object by key */
function getPilgrimValue(pilgrim: Pilgrim, key: keyof Pilgrim): string | number | undefined {
  if (key === 'age') {
    if (pilgrim.age !== undefined && pilgrim.age !== null && Number(pilgrim.age) > 0) {
      return pilgrim.age;
    }
    if (pilgrim.dateOfBirth) {
      const calculated = calculateAge(pilgrim.dateOfBirth);
      if (calculated > 0) return calculated;
    }
    return undefined;
  }
  const value = pilgrim[key];
  if (value === undefined || value === null) return undefined;
  if (key === 'idNumber') {
    const rawStr = String(value).trim();
    const digitsOnly = rawStr.replace(/\D/g, '');
    if (pilgrim.idType === 'Aadhaar' || digitsOnly.length === 12) {
      return digitsOnly.slice(0, 12);
    }
    return rawStr;
  }
  if (key === 'mobile') {
    return String(value).replace(/\D/g, '').slice(0, 10);
  }
  return value as string | number;
}
