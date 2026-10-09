// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Canonical Service Registry (Phase 1)
// The single authoritative source of truth for all TTD services,
// workflows, pilgrim limits, field classifications, and rules.
// ─────────────────────────────────────────────────────────────

import { ServiceType } from '@shared/types';

/**
 * Universal field classification according to Phase 1 canonical contract.
 */
export type CanonicalFieldClassification =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'CONDITIONAL'
  | 'NOT_PRESENT'
  | 'USER_CONTROLLED'
  | 'SYSTEM_GENERATED'
  | 'UNKNOWN';

/**
 * Complete field rules definition for a service across pilgrim and general steps.
 */
export interface CanonicalFieldRules {
  pilgrimFields: Record<string, CanonicalFieldClassification>;
  generalFields: Record<string, CanonicalFieldClassification>;
  prohibitedFields: string[];
  userControlledFields: string[];
}

/**
 * Authoritative canonical definition of a TTD booking service.
 */
export interface CanonicalServiceDefinition {
  serviceId: string;
  serviceName: string;
  displayName: string;
  serviceType: ServiceType;
  workflowId: string;
  workflowVersion: string;
  temple: string;
  ticketPrice: number;
  minPilgrims: number;
  maxPilgrims: number;
  exactPilgrims?: number;
  hasGeneralDetailsStep: boolean;
  fieldRules: CanonicalFieldRules;
  requiredPilgrimFields: string[];
  optionalPilgrimFields: string[];
  requiredGeneralFields: string[];
  optionalGeneralFields: string[];
  userControlledFields: string[];
  specialRequirements?: {
    gothram?: boolean;
    photo?: boolean;
    declaration?: boolean;
    fitness?: boolean;
    passport?: boolean;
    visa?: boolean;
  };
  detect: (url: string, doc: Document) => { matches: boolean; confidence: number };
}

// ─────────────────────────────────────────────────────────────
// 1. Service #1: Special Entry Darshan ₹300 (Seeghra Darshanam)
// ─────────────────────────────────────────────────────────────

