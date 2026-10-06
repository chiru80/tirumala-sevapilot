import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';

export const srivariSevaAdapter: ServiceAdapter = {
  id: 'srivari-seva',
  name: 'Srivari Seva Voluntary Service',
  serviceType: ServiceType.SRIVARI_SEVA,
  description: 'TTD Voluntary pilgrim assistance service adapter.',
  maxPilgrims: 10,
  urlPatterns: [/srivariseva|voluntary/i],
  markerSelectors: ['[data-testid*="srivari-seva"]', '#srivariSevaForm'],
  requiredFields: ['fullName', 'gender', 'dateOfBirth', 'idType', 'idNumber', 'mobile', 'country'],
  optionalFields: ['email', 'address', 'city', 'state', 'pinCode'],
  detect(url: string, doc: Document) {
    let score = 0;
    if (/srivariseva/i.test(url)) score += 50;
    const text = doc.body?.innerText?.toLowerCase() || '';
    if (text.includes('srivari seva') || text.includes('voluntary service')) score += 40;
    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};
