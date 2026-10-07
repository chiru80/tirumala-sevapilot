// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Constants
// ─────────────────────────────────────────────────

import { ConfidenceLevel, type Settings, ServiceType } from './types';

/** Supported TTD domains */
export const TTD_DOMAINS = [
  'ttdevasthanams.ap.gov.in',
  'tirupatibalaji.ap.gov.in',
] as const;

/** Extension metadata */
export const EXTENSION_NAME = 'Tirumala SevaPilot';
export const EXTENSION_TAGLINE = 'Prepare once. Fill accurately. Book yourself.';
export const EXTENSION_VERSION = '1.1.0';

/** Storage keys */
export const STORAGE_KEYS = {
  PROFILES: 'sp_profiles',
  SETTINGS: 'sp_settings',
  VAULT: 'sp_vault',
  VAULT_SALT: 'sp_vault_salt',
  FINGERPRINTS: 'sp_fingerprints',
  SCHEMA_VERSION: 'sp_schema_version',
  ONBOARDING: 'sp_onboarding_complete',
  NOTIFICATIONS: 'sp_notifications',
  SESSION_HISTORY: 'sp_session_history',
  LAST_SEEN_VERSION: 'sp_last_seen_version',
  FLOATING_POS: 'sp_floating_pos',
} as const;

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 1;

/** Confidence thresholds */
export const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH: 95,
  HIGH: 90,
  MEDIUM: 70,
  LOW: 0,
} as const;

/** Get confidence level from score */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.VERY_HIGH) return ConfidenceLevel.VERY_HIGH;
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return ConfidenceLevel.HIGH;
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

/** Field name aliases for smart mapping */
export const FIELD_ALIASES: Record<string, string[]> = {
  // Name fields
  fullName: [
    'name', 'name *', 'full name', 'pilgrim name', 'devotee name', 'passenger name',
    'pilgrimname', 'devoteename', 'passengername', 'fullname',
    'name of pilgrim', 'name of devotee', 'visitor name', 'devotee',
  ],
  firstName: [
    'first name', 'firstname', 'given name', 'givenname', 'fname',
  ],
  middleName: [
    'middle name', 'middlename', 'mname',
  ],
  lastName: [
    'last name', 'lastname', 'surname', 'family name', 'familyname', 'lname',
  ],

  // Personal details
  gender: [
    'gender', 'gender *', 'sex', 'male/female', 'male female',
  ],
  dateOfBirth: [
    'date of birth', 'dob', 'dateofbirth', 'birth date', 'birthdate',
    'd.o.b', 'd.o.b.', 'date_of_birth', 'birthday',
  ],
  age: [
    'age', 'age *', 'years', 'age in years', 'pilgrim age', 'devotee age',
  ],

  // ID fields
  idType: [
    'photo id proof', 'photo id proof *', 'photo id type', 'photo id type *',
    'id proof', 'id proof *', 'id type', 'id type *', 'idtype',
    'identity type', 'idproof', 'proof type', 'document type', 'doctype',
    'identity proof', 'identityproof', 'photoidproof', 'photoidtype',
  ],
  idNumber: [
    'photo id number', 'photo id number *', 'photo id no', 'photoidnumber', 'photo id num',
    'photo id proof number', 'photo id proof no', 'photoidproofnumber', 'photoidproofno',
    'id proof number', 'id proof no', 'idproofnumber', 'idproofno',
    'identity proof number', 'identity proof no', 'identityproofnumber',
    'photo id card no', 'photo id card number',
    'id number', 'idnumber', 'identity number', 'id no', 'id no.', 'idcardnumber',
    'aadhaar number', 'aadhar number', 'aadhaar no', 'aadhar no', 'aadhaar', 'aadhar',
    'id card number', 'identity no', 'identitynumber',
    'document number', 'docnumber', 'doc no',
    'passport number', 'passport no', 'passportnum',
    'voter id number', 'voter id no', 'epic no', 'epic number',
  ],

  // Contact
  mobile: [
    'mobile', 'mobile number', 'mobilenumber', 'phone', 'phone number',
    'phonenumber', 'contact number', 'contactnumber', 'contact',
    'cell', 'cell number', 'cellphone', 'mobile no', 'phone no',
    'mob', 'mob no', 'mob number',
  ],
  email: [
    'email', 'email address', 'emailaddress', 'email id', 'emailid',
    'mail', 'e-mail', 'e mail',
  ],

  // Address
  address: [
    'address', 'street address', 'residential address', 'full address',
    'addr', 'address line', 'address1', 'address line 1',
  ],
  city: [
    'city', 'town', 'city/town', 'city name',
  ],
  district: [
    'district', 'dist', 'district name',
  ],
  state: [
    'state', 'state/province', 'province', 'state name',
  ],
  country: [
    'country', 'nationality', 'nation', 'country name',
  ],
  pinCode: [
    'pin code', 'pincode', 'pin', 'zip', 'zip code', 'zipcode',
    'postal code', 'postalcode', 'pin no',
  ],

  // Passport/Visa
  passportNumber: [
    'passport number', 'passportnumber', 'passport no', 'passport',
  ],
  passportExpiry: [
    'passport expiry', 'passport expiry date', 'passport valid till',
  ],
  visaNumber: [
    'visa number', 'visanumber', 'visa no', 'visa',
  ],
  visaExpiry: [
    'visa expiry', 'visa expiry date', 'visa valid till',
  ],
};

/** Indian states for dropdown mapping */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

/** Default settings */
export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'system',
  defaultProfileId: undefined,
  defaultServiceType: undefined,
  autofillMode: 'safe',
  floatingHelperEnabled: true,
  autoScanEnabled: true,
  autoFillOnDetect: false,
  confirmationMode: 'always-preview',
  sensitivePreviewMasking: true,
  vaultEnabled: false,
  vaultAutoLockMinutes: 15,
  diagnosticsMode: false,
  onboardingComplete: false,
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

/** Vault configuration */
export const VAULT_CONFIG = {
  PBKDF2_ITERATIONS: 600_000,
  KEY_LENGTH: 256,
  SALT_LENGTH: 32,
  IV_LENGTH: 12,
  ALGORITHM: 'AES-GCM' as const,
  HASH: 'SHA-256' as const,
};

/** Mutation observer debounce delay (ms) */
export const MUTATION_DEBOUNCE_MS = 300;

/** Maximum number of profiles (practical limit) */
export const MAX_PROFILES = 50;

/** Maximum pilgrims per profile */
export const MAX_PILGRIMS_PER_PROFILE = 20;
