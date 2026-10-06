import { describe, it, expect } from 'vitest';
import { mapFields } from '../../src/content/field-mapper';
import { ConfidenceLevel } from '../../src/shared/types';
import type { ScannedField } from '../../src/shared/types';

describe('Form Field Mapper & Heuristics', () => {
  it('should map Aadhaar fields with high confidence', () => {
    const fields: ScannedField[] = [
      {
        element: 'input#aadhaarNumber',
        type: 'text',
        name: 'aadhaarNumber',
        id: 'aadhaarNumber',
        label: 'Aadhaar Number',
        placeholder: 'Enter 12 digit Aadhaar',
        required: true,
      },
    ];

    const mappings = mapFields(fields);
    expect(mappings.length).toBe(1);
    expect(mappings[0].pilgrimKey).toBe('idNumber');
    expect(mappings[0].confidence).toBeGreaterThanOrEqual(80);
    expect(
      [ConfidenceLevel.VERY_HIGH, ConfidenceLevel.HIGH].includes(mappings[0].confidenceLevel),
    ).toBe(true);
  });

  it('should map Mobile / Phone fields accurately', () => {
    const fields: ScannedField[] = [
      {
        element: 'input[name="mobile"]',
        type: 'tel',
        name: 'mobile',
        label: 'Mobile No',
        placeholder: '10 digit mobile number',
      },
    ];

    const mappings = mapFields(fields);
    expect(mappings.length).toBe(1);
    expect(mappings[0].pilgrimKey).toBe('mobile');
    expect(mappings[0].confidence).toBeGreaterThanOrEqual(70);
  });

  it('should map Date of Birth fields accurately', () => {
    const fields: ScannedField[] = [
      {
        element: 'input#dob',
        type: 'date',
        name: 'dateOfBirth',
        label: 'Date of Birth (DOB)',
      },
    ];

    const mappings = mapFields(fields);
    expect(mappings.length).toBe(1);
    expect(mappings[0].pilgrimKey).toBe('dateOfBirth');
  });

  it('should map live TTD Special Entry Darshan (Sri PAT) fields accurately', () => {
    const fields: ScannedField[] = [
      {
        element: 'input#name_0',
        type: 'text',
        label: 'Name *',
        required: true,
      },
      {
        element: 'input#age_0',
        type: 'number',
        label: 'Age *',
        required: true,
      },
      {
        element: 'select#gender_0',
        type: 'select',
        label: 'Gender *',
        required: true,
        options: ['Male', 'Female'],
      },
      {
        element: 'select#idType_0',
        type: 'select',
        label: 'Photo ID Proof *',
        required: true,
        options: ['Aadhaar Card', 'Passport', 'Voter ID'],
      },
      {
        element: 'input#idNumber_0',
        type: 'text',
        label: 'Photo Id Number *',
        required: true,
      },
    ];

    const mappings = mapFields(fields);
    expect(mappings.length).toBe(5);
    expect(mappings[0].pilgrimKey).toBe('fullName');
    expect(mappings[1].pilgrimKey).toBe('age');
    expect(mappings[2].pilgrimKey).toBe('gender');
    expect(mappings[3].pilgrimKey).toBe('idType');
    expect(mappings[4].pilgrimKey).toBe('idNumber');
  });
});
