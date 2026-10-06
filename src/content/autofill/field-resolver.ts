// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Resolver
// Semantic multi-signal field detection with confidence scoring,
// collision prevention, and positive/negative signal matching
// ─────────────────────────────────────────────────

import logger from '@shared/logger';
import { getFieldContract } from './field-contracts';

// ─── Types ───

export interface FieldFingerprint {
  tagName: string;
  name?: string;
  id?: string;
  label?: string;
  type?: string;
  index?: number;
}

export function createFieldFingerprint(el: HTMLElement, index?: number): FieldFingerprint {
  return {
    tagName: el.tagName?.toLowerCase() || '',
    name: el.getAttribute('name') || undefined,
    id: el.id || undefined,
    label: el.getAttribute('aria-label') || undefined,
    type: el.getAttribute('type') || undefined,
    index,
  };
}

export type PilgrimFieldType = 'name' | 'age' | 'gender' | 'photoIdProof' | 'photoIdNumber';

export type GeneralFieldType = 'gothram' | 'email' | 'mobile' | 'city' | 'state' | 'country' | 'pinCode' | 'pincode';

export type LogicalFieldType = PilgrimFieldType | GeneralFieldType;

export interface FieldResolution {
  element: HTMLElement;
  field: LogicalFieldType;
  confidence: number;
  strategy: string;
  reasons: string[];
}

export interface FieldResolutionFailure {
  field: LogicalFieldType;
  confidence: 0;
  strategy: 'none';
  reasons: string[];
}

export type FieldResolutionResult = FieldResolution | FieldResolutionFailure;


// ─── Signal Definitions ───

interface FieldSignalProfile {
  positiveLabels: string[];
  negativeLabels: string[];
  /** Expected element types: 'text' | 'number' | 'select' | 'email' | 'tel' */
  expectedTypes: string[];
  /** formControlName patterns */
  formControlNames: string[];
  /** name attribute patterns */
  nameAttrs: string[];
  /** aria-label patterns */
  ariaLabels: string[];
  /** placeholder patterns */
  placeholders: string[];
}

