import { ServiceType } from '@shared/types';
import type { Pilgrim } from '@shared/types';
import type { ServiceAdapter } from '../types';
import { getCanonicalService } from '../canonical-service-registry';

const canonicalSrivari = getCanonicalService('srivari-seva')!;

/**
 * Legacy Srivari Seva Adapter.
 * Derived strictly from the canonical Srivari Seva definition to eliminate
 * contradictory limits (K02) and conflicting field schemas (K03).
 */
export const srivariSevaAdapter: ServiceAdapter = {
  id: canonicalSrivari.serviceId,
  name: canonicalSrivari.serviceName,
  serviceType: ServiceType.SRIVARI_SEVA,
  description: 'TTD Voluntary pilgrim assistance service adapter.',
  maxPilgrims: canonicalSrivari.maxPilgrims, // Strictly 1 (Derived from canonical service)
  urlPatterns: [/srivari-seva/i, /srivariseva/i, /voluntary/i],
  markerSelectors: ['[data-testid*="srivari-seva"]', '#srivariSevaForm', '[data-service*="srivari-seva" i]'],
  requiredFields: [
    'fullName',
    'dateOfBirth',
    'gender',
    'idType',
    'idNumber',
    'mobile',
    'country',
    'pinCode',
    'state',
    'district',
    'city',
  ] as Array<keyof Pilgrim>,
  optionalFields: [
    'email',
    'address',
  ] as Array<keyof Pilgrim>,
  detect(url: string, doc: Document) {
    return canonicalSrivari.detect(url, doc);
  },
};
