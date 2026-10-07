import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';
import { getCanonicalService } from '../canonical-service-registry';

const canonicalSed = getCanonicalService('special-entry-darshan-300')!;

export const darshanAdapter: ServiceAdapter = {
  id: 'darshan-special-entry',
  name: 'Special Entry Darshan (SED ₹300 / Sri PAT)',
  serviceType: ServiceType.DARSHAN,
  description: 'Special Entry Darshan (Seeghra Darshanam / Sri PAT) booking form adapter for TTD portal.',
  maxPilgrims: canonicalSed.maxPilgrims,
  urlPatterns: [
    /sed|darshan|special.*entry|spat|slot-booking|pilgrim-details/i,
    /home\/dashboard/i,
    /booking\/darshan/i,
  ],
  markerSelectors: [
    '[data-testid*="darshan"]',
    '#darshanForm',
    '.darshan-booking',
    'input[name*="pilgrim"]',
    'input[name*="aadhaar"]',
    '.pilgrim-details',
  ],
  requiredFields: [
    'fullName',
    'gender',
    'age',
    'idType',
    'idNumber',
  ],
  optionalFields: [
    'dateOfBirth',
    'mobile',
    'email',
    'address',
    'city',
    'state',
    'pinCode',
    'photo',
    'country',
  ],
  detect(url: string, doc: Document) {
    let score = 0;
    for (const pattern of this.urlPatterns) {
      if (pattern.test(url)) score += 40;
    }
    for (const sel of this.markerSelectors) {
      if (doc.querySelector(sel)) score += 20;
    }
    const pageText = doc.body?.innerText?.toLowerCase() || '';
    if (
      pageText.includes('special entry darshan') ||
      pageText.includes('sed') ||
      pageText.includes('sri pat') ||
      pageText.includes('spat') ||
      pageText.includes('pilgrim details')
    ) {
      score += 30;
    }
    const confidence = Math.min(100, score);
    return {
      matches: confidence >= 40,
      confidence,
    };
  },
};