const FIELD_SIGNALS: Record<LogicalFieldType, FieldSignalProfile> = {
  gothram: {
    positiveLabels: ['gothram', 'gotram', 'gothra', 'gotra', 'kulagothram', 'kula gothram'],
    negativeLabels: ['name', 'login', 'user', 'email', 'mobile', 'id', 'age', 'gender', 'city', 'state'],
    expectedTypes: ['text'],
    formControlNames: ['gothram', 'gotram', 'gothra', 'gotra'],
    nameAttrs: ['gothram', 'gotram', 'gothra', 'gotra'],
    ariaLabels: ['gothram', 'gotram', 'gothra'],
    placeholders: ['gothram', 'enter gothram', 'gotram', 'gotra'],
  },
  name: {
    positiveLabels: ['name', 'full name', 'pilgrim name', 'devotee name', 'your name'],
    negativeLabels: ['user', 'login', 'email', 'id', 'photo', 'booking', 'otp', 'captcha', 'search', 'password', 'phone', 'mobile', 'city', 'state', 'country', 'pin'],
    expectedTypes: ['text'],
    formControlNames: ['name', 'pilgrimname', 'devoteename', 'fullname', 'firstname'],
    nameAttrs: ['name', 'pilgrimName', 'devoteeName', 'fullName'],
    ariaLabels: ['name', 'pilgrim name', 'devotee name', 'full name'],
    placeholders: ['name', 'enter name', 'pilgrim name', 'devotee name', 'full name'],
  },
  age: {
    positiveLabels: ['age', 'pilgrim age', 'years', 'devotee age'],
    negativeLabels: ['page', 'stage', 'image', 'package', 'luggage', 'passage'],
    expectedTypes: ['number', 'text'],
    formControlNames: ['age', 'pilgrimage', 'devoteeage'],
    nameAttrs: ['age', 'pilgrimAge'],
    ariaLabels: ['age', 'pilgrim age'],
    placeholders: ['age', 'enter age', 'years'],
  },
  gender: {
    positiveLabels: ['gender', 'sex'],
    negativeLabels: ['number', 'id', 'proof', 'card', 'email', 'mobile', 'phone', 'name', 'age'],
    expectedTypes: ['select'],
    formControlNames: ['gender', 'sex'],
    nameAttrs: ['gender', 'sex'],
    ariaLabels: ['gender', 'sex'],
    placeholders: ['gender', 'select gender'],
  },
  photoIdProof: {
    positiveLabels: ['photo id proof', 'photo id type', 'id proof', 'identity proof', 'id type', 'proof type', 'document type'],
    negativeLabels: ['number', 'no', 'digit', 'card number', 'id number', 'photo id number'],
    expectedTypes: ['select'],
    formControlNames: ['photoidproof', 'idproof', 'idtype', 'prooftype', 'identityproof', 'photoidtype'],
    nameAttrs: ['photoIdProof', 'idProof', 'idType', 'proofType'],
    ariaLabels: ['photo id proof', 'id proof', 'id type', 'identity proof'],
    placeholders: ['select id proof', 'id proof', 'select id type', 'photo id proof'],
  },
  photoIdNumber: {
    positiveLabels: ['photo id number', 'photo id no', 'id number', 'identity card number', 'aadhaar number', 'aadhar number', 'card number', 'proof number', 'aadhaar', 'aadhar', 'identity number', 'document number'],
    negativeLabels: ['otp', 'login', 'user', 'booking', 'ticket', 'captcha', 'email', 'mobile', 'phone', 'password', 'age', 'pin'],
    expectedTypes: ['text'],
    formControlNames: ['photoidnumber', 'idnumber', 'proofnumber', 'aadhaarnumber', 'identitynumber', 'cardnumber'],
    nameAttrs: ['photoIdNumber', 'idNumber', 'proofNumber', 'aadhaarNumber'],
    ariaLabels: ['photo id number', 'id number', 'aadhaar number', 'identity number'],
    placeholders: ['id number', 'enter id number', 'photo id number', 'aadhaar number', 'enter aadhaar'],
  },
  email: {
    positiveLabels: ['email', 'e-mail', 'email address', 'mail'],
    negativeLabels: ['name', 'login', 'user', 'otp', 'password'],
    expectedTypes: ['email', 'text'],
    formControlNames: ['email', 'emailaddress', 'emailid'],
    nameAttrs: ['email', 'emailAddress'],
    ariaLabels: ['email', 'email address'],
    placeholders: ['email', 'enter email', 'email address'],
  },
  mobile: {
    positiveLabels: ['mobile', 'phone', 'mobile number', 'phone number', 'contact number', 'cell'],
    negativeLabels: ['otp', 'login', 'password', 'name', 'email', 'id'],
    expectedTypes: ['tel', 'text', 'number'],
    formControlNames: ['mobile', 'phone', 'mobilenumber', 'phonenumber', 'contactnumber'],
    nameAttrs: ['mobile', 'phone', 'mobileNumber', 'phoneNumber'],
    ariaLabels: ['mobile', 'phone', 'mobile number', 'phone number'],
    placeholders: ['mobile', 'phone', 'enter mobile', 'mobile number'],
  },
  city: {
    positiveLabels: ['city', 'town', 'district'],
    negativeLabels: ['state', 'country', 'pin', 'email', 'mobile'],
    expectedTypes: ['text'],
    formControlNames: ['city', 'town', 'district'],
    nameAttrs: ['city', 'town'],
    ariaLabels: ['city', 'town'],
    placeholders: ['city', 'enter city', 'town'],
  },
  state: {
    positiveLabels: ['state', 'province', 'region'],
    negativeLabels: ['country', 'city', 'pin', 'email', 'mobile', 'status'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['state', 'province', 'region'],
    nameAttrs: ['state', 'province'],
    ariaLabels: ['state', 'province'],
    placeholders: ['state', 'select state', 'province'],
  },
  country: {
    positiveLabels: ['country', 'nation', 'nationality'],
    negativeLabels: ['state', 'city', 'pin', 'email', 'mobile'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['country', 'nation', 'nationality'],
    nameAttrs: ['country', 'nation'],
    ariaLabels: ['country', 'nation'],
    placeholders: ['country', 'select country', 'nation'],
  },
  pinCode: {
    positiveLabels: ['pin code', 'pincode', 'pin', 'zip', 'zip code', 'postal code', 'postal'],
    negativeLabels: ['otp', 'password', 'login', 'email', 'mobile', 'phone'],
    expectedTypes: ['text', 'number'],
    formControlNames: ['pincode', 'pin', 'zipcode', 'zip', 'postalcode'],
    nameAttrs: ['pinCode', 'pincode', 'zip', 'zipCode', 'postalCode'],
    ariaLabels: ['pin code', 'pincode', 'zip code', 'postal code'],
    placeholders: ['pin code', 'pincode', 'zip', 'zip code', 'postal code', 'enter pincode'],
  },
  pincode: {
    positiveLabels: ['pin code', 'pincode', 'pin', 'zip', 'zip code', 'postal code', 'postal'],
    negativeLabels: ['otp', 'password', 'login', 'email', 'mobile', 'phone'],
    expectedTypes: ['text', 'number'],
    formControlNames: ['pincode', 'pin', 'zipcode', 'zip', 'postalcode'],
    nameAttrs: ['pinCode', 'pincode', 'zip', 'zipCode', 'postalCode'],
    ariaLabels: ['pin code', 'pincode', 'zip code', 'postal code'],
    placeholders: ['pin code', 'pincode', 'zip', 'zip code', 'postal code', 'enter pincode'],
  },
};

// Minimum confidence to consider a resolution valid (below 50 is ambiguous)
export const SAFE_CONFIDENCE_THRESHOLD = 50;

// ─── Helpers ───

const CLEAN = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const NORM = (s: string): string => s.toLowerCase().replace(/[*:_\-./\\()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.getAttribute('type') === 'hidden') return false;
  const win = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
  if (win?.getComputedStyle) {
    const style = win.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }
  // jsdom doesn't support layout, so skip offset checks
  if (typeof navigator !== 'undefined' && navigator?.userAgent?.includes('jsdom')) {
    return true;
  }
  return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
}

function isSelectLikeElement(el: HTMLElement): boolean {
  if (el instanceof HTMLSelectElement) return true;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'mat-select') return true;
  const role = el.getAttribute('role');
  if (role === 'combobox' || role === 'listbox') return true;
  if (el.classList.contains('mat-select') || el.classList.contains('mat-mdc-select')) return true;
  if (el.classList.contains('p-dropdown') || tag === 'p-dropdown' || tag === 'ng-select') return true;
  return false;
}

function isInputElement(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function getElementType(el: HTMLElement): string {
  if (el instanceof HTMLSelectElement) return 'select';
  if (isSelectLikeElement(el)) return 'select';
  if (el instanceof HTMLInputElement) {
    return el.type || 'text';
  }
  if (el instanceof HTMLTextAreaElement) return 'text';
  return 'unknown';
}

/**
 * Get the associated label text for an element using multiple strategies.
 */
function getAssociatedLabelText(el: HTMLElement, container: HTMLElement, doc: Document): string {
  // 1. <label for="id">
  if (el.id) {
    const label = container.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      || doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return NORM(label.textContent);
  }

  // 2. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return NORM(parentLabel.textContent);

  // 3. Angular Material form field
  const matFormField = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group');
  if (matFormField) {
    const matLabel = matFormField.querySelector('mat-label, label, .mat-mdc-floating-label');
    if (matLabel?.textContent && !matLabel.contains(el)) return NORM(matLabel.textContent);
  }

  // 4. Preceding sibling label/span
  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'B' || prev.tagName === 'STRONG') && prev.textContent) {
    return NORM(prev.textContent);
  }

  // 5. Column/group container label
  const colOrGroup = el.closest('[class*="col"], td, .field-wrap, th');
  if (colOrGroup && colOrGroup !== container && colOrGroup !== doc.body) {
    const lbl = colOrGroup.querySelector('mat-label, label, .mat-mdc-floating-label, span, b, strong');
    if (lbl?.textContent && !lbl.contains(el)) return NORM(lbl.textContent);
  }

  return '';
}

