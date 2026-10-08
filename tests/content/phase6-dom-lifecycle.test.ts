// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 6 — DOM Lifecycle Engine & Stale Element Protection Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DomLifecycleEngine, type DomLifecycleEvent } from '../../src/content/dom-lifecycle';
import {
  createFieldFingerprint,
  resolvePilgrimFields,
  resolveGeneralFields,
  SAFE_CONFIDENCE_THRESHOLD,
} from '../../src/content/autofill/field-resolver';
import {
  getFieldContract,
  SPECIAL_ENTRY_300_CONTRACTS,
  HOMAM_CONTRACTS,
  PADMAVATHI_CONTRACTS,
} from '../../src/content/autofill/field-contracts';
import {
  inspectElementValidation,
  inspectFormValidation,
} from '../../src/content/autofill/form-validation';
import {
  verifyField,
  verifyIdNumberValue,
  verifyDropdownSelection,
  verifyRadioSelection,
  verifyCheckboxValue,
  verifyDateValue,
} from '../../src/content/autofill/verification';
import {
  isValidExtensionMessage,
  isTrustedExtensionSender,
  sanitizeMessagePayload,
} from '../../src/shared/message-security';

describe('Phase 6: DOM Lifecycle Engine (Scoped & Debounced)', () => {
  let engine: DomLifecycleEngine;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new DomLifecycleEngine({ debounceMs: 20 });
  });

  afterEach(() => {
    engine.stop();
    document.body.innerHTML = '';
  });

  async function waitForEvent(predicate: () => boolean, timeoutMs = 1500): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return predicate();
  }

  it('detects FORM_APPEARED when a form node is injected', async () => {
    const events: DomLifecycleEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start(document.body);

    const form = document.createElement('form');
    form.id = 'booking-form';
    document.body.appendChild(form);

    const detected = await waitForEvent(() => events.some((e) => e.type === 'FORM_APPEARED'));
    expect(detected).toBe(true);
  });

  it('detects FIELD_APPEARED when an input is dynamically added', async () => {
    const events: DomLifecycleEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start(document.body);

    const input = document.createElement('input');
    input.name = 'pilgrimName';
    document.body.appendChild(input);

    const detected = await waitForEvent(() => events.some((e) => e.type === 'FIELD_APPEARED'));
    expect(detected).toBe(true);
  });

  it('detects FIELD_DISABLED and FIELD_ENABLED attribute changes', async () => {
    const input = document.createElement('input');
    input.name = 'photoIdNumber';
    document.body.appendChild(input);

    const events: DomLifecycleEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start(document.body);

    // Disable field
    input.setAttribute('disabled', 'true');
    const disabledDetected = await waitForEvent(() => events.some((e) => e.type === 'FIELD_DISABLED'));
    expect(disabledDetected).toBe(true);

    // Enable field
    input.removeAttribute('disabled');
    const enabledDetected = await waitForEvent(() => events.some((e) => e.type === 'FIELD_ENABLED'));
    expect(enabledDetected).toBe(true);
  });

  it('cleans up MutationObserver properly on stop() without memory leaks', async () => {
    const events: DomLifecycleEvent[] = [];
    engine.subscribe((e) => events.push(e));
    engine.start(document.body);
    engine.stop();

    const input = document.createElement('input');
    input.name = 'testInput';
    document.body.appendChild(input);

    await new Promise((r) => setTimeout(r, 150));
    expect(events.length).toBe(0);
  });
});

