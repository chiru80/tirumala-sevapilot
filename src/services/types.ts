// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Service Adapter Types & Registry
// ─────────────────────────────────────────────────

import type { ServiceType, Pilgrim, FieldMapping, ScannedField } from '@shared/types';

export interface ServiceAdapter {
  id: string;
  name: string;
  serviceType: ServiceType;
  description: string;
  maxPilgrims: number;
  urlPatterns: RegExp[];
  markerSelectors: string[];
  requiredFields: Array<keyof Pilgrim>;
  optionalFields: Array<keyof Pilgrim>;
  detect: (url: string, document: Document) => { matches: boolean; confidence: number };
  mapFields?: (fields: ScannedField[]) => FieldMapping[];
}