/**
 * Score an element against a field signal profile.
 * Returns confidence (0-100) and reasons array.
 */
function scoreElement(
  el: HTMLElement,
  fieldType: LogicalFieldType,
  container: HTMLElement,
  doc: Document,
): { confidence: number; reasons: string[]; strategy: string } {
  const signals = FIELD_SIGNALS[fieldType];
  let score = 0;
  const reasons: string[] = [];
  const strategies: string[] = [];

  const elemType = getElementType(el);
  const formControlName = CLEAN(el.getAttribute('formcontrolname') || '');
  const nameAttr = CLEAN(el.getAttribute('name') || '');
  const ariaLabel = NORM(el.getAttribute('aria-label') || '');
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  const placeholder = NORM((el as HTMLInputElement).placeholder || '');
  const id = CLEAN(el.id || '');
  const ngReflectName = CLEAN(el.getAttribute('ng-reflect-name') || '');
  const labelText = getAssociatedLabelText(el, container, doc);

  // Negative signal check (disqualifier)
  const allText = `${labelText} ${ariaLabel} ${placeholder} ${formControlName} ${nameAttr} ${id}`.toLowerCase();
  for (const neg of signals.negativeLabels) {
    const negClean = CLEAN(neg);
    if (negClean.length <= 2) {
      // Short negatives: use word boundary match
      if (new RegExp(`\\b${negClean}\\b`, 'i').test(allText)) {
        return { confidence: 0, reasons: [`Negative signal: "${neg}" found`], strategy: 'rejected' };
      }
    } else {
      if (allText.includes(negClean)) {
        return { confidence: 0, reasons: [`Negative signal: "${neg}" found`], strategy: 'rejected' };
      }
    }
  }

  // 1. formControlName match (highest priority, very high confidence)
  if (formControlName) {
    for (const fcn of signals.formControlNames) {
      if (formControlName === CLEAN(fcn) || formControlName.includes(CLEAN(fcn))) {
        score += 95;
        reasons.push(`formControlName="${el.getAttribute('formcontrolname')}" matches "${fcn}"`);
        strategies.push('formControlName');
        break;
      }
    }
  }

  // 2. name attribute match (high confidence)
  if (nameAttr) {
    for (const na of signals.nameAttrs) {
      if (nameAttr === CLEAN(na) || nameAttr.includes(CLEAN(na))) {
        score += 88;
        reasons.push(`name="${el.getAttribute('name')}" matches "${na}"`);
        strategies.push('name');
        break;
      }
    }
  }

  // 3. aria-label match (medium/high confidence)
  if (ariaLabel) {
    for (const al of signals.ariaLabels) {
      if (ariaLabel.includes(al.toLowerCase())) {
        score += 82;
        reasons.push(`aria-label matches "${al}"`);
        strategies.push('aria-label');
        break;
      }
    }
  }

  // 4. aria-labelledby match (medium confidence)
  if (ariaLabelledBy) {
    const labelledEl = doc.getElementById(ariaLabelledBy);
    if (labelledEl?.textContent) {
      const lblText = NORM(labelledEl.textContent);
      for (const pl of signals.positiveLabels) {
        if (lblText.includes(pl.toLowerCase())) {
          score += 80;
          reasons.push(`aria-labelledby text matches "${pl}"`);
          strategies.push('aria-labelledby');
          break;
        }
      }
    }
  }

  // 5. Associated label match (medium confidence)
  if (labelText) {
    for (const pl of signals.positiveLabels) {
      if (labelText.includes(pl.toLowerCase())) {
        score += 78;
        reasons.push(`label text matches "${pl}"`);
        strategies.push('label');
        break;
      }
    }
  }

  // 6. Placeholder match (low/medium confidence)
  if (placeholder) {
    for (const ph of signals.placeholders) {
      if (placeholder.includes(ph.toLowerCase())) {
        score += 65;
        reasons.push(`placeholder matches "${ph}"`);
        strategies.push('placeholder');
        break;
      }
    }
  }

  // 7. ng-reflect-name match
  if (ngReflectName) {
    for (const na of signals.nameAttrs) {
      if (ngReflectName === CLEAN(na) || ngReflectName.includes(CLEAN(na))) {
        score += 70;
        reasons.push(`ng-reflect-name matches "${na}"`);
        strategies.push('ng-reflect-name');
        break;
      }
    }
  }

  // 8. ID attribute match (lower priority due to dynamic IDs)
  if (id) {
    for (const na of signals.nameAttrs) {
      if (id.includes(CLEAN(na))) {
        score += 40;
        reasons.push(`id contains "${na}"`);
        strategies.push('id');
        break;
      }
    }
  }

  // 9. Type compatibility bonus/penalty
  if (signals.expectedTypes.includes(elemType)) {
    score += 5;
    reasons.push(`Element type "${elemType}" matches expected`);
  } else if (elemType === 'text' && signals.expectedTypes.includes('number')) {
    score += 3;
  } else if (score > 0) {
    score = Math.max(score - 10, 0);
    reasons.push(`Element type "${elemType}" doesn't match expected [${signals.expectedTypes.join(',')}]`);
  }

  // 10. Nearby text search (low confidence)
  if (score === 0) {
    const nearbyText = getNearbyText(el, container);
    for (const pl of signals.positiveLabels) {
      if (nearbyText.includes(pl.toLowerCase())) {
        score += 52;
        reasons.push(`Nearby text contains "${pl}"`);
        strategies.push('nearbyText');
        break;
      }
    }
  }

  // Cap confidence at 100
  const confidence = Math.min(score, 100);
  const strategy = strategies.length > 0 ? strategies[0] : 'none';

  return { confidence, reasons, strategy };
}