export const CANONICAL_SPECIAL_ENTRY_300: CanonicalServiceDefinition = {
  serviceId: 'special-entry-darshan-300',
  serviceName: 'Special Entry Darshan ₹300',
  displayName: 'Special Entry Darshan ₹300',
  serviceType: ServiceType.DARSHAN,
  workflowId: 'special-entry-300-v1',
  workflowVersion: '1.0.0',
  temple: 'Sri Venkateswara Swamy Temple, Tirumala',
  ticketPrice: 300,
  minPilgrims: 1,
  maxPilgrims: 6,
  hasGeneralDetailsStep: true, // Step 2 (General Details) is required after Step 1 (Pilgrims)
  fieldRules: {
    pilgrimFields: {
      name: 'REQUIRED',
      age: 'REQUIRED',
      gender: 'REQUIRED',
      idProofType: 'REQUIRED',
      idProofNumber: 'REQUIRED',
      dateOfBirth: 'OPTIONAL',
      mobile: 'OPTIONAL',
    },
    generalFields: {
      email: 'REQUIRED',
      city: 'REQUIRED',
      state: 'REQUIRED',
      country: 'REQUIRED',
      pincode: 'REQUIRED',
      mobile: 'OPTIONAL', // General mobile is optional; email + address are required
      gothram: 'OPTIONAL',
    },
    prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv', 'cardNumber'],
    userControlledFields: ['declaration'],
  },
  requiredPilgrimFields: ['name', 'age', 'gender', 'idProofType', 'idProofNumber'],
  optionalPilgrimFields: ['dateOfBirth', 'mobile'],
  requiredGeneralFields: ['email', 'city', 'state', 'country', 'pincode'],
  optionalGeneralFields: ['mobile', 'gothram'],
  userControlledFields: ['declaration'],
  detect(url: string, doc: Document) {
    let score = 0;
    const lowerUrl = (url || '').toLowerCase();

    // Route Dominance Check: SPAT URLs must NEVER resolve to SED 300
    if (lowerUrl.includes('/spat/') || lowerUrl.includes('flow=spat') || lowerUrl.includes('spat-200')) {
      return { matches: false, confidence: 0 };
    }

    if (lowerUrl.includes('/sed') || lowerUrl.includes('special-entry') || lowerUrl.includes('specialentry')) {
      score += 45;
    }
    if (lowerUrl.includes('darshan') && !lowerUrl.includes('padmavathi')) {
      score += 20;
    }

    const pageText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (pageText.includes('special entry darshan') || pageText.includes('seeghra darshanam')) {
      score += 35;
    }
    if (pageText.includes('300') && (pageText.includes('darshan') || pageText.includes('ticket'))) {
      score += 20;
    }

    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};

// ─────────────────────────────────────────────────────────────
// 2. Service #2: Padmavathi / Sri PAT ₹200 (Supadham Entry)
// ─────────────────────────────────────────────────────────────

export const CANONICAL_PADMAVATHI_200: CanonicalServiceDefinition = {
  serviceId: 'padmavathi-supadham-entry-200',
  serviceName: 'Padmavathi / Sri PAT',
  displayName: 'Padmavathi / Sri PAT',
  serviceType: ServiceType.DARSHAN,
  workflowId: 'padmavathi-v1',
  workflowVersion: '1.0.0',
  temple: 'Sri Padmavathi Ammavari Temple, Tiruchanoor',
  ticketPrice: 200,
  minPilgrims: 1,
  maxPilgrims: 6,
  hasGeneralDetailsStep: false, // In verified TTD flow, General Details is NOT requested
  fieldRules: {
    pilgrimFields: {
      name: 'REQUIRED',
      age: 'REQUIRED',
      gender: 'REQUIRED',
      idProofType: 'REQUIRED',
      idProofNumber: 'REQUIRED',
      mobile: 'OPTIONAL',
    },
    generalFields: {
      email: 'NOT_PRESENT',
      city: 'NOT_PRESENT',
      state: 'NOT_PRESENT',
      country: 'NOT_PRESENT',
      pincode: 'NOT_PRESENT',
      mobile: 'NOT_PRESENT',
      gothram: 'NOT_PRESENT',
    },
    prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv'],
    userControlledFields: ['declaration'],
  },
  requiredPilgrimFields: ['name', 'age', 'gender', 'idProofType', 'idProofNumber'],
  optionalPilgrimFields: ['mobile'],
  requiredGeneralFields: [],
  optionalGeneralFields: [],
  userControlledFields: ['declaration'],
  detect(url: string, doc: Document) {
    const lowerUrl = (url || '').toLowerCase();

    // SPAT Route Dominance: Immediate 100% confidence
    if (
      lowerUrl.includes('/spat/') ||
      lowerUrl.includes('flow=spat') ||
      lowerUrl.includes('flowidentifier=spat') ||
      lowerUrl.includes('/spat')
    ) {
      return { matches: true, confidence: 100 };
    }

    let score = 0;
    if (lowerUrl.includes('padmavathi') || lowerUrl.includes('tiruchanoor') || lowerUrl.includes('pat')) {
      score += 45;
    }

    const pageText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (pageText.includes('padmavathi') || pageText.includes('sri pat') || pageText.includes('supadham')) {
      score += 40;
    }
    if (pageText.includes('200') && (pageText.includes('darshan') || pageText.includes('pat'))) {
      score += 25;
    }

    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};

// ─────────────────────────────────────────────────────────────
// 3. Service #3: Sri Srinivasa Divyanugraha Homam (₹1600)
// ─────────────────────────────────────────────────────────────

export const CANONICAL_HOMAM_1600: CanonicalServiceDefinition = {
  serviceId: 'sri-srinivasa-divyanugraha-homam',
  serviceName: 'Sri Srinivasa Divyanugraha Vishesha Homam (₹1600)',
  displayName: 'Divyanugraha Homam (₹1600)',
  serviceType: ServiceType.ARJITHA_SEVA,
  workflowId: 'homam-v1',
  workflowVersion: '1.0.0',
  temple: 'Sri Srinivasa Divyanugraha Vishesha Homam, Alipiri / Tirumala',
  ticketPrice: 1600,
  minPilgrims: 2,
  maxPilgrims: 2,
  exactPilgrims: 2, // Strictly 2 householders required per booking
  hasGeneralDetailsStep: true, // Step 2 (General Details) precedes Step 3 (Pilgrim Details)
  fieldRules: {
    pilgrimFields: {
      name: 'REQUIRED',
      age: 'REQUIRED',
      gender: 'REQUIRED',
      idProofType: 'REQUIRED',
      idProofNumber: 'REQUIRED',
      mobile: 'OPTIONAL',
    },
    generalFields: {
      gothram: 'REQUIRED', // Gothram is mandatory for Homam sankalpam
      email: 'REQUIRED',
      city: 'REQUIRED',
      state: 'REQUIRED',
      country: 'REQUIRED',
      pincode: 'REQUIRED',
      mobile: 'OPTIONAL',
    },
    prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv'],
    userControlledFields: ['declaration'],
  },
  requiredPilgrimFields: ['name', 'age', 'gender', 'idProofType', 'idProofNumber'],
  optionalPilgrimFields: ['mobile'],
  requiredGeneralFields: ['gothram', 'email', 'city', 'state', 'country', 'pincode'],
  optionalGeneralFields: ['mobile'],
  userControlledFields: ['declaration'],
  specialRequirements: {
    gothram: true,
  },
  detect(url: string, doc: Document) {
    let score = 0;
    const lowerUrl = (url || '').toLowerCase();

    if (
      lowerUrl.includes('homam') ||
      lowerUrl.includes('divyanugraha') ||
      lowerUrl.includes('srinivasa-homam') ||
      lowerUrl.includes('vishesha-homam')
    ) {
      score += 50;
    }

    const pageText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (pageText.includes('divyanugraha') || pageText.includes('vishesha homam') || pageText.includes('homam')) {
      score += 40;
    }
    if (pageText.includes('1600') || pageText.includes('gothram') || pageText.includes('householder')) {
      score += 20;
    }

    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};

// ─────────────────────────────────────────────────────────────
// 4. Service #4: Srivari Seva Voluntary Pilgrim Service
// ─────────────────────────────────────────────────────────────

export const CANONICAL_SRIVARI_SEVA: CanonicalServiceDefinition = {
  serviceId: 'srivari-seva',
  serviceName: 'Srivari Seva',
  displayName: 'Srivari Seva',
  serviceType: ServiceType.SRIVARI_SEVA,
  workflowId: 'srivari-seva-enrollment-v1',
  workflowVersion: '1.0.0',
  temple: 'Sri Venkateswara Swamy Temple, Tirumala (Voluntary Seva)',
  ticketPrice: 0,
  minPilgrims: 1,
  maxPilgrims: 1, // K02 RESOLUTION: Strictly 1 pilgrim per enrollment slot
  exactPilgrims: 1,
  hasGeneralDetailsStep: true, // Unified enrollment form containing full address
  fieldRules: {
    pilgrimFields: {
      name: 'REQUIRED',
      dateOfBirth: 'REQUIRED',
      age: 'REQUIRED',
      gender: 'REQUIRED',
      idProofType: 'REQUIRED',
      idProofNumber: 'REQUIRED',
      mobile: 'REQUIRED',
      photo: 'REQUIRED',
      country: 'REQUIRED',
      pincode: 'REQUIRED',
      state: 'REQUIRED',
      district: 'REQUIRED',
      city: 'REQUIRED',
      street: 'REQUIRED',
      doorNumber: 'REQUIRED',
      fatherSpouseName: 'OPTIONAL',
      email: 'OPTIONAL',
      bloodGroup: 'OPTIONAL',
      qualification: 'OPTIONAL',
      profession: 'OPTIONAL',
      areaOfInterest: 'OPTIONAL',
      employeeId: 'OPTIONAL',
      designation: 'OPTIONAL',
      specialisation: 'OPTIONAL',
      placeOfWork: 'OPTIONAL',
      document: 'OPTIONAL',
      mandal: 'OPTIONAL',
    },
    generalFields: {
      country: 'REQUIRED',
      pincode: 'REQUIRED',
      state: 'REQUIRED',
      district: 'REQUIRED',
      city: 'REQUIRED',
      street: 'REQUIRED',
      doorNumber: 'REQUIRED',
      email: 'OPTIONAL',
      mobile: 'REQUIRED',
    },
    prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv'],
    userControlledFields: ['declaration', 'mentallyFit', 'physicallyFit'], // MUST NEVER BE AUTO-CHECKED
  },
  requiredPilgrimFields: [
    'name',
    'dateOfBirth',
    'age',
    'gender',
    'idProofType',
    'idProofNumber',
    'mobile',
    'photo',
    'country',
    'pincode',
    'state',
    'district',
    'city',
    'street',
    'doorNumber',
  ],
  optionalPilgrimFields: [
    'fatherSpouseName',
    'email',
    'bloodGroup',
    'qualification',
    'profession',
    'areaOfInterest',
    'employeeId',
    'designation',
    'specialisation',
    'placeOfWork',
    'document',
    'mandal',
  ],
  requiredGeneralFields: [
    'country',
    'pincode',
    'state',
    'district',
    'city',
    'street',
    'doorNumber',
  ],
  optionalGeneralFields: ['email'],
  userControlledFields: ['declaration', 'mentallyFit', 'physicallyFit'],
  specialRequirements: {
    declaration: true,
    fitness: true,
    photo: true,
  },
  detect(url: string, doc: Document) {
    const lowerUrl = (url || '').toLowerCase();

    // Srivari Seva Route Dominance: Immediate 100% confidence
    if (
      lowerUrl.includes('/srivari-seva') ||
      lowerUrl.includes('/srivariseva') ||
      lowerUrl.includes('flow=srivari-seva') ||
      lowerUrl.includes('srivari_seva')
    ) {
      return { matches: true, confidence: 100 };
    }

    let score = 0;
    if (lowerUrl.includes('voluntary') || lowerUrl.includes('sevak')) {
      score += 40;
    }

    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, .page-title, .header-title'))
      .map(h => (h.textContent || '').toLowerCase())
      .join(' ');
    if (headings.includes('srivari seva') || headings.includes('parakamani seva')) {
      score += 45;
    } else {
      const marker = doc.querySelector('#srivariSevaForm, [data-service*="srivari" i], #volunteerForm');
      if (marker) {
        score += 40;
      }
    }

    const confidence = Math.min(100, score);
    return { matches: confidence >= 50, confidence };
  },
};

// ─────────────────────────────────────────────────────────────
// Registry State & Query Functions
// ─────────────────────────────────────────────────────────────

const CANONICAL_SERVICES: CanonicalServiceDefinition[] = [
  CANONICAL_SPECIAL_ENTRY_300,
  CANONICAL_PADMAVATHI_200,
  CANONICAL_HOMAM_1600,
  CANONICAL_SRIVARI_SEVA,
];

/**
 * Get all canonical TTD service definitions.
 */
export function getAllCanonicalServices(): CanonicalServiceDefinition[] {
  return [...CANONICAL_SERVICES];
}

/**
 * Lookup canonical service by serviceId or legacy alias/type.
 * Guaranteed to return ONE authoritative answer.
 */
export function getCanonicalService(serviceIdOrType: string): CanonicalServiceDefinition | undefined {
  if (!serviceIdOrType) return undefined;
  const id = serviceIdOrType.toLowerCase().trim();

  // 1. Padmavathi / Sri PAT ₹200
  if (
    id === 'padmavathi-supadham-entry-200' ||
    id === 'padmavathi-special-entry-200' ||
    id === 'padmavati-special-entry-200' ||
    id === 'padmavathi-200' ||
    id === 'padmavathi-v1' ||
    id === 'spat' ||
    id === 'spat-200' ||
    id === 'padmavathi'
  ) {
    return CANONICAL_PADMAVATHI_200;
  }

  // 2. Special Entry Darshan ₹300
  if (
    id === 'special-entry-darshan-300' ||
    id === 'special-entry-300' ||
    id === 'special-entry-300-v1' ||
    id === 'special-entry-v1' ||
    id === 'sed-300' ||
    id === 'sed' ||
    id === 'darshan-special-entry'
  ) {
    return CANONICAL_SPECIAL_ENTRY_300;
  }

  // 3. Divyanugraha Homam ₹1600
  if (
    id === 'sri-srinivasa-divyanugraha-homam' ||
    id === 'sri-srinivasa-divyanugraha-vishesha-homam' ||
    id === 'homam-1600' ||
    id === 'homam-v1' ||
    id === 'homam'
  ) {
    return CANONICAL_HOMAM_1600;
  }

  // 4. Srivari Seva
  if (
    id === 'srivari-seva' ||
    id === 'srivari-seva-enrollment-v1' ||
    id === 'srivari-seva-voluntary-service' ||
    id === 'srivari_seva' ||
    id === 'srivariseva' ||
    id === ServiceType.SRIVARI_SEVA
  ) {
    return CANONICAL_SRIVARI_SEVA;
  }

  // Safe fallback by ServiceType enum if exact
  if (id === ServiceType.DARSHAN) {
    return CANONICAL_SPECIAL_ENTRY_300;
  }
  if (id === ServiceType.ARJITHA_SEVA) {
    return CANONICAL_HOMAM_1600;
  }

  return CANONICAL_SERVICES.find(s => s.serviceId === serviceIdOrType);
}

export interface CanonicalResolutionResult {
  service?: CanonicalServiceDefinition;
  confidence: number;
  isUncertain: boolean;
  message?: string;
}

/**
 * Resolve the active canonical service from a live URL and document.
 * Conservative, route-dominant, and collision-resistant.
 */
export function resolveCanonicalService(
  url: string,
  doc?: Document,
): CanonicalResolutionResult {
  const lowerUrl = (url || '').toLowerCase();

  // Route Dominance: SPAT URLs strictly resolve to Padmavathi ₹200
  if (lowerUrl.includes('/spat/') || lowerUrl.includes('flow=spat') || lowerUrl.includes('flowidentifier=spat')) {
    return {
      service: CANONICAL_PADMAVATHI_200,
      confidence: 100,
      isUncertain: false,
    };
  }

  // Route Dominance: Srivari Seva URLs strictly resolve to Srivari Seva
  if (lowerUrl.includes('/srivari-seva') || lowerUrl.includes('/srivariseva') || lowerUrl.includes('flow=srivari-seva')) {
    return {
      service: CANONICAL_SRIVARI_SEVA,
      confidence: 100,
      isUncertain: false,
    };
  }

  const effectiveDoc = doc ?? (typeof document !== 'undefined' ? document : ({ body: { innerText: '', textContent: '' } } as unknown as Document));

  let bestMatch: CanonicalServiceDefinition | undefined = undefined;
  let highestConfidence = 0;
  let secondConfidence = 0;

  for (const service of CANONICAL_SERVICES) {
    const { matches, confidence } = service.detect(url, effectiveDoc);
    if (matches && confidence > highestConfidence) {
      secondConfidence = highestConfidence;
      highestConfidence = confidence;
      bestMatch = service;
    } else if (matches && confidence > secondConfidence) {
      secondConfidence = confidence;
    }
  }

  const MINIMUM_MARGIN = 15;
  if (
    bestMatch &&
    secondConfidence > 0 &&
    highestConfidence - secondConfidence < MINIMUM_MARGIN &&
    highestConfidence >= 50
  ) {
    return {
      service: bestMatch,
      confidence: highestConfidence,
      isUncertain: true,
      message: 'Service identified with low confidence margin. Review before autofill.',
    };
  }

  if (highestConfidence >= 50 && bestMatch) {
    return {
      service: bestMatch,
      confidence: highestConfidence,
      isUncertain: false,
    };
  }

  if (highestConfidence > 0 && highestConfidence < 50) {
    return {
      service: bestMatch,
      confidence: highestConfidence,
      isUncertain: true,
      message: 'Service identified with low confidence. Review before autofill.',
    };
  }

  return {
    service: undefined,
    confidence: 0,
    isUncertain: true,
    message: 'Service not recognized. Autofill paused.',
  };
}

/**
 * Retrieve canonical pilgrim limits for a service.
 */
export function getCanonicalServiceLimits(serviceId: string): {
  minPilgrims: number;
  maxPilgrims: number;
  exactPilgrims?: number;
} {
  const service = getCanonicalService(serviceId);
  if (!service) {
    return { minPilgrims: 1, maxPilgrims: 6 };
  }
  return {
    minPilgrims: service.minPilgrims,
    maxPilgrims: service.maxPilgrims,
    exactPilgrims: service.exactPilgrims,
  };
}

/**
 * Safe generic fallback definition for unknown or unspecified TTD services.
 * Never invents ticket prices, never assumes ?300 rules, and only mandates baseline identity fields.
 */
export const SAFE_CANONICAL_UNKNOWN_SERVICE: CanonicalServiceDefinition = {
  serviceId: 'unknown-service',
  serviceName: 'TTD Portal Service (Unspecified)',
  displayName: 'TTD Portal Service (Unspecified)',
  serviceType: ServiceType.GENERIC,
  workflowId: 'generic-workflow-v1',
  workflowVersion: '1.0.0',
  temple: 'Tirumala Tirupati Devasthanams',
  ticketPrice: 0,
  minPilgrims: 1,
  maxPilgrims: 6,
  hasGeneralDetailsStep: false,
  fieldRules: {
    pilgrimFields: {
      name: 'REQUIRED',
      age: 'REQUIRED',
      gender: 'REQUIRED',
      idProofType: 'REQUIRED',
      idProofNumber: 'REQUIRED',
    },
    generalFields: {},
    prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv', 'cardNumber'],
    userControlledFields: ['declaration', 'mentallyFit', 'physicallyFit'],
  },
  requiredPilgrimFields: ['name', 'age', 'gender', 'idProofType', 'idProofNumber'],
  optionalPilgrimFields: [],
  requiredGeneralFields: [],
  optionalGeneralFields: [],
  userControlledFields: ['declaration', 'mentallyFit', 'physicallyFit'],
  detect: () => ({ matches: false, confidence: 0 }),
};

/**
 * Retrieve canonical field rules for a service.
 * Never silently applies ?300 Special Entry requirements to an unknown service.
 */
export function getCanonicalFieldRules(serviceId: string): CanonicalFieldRules {
  const service = getCanonicalService(serviceId);
  if (!service) {
    return SAFE_CANONICAL_UNKNOWN_SERVICE.fieldRules;
  }
  return service.fieldRules;
}

/**
 * Determine whether a service expects General Details.
 * Returns false for unknown services to prevent blocking on nonexistent steps.
 */
export function hasGeneralDetails(serviceId: string): boolean {
  const service = getCanonicalService(serviceId);
  if (!service) return false;
  return service.hasGeneralDetailsStep;
}

/**
 * Check if a specific field is required for a service.
 */
export function isFieldRequiredForService(
  serviceId: string,
  section: 'pilgrim' | 'general',
  fieldKey: string,
): boolean {
  const service = getCanonicalService(serviceId);
  if (!service) return false;
  const classification =
    section === 'pilgrim'
      ? service.fieldRules.pilgrimFields[fieldKey]
      : service.fieldRules.generalFields[fieldKey];
  return classification === 'REQUIRED';
}

/**
 * Check if a specific field is strictly user-controlled and must never be automated.
 */
export function isFieldUserControlled(serviceId: string, fieldKey: string): boolean {
  const service = getCanonicalService(serviceId);
  if (!service) {
    return fieldKey === 'declaration';
  }
  return (
    service.userControlledFields.includes(fieldKey) ||
    service.fieldRules.userControlledFields.includes(fieldKey) ||
    fieldKey === 'declaration' ||
    fieldKey === 'mentallyFit' ||
    fieldKey === 'physicallyFit'
  );
}
