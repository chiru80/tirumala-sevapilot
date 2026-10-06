/**
 * ============================================================================
 * LEGACY TEST FIXTURE CODE — DO NOT IMPORT IN PRODUCTION RUNTIME
 * ============================================================================
 * Production autofill engine is src/content/autofill/autofill-manager.ts.
 * This file is retained strictly as test fixture / legacy reference code.
 * It has NO production imports and MUST NOT be called from runtime code.
 * ============================================================================
 */

import type { Pilgrim } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { dispatchAngularCompatibleEvents } from './dom-events';
import { AngularFormObserver } from './angular-form-observer';
import logger from '@shared/logger';

export const DEBUG_AUTOFILL = true;

/** Global concurrency lock to prevent duplicate clicks */
let isAutofillRunning = false;

export interface FindFieldOptions {
  labels: string[];
  type?: 'text' | 'number' | 'select' | 'any';
  excludeKeywords?: string[];
  index?: number;
}

export interface PilgrimFormFieldStatus {
  fieldType: 'name' | 'age' | 'gender' | 'photoIdProof' | 'photoIdNumber';
  label: string;
  detected: boolean;
  filled: boolean;
  validated: boolean;
  maskedValue?: string;
  error?: string;
}

export interface PilgrimRowReport {
  pilgrimIndex: number;
  pilgrimName: string;
  fields: Record<string, PilgrimFormFieldStatus>;
  allDetected: boolean;
  allFilled: boolean;
  allValidated: boolean;
  errors: string[];
}

export interface PilgrimFormGroup {
  index: number;
  container: HTMLElement;
  fields?: {
    name?: HTMLInputElement | null;
    age?: HTMLInputElement | null;
    gender?: HTMLElement | null;
    photoIdProof?: HTMLElement | null;
    photoIdNumber?: HTMLInputElement | null;
  };
}

export interface PilgrimFillReport {
  index: number;
  nameFilled: boolean;
  ageFilled: boolean;
  genderSelected: boolean;
  photoIdProofSelected: boolean;
  photoIdNumberFilled: boolean;
  allSuccess: boolean;
  errors: string[];
}

export interface TTDAutofillReport {
  success: boolean;
  totalPilgrims: number;
  filledPilgrims: number;
  reports: PilgrimFillReport[];
  pilgrimReports: PilgrimRowReport[];
  errorMessage?: string;
}

/** Helper sleep function */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Set a value on an input element using prototype descriptor to bypass Angular overrides.
 * Dispatches input, change, blur with bubbles and cancelable.
 */
export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): boolean {
  if (!element) return false;

  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  // Angular's DefaultValueAccessor & ControlValueAccessor listen to input & blur
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true, composed: true }));

  return true;
}

/**
 * Check if an element is visible in the viewport and not hidden
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.getAttribute('type') === 'hidden') return false;
  const win = el.ownerDocument?.defaultView || window;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom')) {
    return true;
  }
  return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
}

/**
 * Normalize label text for matching
 */
function cleanText(text: string): string {
  return text.toLowerCase().replace(/[\*\:\_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detect all pilgrim rows using Lowest Common Ancestor (LCA) container isolation.
 * Guarantees that each returned container contains exactly ONE pilgrim's fields
 * and no other pilgrim's fields. Supports N pilgrims (1..10+).
 */
export function detectPilgrimRows(doc: Document = document): HTMLElement[] {
  // Strategy 1: Find all distinct pilgrim Name fields
  const allInputs = Array.from(doc.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
  ));
  const nameInputs = allInputs.filter(el => {
    if (!isElementVisible(el)) return false;
    const attrString = `${el.id} ${el.getAttribute('name')} ${el.getAttribute('placeholder')} ${el.getAttribute('formcontrolname')}`.toLowerCase();
    // Exclude username, login, email, id proof, photo id number, booking, etc.
    if (attrString.includes('login') || attrString.includes('user') || attrString.includes('email') ||
        attrString.includes('id') || attrString.includes('photo') || attrString.includes('otp') ||
        attrString.includes('search') || attrString.includes('captcha')) {
      return false;
    }
    const label = el.id ? doc.querySelector(`label[for="${el.id}"]`)?.textContent || '' : '';
    const cleanLbl = cleanText(label);
    if (cleanLbl.includes('id') || cleanLbl.includes('photo') || cleanLbl.includes('email') || cleanLbl.includes('login')) {
      return false;
    }
    return attrString.includes('name') || cleanLbl.includes('name');
  });

  if (nameInputs.length > 0) {
    // For each nameInput, climb the DOM tree to find its isolated container
    const isolatedContainers: HTMLElement[] = [];
    for (const nameEl of nameInputs) {
      let current: HTMLElement = nameEl.parentElement || nameEl;
      while (current && current !== doc.body && current !== doc.documentElement) {
        const parent = current.parentElement;
        if (!parent || parent === doc.body || parent === doc.documentElement) {
          break;
        }
        // If parent contains ANY other name input, stop climbing: current is the row container!
        const hasOtherName = nameInputs.some(other => other !== nameEl && parent.contains(other));
        if (hasOtherName) {
          break;
        }
        current = parent;
      }
      if (!isolatedContainers.includes(current)) {
        isolatedContainers.push(current);
      }
    }

    if (isolatedContainers.length === nameInputs.length) {
      // Sort containers by DOM position
      isolatedContainers.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      return isolatedContainers;
    }
  }

  // Strategy 2: Traditional table rows or pilgrim cards
  const tableRows = Array.from(doc.querySelectorAll<HTMLElement>('table tbody tr, .table tbody tr, [role="row"]'))
    .filter(row => {
      const inputs = row.querySelectorAll('input, select, mat-select, [role="combobox"]');
      return inputs.length >= 2;
    });

  if (tableRows.length > 0) return tableRows;

  const cards = Array.from(doc.querySelectorAll<HTMLElement>(
    '.pilgrim-row, .devotee-card, .pilgrim-card, .mat-card, mat-card, .card'
  )).filter(card => {
    const inputs = card.querySelectorAll('input, select, mat-select, [role="combobox"]');
    return inputs.length >= 3;
  });

  if (cards.length > 0) return cards;

  // Fallback: document body if inputs exist directly in a single form
  return [doc.body];
}

/**
 * Asynchronously wait for dynamically generated pilgrim rows to appear in DOM.
 * Does not begin autofill until expectedCount rows are ready (or timeout reached).
 */
export async function waitForPilgrimRows(
  expectedCount: number,
  timeout: number = 5000,
  doc: Document = document,
): Promise<HTMLElement[]> {
  const startTime = Date.now();
  let rows = detectPilgrimRows(doc);

  if (rows.length >= expectedCount) {
    return rows;
  }

  while (Date.now() - startTime < timeout) {
    await wait(100);
    rows = detectPilgrimRows(doc);
    if (rows.length >= expectedCount) {
      return rows;
    }
  }

  return rows;
}

/**
 * Find all pilgrim containers/rows on the TTD page.
 * Supports table rows (tbody tr), pilgrim cards, or form-groups.
 */
export function findPilgrimContainers(doc: Document = document): HTMLElement[] {
  return detectPilgrimRows(doc);
}

/**
 * Multi-signal, resilient field locator.
 * Never relies on a single brittle selector.
 */
export function findField(
  options: FindFieldOptions,
  doc: Document = document,
  rootContainer?: HTMLElement,
): HTMLElement | null {
  const container = rootContainer || doc.body;
  const labelsToMatch = options.labels.map(l => cleanText(l));
  const excludes = (options.excludeKeywords || []).map(e => cleanText(e));
  const targetIndex = options.index ?? 0;

  const candidateElements = Array.from(container.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select'
  )).filter(el => {
    // Exclude if element attributes contain exclusion keywords (e.g. login, otp, password)
    const attrString = `${el.id} ${el.getAttribute('name')} ${el.getAttribute('placeholder')} ${el.getAttribute('formcontrolname')} ${el.className}`.toLowerCase();
    for (const ex of excludes) {
      if (ex === 'no' ? /\bno\b/i.test(attrString) : attrString.includes(ex)) return false;
    }
    return isElementVisible(el);
  });

  // Strategy 1: Check nearby <label> or <mat-label> elements
  const matchesByLabel: HTMLElement[] = [];

  for (const el of candidateElements) {
    let associatedLabelText = '';

    // A. <label for="...">
    if (el.id) {
      const labelEl = doc.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent) {
        associatedLabelText = cleanText(labelEl.textContent);
      }
    }

    // B. Inside <label>
    if (!associatedLabelText) {
      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.textContent) {
        associatedLabelText = cleanText(parentLabel.textContent);
      }
    }

    // C. Inside <mat-form-field>
    if (!associatedLabelText) {
      const matFormField = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group');
      if (matFormField) {
        const matLabel = matFormField.querySelector('mat-label, label, .mat-mdc-floating-label');
        if (matLabel && matLabel.textContent) {
          associatedLabelText = cleanText(matLabel.textContent);
        }
      }
    }

    // D. Preceding sibling or parent sibling label
    if (!associatedLabelText) {
      const prev = el.previousElementSibling;
      if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN') && prev.textContent) {
        associatedLabelText = cleanText(prev.textContent);
      }
    }

    // Check if label matches any of options.labels
    if (associatedLabelText) {
      const isMatch = labelsToMatch.some(l => associatedLabelText.includes(l));
      if (isMatch) {
        matchesByLabel.push(el);
      }
    }
  }

  if (matchesByLabel.length > targetIndex) {
    return matchesByLabel[targetIndex];
  }
  if (matchesByLabel.length > 0 && targetIndex === 0) {
    return matchesByLabel[0];
  }

  // Strategy 2: Direct attribute matching (placeholder, name, id, aria-label, formcontrolname)
  const matchesByAttr: HTMLElement[] = [];

  for (const el of candidateElements) {
    const inputEl = el as HTMLInputElement;
    const name = cleanText(el.getAttribute('name') || '');
    const id = cleanText(el.id || '');
    const placeholder = cleanText(inputEl.placeholder || '');
    const ariaLabel = cleanText(el.getAttribute('aria-label') || '');
    const formControlName = cleanText(el.getAttribute('formcontrolname') || '');

    const isMatch = labelsToMatch.some(label =>
      placeholder.includes(label) ||
      name.includes(label) ||
      id.includes(label) ||
      ariaLabel.includes(label) ||
      formControlName.includes(label)
    );

    if (isMatch) {
      matchesByAttr.push(el);
    }
  }

  if (matchesByAttr.length > targetIndex) {
    return matchesByAttr[targetIndex];
  }
  if (matchesByAttr.length > 0 && targetIndex === 0) {
    return matchesByAttr[0];
  }

  return null;
}