function getNearbyText(el: HTMLElement, container: HTMLElement): string {
  // Get text from the closest small wrapper (td, div with class*=col, etc.)
  const wrapper = el.closest('td, [class*="col"], .form-group, .field-wrap, mat-form-field');
  if (wrapper && wrapper !== container && wrapper.textContent) {
    return NORM(wrapper.textContent);
  }
  return '';
}

// ─── Public API ───

/**
 * Resolve all pilgrim fields within a container element.
 * Uses scored semantic matching with collision prevention.
 */
export function resolvePilgrimFields(
  container: HTMLElement,
  doc: Document = document,
): Map<PilgrimFieldType, FieldResolution> {
  const pilgrimFields: PilgrimFieldType[] = ['name', 'age', 'gender', 'photoIdProof', 'photoIdNumber'];
  return resolveFieldsInContainer(container, pilgrimFields, doc) as Map<PilgrimFieldType, FieldResolution>;
}

/**
 * Resolve general/contact fields in a document.
 */
export function resolveGeneralFields(
  doc: Document = document,
): Map<GeneralFieldType, FieldResolution> {
  const generalFields: GeneralFieldType[] = ['gothram', 'email', 'mobile', 'city', 'state', 'country', 'pinCode'];
  return resolveFieldsInContainer(doc.body || doc.documentElement, generalFields, doc) as Map<GeneralFieldType, FieldResolution>;
}

