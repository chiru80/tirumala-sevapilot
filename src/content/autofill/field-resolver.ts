// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Resolver
// Semantic multi-signal field detection with confidence scoring,
// collision prevention, and positive/negative signal matching
// ─────────────────────────────────────────────────

import logger from '@shared/logger';
import { getFieldContract, SRIVARI_SEVA_CONTRACTS } from './field-contracts';
import { findLabelText } from '../form-scanner';

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

export type SrivariFieldType =
  | 'idProofType'
  | 'idProofNumber'
  | 'mobile'
  | 'photo'
  | 'name'
  | 'fatherSpouseName'
  | 'dateOfBirth'
  | 'age'
  | 'gender'
  | 'email'
  | 'bloodGroup'
  | 'mentallyFit'
  | 'physicallyFit'
  | 'qualification'
  | 'profession'
  | 'areaOfInterest'
  | 'employeeId'
  | 'designation'
  | 'specialisation'
  | 'placeOfWork'
  | 'document'
  | 'country'
  | 'pincode'
  | 'state'
  | 'district'
  | 'mandal'
  | 'city'
  | 'street'
  | 'doorNumber';

export type LogicalFieldType = PilgrimFieldType | GeneralFieldType | SrivariFieldType;

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
    positiveLabels: ['photo id proof', 'photo id type', 'id proof', 'identity proof', 'id type', 'proof type', 'document type', 'id doc type', 'proof of id'],
    negativeLabels: ['number', 'no', 'digit', 'card number', 'id number', 'photo id number'],
    expectedTypes: ['select'],
    formControlNames: ['photoidproof', 'idproof', 'idtype', 'prooftype', 'identityproof', 'photoidtype', 'idcard', 'doctype'],
    nameAttrs: ['photoIdProof', 'idProof', 'idType', 'proofType'],
    ariaLabels: ['photo id proof', 'id proof', 'id type', 'identity proof'],
    placeholders: ['select id proof', 'id proof', 'select id type', 'photo id proof'],
  },
  photoIdNumber: {
    positiveLabels: ['photo id number', 'photo id no', 'id number', 'identity card number', 'aadhaar number', 'aadhar number', 'card number', 'proof number', 'aadhaar', 'aadhar', 'identity number', 'document number', 'id no', 'photo id', 'proof no'],
    negativeLabels: ['otp', 'login', 'user', 'booking', 'ticket', 'captcha', 'email', 'mobile', 'phone', 'password', 'age', 'pin'],
    expectedTypes: ['text'],
    formControlNames: ['photoidnumber', 'idnumber', 'proofnumber', 'aadhaarnumber', 'identitynumber', 'cardnumber', 'photoid', 'idproofnumber', 'idproofno', 'proofno'],
    nameAttrs: ['photoIdNumber', 'idNumber', 'proofNumber', 'aadhaarNumber', 'photoId', 'idProofNumber', 'idNum', 'idProofNo'],
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
  idProofType: {
    positiveLabels: ['photo id proof', 'photo id type', 'id proof type', 'id proof', 'identity proof', 'id type', 'proof type', 'document type'],
    negativeLabels: ['number', 'no', 'digit', 'card number', 'id number', 'photo id number'],
    expectedTypes: ['select'],
    formControlNames: ['idprooftype', 'photoidproof', 'idproof', 'idtype', 'prooftype'],
    nameAttrs: ['idProofType', 'photoIdProof', 'idProof', 'idType'],
    ariaLabels: ['id proof type', 'photo id proof', 'id proof'],
    placeholders: ['select id proof', 'select id proof type', 'id proof'],
  },
  idProofNumber: {
    positiveLabels: ['photo id number', 'id proof number', 'photo id no', 'id number', 'identity card number', 'aadhaar number', 'aadhar number', 'proof number'],
    negativeLabels: ['otp', 'login', 'user', 'type', 'email', 'mobile', 'phone'],
    expectedTypes: ['text'],
    formControlNames: ['idproofnumber', 'photoidnumber', 'idnumber', 'aadhaarnumber', 'proofnumber'],
    nameAttrs: ['idProofNumber', 'photoIdNumber', 'idNumber'],
    ariaLabels: ['id proof number', 'photo id number', 'id number'],
    placeholders: ['enter id proof number', 'id proof number', 'id number', 'aadhaar number'],
  },
  photo: {
    positiveLabels: ['photo upload', 'photo', 'recent photo', 'upload photo', 'devotee photo'],
    negativeLabels: ['document', 'supporting document', 'certificate', 'id proof type', 'id proof number'],
    expectedTypes: ['file'],
    formControlNames: ['photo', 'photoupload', 'recentphoto', 'devoteephoto'],
    nameAttrs: ['photo', 'photoUpload', 'recentPhoto'],
    ariaLabels: ['photo upload', 'recent photo', 'photo'],
    placeholders: ['choose photo', 'upload photo'],
  },
  document: {
    positiveLabels: ['upload document', 'supporting document', 'qualification document', 'document upload', 'document'],
    negativeLabels: ['recent photo', 'photo upload', 'photo', 'devotee photo'],
    expectedTypes: ['file'],
    formControlNames: ['document', 'uploaddocument', 'supportingdocument', 'doc'],
    nameAttrs: ['document', 'uploadDocument', 'supportingDocument'],
    ariaLabels: ['upload document', 'supporting document', 'document'],
    placeholders: ['choose document', 'upload document'],
  },
  dateOfBirth: {
    positiveLabels: ['date of birth', 'dob', 'birth date'],
    negativeLabels: ['age', 'expiry', 'validity'],
    expectedTypes: ['text', 'date'],
    formControlNames: ['dateofbirth', 'dob', 'birthdate'],
    nameAttrs: ['dateOfBirth', 'dob', 'birthDate'],
    ariaLabels: ['date of birth', 'dob'],
    placeholders: ['dd/mm/yyyy', 'date of birth', 'dob'],
  },
  fatherSpouseName: {
    positiveLabels: ['father spouse name', 'father / spouse name', 'father name', 'spouse name', 'husband name', 'guardian name'],
    negativeLabels: ['full name', 'devotee name', 'pilgrim name', 'your name'],
    expectedTypes: ['text'],
    formControlNames: ['fatherspousename', 'fathername', 'spousename'],
    nameAttrs: ['fatherSpouseName', 'fatherName', 'spouseName'],
    ariaLabels: ['father spouse name', 'father / spouse name', 'father name'],
    placeholders: ['father/spouse name', 'father name', 'spouse name'],
  },
  bloodGroup: {
    positiveLabels: ['blood group', 'bloodgroup', 'blood type'],
    negativeLabels: ['gender', 'name', 'id'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['bloodgroup', 'bloodgrp', 'blood'],
    nameAttrs: ['bloodGroup', 'bloodGrp'],
    ariaLabels: ['blood group'],
    placeholders: ['select blood group', 'blood group'],
  },
  district: {
    positiveLabels: ['district', 'dist'],
    negativeLabels: ['state', 'country', 'city', 'street'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['district', 'dist'],
    nameAttrs: ['district', 'dist'],
    ariaLabels: ['district'],
    placeholders: ['select district', 'district'],
  },
  mandal: {
    positiveLabels: ['mandal', 'tehsil', 'taluk'],
    negativeLabels: ['district', 'city', 'state'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['mandal', 'tehsil'],
    nameAttrs: ['mandal'],
    ariaLabels: ['mandal'],
    placeholders: ['select mandal', 'mandal'],
  },
  street: {
    positiveLabels: ['street', 'street name', 'road', 'lane', 'address line 2'],
    negativeLabels: ['city', 'state', 'door', 'country', 'pin'],
    expectedTypes: ['text'],
    formControlNames: ['street', 'streetname', 'road'],
    nameAttrs: ['street', 'streetName', 'road'],
    ariaLabels: ['street', 'street name'],
    placeholders: ['street', 'enter street'],
  },
  doorNumber: {
    positiveLabels: ['door number', 'door no', 'house number', 'house no', 'flat no', 'd no'],
    negativeLabels: ['mobile', 'phone', 'pin', 'id', 'proof', 'age', 'street'],
    expectedTypes: ['text'],
    formControlNames: ['doornumber', 'doorno', 'houseno', 'housenumber', 'flatno', 'dno'],
    nameAttrs: ['doorNumber', 'doorNo', 'houseNo', 'dNo'],
    ariaLabels: ['door number', 'door no', 'house no'],
    placeholders: ['door no', 'house no', 'door number', 'd.no'],
  },
  qualification: {
    positiveLabels: ['qualification', 'highest qualification', 'education'],
    negativeLabels: ['document'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['qualification', 'education'],
    nameAttrs: ['qualification', 'education'],
    ariaLabels: ['qualification'],
    placeholders: ['select qualification', 'qualification'],
  },
  profession: {
    positiveLabels: ['profession', 'occupation'],
    negativeLabels: ['qualification', 'area of interest'],
    expectedTypes: ['select', 'text'],
    formControlNames: ['profession', 'occupation'],
    nameAttrs: ['profession', 'occupation'],
    ariaLabels: ['profession'],
    placeholders: ['select profession', 'profession'],
  },
  areaOfInterest: {
    positiveLabels: ['area of interest', 'interest', 'seva preference'],
    negativeLabels: [],
    expectedTypes: ['select', 'text'],
    formControlNames: ['areaofinterest', 'interest'],
    nameAttrs: ['areaOfInterest', 'interest'],
    ariaLabels: ['area of interest'],
    placeholders: ['select area of interest', 'area of interest'],
  },
  employeeId: {
    positiveLabels: ['employee id', 'emp id', 'staff id', 'employee number'],
    negativeLabels: ['photo id', 'proof', 'aadhaar'],
    expectedTypes: ['text'],
    formControlNames: ['employeeid', 'empid', 'staffid'],
    nameAttrs: ['employeeId', 'empId'],
    ariaLabels: ['employee id'],
    placeholders: ['employee id', 'enter employee id'],
  },
  designation: {
    positiveLabels: ['designation', 'retired as', 'designation / retired as', 'designation/retired as'],
    negativeLabels: [],
    expectedTypes: ['text', 'select'],
    formControlNames: ['designation', 'retiredas'],
    nameAttrs: ['designation', 'retiredAs'],
    ariaLabels: ['designation', 'retired as'],
    placeholders: ['designation', 'retired as'],
  },
  specialisation: {
    positiveLabels: ['specialisation', 'specialization', 'skill', 'specialisation/skill'],
    negativeLabels: [],
    expectedTypes: ['text', 'select'],
    formControlNames: ['specialisation', 'specialization', 'skill'],
    nameAttrs: ['specialisation', 'specialization', 'skill'],
    ariaLabels: ['specialisation', 'skill'],
    placeholders: ['specialisation', 'skill'],
  },
  placeOfWork: {
    positiveLabels: ['place of working', 'place of working/related', 'work location', 'place of work', 'work place'],
    negativeLabels: [],
    expectedTypes: ['text'],
    formControlNames: ['placeofworking', 'placeofwork', 'worklocation'],
    nameAttrs: ['placeOfWorking', 'placeOfWork', 'workLocation'],
    ariaLabels: ['place of working', 'place of work'],
    placeholders: ['place of working', 'work location'],
  },
  mentallyFit: {
    positiveLabels: ['mentally fit', 'mental fitness'],
    negativeLabels: ['physically fit'],
    expectedTypes: ['checkbox'],
    formControlNames: ['mentallyfit', 'mentalfitness'],
    nameAttrs: ['mentallyFit', 'mentalFitness'],
    ariaLabels: ['mentally fit'],
    placeholders: [],
  },
  physicallyFit: {
    positiveLabels: ['physically fit', 'physical fitness'],
    negativeLabels: ['mentally fit'],
    expectedTypes: ['checkbox'],
    formControlNames: ['physicallyfit', 'physicalfitness'],
    nameAttrs: ['physicallyFit', 'physicalFitness'],
    ariaLabels: ['physically fit'],
    placeholders: [],
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
  if (el.getAttribute('role') === 'checkbox') return 'checkbox';
  if (el.tagName?.toLowerCase() === 'mat-checkbox') return 'checkbox';
  return 'unknown';
}

/**
 * Get the associated label text for an element using multiple strategies.
 */
export function getAssociatedLabelText(el: HTMLElement, container: HTMLElement, doc: Document): string {
  // 1. <label for="id">
  if (el.id) {
    const label = container.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      || doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return NORM(label.textContent);
  }

  // 2. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return NORM(parentLabel.textContent);

  // 3. Angular Material form field or field wrappers
  const matFormField = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .form-field, .field-wrapper, .field');
  if (matFormField) {
    const matLabel = matFormField.querySelector('mat-label, label, .mat-mdc-floating-label, .field-label, .form-label');
    if (matLabel?.textContent && !matLabel.contains(el)) return NORM(matLabel.textContent);
  }

  // 4. Preceding sibling label/span/div/p
  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'B' || prev.tagName === 'STRONG' || prev.tagName === 'DIV' || prev.tagName === 'P') && prev.textContent) {
    const text = prev.textContent.trim();
    if (text.length > 0 && text.length < 80) return NORM(text);
  }

  // 5. Column/group container label
  const colOrGroup = el.closest('[class*="col"], td, .field-wrap, th, [class*="input" i]');
  if (colOrGroup && colOrGroup !== container && colOrGroup !== doc.body) {
    const lbl = colOrGroup.querySelector('mat-label, label, .mat-mdc-floating-label, span, b, strong, p');
    if (lbl?.textContent && !lbl.contains(el)) {
      const text = lbl.textContent.trim();
      if (text.length > 0 && text.length < 80) return NORM(text);
    }
  }

  // 6. Comprehensive fallback via findLabelText (excluding element's own placeholder)
  const fb = findLabelText(el, doc);
  const ownPlaceholder = (el as HTMLInputElement).placeholder;
  if (fb && fb !== ownPlaceholder) return NORM(fb);

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
    // If the label itself directly matches a positive signal for this field, don't disqualify due to incidental attribute text
    const labelIsPositive = signals.positiveLabels.some(pl => labelText.includes(pl.toLowerCase()));
    if (labelIsPositive && !labelText.includes(negClean)) {
      continue;
    }
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
  const includesCheckboxes = fieldTypes.some(ft => ft === 'mentallyFit' || ft === 'physicallyFit');
  const selector = includesCheckboxes
    ? 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]), select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select, textarea, [role="checkbox"]'
    : 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]), select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select, textarea';

  const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => isElementVisible(el));

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

