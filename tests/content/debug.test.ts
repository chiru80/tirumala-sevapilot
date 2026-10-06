// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { executeAutofill } from '../../src/content/autofill/autofill-manager';
import { detectAndLockPilgrimRows } from '../../src/content/autofill/row-detector';
import { findFieldInContainer } from '../../src/content/ttd-pilgrim-autofill';
import { executeDropdownTransaction } from '../../src/content/autofill/field-transaction';
import { Gender, IdType } from '../../src/shared/types';

describe('Debug Real TTD DOM Flow', () => {
  it('debugs exact TTD DOM layout for Photo ID Proof and Number', async () => {
    document.body.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h4>Pilgrim Details</h4>
          <div class="row">
            <div class="col-md-2 form-group">
              <label>Name <span class="text-danger">*</span></label>
              <input type="text" formcontrolname="name" class="mat-input-element form-control" />
            </div>
            <div class="col-md-1 form-group">
              <label>Age <span class="text-danger">*</span></label>
              <input type="number" formcontrolname="age" class="mat-input-element form-control" />
            </div>
            <div class="col-md-2 form-group">
              <label>Gender <span class="text-danger">*</span></label>
              <mat-select formcontrolname="gender" role="combobox" class="mat-select mat-mdc-select">
                <div class="mat-select-trigger mat-mdc-select-trigger">
                  <div class="mat-select-value mat-mdc-select-value"><span class="mat-select-placeholder">Gender *</span></div>
                  <div class="mat-select-arrow-wrapper"><div class="mat-select-arrow"></div></div>
                </div>
              </mat-select>
            </div>
            <div class="col-md-3 form-group">
              <label>Photo ID Proof <span class="text-danger">*</span></label>
              <mat-select formcontrolname="photoIdProof" role="combobox" class="mat-select mat-mdc-select">
                <div class="mat-select-trigger mat-mdc-select-trigger">
                  <div class="mat-select-value mat-mdc-select-value"><span class="mat-select-placeholder">Photo ID Proof *</span></div>
                  <div class="mat-select-arrow-wrapper"><div class="mat-select-arrow"></div></div>
                </div>
              </mat-select>
            </div>
            <div class="col-md-4 form-group">
              <label>Photo Id Number <span class="text-danger">*</span></label>
              <input type="text" formcontrolname="photoIdNumber" class="mat-input-element form-control" placeholder="Photo Id Number" disabled />
            </div>
          </div>
        </div>
      </div>
    `;

    // Mock overlay opening when mat-select is clicked
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      console.log('CLICK TARGET:', target.tagName, target.className);
      const matSelect = target.closest('mat-select');
      if (matSelect) {
        const fc = matSelect.getAttribute('formcontrolname');
        console.log('MAT-SELECT CLICKED:', fc);
        let overlay = document.querySelector('.cdk-overlay-container');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'cdk-overlay-container';
          document.body.appendChild(overlay);
        }
        if (fc === 'gender') {
          overlay.innerHTML = `
            <div class="cdk-overlay-pane">
              <div role="listbox" class="mat-select-panel">
                <mat-option role="option" value="Male"><span class="mat-option-text">Male</span></mat-option>
                <mat-option role="option" value="Female"><span class="mat-option-text">Female</span></mat-option>
              </div>
            </div>
          `;
        } else if (fc === 'photoIdProof') {
          overlay.innerHTML = `
            <div class="cdk-overlay-pane">
              <div role="listbox" class="mat-select-panel">
                <mat-option role="option" value="Aadhaar Card"><span class="mat-option-text">Aadhaar Card</span></mat-option>
                <mat-option role="option" value="Passport"><span class="mat-option-text">Passport</span></mat-option>
              </div>
            </div>
          `;
          overlay.querySelectorAll('mat-option').forEach(opt => {
            opt.addEventListener('click', () => {
              const input = document.querySelector('input[formcontrolname="photoIdNumber"]') as HTMLInputElement;
              if (input) {
                input.disabled = false;
                input.removeAttribute('disabled');
              }
            });
          });
        }
      }
    });

    const locked = detectAndLockPilgrimRows(document, 1);
    console.log('LOCKED ROWS COUNT:', locked.length);
    if (locked[0]) {
      console.log('LOCKED FIELDS:', Array.from(locked[0].fields.keys()));
      console.log('GENDER EL:', locked[0].fields.get('gender')?.tagName, locked[0].fields.get('gender')?.getAttribute('formcontrolname'));
      console.log('PHOTO ID PROOF EL:', locked[0].fields.get('photoIdProof')?.tagName, locked[0].fields.get('photoIdProof')?.getAttribute('formcontrolname'));
      console.log('PHOTO ID NUMBER EL:', locked[0].fields.get('photoIdNumber')?.tagName, locked[0].fields.get('photoIdNumber')?.getAttribute('formcontrolname'));
    }

    const res = await executeAutofill({
      pilgrims: [{
        id: 'p1',
        fullName: 'Anusuri chirudeep',
        firstName: 'Anusuri',
        lastName: 'chirudeep',
        age: 23,
        gender: Gender.MALE,
        idType: IdType.AADHAAR,
        idNumber: '913901445173',
        country: 'India',
        createdAt: new Date().toISOString(),
      }],
      doc: document,
    });

    console.log('AUTOFILL RESULT SUCCESS:', res.success);
    console.log('AUTOFILL ERRORS:', res.errors);
    if (res.pilgrimResults[0]) {
      console.log('PILGRIM RESULTS:', res.pilgrimResults[0].results.map(r => ({ field: r.field, status: r.status, error: r.error })));
    }
  }, 30000);
});
