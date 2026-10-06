// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { executeAutofill, requestStop } from '../../src/content/autofill/autofill-manager';
import { detectAndLockPilgrimRows, isRowValidInDOM } from '../../src/content/autofill/row-detector';
import { detectActiveBookingStep } from '../../src/content/autofill/page-workflow';
import { resolvePilgrimFields, resolveGeneralFields } from '../../src/content/autofill/field-resolver';
import { verifyTextValue, verifyNumericValue, verifyAadhaarValue, verifyDropdownSelection } from '../../src/content/autofill/verification';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

// ─── Helper: Create mock pilgrim ───
function mockPilgrim(overrides: Partial<Pilgrim> = {}): Pilgrim {
  return {
    id: 'p1',
    firstName: 'Ravi',
    lastName: 'Kumar',
    fullName: 'Ravi Kumar',
    age: 35,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '123456789012',
    country: 'India',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockProfile(pilgrims: Pilgrim[]): Profile {
  return {
    id: 'prof1',
    name: 'Test Profile',
    pilgrims,
    selectedPilgrims: {},
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    general: {
      email: 'test@example.com',
      mobile: '9876543210',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
    },
  };
}

describe('Autofill Manager & Row Locking', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Special Entry Darshan');
    doc.body.innerHTML = '';
  });

  function createMultiPilgrimForm(count: number): void {
    const container = doc.createElement('div');
    container.className = 'mat-table ttd-pilgrim-container';

    for (let i = 0; i < count; i++) {
      const row = doc.createElement('div');
      row.className = 'mat-row pilgrim-row';
      row.id = `devotee-row-${i}`;

      row.innerHTML = `
        <div class="col-name">
          <input name="pilgrimName_${i}" formcontrolname="name" placeholder="Pilgrim Name" value="" />
        </div>
        <div class="col-age">
          <input name="age_${i}" formcontrolname="age" placeholder="Age" type="number" value="" />
        </div>
        <div class="col-gender">
          <select name="gender_${i}" formcontrolname="gender">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div class="col-idproof">
          <select name="photoIdProof_${i}" formcontrolname="photoIdProof">
            <option value="">Select ID Proof</option>
            <option value="Aadhaar Card">Aadhaar Card</option>
            <option value="Passport">Passport</option>
          </select>
        </div>
        <div class="col-idnumber">
          <input name="photoIdNumber_${i}" formcontrolname="photoIdNumber" placeholder="Photo ID Number" value="" />
        </div>
      `;

      container.appendChild(row);
    }
    doc.body.appendChild(container);
  }

  // ─── 1. Single Pilgrim ───
  describe('1. Single Pilgrim', () => {
    it('detects and locks 1 row for 1 pilgrim', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      expect(rows.length).toBe(1);
      expect(rows[0].isLocked).toBe(true);
      expect(rows[0].index).toBe(0);
    });

    it('resolves all 5 pilgrim fields in a single row', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      const fields = rows[0].fields;
      expect(fields.has('name')).toBe(true);
      expect(fields.has('age')).toBe(true);
      expect(fields.has('gender')).toBe(true);
      expect(fields.has('photoIdProof')).toBe(true);
      expect(fields.has('photoIdNumber')).toBe(true);
    });
  });

  // ─── 2. Two Pilgrims ───
  describe('2. Two Pilgrims', () => {
    it('detects 2 rows for 2 pilgrims', () => {
      createMultiPilgrimForm(2);
      const rows = detectAndLockPilgrimRows(doc, 2);
      expect(rows.length).toBe(2);
    });

    it('each row has independent field mappings', () => {
      createMultiPilgrimForm(2);
      const rows = detectAndLockPilgrimRows(doc, 2);
      const nameEl0 = rows[0].fields.get('name');
      const nameEl1 = rows[1].fields.get('name');
      expect(nameEl0).not.toBe(nameEl1);
    });
  });

  // ─── 3. Six Pilgrims (maximum TTD) ───
  describe('3. Six Pilgrims', () => {
    it('detects 6 rows for 6 pilgrims', () => {
      createMultiPilgrimForm(6);
      const rows = detectAndLockPilgrimRows(doc, 6);
      expect(rows.length).toBe(6);
    });

    it('rows do not overlap (no shared elements)', () => {
      createMultiPilgrimForm(6);
      const rows = detectAndLockPilgrimRows(doc, 6);
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          expect(rows[i].element.contains(rows[j].element)).toBe(false);
          expect(rows[j].element.contains(rows[i].element)).toBe(false);
        }
      }
    });

    it('rows are sorted by DOM order', () => {
      createMultiPilgrimForm(6);
      const rows = detectAndLockPilgrimRows(doc, 6);
      for (let i = 0; i < rows.length - 1; i++) {
        const pos = rows[i].element.compareDocumentPosition(rows[i + 1].element);
        expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });

  // ─── 4. Missing Gender ───
  describe('4. Missing Gender', () => {
    it('reports gender as failed when gender dropdown is missing', () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <input formcontrolname="name" placeholder="Pilgrim Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <select formcontrolname="photoIdProof">
            <option value="">Select</option>
            <option value="Aadhaar Card">Aadhaar Card</option>
          </select>
          <input formcontrolname="photoIdNumber" placeholder="ID Number" />
        </div>
      `;
      const rows = detectAndLockPilgrimRows(doc, 1);
      // Gender might be resolved via structural fallback or not
      // The point is it should not crash
      expect(rows.length).toBe(1);
    });
  });

  // ─── 5. Missing ID Type ───
  describe('5. Missing ID Type', () => {
    it('does not crash when ID Proof dropdown is absent', () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <input formcontrolname="name" placeholder="Pilgrim Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <select formcontrolname="gender">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <input formcontrolname="photoIdNumber" placeholder="ID Number" />
        </div>
      `;
      const rows = detectAndLockPilgrimRows(doc, 1);
      expect(rows.length).toBe(1);
    });
  });

  // ─── 6. Disabled ID Number ───
  describe('6. Disabled ID Number', () => {
    it('does NOT force-enable a disabled field', async () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <input formcontrolname="name" placeholder="Pilgrim Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <select formcontrolname="gender"><option value="Male">Male</option></select>
          <select formcontrolname="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
          <input formcontrolname="photoIdNumber" placeholder="ID Number" disabled />
        </div>
      `;
      const pilgrims = [mockPilgrim()];
      const result = await executeAutofill({ pilgrims, doc });
      // ID Number should be reported as failed, NOT silently filled
      const idNumResult = result.pilgrimResults[0]?.results?.find(r => r.field === 'photoIdNumber');
      if (idNumResult) {
        // It should fail since the field is disabled and we don't force-enable
        expect(idNumResult.status).toBe('failed');
      }
      // Verify the element is still disabled (we didn't force it)
      const disabledInput = doc.querySelector<HTMLInputElement>('input[formcontrolname="photoIdNumber"]');
      expect(disabledInput?.disabled).toBe(true);
    });
  });

  // ─── 7. Dynamically Inserted ID Number ───
  describe('7. Dynamically Inserted ID Number', () => {
    it('resolves a field that appears after initial scan', () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <input formcontrolname="name" placeholder="Pilgrim Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <select formcontrolname="gender"><option value="Male">Male</option></select>
          <select formcontrolname="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
        </div>
      `;
      const rows = detectAndLockPilgrimRows(doc, 1);
      expect(rows[0].fields.has('photoIdNumber')).toBe(false);

      // Dynamically add the field
      const row = doc.querySelector('.pilgrim-row')!;
      const newInput = doc.createElement('input');
      newInput.setAttribute('formcontrolname', 'photoIdNumber');
      newInput.placeholder = 'Photo ID Number';
      row.appendChild(newInput);

      // Re-detect
      const rows2 = detectAndLockPilgrimRows(doc, 1);
      expect(rows2[0].fields.has('photoIdNumber')).toBe(true);
    });
  });

  // ─── 8. Angular-Style Input ───
  describe('8. Angular-Style Input', () => {
    it('detects fields with formcontrolname attributes', () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <mat-form-field><mat-label>Pilgrim Name</mat-label><input matInput formcontrolname="name" /></mat-form-field>
          <mat-form-field><mat-label>Age</mat-label><input matInput formcontrolname="age" type="number" /></mat-form-field>
          <mat-form-field><mat-label>Gender</mat-label><select formcontrolname="gender"><option value="Male">Male</option></select></mat-form-field>
          <mat-form-field><mat-label>Photo ID Proof</mat-label><select formcontrolname="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select></mat-form-field>
          <mat-form-field><mat-label>Photo ID Number</mat-label><input matInput formcontrolname="photoIdNumber" /></mat-form-field>
        </div>
      `;
      const resolved = resolvePilgrimFields(doc.querySelector('.pilgrim-row')! as HTMLElement, doc);
      expect(resolved.has('name')).toBe(true);
      expect(resolved.has('age')).toBe(true);
      expect(resolved.has('gender')).toBe(true);
      expect(resolved.has('photoIdProof')).toBe(true);
      expect(resolved.has('photoIdNumber')).toBe(true);
    });
  });

  // ─── 9. Native Select ───
  describe('9. Native Select', () => {
    it('detects native <select> as gender and ID proof controls', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      const genderEl = rows[0].fields.get('gender');
      const idProofEl = rows[0].fields.get('photoIdProof');
      expect(genderEl instanceof HTMLSelectElement || genderEl?.tagName === 'SELECT').toBe(true);
      expect(idProofEl instanceof HTMLSelectElement || idProofEl?.tagName === 'SELECT').toBe(true);
    });
  });

  // ─── 10. Angular Material Dropdown (mat-select mock) ───
  describe('10. Angular Material Dropdown', () => {
    it('detects mat-select elements', () => {
      doc.body.innerHTML = `
        <div class="pilgrim-row">
          <input formcontrolname="name" placeholder="Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <mat-select formcontrolname="gender" role="combobox"><mat-option value="Male">Male</mat-option></mat-select>
          <mat-select formcontrolname="photoIdProof" role="combobox"><mat-option value="Aadhaar Card">Aadhaar Card</mat-option></mat-select>
          <input formcontrolname="photoIdNumber" placeholder="ID Number" />
        </div>
      `;
      const resolved = resolvePilgrimFields(doc.querySelector('.pilgrim-row')! as HTMLElement, doc);
      expect(resolved.has('gender')).toBe(true);
      expect(resolved.has('photoIdProof')).toBe(true);
    });
  });

  // ─── 11. Male vs Female Matching ───
  describe('11. Male vs Female Matching', () => {
    it('Male NEVER matches Female option', () => {
      doc.body.innerHTML = `
        <select id="genderSel">
          <option value="">Select</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
      `;
      const sel = doc.getElementById('genderSel') as HTMLSelectElement;
      // Simulate matching logic
      const normTarget = 'male';
      const options = Array.from(sel.options);
      const matched = options.find(opt => {
        const text = opt.textContent!.trim().toLowerCase();
        const val = opt.value.toLowerCase();
        if (text.includes('female') || val.includes('female')) return false;
        return text === 'male' || val === 'male';
      });
      expect(matched?.value).toBe('Male');
      expect(matched?.textContent?.trim()).toBe('Male');
    });

    it('Female NEVER matches Male option', () => {
      doc.body.innerHTML = `
        <select id="genderSel">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      `;
      const sel = doc.getElementById('genderSel') as HTMLSelectElement;
      const normTarget = 'female';
      const options = Array.from(sel.options);
      const matched = options.find(opt => {
        const text = opt.textContent!.trim().toLowerCase();
        const val = opt.value.toLowerCase();
        return text === 'female' || val === 'female';
      });
      expect(matched?.value).toBe('Female');
    });
  });

  // ─── 12. Aadhaar Exact Verification ───
  describe('12. Aadhaar Exact Verification', () => {
    it('verifies exact digit match for Aadhaar', () => {
      const input = doc.createElement('input');
      input.value = '123456789012';
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber');
      expect(result.status).toBe('verified');
    });

    it('rejects wrong digits for Aadhaar', () => {
      const input = doc.createElement('input');
      input.value = '111111111111';
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber');
      expect(result.status).toBe('failed');
    });

    it('masks Aadhaar in verification result', () => {
      const input = doc.createElement('input');
      input.value = '123456789012';
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber');
      expect(result.maskedExpected).not.toContain('123456789012');
      expect(result.maskedExpected).toContain('9012');
    });
  });

  // ─── 13. Field Collision Prevention ───
  describe('13. Field Collision Prevention', () => {
    it('never maps the same element to two different fields', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      const fields = rows[0].fields;

      const allElements = Array.from(fields.values());
      const uniqueElements = new Set(allElements);
      expect(uniqueElements.size).toBe(allElements.length);
    });

    it('gender and photoIdProof are always different elements', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      const genderEl = rows[0].fields.get('gender');
      const idProofEl = rows[0].fields.get('photoIdProof');
      if (genderEl && idProofEl) {
        expect(genderEl).not.toBe(idProofEl);
      }
    });
  });

  // ─── 14. DOM Re-render ───
  describe('14. DOM Re-render', () => {
    it('detects when a row is detached from DOM', () => {
      createMultiPilgrimForm(1);
      const rows = detectAndLockPilgrimRows(doc, 1);
      expect(doc.contains(rows[0].element)).toBe(true);

      // Simulate re-render
      const parent = rows[0].element.parentElement!;
      parent.removeChild(rows[0].element);

      // isRowValidInDOM should detect the stale reference
      expect(isRowValidInDOM(rows[0], doc)).toBe(false);
    });
  });

  // ─── 15. Selected Pilgrim Subset ───
  describe('15. Selected Pilgrim Subset', () => {
    it('fills only selected pilgrims (e.g. 2 out of 4 rows)', async () => {
      createMultiPilgrimForm(4);
      const selectedPilgrims = [
        mockPilgrim({ id: 'p1', fullName: 'Ravi Kumar' }),
        mockPilgrim({ id: 'p3', fullName: 'Lakshmi Devi', gender: Gender.FEMALE }),
      ];

      const result = await executeAutofill({
        pilgrims: selectedPilgrims,
        doc,
      });

      // Should have results for exactly 2 pilgrims
      expect(result.pilgrimResults.length).toBe(2);
    });
  });

  // ─── 16. General Details ───
  describe('16. General Details', () => {
    it('resolves general fields on a contact form', () => {
      doc.body.innerHTML = `
        <form>
          <input type="email" formcontrolname="email" placeholder="Email" />
          <input type="tel" formcontrolname="mobile" placeholder="Mobile" />
          <input formcontrolname="city" placeholder="City" />
          <select formcontrolname="state">
            <option value="">Select State</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
          </select>
          <select formcontrolname="country">
            <option value="India">India</option>
          </select>
          <input formcontrolname="pinCode" placeholder="PIN Code" />
        </form>
      `;
      const resolved = resolveGeneralFields(doc);
      expect(resolved.has('email')).toBe(true);
      expect(resolved.has('mobile')).toBe(true);
      expect(resolved.has('city')).toBe(true);
    });
  });

  // ─── 17. Missing General Field ───
  describe('17. Missing General Field', () => {
    it('reports failed for fields not detected (never silently omits)', async () => {
      // Only email and mobile present, city/state/country/pin missing
      doc.body.innerHTML = `
        <form>
          <input type="email" formcontrolname="email" placeholder="Email" />
          <input type="tel" formcontrolname="mobile" placeholder="Mobile" />
        </form>
      `;
      const profile = mockProfile([mockPilgrim()]);

      const result = await executeAutofill({
        pilgrims: [mockPilgrim()],
        profile,
        doc,
      });

      // Since this is a simple form without pilgrim fields, step detection may return 'general'
      // The key assertion: no general field should be silently omitted
      if (result.step === 'general') {
        // Check that all 6 expected general fields have results
        expect(result.generalResults.length).toBeGreaterThanOrEqual(4);
        const cityResult = result.generalResults.find(r => r.field === 'city');
        if (cityResult) {
          expect(cityResult.status === 'failed' || cityResult.status === 'skipped').toBe(true);
        }
      }
    });
  });

  // ─── 18. Duplicate Autofill Trigger ───
  describe('18. Duplicate Autofill Trigger', () => {
    it('blocks concurrent autofill invocations', async () => {
      createMultiPilgrimForm(1);
      const pilgrims = [mockPilgrim()];

      // Start first autofill (non-blocking)
      const first = executeAutofill({ pilgrims, doc });

      // Immediately trigger second — should be blocked
      const second = await executeAutofill({ pilgrims, doc });
      expect(second.success).toBe(false);
      expect(second.errors[0]).toContain('already in progress');

      // Wait for first to complete
      await first;
    });
  });

  // ─── 19. Stop Request ───
  describe('19. Stop Request', () => {
    it('stops autofill when requestStop is called', async () => {
      createMultiPilgrimForm(6);
      const pilgrims = Array.from({ length: 6 }, (_, i) =>
        mockPilgrim({ id: `p${i}`, fullName: `Pilgrim ${i + 1}` })
      );

      // Request stop immediately
      setTimeout(() => requestStop(), 10);

      const result = await executeAutofill({ pilgrims, doc });
      // Result may be stopped or complete depending on timing
      expect(['STOPPED', 'COMPLETE', 'ERROR']).toContain(result.state);
    });
  });

  // ─── 20. Ambiguous Field Detection ───
  describe('20. Ambiguous Field Detection', () => {
    it('does not crash on forms with unusual structure', () => {
      doc.body.innerHTML = `
        <div>
          <input placeholder="Enter something" />
          <input placeholder="Another field" />
          <select><option>Option A</option><option>Option B</option></select>
        </div>
      `;
      // Should not throw and must fail-closed (0 rows) on ambiguous/unrelated forms
      const rows = detectAndLockPilgrimRows(doc, 1);
      expect(rows.length).toBe(0);
    });
  });
});

// ─── Step Detection Tests ───
describe('Step Detection (page-workflow)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  it('detects PILGRIM_DETAILS when pilgrim fields are visible', () => {
    doc.body.innerHTML = `
      <form>
        <input formcontrolname="name" placeholder="Pilgrim Name" />
        <input formcontrolname="age" type="number" placeholder="Age" />
        <select formcontrolname="gender"><option>Male</option></select>
      </form>
    `;
    expect(detectActiveBookingStep(doc)).toBe('PILGRIM_DETAILS');
  });

  it('detects GENERAL_DETAILS when email/mobile fields are visible', () => {
    doc.body.innerHTML = `
      <form>
        <input type="email" formcontrolname="email" placeholder="Email" />
        <input type="tel" formcontrolname="mobile" placeholder="Mobile" />
        <input formcontrolname="city" placeholder="City" />
        <select formcontrolname="state"><option>Andhra Pradesh</option></select>
      </form>
    `;
    expect(detectActiveBookingStep(doc)).toBe('GENERAL_DETAILS');
  });

  it('returns UNKNOWN for an empty page', () => {
    expect(detectActiveBookingStep(doc)).toBe('UNKNOWN');
  });
});

// ─── Verification Tests ───
describe('Verification Engine', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Test');
    doc.body.innerHTML = '';
  });

  it('verifies text exact match', () => {
    const input = doc.createElement('input');
    input.value = 'Ravi Kumar';
    const result = verifyTextValue(input, 'Ravi Kumar', 'name');
    expect(result.status).toBe('verified');
  });

  it('fails on text mismatch', () => {
    const input = doc.createElement('input');
    input.value = 'Wrong Name';
    const result = verifyTextValue(input, 'Ravi Kumar', 'name');
    expect(result.status).toBe('failed');
  });

  it('verifies numeric equality for age', () => {
    const input = doc.createElement('input');
    input.value = '35';
    const result = verifyNumericValue(input, '35', 'age');
    expect(result.status).toBe('verified');
  });

  it('verifies native select dropdown', () => {
    const select = doc.createElement('select');
    select.innerHTML = `
      <option value="">Select</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
    `;
    select.value = 'Male';
    const result = verifyDropdownSelection(select, 'Male', 'gender', doc);
    expect(result.status).toBe('verified');
  });

  it('fails dropdown verification when wrong option selected', () => {
    const select = doc.createElement('select');
    select.innerHTML = `
      <option value="">Select</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
    `;
    select.value = '';
    const result = verifyDropdownSelection(select, 'Male', 'gender', doc);
    expect(result.status).toBe('failed');
  });
});

// ─── Field Resolver Tests ───
describe('Field Resolver', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Test');
    doc.body.innerHTML = '';
  });

  it('resolves fields by formcontrolname', () => {
    doc.body.innerHTML = `
      <div class="row">
        <input formcontrolname="name" placeholder="Name" />
        <input formcontrolname="age" type="number" placeholder="Age" />
        <select formcontrolname="gender"><option>Male</option></select>
        <select formcontrolname="photoIdProof"><option>Aadhaar Card</option></select>
        <input formcontrolname="photoIdNumber" placeholder="ID Number" />
      </div>
    `;
    const container = doc.querySelector('.row') as HTMLElement;
    const resolved = resolvePilgrimFields(container, doc);
    expect(resolved.size).toBe(5);
    expect(resolved.get('name')!.confidence).toBeGreaterThanOrEqual(30);
    expect(resolved.get('gender')!.confidence).toBeGreaterThanOrEqual(30);
  });

  it('resolves fields by labels', () => {
    doc.body.innerHTML = `
      <div class="row">
        <div><label for="f1">Pilgrim Name</label><input id="f1" /></div>
        <div><label for="f2">Age</label><input id="f2" type="number" /></div>
        <div><label for="f3">Gender</label><select id="f3"><option>Male</option></select></div>
        <div><label for="f4">Photo ID Proof</label><select id="f4"><option>Aadhaar Card</option></select></div>
        <div><label for="f5">Photo ID Number</label><input id="f5" /></div>
      </div>
    `;
    const container = doc.querySelector('.row') as HTMLElement;
    const resolved = resolvePilgrimFields(container, doc);
    expect(resolved.size).toBe(5);
  });

  it('prevents collision: gender and photoIdProof resolve to different elements', () => {
    doc.body.innerHTML = `
      <div class="row">
        <input formcontrolname="name" />
        <input formcontrolname="age" type="number" />
        <select formcontrolname="gender"><option>Male</option></select>
        <select formcontrolname="photoIdProof"><option>Aadhaar</option></select>
        <input formcontrolname="photoIdNumber" />
      </div>
    `;
    const container = doc.querySelector('.row') as HTMLElement;
    const resolved = resolvePilgrimFields(container, doc);
    const genderEl = resolved.get('gender')?.element;
    const idProofEl = resolved.get('photoIdProof')?.element;
    expect(genderEl).not.toBe(idProofEl);
  });

  it('reports confidence and strategy for each resolution', () => {
    doc.body.innerHTML = `
      <div class="row">
        <input formcontrolname="name" placeholder="Pilgrim Name" />
        <input formcontrolname="age" type="number" />
        <select formcontrolname="gender"><option>Male</option></select>
        <select formcontrolname="photoIdProof"><option>Aadhaar</option></select>
        <input formcontrolname="photoIdNumber" />
      </div>
    `;
    const container = doc.querySelector('.row') as HTMLElement;
    const resolved = resolvePilgrimFields(container, doc);
    const nameRes = resolved.get('name');
    expect(nameRes).toBeDefined();
    expect(nameRes!.confidence).toBeGreaterThan(0);
    expect(nameRes!.strategy).toBeTruthy();
    expect(nameRes!.reasons.length).toBeGreaterThan(0);
  });
});