/**
 * Get raw associated label text without stripping asterisks or punctuation.
 */
export function getRawAssociatedLabelText(
  el: HTMLElement,
  container?: HTMLElement,
  doc: Document = document,
): string {
  if (!el) return '';
  const searchContainer = container || el.ownerDocument?.body || doc.body;

  // 1. <label for="id">
  if (el.id) {
    const label = searchContainer?.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      || doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // 2. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();

  // 3. Angular Material or form field wrapper
  const matFormField = el.closest(
    'mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .form-field, .field-wrapper, .field'
  );
  if (matFormField) {
    const matLabel = matFormField.querySelector(
      'mat-label, label, .mat-mdc-floating-label, .field-label, .form-label'
    );
    if (matLabel?.textContent && !matLabel.contains(el)) return matLabel.textContent.trim();
  }

  // 4. Preceding sibling
  const prev = el.previousElementSibling;
  if (prev && prev.textContent) {
    const text = prev.textContent.trim();
    if (text.length > 0 && text.length < 80) return text;
  }

  // 5. Column/group container
  const colOrGroup = el.closest('[class*="col"], td, .field-wrap, th, [class*="input" i]');
  if (colOrGroup && colOrGroup !== searchContainer && colOrGroup !== doc.body) {
    const lbl = colOrGroup.querySelector('mat-label, label, .mat-mdc-floating-label, span, b, strong, p');
    if (lbl?.textContent && !lbl.contains(el)) {
      const text = lbl.textContent.trim();
      if (text.length > 0 && text.length < 80) return text;
    }
  }

  // 6. findLabelText fallback
  const fb = findLabelText(el, doc);
  if (fb) return fb.trim();

  return '';
}

/**
 * Determines whether a form field element is strictly required on the live page.
 * Follows conservative safety rules:
 * 1. native required attribute
 * 2. aria-required="true"
 * 3. Angular validation metadata
 * 4. visible "*" label marker
 * 5. associated label containing "*"
 *
 * If uncertain whether a field is required, returns false so optional fields
 * never become readiness blockers.
 */
export function isRequiredField(
  el: Element,
  container?: HTMLElement,
  doc: Document = document,
): boolean {
  if (!el) return false;

  // 1. Native required attribute
  if ((el as HTMLInputElement).required === true || el.hasAttribute('required')) {
    return true;
  }

  // 2. aria-required="true"
  if (el.getAttribute('aria-required') === 'true') {
    return true;
  }

  // 3. Angular validation metadata
  if (el.getAttribute('ng-reflect-required') === 'true') {
    return true;
  }

  const formField = el.closest(
    'mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .form-field, .field-wrapper, .field'
  );
  if (formField) {
    if (
      formField.classList.contains('mat-form-field-required') ||
      formField.classList.contains('mat-mdc-form-field-required') ||
      formField.querySelector('.mat-placeholder-required, .mat-mdc-form-field-required-marker')
    ) {
      return true;
    }
  }

  // 4. Check raw associated label text
  const rawLabel = getRawAssociatedLabelText(el as HTMLElement, container, doc);

  // If label explicitly says "(Optional)" or "Optional", it is NOT required
  if (/\b(?:optional|\(optional\))\b/i.test(rawLabel)) {
    return false;
  }

  // Check if raw label contains '*'
  if (rawLabel.includes('*')) {
    return true;
  }

  // 5. Check if parent wrapper contains an asterisk or required indicator element
  if (formField) {
    const starEl = formField.querySelector(
      '.required, .text-danger, .star, .asterisk, [class*="required" i], [aria-hidden="true"]'
    );
    if (starEl && (starEl.textContent || '').includes('*')) {
      return true;
    }
  }

  // Check preceding sibling
  const prev = el.previousElementSibling;
  if (prev && (prev.textContent || '').includes('*')) {
    return true;
  }

  return false;
}

export type SrivariSectionName =
  | 'identityProof'
  | 'basicDetails'
  | 'fitness'
  | 'profession'
  | 'address';

export interface SrivariSections {
  identityProof: HTMLElement | null;
  basicDetails: HTMLElement | null;
  fitness: HTMLElement | null;
  profession: HTMLElement | null;
  address: HTMLElement | null;
}

/**
 * Locate section container boundaries on the Srivari Seva enrollment page.
 * Strictly separates Identity Proof, Basic Details, Fitness, Profession, and Address.
 */
export function findSrivariSections(doc: Document = document): SrivariSections {
  const headings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, .section-title, .form-title, .card-title, mat-card-title, legend, strong, b, div, p'
  )).filter(el => isElementVisible(el));

  const sections: SrivariSections = {
    identityProof: null,
    basicDetails: null,
    fitness: null,
    profession: null,
    address: null,
  };

  const findContainer = (h: HTMLElement): HTMLElement => {
    return (
      (h.closest(
        'section, mat-card, .mat-card, fieldset, .section-container, .form-section, .card, .panel, form'
      ) as HTMLElement) ||
      h.parentElement ||
      h
    );
  };

  for (const h of headings) {
    const text = (h.textContent || '').trim().toLowerCase();
    if (!sections.identityProof && (text.includes('identity proof') || text.includes('identity details'))) {
      sections.identityProof = findContainer(h);
    } else if (!sections.basicDetails && (text.includes('basic details') || text.includes('personal details'))) {
      sections.basicDetails = findContainer(h);
    } else if (!sections.fitness && (text.includes('fitness') || text.includes('medical fitness'))) {
      sections.fitness = findContainer(h);
    } else if (!sections.profession && (text.includes('profession & education') || text.includes('profession details') || text.includes('education details') || text === 'profession')) {
      sections.profession = findContainer(h);
    } else if (!sections.address && (text.includes('address details') || text.includes('contact details') || text === 'address')) {
      sections.address = findContainer(h);
    }
  }

  return sections;
}

