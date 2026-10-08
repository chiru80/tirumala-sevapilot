// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Shared Type Definitions
// ─────────────────────────────────────────────────

/** Supported TTD service types */
export enum ServiceType {
  DARSHAN = 'darshan',
  ARJITHA_SEVA = 'arjitha-seva',
  ACCOMMODATION = 'accommodation',
  SRIVANI = 'srivani',
  SRIVARI_SEVA = 'srivari-seva',
  ANGAPRADAKSHINAM = 'angapradakshinam',
  KALYANA_VEDIKA = 'kalyana-vedika',
  SENIOR_CITIZEN = 'senior-citizen',
  GENERIC = 'generic',
}

/** Gender options */
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

/** Identity document types */
export enum IdType {
  AADHAAR = 'Aadhaar',
  PASSPORT = 'Passport',
  VOTER_ID = 'Voter ID',
  PAN = 'PAN',
  DRIVING_LICENSE = 'Driving License',
  RATION_CARD = 'Ration Card',
}

export interface SrivariSevaDetails {
  qualification?: string;
  profession?: string;
  areaOfInterest?: string;
  employeeId?: string;
  designation?: string;
  specialisation?: string;
  placeOfWork?: string;
  fatherSpouseName?: string;
  bloodGroup?: string;
  doorNumber?: string;
  street?: string;
  mandal?: string;
  document?: string;
}

/** Pilgrim information — all fields a pilgrim can have */
export interface Pilgrim {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  gender: Gender;
  dateOfBirth?: string; // ISO 8601 date string (YYYY-MM-DD)
  age?: number;
  idType: IdType;
  idNumber: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  country: string;
  pinCode?: string;
  photo?: string; // Base64 encoded or storage key
  passportNumber?: string;
  passportExpiry?: string;
  visaNumber?: string;
  visaExpiry?: string;
  notes?: string;
  srivariSeva?: SrivariSevaDetails;
  createdAt: string;
  updatedAt?: string;
}