/**
 * Scoped field detection inside a specific pilgrim container.
 * Enforces usedElements tracking so no element is assigned twice.
 */
export function findFieldInContainer(
  container: HTMLElement,
  options: FindFieldOptions,
  usedElements: Set<Element> = new Set(),
  doc: Document = document,
): HTMLElement | null {
  const labelsToMatch = options.labels.map(l => cleanText(l));
  const excludes = (options.excludeKeywords || []).map(e => cleanText(e));

  const candidateElements = Array.from(container.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select'
  )).filter(el => {
    if (usedElements.has(el)) return false;

    // Filter by type if specified
    if (options.type === 'select') {
      const isSel = el instanceof HTMLSelectElement || el.tagName === 'MAT-SELECT' || el.getAttribute('role') === 'combobox' || el.classList.contains('mat-select') || el.classList.contains('p-dropdown');
      if (!isSel && el instanceof HTMLInputElement && el.type !== 'text') return false;
    } else if (options.type === 'number') {
      if (el instanceof HTMLSelectElement) return false;
    } else if (options.type === 'text') {
      if (el instanceof HTMLSelectElement) return false;
    }

    const attrString = `${el.id} ${el.getAttribute('name')} ${el.getAttribute('placeholder')} ${el.getAttribute('formcontrolname')} ${el.className}`.toLowerCase();
    for (const ex of excludes) {
      if (ex === 'no' ? /\bno\b/i.test(attrString) : attrString.includes(ex)) return false;
    }
    return isElementVisible(el);
  });

  // Strategy 1: Check nearby <label> or <mat-label> elements
  for (const el of candidateElements) {
    let associatedLabelText = '';

    if (el.id) {
      const labelEl = container.querySelector(`label[for="${el.id}"]`) || doc.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent) {
        associatedLabelText = cleanText(labelEl.textContent);
      }
    }

    if (!associatedLabelText) {
      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.textContent) {
        associatedLabelText = cleanText(parentLabel.textContent);
      }
    }

    if (!associatedLabelText) {
      const matFormField = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group');
      if (matFormField) {
        const matLabel = matFormField.querySelector('mat-label, label, .mat-mdc-floating-label');
        if (matLabel && matLabel.textContent) {
          associatedLabelText = cleanText(matLabel.textContent);
        }
      }
    }

    if (!associatedLabelText) {
      const prev = el.previousElementSibling;
      if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'B') && prev.textContent) {
        associatedLabelText = cleanText(prev.textContent);
      }
    }

    if (!associatedLabelText) {
      const colOrGroup = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, [class*="col"], td, .field-wrap');
      if (colOrGroup && colOrGroup !== container && colOrGroup !== doc.body) {
        const lbl = colOrGroup.querySelector('mat-label, label, .mat-mdc-floating-label, span, b, strong');
        if (lbl && lbl.textContent && !lbl.contains(el)) {
          associatedLabelText = cleanText(lbl.textContent);
        }
      }
    }

    if (associatedLabelText) {
      const isMatch = labelsToMatch.some(l => associatedLabelText.includes(l));
      if (isMatch) {
        return el;
      }
    }
  }

  // Strategy 2: Direct attribute matching (placeholder, name, id, aria-label, formcontrolname, ng-reflect-name)
  for (const el of candidateElements) {
    const inputEl = el as HTMLInputElement;
    const name = cleanText(el.getAttribute('name') || '');
    const id = cleanText(el.id || '');
    const placeholder = cleanText(inputEl.placeholder || '');
    const ariaLabel = cleanText(el.getAttribute('aria-label') || '');
    const formControlName = cleanText(el.getAttribute('formcontrolname') || '');
    const ngReflectName = cleanText(el.getAttribute('ng-reflect-name') || '');

    const isMatch = labelsToMatch.some(label =>
      placeholder.includes(label) ||
      name.includes(label) ||
      id.includes(label) ||
      ariaLabel.includes(label) ||
      formControlName.includes(label) ||
      ngReflectName.includes(label)
    );

    if (isMatch) {
      return el;
    }
  }

  return null;
}