export interface SrivariEnrollmentResolution {
  sections: SrivariSections;
  fields: Map<LogicalFieldType, FieldResolution>;
  requiredMap: Map<LogicalFieldType, boolean>;
}

/**
 * Resolve all fields on the Srivari Seva enrollment form scoped strictly by section.
 * Prevents Identity Photo from being confused with Supporting Document,
 * and Basic Details Name from being confused with other fields.
 */
export function resolveSrivariEnrollmentFields(
  doc: Document = document,
): SrivariEnrollmentResolution {
  const sections = findSrivariSections(doc);
  const fields = new Map<LogicalFieldType, FieldResolution>();

  // 1. Identity Proof Section: idProofType, idProofNumber, mobile, photo
  const identityContainer = sections.identityProof || doc.body || doc.documentElement;
  const identityFields: LogicalFieldType[] = ['idProofType', 'idProofNumber', 'mobile', 'photo'];
  const resolvedIdentity = resolveFieldsInContainer(identityContainer, identityFields, doc);
  for (const [k, v] of resolvedIdentity) {
    fields.set(k, v);
  }

  // 2. Basic Details Section: name, fatherSpouseName, dateOfBirth, age, email, bloodGroup, gender
  const basicContainer = sections.basicDetails || doc.body || doc.documentElement;
  const basicFields: LogicalFieldType[] = [
    'name',
    'fatherSpouseName',
    'dateOfBirth',
    'age',
    'email',
    'bloodGroup',
    'gender',
  ];
  const resolvedBasic = resolveFieldsInContainer(basicContainer, basicFields, doc);
  for (const [k, v] of resolvedBasic) {
    fields.set(k, v);
  }

  // 3. Fitness Section: mentallyFit, physicallyFit
  const fitnessContainer = sections.fitness || doc.body || doc.documentElement;
  const fitnessFields: LogicalFieldType[] = ['mentallyFit', 'physicallyFit'];
  const resolvedFitness = resolveFieldsInContainer(fitnessContainer, fitnessFields, doc);
  for (const [k, v] of resolvedFitness) {
    fields.set(k, v);
  }

  // 4. Profession & Education Details Section: qualification, profession, areaOfInterest, employeeId, designation, specialisation, placeOfWork, document
  const profContainer = sections.profession || doc.body || doc.documentElement;
  const profFields: LogicalFieldType[] = [
    'qualification',
    'profession',
    'areaOfInterest',
    'employeeId',
    'designation',
    'specialisation',
    'placeOfWork',
    'document',
  ];
  const resolvedProf = resolveFieldsInContainer(profContainer, profFields, doc);
  for (const [k, v] of resolvedProf) {
    fields.set(k, v);
  }

  // 5. Address Details Section: country, pincode, state, district, mandal, city, street, doorNumber
  const addressContainer = sections.address || doc.body || doc.documentElement;
  const addressFields: LogicalFieldType[] = [
    'country',
    'pincode',
    'state',
    'district',
    'mandal',
    'city',
    'street',
    'doorNumber',
  ];
  const resolvedAddress = resolveFieldsInContainer(addressContainer, addressFields, doc);
  for (const [k, v] of resolvedAddress) {
    fields.set(k, v);
  }

  const requiredMap = new Map<LogicalFieldType, boolean>();
  for (const [k, v] of fields.entries()) {
    const isLiveReq = isRequiredField(v.element, undefined, doc);
    const contract = SRIVARI_SEVA_CONTRACTS[k as string];
    requiredMap.set(k, isLiveReq || Boolean(contract?.required));
  }

  return { sections, fields, requiredMap };
}