/**
 * Core field resolution: scans candidates in a container, scores them,
 * and resolves each logical field to the highest-confidence element
 * with collision prevention.
 */
export function resolveFieldsInContainer<T extends LogicalFieldType>(
  container: HTMLElement,
  fieldTypes: T[],
  doc: Document = document,
): Map<T, FieldResolution> {
  const result = new Map<T, FieldResolution>();
  const assigned = new Set<HTMLElement>();

  // Gather all candidate elements
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]), select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select, textarea'
  )).filter(el => isElementVisible(el));

  // Also find radio button groups (for gender)
  const radioGroups = findRadioGroups(container);

  // Score every candidate for every field type
  interface ScoredCandidate {
    element: HTMLElement;
    field: T;
    confidence: number;
    strategy: string;
    reasons: string[];
  }

  const allScores: ScoredCandidate[] = [];

  for (const fieldType of fieldTypes) {
    for (const el of candidates) {
      const { confidence, reasons, strategy } = scoreElement(el, fieldType, container, doc);
      if (confidence > 0) {
        allScores.push({ element: el, field: fieldType, confidence, strategy, reasons });
      }
    }

    // Also check radio groups for gender
    if (fieldType === 'gender' as T) {
      for (const group of radioGroups) {
        allScores.push({
          element: group.container,
          field: fieldType,
          confidence: 20,
          strategy: 'radioGroup',
          reasons: ['Found radio button group in row'],
        });
      }
    }
  }

  // Sort by confidence descending
  allScores.sort((a, b) => b.confidence - a.confidence);

  // Greedy assignment: highest confidence first, no element reuse
  for (const scored of allScores) {
    if (result.has(scored.field)) continue; // field already resolved
    if (assigned.has(scored.element)) continue; // element already taken

    const contract = getFieldContract(scored.field as string);
    const requiredThreshold = contract ? contract.confidenceThreshold : SAFE_CONFIDENCE_THRESHOLD;

    if (scored.confidence >= requiredThreshold) {
      result.set(scored.field, {
        element: scored.element,
        field: scored.field,
        confidence: scored.confidence,
        strategy: scored.strategy,
        reasons: scored.reasons,
      });
      assigned.add(scored.element);
    }
  }

  // NOTE: Positional fallbacks (e.g. first dropdown, last input) MUST NOT execute
  // automatically in production. Critical fields (gender, photoIdProof, photoIdNumber)
  // must never guess. If a field cannot be safely detected (confidence >= 50),
  // it remains unresolved so the user is informed and can review/repair.

  return result;
}

