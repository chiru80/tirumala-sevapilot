// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyTextValue,
  verifyNumericValue,
  verifyAadhaarValue,
  verifyDropdownSelection,
  verifyField,
} from '../../../src/content/autofill/verification';

describe('Verification Engine (Post-Fill Explicit Check)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  describe('Text Exact Verification', () => {
    it('verifies exact match ignoring leading/trailing whitespace and case', () => {
      const input = doc.createElement('input');
      input.value = 'Ravi Kumar  ';
      const result = verifyTextValue(input, '  ravi kumar ', 'name');
      expect(result.status).toBe('verified');
      expect(result.reasons[0]).toContain('Exact match');
    });

    it('fails when text does not match', () => {
      const input = doc.createElement('input');
      input.value = 'John Doe';
      const result = verifyTextValue(input, 'Ravi Kumar', 'name');
      expect(result.status).toBe('failed');
      expect(result.reasons[0]).toContain('Value mismatch');
    });

    it('fails when field remains empty after autofill attempt', () => {
      const input = doc.createElement('input');
      input.value = '';
      const result = verifyTextValue(input, 'Ravi Kumar', 'name');
      expect(result.status).toBe('failed');
      expect(result.reasons[0]).toContain('empty');
    });
  });

  describe('Age / Numeric Verification', () => {
    it('verifies numeric equality even with leading zeros or spacing', () => {
      const input = doc.createElement('input');
      input.type = 'number';
      input.value = '35';
      const result = verifyNumericValue(input, '35', 'age');
      expect(result.status).toBe('verified');
    });

    it('verifies string equality when numbers match', () => {
      const input = doc.createElement('input');
      input.value = '035';
      const result = verifyNumericValue(input, '35', 'age');
      expect(result.status).toBe('verified');
    });

    it('fails when age does not match', () => {
      const input = doc.createElement('input');
      input.value = '42';
      const result = verifyNumericValue(input, '35', 'age');
      expect(result.status).toBe('failed');
    });
  });

  describe('Aadhaar / ID Number Verification', () => {
    it('verifies exact 12-digit Aadhaar match ignoring spaces and dashes', () => {
      const input = doc.createElement('input');
      input.value = '1234 5678 9012';
      const result = verifyAadhaarValue(input, '1234-5678-9012', 'photoIdNumber');
      expect(result.status).toBe('verified');
      expect(result.actualValue.replace(/\D/g, '')).toBe('123456789012');
      expect(result.expectedValue.replace(/\D/g, '')).toBe('123456789012');
    });

    it('fails when any Aadhaar digit differs', () => {
      const input = doc.createElement('input');
      input.value = '123456789019';
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber');
      expect(result.status).toBe('failed');
    });

    it('strictly fails when actual is an 11-digit partial prefix of 12-digit expected', () => {
      const input = doc.createElement('input');
      input.value = '12345678901'; // 11 digits
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber'); // 12 digits
      expect(result.status).toBe('failed');
      expect(result.reasons[0]).toContain('mismatch');
    });

    it('masks Aadhaar number in verification result (PII protection)', () => {
      const input = doc.createElement('input');
      input.value = '123456789012';
      const result = verifyAadhaarValue(input, '123456789012', 'photoIdNumber');
      expect(result.maskedActual).not.toContain('12345678');
      expect(result.maskedActual).toContain('9012');
      expect(result.maskedExpected).not.toContain('12345678');
    });
  });

  describe('Dropdown Selection Verification', () => {
    it('verifies native select dropdown selected option', () => {
      const select = doc.createElement('select');
      const opt1 = doc.createElement('option');
      opt1.value = 'M';
      opt1.textContent = 'Male';
      const opt2 = doc.createElement('option');
      opt2.value = 'F';
      opt2.textContent = 'Female';
      select.appendChild(opt1);
      select.appendChild(opt2);
      select.selectedIndex = 0; // Male

      const result = verifyDropdownSelection(select, 'Male', 'gender', doc);
      expect(result.status).toBe('verified');
    });

    it('fails when native select has wrong option selected', () => {
      const select = doc.createElement('select');
      const opt1 = doc.createElement('option');
      opt1.value = 'M';
      opt1.textContent = 'Male';
      const opt2 = doc.createElement('option');
      opt2.value = 'F';
      opt2.textContent = 'Female';
      select.appendChild(opt1);
      select.appendChild(opt2);
      select.selectedIndex = 1; // Female

      const result = verifyDropdownSelection(select, 'Male', 'gender', doc);
      expect(result.status).toBe('failed');
    });

    it('verifies Angular Material mat-select trigger text', () => {
      const matSelect = doc.createElement('mat-select');
      const trigger = doc.createElement('div');
      trigger.className = 'mat-select-value';
      trigger.textContent = 'Aadhaar Card';
      matSelect.appendChild(trigger);

      const result = verifyDropdownSelection(matSelect, 'Aadhaar Card', 'photoIdProof', doc);
      expect(result.status).toBe('verified');
    });
  });

  describe('Universal verifyField Router', () => {
    it('routes text fields to verifyTextValue', () => {
      const input = doc.createElement('input');
      input.value = 'Hyderabad';
      const res = verifyField(input, 'Hyderabad', 'city', doc);
      expect(res.status).toBe('verified');
    });

    it('routes age to numeric verification', () => {
      const input = doc.createElement('input');
      input.value = '25';
      const res = verifyField(input, '25', 'age', doc);
      expect(res.status).toBe('verified');
    });

    it('routes aadhaar to aadhaar verification', () => {
      const input = doc.createElement('input');
      input.value = '987654321098';
      const res = verifyField(input, '9876 5432 1098', 'photoIdNumber', doc);
      expect(res.status).toBe('verified');
    });
  });
});
