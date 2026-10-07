// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Intelligent Field Mapping Engine
// Candidate Fields architecture & Section classification
// ─────────────────────────────────────────────────

import type { ScannedField, FieldMapping, Pilgrim, FormSectionType } from '@shared/types';
import { mapFields } from './field-mapper';

export interface FieldCandidate {
  field: ScannedField;
  key: keyof Pilgrim;
  score: number;
  reasons: string[];
}

export interface SectionalMappedResult {
  allMapped: FieldMapping[];
  unmapped: ScannedField[];
  sections: {
    personal: FieldMapping[];
    identity: FieldMapping[];
    contact: FieldMapping[];
    pilgrim: FieldMapping[];
    other: FieldMapping[];
  };
  groupCount: number;
}

export const FIELD_SECTION_MAP: Record<keyof Pilgrim, FormSectionType> = {
  fullName: 'personal',
  firstName: 'personal',
  middleName: 'personal',
  lastName: 'personal',
  age: 'personal',
  dateOfBirth: 'personal',
  gender: 'personal',

  idType: 'identity',
  idNumber: 'identity',
  passportNumber: 'identity',
  passportExpiry: 'identity',
  visaNumber: 'identity',
  visaExpiry: 'identity',

  mobile: 'contact',
  email: 'contact',

  address: 'pilgrim',
  city: 'pilgrim',
  district: 'pilgrim',
  state: 'pilgrim',
  country: 'pilgrim',
  pinCode: 'pilgrim',

  id: 'other',
  photo: 'other',
  notes: 'other',
  srivariSeva: 'other',
  createdAt: 'other',
  updatedAt: 'other',
};

export class FieldMappingEngine {
  /**
   * Run Candidate Fields pipeline:
   * DOM Fields -> Scanned -> Candidate Scoring -> Disambiguation -> Group De-collision -> Section Grouping
   */
  public static map(scannedFields: ScannedField[]): SectionalMappedResult {
    // 1. Initial multi-signal map
    const initialMappings = mapFields(scannedFields);

    // 2. Group de-collision: In each groupIndex, ensure unique 1:1 mapping for critical keys
    const validatedMappings: FieldMapping[] = [];
    const groups = new Map<number, FieldMapping[]>();

    for (const m of initialMappings) {
      const gIndex = m.scannedField.groupIndex ?? 0;
      if (!groups.has(gIndex)) {
        groups.set(gIndex, []);
      }
      groups.get(gIndex)!.push(m);
    }

    for (const [_, groupList] of groups) {
      const claimedKeys = new Set<string>();

      // Sort by confidence descending
      groupList.sort((a, b) => b.confidence - a.confidence);

      for (const mapping of groupList) {
        if (!mapping.pilgrimKey) {
          validatedMappings.push(mapping);
          continue;
        }

        const key = mapping.pilgrimKey as string;

        // If unique key is already claimed in this devotee row by a higher confidence match,
        // don't overwrite if confidence is lower
        if (['idNumber', 'idType', 'fullName', 'mobile'].includes(key) && claimedKeys.has(key)) {
          // Demote to unmapped or alternative
          validatedMappings.push({
            ...mapping,
            pilgrimKey: null,
            confidence: 0,
            matchReasons: [...mapping.matchReasons, `Duplicate key ${key} in row skipped in favor of primary match`],
          });
        } else {
          claimedKeys.add(key);
          validatedMappings.push(mapping);
        }
      }
    }

    // 3. Section classification
    const sections: SectionalMappedResult['sections'] = {
      personal: [],
      identity: [],
      contact: [],
      pilgrim: [],
      other: [],
    };

    const unmapped: ScannedField[] = [];

    for (const m of validatedMappings) {
      if (m.pilgrimKey) {
        const secType = FIELD_SECTION_MAP[m.pilgrimKey] || 'other';
        sections[secType].push(m);
      } else {
        unmapped.push(m.scannedField);
      }
    }

    return {
      allMapped: validatedMappings,
      unmapped,
      sections,
      groupCount: Math.max(1, groups.size),
    };
  }

  /**
   * Helper to get section name display
   */
  public static getSectionDisplayName(section: FormSectionType): string {
    switch (section) {
      case 'personal':
        return 'Personal Details';
      case 'identity':
        return 'Identity Verification';
      case 'contact':
        return 'Contact Information';
      case 'pilgrim':
        return 'Address & Residence';
      default:
        return 'Other Fields';
    }
  }
}