/**
 * Handle Gender dropdown (native <select>, Angular Material, or custom).
 */
export async function setGenderDropdown(
  control: HTMLElement,
  genderValue: string,
  doc: Document = document,
): Promise<boolean> {
  const normGender = genderValue.trim().toLowerCase();
  const isMale = normGender === 'male' || normGender === 'm';
  const isFemale = normGender === 'female' || normGender === 'f';

  // Case 1: Native <select>
  if (control instanceof HTMLSelectElement) {
    const options = Array.from(control.options);
    const targetOption = options.find(opt => {
      const text = opt.textContent?.trim().toLowerCase() || '';
      const val = opt.value.trim().toLowerCase();
      if (isMale) {
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male' || text === 'm' || val === 'm' || /\bmale\b/i.test(text) || /\bmale\b/i.test(val);
      }
      if (isFemale) {
        return text === 'female' || val === 'female' || text === 'f' || val === 'f' || /\bfemale\b/i.test(text) || /\bfemale\b/i.test(val);
      }
      return text.includes(normGender) || val.includes(normGender);
    });

    if (targetOption) {
      control.value = targetOption.value;
      control.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  // Case 2: Angular Material (<mat-select>) or custom trigger
  try {
    const trigger = control.querySelector<HTMLElement>(
      '.mat-select-trigger, .mat-mdc-select-trigger, [role="combobox"], button'
    ) || control;
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    trigger.click();
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));
    await wait(120);

    const searchRoots = [
      doc.querySelector('.cdk-overlay-container'),
      doc.querySelector('.mat-select-panel'),
      doc.querySelector('.mat-mdc-select-panel'),
      control.parentElement,
      doc.body,
    ];

    let overlayOptions: HTMLElement[] = [];
    for (const root of searchRoots) {
      if (!root) continue;
      const opts = Array.from(root.querySelectorAll<HTMLElement>(
        '[role="option"], mat-option, .mat-option, .mat-mdc-option'
      ));
      if (opts.length > 0) {
        overlayOptions = opts;
        break;
      }
    }

    const matchedOption = overlayOptions.find(opt => {
      const text = opt.textContent?.trim().toLowerCase() || '';
      const val = (opt.getAttribute('value') || opt.getAttribute('ng-reflect-value') || '').toLowerCase().trim();
      if (isMale) {
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male' || text === 'm' || val === 'm' || /\bmale\b/i.test(text) || /\bmale\b/i.test(val);
      }
      if (isFemale) {
        return text === 'female' || val === 'female' || text === 'f' || val === 'f' || /\bfemale\b/i.test(text) || /\bfemale\b/i.test(val);
      }
      return text === normGender || val === normGender;
    });

    if (matchedOption) {
      matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      matchedOption.click();
      matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      await wait(80);
      return true;
    }
  } catch (err) {
    logger.debug('Gender dropdown click exception:', err);
  }

  // Fallback: If control is an input element masquerading as a dropdown
  if (control instanceof HTMLInputElement) {
    setNativeValue(control, isFemale ? 'Female' : 'Male');
    return true;
  }

  return false;
}

/**
 * Handle Photo ID Proof dropdown (Aadhaar Card, Passport, etc.)
 */
export async function setPhotoIdProofDropdown(
  control: HTMLElement,
  idTypeValue: string,
  doc: Document = document,
): Promise<boolean> {
  const normIdType = (idTypeValue || 'Aadhaar Card').trim().toLowerCase();

  // Case 1: Native <select>
  if (control instanceof HTMLSelectElement) {
    const options = Array.from(control.options);
    const targetOption = options.find(opt => {
      const text = opt.textContent?.trim().toLowerCase() || '';
      const val = opt.value.trim().toLowerCase();
      if ((normIdType.includes('aadhaar') || normIdType.includes('aadhar')) && (text.includes('aadhaar') || text.includes('aadhar') || val.includes('aadhaar'))) {
        return true;
      }
      if (normIdType.includes('passport') && (text.includes('passport') || val.includes('passport'))) return true;
      if (normIdType.includes('voter') && (text.includes('voter') || val.includes('voter'))) return true;
      if (normIdType.includes('pan') && (text.includes('pan') || val.includes('pan'))) return true;
      return text.includes(normIdType) || val.includes(normIdType);
    });

    if (targetOption) {
      control.value = targetOption.value;
      control.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  // Case 2: Angular Material (<mat-select>) or custom trigger
  try {
    const trigger = control.querySelector<HTMLElement>(
      '.mat-select-trigger, .mat-mdc-select-trigger, [role="combobox"], button'
    ) || control;
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    trigger.click();
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));
    await wait(120);

    const searchRoots = [
      doc.querySelector('.cdk-overlay-container'),
      doc.querySelector('.mat-select-panel'),
      doc.querySelector('.mat-mdc-select-panel'),
      control.parentElement,
      doc.body,
    ];

    let overlayOptions: HTMLElement[] = [];
    for (const root of searchRoots) {
      if (!root) continue;
      const opts = Array.from(root.querySelectorAll<HTMLElement>(
        '[role="option"], mat-option, .mat-option, .mat-mdc-option'
      ));
      if (opts.length > 0) {
        overlayOptions = opts;
        break;
      }
    }

    const matchedOption = overlayOptions.find(opt => {
      const text = opt.textContent?.trim().toLowerCase() || '';
      if ((normIdType.includes('aadhaar') || normIdType.includes('aadhar')) && (text.includes('aadhaar') || text.includes('aadhar'))) {
        return true;
      }
      if (normIdType.includes('passport') && text.includes('passport')) return true;
      if (normIdType.includes('voter') && text.includes('voter')) return true;
      if (normIdType.includes('pan') && text.includes('pan')) return true;
      return text.includes(normIdType);
    });

    if (matchedOption) {
      matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      matchedOption.click();
      matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      await wait(80);
      return true;
    }
  } catch (err) {
    logger.debug('Photo ID Proof dropdown exception:', err);
  }

  // Fallback for custom input
  if (control instanceof HTMLInputElement) {
    setNativeValue(control, idTypeValue || 'Aadhaar Card');
    return true;
  }

  return false;
}

/**
 * Wait until the pilgrim form is present and has required fields
 */