/**
 * UNSAFE / DIAGNOSTIC ONLY: Positional fallback for debugging/diagnostics.
 * MUST NOT execute automatically in production.
 * A wrong field is worse than an unresolved field.
 */
export function diagnosticPositionalFallback<T extends LogicalFieldType>(
  fieldType: T,
  container: HTMLElement,
  assigned: Set<HTMLElement> = new Set(),
): FieldResolution | null {
  logger.warn(`[DIAGNOSTIC] Unsafe positional fallback invoked for ${fieldType}`);
  const allSelects = Array.from(container.querySelectorAll<HTMLElement>(
    'select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select'
  )).filter(el => !assigned.has(el) && isElementVisible(el));

  const allInputs = Array.from(container.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
  )).filter(el => !assigned.has(el) && isElementVisible(el));

  switch (fieldType) {
    case 'gender': {
      if (allSelects.length > 0) {
        return {
          element: allSelects[0],
          field: fieldType,
          confidence: 30,
          strategy: 'diagnostic:firstSelect',
          reasons: ['UNSAFE DIAGNOSTIC: first unassigned select in row'],
        };
      }
      break;
    }
    case 'photoIdProof': {
      if (allSelects.length > 0) {
        return {
          element: allSelects[0],
          field: fieldType,
          confidence: 28,
          strategy: 'diagnostic:secondSelect',
          reasons: ['UNSAFE DIAGNOSTIC: next unassigned select in row'],
        };
      }
      break;
    }
    case 'name': {
      const candidate = allInputs.find(el => el.type !== 'number');
      if (candidate) {
        return {
          element: candidate,
          field: fieldType,
          confidence: 25,
          strategy: 'diagnostic:firstTextInput',
          reasons: ['UNSAFE DIAGNOSTIC: first unassigned text input'],
        };
      }
      break;
    }
    case 'age': {
      const candidate = allInputs.find(el =>
        el.type === 'number' || (el.placeholder || '').toLowerCase().includes('age')
      );
      if (candidate) {
        return {
          element: candidate,
          field: fieldType,
          confidence: 25,
          strategy: 'diagnostic:numberInput',
          reasons: ['UNSAFE DIAGNOSTIC: number input or age-hinted input'],
        };
      }
      break;
    }
    case 'photoIdNumber': {
      if (allInputs.length > 0) {
        const candidate = allInputs[allInputs.length - 1];
        return {
          element: candidate,
          field: fieldType,
          confidence: 22,
          strategy: 'diagnostic:lastTextInput',
          reasons: ['UNSAFE DIAGNOSTIC: last unassigned text input in row'],
        };
      }
      break;
    }
    default:
      break;
  }

  return null;
}

interface RadioGroup {
  container: HTMLElement;
  radios: HTMLInputElement[];
}

function findRadioGroups(container: HTMLElement): RadioGroup[] {
  const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  if (radios.length === 0) return [];

  const groups: RadioGroup[] = [];
  const seen = new Set<HTMLInputElement>();

  for (const radio of radios) {
    if (seen.has(radio)) continue;
    const name = radio.name;
    const groupRadios = name
      ? radios.filter(r => r.name === name)
      : [radio];
    groupRadios.forEach(r => seen.add(r));

    const groupContainer = radio.closest('div, td, .form-group') as HTMLElement || radio;
    groups.push({ container: groupContainer, radios: groupRadios });
  }

  return groups;
}

/**
 * Re-resolve a single field within a container (used by retry engine after DOM mutations).
 */
export function reResolveField(
  fieldType: LogicalFieldType,
  container: HTMLElement,
  excludeElements: Set<HTMLElement>,
  doc: Document = document,
): FieldResolution | null {
  const result = resolveFieldsInContainer(container, [fieldType], doc);
  const resolution = result.get(fieldType);
  if (resolution && !excludeElements.has(resolution.element)) {
    return resolution;
  }
  return null;
}