export interface PilgrimFormFieldStatus {
  fieldType: 'name' | 'age' | 'gender' | 'photoIdProof' | 'photoIdNumber';
  label: string;
  detected: boolean;
  filled: boolean;
  validated: boolean;
  maskedValue?: string;
  confidence?: number;
  strategy?: string;
  attempts?: number;
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

/** General details for TTD booking contact, address, and optional religious fields */
export interface GeneralDetails {
  gothram?: string;  // Required only for services that explicitly declare it (e.g. Homam)
  email?: string;
  mobile?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}

/** A profile is a named group of pilgrims */
export interface Profile {
  id: string;
  name: string;
  description?: string;
  defaultService?: string;
  serviceType?: string;
  pilgrims: Pilgrim[];
  /** Selected pilgrim IDs per service type */
  selectedPilgrims?: Record<string, string[]>;
  /** Contact and address details for TTD Step 2 autofill */
  general?: GeneralDetails;
  /** Booking-level Gothram (for services like Sri Srinivasa Divyanugraha Homam) */
  gothram?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type BookingProfile = Profile;

export type AutofillMode = 'safe' | 'fast' | 'manual';

/** Application settings */
export interface Settings {
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr';
  theme: 'light' | 'dark' | 'system';
  defaultProfileId?: string;
  defaultServiceType?: ServiceType;
  autofillMode: AutofillMode;
  floatingHelperEnabled: boolean;
  autoScanEnabled: boolean;
  autoFillOnDetect?: boolean;
  confirmationMode: 'always-preview' | 'high-confidence-direct';
  sensitivePreviewMasking: boolean;
  vaultEnabled: boolean;
  vaultAutoLockMinutes: number;
  diagnosticsMode: boolean;
  onboardingComplete: boolean;
  schemaVersion: number;
}

/** Confidence level for field mappings */
export enum ConfidenceLevel {
  VERY_HIGH = 'very-high', // ≥ 95%
  HIGH = 'high',           // ≥ 90%
  MEDIUM = 'medium',       // ≥ 70%
  LOW = 'low',             // < 70%
}

/** A detected form field on a TTD page */
export interface ScannedField {
  element: string; // CSS selector path (not stored, runtime only)
  type: 'text' | 'number' | 'date' | 'email' | 'select' | 'radio' | 'checkbox' | 'file' | 'tel' | 'textarea';
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  autocomplete?: string;
  required?: boolean;
  options?: string[]; // For select/radio
  currentValue?: string;
  groupIndex?: number; // Which pilgrim card (0-based)
}

/** Mapping from a scanned field to a pilgrim data key */
export interface FieldMapping {
  scannedField: ScannedField;
  pilgrimKey: keyof Pilgrim | null;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  matchReasons: string[]; // Why this mapping was chosen
}

/** Result of filling a single field */
export interface FillResult {
  field: FieldMapping;
  status: 'filled' | 'skipped' | 'conflict' | 'failed' | 'manual';
  previousValue?: string;
  newValue?: string;
  error?: string;
  suggestion?: string;
  validationStatus?: 'valid' | 'invalid' | 'unknown';
  validationMessage?: string;
  isAngularValid?: boolean;
}

/** Conflict information for a single field */
export interface ConflictInfo {
  field: FieldMapping;
  currentValue: string;
  savedValue: string;
  resolution?: 'keep-current' | 'use-saved' | 'manual';
}

/**
 * Dedicated first-class TTD server-side Temporary Pilgrim/ID Lock state.
 * Emitted when TTD holds pilgrim/ID details from a previous booking attempt.
 * Strictly Zero-PII: Never logs or stores Aadhaar, ID numbers, mobile, email, etc.
 */
export interface TtdTemporaryLockState {
  status: 'temporary-lock';
  detectedAt: number;
  detectedAtIso: string;
  estimatedRetryAt?: number;
  estimatedRetryAtIso?: string;
  durationMinutes?: number;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  message: string;
  supportingMessage: string;
  hasExplicitTimer: boolean;
  rawSnippet?: string;
  serviceId?: string;
  workflowId?: string;
}

/** Page scan result */
export interface ScanResult {
  serviceType: ServiceType;
  serviceId?: string;
  workflowId?: string;
  serviceConfidence: number;
  url: string;
  totalFields: number;
  mappedFields: FieldMapping[];
  unmappedFields: ScannedField[];
  pilgrimCardCount: number;
  formFingerprint: string;
  timestamp: string;
  temporaryLock?: TtdTemporaryLockState;
  stage?: string;
  isQueuePresent?: boolean;
  queueInfo?: any;
}

/** Validation result for a single check */
export interface ValidationResult {
  field: string;
  valid: boolean;
  error?: string;
  warning?: string;
}

/** Readiness status for a pilgrim */
export interface PilgrimReadiness {
  pilgrimId: string;
  pilgrimName: string;
  ready: boolean;
  validations: ValidationResult[];
  missingFields: string[];
  warnings: string[];
}

/** Overall booking readiness */
export interface BookingReadiness {
  ready: boolean;
  pilgrims: PilgrimReadiness[];
  serviceType: ServiceType;
  serviceId?: string;
  workflowId?: string;
  totalRequired: number;
  totalComplete: number;
}

/** Form fingerprint for change detection */
export interface FormFingerprint {
  id: string; // e.g. "SED-2026-09-A"
  serviceType: ServiceType;
  fieldSignatures: string[];
  pageStructureHash: string;
  mappingVersion: string;
  detectedAt: string;
}

/** Encrypted vault schema */
export interface VaultData {
  version: number;
  profiles: Profile[];
  settings: Settings;
  fingerprints: FormFingerprint[];
}

/** Secure backup file format (.spbk) */
export interface BackupFile {
  format: 'SPBK';
  version: number;
  salt: string; // Base64
  iv: string; // Base64
  encrypted: string; // Base64 AES-GCM ciphertext
  metadata: {
    createdAt: string;
    profileCount: number;
    pilgrimCount: number;
    schemaVersion: number;
    extensionVersion: string;
  };
}

/** Message types for extension messaging */
export enum MessageType {
  // Content script → Background
  PAGE_DETECTED = 'PAGE_DETECTED',
  SCAN_RESULT = 'SCAN_RESULT',
  FILL_COMPLETE = 'FILL_COMPLETE',

  // Background → Content script
  SCAN_PAGE = 'SCAN_PAGE',
  FILL_FIELDS = 'FILL_FIELDS',
  STOP_AUTOFILL = 'STOP_AUTOFILL',
  AUTOFILL_PROGRESS = 'AUTOFILL_PROGRESS',
  GET_PAGE_STATE = 'GET_PAGE_STATE',
  HIGHLIGHT_FIELDS = 'HIGHLIGHT_FIELDS',
  CLEAR_HIGHLIGHTS = 'CLEAR_HIGHLIGHTS',
  VERIFY_FORM = 'VERIFY_FORM',

