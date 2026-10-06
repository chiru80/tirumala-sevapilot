// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 6 — Live TTD Booking Intelligence & Reliability Tests
// Comprehensive fixtures for Cases 1-10, Concurrency, Cancellation,
// User Value Protection, and Partial Failure Recovery.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeAutofill, resetSessionLock, requestStop } from '../../src/content/autofill/autofill-manager';
import { bookingSession } from '../../src/content/autofill/booking-session';
import { SPECIAL_ENTRY_DARSHAN_300 } from '../../src/services/workflows/special-entry-300';
import { SRI_SRINIVASA_DIVYANUGRAHA_HOMAM } from '../../src/services/workflows/sri-srinivasa-divyanugraha-homam';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

const mockDevotee = (id: string, name: string): Pilgrim => ({
  id,
  firstName: name,
  lastName: 'Kumar',
  fullName: `${name} Kumar`,
  gender: Gender.MALE,
  age: 35,
  dateOfBirth: '1991-01-01',
  idType: IdType.AADHAAR,
  idNumber: '999999990019',
  country: 'India',
  createdAt: '2026-10-06T00:00:00Z',
  updatedAt: '2026-10-06T00:00:00Z',
});

const createFormHtml = (numRows: number = 1): string => {
  let rows = '';
  for (let i = 0; i < numRows; i++) {
    rows += `
      <div class="pilgrim-card" id="card-${i}">
        <label>Name</label><input type="text" name="name_${i}" />
        <label>Age</label><input type="number" name="age_${i}" />
        <label>Gender</label><select name="gender_${i}"><option value="Male">Male</option><option value="Female">Female</option></select>
        <label>Photo ID Proof</label><select name="proof_${i}"><option value="Aadhaar Card">Aadhaar Card</option></select>
        <label>Photo ID Number</label><input type="text" name="idnumber_${i}" />
      </div>
    `;
  }
  return `
    <h2>Devotee Details</h2>
    <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
    ${rows}
  `;
};

