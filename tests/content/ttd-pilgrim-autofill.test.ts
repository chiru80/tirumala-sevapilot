// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setNativeValue,
  findField,
  waitForPilgrimForm,
  setGenderDropdown,
  setPhotoIdProofDropdown,
  autofillPilgrim,
  autofillTTDPilgrimForm,
  detectTTDBookingStep,
  handleTTDAutofill,
  isPilgrimDetailsPage,
  isGeneralDetailsPage,
  autofillGeneralDetails,
} from '../../src/content/ttd-pilgrim-autofill';
import type { Pilgrim } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('TTD Pilgrim Autofill Engine (Angular SPA)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const mockPilgrim: Pilgrim = {
    id: 'p-1',
    fullName: 'Srinivasa Ramanuja',
    firstName: 'Srinivasa',
    lastName: 'Ramanuja',
    gender: Gender.MALE,
    dateOfBirth: '1989-10-25',
    age: 36,
    idType: IdType.AADHAAR,
    idNumber: '9988 7766 5544',
    mobile: '9876543210',
    country: 'India',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('setNativeValue bypasses framework descriptor and dispatches input, change, blur', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const eventsFired: string[] = [];
    ['input', 'change', 'blur'].forEach(evt => {
      input.addEventListener(evt, (e) => eventsFired.push(e.type));
    });

    const success = setNativeValue(input, 'Govinda');
    expect(success).toBe(true);
    expect(input.value).toBe('Govinda');
    expect(eventsFired).toContain('input');
    expect(eventsFired).toContain('change');
    expect(eventsFired).toContain('blur');
  });

  it('findField reliably detects all 5 pilgrim fields without selecting login/otp', () => {
    document.body.innerHTML = `
      <!-- Potential false positives -->
      <div class="header">
        <input type="text" name="username" placeholder="Username / Login" />
        <input type="text" name="bookingId" placeholder="Booking Ref No" />
        <input type="text" name="otpInput" placeholder="Enter OTP" />
      </div>

      <!-- TTD Pilgrim Form (Angular Reactive Form layout) -->
      <div class="card pilgrim-details-section">
        <h3>Pilgrim Details</h3>
        <table class="table">
          <tbody>
            <tr>
              <td>
                <label for="name_0">Name *</label>
                <input id="name_0" type="text" formcontrolname="name" class="mat-input-element" />
              </td>
              <td>
                <label for="age_0">Age *</label>
                <input id="age_0" type="number" formcontrolname="age" class="mat-input-element" />
              </td>
              <td>
                <label for="gender_0">Gender *</label>
                <select id="gender_0" formcontrolname="gender">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </td>
              <td>
                <label for="photoIdProof_0">Photo ID Proof *</label>
                <select id="photoIdProof_0" formcontrolname="photoIdProof">
                  <option value="">Select</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                </select>
              </td>
              <td>
                <label for="photoId_0">Photo Id Number *</label>
                <input id="photoId_0" type="text" formcontrolname="photoIdNumber" class="mat-input-element" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const nameEl = findField({
      labels: ['name', 'full name', 'pilgrim name'],
      type: 'text',
      excludeKeywords: ['user', 'login', 'email', 'booking', 'otp'],
    });
    expect(nameEl?.id).toBe('name_0');

    const ageEl = findField({
      labels: ['age', 'pilgrim age'],
      type: 'number',
    });
    expect(ageEl?.id).toBe('age_0');

    const genderEl = findField({
      labels: ['gender', 'sex'],
      type: 'select',
    });
    expect(genderEl?.id).toBe('gender_0');

    const idTypeEl = findField({
      labels: ['photo id proof', 'photo id type', 'id proof'],
      type: 'select',
      excludeKeywords: ['number', 'no', 'digit'],
    });
    expect(idTypeEl?.id).toBe('photoIdProof_0');

    const idNumEl = findField({
      labels: ['photo id number', 'photo id no', 'id number'],
      type: 'text',
      excludeKeywords: ['otp', 'login', 'booking'],
    });
    expect(idNumEl?.id).toBe('photoId_0');
  });

  it('waitForPilgrimForm resolves as soon as required fields appear', async () => {
    setTimeout(() => {
      document.body.innerHTML = `
        <div class="pilgrim-form">
          <label>Name *</label><input type="text" id="name" />
          <label>Age *</label><input type="number" id="age" />
        </div>
      `;
    }, 150);

    const form = await waitForPilgrimForm(2000, document);
    expect(form).not.toBeNull();
  });

  it('autofillPilgrim successfully fills all 5 fields with 12-digit Aadhaar cleaning', async () => {
    document.body.innerHTML = `
      <div class="row">
        <div><label>Name *</label><input type="text" id="p_name" /></div>
        <div><label>Age *</label><input type="number" id="p_age" /></div>
        <div>
          <label>Gender *</label>
          <select id="p_gender">
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div>
          <label>Photo ID Proof *</label>
          <select id="p_proof">
            <option value="">Select</option>
            <option value="Aadhaar Card">Aadhaar Card</option>
            <option value="Passport">Passport</option>
          </select>
        </div>
        <div><label>Photo Id Number *</label><input type="text" id="p_idnum" /></div>
      </div>
    `;

    const report = await autofillPilgrim(mockPilgrim, 0, document);

    expect(report.nameFilled).toBe(true);
    expect(report.ageFilled).toBe(true);
    expect(report.genderSelected).toBe(true);
    expect(report.photoIdProofSelected).toBe(true);
    expect(report.photoIdNumberFilled).toBe(true);
    expect(report.allSuccess).toBe(true);

    const nameInput = document.getElementById('p_name') as HTMLInputElement;
    const ageInput = document.getElementById('p_age') as HTMLInputElement;
    const genderSelect = document.getElementById('p_gender') as HTMLSelectElement;
    const proofSelect = document.getElementById('p_proof') as HTMLSelectElement;
    const idNumInput = document.getElementById('p_idnum') as HTMLInputElement;

    expect(nameInput.value).toBe('Srinivasa Ramanuja');
    expect(ageInput.value).toBe('36');
    expect(genderSelect.value).toBe('Male');
    expect(proofSelect.value).toBe('Aadhaar Card');
    // Verify 12 digits strictly without spaces
    expect(idNumInput.value).toBe('998877665544');
  });

  it('autofillTTDPilgrimForm populates multi-row pilgrim table', async () => {
    let rowsHtml = '';
    for (let i = 0; i < 2; i++) {
      rowsHtml += `
        <tr>
          <td><label>Name *</label><input type="text" id="name_${i}" name="name_${i}" /></td>
          <td><label>Age *</label><input type="number" id="age_${i}" name="age_${i}" /></td>
          <td>
            <label>Gender *</label>
            <select id="gender_${i}">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </td>
          <td>
            <label>Photo ID Proof *</label>
            <select id="proof_${i}">
              <option value="Aadhaar Card">Aadhaar Card</option>
            </select>
          </td>
          <td><label>Photo Id Number *</label><input type="text" id="idnum_${i}" name="idnum_${i}" /></td>
        </tr>
      `;
    }

    document.body.innerHTML = `<table><tbody>${rowsHtml}</tbody></table>`;

    const pilgrims: Pilgrim[] = [
      mockPilgrim,
      {
        ...mockPilgrim,
        id: 'p-2',
        fullName: 'Lakshmi Devi',
        age: 32,
        gender: Gender.FEMALE,
        idNumber: '112233445566',
      },
    ];

    const result = await autofillTTDPilgrimForm({ pilgrims, doc: document });
    expect(result.success).toBe(true);
    expect(result.filledPilgrims).toBe(2);

    expect((document.getElementById('name_0') as HTMLInputElement).value).toBe('Srinivasa Ramanuja');
    expect((document.getElementById('name_1') as HTMLInputElement).value).toBe('Lakshmi Devi');
    expect((document.getElementById('idnum_1') as HTMLInputElement).value).toBe('112233445566');
  });

  it('detectTTDBookingStep accurately identifies Pilgrim Details vs General Details', () => {
    // Step 1 DOM
    document.body.innerHTML = `
      <div class="card">
        <h3>Pilgrim Details</h3>
        <div><label>Name *</label><input type="text" id="name" /></div>
        <div><label>Age *</label><input type="number" id="age" /></div>
        <div><label>Photo Id Number *</label><input type="text" id="idnum" /></div>
      </div>
    `;
    expect(detectTTDBookingStep(document)).toBe('pilgrim');

    // Step 2 DOM (Angular SPA navigated to General Details)
    document.body.innerHTML = `
      <div class="card">
        <h3>General Details</h3>
        <div><label>Email ID *</label><input type="email" id="email" /></div>
        <div><label>Mobile</label><input type="tel" id="mobile" /></div>
        <div><label>Enter City *</label><input type="text" id="city" /></div>
        <div><label>State *</label><input type="text" id="state" /></div>
        <div><label>Country *</label><input type="text" id="country" /></div>
        <div><label>Enter pincode *</label><input type="text" id="pincode" /></div>
      </div>
    `;
    expect(detectTTDBookingStep(document)).toBe('general');
  });

  it('handleTTDAutofill enforces Step 1 (Pilgrim) -> Step 2 (General) execution order', async () => {
    const testProfile = {
      name: 'Venkateswara Swamy',
      age: 40,
      gender: 'Male',
      photoIdProof: 'Aadhaar Card',
      photoIdNumber: '1234 5678 9012',
      email: 'devotee@tirumala.org',
      mobile: '9876543210',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pincode: '517501',
      pilgrims: [
        {
          id: 'p-1',
          fullName: 'Venkateswara Swamy',
          age: 40,
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '123456789012',
          email: 'devotee@tirumala.org',
          mobile: '9876543210',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
        },
      ],
    };

    // 1. When on Step 1: Pilgrim Details
    document.body.innerHTML = `
      <div class="card">
        <h3>Pilgrim Details</h3>
        <div><label>Name *</label><input type="text" id="name" /></div>
        <div><label>Age *</label><input type="number" id="age" /></div>
        <div>
          <label>Gender *</label>
          <select id="gender"><option value="Male">Male</option></select>
        </div>
        <div>
          <label>Photo ID Proof *</label>
          <select id="proof"><option value="Aadhaar Card">Aadhaar Card</option></select>
        </div>
        <div><label>Photo Id Number *</label><input type="text" id="idnum" /></div>
      </div>
    `;

    const step1Result = await handleTTDAutofill({ profile: testProfile, doc: document });
    expect(step1Result.step).toBe('pilgrim');
    expect(step1Result.success).toBe(true);
    expect(step1Result.statusText).toBe('✓ Pilgrim details filled');
    expect((document.getElementById('name') as HTMLInputElement).value).toBe('Venkateswara Swamy');
    expect((document.getElementById('idnum') as HTMLInputElement).value).toBe('123456789012');

    // 2. User reviews and navigates to Step 2: General Details (SPA DOM replacement)
    document.body.innerHTML = `
      <div class="card">
        <h3>General Details</h3>
        <div><label>Email ID *</label><input type="email" id="email" /></div>
        <div><label>Mobile</label><input type="tel" id="mobile" /></div>
        <div><label>Enter City *</label><input type="text" id="city" /></div>
        <div><label>State *</label><input type="text" id="state" /></div>
        <div><label>Country *</label><input type="text" id="country" /></div>
        <div><label>Enter pincode *</label><input type="text" id="pincode" /></div>
      </div>
    `;

    const step2Result = await handleTTDAutofill({ profile: testProfile, doc: document });
    expect(step2Result.step).toBe('general');
    expect(step2Result.success).toBe(true);
    expect(step2Result.statusText).toBe('✓ General details filled');

    expect((document.getElementById('email') as HTMLInputElement).value).toBe('devotee@tirumala.org');
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('9876543210');
    expect((document.getElementById('city') as HTMLInputElement).value).toBe('Tirupati');
    expect((document.getElementById('state') as HTMLInputElement).value).toBe('Andhra Pradesh');
    expect((document.getElementById('country') as HTMLInputElement).value).toBe('India');
    expect((document.getElementById('pincode') as HTMLInputElement).value).toBe('517501');
  });

  it('strictly selects Male and never matches Female when Female is listed first in dropdown', async () => {
    // Test 1: Native <select> where Female is option 0 and Male is option 1
    document.body.innerHTML = `
      <select id="gender_select">
        <option value="">Select Gender</option>
        <option value="Female">Female</option>
        <option value="Male">Male</option>
        <option value="Other">Other</option>
      </select>
    `;
    const sel = document.getElementById('gender_select') as HTMLSelectElement;
    const ok = await setGenderDropdown(sel, 'Male', document);
    expect(ok).toBe(true);
    expect(sel.value).toBe('Male');

    // Test 2: Angular Material / CDK Overlay where Female option appears before Male
    document.body.innerHTML = `
      <mat-select id="gender_mat" role="combobox">
        <div class="mat-select-trigger"></div>
      </mat-select>
      <div class="cdk-overlay-container">
        <mat-option id="opt_female" value="Female"><span>Female</span></mat-option>
        <mat-option id="opt_male" value="Male"><span>Male</span></mat-option>
      </div>
    `;
    const matSel = document.getElementById('gender_mat') as HTMLElement;
    const maleOpt = document.getElementById('opt_male') as HTMLElement;
    let clickedId = '';
    maleOpt.addEventListener('click', () => { clickedId = 'opt_male'; });
    const femaleOpt = document.getElementById('opt_female') as HTMLElement;
    femaleOpt.addEventListener('click', () => { clickedId = 'opt_female'; });

    const matOk = await setGenderDropdown(matSel, 'Male', document);
    expect(matOk).toBe(true);
    expect(clickedId).toBe('opt_male');
  });

  it('autofills General Details using profile.general settings (e.g. Papanaidupeta)', async () => {
    const profileWithGeneral = {
      id: 'prof-gen',
      name: 'Family',
      general: {
        email: 'patnammam2902@gmail.com',
        city: 'Papanaidupeta',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517526',
      },
      pilgrims: [
        {
          id: 'p-1',
          fullName: 'Test Devotee',
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '123456789012',
          mobile: '9876543210',
        },
      ],
    };

    document.body.innerHTML = `
      <div>
        <h3>General Details</h3>
        <input type="email" id="email" />
        <label>Enter City *</label>
        <input type="text" id="city" />
        <label>State *</label>
        <input type="text" id="state" />
        <label>Country *</label>
        <input type="text" id="country" />
        <label>Enter pincode *</label>
        <input type="text" id="pincode" />
      </div>
    `;

    const report = await autofillGeneralDetails({ profile: profileWithGeneral as any, doc: document });
    expect(report.allSuccess).toBe(true);
    expect(report.emailFilled).toBe(true);
    expect(report.cityFilled).toBe(true);
    expect(report.pincodeFilled).toBe(true);
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('patnammam2902@gmail.com');
    expect((document.getElementById('city') as HTMLInputElement).value).toBe('Papanaidupeta');
    expect((document.getElementById('pincode') as HTMLInputElement).value).toBe('517526');
  });

  it('6-PILGRIM TEST: accurately autofills, maps, and validates 6 distinct pilgrims across 30 fields with zero collisions', async () => {
    // 6 distinct test profiles
    const sixPilgrims: Pilgrim[] = [
      { id: 'p-1', fullName: 'Pilgrim One', age: 31, gender: Gender.MALE, idType: IdType.AADHAAR, idNumber: '111122223333', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'One', mobile: '9000000001', dateOfBirth: '1993-01-01' },
      { id: 'p-2', fullName: 'Pilgrim Two', age: 28, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '222233334444', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'Two', mobile: '9000000002', dateOfBirth: '1996-02-02' },
      { id: 'p-3', fullName: 'Pilgrim Three', age: 55, gender: Gender.MALE, idType: IdType.PASSPORT, idNumber: 'A1234567', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'Three', mobile: '9000000003', dateOfBirth: '1969-03-03' },
      { id: 'p-4', fullName: 'Pilgrim Four', age: 48, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '444455556666', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'Four', mobile: '9000000004', dateOfBirth: '1976-04-04' },
      { id: 'p-5', fullName: 'Pilgrim Five', age: 22, gender: Gender.MALE, idType: IdType.VOTER_ID, idNumber: 'VOT9876543', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'Five', mobile: '9000000005', dateOfBirth: '2002-05-05' },
      { id: 'p-6', fullName: 'Pilgrim Six', age: 19, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '666677778888', country: 'India', createdAt: '', updatedAt: '', firstName: 'Pilgrim', lastName: 'Six', mobile: '9000000006', dateOfBirth: '2005-06-06' },
    ];

    // Build 6 repeated TTD devotee rows
    let tableHtml = '<div class="card"><h3>Special Entry Darshan Pilgrims</h3><table class="table"><tbody>';
    for (let i = 0; i < 6; i++) {
      tableHtml += `
        <tr class="devotee-row" id="row_${i}">
          <td><label for="name_${i}">Name *</label><input id="name_${i}" type="text" formcontrolname="name" /></td>
          <td><label for="age_${i}">Age *</label><input id="age_${i}" type="number" formcontrolname="age" /></td>
          <td>
            <label for="gender_${i}">Gender *</label>
            <select id="gender_${i}" formcontrolname="gender">
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </td>
          <td>
            <label for="idProof_${i}">Photo ID Proof *</label>
            <select id="idProof_${i}" formcontrolname="photoIdProof">
              <option value="">Select</option>
              <option value="Aadhaar Card">Aadhaar Card</option>
              <option value="Passport">Passport</option>
              <option value="Voter ID">Voter ID</option>
            </select>
          </td>
          <td>
            <label for="idNumber_${i}">Photo ID Number *</label>
            <input id="idNumber_${i}" type="text" formcontrolname="photoIdNumber" />
          </td>
        </tr>
      `;
    }
    tableHtml += '</tbody></table></div>';
    document.body.innerHTML = tableHtml;

    const report = await autofillTTDPilgrimForm({ pilgrims: sixPilgrims, doc: document });

    expect(report.success).toBe(true);
    expect(report.totalPilgrims).toBe(6);
    expect(report.filledPilgrims).toBe(6);
    expect(report.pilgrimReports).toBeDefined();
    expect(report.pilgrimReports.length).toBe(6);

    // Verify all 6 rows received their own isolated data with zero collision
    for (let i = 0; i < 6; i++) {
      const p = sixPilgrims[i];
      const pReport = report.pilgrimReports[i];
      expect(pReport.allValidated).toBe(true);
      expect(pReport.pilgrimIndex).toBe(i);
      expect(pReport.pilgrimName).toBe(p.fullName);

      // Check DOM values directly
      const nameEl = document.getElementById(`name_${i}`) as HTMLInputElement;
      const ageEl = document.getElementById(`age_${i}`) as HTMLInputElement;
      const genderEl = document.getElementById(`gender_${i}`) as HTMLSelectElement;
      const idProofEl = document.getElementById(`idProof_${i}`) as HTMLSelectElement;
      const idNumberEl = document.getElementById(`idNumber_${i}`) as HTMLInputElement;

      expect(nameEl.value).toBe(p.fullName);
      expect(ageEl.value).toBe(String(p.age));
      expect(genderEl.value).toBe(p.gender);
      expect(idProofEl.value).toContain(p.idType === IdType.AADHAAR ? 'Aadhaar' : p.idType);
      expect(idNumberEl.value).toBe(p.idNumber);

      // Check sensitive data masking in report
      expect(pReport.fields.photoIdNumber.maskedValue).toContain('••••');
      expect(pReport.fields.photoIdNumber.maskedValue).not.toBe(p.idNumber);
    }
  });

  it('8+ PILGRIMS: N-pilgrim generality test handles 8 rows without hardcoded limits', async () => {
    const eightPilgrims: Pilgrim[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `devotee-${idx}`,
      fullName: `Devotee ${idx + 1}`,
      age: 20 + idx * 5,
      gender: idx % 2 === 0 ? Gender.MALE : Gender.FEMALE,
      idType: IdType.AADHAAR,
      idNumber: `10002000300${idx}`,
      country: 'India',
      createdAt: '',
      updatedAt: '',
      firstName: 'Devotee',
      lastName: String(idx + 1),
      mobile: `900000000${idx}`,
      dateOfBirth: '1990-01-01',
    }));

    let html = '<div class="pilgrim-card-container">';
    for (let i = 0; i < 8; i++) {
      html += `
        <div class="pilgrim-card" id="card_${i}">
          <label>Pilgrim Name</label>
          <input type="text" name="pilgrimName" />
          <label>Age</label>
          <input type="number" name="pilgrimAge" />
          <label>Gender</label>
          <select name="pilgrimGender">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <label>Photo ID Proof</label>
          <select name="idProof">
            <option value="Aadhaar Card">Aadhaar Card</option>
          </select>
          <label>Photo ID Number</label>
          <input type="text" name="idNumber" />
        </div>
      `;
    }
    html += '</div>';
    document.body.innerHTML = html;

    const report = await autofillTTDPilgrimForm({ pilgrims: eightPilgrims, doc: document });
    expect(report.success).toBe(true);
    expect(report.totalPilgrims).toBe(8);
    expect(report.filledPilgrims).toBe(8);
    expect(report.pilgrimReports.length).toBe(8);
    expect(report.pilgrimReports.every(r => r.allValidated)).toBe(true);
  });
});
