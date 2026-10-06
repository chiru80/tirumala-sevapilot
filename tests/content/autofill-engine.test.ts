// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { scanForm } from '../../src/content/form-scanner';
import { mapFields } from '../../src/content/field-mapper';
import { fillFields } from '../../src/content/autofill-engine';
import type { Pilgrim } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('Special Entry Darshan (Sri PAT) Autofill Workflow', () => {
  it('should scan, map and autofill all 6 pilgrims into live TTD form table', async () => {
    // Generate 6 rows as rendered on TTD Special Entry Darshan (Sri PAT)
    let rowsHtml = '';
    for (let i = 0; i < 6; i++) {
      rowsHtml += `
        <div class="row pilgrim-row">
          <div><label>Name *</label><input type="text" id="name_${i}" name="pilgrim[${i}].name" /></div>
          <div><label>Age *</label><input type="number" id="age_${i}" name="pilgrim[${i}].age" /></div>
          <div>
            <label>Gender *</label>
            <select id="gender_${i}" name="pilgrim[${i}].gender">
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label>Photo ID Proof *</label>
            <select id="idType_${i}" name="pilgrim[${i}].idType">
              <option value="">Select</option>
              <option value="Aadhaar Card">Aadhaar Card</option>
              <option value="Passport">Passport</option>
            </select>
          </div>
          <div><label>Photo Id Number *</label><input type="text" id="idNumber_${i}" name="pilgrim[${i}].idNumber" /></div>
        </div>
      `;
    }

    document.body.innerHTML = `
      <div class="card">
        <h2>Special Entry Darshan (Sri PAT)</h2>
        <h3>Pilgrim Details</h3>
        ${rowsHtml}
      </div>
    `;

    // 1. Scan form
    const scanned = scanForm(document);
    expect(scanned.length).toBe(30);

    // 2. Map fields
    const mappings = mapFields(scanned);
    expect(mappings.length).toBe(30);

    // 3. Prepare 6 test pilgrims
    const mockPilgrims: Pilgrim[] = Array.from({ length: 6 }, (_, idx) => ({
      id: `p-${idx}`,
      fullName: `Devotee Number ${idx + 1}`,
      firstName: 'Devotee',
      lastName: `${idx + 1}`,
      age: 25 + idx,
      gender: idx % 2 === 0 ? Gender.MALE : Gender.FEMALE,
      dateOfBirth: '1995-01-01',
      idType: IdType.AADHAAR,
      idNumber: `98765432101${idx}`,
      mobile: '9876543210',
      country: 'India',
      state: 'Andhra Pradesh',
      city: 'Tirupati',
      isPrimary: idx === 0,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    }));

    // 4. Autofill
    const results = await fillFields(mockPilgrims, mappings, document);
    expect(results.length).toBe(30);

    const filledCount = results.filter(r => r.status === 'filled').length;
    expect(filledCount).toBe(30);

    // Verify DOM inputs were populated correctly for all 6 rows
    for (let i = 0; i < 6; i++) {
      const nameInput = document.getElementById(`name_${i}`) as HTMLInputElement;
      const ageInput = document.getElementById(`age_${i}`) as HTMLInputElement;
      const genderSelect = document.getElementById(`gender_${i}`) as HTMLSelectElement;
      const idTypeSelect = document.getElementById(`idType_${i}`) as HTMLSelectElement;
      const idNumberInput = document.getElementById(`idNumber_${i}`) as HTMLInputElement;

      expect(nameInput.value).toBe(`Devotee Number ${i + 1}`);
      expect(ageInput.value).toBe(String(25 + i));
      expect(genderSelect.value).toBe(i % 2 === 0 ? 'Male' : 'Female');
      expect(idTypeSelect.value).toBe('Aadhaar Card'); // matched Aadhaar -> Aadhaar Card
      expect(idNumberInput.value).toBe(`98765432101${i}`);
    }
  });
});