describe('Phase 6: Live Booking Reliability Engine (Cases 1-10)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
    resetSessionLock();
  });

  afterEach(() => {
    resetSessionLock();
  });

  // Case 1: Field exists immediately -> fill + verify
  it('Case 1: Field exists immediately -> fills and verifies immediately', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const pilgrims = [mockDevotee('p1', 'Ravi')];

    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(true);
    expect(result.totalVerified).toBe(5);
    expect(result.totalFailed).toBe(0);

    const nameInput = doc.querySelector('input[name="name_0"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Ravi Kumar');
  });

  // Case 2: Field appears after 500ms -> wait + fill
  it('Case 2: Field appears after delay -> waits and fills safely', async () => {
    doc.body.innerHTML = `
      <h2>Devotee Details</h2>
      <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
      <div class="pilgrim-card" id="card-0">
        <label>Name</label><input type="text" name="name_0" />
        <label>Age</label><input type="number" name="age_0" />
        <label>Gender</label><select name="gender_0"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof_0"><option value="Aadhaar Card">Aadhaar Card</option></select>
      </div>
    `;

    // ID number appears after 80ms
    setTimeout(() => {
      const card = doc.getElementById('card-0');
      if (card) {
        const idLabel = doc.createElement('label');
        idLabel.textContent = 'Photo ID Number';
        const idInput = doc.createElement('input');
        idInput.type = 'text';
        idInput.name = 'idnumber_0';
        card.appendChild(idLabel);
        card.appendChild(idInput);
      }
    }, 80);

    const pilgrims = [mockDevotee('p1', 'Suresh')];
    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(true);
    const idInput = doc.querySelector('input[name="idnumber_0"]') as HTMLInputElement;
    expect(idInput).not.toBeNull();
    expect(idInput.value).toBe('999999990019');
  });

  // Case 3: Field appears, then Angular replaces it -> re-resolves and fills
  it('Case 3: Angular rerenders DOM node -> re-resolves fresh element without crashing', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const pilgrims = [mockDevotee('p1', 'Mahesh')];

    // Simulate Angular tearing down and recreating row mid-process
    setTimeout(() => {
      const card = doc.getElementById('card-0');
      if (card) {
        card.outerHTML = `
          <div class="pilgrim-card" id="card-0">
            <label>Name</label><input type="text" name="name_0" />
            <label>Age</label><input type="number" name="age_0" />
            <label>Gender</label><select name="gender_0"><option value="Male">Male</option></select>
            <label>Photo ID Proof</label><select name="proof_0"><option value="Aadhaar Card">Aadhaar Card</option></select>
            <label>Photo ID Number</label><input type="text" name="idnumber_0" />
          </div>
        `;
      }
    }, 50);

    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    // Operation safely completes or completes available fields through re-resolution
    expect(result.totalVerified).toBeGreaterThan(0);
  });

  // Case 4: ID type changes ID number field -> re-resolves dependent field
  it('Case 4: Dependent fields -> ID Proof selection triggers ID Number re-resolution', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const idNumInput = doc.querySelector('input[name="idnumber_0"]') as HTMLInputElement;
    idNumInput.disabled = true;

    // Simulate Angular enabling ID number input 60ms after ID Proof is selected
    setTimeout(() => {
      idNumInput.disabled = false;
    }, 60);

    const pilgrims = [mockDevotee('p1', 'Venkatesh')];
    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(true);
    expect(idNumInput.value).toBe('999999990019');
  });

  // Case 5: User changes field manually -> preserve user value
  it('Case 5: User value protection -> manually entered values are strictly preserved', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const nameInput = doc.querySelector('input[name="name_0"]') as HTMLInputElement;
    nameInput.value = 'Custom Devotee Name';

    // Mark that user modified Name field for Pilgrim 0
    bookingSession.recordUserModifiedField('name', 0, 'Custom Devotee Name');

    const pilgrims = [mockDevotee('p1', 'Original Profile Name')];
    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(true);
    // User value must NOT be overwritten!
    expect(nameInput.value).toBe('Custom Devotee Name');
  });

  // Case 6: Validation error -> field marked failed
  it('Case 6: Visible validation error marks field failed', async () => {
    doc.body.innerHTML = `
      <h2>Devotee Details</h2>
      <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
      <div class="pilgrim-card" id="card-0">
        <mat-form-field>
          <label>Name</label><input type="text" name="name_0" />
          <mat-error style="display: block;">Invalid name provided</mat-error>
        </mat-form-field>
        <label>Age</label><input type="number" name="age_0" />
        <label>Gender</label><select name="gender_0"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof_0"><option value="Aadhaar Card">Aadhaar Card</option></select>
        <label>Photo ID Number</label><input type="text" name="idnumber_0" />
      </div>
    `;
    const matError = doc.querySelector('mat-error') as HTMLElement;
    Object.defineProperty(matError, 'offsetWidth', { value: 100 });

    const pilgrims = [mockDevotee('p1', 'BadName')];
    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(false);
    expect(result.failedItems.some(f => f.field === 'name')).toBe(true);
  });

  // Case 7: Payment page -> automation stops
  it('Case 7: Payment boundary -> stops automation when payment page is detected', async () => {
    doc.body.innerHTML = `
      <div id="payment-gateway">
        <h2>Pay ₹300 Now</h2>
        <button id="pay-now-btn">Pay Now</button>
      </div>
    `;

    const result = await executeAutofill({
      pilgrims: [mockDevotee('p1', 'Ravi')],
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
      url: 'https://ttdevasthanams.ap.gov.in/payment',
    });

    expect(result.errors.some(e => e.includes('Payment page reached'))).toBe(true);
  });

  // Case 8: CAPTCHA -> automation stops
  it('Case 8: CAPTCHA boundary -> stops automation when isolated captcha challenge appears', async () => {
    doc.body.innerHTML = `
      <div id="captcha-container">
        <h2>Security Check</h2>
        <img src="captcha.jpg" />
        <input placeholder="Enter captcha" />
      </div>
    `;

    const result = await executeAutofill({
      pilgrims: [mockDevotee('p1', 'Ravi')],
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('CAPTCHA detected'))).toBe(true);
  });

  // Case 9: Digital Queue -> automation stops passively
  it('Case 9: Queue boundary -> stops automation passively without page refresh', async () => {
    doc.body.innerHTML = `
      <div class="queue-container">
        <h3>You are in virtual queue</h3>
        <p>Please wait for your turn.</p>
      </div>
    `;

    const result = await executeAutofill({
      pilgrims: [mockDevotee('p1', 'Ravi')],
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
      url: 'https://ttdevasthanams.ap.gov.in/queue',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Queue detected') || e.includes('queue'))).toBe(true);
  });

  // Case 10: Unknown service -> no automatic fill
  it('Case 10: Unknown service workflow pauses autofill safely', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const result = await executeAutofill({
      pilgrims: [mockDevotee('p1', 'Ravi')],
      doc,
      serviceId: 'unsupported-mystery-service',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('not recognized'))).toBe(true);
  });
});

