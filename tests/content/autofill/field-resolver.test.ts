// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolvePilgrimFields,
  resolveGeneralFields,
  reResolveField,
  SAFE_CONFIDENCE_THRESHOLD,
} from '../../../src/content/autofill/field-resolver';
import { getConfidenceCategory } from '../../../src/content/autofill/types';

describe('Field Resolver (Semantic Detection & Collision Prevention)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  describe('Confidence Scoring & Categories', () => {
    it('categorizes scores according to V1 scale', () => {
      expect(getConfidenceCategory(98)).toBe('very_high');
      expect(getConfidenceCategory(95)).toBe('very_high');
      expect(getConfidenceCategory(90)).toBe('high');
      expect(getConfidenceCategory(85)).toBe('high');
      expect(getConfidenceCategory(75)).toBe('medium');
      expect(getConfidenceCategory(70)).toBe('medium');
      expect(getConfidenceCategory(60)).toBe('low');
      expect(getConfidenceCategory(50)).toBe('low');
      expect(getConfidenceCategory(49)).toBe('ambiguous');
      expect(getConfidenceCategory(20)).toBe('ambiguous');
      expect(getConfidenceCategory(0)).toBe('ambiguous');
    });

    it('rejects ambiguous candidates without strong signals', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input id="x_unknown" class="some-input" type="text" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      // The completely unlabelled, un-attributed text input should not resolve to age or gender
      expect(fields.has('gender')).toBe(false);
      expect(fields.has('photoIdProof')).toBe(false);
    });
  });

  describe('Detection Priority Hierarchy', () => {
    it('priority 1: resolves by formcontrolname with high confidence', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input formcontrolname="name" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      const res = fields.get('name')!;
      expect(res.confidence).toBeGreaterThanOrEqual(35);
      expect(res.strategy).toBe('formControlName');
    });

    it('priority 2: resolves by name attribute', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input name="pilgrimName" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      expect(fields.get('name')!.strategy).toBe('name');
    });

    it('priority 3: resolves by aria-label', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input aria-label="Devotee Name" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      expect(fields.get('name')!.strategy).toBe('aria-label');
    });

    it('priority 4: resolves by aria-labelledby', () => {
      doc.body.innerHTML = `
        <div id="row">
          <span id="name-label">Devotee Name</span>
          <input aria-labelledby="name-label" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      expect(fields.get('name')!.strategy).toBe('aria-labelledby');
    });

    it('priority 5: resolves by label[for]', () => {
      doc.body.innerHTML = `
        <div id="row">
          <label for="custom_name">Devotee Name</label>
          <input id="custom_name" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      expect(fields.get('name')!.strategy).toBe('label');
    });

    it('priority 6: resolves by placeholder', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input placeholder="Enter Pilgrim Name" class="input-1" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);
      expect(fields.has('name')).toBe(true);
      expect(fields.get('name')!.strategy).toBe('placeholder');
    });
  });

  describe('Pilgrim Logical Fields Resolution', () => {
    it('resolves all 5 pilgrim fields in an Angular Material form row', () => {
      doc.body.innerHTML = `
        <div id="row" class="card">
          <input formcontrolname="name" placeholder="Name" />
          <input formcontrolname="age" type="number" placeholder="Age" />
          <mat-select formcontrolname="gender" role="combobox"><span class="mat-select-placeholder">Select Gender</span></mat-select>
          <mat-select formcontrolname="idProof" role="combobox"><span class="mat-select-placeholder">ID Proof</span></mat-select>
          <input formcontrolname="idNumber" placeholder="Photo ID Number" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      expect(fields.has('name')).toBe(true);
      expect(fields.has('age')).toBe(true);
      expect(fields.has('gender')).toBe(true);
      expect(fields.has('photoIdProof')).toBe(true);
      expect(fields.has('photoIdNumber')).toBe(true);

      // Verify each resolution has reasons and strategy
      for (const [key, res] of fields) {
        expect(res.strategy).toBeTruthy();
        expect(res.reasons.length).toBeGreaterThan(0);
        expect(res.confidence).toBeGreaterThan(0);
      }
    });

    it('prevents collision: gender and photoIdProof never resolve to the same element', () => {
      doc.body.innerHTML = `
        <div id="row">
          <select formcontrolname="gender" id="s1"><option>Male</option></select>
          <select formcontrolname="photoIdProof" id="s2"><option>Aadhaar</option></select>
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      const genderEl = fields.get('gender')?.element;
      const idProofEl = fields.get('photoIdProof')?.element;

      expect(genderEl).not.toBeNull();
      expect(idProofEl).not.toBeNull();
      expect(genderEl).not.toBe(idProofEl);
    });

    it('ID Number rejects negative signals (OTP, Mobile, Phone, Password, Captcha)', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input name="otpNumber" placeholder="Enter OTP" />
          <input name="mobileNumber" placeholder="Enter Mobile" />
          <input name="captchaCode" placeholder="Enter Captcha" />
          <input formcontrolname="idNumber" placeholder="Aadhaar Card Number" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      const idNum = fields.get('photoIdNumber');
      expect(idNum).toBeDefined();
      expect(idNum!.element.getAttribute('formcontrolname')).toBe('idNumber');
      expect(idNum!.element.getAttribute('name')).not.toBe('otpNumber');
      expect(idNum!.element.getAttribute('name')).not.toBe('mobileNumber');
      expect(idNum!.element.getAttribute('name')).not.toBe('captchaCode');
    });
  });

  describe('General Fields Resolution', () => {
    it('resolves Email, Mobile, City, State, Country, and PIN Code on contact form', () => {
      doc.body.innerHTML = `
        <form id="contact-form">
          <input type="email" formcontrolname="email" placeholder="Email Address" />
          <input type="tel" formcontrolname="mobile" placeholder="Mobile Number" />
          <input type="text" formcontrolname="city" placeholder="City / Town" />
          <select formcontrolname="state"><option>Andhra Pradesh</option></select>
          <select formcontrolname="country"><option>India</option></select>
          <input type="text" formcontrolname="pincode" placeholder="PIN Code" />
        </form>
      `;
      const fields = resolveGeneralFields(doc);

      expect(fields.has('email')).toBe(true);
      expect(fields.has('mobile')).toBe(true);
      expect(fields.has('city')).toBe(true);
      expect(fields.has('state')).toBe(true);
      expect(fields.has('country')).toBe(true);
      expect(fields.has('pinCode') || fields.has('pincode')).toBe(true);
    });
  });

  describe('Re-resolution', () => {
    it('re-resolves a single field discarding previous excluded references', () => {
      doc.body.innerHTML = `
        <div id="row">
          <input id="old-id" formcontrolname="idNumber" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const oldEl = doc.getElementById('old-id')!;

      // If oldEl is excluded, it should return null
      const res1 = reResolveField('photoIdNumber', row, new Set([oldEl]), doc);
      expect(res1).toBeNull();

      // If not excluded, it should resolve
      const res2 = reResolveField('photoIdNumber', row, new Set(), doc);
      expect(res2?.element).toBe(oldEl);
    });
  });

  describe('Critical Negative Tests (NEVER Guess a Field)', () => {
    it('ID Number must NEVER fall back to last input when unlabelled', () => {
      // Row has Name and an unlabelled input at the end
      doc.body.innerHTML = `
        <div id="row">
          <input formcontrolname="name" placeholder="Devotee Name" />
          <input id="random_extra" type="text" />
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      // The unlabelled text input must NOT be guessed as photoIdNumber
      expect(fields.has('photoIdNumber')).toBe(false);
    });

    it('Gender must NEVER fall back to first dropdown in production', () => {
      // Row has an unlabelled dropdown that has nothing to do with Gender
      doc.body.innerHTML = `
        <div id="row">
          <select id="unrelated_select">
            <option>Option A</option>
            <option>Option B</option>
          </select>
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      // Must NOT guess Gender from first unassigned dropdown
      expect(fields.has('gender')).toBe(false);
    });

    it('ID Proof must NEVER fall back to first remaining dropdown in production', () => {
      // Row has Gender correctly identified, plus an unrelated unlabelled select
      doc.body.innerHTML = `
        <div id="row">
          <select formcontrolname="gender">
            <option>Male</option>
            <option>Female</option>
          </select>
          <select id="some_other_dropdown">
            <option>Standard</option>
            <option>VIP</option>
          </select>
        </div>
      `;
      const row = doc.getElementById('row')!;
      const fields = resolvePilgrimFields(row, doc);

      expect(fields.has('gender')).toBe(true);
      // The second select must NOT be guessed as photoIdProof
      expect(fields.has('photoIdProof')).toBe(false);
    });
  });
});
