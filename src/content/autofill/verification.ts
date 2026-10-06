// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Verification Engine
// Post-fill verification for all field types with
// type-specific equality checks
// ─────────────────────────────────────────────────

import logger from '@shared/logger';
import { inspectElementValidation } from './form-validation';

export type VerificationStatus = 'detected' | 'filled' | 'verified' | 'failed';


export interface VerificationResult {
  field: string;
  status: VerificationStatus;
  expectedValue: string;
  actualValue: string;
  maskedExpected: string;
  maskedActual: string;
  reasons: string[];
}

// ─── Helpers ───

function maskSensitive(value: string, field: string): string {
  const sensitiveFields = ['photoIdNumber', 'idNumber', 'aadhaar', 'mobile', 'email'];
  const isSensitive = sensitiveFields.some(sf => field.toLowerCase().includes(sf.toLowerCase()));
  if (!isSensitive) return value;

  if (field.toLowerCase().includes('email')) {
    const at = value.indexOf('@');
    if (at > 0) return `${value[0]}${'•'.repeat(Math.max(at - 1, 2))}${value.slice(at)}`;
    return '•••@•••';
  }
  if (field.toLowerCase().includes('mobile') || field.toLowerCase().includes('phone')) {
    return value.length >= 4 ? `${'•'.repeat(value.length - 2)}${value.slice(-2)}` : '••••';
  }
  // Default for IDs
  return value.length >= 4 ? `${'•'.repeat(value.length - 4)}${value.slice(-4)}` : '••••';
}

// ─── Verification Functions ───

/**
 * Verify a text input field value matches the expected value.
 */
export function verifyTextValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const actualValue = element.value || '';
  const reasons: string[] = [];

  // Exact match (case-insensitive, trimmed)
  const cleanExpected = expectedValue.trim();
  const cleanActual = actualValue.trim();

  let status: VerificationStatus = 'failed';

  if (cleanActual.toLowerCase() === cleanExpected.toLowerCase()) {
    status = 'verified';
    reasons.push('Exact match (case-insensitive)');
  } else if (cleanActual.length === 0 && cleanExpected.length > 0) {
    reasons.push('Value is empty after fill attempt');
  } else {
    reasons.push(`Value mismatch: expected length ${cleanExpected.length}, got length ${cleanActual.length}`);
  }

  return {
    field: fieldKey,
    status,
    expectedValue: cleanExpected,
    actualValue: cleanActual,
    maskedExpected: maskSensitive(cleanExpected, fieldKey),
    maskedActual: maskSensitive(cleanActual, fieldKey),
    reasons,
  };
}

/**
 * Verify an age/numeric field.
 */
export function verifyNumericValue(
  element: HTMLInputElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const actualValue = element.value || '';
  const reasons: string[] = [];

  const expectedNum = parseInt(expectedValue, 10);
  const actualNum = parseInt(actualValue, 10);

  let status: VerificationStatus = 'failed';

  if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
    status = 'verified';
    reasons.push('Numeric equality verified');
  } else if (actualValue.trim() === expectedValue.trim()) {
    status = 'verified';
    reasons.push('String equality verified');
  } else if (actualValue.trim().length === 0) {
    reasons.push('Value is empty after fill attempt');
  } else {
    reasons.push(`Numeric mismatch: expected ${expectedNum}, got ${actualNum}`);
  }

  return {
    field: fieldKey,
    status,
    expectedValue,
    actualValue,
    maskedExpected: expectedValue,
    maskedActual: actualValue,
    reasons,
  };
}

/**
 * Verify an Aadhaar or Photo ID number field.
 * STRICT: compares exact normalized values.
 * NEVER accepts includes(), partial substring, prefix match, or suffix match.
 * Example: expected "123456789012" vs actual "12345678901" MUST FAIL.
 */