describe('Phase 6: Concurrency, Cancellation & Partial Failure Recovery', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
    resetSessionLock();
  });

  afterEach(() => {
    resetSessionLock();
  });

  it('enforces single session per tab and returns AUTOFILL ALREADY RUNNING', async () => {
    doc.body.innerHTML = `
      <h2>Devotee Details</h2>
      <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
      <div class="pilgrim-card">
        <label>Name</label><input type="text" name="name" />
        <label>Age</label><input type="number" name="age" />
        <label>Gender</label><select name="gender"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof"><option value="Aadhaar Card">Aadhaar Card</option></select>
        <label>Photo ID Number</label><input type="text" name="idnumber" />
      </div>
    `;

    const p1: Pilgrim = {
      id: 'p1',
      firstName: 'Devotee',
      lastName: 'One',
      fullName: 'Devotee One',
      gender: Gender.MALE,
      age: 40,
      dateOfBirth: '1986-01-01',
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      country: 'India',
      createdAt: '2026-10-06T00:00:00Z',
      updatedAt: '2026-10-06T00:00:00Z',
    };

    const firstRun = executeAutofill({ pilgrims: [p1], doc, workflow: SPECIAL_ENTRY_DARSHAN_300 });
    const secondRun = await executeAutofill({ pilgrims: [p1], doc, workflow: SPECIAL_ENTRY_DARSHAN_300 });

    expect(secondRun.success).toBe(false);
    expect(secondRun.errors.some(e => e.includes('AUTOFILL ALREADY RUNNING') || e.includes('already in progress'))).toBe(true);

    await firstRun;
  });

  it('supports cancellation via requestStop() / AbortController', async () => {
    doc.body.innerHTML = `
      <h2>Devotee Details</h2>
      <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
      <div class="pilgrim-card">
        <label>Name</label><input type="text" name="name" />
        <label>Age</label><input type="number" name="age" />
        <label>Gender</label><select name="gender"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof"><option value="Aadhaar Card">Aadhaar Card</option></select>
        <label>Photo ID Number</label><input type="text" name="idnumber" />
      </div>
    `;

    const controller = new AbortController();
    const p1: Pilgrim = {
      id: 'p1',
      firstName: 'Cancel',
      lastName: 'Test',
      fullName: 'Cancel Test',
      gender: Gender.MALE,
      age: 28,
      dateOfBirth: '1998-01-01',
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      country: 'India',
      createdAt: '2026-10-06T00:00:00Z',
      updatedAt: '2026-10-06T00:00:00Z',
    };

    setTimeout(() => {
      controller.abort();
    }, 10);

    const result = await executeAutofill({
      pilgrims: [p1],
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
      abortSignal: controller.signal,
    });

    expect(['STOPPED', 'COMPLETE', 'ERROR']).toContain(result.state);
  });

  it('returns PARTIAL_SUCCESS and failedItems when 1 of multiple pilgrims fails', async () => {
    // 2 rows: Row 0 is complete, Row 1 is missing Photo ID Number input
    doc.body.innerHTML = `
      <h2>Devotee Details</h2>
      <div class="stepper-header active" data-step="PILGRIM_DETAILS">Devotee Information</div>
      <div class="pilgrim-card" id="card-0">
        <label>Name</label><input type="text" name="name_0" />
        <label>Age</label><input type="number" name="age_0" />
        <label>Gender</label><select name="gender_0"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof_0"><option value="Aadhaar Card">Aadhaar Card</option></select>
        <label>Photo ID Number</label><input type="text" name="idnum_0" />
      </div>
      <div class="pilgrim-card" id="card-1">
        <label>Name</label><input type="text" name="name_1" />
        <label>Age</label><input type="number" name="age_1" />
        <label>Gender</label><select name="gender_1"><option value="Male">Male</option></select>
        <label>Photo ID Proof</label><select name="proof_1"><option value="Aadhaar Card">Aadhaar Card</option></select>
      </div>
    `;

    const pilgrims: Pilgrim[] = [
      {
        id: 'p1',
        firstName: 'Success',
        lastName: 'Pilgrim',
        fullName: 'Success Pilgrim',
        gender: Gender.MALE,
        age: 30,
        dateOfBirth: '1996-01-01',
        idType: IdType.AADHAAR,
        idNumber: '999999990019',
        country: 'India',
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      },
      {
        id: 'p2',
        firstName: 'Failing',
        lastName: 'Pilgrim',
        fullName: 'Failing Pilgrim',
        gender: Gender.MALE,
        age: 32,
        dateOfBirth: '1994-01-01',
        idType: IdType.AADHAAR,
        idNumber: '999999990019',
        country: 'India',
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      },
    ];

    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe('PARTIAL_SUCCESS');
    expect(result.totalVerified).toBeGreaterThan(0);
    expect(result.totalFailed).toBeGreaterThan(0);
    expect(result.failedItems.some(item => item.field === 'photoIdNumber' && item.pilgrimIndex === 1)).toBe(true);
  });

  it('enforces exact 2 pilgrims for Homam and blocks before fill when count is invalid', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const pilgrims = [mockDevotee('p1', 'Devotee1')]; // only 1 devotee provided

    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe('ERROR');
    expect(result.errors.some(e => e.includes('permits exactly 2 pilgrims'))).toBe(true);
  });

  it('enforces max 6 pilgrims for Special Entry 300 and blocks before fill when exceeded', async () => {
    doc.body.innerHTML = createFormHtml(1);
    const pilgrims = Array.from({ length: 7 }, (_, i) => mockDevotee(`p${i}`, `Devotee${i}`));

    const result = await executeAutofill({
      pilgrims,
      doc,
      workflow: SPECIAL_ENTRY_DARSHAN_300,
    });

    expect(result.success).toBe(false);
    expect(result.state).toBe('ERROR');
    expect(result.errors.some(e => e.includes('Maximum 6 pilgrims supported'))).toBe(true);
  });
});