describe('Phase 6: Field Fingerprinting & Stale Element Protection', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  it('generates a stable FieldFingerprint from element attributes', () => {
    const input = doc.createElement('input');
    input.id = 'p_name_0';
    input.name = 'pilgrimName';
    input.setAttribute('aria-label', 'Devotee Full Name');
    input.type = 'text';

    const fp = createFieldFingerprint(input, 0);
    expect(fp.tagName).toBe('input');
    expect(fp.name).toBe('pilgrimName');
    expect(fp.id).toBe('p_name_0');
    expect(fp.label).toBe('Devotee Full Name');
    expect(fp.type).toBe('text');
    expect(fp.index).toBe(0);
  });

  it('field resolver rejects ambiguous fields with confidence below contract threshold', () => {
    const container = doc.createElement('div');
    container.innerHTML = `
      <input type="text" class="generic-box" />
      <input type="text" class="another-box" />
    `;
    doc.body.appendChild(container);

    const resolved = resolvePilgrimFields(container, doc);
    // Unlabelled, unattributed text boxes must never be assigned to critical fields
    expect(resolved.has('name')).toBe(false);
    expect(resolved.has('photoIdNumber')).toBe(false);
  });

  it('field resolver enforces contract threshold for critical fields', () => {
    const nameContract = getFieldContract('name');
    expect(nameContract).toBeDefined();
    expect(nameContract?.confidenceThreshold).toBeGreaterThanOrEqual(60);

    const idNumContract = getFieldContract('photoIdNumber');
    expect(idNumContract).toBeDefined();
    expect(idNumContract?.confidenceThreshold).toBeGreaterThanOrEqual(65);
    expect(idNumContract?.isIdentity).toBe(true);
  });
});

describe('Phase 6: Service-Aware Field Contracts', () => {
  it('loads correct contracts for Special Entry Darshan 300', () => {
    expect(SPECIAL_ENTRY_300_CONTRACTS.name.required).toBe(true);
    expect(SPECIAL_ENTRY_300_CONTRACTS.mobile.required).toBe(false); // Mobile optional by default
    expect(SPECIAL_ENTRY_300_CONTRACTS.photoIdNumber.isIdentity).toBe(true);
  });

  it('loads correct contracts for Homam (Gothram required, exactly 2 pilgrims)', () => {
    expect(HOMAM_CONTRACTS.gothram.required).toBe(true);
    expect(HOMAM_CONTRACTS.name.required).toBe(true);
  });

  it('loads correct contracts for Padmavathi (dynamic observed contracts)', () => {
    expect(PADMAVATHI_CONTRACTS.name).toBeDefined();
    expect(PADMAVATHI_CONTRACTS.photoIdProof).toBeDefined();
  });
});