export function verifyAadhaarValue(
  element: HTMLInputElement,
  expectedValue: string,
  fieldKey: string = 'photoIdNumber',
): VerificationResult {
  return verifyIdNumberValue(element, expectedValue, fieldKey);
}

/**
 * Strict ID number verification (Aadhaar, Passport, PAN, Voter ID).
 * Removes formatting (whitespace, hyphens) and requires 100% exact equality.
 */
export function verifyIdNumberValue(
  element: HTMLInputElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const actualValue = element.value || '';
  const reasons: string[] = [];

  const rawExpected = expectedValue.trim();
  const rawActual = actualValue.trim();

  // If purely numeric or 12-digit Aadhaar, strip non-digits
  const expectedDigits = rawExpected.replace(/\D/g, '');
  const actualDigits = rawActual.replace(/\D/g, '');
  const isDigitsId = expectedDigits.length >= 10 && rawExpected.replace(/[\s\-]/g, '').length === expectedDigits.length;

  let status: VerificationStatus = 'failed';

  if (isDigitsId) {
    if (actualDigits.length === 0) {
      reasons.push('ID Number value is empty after fill attempt');
    } else if (actualDigits === expectedDigits) {
      status = 'verified';
      reasons.push('Exact normalized digits equality verified');
    } else {
      reasons.push(`ID Number exact mismatch: expected ${expectedDigits.length} digits, got ${actualDigits.length} digits`);
    }
  } else {
    // Alphanumeric ID (PAN, Passport, Voter ID, Driving Licence)
    const normExpected = rawExpected.replace(/[\s\-_]/g, '').toUpperCase();
    const normActual = rawActual.replace(/[\s\-_]/g, '').toUpperCase();

    if (normActual.length === 0) {
      reasons.push('ID Number value is empty after fill attempt');
    } else if (normActual === normExpected) {
      status = 'verified';
      reasons.push('Exact normalized alphanumeric equality verified');
    } else {
      reasons.push(`ID Number mismatch: expected "${maskSensitive(normExpected, fieldKey)}", got "${maskSensitive(normActual, fieldKey)}"`);
    }
  }

  return {
    field: fieldKey,
    status,
    expectedValue: rawExpected,
    actualValue: rawActual,
    maskedExpected: maskSensitive(rawExpected, fieldKey),
    maskedActual: maskSensitive(rawActual, fieldKey),
    reasons,
  };
}

/**
 * Verify a mobile number field.
 */
export function verifyMobileValue(
  element: HTMLInputElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const actualValue = element.value || '';
  const reasons: string[] = [];

  const expectedDigits = expectedValue.replace(/\D/g, '');
  const actualDigits = actualValue.replace(/\D/g, '');

  let status: VerificationStatus = 'failed';

  if (expectedDigits === actualDigits) {
    status = 'verified';
    reasons.push('Mobile digits exact match');
  } else if (expectedDigits.length >= 10 && actualDigits.length >= 10 && actualDigits.endsWith(expectedDigits.slice(-10))) {
    status = 'verified';
    reasons.push('Mobile last 10 digits match');
  } else if (actualDigits.length === 0) {
    reasons.push('Value is empty after fill attempt');
  } else {
    reasons.push(`Mobile mismatch: expected "${maskSensitive(expectedDigits, 'mobile')}", got "${maskSensitive(actualDigits, 'mobile')}"`);
  }

  return {
    field: fieldKey,
    status,
    expectedValue,
    actualValue,
    maskedExpected: maskSensitive(expectedDigits, 'mobile'),
    maskedActual: maskSensitive(actualDigits, 'mobile'),
    reasons,
  };
}

/**
 * Verify a dropdown selection by checking the current selected value/text
 * against the target value.
 */
