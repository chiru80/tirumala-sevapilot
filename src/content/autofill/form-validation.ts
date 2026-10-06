// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Form Validation State Engine (Phase 6)
// Inspects native attributes, Angular Material validation classes,
// and visible error messages (e.g. mat-error, .invalid-feedback).
// ─────────────────────────────────────────────────────────────

import { isElementVisible } from './field-resolver';

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormValidationState {
  valid: boolean;
  errors: FormFieldError[];
}

/**
 * Checks whether an element or its containing form field has visible validation errors.
 */
export function inspectElementValidation(
  element: HTMLElement,
  fieldKey: string
): { hasError: boolean; errorMessage?: string } {
  if (!element) {
    return { hasError: true, errorMessage: 'Element does not exist' };
  }

  // 1. Check native HTML validity
  if ('validity' in element) {
    const input = element as HTMLInputElement;
    if (input.validity && !input.validity.valid) {
      return {
        hasError: true,
        errorMessage: input.validationMessage || 'Invalid input format',
      };
    }
  }

  // 2. Angular Material validation indicators
  // .ng-invalid, .mat-form-field-invalid, .mat-mdc-form-field-error
  const parentFormField = element.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .field-wrap');
  if (parentFormField) {
    const isNgInvalid = element.classList.contains('ng-invalid') || parentFormField.classList.contains('ng-invalid');

    // Look for visible error text
    const errorEl = parentFormField.querySelector(
      'mat-error, .mat-mdc-form-field-error, .invalid-feedback, .error-message, [role="alert"]'
    );

    if (errorEl && isElementVisible(errorEl as HTMLElement)) {
      const msg = (errorEl.textContent || '').trim();
      if (msg) {
        return { hasError: true, errorMessage: msg };
      }
    }

    // If marked ng-invalid and touched/dirty
    const isTouched = element.classList.contains('ng-touched') || element.classList.contains('ng-dirty');
    if (isNgInvalid && isTouched) {
      return { hasError: true, errorMessage: 'Field marked invalid by Angular validator' };
    }
  }

  return { hasError: false };
}

/**
 * Inspects the entire form or container for visible validation errors.
 */
export function inspectFormValidation(container: HTMLElement = document.body): FormValidationState {
  const errors: FormFieldError[] = [];

  const errorNodes = container.querySelectorAll(
    'mat-error, .invalid-feedback, .error-message, [role="alert"], .mat-mdc-form-field-error'
  );

  for (let i = 0; i < errorNodes.length; i++) {
    const node = errorNodes[i] as HTMLElement;
    if (isElementVisible(node)) {
      const msg = (node.textContent || '').trim();
      if (msg) {
        // Try to identify associated field
        const parentField = node.closest('mat-form-field, .form-group, tr, .pilgrim-row');
        const input = parentField?.querySelector('input, select, mat-select');
        const fieldName = input?.getAttribute('name') || input?.getAttribute('formcontrolname') || input?.id || 'unknown';
        errors.push({ field: fieldName, message: msg });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
