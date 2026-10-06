// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Typed Field Contracts (Phase 6)
// Defines strict, service-aware contracts for form fields.
// Enforces minimum confidence thresholds and validation rules.
// ─────────────────────────────────────────────────────────────

import { validateAadhaar } from '../../validation/aadhaar';
import { validateMobile } from '../../validation/mobile';
import { validateEmail } from '../../validation/email';

export interface FieldContract {
  key: string;
  required: boolean;
  confidenceThreshold: number; // e.g. 70 for critical, 50 for non-critical
  allowedTypes: string[];
  aliases: string[];
  isIdentity: boolean;
  validate: (value: unknown) => boolean;
}

// ─── Individual Field Contracts ───

export const NAME_CONTRACT: FieldContract = {
  key: 'name',
  required: true,
  confidenceThreshold: 65,
  allowedTypes: ['text'],
  aliases: ['fullName', 'pilgrimName', 'devoteeName', 'name'],
  isIdentity: true,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const AGE_CONTRACT: FieldContract = {
  key: 'age',
  required: true,
  confidenceThreshold: 60,
  allowedTypes: ['number', 'text'],
  aliases: ['age', 'pilgrimAge'],
  isIdentity: false,
  validate: (val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0 && num < 125;
  },
};

export const GENDER_CONTRACT: FieldContract = {
  key: 'gender',
  required: true,
  confidenceThreshold: 60,
  allowedTypes: ['select', 'radio'],
  aliases: ['gender', 'sex'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && ['male', 'female', 'other'].includes(val.toLowerCase().trim()),
};

export const ID_TYPE_CONTRACT: FieldContract = {
  key: 'photoIdProof',
  required: true,
  confidenceThreshold: 65,
  allowedTypes: ['select', 'custom-dropdown'],
  aliases: ['idProof', 'photoIdProof', 'idType', 'idProofType'],
  isIdentity: true,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const ID_NUMBER_CONTRACT: FieldContract = {
  key: 'photoIdNumber',
  required: true,
  confidenceThreshold: 65, // High confidence required for Identity Number
  allowedTypes: ['text'],
  aliases: ['idNumber', 'photoIdNumber', 'aadhaarNumber'],
  isIdentity: true,
  validate: (val) => {
    if (typeof val !== 'string') return false;
    const clean = val.replace(/\s+/g, '');
    if (clean.length === 12 && /^\d{12}$/.test(clean)) {
      return validateAadhaar(clean).valid;
    }
    return clean.length >= 4;
  },
};

export const GOTHRAM_CONTRACT: FieldContract = {
  key: 'gothram',
  required: true,
  confidenceThreshold: 60,
  allowedTypes: ['text'],
  aliases: ['gothram', 'gotram', 'gothra'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const EMAIL_CONTRACT: FieldContract = {
  key: 'email',
  required: true,
  confidenceThreshold: 60,
  allowedTypes: ['email', 'text'],
  aliases: ['email', 'emailAddress'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && validateEmail(val).valid,
};

export const MOBILE_CONTRACT: FieldContract = {
  key: 'mobile',
  required: false, // Mobile optional by default per Phase 5/6 rules
  confidenceThreshold: 50,
  allowedTypes: ['tel', 'text', 'number'],
  aliases: ['mobile', 'phone', 'mobileNumber'],
  isIdentity: false,
  validate: (val) => {
    if (!val) return true; // Optional
    return validateMobile(String(val)).valid;
  },
};

export const CITY_CONTRACT: FieldContract = {
  key: 'city',
  required: true,
  confidenceThreshold: 50,
  allowedTypes: ['text'],
  aliases: ['city', 'town'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const STATE_CONTRACT: FieldContract = {
  key: 'state',
  required: true,
  confidenceThreshold: 50,
  allowedTypes: ['select', 'text'],
  aliases: ['state', 'province'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const COUNTRY_CONTRACT: FieldContract = {
  key: 'country',
  required: true,
  confidenceThreshold: 50,
  allowedTypes: ['select', 'text'],
  aliases: ['country', 'nation'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && val.trim().length >= 2,
};

export const PINCODE_CONTRACT: FieldContract = {
  key: 'pinCode',
  required: true,
  confidenceThreshold: 60,
  allowedTypes: ['text', 'number'],
  aliases: ['pinCode', 'pincode', 'zip', 'zipCode', 'postalCode'],
  isIdentity: false,
  validate: (val) => typeof val === 'string' && /^\d{6}$/.test(val.replace(/\D/g, '')),
};

// ─── Service-Specific Field Contract Bundles ───

export const SPECIAL_ENTRY_300_CONTRACTS: Record<string, FieldContract> = {
  name: NAME_CONTRACT,
  age: AGE_CONTRACT,
  gender: GENDER_CONTRACT,
  photoIdProof: ID_TYPE_CONTRACT,
  photoIdNumber: ID_NUMBER_CONTRACT,
  email: EMAIL_CONTRACT,
  mobile: MOBILE_CONTRACT, // Optional
  city: CITY_CONTRACT,
  state: STATE_CONTRACT,
  country: COUNTRY_CONTRACT,
  pinCode: PINCODE_CONTRACT,
};

export const HOMAM_CONTRACTS: Record<string, FieldContract> = {
  gothram: GOTHRAM_CONTRACT,
  email: EMAIL_CONTRACT,
  mobile: MOBILE_CONTRACT, // Optional
  city: CITY_CONTRACT,
  state: STATE_CONTRACT,
  country: COUNTRY_CONTRACT,
  pinCode: PINCODE_CONTRACT,
  name: NAME_CONTRACT,
  age: AGE_CONTRACT,
  gender: GENDER_CONTRACT,
  photoIdProof: ID_TYPE_CONTRACT,
  photoIdNumber: ID_NUMBER_CONTRACT,
};

export const PADMAVATHI_CONTRACTS: Record<string, FieldContract> = {
  name: NAME_CONTRACT,
  age: AGE_CONTRACT,
  gender: GENDER_CONTRACT,
  photoIdProof: ID_TYPE_CONTRACT,
  photoIdNumber: ID_NUMBER_CONTRACT,
  // General details contracts only required if actually observed on page
};

/**
 * Retrieves the field contract bundle for a given service.
 */
export function getServiceFieldContracts(serviceId?: string): Record<string, FieldContract> {
  if (!serviceId) return SPECIAL_ENTRY_300_CONTRACTS;

  const id = serviceId.toLowerCase();
  if (id.includes('homam')) {
    return HOMAM_CONTRACTS;
  }
  if (id.includes('padmavathi')) {
    return PADMAVATHI_CONTRACTS;
  }
  return SPECIAL_ENTRY_300_CONTRACTS;
}

/**
 * Look up a field contract by key or alias for a service.
 */
export function getFieldContract(fieldKey: string, serviceId?: string): FieldContract | undefined {
  const bundle = getServiceFieldContracts(serviceId);
  const normalizedKey = fieldKey === 'pincode' ? 'pinCode' : fieldKey;
  if (bundle[normalizedKey]) return bundle[normalizedKey];

  // Try alias search across bundle
  return Object.values(bundle).find(c => c.key === normalizedKey || c.aliases.includes(fieldKey));
}

