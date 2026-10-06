// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { detectAndLockPilgrimRows } from '../../src/content/autofill/row-detector';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('P0 — Fail-Closed Row Detection', () => {
  const samplePilgrim: Pilgrim = {
    id: 'p-1',
    firstName: 'Venkat',
    lastName: 'Raman',
    fullName: 'Venkat Raman',
    gender: Gender.MALE,
    age: 35,
    idType: IdType.AADHAAR,
    idNumber: '123456789012',
    country: 'India',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleProfile: Profile = {
    id: 'prof-1',
    name: 'Sample Profile',
    pilgrims: [samplePilgrim],
    selectedPilgrims: {},
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('1. returns empty array and does NOT use document.body or form as fallback when DOM is ambiguous', () => {
    // Ambiguous DOM: random search / newsletter form without pilgrim attributes
    document.body.innerHTML = `
      <form id="ambiguousForm">
        <label>Newsletter Subscription</label>
        <input type="text" id="subscriberName" placeholder="Enter your name" />
        <button type="submit">Subscribe</button>
      </form>
    `;

    const rows = detectAndLockPilgrimRows(document, 1);
    expect(rows).toEqual([]);
    expect(rows.length).toBe(0);
  });

  it('2. executeAutofill safely aborts with "Pilgrim fields could not be safely identified." on ambiguous DOM', async () => {
    document.body.innerHTML = `
      <form class="irrelevant-form">
        <div class="form-group">
          <label>Search Website</label>
          <input type="text" name="q" id="searchBox" placeholder="Search..." />
        </div>
      </form>
    `;

    const result = await executeAutofill({
      pilgrims: [samplePilgrim],
      profile: sampleProfile,
      doc: document,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Pilgrim fields could not be safely identified.');
    expect(result.totalVerified).toBe(0);
    expect(result.totalFailed).toBe(0);
    // Ensure no inputs were tampered with
    const searchBox = document.getElementById('searchBox') as HTMLInputElement;
    expect(searchBox.value).toBe('');
  });

  it('3. rejects multi-name ambiguous containers and does NOT autofill', async () => {
    // A single container containing 4 name inputs without age/gender/id structure
    document.body.innerHTML = `
      <div class="user-list">
        <input type="text" name="contact1_name" value="" />
        <input type="text" name="contact2_name" value="" />
        <input type="text" name="contact3_name" value="" />
      </div>
    `;

    const rows = detectAndLockPilgrimRows(document, 1);
    expect(rows.length).toBe(0);

    const result = await executeAutofill({
      pilgrims: [samplePilgrim],
      profile: sampleProfile,
      doc: document,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Pilgrim fields could not be safely identified.');
  });
});
