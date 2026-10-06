// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Strongly Typed TTD Service Registry (Phase 5)
// Defines verified TTD service configurations, schemas, and limits.
// ─────────────────────────────────────────────────────────────

export type ServiceCategory =
  | 'darshan'
  | 'arjitha_seva'
  | 'accommodation'
  | 'special_entry'
  | 'volunteer'
  | 'other';

export interface TtdServiceConfig {
  serviceId: string;
  displayName: string;
  category: ServiceCategory;

  workflowId: string;
  workflowVersion: string;

  price?: number;

  minPilgrims?: number;
  maxPilgrims?: number;
  exactPilgrims?: number;

  requiresPilgrims: boolean;

  requiredPilgrimFields: string[];
  optionalPilgrimFields: string[];

  requiredGeneralFields: string[];
  optionalGeneralFields: string[];

  specialRequirements?: {
    gothram?: boolean;
    photo?: boolean;
    passport?: boolean;
    visa?: boolean;
  };

  releasePattern?: string;

  source?: {
    url: string;
    publishedDate?: string;
    verifiedAt?: string;
  };

  verified: boolean;
}

// ─── 1. Verified Services ────────────────────────────────────

export const SPECIAL_ENTRY_300_CONFIG: TtdServiceConfig = {
  serviceId: 'special-entry-300',
  displayName: 'Special Entry Darshan (₹300)',
  category: 'darshan',
  workflowId: 'special-entry-v1',
  workflowVersion: '1.0.0',
  price: 300,
  minPilgrims: 1,
  maxPilgrims: 6,
  requiresPilgrims: true,
  requiredPilgrimFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
  optionalPilgrimFields: ['dateOfBirth', 'mobile'],
  requiredGeneralFields: ['email', 'city', 'state', 'country', 'pinCode'],
  optionalGeneralFields: ['mobile'], // Mobile is OPTIONAL per Phase 5 rules — never blocks readiness
  releasePattern: 'Released typically in the 3rd or 4th week of the preceding month at 10:00 AM IST.',
  source: {
    url: 'https://news.tirumala.org/',
    verifiedAt: '2026-10-06T00:00:00.000Z',
  },
  verified: true,
};

export const PADMAVATHI_200_CONFIG: TtdServiceConfig = {
  serviceId: 'padmavathi-special-entry-200',
  displayName: 'Sri Padmavathi Ammavari Special Entry (₹200)',
  category: 'darshan',
  workflowId: 'padmavathi-v1',
  workflowVersion: '1.0.0',
  price: 200,
  minPilgrims: 1,
  maxPilgrims: 6,
  requiresPilgrims: true,
  requiredPilgrimFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
  optionalPilgrimFields: ['mobile'],
  // In the verified observed flow, General Details were NOT requested after Pilgrim Details
  requiredGeneralFields: [],
  optionalGeneralFields: [],
  releasePattern: 'Released monthly per official temple notifications.',
  source: {
    url: 'https://www.tirumala.org/',
    verifiedAt: '2026-10-06T00:00:00.000Z',
  },
  verified: true,
};

export const HOMAM_1600_CONFIG: TtdServiceConfig = {
  serviceId: 'sri-srinivasa-divyanugraha-homam',
  displayName: 'Sri Srinivasa Divyanugraha Homam (₹1600)',
  category: 'arjitha_seva',
  workflowId: 'homam-v1',
  workflowVersion: '1.0.0',
  price: 1600,
  minPilgrims: 2,
  maxPilgrims: 2,
  exactPilgrims: 2, // Strictly 2 devotees per booking/login
  requiresPilgrims: true,
  requiredPilgrimFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
  optionalPilgrimFields: ['mobile'],
  // Order is General Details (order 3) BEFORE Pilgrim Details (order 4)
  requiredGeneralFields: ['gothram', 'email', 'city', 'state', 'country', 'pinCode'],
  optionalGeneralFields: ['mobile'],
  specialRequirements: {
    gothram: true, // Gothram required in General Details
  },
  releasePattern: 'Released approximately one month in advance.',
  source: {
    url: 'https://news.tirumala.org/',
    verifiedAt: '2026-10-06T00:00:00.000Z',
  },
  verified: true,
};

// ─── 2. Future / Unverified Services Placeholder Configurations ─

export const UNVERIFIED_SERVICES_REGISTRY: Record<string, TtdServiceConfig> = {
  'arjitha-sevas': {
    serviceId: 'arjitha-sevas',
    displayName: 'Arjitha Sevas (Kalyanotsavam, etc.)',
    category: 'arjitha_seva',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: true,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
  'accommodation': {
    serviceId: 'accommodation',
    displayName: 'Tirumala / Tirupati Accommodation',
    category: 'accommodation',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: false,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
  'srivani': {
    serviceId: 'srivani',
    displayName: 'SRIVANI Trust Darshan',
    category: 'special_entry',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: true,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
  'angapradakshinam': {
    serviceId: 'angapradakshinam',
    displayName: 'Angapradakshinam Token',
    category: 'special_entry',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: true,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
  'senior-citizen': {
    serviceId: 'senior-citizen',
    displayName: 'Senior Citizen & Specially Abled Darshan',
    category: 'special_entry',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: true,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
  'kalyana-vedika': {
    serviceId: 'kalyana-vedika',
    displayName: 'Kalyana Vedika Registration',
    category: 'other',
    workflowId: 'UNKNOWN',
    workflowVersion: '0.0.0',
    requiresPilgrims: true,
    requiredPilgrimFields: [],
    optionalPilgrimFields: [],
    requiredGeneralFields: [],
    optionalGeneralFields: [],
    verified: false,
  },
};

export const VERIFIED_SERVICES_REGISTRY: Record<string, TtdServiceConfig> = {
  'special-entry-300': SPECIAL_ENTRY_300_CONFIG,
  'special-entry-darshan-300': SPECIAL_ENTRY_300_CONFIG, // Canonical alias
  'padmavathi-special-entry-200': PADMAVATHI_200_CONFIG,
  'padmavathi-supadham-entry-200': PADMAVATHI_200_CONFIG, // Canonical alias
  'sri-srinivasa-divyanugraha-homam': HOMAM_1600_CONFIG,
};

/**
 * Retrieve service configuration by serviceId.
 * Never fabricates verified status for unconfirmed services.
 */
export function getServiceConfig(serviceId: string): TtdServiceConfig | undefined {
  if (!serviceId) return undefined;
  const normalized = serviceId.toLowerCase().trim();
  return VERIFIED_SERVICES_REGISTRY[normalized] || UNVERIFIED_SERVICES_REGISTRY[normalized];
}

/**
 * Returns all verified TTD service configurations.
 */
export function getAllVerifiedServices(): TtdServiceConfig[] {
  return [SPECIAL_ENTRY_300_CONFIG, PADMAVATHI_200_CONFIG, HOMAM_1600_CONFIG];
}

/**
 * Returns all registered services (verified and unverified).
 */
export function getAllRegisteredServices(): TtdServiceConfig[] {
  return [
    ...getAllVerifiedServices(),
    ...Object.values(UNVERIFIED_SERVICES_REGISTRY),
  ];
}