  // Side panel → Background
  REQUEST_SCAN = 'REQUEST_SCAN',
  REQUEST_FILL = 'REQUEST_FILL',
  GET_PROFILES = 'GET_PROFILES',
  SAVE_PROFILE = 'SAVE_PROFILE',
  DELETE_PROFILE = 'DELETE_PROFILE',
  GET_SETTINGS = 'GET_SETTINGS',
  SAVE_SETTINGS = 'SAVE_SETTINGS',
  EXPORT_BACKUP = 'EXPORT_BACKUP',
  IMPORT_BACKUP = 'IMPORT_BACKUP',
  VAULT_UNLOCK = 'VAULT_UNLOCK',
  VAULT_LOCK = 'VAULT_LOCK',
  VAULT_STATUS = 'VAULT_STATUS',
  OPEN_SIDE_PANEL = 'OPEN_SIDE_PANEL',

  // Notifications & History
  GET_NOTIFICATIONS = 'GET_NOTIFICATIONS',
  SAVE_NOTIFICATIONS = 'SAVE_NOTIFICATIONS',
  GET_HISTORY = 'GET_HISTORY',
  SAVE_HISTORY_ITEM = 'SAVE_HISTORY_ITEM',
  CLEAR_HISTORY = 'CLEAR_HISTORY',

  // Content script → Side panel / Background
  FORM_CHANGED = 'FORM_CHANGED',

  // Background → Side panel
  PAGE_STATE_UPDATED = 'PAGE_STATE_UPDATED',
  PROFILES_UPDATED = 'PROFILES_UPDATED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',

  // Guardian Orchestration
  GET_GUARDIAN_STATE = 'GET_GUARDIAN_STATE',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
}

/** Ephemeral Booking Session state */
export interface BookingSession {
  serviceType: ServiceType;
  serviceName: string;
  profileId?: string;
  profileName?: string;
  pilgrimCount: number;
  pilgrims: Pilgrim[];
  formDetected: boolean;
  readinessScore: number;
  status: 'active' | 'inactive';
  step: 1 | 2 | 3 | 4 | 5;
  lastUpdated: string;
}

/** Notification item stored locally */
export interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRoute?: string;
}

/** Local session history record (Zero PII stored) */
export interface SessionHistoryItem {
  id: string;
  timestamp: string;
  serviceType: ServiceType;
  serviceName: string;
  pilgrimCount: number;
  fieldsFilled: number;
  fieldsTotal: number;
  status: 'completed' | 'partial' | 'cancelled';
  durationMs: number;
}

/** Performance metrics for developer mode diagnostics */
export interface PerformanceMetrics {
  detectionMs: number;
  mappingMs: number;
  fillMs: number;
  verifyMs: number;
  totalMs: number;
}

/** Pre-Flight safety check item */
export interface PreFlightCheckItem {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  details?: string;
}

export interface PreFlightReport {
  ready: boolean;
  checks: PreFlightCheckItem[];
  errorCount: number;
  warningCount: number;
}

/** Form section types & progress */
export type FormSectionType = 'personal' | 'identity' | 'contact' | 'pilgrim' | 'other';

export interface SectionProgress {
  type: FormSectionType;
  title: string;
  total: number;
  completed: number;
  status: 'pending' | 'in-progress' | 'completed' | 'partial' | 'failed';
}

/** Extension message structure */
export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: string;
}

/** Page state tracked by content script */
export interface PageState {
  url: string;
  isSupported: boolean;
  serviceType?: ServiceType;
  serviceId?: string;
  serviceName?: string;
  workflowId?: string;
  serviceConfidence?: number;
  formDetected: boolean;
  fieldCount: number;
  lastScan?: ScanResult;
  lastFill?: FillResult[];
  temporaryLock?: TtdTemporaryLockState;
  guardianState?: string;
  guardianStage?: string;
}

/** Service adapter interface */
export interface ServiceAdapter {
  type: ServiceType;
  name: string;
  /** URL patterns that match this service */
  urlPatterns: RegExp[];
  /** Page markers (text/elements) that identify this service */
  pageMarkers: string[];
  /** Field schema — which pilgrim fields this service uses */
  requiredFields: (keyof Pilgrim)[];
  optionalFields: (keyof Pilgrim)[];
  /** Maximum group size */
  maxGroupSize: number;
  /** Whether photo is required */
  photoRequired: boolean;
  /** Dropdown value mappings (e.g., gender labels on the form) */
  dropdownMappings: Record<string, Record<string, string>>;
  /** Detection confidence threshold */
  detectionThreshold: number;
}
