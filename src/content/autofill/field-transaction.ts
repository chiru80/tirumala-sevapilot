// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Transaction Engine
// Performs a single controlled DOM transaction with Angular-aware
// event dispatching. NEVER forces disabled/readOnly.
// Verification is strictly delegated to verification.ts.
// Retries are strictly orchestrated by retry-engine.ts.
// ─────────────────────────────────────────────────

import { dispatchAngularCompatibleEvents, triggerSelectChange } from '../dom-events';
import { waitForCondition } from '../smart-wait';
import { verifyField } from './verification';
import type { VerificationResult } from './verification';
import logger from '@shared/logger';

export interface FieldTransactionResult {
  field: string;
  pilgrimIndex: number;
  status: 'verified' | 'failed' | 'skipped';
  attempts: number;
  durationMs: number;
  error?: string;
  maskedValue?: string;
  repaired?: boolean;
  detected?: boolean;
  confidence?: number;
  strategy?: string;
  filled?: boolean;
  verified?: boolean;
}

/**
 * Perform a single controlled text transaction on an input/textarea.
 * Dispatches Angular-compatible native prototype value setter and events.
 * NEVER forces disabled or readOnly.
 */
export async function performTextTransaction(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  if (element.disabled) {
    throw new Error('Field is disabled — cannot fill without overriding website control state');
  }
  if (element.readOnly) {
    throw new Error('Field is readOnly — cannot fill without overriding website control state');
  }

  dispatchAngularCompatibleEvents(element, value);

  // Microtask yield for framework change detection
  await new Promise(r => setTimeout(r, 20));
}

/**
 * Perform a single controlled dropdown transaction on a select or mat-select.
 * Supports native <select>, radio toggles, and Angular Material dropdowns.
 */
export async function performDropdownTransaction(
  control: HTMLElement,
  targetValue: string,
  fieldKey: string,
  doc: Document = document,
): Promise<void> {
  // Dismiss any lingering CDK overlay backdrop first
  const lingeringBackdrop = doc.querySelector('.cdk-overlay-backdrop');
  if (lingeringBackdrop) {
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await waitForCondition(() => !doc.querySelector('.cdk-overlay-backdrop'), { timeoutMs: 200, pollMs: 20 });
  }

  // Case 1: Native <select>
  const nativeSelect = control instanceof HTMLSelectElement ? control : control.querySelector<HTMLSelectElement>('select');
  if (nativeSelect) {
    const options = Array.from(nativeSelect.options);
    const target = matchOptionText(options, targetValue, fieldKey);
    if (target) {
      nativeSelect.value = target.value;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (valueSetter) valueSetter.call(nativeSelect, target.value);

      nativeSelect.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      nativeSelect.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 30));
      return;
    }
  }

  // Case 2: Radio buttons (e.g. for Gender)
  const radios = control.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  if (radios.length > 0) {
    const normTarget = targetValue.toLowerCase().trim();
    for (const r of Array.from(radios)) {
      const rVal = (r.value || '').toLowerCase().trim();
      const rLabel = (r.parentElement?.textContent || '').toLowerCase().trim();

      let isMatch = false;
      if (normTarget === 'male' || normTarget === 'm') {
        if (rVal.includes('female') || rLabel.includes('female')) continue;
        isMatch = rVal === 'male' || rVal === 'm' || rLabel === 'male' || /\bmale\b/i.test(rLabel);
      } else if (normTarget === 'female' || normTarget === 'f') {
        isMatch = rVal === 'female' || rVal === 'f' || rLabel === 'female' || /\bfemale\b/i.test(rLabel);
      } else {
        isMatch = rVal === normTarget || rLabel.includes(normTarget);
      }

      if (isMatch) {
        r.click();
        r.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        return;
      }
    }
  }

  // Case 3: Angular Material / custom dropdown
  const triggerEl = control.querySelector<HTMLElement>(
    '.mat-select-trigger, .mat-mdc-select-trigger, [role="combobox"], button'
  ) || control;

  triggerEl.focus();
  triggerEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
  triggerEl.click();
  triggerEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));

  if (control !== triggerEl) {
    control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    control.click();
    control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));
  }

  // Keyboard trigger fallback
  triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

  // Wait for overlay options to appear
  const matchedOption = await waitForCondition(() => {
    const searchRoots = [
      doc.querySelector('.cdk-overlay-container'),
      doc.querySelector('.mat-select-panel'),
      doc.querySelector('.mat-mdc-select-panel'),
      doc.querySelector('.cdk-overlay-pane'),
      control.parentElement,
      doc.body,
    ];

    for (const root of searchRoots) {
      if (!root) continue;
      const overlayOptions = Array.from(root.querySelectorAll<HTMLElement>(
        '[role="option"], mat-option, .mat-option, .mat-mdc-option'
      ));
      if (overlayOptions.length > 0) {
        const match = matchOverlayOption(overlayOptions, targetValue, fieldKey);
        if (match) return match;
      }
    }
    return null;
  }, { timeoutMs: 1200, pollMs: 25 });

  if (matchedOption) {
    matchedOption.scrollIntoView?.({ block: 'nearest' });
    matchedOption.focus?.();
    matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    matchedOption.click();
    matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));
    matchedOption.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for dropdown overlay to close
    await waitForCondition(() => {
      const overlay = doc.querySelector('.cdk-overlay-container [role="listbox"]');
      const backdrop = doc.querySelector('.cdk-overlay-backdrop');
      return (!overlay && !backdrop) || !matchedOption.isConnected;
    }, { timeoutMs: 400, pollMs: 20 });

    await new Promise(r => setTimeout(r, 60));
    return;
  }

  // Fallback: triggerSelectChange helper
  const selectChanged = await triggerSelectChange(control, targetValue, doc);
  if (selectChanged) {
    await new Promise(r => setTimeout(r, 40));
    return;
  }

  // Fallback: input masquerading as dropdown
  if (control instanceof HTMLInputElement) {
    dispatchAngularCompatibleEvents(control, targetValue);
    await new Promise(r => setTimeout(r, 30));
    return;
  }

  throw new Error(`Could not find or select matching dropdown option for "${targetValue}"`);
}

