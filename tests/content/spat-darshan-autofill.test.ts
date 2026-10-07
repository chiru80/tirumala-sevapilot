// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import { detectActiveBookingStep } from '../../src/content/autofill/page-workflow';
import { detectAndLockPilgrimRows } from '../../src/content/autofill/row-detector';
import { scanForm } from '../../src/content/form-scanner';
import { FieldMappingEngine } from '../../src/content/field-mapping-engine';
import { Gender, IdType, type Pilgrim, type Profile } from '../../src/shared/types';

describe('Special Entry Darshan (Sri PAT - ₹200) Live Layout Autofill Verification', () => {
  let doc: Document;

  const samplePilgrim: Pilgrim = {
    id: 'p-1',
    firstName: 'Anusuri',
    lastName: 'Chirudeep',
    fullName: 'Anusuri Chirudeep',
    gender: Gender.MALE,
    age: 28,
    idType: IdType.AADHAAR,
    idNumber: '987654321098',
    country: 'India',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleProfile: Profile = {
    id: 'prof-family',
    name: 'Family',
    pilgrims: [samplePilgrim],
    selectedPilgrims: {},
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const liveSpatUrl = 'https://ttdevasthanams.ap.gov.in/spat/pilgrim_details?flow=spat&flowIdentifier=spat&section=slot booking';

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Tirumala Tirupati Devasthanams');
    doc.body.innerHTML = `
      <div class="main-container">
        <h1>Special Entry Darshan (Sri PAT)</h1>

        <!-- Darshan Details Card -->
        <div class="card darshan-details">
          <div class="card-header">Darshan Details</div>
          <div class="card-body">
            <span>Darshan Date: 14/10/2026</span>
            <span>Darshan Slot: 8:00 AM</span>
            <span>No. of Tickets: 1</span>
            <span>Total Cost: ₹200</span>
          </div>
        </div>

        <!-- Pilgrim Details Card as rendered on live TTD SPAT -->
        <div class="card pilgrim-details-card">
          <div class="card-title">Pilgrim Details</div>
          <div class="form-row">
            <div class="form-group col">
              <label>Name *</label>
              <input type="text" class="form-control" />
            </div>
            <div class="form-group col">
              <label>Age *</label>
              <input type="text" maxlength="3" class="form-control" />
            </div>
            <div class="form-group col">
              <label>Gender *</label>
              <select class="form-control">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div class="form-group col">
              <label>Photo ID Proof *</label>
              <select class="form-control">
                <option value="">Select Photo ID Proof</option>
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="Passport">Passport</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>
            <div class="form-group col">
              <label>Photo Id Number *</label>
              <input type="text" class="form-control" />
            </div>
          </div>
        </div>

        <div class="action-buttons">
          <button type="button" class="btn btn-secondary">Back</button>
          <button type="submit" class="btn btn-primary">Continue</button>
        </div>
      </div>
    `;
  });

  it('1. detectActiveBookingStep safely identifies PILGRIM_DETAILS on the live SPAT page', () => {
    const step = detectActiveBookingStep(doc, liveSpatUrl);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  it('2. form-scanner and FieldMappingEngine detect and map all 5 devotee fields', () => {
    const scanned = scanForm(doc);
    expect(scanned.length).toBe(5);

    const mapped = FieldMappingEngine.map(scanned);
    const mappedKeys = mapped.allMapped.map(m => m.pilgrimKey);
    expect(mappedKeys).toContain('fullName');
    expect(mappedKeys).toContain('age');
    expect(mappedKeys).toContain('gender');
    expect(mappedKeys).toContain('idType');
    expect(mappedKeys).toContain('idNumber');
  });

  it('3. detectAndLockPilgrimRows safely identifies and locks the pilgrim row with high confidence', () => {
    const lockedRows = detectAndLockPilgrimRows(doc, 1);
    expect(lockedRows).toHaveLength(1);
    expect(lockedRows[0].isLocked).toBe(true);
    expect(lockedRows[0].confidence).toBeGreaterThanOrEqual(60);
  });

  it('4. executeAutofill completely fills and verifies all 5 devotee fields without error', async () => {
    const result = await executeAutofill({
      pilgrims: [samplePilgrim],
      profile: sampleProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.step).toBe('pilgrim');
    expect(result.errors).toEqual([]);
    expect(result.totalVerified).toBe(5);
    expect(result.totalFailed).toBe(0);

    // Verify DOM inputs actually received the pilgrim data
    const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input.form-control'));
    const selects = Array.from(doc.querySelectorAll<HTMLSelectElement>('select.form-control'));

    expect(inputs[0].value).toBe('Anusuri Chirudeep');
    expect(inputs[1].value).toBe('28');
    expect(selects[0].value).toBe('Male');
    expect(selects[1].value).toBe('Aadhaar Card');
    expect(inputs[2].value).toBe('987654321098');
  });

  it('5. executeAutofill handles live TTD layout with readonly dropdown inputs, pattern-constrained name, and dynamic enabled Photo ID', async () => {
    // Exact live TTD DOM markup
    doc.body.innerHTML = `
      <div class="main-container">
        <h1>Special Entry Darshan (Sri PAT)</h1>
        <div class="card darshan-details">
          <div>Darshan Date: 07/10/2026</div>
          <div>Darshan Slot: 2:00 PM</div>
          <div>No. of Tickets: 1</div>
          <div>Total Cost: ₹200</div>
        </div>
        <div class="card pilgrim-details-card">
          <div class="card-title">Pilgrim Details</div>
          <div class="form-row">
            <div class="form-group col">
              <label>Name *</label>
              <input type="text" pattern="[A-Z][a-zA-Z ]*" class="form-control" />
            </div>
            <div class="form-group col">
              <label>Age *</label>
              <input type="text" maxlength="3" class="form-control" />
            </div>
            <div class="form-group col">
              <label>Gender *</label>
              <input type="text" readonly role="combobox" class="form-control" />
              <span class="chevron">v</span>
            </div>
            <div class="form-group col">
              <label>Photo ID Proof *</label>
              <input type="text" readonly role="combobox" class="form-control" />
              <span class="chevron">v</span>
            </div>
            <div class="form-group col">
              <label>Photo Id Number *</label>
              <input type="text" disabled class="form-control" />
            </div>
          </div>
        </div>
      </div>
    `;

    // Simulate Angular enabling photoIdNumber when photoIdProof is changed
    const idProofInput = doc.querySelectorAll<HTMLInputElement>('input[type="text"][readonly]')[1];
    const idNumInput = doc.querySelector<HTMLInputElement>('input[type="text"][disabled]')!;
    idProofInput.addEventListener('change', () => {
      idNumInput.disabled = false;
    });

    const livePilgrim: Pilgrim = {
      ...samplePilgrim,
      fullName: 'Anusuri chirudeep', // lowercase 'c' as in user's live profile
    };

    const result = await executeAutofill({
      pilgrims: [livePilgrim],
      profile: { ...sampleProfile, pilgrims: [livePilgrim] },
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.totalVerified).toBe(5);
    expect(result.totalFailed).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
