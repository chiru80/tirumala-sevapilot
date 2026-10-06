import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';

export const srivaniAdapter: ServiceAdapter = {
  id: 'srivani-trust',
  name: 'SRIVANI Trust Darshan / Donation',
  serviceType: ServiceType.SRIVANI,
  description: 'Sri Venkateswara Aalayala Nirmanam Trust VIP Break Darshan quota adapter.',
  maxPilgrims: 9,
  urlPatterns: [/srivani|trust|donation/i],
  markerSelectors: ['[data-testid*="srivani"]', '#srivaniForm'],
  requiredFields: ['fullName', 'gender', 'dateOfBirth', 'idType', 'idNumber', 'country'],
  optionalFields: ['mobile', 'email', 'address', 'city', 'state', 'pinCode'],
  detect(url: string, doc: Document) {
    let score = 0;
    if (/srivani/i.test(url)) score += 50;
    const text = doc.body?.innerText?.toLowerCase() || '';
    if (text.includes('srivani') || text.includes('aalayala nirmanam')) score += 40;
    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};
