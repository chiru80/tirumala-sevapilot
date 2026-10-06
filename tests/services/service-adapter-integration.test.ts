// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import { getAdapterForService, getAdapterForUrl } from '../../src/services/registry';
import { ServiceType, Gender, IdType } from '../../src/shared/types';
import type { Pilgrim, Profile } from '../../src/shared/types';

describe('P1 — Service Adapter Integration', () => {
  const buildPilgrims = (count: number): Pilgrim[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `p-${i + 1}`,
      firstName: 'Devotee',
      lastName: `${i + 1}`,
      fullName: `Devotee ${i + 1}`,
      gender: Gender.MALE,
      age: 30 + i,
      idType: IdType.AADHAAR,
      idNumber: `12345678901${i}`,
      country: 'India',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  };

  const createMockPilgrimRowsDom = (count: number) => {
    document.body.innerHTML = `
      <div class="booking-container">
        <h2>Pilgrim Details</h2>
        ${Array.from({ length: count }, (_, i) => `
          <div class="card devotee-card" id="card-${i}">
            <label>Devotee ${i + 1} Name</label>
            <input type="text" name="name_${i}" value="" />
            <label>Age</label>
            <input type="number" name="age_${i}" value="" />
            <label>Gender</label>
            <select name="gender_${i}">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <label>Photo ID Proof</label>
            <select name="idProof_${i}">
              <option value="Aadhaar Card">Aadhaar Card</option>
            </select>
            <label>Photo ID Number</label>
            <input type="text" name="idNumber_${i}" value="" />
          </div>
        `).join('')}
      </div>
    `;
  };

  it('1. Arjitha Seva enforces max 2 pilgrims', () => {
    const adapter = getAdapterForService(ServiceType.ARJITHA_SEVA);
    expect(adapter).toBeDefined();
    expect(adapter?.maxPilgrims).toBe(2);
    expect(adapter?.requiredFields).not.toContain('mobile'); // Mobile is optional for Pilgrim
    expect(adapter?.optionalFields).toContain('mobile');
  });

  it('2. Accommodation enforces max 4 pilgrims', () => {
    const adapter = getAdapterForService(ServiceType.ACCOMMODATION);
    expect(adapter).toBeDefined();
    expect(adapter?.maxPilgrims).toBe(4);
    expect(adapter?.requiredFields).not.toContain('mobile');
    expect(adapter?.optionalFields).toContain('mobile');
  });

  it('3. Special Entry Darshan maintains max 6 pilgrims', () => {
    const adapter = getAdapterForService(ServiceType.DARSHAN);
    expect(adapter).toBeDefined();
    expect(adapter?.maxPilgrims).toBe(6);
    expect(adapter?.requiredFields).toEqual(['fullName', 'gender', 'age', 'idType', 'idNumber']);
  });

  it('4. SRIVANI Trust Darshan allows up to 9 pilgrims', () => {
    const adapter = getAdapterForService(ServiceType.SRIVANI);
    expect(adapter).toBeDefined();
    expect(adapter?.maxPilgrims).toBe(9);
  });

  it('5. executeAutofill limits Arjitha Seva autofill to exactly 2 pilgrims even when 5 pilgrims are provided', async () => {
    createMockPilgrimRowsDom(5);
    const pilgrims = buildPilgrims(5);
    const profile: Profile = {
      id: 'prof-arjitha',
      name: 'Arjitha Group',
      pilgrims,
      selectedPilgrims: {},
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      pilgrims,
      profile,
      doc: document,
      serviceType: ServiceType.ARJITHA_SEVA,
    });

    expect(result.step).toBe('pilgrim');
    // Result should only process max 2 pilgrims for Arjitha Seva
    expect(result.pilgrimResults.length).toBe(2);
    expect(result.totalVerified).toBe(10); // 2 pilgrims * 5 fields = 10
  });

  it('6. executeAutofill with DOB calculates effective age into Age field', async () => {
    createMockPilgrimRowsDom(1);
    // Pilgrim has NO stored age, only dateOfBirth
    const pilgrims: Pilgrim[] = [{
      id: 'p-dob-only',
      firstName: 'Ananth',
      lastName: 'Padmanabh',
      fullName: 'Ananth Padmanabh',
      gender: Gender.MALE,
      dateOfBirth: '1990-01-01',
      idType: IdType.AADHAAR,
      idNumber: '123456789012',
      country: 'India',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];

    const profile: Profile = {
      id: 'prof-dob',
      name: 'DOB Only Group',
      pilgrims,
      selectedPilgrims: {},
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      pilgrims,
      profile,
      doc: document,
      serviceType: ServiceType.DARSHAN,
    });

    expect(result.step).toBe('pilgrim');
    expect(result.success).toBe(true);
    const ageInput = document.querySelector('input[name="age_0"]') as HTMLInputElement;
    expect(parseInt(ageInput.value, 10)).toBeGreaterThan(30);
  });
});
