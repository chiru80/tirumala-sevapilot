// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { FieldMappingEngine } from '../../src/content/field-mapping-engine';
import type { ScannedField } from '../../src/shared/types';

describe('FieldMappingEngine Candidate Pipeline & Section Classification', () => {
  it('should categorize fields into Personal, Identity, and Contact sections', () => {
    const mockFields: ScannedField[] = [
      {
        element: '#name',
        type: 'text',
        name: 'pilgrimName',
        label: 'Name *',
        groupIndex: 0,
      },
      {
        element: '#age',
        type: 'number',
        name: 'age',
        label: 'Age *',
        groupIndex: 0,
      },
      {
        element: '#gender',
        type: 'select',
        name: 'gender',
        label: 'Gender *',
        groupIndex: 0,
      },
      {
        element: '#idProof',
        type: 'select',
        name: 'photoIdProof',
        label: 'Photo ID Proof *',
        groupIndex: 0,
      },
      {
        element: '#idNumber',
        type: 'text',
        name: 'photoIdProofNumber',
        label: 'Photo Id Number *',
        groupIndex: 0,
      },
      {
        element: '#mobile',
        type: 'tel',
        name: 'mobileNumber',
        label: 'Mobile Number *',
        groupIndex: 0,
      },
    ];

    const result = FieldMappingEngine.map(mockFields);

    expect(result.sections.personal.length).toBe(3); // Name, Age, Gender
    expect(result.sections.identity.length).toBe(2); // ID Proof, ID Number
    expect(result.sections.contact.length).toBe(1);  // Mobile
    expect(result.groupCount).toBe(1);

    // Verify disambiguation between ID Proof and ID Number
    const idProofMapping = result.sections.identity.find(m => m.scannedField.name === 'photoIdProof');
    const idNumberMapping = result.sections.identity.find(m => m.scannedField.name === 'photoIdProofNumber');

    expect(idProofMapping?.pilgrimKey).toBe('idType');
    expect(idNumberMapping?.pilgrimKey).toBe('idNumber');
  });

  it('should de-collide duplicate keys in the same devotee row', () => {
    const mockFields: ScannedField[] = [
      {
        element: '#num1',
        type: 'text',
        name: 'photoIdNumber',
        label: 'Photo Id Number *',
        groupIndex: 0,
      },
      {
        element: '#num2',
        type: 'text',
        name: 'idNumberAlt',
        label: 'ID Proof Number',
        groupIndex: 0,
      },
    ];

    const result = FieldMappingEngine.map(mockFields);
    const mappedKeys = result.allMapped.map(m => m.pilgrimKey).filter(k => k === 'idNumber');
    expect(mappedKeys.length).toBe(1); // Only 1 primary claim for idNumber in row 0
  });
});