/**
 * Execute a single text transaction and verify using verification.ts.
 * (No internal retry loop — retries belong strictly in retry-engine.ts).
 */
export async function executeTextTransaction(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  fieldKey: string,
  pilgrimIndex: number,
  doc: Document = document,
): Promise<FieldTransactionResult> {
  const startTime = performance.now();

  if (!doc.contains(element)) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: `Element for ${fieldKey} detached from DOM`,
      detected: false,
      filled: false,
      verified: false,
    };
  }

  if (element.disabled) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: `${fieldKey} field is disabled — cannot fill without overriding website control state`,
      detected: true,
      filled: false,
      verified: false,
    };
  }

  if (element.readOnly) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: `${fieldKey} field is readOnly — cannot fill without overriding website control state`,
      detected: true,
      filled: false,
      verified: false,
    };
  }

  try {
    await performTextTransaction(element, value);
  } catch (err) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : 'Text transaction failed',
      detected: true,
      filled: false,
      verified: false,
    };
  }

  const vRes = verifyField(element, value, fieldKey, doc);
  const durationMs = Math.round(performance.now() - startTime);

  return {
    field: fieldKey,
    pilgrimIndex,
    status: vRes.status === 'verified' ? 'verified' : 'failed',
    attempts: 1,
    durationMs,
    maskedValue: vRes.maskedActual || vRes.maskedExpected,
    error: vRes.status === 'verified' ? undefined : vRes.reasons.join('; '),
    detected: true,
    filled: true,
    verified: vRes.status === 'verified',
  };
}

/**
 * Execute a single dropdown transaction and verify using verification.ts.
 * (No internal retry loop — retries belong strictly in retry-engine.ts).
 */
export async function executeDropdownTransaction(
  control: HTMLElement,
  targetValue: string,
  fieldKey: string,
  pilgrimIndex: number,
  doc: Document = document,
): Promise<FieldTransactionResult> {
  const startTime = performance.now();

  if (!doc.contains(control)) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: `Dropdown for ${fieldKey} detached from DOM`,
      detected: false,
      filled: false,
      verified: false,
    };
  }

  try {
    await performDropdownTransaction(control, targetValue, fieldKey, doc);
  } catch (err) {
    return {
      field: fieldKey,
      pilgrimIndex,
      status: 'failed',
      attempts: 1,
      durationMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : 'Dropdown transaction failed',
      detected: true,
      filled: false,
      verified: false,
    };
  }

  const vRes = verifyField(control, targetValue, fieldKey, doc);
  const durationMs = Math.round(performance.now() - startTime);

  return {
    field: fieldKey,
    pilgrimIndex,
    status: vRes.status === 'verified' ? 'verified' : 'failed',
    attempts: 1,
    durationMs,
    maskedValue: vRes.maskedActual || targetValue,
    error: vRes.status === 'verified' ? undefined : vRes.reasons.join('; '),
    detected: true,
    filled: true,
    verified: vRes.status === 'verified',
  };
}

