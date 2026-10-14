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
 * Determines whether a DOM element is a genuine validation error message,
 * rather than a required-field asterisk, label, or decorative indicator.
 */
export function isGenuineErrorMessageElement(el: HTMLElement): boolean {
  if (!el) return false;

  // Ignore if element is a label or inside a label / placeholder / prefix / suffix
  if (el.closest('label, mat-label, .mat-form-field-label, .form-label, legend, [matPrefix], [matSuffix], .mat-select-placeholder, .mat-placeholder')) {
    return false;
  }

  if (['LABEL', 'MAT-LABEL', 'LEGEND'].includes(el.tagName)) {
    return false;
  }

  const text = (el.textContent || '').trim();

  // Asterisks, colons, bullets, and pure punctuation are required field indicators, not error messages
  if (!text || /^[\s*#:•\-_]+$/.test(text)) {
    return false;
  }

  // Legitimate validation errors always contain natural language words (e.g. "Name cannot be empty", "Please enter the age")
  if (!/[a-zA-Z]/.test(text)) {
    return false;
  }

  return true;
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

  // 1. Check Angular Material validation indicators & visible errors first
  // Only search inside the specific column/field container to prevent cross-field false alarms
  const parentFormField = element.closest(
    'mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .field-wrap, .field, [class*="col-"]'
  ) || element.parentElement;

  if (parentFormField) {
    // Look for visible error text
    const errorEls = parentFormField.querySelectorAll(
      'mat-error, .mat-mdc-form-field-error, .invalid-feedback, .error-message, [role="alert"], .text-danger, .has-error'
    );

    for (const errorEl of Array.from(errorEls)) {
      const el = errorEl as HTMLElement;
      if (isGenuineErrorMessageElement(el) && isElementVisible(el)) {
        const msg = (el.textContent || '').trim();
        if (msg) {
          return { hasError: true, errorMessage: msg };
        }
      }
    }
  }

  // 2. Check native HTML validity
  if ('validity' in element) {
    const input = element as HTMLInputElement;
    if (input.validity && !input.validity.valid) {
      // If required field is completely empty, that is always a real failure
      if (input.validity.valueMissing) {
        return {
          hasError: true,
          errorMessage: input.validationMessage || 'Field is required',
        };
      }

      // Check whether native browser validation is suppressed (novalidate) or overridden by SPA frameworks (Angular / React)
      const form = input.form || element.closest('form');
      const isSpaOrNovalidate =
        form?.noValidate ||
        form?.hasAttribute('novalidate') ||
        !!element.closest('[ng-version], mat-form-field, .mat-mdc-form-field, [formcontrolname], [data-angular], .pilgrim-row, .pilgrim-details') ||
        (element.ownerDocument?.defaultView?.location?.hostname.includes('ttdevasthanams') ?? false);

      // On SPA / Angular / novalidate forms (like TTD portal), native patternMismatch is ignored by the app
      // unless an actual visible error element exists on the page.
      if (!isSpaOrNovalidate) {
        return {
          hasError: true,
          errorMessage: input.validationMessage || 'Invalid input format',
        };
      }
    }
  }

  // 3. Angular validation classes with visible error confirmation
  if (parentFormField) {
    const isNgInvalid = element.classList.contains('ng-invalid') || parentFormField.classList.contains('ng-invalid');
    const isTouched = element.classList.contains('ng-touched') || element.classList.contains('ng-dirty');
    if (isNgInvalid && isTouched) {
      const errorEls = parentFormField.querySelectorAll(
        'mat-error, .mat-mdc-form-field-error, .invalid-feedback, [role="alert"], .text-danger'
      );
      for (const visibleErr of Array.from(errorEls)) {
        const el = visibleErr as HTMLElement;
        if (isGenuineErrorMessageElement(el) && isElementVisible(el)) {
          const msg = (el.textContent || '').trim();
          if (msg) return { hasError: true, errorMessage: msg };
        }
      }
      // If no visible text but element is empty, flag it
      if (element instanceof HTMLInputElement && !element.value.trim()) {
        return { hasError: true, errorMessage: 'Field marked invalid by Angular validator' };
      }
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
    'mat-error, .invalid-feedback, .error-message, [role="alert"], .mat-mdc-form-field-error, .text-danger'
  );

  for (let i = 0; i < errorNodes.length; i++) {
    const node = errorNodes[i] as HTMLElement;
    if (isGenuineErrorMessageElement(node) && isElementVisible(node)) {
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
