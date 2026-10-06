import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';

export const arjithaSevaAdapter: ServiceAdapter = {
  id: 'arjitha-seva',
  name: 'Arjitha Seva (Suprabhatam, Kalyanotsavam, etc.)',
  serviceType: ServiceType.ARJITHA_SEVA,
  description: 'Arjitha Seva booking form adapter for electronic dip and general quota.',
  maxPilgrims: 2,
  urlPatterns: [/arjitha|seva/i],
  markerSelectors: ['[data-testid*="seva"]', '#sevaForm', '.seva-container'],
  requiredFields: ['fullName', 'gender', 'dateOfBirth', 'idType', 'idNumber', 'country'],
  optionalFields: ['mobile', 'email', 'address', 'city', 'state', 'pinCode'],
  detect(url: string, doc: Document) {
    let score = 0;
    if (/arjitha|seva/i.test(url)) score += 50;
    const text = doc.body?.innerText?.toLowerCase() || '';
    if (text.includes('arjitha seva') || text.includes('kalyanotsavam') || text.includes('suprabhatam')) score += 40;
    const confidence = Math.min(100, score);
    return { matches: confidence >= 40, confidence };
  },
};
