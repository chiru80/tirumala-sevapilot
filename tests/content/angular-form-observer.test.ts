// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { AngularFormObserver } from '../../src/content/angular-form-observer';
import { dispatchAngularCompatibleEvents } from '../../src/content/dom-events';
import { fillFields } from '../../src/content/autofill-engine';
import { scanForm } from '../../src/content/form-scanner';
import { mapFields } from '../../src/content/field-mapper';
import type { Pilgrim, FieldMapping } from '../../src/shared/types';
import { Gender, IdType, ConfidenceLevel } from '../../src/shared/types';

describe('AngularFormObserver & TTD Reactive Form Validation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('correctly masks sensitive devotee information (zero PII in diagnostics)', () => {
    expect(AngularFormObserver.maskValue('idNumber', '987654321173')).toBe('********1173');
    expect(AngularFormObserver.maskValue('mobile', '9876544567')).toBe('******4567');
    expect(AngularFormObserver.maskValue('fullName', 'Govinda Ramanuja')).toBe('Govinda Ramanuja');
  });

  it('detects Angular valid state on properly populated Angular Material form fields', async () => {
    document.body.innerHTML = `
      <form class="ng-valid ng-dirty ng-touched">
        <mat-form-field class="mat-form-field mat-primary">
          <input id="name_0" class="mat-input-element ng-valid ng-dirty ng-touched" value="Venkateswara Swamy" />
        </mat-form-field>
        <mat-form-field class="mat-form-field mat-primary">
          <input id="age_0" class="mat-input-element ng-valid ng-dirty ng-touched" value="35" />
        </mat-form-field>
      </form>
    `;

    const mappings: FieldMapping[] = [
      {
        scannedField: {
          element: '#name_0',
          type: 'text',
          label: 'Name',
          required: true,
          groupIndex: 0,
        },
        pilgrimKey: 'fullName',
        confidence: 95,
        confidenceLevel: ConfidenceLevel.HIGH,
        matchReasons: ['Exact label match'],
      },
      {
        scannedField: {
          element: '#age_0',
          type: 'number',
          label: 'Age',
          required: true,
          groupIndex: 0,
        },
        pilgrimKey: 'age',
        confidence: 95,
        confidenceLevel: ConfidenceLevel.HIGH,
        matchReasons: ['Exact label match'],
      },
    ];

    const summary = await AngularFormObserver.verifyForm(mappings, document);
    expect(summary.allValid).toBe(true);
    expect(summary.validCount).toBe(2);
    expect(summary.invalidCount).toBe(0);
    expect(summary.failingFieldNames.length).toBe(0);
  });

  it('detects Angular invalid state when ng-invalid or mat-error exists', async () => {
    document.body.innerHTML = `
      <form class="ng-invalid">
        <mat-form-field class="mat-form-field mat-form-field-invalid">
          <input id="idNumber_0" class="mat-input-element ng-invalid ng-touched" value="1234" aria-invalid="true" />
          <mat-error class="mat-error">Please enter valid 12 digit Aadhaar number</mat-error>
        </mat-form-field>
      </form>
    `;

    const mappings: FieldMapping[] = [
      {
        scannedField: {
          element: '#idNumber_0',
          type: 'text',
          label: 'Photo Id Number',
          required: true,
          groupIndex: 0,
        },
        pilgrimKey: 'idNumber',
        confidence: 95,
        confidenceLevel: ConfidenceLevel.HIGH,
        matchReasons: ['Exact label match'],
      },
    ];

    const summary = await AngularFormObserver.verifyForm(mappings, document);
    expect(summary.allValid).toBe(false);
    expect(summary.invalidCount).toBe(1);
    expect(summary.failingFieldNames).toContain('Photo Id Number');
    expect(summary.fields[0].hasMatError).toBe(true);
    expect(summary.fields[0].errorMessage).toBe('Please enter valid 12 digit Aadhaar number');
  });

  it('dispatches full Angular event chain ensuring input and blur compose properly', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const receivedEvents: string[] = [];
    const eventTypes = ['focus', 'focusin', 'keydown', 'beforeinput', 'input', 'keyup', 'change', 'blur', 'focusout'];
    
    eventTypes.forEach(evt => {
      input.addEventListener(evt, (e) => {
        receivedEvents.push(e.type);
      });
    });

    dispatchAngularCompatibleEvents(input, '123456789012');

    expect(input.value).toBe('123456789012');
    expect(receivedEvents).toContain('focus');
    expect(receivedEvents).toContain('beforeinput');
    expect(receivedEvents).toContain('input');
    expect(receivedEvents).toContain('change');
    expect(receivedEvents).toContain('blur');
  });

  it('autofill-engine attaches Angular verification results to FillResult', async () => {
    document.body.innerHTML = `
      <div class="row">
        <div><label>Name *</label><input type="text" id="name" name="name" class="ng-valid" /></div>
        <div><label>Age *</label><input type="number" id="age" name="age" class="ng-valid" /></div>
        <div><label>Photo Id Number *</label><input type="text" id="idNumber" name="idNumber" class="ng-valid" /></div>
      </div>
    `;

    const mockPilgrim: Pilgrim = {
      id: 'p-1',
      fullName: 'Srinivasa Ramanuja',
      firstName: 'Srinivasa',
      lastName: 'Ramanuja',
      gender: Gender.MALE,
      dateOfBirth: '1990-05-15',
      age: 34,
      idType: IdType.AADHAAR,
      idNumber: '998877665544',
      mobile: '9876543210',
      country: 'India',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const scanned = scanForm(document);
    const mappings = mapFields(scanned);

    const results = await fillFields([mockPilgrim], mappings, document, { mode: 'safe', overwrite: true });

    expect(results.length).toBe(3);
    for (const res of results) {
      expect(res.status).toBe('filled');
      expect(res.isAngularValid).toBe(true);
      expect(res.validationStatus).toBe('valid');
    }
  });
});
