import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';

export const accommodationAdapter: ServiceAdapter = {
  id: 'accommodation',
  name: 'Tirumala / Tirupati Accommodation',
  serviceType: ServiceType.ACCOMMODATION,
  description: 'TTD Rest house and cottage room reservation adapter.',
  maxPilgrims: 4,
  urlPatterns: [/accommodation|room|cottage/i],
  markerSelectors: ['[data-testid*="accommodation"]', '#accommodationForm'],
  requiredFields: ['fullName', 'gender', 'dateOfBirth', 'idType', 'idNumber', 'country'],
  optionalFields: ['mobile', 'email', 'address', 'city', 'state', 'pinCode'],
  detect(url: string, doc: Document) {
    let score = 0;
    if (/accommodation|room/i.test(url)) score += 50;
    const text = doc.body?.innerText?.toLowerCase() || '';
    if (text.includes('accommodation') || text.includes('cottage') || text.includes('rest house')) score += 40;
    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};