export async function waitForPilgrimForm(
  timeout: number = 5000,
  doc: Document = document,
): Promise<Element | null> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const nameField = findField({
      labels: ['name', 'full name', 'pilgrim name', 'devotee name'],
      type: 'text',
      excludeKeywords: ['login', 'user', 'email'],
    }, doc);

    const ageField = findField({
      labels: ['age', 'pilgrim age'],
      type: 'number',
    }, doc);

    if (nameField && ageField) {
      return nameField.closest('form, table, .card, .pilgrim-row, [role="table"]') || doc.body;
    }

    await wait(100);
  }

  return null;
}

/**
 * Fill a single pilgrim entry (e.g., Pilgrim 1, Pilgrim 2, etc.)
 */
/**
 * Fill a single pilgrim row strictly scoped to that row's container.
 * Performs 3-state tracking: DETECTED -> FILLED -> VALIDATED.
 * Never exposes sensitive Aadhaar/ID numbers in logs or outputs.
 */
export async function autofillPilgrimRow(
  group: PilgrimFormGroup,
  pilgrim: Pilgrim,
  usedElements: Set<Element>,
  doc: Document = document,
): Promise<PilgrimRowReport> {
  const pIndex = group.index;
  const pilgrimName = pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`.trim() || `Pilgrim ${pIndex + 1}`;
  const errors: string[] = [];

  const fieldsStatus: Record<string, PilgrimFormFieldStatus> = {
    name: { fieldType: 'name', label: 'Name', detected: false, filled: false, validated: false },
    age: { fieldType: 'age', label: 'Age', detected: false, filled: false, validated: false },
    gender: { fieldType: 'gender', label: 'Gender', detected: false, filled: false, validated: false },
    photoIdProof: { fieldType: 'photoIdProof', label: 'Photo ID Proof', detected: false, filled: false, validated: false },
    photoIdNumber: { fieldType: 'photoIdNumber', label: 'Photo ID Number', detected: false, filled: false, validated: false },
  };

  // 1. Name Field (Strictly Scoped)
  const nameInput = findFieldInContainer(group.container, {
    labels: ['name', 'full name', 'pilgrim name', 'devotee name'],
    type: 'text',
    excludeKeywords: ['user', 'login', 'email', 'id', 'photo', 'booking', 'otp'],
  }, usedElements, doc) as HTMLInputElement | null;

  if (nameInput) {
    usedElements.add(nameInput);
    fieldsStatus.name.detected = true;
    const nameVal = pilgrimName;
    dispatchAngularCompatibleEvents(nameInput, nameVal);
    fieldsStatus.name.filled = (nameInput.value === nameVal);
    fieldsStatus.name.validated = fieldsStatus.name.filled;
    fieldsStatus.name.maskedValue = nameVal;
  } else {
    errors.push(`Pilgrim ${pIndex + 1}: Name field not detected in row`);
    fieldsStatus.name.error = 'Field not detected';
  }

  await wait(60);

  // 2. Age Field (Strictly Scoped)
  const ageInput = findFieldInContainer(group.container, {
    labels: ['age', 'pilgrim age'],
    type: 'number',
  }, usedElements, doc) as HTMLInputElement | null;

  if (ageInput) {
    usedElements.add(ageInput);
    fieldsStatus.age.detected = true;
    const ageVal = pilgrim.age ? String(pilgrim.age) : '35';
    dispatchAngularCompatibleEvents(ageInput, ageVal);
    fieldsStatus.age.filled = (ageInput.value === ageVal);
    fieldsStatus.age.validated = fieldsStatus.age.filled;
    fieldsStatus.age.maskedValue = ageVal;
  } else {
    errors.push(`Pilgrim ${pIndex + 1}: Age field not detected in row`);
    fieldsStatus.age.error = 'Field not detected';
  }

  await wait(60);

  // 3. Gender Control (Dropdown, Radios, Angular Material)
  const genderControl = findFieldInContainer(group.container, {
    labels: ['gender', 'sex'],
    type: 'select',
  }, usedElements, doc);

  if (genderControl) {
    usedElements.add(genderControl);
    fieldsStatus.gender.detected = true;
    const genderVal = pilgrim.gender || 'Male';
    const selected = await setGenderDropdown(genderControl, genderVal, doc);
    fieldsStatus.gender.filled = selected;
    fieldsStatus.gender.validated = selected;
    fieldsStatus.gender.maskedValue = genderVal;
  } else {
    // Check for radio buttons in this row container
    const radios = Array.from(group.container.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      .filter(r => !usedElements.has(r));
    const targetRadio = radios.find(r => {
      const val = (r.value || '').toLowerCase();
      const normG = (pilgrim.gender || 'male').toLowerCase();
      return val.includes(normG) || (normG.startsWith('m') && val === 'm') || (normG.startsWith('f') && val === 'f');
    });
    if (targetRadio) {
      usedElements.add(targetRadio);
      fieldsStatus.gender.detected = true;
      targetRadio.click();
      targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsStatus.gender.filled = true;
      fieldsStatus.gender.validated = true;
      fieldsStatus.gender.maskedValue = pilgrim.gender || 'Male';
    } else {
      errors.push(`Pilgrim ${pIndex + 1}: Gender control not detected in row`);
      fieldsStatus.gender.error = 'Control not detected';
    }
  }

  await wait(60);

  // 4. Photo ID Proof Dropdown
  const photoIdProofControl = findFieldInContainer(group.container, {
    labels: ['photo id proof', 'photo id type', 'id proof', 'identity proof', 'id type'],
    type: 'select',
    excludeKeywords: ['number', 'no', 'digit'],
  }, usedElements, doc);

  if (photoIdProofControl) {
    usedElements.add(photoIdProofControl);
    fieldsStatus.photoIdProof.detected = true;
    const idTypeVal = pilgrim.idType || 'Aadhaar Card';
    const selected = await setPhotoIdProofDropdown(photoIdProofControl, idTypeVal, doc);
    fieldsStatus.photoIdProof.filled = selected;
    fieldsStatus.photoIdProof.validated = selected;
    fieldsStatus.photoIdProof.maskedValue = idTypeVal;
  } else {
    errors.push(`Pilgrim ${pIndex + 1}: Photo ID Proof dropdown not detected in row`);
    fieldsStatus.photoIdProof.error = 'Dropdown not detected';
  }

  await wait(60);

  // 5. Photo ID Number Field (Strictly Scoped & Excludes Proof Dropdown)
  let photoIdNumberInput = findFieldInContainer(group.container, {
    labels: ['photo id number', 'photo id no', 'id number', 'identity card number', 'aadhaar number', 'card number', 'proof number', 'aadhaar', 'aadhar'],
    type: 'text',
    excludeKeywords: ['otp', 'login', 'user', 'booking', 'ticket', 'captcha', 'email'],
  }, usedElements, doc) as HTMLInputElement | null;

  if (photoIdNumberInput) {
    usedElements.add(photoIdNumberInput);
    fieldsStatus.photoIdNumber.detected = true;

    // If disabled, wait briefly for Angular reactive form to unlock it
    if (photoIdNumberInput.disabled) {
      const startWait = Date.now();
      while (photoIdNumberInput.disabled && Date.now() - startWait < 400) {
        await wait(50);
      }
      if (photoIdNumberInput.disabled) photoIdNumberInput.disabled = false;
    }

    let idNum = String(pilgrim.idNumber || '').trim();
    if (pilgrim.idType === 'Aadhaar' || idNum.replace(/\D/g, '').length === 12) {
      idNum = idNum.replace(/\D/g, '').slice(0, 12);
    } else {
      idNum = idNum.replace(/\s+/g, '').replace(/-/g, '');
    }

    if (idNum) {
      dispatchAngularCompatibleEvents(photoIdNumberInput, idNum);
      fieldsStatus.photoIdNumber.filled = (photoIdNumberInput.value === idNum);
      fieldsStatus.photoIdNumber.validated = fieldsStatus.photoIdNumber.filled;
      fieldsStatus.photoIdNumber.maskedValue = '••••' + idNum.slice(-4);
    } else {
      errors.push(`Pilgrim ${pIndex + 1}: Photo ID Number is empty in profile`);
      fieldsStatus.photoIdNumber.error = 'Empty ID number';
    }
  } else {
    errors.push(`Pilgrim ${pIndex + 1}: Photo ID Number field not detected in row`);
    fieldsStatus.photoIdNumber.error = 'Field not detected';
  }

  await wait(60);

  const allDetected = Object.values(fieldsStatus).every(f => f.detected);
  const allFilled = Object.values(fieldsStatus).every(f => f.filled);
  const allValidated = Object.values(fieldsStatus).every(f => f.validated);

  return {
    pilgrimIndex: pIndex,
    pilgrimName,
    fields: fieldsStatus,
    allDetected,
    allFilled,
    allValidated,
    errors,
  };
}

/**
 * Fill a single pilgrim entry (e.g., Pilgrim 1, Pilgrim 2, etc.)
 * Backward compatible helper for existing tests and callers.
 */
export async function autofillPilgrim(
  pilgrim: Pilgrim,
  index: number = 0,
  doc: Document = document,
  container?: HTMLElement,
): Promise<PilgrimFillReport> {
  if (container && container !== doc.body) {
    const group: PilgrimFormGroup = { index, container };
    const rowReport = await autofillPilgrimRow(group, pilgrim, new Set(), doc);
    return {
      index,
      nameFilled: rowReport.fields.name?.filled || false,
      ageFilled: rowReport.fields.age?.filled || false,
      genderSelected: rowReport.fields.gender?.filled || false,
      photoIdProofSelected: rowReport.fields.photoIdProof?.filled || false,
      photoIdNumberFilled: rowReport.fields.photoIdNumber?.filled || false,
      allSuccess: rowReport.allValidated,
      errors: rowReport.errors,
    };
  }

  const errors: string[] = [];
  let nameFilled = false;
  let ageFilled = false;
  let genderSelected = false;
  let photoIdProofSelected = false;
  let photoIdNumberFilled = false;

  // 1. Name Field
  const nameInput = findField({
    labels: ['name', 'full name', 'pilgrim name', 'devotee name'],
    type: 'text',
    excludeKeywords: ['user', 'login', 'email', 'id', 'photo', 'booking', 'otp'],
    index,
  }, doc, container) as HTMLInputElement | null;

  if (nameInput) {
    const val = pilgrim.fullName || `${pilgrim.firstName} ${pilgrim.lastName}`.trim();
    if (val) {
      dispatchAngularCompatibleEvents(nameInput, val);
      nameFilled = (nameInput.value === val);
    }
  } else {
    errors.push(`Name field not found for pilgrim ${index + 1}`);
  }

  await wait(80);

  // 2. Age Field
  const ageInput = findField({
    labels: ['age', 'pilgrim age'],
    type: 'number',
    index,
  }, doc, container) as HTMLInputElement | null;

  if (ageInput) {
    const ageVal = pilgrim.age ? String(pilgrim.age) : '35';
    dispatchAngularCompatibleEvents(ageInput, ageVal);
    ageFilled = (ageInput.value === ageVal);
  } else {
    errors.push(`Age field not found for pilgrim ${index + 1}`);
  }

  await wait(80);

  // 3. Gender Dropdown
  const genderControl = findField({
    labels: ['gender', 'sex'],
    type: 'select',
    index,
  }, doc, container);

  if (genderControl) {
    genderSelected = await setGenderDropdown(genderControl, pilgrim.gender || 'Male', doc);
  } else {
    errors.push(`Gender dropdown not found for pilgrim ${index + 1}`);
  }

  await wait(80);

  // 4. Photo ID Proof Dropdown
  const photoIdProofControl = findField({
    labels: ['photo id proof', 'photo id type', 'id proof', 'identity proof', 'id type'],
    type: 'select',
    excludeKeywords: ['number', 'no', 'digit'],
    index,
  }, doc, container);

  if (photoIdProofControl) {
    photoIdProofSelected = await setPhotoIdProofDropdown(photoIdProofControl, pilgrim.idType || 'Aadhaar Card', doc);
  } else {
    errors.push(`Photo ID Proof dropdown not found for pilgrim ${index + 1}`);
  }

  await wait(80);

  // 5. Photo ID Number Field
  const photoIdNumberInput = findField({
    labels: ['photo id number', 'photo id no', 'id number', 'identity card number', 'aadhaar number', 'card number', 'proof number'],
    type: 'text',
    excludeKeywords: ['otp', 'login', 'user', 'booking', 'ticket', 'captcha', 'email'],
    index,
  }, doc, container) as HTMLInputElement | null;

  if (photoIdNumberInput) {
    let idNum = String(pilgrim.idNumber || '').trim();
    if (pilgrim.idType === 'Aadhaar' || idNum.replace(/\D/g, '').length === 12) {
      idNum = idNum.replace(/\D/g, '').slice(0, 12);
    }
    if (idNum) {
      dispatchAngularCompatibleEvents(photoIdNumberInput, idNum);
      photoIdNumberFilled = (photoIdNumberInput.value === idNum);
    }
  } else {
    errors.push(`Photo ID Number field not found for pilgrim ${index + 1}`);
  }

  await wait(80);

  const allSuccess = nameFilled && ageFilled && (genderSelected || genderControl !== null) && photoIdNumberFilled;

  return {
    index,
    nameFilled,
    ageFilled,
    genderSelected,
    photoIdProofSelected,
    photoIdNumberFilled,
    allSuccess,
    errors,
  };
}

/**
 * Master entry point for autofilling TTD pilgrim forms.
 * Safe, repeatable, fully Angular synchronized.
 * N-pilgrim capable with dynamic row detection and usedElements tracking.
 */
export async function autofillTTDPilgrimForm(
  options: { pilgrims?: Pilgrim[]; profile?: any; doc?: Document } = {},
): Promise<TTDAutofillReport> {
  if (isAutofillRunning) {
    logger.warn('Autofill is already running. Ignoring duplicate trigger.');
    return {
      success: false,
      totalPilgrims: 0,
      filledPilgrims: 0,
      reports: [],
      pilgrimReports: [],
      errorMessage: 'Autofill already in progress',
    };
  }

  isAutofillRunning = true;
  const doc = options.doc || document;

  try {
    if (DEBUG_AUTOFILL) logger.info('Autofill initiated');

    // 1. Retrieve pilgrim data from options or chrome storage
    const opts = options || {};
    let pilgrimsToFill = Array.isArray(opts.pilgrims) ? opts.pilgrims : [];
    if (pilgrimsToFill.length === 0) {
      if (opts.profile && Array.isArray(opts.profile.pilgrims) && opts.profile.pilgrims.length > 0) {
        pilgrimsToFill = opts.profile.pilgrims;
      } else if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        try {
          const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
          const rawProfiles = (stored?.[STORAGE_KEYS.PROFILES] as any[]) || [];
          const profiles = Array.isArray(rawProfiles) ? rawProfiles.filter(p => p != null && typeof p === 'object') : [];
          const activeProfile = profiles.find((p: any) => p?.isDefault) || profiles[0] || null;
          if (activeProfile && Array.isArray(activeProfile.pilgrims) && activeProfile.pilgrims.length > 0) {
            pilgrimsToFill = activeProfile.pilgrims;
          }
        } catch (err: any) {
          if (!err?.message?.includes('Extension context invalidated')) {
            logger.warn('Failed to read profiles from storage:', err);
          }
        }
      }
    }

    if (!pilgrimsToFill || pilgrimsToFill.length === 0) {
      if (DEBUG_AUTOFILL) logger.warn('No saved pilgrim data available');
      return {
        success: false,
        totalPilgrims: 0,
        filledPilgrims: 0,
        reports: [],
        pilgrimReports: [],
        errorMessage: 'Complete your pilgrim profile first.',
      };
    }

    const expectedCount = pilgrimsToFill.length;
    if (DEBUG_AUTOFILL) {
      logger.info(`Profile data ready: ${expectedCount} devotee(s)`);
    }

    // 2. Wait for TTD Pilgrim Form & rows to be ready
    const formElement = await waitForPilgrimForm(5000, doc);
    if (!formElement) {
      if (DEBUG_AUTOFILL) console.warn('[SevaPilot] Pilgrim form not detected within timeout');
      return {
        success: false,
        totalPilgrims: expectedCount,
        filledPilgrims: 0,
        reports: [],
        pilgrimReports: [],
        errorMessage: 'Pilgrim form is still loading. Please try again.',
      };
    }

    // 3. Dynamically wait for expected pilgrim rows
    const detectedRows = await waitForPilgrimRows(expectedCount, 4000, doc);
    if (!detectedRows || detectedRows.length === 0) {
      return {
        success: false,
        totalPilgrims: expectedCount,
        filledPilgrims: 0,
        reports: [],
        pilgrimReports: [],
        errorMessage: `${expectedCount} pilgrim forms could not be detected.`,
      };
    }

    if (DEBUG_AUTOFILL) {
      logger.info(`Form detected: ${detectedRows.length} row container(s) for ${expectedCount} expected pilgrim(s)`);
    }

    const usedElements = new Set<Element>();
    const pilgrimReports: PilgrimRowReport[] = [];
    const legacyReports: PilgrimFillReport[] = [];

    // 4. Strict Pilgrim Index Mapping: Row[i] <- Pilgrim[i]
    const countToProcess = Math.min(detectedRows.length, expectedCount);
    for (let i = 0; i < countToProcess; i++) {
      const group: PilgrimFormGroup = {
        index: i,
        container: detectedRows[i],
      };

      const rowReport = await autofillPilgrimRow(group, pilgrimsToFill[i], usedElements, doc);
      pilgrimReports.push(rowReport);

      legacyReports.push({
        index: i,
        nameFilled: rowReport.fields.name?.filled || false,
        ageFilled: rowReport.fields.age?.filled || false,
        genderSelected: rowReport.fields.gender?.filled || false,
        photoIdProofSelected: rowReport.fields.photoIdProof?.filled || false,
        photoIdNumberFilled: rowReport.fields.photoIdNumber?.filled || false,
        allSuccess: rowReport.allValidated,
        errors: rowReport.errors,
      });
    }

    const fullyValidatedCount = pilgrimReports.filter(r => r.allValidated).length;
    const overallSuccess = fullyValidatedCount === expectedCount;

    if (DEBUG_AUTOFILL) {
      logger.info('Validation complete', {
        expected: expectedCount,
        processed: countToProcess,
        validated: fullyValidatedCount,
      });
    }

    if (overallSuccess) {
      autofocusCaptcha(doc);
    }

    return {
      success: overallSuccess,
      totalPilgrims: expectedCount,
      filledPilgrims: fullyValidatedCount,
      reports: legacyReports,
      pilgrimReports,
      errorMessage: overallSuccess ? undefined : `${fullyValidatedCount} / ${expectedCount} pilgrims ready`,
    };
  } catch (error) {
    logger.error('Error during TTD pilgrim autofill:', error);
    return {
      success: false,
      totalPilgrims: 0,
      filledPilgrims: 0,
      reports: [],
      pilgrimReports: [],
      errorMessage: error instanceof Error ? error.message : 'Unknown execution failure',
    };
  } finally {
    isAutofillRunning = false;
  }
}

/**
 * Focus the CAPTCHA field and scroll it into view smoothly so the devotee can solve it instantly
 */
export function autofocusCaptcha(doc: Document = document): boolean {
  try {
    const captchaInput = doc.querySelector<HTMLInputElement>(
      "input[placeholder*='captcha' i], input[formcontrolname*='captcha' i], input[name*='captcha' i], input[id*='captcha' i], #captchaInput, .captcha-input, input[aria-label*='captcha' i]"
    );
    if (captchaInput) {
      captchaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      captchaInput.focus();
      return true;
    }
  } catch {}
  return false;
}

/** Alias for step 1 */
export const autofillPilgrimDetails = autofillTTDPilgrimForm;

export type TTDBookingStep = 'pilgrim' | 'general' | 'unknown';

export interface GeneralFillReport {
  emailFilled: boolean;
  mobileFilled: boolean;
  cityFilled: boolean;
  stateSelected: boolean;
  countrySelected: boolean;
  pincodeFilled: boolean;
  allSuccess: boolean;
  errors: string[];
}

export interface TTDStepAutofillResult {
  success: boolean;
  step: TTDBookingStep;
  statusText: string;
  pilgrimReport?: TTDAutofillReport;
  generalReport?: GeneralFillReport;
  errorMessage?: string;
}

/**
 * Detect if the currently visible form is General Details (Step 2)
 */
export function isGeneralDetailsPage(doc: Document = document): boolean {
  // Check visible headings
  const headings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, .card-title, .mat-card-title, .section-header, .mat-headline, legend, strong'
  )).filter(isElementVisible);

  const hasGeneralHeading = headings.some(h => {
    const text = cleanText(h.textContent || '');
    return text.includes('general details') || text.includes('contact details') || text.includes('address details');
  });

  // Check specific fields that ONLY exist in General Details
  const emailField = findField({
    labels: ['email id', 'enter email id', 'enter email', 'email', 'e-mail'],
    type: 'text',
    excludeKeywords: ['login', 'username', 'user'],
  }, doc) || doc.querySelector('input[type="email"], input[formcontrolname*="email" i]');

  const cityField = findField({
    labels: ['enter city', 'city', 'town'],
    type: 'text',
  }, doc) || doc.querySelector('input[formcontrolname*="city" i], input[placeholder*="city" i]');

  const pincodeField = findField({
    labels: ['enter pincode', 'pin code', 'pincode', 'postal code', 'zip'],
    type: 'text',
  }, doc) || doc.querySelector('input[formcontrolname*="pin" i], input[formcontrolname*="zip" i], input[placeholder*="pincode" i]');

  const generalFieldCount = [emailField, cityField, pincodeField].filter(Boolean).length;

  if (hasGeneralHeading && generalFieldCount >= 1) return true;
  if (generalFieldCount >= 2) return true;

  return false;
}

/**
 * Detect if the currently visible form is Pilgrim Details (Step 1)
 */
export function isPilgrimDetailsPage(doc: Document = document): boolean {
  // If General Details is actively visible, we are NOT on Pilgrim Details
  if (isGeneralDetailsPage(doc)) return false;

  const headings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, .card-title, .mat-card-title, .section-header, .mat-headline, legend, strong'
  )).filter(isElementVisible);

  const hasPilgrimHeading = headings.some(h => {
    const text = cleanText(h.textContent || '');
    return text.includes('pilgrim details') || text.includes('devotee details') || text.includes('pilgrim') || text.includes('special entry darshan');
  });

  const nameField = findField({
    labels: ['name', 'full name', 'pilgrim name', 'devotee name'],
    type: 'text',
    excludeKeywords: ['login', 'user', 'email'],
  }, doc);

  const ageField = findField({
    labels: ['age', 'pilgrim age'],
    type: 'number',
  }, doc);

  const photoIdNumberField = findField({
    labels: ['photo id number', 'photo id no', 'id number'],
    type: 'text',
    excludeKeywords: ['otp', 'login', 'booking'],
  }, doc);

  const pilgrimFieldCount = [nameField, ageField, photoIdNumberField].filter(Boolean).length;

  if (hasPilgrimHeading && pilgrimFieldCount >= 1) return true;
  if (pilgrimFieldCount >= 2) return true;

  return false;
}

/**
 * Determine the currently visible TTD booking step ('pilgrim' | 'general' | 'unknown')
 */
export function detectTTDBookingStep(doc: Document = document): TTDBookingStep {
  if (isGeneralDetailsPage(doc)) {
    return 'general';
  }
  if (isPilgrimDetailsPage(doc)) {
    return 'pilgrim';
  }
  return 'unknown';
}

/**
 * Helper to set value on a select dropdown, Angular Material mat-select, or input element
 */
export async function setSelectOrInputValue(
  control: HTMLElement,
  value: string,
  doc: Document = document,
): Promise<boolean> {
  if (!control || !value) return false;
  const normVal = value.trim().toLowerCase();
  const isMaleVal = normVal === 'male' || normVal === 'm';
  const isFemaleVal = normVal === 'female' || normVal === 'f';

  // 1. Native Select
  if (control instanceof HTMLSelectElement) {
    const options = Array.from(control.options);
    const target = options.find(opt => {
      const text = opt.textContent?.trim().toLowerCase() || '';
      const val = opt.value.trim().toLowerCase();
      if (isMaleVal) {
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male' || text === 'm' || val === 'm' || /\bmale\b/i.test(text) || /\bmale\b/i.test(val);
      }
      if (isFemaleVal) {
        return text === 'female' || val === 'female' || text === 'f' || val === 'f' || /\bfemale\b/i.test(text) || /\bfemale\b/i.test(val);
      }
      return text.includes(normVal) || val.includes(normVal) || normVal.includes(text);
    });
    if (target) {
      control.value = target.value;
      control.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  // 2. Angular Material Select or custom dropdown
  if (control.tagName === 'MAT-SELECT' || control.getAttribute('role') === 'combobox' || control.classList.contains('mat-select')) {
    try {
      control.focus();
      control.click();
      await wait(120);

      const overlayOptions = Array.from(doc.querySelectorAll<HTMLElement>(
        '.cdk-overlay-container [role="option"], mat-option, .mat-option, .mat-mdc-option, [role="option"]'
      ));

      const matchedOption = overlayOptions.find(opt => {
        const text = opt.textContent?.trim().toLowerCase() || '';
        const val = (opt.getAttribute('value') || opt.getAttribute('ng-reflect-value') || '').toLowerCase().trim();
        if (isMaleVal) {
          if (text.includes('female') || val.includes('female')) return false;
          return text === 'male' || val === 'male' || text === 'm' || val === 'm' || /\bmale\b/i.test(text) || /\bmale\b/i.test(val);
        }
        if (isFemaleVal) {
          return text === 'female' || val === 'female' || text === 'f' || val === 'f' || /\bfemale\b/i.test(text) || /\bfemale\b/i.test(val);
        }
        return text.includes(normVal) || normVal.includes(text);
      });

      if (matchedOption) {
        matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        matchedOption.click();
        matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        await wait(80);
        return true;
      }
    } catch {}
  }

  // 3. Text / input element
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    dispatchAngularCompatibleEvents(control, value);
    return control.value === value;
  }

  return false;
}

/**
 * Step 2 — Autofill General Details (Email ID, Mobile, City, State, Country, PIN code)
 */
export async function autofillGeneralDetails(
  options: { profile?: any; pilgrims?: Pilgrim[]; doc?: Document } = {},
): Promise<GeneralFillReport> {
  const doc = options.doc || document;
  const errors: string[] = [];

  if (DEBUG_AUTOFILL) {
    logger.info('Current TTD step: general');
    logger.info('General form detected');
  }

  // 1. Get profile data
  const opts = options || {};
  let profile = opts.profile;
  if (!profile) {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
      const rawProfiles = (stored?.[STORAGE_KEYS.PROFILES] as any[]) || [];
      const profiles = Array.isArray(rawProfiles) ? rawProfiles.filter(p => p != null && typeof p === 'object') : [];
      profile = profiles.find((p: any) => p?.isDefault) || profiles[0] || null;
    } catch {}
  }

  const primaryPilgrim = (profile?.pilgrims && Array.isArray(profile.pilgrims) ? profile.pilgrims[0] : null) || (opts?.pilgrims && Array.isArray(opts.pilgrims) ? opts.pilgrims[0] : null) || profile || {};
  const g = profile?.general || {};

  const emailVal = g.email || primaryPilgrim.email || profile?.email || '';
  const mobileVal = (g.mobile || primaryPilgrim.mobile || profile?.mobile || '').replace(/\D/g, '').slice(0, 10);
  const cityVal = g.city || primaryPilgrim.city || profile?.city || '';
  const stateVal = g.state || primaryPilgrim.state || profile?.state || '';
  const countryVal = g.country || primaryPilgrim.country || profile?.country || 'India';
  const pincodeVal = (g.pincode || g.pinCode || primaryPilgrim.pinCode || primaryPilgrim.pincode || profile?.pinCode || '').replace(/\D/g, '').slice(0, 6);

  let emailFilled = false;
  let mobileFilled = false;
  let cityFilled = false;
  let stateSelected = false;
  let countrySelected = false;
  let pincodeFilled = false;

  // 1. Email ID
  const emailInput = (findField({
    labels: ['email id', 'enter email id', 'enter email', 'email', 'e-mail'],
    type: 'text',
    excludeKeywords: ['login', 'user'],
  }, doc) || doc.querySelector('input[type="email"], input[formcontrolname*="email" i], input[name*="email" i], input[id*="email" i]')) as HTMLInputElement | null;

  if (emailInput) {
    if (DEBUG_AUTOFILL) logger.info('Email field found');
    if (emailVal) {
      dispatchAngularCompatibleEvents(emailInput, emailVal);
      emailFilled = (emailInput.value === emailVal);
      if (DEBUG_AUTOFILL) logger.info('Email filled');
    }
  } else {
    errors.push('Email ID field not found');
  }

  await wait(100);

  // 2. Mobile
  const mobileInput = (findField({
    labels: ['mobile', 'mobile number', 'phone', 'contact number'],
    type: 'text',
    excludeKeywords: ['otp'],
  }, doc) || doc.querySelector('input[formcontrolname*="mobile" i], input[formcontrolname*="phone" i], input[type="tel"]')) as HTMLInputElement | null;

  if (mobileInput) {
    if (DEBUG_AUTOFILL) logger.info('Mobile field found');
    if (mobileVal) {
      dispatchAngularCompatibleEvents(mobileInput, mobileVal);
      mobileFilled = (mobileInput.value === mobileVal);
      if (DEBUG_AUTOFILL) logger.info('Mobile filled: [REDACTED]');
    }
  } else {
    errors.push('Mobile field not found');
  }

  await wait(100);

  // 3. City
  const cityInput = (findField({
    labels: ['enter city', 'city', 'town'],
    type: 'text',
  }, doc) || doc.querySelector('input[formcontrolname*="city" i], input[placeholder*="city" i], input[name*="city" i]')) as HTMLInputElement | null;

  if (cityInput) {
    if (DEBUG_AUTOFILL) logger.info('City field found');
    if (cityVal) {
      dispatchAngularCompatibleEvents(cityInput, cityVal);
      cityFilled = (cityInput.value === cityVal);
      if (DEBUG_AUTOFILL) logger.info('City filled');
    }
  } else {
    errors.push('City field not found');
  }

  await wait(100);

  // 4. State (Dropdown or Input)
  const stateControl = findField({
    labels: ['state', 'select state', 'province'],
    type: 'any',
  }, doc) || doc.querySelector('mat-select[formcontrolname*="state" i], select[formcontrolname*="state" i], input[formcontrolname*="state" i]');

  if (stateControl) {
    if (DEBUG_AUTOFILL) logger.info('State control found');
    if (stateVal) {
      stateSelected = await setSelectOrInputValue(stateControl, stateVal, doc);
      if (DEBUG_AUTOFILL) logger.info('State selected');
    }
  } else {
    errors.push('State control not found');
  }

  await wait(100);

  // 5. Country (Dropdown or Input)
  const countryControl = findField({
    labels: ['country', 'select country', 'nationality'],
    type: 'any',
  }, doc) || doc.querySelector('mat-select[formcontrolname*="country" i], select[formcontrolname*="country" i], input[formcontrolname*="country" i]');

  if (countryControl) {
    if (DEBUG_AUTOFILL) logger.info('Country control found');
    countrySelected = await setSelectOrInputValue(countryControl, countryVal || 'India', doc);
    if (DEBUG_AUTOFILL) logger.info('Country selected');
  } else {
    errors.push('Country control not found');
  }

  await wait(100);

  // 6. PIN code
  const pincodeInput = (findField({
    labels: ['enter pincode', 'pin code', 'pincode', 'postal code', 'zip'],
    type: 'text',
  }, doc) || doc.querySelector('input[formcontrolname*="pin" i], input[formcontrolname*="zip" i], input[placeholder*="pincode" i], input[name*="pincode" i]')) as HTMLInputElement | null;

  if (pincodeInput) {
    if (DEBUG_AUTOFILL) logger.info('PIN code field found');
    if (pincodeVal) {
      dispatchAngularCompatibleEvents(pincodeInput, pincodeVal);
      pincodeFilled = (pincodeInput.value === pincodeVal);
      if (DEBUG_AUTOFILL) logger.info('PIN code filled: [REDACTED]');
    }
  } else {
    errors.push('PIN code field not found');
  }

  await wait(100);

  if (DEBUG_AUTOFILL) logger.info('Validation complete');

  const allSuccess = (emailFilled || !emailInput) && (cityFilled || !cityInput) && (pincodeFilled || !pincodeInput);

  return {
    emailFilled,
    mobileFilled,
    cityFilled,
    stateSelected,
    countrySelected,
    pincodeFilled,
    allSuccess,
    errors,
  };
}

/**
 * Master step-aware autofill entry point.
 * Enforces: STEP 1 (Pilgrim Details) -> STEP 2 (General Details)
 * Never fills General Details if user is on Pilgrim Details.
 * Never clicks Continue.
 */
export async function handleTTDAutofill(
  options: { doc?: Document; pilgrims?: Pilgrim[]; profile?: any } = {},
): Promise<TTDStepAutofillResult> {
  const doc = options.doc || document;
  const step = detectTTDBookingStep(doc);

  if (DEBUG_AUTOFILL) {
    logger.info(`Current TTD step: ${step}`);
  }

  switch (step) {
    case 'pilgrim': {
      const pilgrimReport = await autofillTTDPilgrimForm(options);
      return {
        success: pilgrimReport.success,
        step: 'pilgrim',
        statusText: pilgrimReport.success ? '✓ Pilgrim details filled' : '⚠ Some fields need attention',
        pilgrimReport,
      };
    }

    case 'general': {
      const generalReport = await autofillGeneralDetails(options);
      return {
        success: generalReport.allSuccess,
        step: 'general',
        statusText: generalReport.allSuccess ? '✓ General details filled' : '⚠ Some fields need attention',
        generalReport,
      };
    }

    default: {
      return {
        success: false,
        step: 'unknown',
        statusText: '⚠ TTD booking form not detected',
        errorMessage: 'TTD booking form not detected',
      };
    }
  }
}