describe('Phase 6: Form Validation Awareness & Verification', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  it('detects Angular Material mat-error and fails verification even if value exists', () => {
    const container = doc.createElement('mat-form-field');
    const input = doc.createElement('input');
    input.value = 'Ravi Kumar';
    input.setAttribute('name', 'name');

    const errorEl = doc.createElement('mat-error');
    errorEl.textContent = 'Name contains invalid characters';
    // in jsdom, make offsetWidth > 0
    Object.defineProperty(errorEl, 'offsetWidth', { value: 100 });
    Object.defineProperty(errorEl, 'offsetHeight', { value: 20 });

    container.appendChild(input);
    container.appendChild(errorEl);
    doc.body.appendChild(container);

    const check = inspectElementValidation(input, 'name');
    expect(check.hasError).toBe(true);
    expect(check.errorMessage).toContain('invalid characters');

    const vRes = verifyField(input, 'Ravi Kumar', 'name', doc);
    expect(vRes.status).toBe('failed');
    expect(vRes.reasons.some(r => r.includes('Validation error'))).toBe(true);
  });

  it('inspectFormValidation reports all visible error messages in container', () => {
    const form = doc.createElement('div');
    form.innerHTML = `
      <div class="form-group">
        <input name="email" value="invalid" />
        <span class="invalid-feedback" style="display: block;">Invalid email format</span>
      </div>
    `;
    const errSpan = form.querySelector('.invalid-feedback') as HTMLElement;
    Object.defineProperty(errSpan, 'offsetWidth', { value: 120 });
    doc.body.appendChild(form);

    const state = inspectFormValidation(form);
    expect(state.valid).toBe(false);
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.errors[0].message).toContain('Invalid email format');
  });

  it('does not fail verification on native patternMismatch in Angular/novalidate forms when no visible error exists', () => {
    const container = doc.createElement('mat-form-field');
    const input = doc.createElement('input');
    input.value = 'Anusuri Chirudeep';
    input.setAttribute('name', 'name');

    // Simulate native patternMismatch without visible error
    Object.defineProperty(input, 'validity', {
      value: {
        valid: false,
        patternMismatch: true,
        valueMissing: false,
      },
      configurable: true,
    });
    Object.defineProperty(input, 'validationMessage', {
      value: 'Please match the requested format.',
      configurable: true,
    });

    container.appendChild(input);
    doc.body.appendChild(container);

    const check = inspectElementValidation(input, 'name');
    expect(check.hasError).toBe(false);

    const vRes = verifyField(input, 'Anusuri chirudeep', 'name', doc);
    expect(vRes.status).toBe('verified');
  });

  it('fails verification on valueMissing when required field is empty', () => {
    const container = doc.createElement('mat-form-field');
    const input = doc.createElement('input');
    input.value = '';
    input.setAttribute('name', 'name');

    Object.defineProperty(input, 'validity', {
      value: {
        valid: false,
        valueMissing: true,
      },
      configurable: true,
    });
    Object.defineProperty(input, 'validationMessage', {
      value: 'Please fill out this field.',
      configurable: true,
    });

    container.appendChild(input);
    doc.body.appendChild(container);

    const check = inspectElementValidation(input, 'name');
    expect(check.hasError).toBe(true);
    expect(check.errorMessage).toBe('Please fill out this field.');
  });

  it('verifies exact normalized ID number and strictly rejects partial matching', () => {
    const input = doc.createElement('input');
    input.value = '1234 5678 9012';

    // Exact normalized match -> verified
    const res1 = verifyIdNumberValue(input, '123456789012', 'photoIdNumber');
    expect(res1.status).toBe('verified');

    // Partial prefix (11 digits vs 12) -> strictly failed
    input.value = '1234 5678 901';
    const res2 = verifyIdNumberValue(input, '123456789012', 'photoIdNumber');
    expect(res2.status).toBe('failed');

    // Partial substring match -> strictly failed
    input.value = '5678 9012';
    const res3 = verifyIdNumberValue(input, '123456789012', 'photoIdNumber');
    expect(res3.status).toBe('failed');
  });

  it('verifies radio group selection correctly', () => {
    const container = doc.createElement('div');
    container.innerHTML = `
      <label><input type="radio" name="gender" value="Male" checked /> Male</label>
      <label><input type="radio" name="gender" value="Female" /> Female</label>
    `;
    doc.body.appendChild(container);

    const matchRes = verifyRadioSelection(container, 'Male', 'gender');
    expect(matchRes.status).toBe('verified');

    const mismatchRes = verifyRadioSelection(container, 'Female', 'gender');
    expect(mismatchRes.status).toBe('failed');
  });

  it('verifies checkbox and date inputs correctly', () => {
    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    const cbRes = verifyCheckboxValue(checkbox, true, 'acceptTerms');
    expect(cbRes.status).toBe('verified');

    const dateInput = doc.createElement('input');
    dateInput.type = 'date';
    dateInput.value = '2026-10-06';

    const dateRes = verifyDateValue(dateInput, '2026/10/06', 'dob');
    expect(dateRes.status).toBe('verified');
  });
});

describe('Phase 6: Message Security & Payload Validation', () => {
  it('validates legitimate extension messages', () => {
    const validMsg = {
      type: 'SCAN_PAGE',
      payload: { mode: 'FAST' },
      timestamp: new Date().toISOString(),
    };
    expect(isValidExtensionMessage(validMsg)).toBe(true);
  });

  it('rejects malformed messages, null objects, or missing types', () => {
    expect(isValidExtensionMessage(null)).toBe(false);
    expect(isValidExtensionMessage(undefined)).toBe(false);
    expect(isValidExtensionMessage('just a string')).toBe(false);
    expect(isValidExtensionMessage({})).toBe(false);
    expect(isValidExtensionMessage({ type: '' })).toBe(false);
  });

  it('rejects prototype pollution attempts in message payloads', () => {
    const maliciousMsg = JSON.parse(
      '{"type":"FILL_FIELDS","payload":{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"poll":true}}},"timestamp":"2026-10-06T00:00:00Z"}'
    );
    expect(isValidExtensionMessage(maliciousMsg)).toBe(false);
  });

  it('sanitizes message payload safely', () => {
    const payload = JSON.parse(
      '{"normal":"value","__proto__":{"hack":true},"nested":{"clean":"data"}}'
    );
    const sanitized = sanitizeMessagePayload(payload) as any;
    expect(sanitized.normal).toBe('value');
    expect(sanitized.nested.clean).toBe('data');
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
  });
});
