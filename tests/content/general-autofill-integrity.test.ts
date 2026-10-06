// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { executeAutofill, REQUIRED_GENERAL_FIELDS } from '../../src/content/autofill/autofill-manager';
import type { Profile } from '../../src/shared/types';

describe('P0 — General Autofill Success Integrity', () => {
  const createMockGeneralForm = () => {
    document.body.innerHTML = `
      <div id="generalForm">
        <label>Mobile Number</label>
        <input id="mobile" name="mobile" type="tel" />

        <label>Email Address</label>
        <input id="email" name="email" type="email" />

        <label>City</label>
        <input id="city" name="city" type="text" />

        <label>State</label>
        <select id="state" name="state">
          <option value="">Select State</option>
          <option value="Andhra Pradesh">Andhra Pradesh</option>
          <option value="Telangana">Telangana</option>
        </select>

        <label>Country</label>
        <select id="country" name="country">
          <option value="">Select Country</option>
          <option value="India">India</option>
        </select>

        <label>PIN Code</label>
        <input id="pinCode" name="pinCode" type="text" />
      </div>
    `;
  };

  it('declares canonical REQUIRED_GENERAL_FIELDS', () => {
    expect(REQUIRED_GENERAL_FIELDS).toEqual([
      'mobile',
      'city',
      'state',
      'country',
      'pinCode',
    ]);
  });

  // Scenario 1: mobile only
  it('1. fails when only mobile is provided in profile general details', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-1',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        city: '',
        state: '',
        country: '',
        pinCode: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Verified mobile alone must NOT equal overall success
    const mobileRes = result.generalResults.find(r => r.field === 'mobile');
    expect(mobileRes?.status).toBe('verified');
  });

  // Scenario 2: mobile + city
  it('2. fails when mobile + city are provided but state, country, pin are missing', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-2',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        city: 'Tirupati',
        state: '',
        country: '',
        pinCode: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(false);
  });

  // Scenario 3: all except PIN
  it('3. fails when all required fields except PIN are provided', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-3',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '', // missing
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(false);
    const pinRes = result.generalResults.find(r => r.field === 'pinCode');
    expect(pinRes?.status).toBe('skipped');
  });

  // Scenario 4: all required fields (without email)
  it('4. succeeds when all required fields are verified (mobile, city, state, country, pinCode)', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-4',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(true);
    expect(result.totalFailed).toBe(0);
  });

  // Scenario 5: all required + email
  it('5. succeeds when all required fields AND optional email are verified', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-5',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        email: 'devotee@example.com',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(true);
    const emailRes = result.generalResults.find(r => r.field === 'email');
    expect(emailRes?.status).toBe('verified');
  });

  // Scenario 6: missing optional email
  it('6. succeeds when optional email is missing but all 5 required fields are verified', async () => {
    createMockGeneralForm();
    const profile: Profile = {
      id: 'prof-6',
      name: 'Family',
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: true,
      general: {
        mobile: '9876543210',
        email: '', // empty optional email
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await executeAutofill({
      profile,
      doc: document,
    });

    expect(result.step).toBe('general');
    expect(result.success).toBe(true);
    const emailRes = result.generalResults.find(r => r.field === 'email');
    expect(emailRes?.status).toBe('skipped'); // Skipped optional email does not break success
  });
});
