// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Angular Form Validation Observer
// Inspects live Angular state (ng-valid, ng-invalid, mat-form-field-invalid, mat-error)
// to verify visible DOM value equals application FormControl value
// ─────────────────────────────────────────────────

import type { FieldMapping } from '@shared/types';
import { dispatchAngularCompatibleEvents } from './dom-events';
import { resolveElement } from './form-scanner';
import logger from '@shared/logger';

export interface FieldAngularValidationReport {
  fieldKey: string;
  label: string;
  maskedValue: string;
  isAngularValid: boolean;
  isTouched: boolean;
  isDirty: boolean;
  hasMatError: boolean;
  errorMessage?: string;
}

export interface FormValidationSummary {
  allValid: boolean;
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  fields: FieldAngularValidationReport[];
  failingFieldNames: string[];
}

export class AngularFormObserver {
  /**
   * Inspect all filled fields in the DOM for real Angular validation status.
   * Checks ng-valid/ng-invalid classes, mat-form-field-invalid, aria-invalid, and mat-error messages.
   */
  public static async verifyForm(
    mappings: FieldMapping[],
    doc: Document = document,
  ): Promise<FormValidationSummary> {
    // Wait briefly for Angular change detection / validator pipeline to settle
    await new Promise(r => setTimeout(r, 120));

    const reports: FieldAngularValidationReport[] = [];
    const failingNames: string[] = [];

    for (const mapping of mappings) {
      if (!mapping.pilgrimKey) continue;

      const element = resolveElement(mapping.scannedField.element, doc);
      const label = mapping.scannedField.label || mapping.pilgrimKey;

      if (!element) {
        reports.push({
          fieldKey: mapping.pilgrimKey,
          label,
          maskedValue: 'N/A',
          isAngularValid: false,
          isTouched: false,
          isDirty: false,
          hasMatError: false,
          errorMessage: 'Element no longer in DOM',
        });
        failingNames.push(label);
        continue;
      }

      // Check classes on element and parent mat-form-field
      const elClasses = Array.from(element.classList);
      const matFormField = element.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group');
      const containerClasses = matFormField ? Array.from(matFormField.classList) : [];

      const isNgValid = elClasses.includes('ng-valid') || (!elClasses.includes('ng-invalid') && !containerClasses.some(c => c.includes('invalid')));
      const isNgInvalid = elClasses.includes('ng-invalid') || containerClasses.some(c => c.includes('invalid'));
      const isTouched = elClasses.includes('ng-touched') || containerClasses.includes('ng-touched');
      const isDirty = elClasses.includes('ng-dirty') || containerClasses.includes('ng-dirty');
      const isAriaInvalid = element.getAttribute('aria-invalid') === 'true';

      // Check for visible mat-error elements
      let hasMatError = false;
      let errorMsg: string | undefined = undefined;

      if (matFormField) {
        const errorEl = matFormField.querySelector('mat-error, .mat-mdc-form-field-error, .error-message, .text-danger');
        if (errorEl && errorEl.textContent?.trim()) {
          hasMatError = true;
          errorMsg = errorEl.textContent.trim();
        }
      }

      // Get current DOM value and mask if sensitive
      const rawValue = (element as HTMLInputElement).value || element.textContent?.trim() || '';
      const maskedValue = this.maskValue(mapping.pilgrimKey, rawValue);

      // Determine true valid state
      const isFieldValid = !isNgInvalid && !isAriaInvalid && !hasMatError && rawValue.length > 0;

      if (!isFieldValid) {
        failingNames.push(label);
      }

      reports.push({
        fieldKey: mapping.pilgrimKey,
        label,
        maskedValue,
        isAngularValid: isFieldValid,
        isTouched,
        isDirty,
        hasMatError,
        errorMessage: errorMsg,
      });
    }

    const validCount = reports.filter(r => r.isAngularValid).length;
    const invalidCount = reports.length - validCount;

    logger.debug(`Angular Form Observer: ${validCount}/${reports.length} fields valid by Angular.`);

    return {
      allValid: invalidCount === 0,
      totalChecked: reports.length,
      validCount,
      invalidCount,
      fields: reports,
      failingFieldNames: failingNames,
    };
  }

  /**
   * Attempt to repair an invalid field by re-focusing, re-applying the native value, and re-triggering Angular events.
   */
  public static async repairField(
    mapping: FieldMapping,
    value: string,
    doc: Document = document,
  ): Promise<boolean> {
    const element = resolveElement(mapping.scannedField.element, doc);
    if (!element) return false;

    dispatchAngularCompatibleEvents(element, value);
    await new Promise(r => setTimeout(r, 80));

    const check = await this.verifyForm([mapping], doc);
    return check.allValid;
  }

  /**
   * Mask sensitive devotee values (Aadhaar, Phone) for privacy
   */
  public static maskValue(key: string, value: string): string {
    if (!value) return '';
    if (key === 'idNumber') {
      const clean = value.replace(/\D/g, '');
      if (clean.length === 12) {
        return `********${clean.slice(-4)}`;
      }
      return '********';
    }
    if (key === 'mobile') {
      const clean = value.replace(/\D/g, '');
      if (clean.length === 10) {
        return `******${clean.slice(-4)}`;
      }
      return '******';
    }
    return value;
  }
}