export function verifyDropdownSelection(
  control: HTMLElement,
  targetValue: string,
  fieldKey: string,
  doc: Document = document,
): VerificationResult {
  const reasons: string[] = [];
  const normTarget = targetValue.trim().toLowerCase();

  // Native <select>
  if (control instanceof HTMLSelectElement) {
    const selectedOpt = control.options[control.selectedIndex];
    const selectedText = (selectedOpt?.textContent || '').trim().toLowerCase();
    const selectedVal = (selectedOpt?.value || '').trim().toLowerCase();

    if (isDropdownMatch(selectedText, selectedVal, normTarget, fieldKey)) {
      reasons.push(`Native select verified: "${selectedText}"`);
      return {
        field: fieldKey,
        status: 'verified',
        expectedValue: targetValue,
        actualValue: selectedOpt?.textContent?.trim() || '',
        maskedExpected: targetValue,
        maskedActual: selectedOpt?.textContent?.trim() || '',
        reasons,
      };
    }

    reasons.push(`Native select mismatch: selected="${selectedText}" expected="${normTarget}"`);
    return {
      field: fieldKey,
      status: 'failed',
      expectedValue: targetValue,
      actualValue: selectedOpt?.textContent?.trim() || '',
      maskedExpected: targetValue,
      maskedActual: selectedOpt?.textContent?.trim() || '',
      reasons,
    };
  }

  // Angular Material mat-select: check trigger text
  const triggerTextEl = control.querySelector(
    '.mat-select-value-text, .mat-mdc-select-value-text, .mat-select-min-line, .mat-mdc-select-min-line, .mat-select-value, .mat-mdc-select-value, [class*="select-value"]'
  );
  if (triggerTextEl?.textContent) {
    const triggerText = triggerTextEl.textContent.trim().toLowerCase();
    if (isDropdownMatch(triggerText, '', normTarget, fieldKey)) {
      reasons.push(`Mat-select trigger text verified: "${triggerText}"`);
      return {
        field: fieldKey,
        status: 'verified',
        expectedValue: targetValue,
        actualValue: triggerTextEl.textContent.trim(),
        maskedExpected: targetValue,
        maskedActual: triggerTextEl.textContent.trim(),
        reasons,
      };
    }
  }

  // Check aria-label or aria-valuetext on the control
  const ariaVal = control.getAttribute('aria-label') || control.getAttribute('aria-valuetext') || '';
  if (ariaVal && isDropdownMatch(ariaVal.toLowerCase(), '', normTarget, fieldKey)) {
    reasons.push(`Aria attribute verified: "${ariaVal}"`);
    return {
      field: fieldKey,
      status: 'verified',
      expectedValue: targetValue,
      actualValue: ariaVal,
      maskedExpected: targetValue,
      maskedActual: ariaVal,
      reasons,
    };
  }

  // Check ng-reflect-model or internal value attribute
  const ngModel = control.getAttribute('ng-reflect-model') || control.getAttribute('ng-reflect-value') || '';
  if (ngModel && isDropdownMatch(ngModel.toLowerCase(), '', normTarget, fieldKey)) {
    reasons.push(`ng-reflect-model verified: "${ngModel}"`);
    return {
      field: fieldKey,
      status: 'verified',
      expectedValue: targetValue,
      actualValue: ngModel,
      maskedExpected: targetValue,
      maskedActual: ngModel,
      reasons,
    };
  }

  reasons.push('Could not verify dropdown selection via any method');
  return {
    field: fieldKey,
    status: 'failed',
    expectedValue: targetValue,
    actualValue: '',
    maskedExpected: targetValue,
    maskedActual: '',
    reasons,
  };
}

/**
 * Dropdown match logic with gender safety.
 */
