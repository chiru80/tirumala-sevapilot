import { ServiceType } from '@shared/types';
import type { ServiceAdapter } from '../types';

export const genericAdapter: ServiceAdapter = {
  id: 'generic-ttd',
  name: 'Generic TTD Booking Form',
  serviceType: ServiceType.GENERIC,
  description: 'Adaptive fallback engine matching standard Indian pilgrim identity and contact fields.',
  maxPilgrims: 10,
  urlPatterns: [/ttdevasthanams\.ap\.gov\.in/i, /tirupatibalaji\.ap\.gov\.in/i],
  markerSelectors: ['form', 'input'],
  requiredFields: ['fullName', 'gender', 'dateOfBirth', 'idType', 'idNumber', 'mobile'],
  optionalFields: ['email', 'address', 'city', 'state', 'pinCode'],
  detect(url: string, _doc: Document) {
    const isTTD = /ttdevasthanams\.ap\.gov\.in|tirupatibalaji\.ap\.gov\.in/i.test(url);
    return {
      matches: isTTD,
      confidence: isTTD ? 50 : 10,
    };
  },
};
