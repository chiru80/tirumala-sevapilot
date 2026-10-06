import type { ServiceAdapter } from './types';
import { darshanAdapter } from './darshan';
import { arjithaSevaAdapter } from './arjitha-seva';
import { accommodationAdapter } from './accommodation';
import { srivaniAdapter } from './srivani';
import { srivariSevaAdapter } from './srivari-seva';
import { genericAdapter } from './generic';
import type { ServiceType } from '@shared/types';

const registeredAdapters: ServiceAdapter[] = [
  darshanAdapter,
  arjithaSevaAdapter,
  accommodationAdapter,
  srivaniAdapter,
  srivariSevaAdapter,
  genericAdapter,
];

export function getAllAdapters(): ServiceAdapter[] {
  return [...registeredAdapters];
}

export function getAdapterForService(type: ServiceType): ServiceAdapter | undefined {
  return registeredAdapters.find(a => a.serviceType === type);
}

export function getAdapterForUrl(url: string, doc: Document): ServiceAdapter {
  let bestMatch: ServiceAdapter = genericAdapter;
  let highestConfidence = 0;

  for (const adapter of registeredAdapters) {
    if (adapter === genericAdapter) continue;
    const { matches, confidence } = adapter.detect(url, doc);
    if (matches && confidence > highestConfidence) {
      highestConfidence = confidence;
      bestMatch = adapter;
    }
  }

  return bestMatch;
}