function matchOptionText(
  options: HTMLOptionElement[],
  target: string,
  fieldKey: string,
): HTMLOptionElement | null {
  const normTarget = target.trim().toLowerCase();
  const isGender = fieldKey === 'gender';
  const isMale = normTarget === 'male' || normTarget === 'm';
  const isFemale = normTarget === 'female' || normTarget === 'f';

  return options.find(opt => {
    const text = (opt.textContent || '').trim().toLowerCase();
    const val = (opt.value || '').trim().toLowerCase();
    if (isGender) {
      if (isMale) {
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male' || text === 'm' || val === 'm';
      }
      if (isFemale) {
        return text === 'female' || val === 'female' || text === 'f' || val === 'f';
      }
    }
    // Photo ID check
    if (normTarget.includes('aadhaar') || normTarget.includes('aadhar') || normTarget.includes('uid')) {
      if (text.includes('aadhaar') || text.includes('aadhar') || val.includes('aadhaar') || val.includes('aadhar') || text.includes('uid')) return true;
    }
    if (normTarget.includes('passport') && (text.includes('passport') || val.includes('passport'))) return true;
    if (normTarget.includes('voter') && (text.includes('voter') || val.includes('voter') || text.includes('epic'))) return true;
    if (normTarget.includes('pan') && (text.includes('pan') || val.includes('pan') || /\bpan\b/i.test(text))) return true;
    if (normTarget.includes('driving') && (text.includes('driving') || val.includes('driving') || text.includes('licen'))) return true;
    if (normTarget.includes('ration') && (text.includes('ration') || val.includes('ration'))) return true;

    return text.includes(normTarget) || val.includes(normTarget);
  }) || null;
}

function matchOverlayOption(
  options: HTMLElement[],
  target: string,
  fieldKey: string,
): HTMLElement | null {
  const normTarget = target.trim().toLowerCase();
  const isGender = fieldKey === 'gender';
  const isMale = normTarget === 'male' || normTarget === 'm';
  const isFemale = normTarget === 'female' || normTarget === 'f';

  return options.find(opt => {
    const text = (opt.textContent || '').trim().toLowerCase();
    const val = (opt.getAttribute('value') || opt.getAttribute('ng-reflect-value') || '').toLowerCase().trim();
    if (isGender) {
      if (isMale) {
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male' || text === 'm' || val === 'm' || /\bmale\b/i.test(text);
      }
      if (isFemale) {
        return text === 'female' || val === 'female' || text === 'f' || val === 'f' || /\bfemale\b/i.test(text);
      }
    }
    // Photo ID check
    if (normTarget.includes('aadhaar') || normTarget.includes('aadhar') || normTarget.includes('uid')) {
      if (text.includes('aadhaar') || text.includes('aadhar') || val.includes('aadhaar') || val.includes('aadhar') || text.includes('uid')) return true;
    }
    if (normTarget.includes('passport') && (text.includes('passport') || val.includes('passport'))) return true;
    if (normTarget.includes('voter') && (text.includes('voter') || val.includes('voter') || text.includes('epic') || text.includes('election'))) return true;
    if (normTarget.includes('pan') && (text.includes('pan') || val.includes('pan') || /\bpan\b/i.test(text))) return true;
    if (normTarget.includes('driving') && (text.includes('driving') || val.includes('driving') || text.includes('licen'))) return true;
    if (normTarget.includes('ration') && (text.includes('ration') || val.includes('ration'))) return true;

    // First word match fallback
    const firstWord = normTarget.split(/\s+/)[0];
    if (firstWord && firstWord.length > 3 && (text.includes(firstWord) || val.includes(firstWord))) {
      return true;
    }

    return text.includes(normTarget) || val.includes(normTarget);
  }) || null;
}