function isDropdownMatch(
  selectedText: string,
  selectedVal: string,
  normTarget: string,
  fieldKey: string,
): boolean {
  const isGender = fieldKey.toLowerCase() === 'gender';
  const isMale = normTarget === 'male' || normTarget === 'm';
  const isFemale = normTarget === 'female' || normTarget === 'f';

  if (isGender) {
    if (isMale) {
      if (selectedText.includes('female') || selectedVal.includes('female')) return false;
      return selectedText === 'male' || selectedVal === 'male' || selectedText === 'm' || selectedVal === 'm'
        || /\bmale\b/i.test(selectedText);
    }
    if (isFemale) {
      return selectedText === 'female' || selectedVal === 'female' || selectedText === 'f' || selectedVal === 'f'
        || /\bfemale\b/i.test(selectedText);
    }
  }

  // ID type matching with aliases
  if (normTarget.includes('aadhaar') || normTarget.includes('aadhar')) {
    return selectedText.includes('aadhaar') || selectedText.includes('aadhar')
      || selectedVal.includes('aadhaar') || selectedVal.includes('aadhar');
  }
  if (normTarget.includes('passport')) {
    return selectedText.includes('passport') || selectedVal.includes('passport');
  }
  if (normTarget.includes('voter')) {
    return selectedText.includes('voter') || selectedVal.includes('voter') || selectedText.includes('epic');
  }
  if (normTarget.includes('pan')) {
    return /\bpan\b/i.test(selectedText) || /\bpan\b/i.test(selectedVal);
  }
  if (normTarget.includes('driving')) {
    return selectedText.includes('driving') || selectedText.includes('licen');
  }
  if (normTarget.includes('ration')) {
    return selectedText.includes('ration') || selectedVal.includes('ration');
  }

  // Generic match
  return selectedText.includes(normTarget) || selectedVal.includes(normTarget)
    || normTarget.includes(selectedText);
}

/**
 * Verify a radio button group selection.
 */
export function verifyRadioSelection(
  element: HTMLElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const reasons: string[] = [];
  const normExpected = expectedValue.trim().toLowerCase();

  const radios = element instanceof HTMLInputElement && element.type === 'radio'
    ? [element]
    : Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  const checkedRadio = radios.find(r => r.checked);
  if (!checkedRadio) {
    reasons.push('No radio option selected');
    return {
      field: fieldKey,
      status: 'failed',
      expectedValue,
      actualValue: '',
      maskedExpected: expectedValue,
      maskedActual: '',
      reasons,
    };
  }

  const actualVal = (checkedRadio.value || '').trim().toLowerCase();
  const parentLabel = (checkedRadio.parentElement?.textContent || '').trim().toLowerCase();

  let isMatch = false;
  if (fieldKey.toLowerCase() === 'gender') {
    if (normExpected === 'male' || normExpected === 'm') {
      isMatch = actualVal === 'male' || actualVal === 'm' || /\bmale\b/i.test(parentLabel);
    } else if (normExpected === 'female' || normExpected === 'f') {
      isMatch = actualVal === 'female' || actualVal === 'f' || /\bfemale\b/i.test(parentLabel);
    } else {
      isMatch = actualVal === normExpected || parentLabel.includes(normExpected);
    }
  } else {
    isMatch = actualVal === normExpected || parentLabel.includes(normExpected);
  }

  if (isMatch) {
    reasons.push('Radio option match verified');
    return {
      field: fieldKey,
      status: 'verified',
      expectedValue,
      actualValue: checkedRadio.value,
      maskedExpected: expectedValue,
      maskedActual: checkedRadio.value,
      reasons,
    };
  }

  reasons.push(`Radio mismatch: selected "${checkedRadio.value || parentLabel}", expected "${expectedValue}"`);
  return {
    field: fieldKey,
    status: 'failed',
    expectedValue,
    actualValue: checkedRadio.value,
    maskedExpected: expectedValue,
    maskedActual: checkedRadio.value,
    reasons,
  };
}

/**
 * Verify a checkbox checked state.
 */
export function verifyCheckboxValue(
  element: HTMLInputElement,
  expectedChecked: boolean,
  fieldKey: string,
): VerificationResult {
  const actualChecked = element.checked;
  const isMatch = actualChecked === expectedChecked;

  return {
    field: fieldKey,
    status: isMatch ? 'verified' : 'failed',
    expectedValue: String(expectedChecked),
    actualValue: String(actualChecked),
    maskedExpected: String(expectedChecked),
    maskedActual: String(actualChecked),
    reasons: isMatch ? ['Checkbox state verified'] : [`Checkbox state mismatch: expected ${expectedChecked}, got ${actualChecked}`],
  };
}

/**
 * Verify a date field value.
 */
export function verifyDateValue(
  element: HTMLInputElement,
  expectedValue: string,
  fieldKey: string,
): VerificationResult {
  const actualVal = (element.value || '').trim();
  const cleanExpected = expectedValue.trim();

  // Normalize separators: 2026-10-06 vs 2026/10/06 vs 06-10-2026
  const normActual = actualVal.replace(/[/.]/g, '-');
  const normExpected = cleanExpected.replace(/[/.]/g, '-');

  const isMatch = normActual === normExpected || actualVal.toLowerCase() === cleanExpected.toLowerCase();

  return {
    field: fieldKey,
    status: isMatch ? 'verified' : 'failed',
    expectedValue: cleanExpected,
    actualValue: actualVal,
    maskedExpected: cleanExpected,
    maskedActual: actualVal,
    reasons: isMatch ? ['Date value verified'] : [`Date mismatch: expected "${cleanExpected}", got "${actualVal}"`],
  };
}

/**
 * Determine the appropriate verification function for a field.
 * Combines DOM value checking with visible validation state detection.
 */
export function verifyField(
  element: HTMLElement,
  expectedValue: string,
  fieldKey: string,
  doc: Document = document,
): VerificationResult {
  // Determine field type for strict verification
  const isIdNumber = fieldKey === 'photoIdNumber' || fieldKey === 'idNumber' || fieldKey.toLowerCase().includes('aadhaar');
  const isMobile = fieldKey === 'mobile';
  const isNumeric = fieldKey === 'age';
  const isDropdown = fieldKey === 'gender' || fieldKey === 'photoIdProof'
    || fieldKey === 'state' || fieldKey === 'country';

  let result: VerificationResult;

  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    const boolExpected = expectedValue === 'true' || expectedValue === '1' || expectedValue === 'on';
    result = verifyCheckboxValue(element, boolExpected, fieldKey);
  } else if (element instanceof HTMLInputElement && element.type === 'date') {
    result = verifyDateValue(element, expectedValue, fieldKey);
  } else if ((element instanceof HTMLInputElement && element.type === 'radio') || element.querySelector('input[type="radio"]')) {
    result = verifyRadioSelection(element, expectedValue, fieldKey);
  } else if (isDropdown) {
    result = verifyDropdownSelection(element, expectedValue, fieldKey, doc);
  } else if (isIdNumber && element instanceof HTMLInputElement) {
    result = verifyIdNumberValue(element, expectedValue, fieldKey);
  } else if (isMobile && element instanceof HTMLInputElement) {
    result = verifyMobileValue(element, expectedValue, fieldKey);
  } else if (isNumeric && element instanceof HTMLInputElement) {
    result = verifyNumericValue(element, expectedValue, fieldKey);
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    result = verifyTextValue(element, expectedValue, fieldKey);
  } else {
    result = {
      field: fieldKey,
      status: 'failed',
      expectedValue,
      actualValue: '',
      maskedExpected: maskSensitive(expectedValue, fieldKey),
      maskedActual: '',
      reasons: ['Element is not a verifiable input/select'],
    };
  }

  // Phase 6: Form Validation Awareness
  // A field is not verified merely because its value exists; visible error messages fail verification.
  if (result.status === 'verified') {
    const valCheck = inspectElementValidation(element, fieldKey);
    if (valCheck.hasError) {
      result.status = 'failed';
      result.reasons.push(`Validation error: ${valCheck.errorMessage || 'Field marked invalid'}`);
    }
  }

  return result;
}

