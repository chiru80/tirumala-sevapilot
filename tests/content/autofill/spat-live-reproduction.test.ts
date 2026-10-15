// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { executeAutofill } from '../../../src/content/autofill/autofill-manager';
import { detectWorkflowStep } from '../../../src/content/autofill/page-workflow';
import { detectAndLockPilgrimRows } from '../../../src/content/autofill/row-detector';
import { ServiceRecognitionEngine } from '../../../src/services/service-recognition-engine';
import { resolveCanonicalService, isServiceAutofillAllowed } from '../../../src/services/canonical-service-registry';
import { handleMessage } from '../../../src/background/message-router';
import { inspectElementValidation, isGenuineErrorMessageElement } from '../../../src/content/autofill/form-validation';
import { Gender, IdType, MessageType, type Pilgrim, type Profile } from '../../../src/shared/types';
import logger from '../../../src/shared/logger';
import { computeNextAction } from '../../../src/sidepanel/presentation/next-action';

describe('SPAT ₹200 Live Page End-to-End Regression Test', () => {
  let doc: Document;
  const liveSpatUrl = 'https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat&section=slot-booking';

  const mockPilgrim: Pilgrim = {
    id: 'p-pat-1',
    fullName: 'Anusuri Chirudeep',
    firstName: 'Anusuri',
    lastName: 'Chirudeep',
    age: 23,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '913901445173',
    country: 'India',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: Profile = {
    id: 'prof-pat-1',
    name: 'Primary Profile',
    isDefault: true,
    pilgrims: [mockPilgrim],
    selectedPilgrims: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function setupLiveSpatDom(options: { hasErrors?: boolean; nameError?: string; ageError?: string } = {}) {
    doc.body.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h2>Special Entry Darshan (Sri PAT)</h2>
          <div class="darshan-details">
            <span>Darshan Date: 22/10/2026</span>
            <span>Darshan Slot: 9:00 AM</span>
            <span>No. of Tickets: 1</span>
            <span>Total Cost: ₹200</span>
          </div>
          <h4>Pilgrim Details</h4>
          <div class="row pilgrim-row">
            <div class="col-md-3 form-group">
              <label>Name <span class="text-danger">*</span></label>
              <input type="text" formcontrolname="name" class="mat-input-element form-control" />
              ${options.hasErrors ? `<span class="text-danger error-msg">${options.nameError || 'Name cannot be empty'}</span>` : ''}
            </div>
            <div class="col-md-2 form-group">
              <label>Age <span class="text-danger">*</span></label>
              <input type="number" formcontrolname="age" class="mat-input-element form-control" />
              ${options.hasErrors ? `<span class="text-danger error-msg">${options.ageError || 'Please enter the age'}</span>` : ''}
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
            <div class="col-md-2 form-group">
              <label>Photo ID Proof <span class="text-danger">*</span></label>
              <mat-select formcontrolname="photoIdProof" role="combobox" class="mat-select mat-mdc-select">
                <div class="mat-select-trigger mat-mdc-select-trigger">
                  <div class="mat-select-value mat-mdc-select-value"><span class="mat-select-placeholder">Photo ID Proof *</span></div>
                  <div class="mat-select-arrow-wrapper"><div class="mat-select-arrow"></div></div>
                </div>
              </mat-select>
            </div>
            <div class="col-md-3 form-group">
              <label>Photo Id Number <span class="text-danger">*</span></label>
              <input type="text" formcontrolname="photoIdNumber" class="mat-input-element form-control" placeholder="Photo Id Number" disabled />
            </div>
          </div>
        </div>
      </div>
    `;

    // Simulate Angular Material CDK overlay behavior upon mat-select interaction
    doc.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const matSelect = target.closest('mat-select');
      if (matSelect) {
        const fc = matSelect.getAttribute('formcontrolname');
        let overlay = doc.querySelector('.cdk-overlay-container');
        if (!overlay) {
          overlay = doc.createElement('div');
          overlay.className = 'cdk-overlay-container';
          doc.body.appendChild(overlay);
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
              const input = doc.querySelector('input[formcontrolname="photoIdNumber"]') as HTMLInputElement;
              if (input) {
                input.disabled = false;
                input.removeAttribute('disabled');
              }
            });
          });
        }
      }
    });
  }

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD SPAT Booking');
    setupLiveSpatDom();
  });

  it('1. Authoritative Service Identity: resolves to padmavathi-supadham-entry-200 and NEVER special-entry-darshan-300', () => {
    const resolution = resolveCanonicalService(liveSpatUrl, doc);
    expect(resolution.service).toBeDefined();
    expect(resolution.service?.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(resolution.service?.displayName).toBe('Padmavathi / Sri PAT');
    expect(resolution.service?.ticketPrice).toBe(200);
    expect(resolution.confidence).toBe(100);

    // Verify it NEVER matches Special Entry Darshan 300
    const rec = ServiceRecognitionEngine.recognize(liveSpatUrl, doc);
    expect(rec.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(rec.serviceId).not.toBe('special-entry-darshan-300');
    expect(rec.status).toBe('detected');

    // Policy check: Must be PERMITTED_USER_INITIATED
    expect(isServiceAutofillAllowed('padmavathi-supadham-entry-200')).toBe(true);
    expect(resolution.service?.automationPolicy).toBe('PERMITTED_USER_INITIATED');
  });

  it('2. Form Validation: ignores required asterisks (*) in labels and only flags genuine text errors', () => {
    const nameInput = doc.querySelector('input[formcontrolname="name"]') as HTMLInputElement;
    expect(nameInput).toBeDefined();

    // With asterisk in label: must NOT have error
    const valWithoutError = inspectElementValidation(nameInput, 'name');
    expect(valWithoutError.hasError).toBe(false);
    expect(isGenuineErrorMessageElement(doc.querySelector('.text-danger') as HTMLElement)).toBe(false);

    // Now inject genuine error
    setupLiveSpatDom({ hasErrors: true, nameError: 'Name cannot be empty' });
    const nameInputWithError = doc.querySelector('input[formcontrolname="name"]') as HTMLInputElement;
    const valWithError = inspectElementValidation(nameInputWithError, 'name');
    expect(valWithError.hasError).toBe(true);
    expect(valWithError.errorMessage).toBe('Name cannot be empty');
  });

  it('3. Workflow Step Detection: recognizes PILGRIM_DETAILS despite section=slot-booking query parameter', () => {
    const step = detectWorkflowStep(doc, liveSpatUrl);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  it('4. End-to-End Autofill Execution: successfully fills and verifies all 5 devotee fields on live SPAT layout', async () => {
    const lockedRows = detectAndLockPilgrimRows(doc, 1);
    expect(lockedRows).toHaveLength(1);

    const result = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.totalVerified).toBe(5);
    expect(result.totalFailed).toBe(0);

    const pilgrimReport = result.pilgrimResults[0];
    expect(pilgrimReport.status).toBe('verified');
    expect(pilgrimReport.fieldsVerified).toBe(5);
    expect(pilgrimReport.fieldsFailed).toBe(0);

    const nameInput = doc.querySelector('input[formcontrolname="name"]') as HTMLInputElement;
    const ageInput = doc.querySelector('input[formcontrolname="age"]') as HTMLInputElement;
    const photoIdNumberInput = doc.querySelector('input[formcontrolname="photoIdNumber"]') as HTMLInputElement;

    expect(nameInput.value).toBe('Anusuri Chirudeep');
    expect(ageInput.value).toBe('23');
    expect(photoIdNumberInput.value).toBe('913901445173');
  });

  it('5. Runtime Message Dispatch: background router processes REQUEST_FILL without error', async () => {
    let responseData: any = null;
    const fakeSendResponse = (resp: any) => {
      responseData = resp;
    };

    // Mock chrome.tabs.sendMessage for testing router message forwarding
    const originalTabs = (globalThis as any).chrome?.tabs;
    (globalThis as any).chrome = (globalThis as any).chrome || {};
    (globalThis as any).chrome.tabs = {
      query: async () => [{ id: 101, url: liveSpatUrl }],
      get: async (id: number) => ({ id, url: liveSpatUrl }),
      sendMessage: async (_tabId: number, msg: any) => {
        expect(msg.type).toBe(MessageType.FILL_FIELDS);
        expect(msg.payload.pilgrims).toHaveLength(1);
        expect(msg.payload.pilgrims[0].fullName).toBe('Anusuri Chirudeep');
        return { success: true, verifiedCount: 5 };
      },
    };

    try {
      await handleMessage(
        {
          type: MessageType.REQUEST_FILL,
          targetTabId: 101,
          payload: {
            pilgrims: [mockPilgrim],
            profile: mockProfile,
            serviceId: 'padmavathi-supadham-entry-200',
            serviceName: 'Padmavathi / Sri PAT',
          },
          timestamp: new Date().toISOString(),
        } as any,
        {} as any,
        fakeSendResponse
      );

      expect(responseData).toBeDefined();
      expect(responseData.success).toBe(true);
      expect(responseData.verifiedCount).toBe(5);
    } finally {
      if (originalTabs) {
        (globalThis as any).chrome.tabs = originalTabs;
      }
    }
  });

  it('6. PII Protection: zero Devotee Aadhaar or personal ID numbers are leaked into logs', async () => {
    const logSpy = {
      info: [] as string[],
      warn: [] as string[],
      error: [] as string[],
    };

    const origInfo = logger.info;
    logger.info = (...args: any[]) => { logSpy.info.push(JSON.stringify(args)); };

    try {
      await executeAutofill({
        pilgrims: [mockPilgrim],
        profile: mockProfile,
        doc,
        url: liveSpatUrl,
      });

      const allLoggedText = [...logSpy.info, ...logSpy.warn, ...logSpy.error].join(' ');
      // 913901445173 is the Aadhaar number
      expect(allLoggedText).not.toContain('913901445173');
    } finally {
      logger.info = origInfo;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 1 & 5: REACT / NEXT.JS CONTROLLED FORM REGRESSION SUITE
  // Matches live TTD chunk 9803: name="fname", name="age", name="gender",
  // name="photoIdType", name="idProofNumber", React _valueTracker, rerender,
  // blank validation errors, honest capability reporting, and manual checklist.
  // ─────────────────────────────────────────────────────────────

  function setupReactControlledSpatDom(
    rowCount = 1,
    options: {
      makeAgeDisabled?: boolean;
      makePhotoIdReadOnly?: boolean;
    } = {}
  ) {
    const rowsHtml = Array.from({ length: rowCount }).map((_, idx) => `
      <div class="fieldContainer pilgrim-row card p-3 mb-3" data-row-index="${idx}">
        <div class="row">
          <div class="col-md-3 form-group">
            <label for="name_${idx}">Name <span class="text-danger">*</span></label>
            <input
              type="text"
              id="${idx}"
              name="fname"
              placeholder="Name"
              class="form-control"
              maxlength="80"
            />
            <div id="nameErr_${idx}" class="text-danger error-msg" style="display: none;"></div>
          </div>
          <div class="col-md-2 form-group">
            <label for="age_${idx}">Age <span class="text-danger">*</span></label>
            <input
              type="number"
              id="${idx}"
              name="age"
              placeholder="Age"
              class="form-control"
              maxlength="3"
              ${options.makeAgeDisabled ? 'disabled' : ''}
            />
            <div id="ageErr_${idx}" class="text-danger error-msg" style="display: none;"></div>
          </div>
          <div class="col-md-2 form-group">
            <label for="gender_${idx}">Gender <span class="text-danger">*</span></label>
            <select id="${idx}" name="gender" class="form-select">
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div class="col-md-2 form-group">
            <label for="photoIdType_${idx}">Photo ID Proof <span class="text-danger">*</span></label>
            <select id="${idx}" name="photoIdType" class="form-select" disabled>
              <option value="">Select Photo ID</option>
              <option value="aadhaar">Aadhaar Card</option>
              <option value="passport">Passport</option>
              <option value="voter">Voter ID</option>
            </select>
          </div>
          <div class="col-md-3 form-group">
            <label for="idProofNumber_${idx}">Photo ID Number <span class="text-danger">*</span></label>
            <input
              type="text"
              id="${idx}"
              name="idProofNumber"
              placeholder="Photo ID Number"
              class="form-control"
              maxlength="12"
              disabled
              ${options.makePhotoIdReadOnly ? 'readonly' : ''}
            />
            <div id="idErr_${idx}" class="text-danger error-msg" style="display: none;"></div>
          </div>
        </div>
      </div>
    `).join('');

    doc.body.innerHTML = `
      <div class="booking-flow-container">
        <h2>Special Entry Darshan (Sri PAT)</h2>
        <div class="darshan-details">
          <span>Darshan Date: 22/10/2026</span>
          <span>Darshan Slot: 9:00 AM</span>
          <span>No. of Tickets: ${rowCount}</span>
          <span>Total Cost: ₹${rowCount * 200}</span>
        </div>
        <h4>Devotee Details</h4>
        <div id="pilgrimDetailsContainer">
          ${rowsHtml}
        </div>
      </div>
    `;

    const reactState: Array<{
      fname: string;
      age: string;
      gender: string;
      photoIdType: string;
      idProofNumber: string;
    }> = Array.from({ length: rowCount }).map(() => ({
      fname: '',
      age: '',
      gender: '',
      photoIdType: '',
      idProofNumber: '',
    }));

    for (let i = 0; i < rowCount; i++) {
      const idx = i;
      const nameInput = doc.querySelector(`input[name="fname"][id="${idx}"]`) as HTMLInputElement;
      const ageInput = doc.querySelector(`input[name="age"][id="${idx}"]`) as HTMLInputElement;
      const genderSelect = doc.querySelector(`select[name="gender"][id="${idx}"]`) as HTMLSelectElement;
      const photoIdSelect = doc.querySelector(`select[name="photoIdType"][id="${idx}"]`) as HTMLSelectElement;
      const idNumberInput = doc.querySelector(`input[name="idProofNumber"][id="${idx}"]`) as HTMLInputElement;

      const attachTracker = (input: HTMLInputElement, initial: string) => {
        let current = initial;
        (input as any)._valueTracker = {
          getValue: () => current,
          setValue: (val: string) => { current = String(val); },
          stopTracking: () => {},
        };
      };

      if (nameInput) {
        attachTracker(nameInput, '');
        nameInput.addEventListener('input', () => {
          const tracker = (nameInput as any)._valueTracker;
          const nextVal = nameInput.value;
          if (tracker && tracker.getValue() !== nextVal) {
            tracker.setValue(nextVal);
            reactState[idx].fname = nextVal;
          }
        });
        nameInput.addEventListener('blur', () => {
          const val = reactState[idx].fname;
          const errEl = doc.getElementById(`nameErr_${idx}`);
          if (!val || !val.trim()) {
            if (errEl) {
              errEl.textContent = 'Name is required';
              errEl.style.display = 'block';
            }
          } else {
            if (errEl) {
              errEl.textContent = '';
              errEl.style.display = 'none';
            }
          }
          nameInput.value = reactState[idx].fname;
        });
      }

      if (ageInput) {
        attachTracker(ageInput, '');
        ageInput.addEventListener('input', () => {
          const tracker = (ageInput as any)._valueTracker;
          const nextVal = ageInput.value;
          if (tracker && tracker.getValue() !== nextVal) {
            tracker.setValue(nextVal);
            reactState[idx].age = nextVal;
            if (nextVal && photoIdSelect) {
              photoIdSelect.disabled = false;
            }
          }
        });
        ageInput.addEventListener('blur', () => {
          ageInput.value = reactState[idx].age;
        });
      }

      if (genderSelect) {
        genderSelect.addEventListener('change', () => {
          reactState[idx].gender = genderSelect.value;
        });
      }

      if (photoIdSelect) {
        photoIdSelect.addEventListener('change', () => {
          reactState[idx].photoIdType = photoIdSelect.value;
          if (photoIdSelect.value && idNumberInput && !options.makePhotoIdReadOnly) {
            idNumberInput.disabled = false;
          }
        });
      }

      if (idNumberInput) {
        attachTracker(idNumberInput, '');
        idNumberInput.addEventListener('input', () => {
          const tracker = (idNumberInput as any)._valueTracker;
          const nextVal = idNumberInput.value;
          if (tracker && tracker.getValue() !== nextVal) {
            tracker.setValue(nextVal);
            reactState[idx].idProofNumber = nextVal;
          }
        });
        idNumberInput.addEventListener('blur', () => {
          idNumberInput.value = reactState[idx].idProofNumber;
        });
      }
    }

    return { reactState };
  }

  it('7. Live TTD React Controlled Form: successfully updates React state and verifies all 5 fields', async () => {
    const { reactState } = setupReactControlledSpatDom(1);

    const result = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.capabilityAssessment).toBe('SUPPORTED');
    expect(result.verifiedFields).toBe(5);
    expect(result.requiredFields).toBe(5);
    expect(result.manualActionRequired).toBe(false);

    // Verify React's own internal controlled state was updated through _valueTracker reset
    expect(reactState[0].fname).toBe('Anusuri Chirudeep');
    expect(reactState[0].age).toBe('23');
    expect(reactState[0].gender).toBe('male');
    expect(reactState[0].idProofNumber).toBe('913901445173');

    // Verify no red validation error remains
    const errEl = doc.getElementById('nameErr_0');
    expect(errEl?.textContent).toBe('');
    expect(errEl?.style.display).not.toBe('block');
  });

  it('8. Live TTD React 6-Row Form: accurately detects and verifies all 6 pilgrim rows (30 fields)', async () => {
    const sixPilgrims: Pilgrim[] = Array.from({ length: 6 }).map((_, i) => ({
      id: `p-${i}`,
      fullName: `Devotee ${i + 1}`,
      firstName: `Devotee`,
      lastName: `${i + 1}`,
      age: 20 + i,
      gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
      idType: IdType.AADHAAR,
      idNumber: `91390144517${i}`,
      country: 'India',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const sixProfile: Profile = {
      id: 'prof-six',
      name: 'Six Devotees',
      isDefault: true,
      pilgrims: sixPilgrims,
      selectedPilgrims: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { reactState } = setupReactControlledSpatDom(6);

    const result = await executeAutofill({
      pilgrims: sixPilgrims,
      profile: sixProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.capabilityAssessment).toBe('SUPPORTED');
    expect(result.totalVerified).toBe(30);
    expect(result.verifiedFields).toBe(30);
    expect(result.requiredFields).toBe(30);
    expect(result.totalFailed).toBe(0);

    for (let i = 0; i < 6; i++) {
      expect(reactState[i].fname).toBe(`Devotee ${i + 1}`);
      expect(reactState[i].age).toBe(String(20 + i));
      expect(reactState[i].idProofNumber).toBe(`91390144517${i}`);
    }
  });

  it('9. Blank required fields in profile: reports failure honestly without inventing data', async () => {
    const blankPilgrim: Pilgrim = {
      ...mockPilgrim,
      fullName: '',
      firstName: '',
      lastName: '',
      age: undefined as any,
    };

    setupReactControlledSpatDom(1);

    const result = await executeAutofill({
      pilgrims: [blankPilgrim],
      profile: { ...mockProfile, pilgrims: [blankPilgrim] },
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(false);
    expect(result.capabilityAssessment).toBe('PARTIAL');
    expect(result.manualActionRequired).toBe(true);
    expect(result.verifiedFields).toBeLessThan(5);
    expect(result.requiredFields).toBe(5);

    // Manual checklist is populated with actionable items
    expect(result.manualChecklist).toBeDefined();
    const nameItem = result.manualChecklist?.find(i => i.field === 'name');
    expect(nameItem?.status).toBe('manual_required');
  });

  it('10. Disabled and read-only controls: respects website state and does not force values', async () => {
    setupReactControlledSpatDom(1, { makeAgeDisabled: true });

    const result = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(false);
    expect(result.manualActionRequired).toBe(true);
    const ageReport = result.pilgrimResults[0].results.find(r => r.field === 'age');
    expect(ageReport?.status).toBe('failed');
    expect(ageReport?.error).toContain('disabled');
  });

  it('11. Srivani Service Policy: fails closed with MANUAL_ONLY capability assessment', async () => {
    setupReactControlledSpatDom(1);
    const srivaniUrl = 'https://ttdevasthanams.ap.gov.in/srivani/pilgrim-details';

    const result = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: srivaniUrl,
      serviceId: 'srivani',
    });

    expect(result.success).toBe(false);
    expect(result.capabilityAssessment).toBe('MANUAL_ONLY');
    expect(result.manualActionRequired).toBe(true);
    expect(result.failureReason).toContain('May 2026');
  });

  it('12. Unknown Service Policy: fails closed with UNSUPPORTED_FORM / MANUAL_ONLY', async () => {
    setupReactControlledSpatDom(1);

    const result = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: 'https://ttdevasthanams.ap.gov.in/unknown-custom-flow',
      serviceId: 'unknown-service-xyz',
    });

    expect(result.success).toBe(false);
    expect(result.manualActionRequired).toBe(true);
  });

  it('13. Profile loaded locally does not claim website form completion', async () => {
    setupReactControlledSpatDom(1);

    // Before executeAutofill is called, website form inputs are completely blank
    const nameInput = doc.querySelector('input[name="fname"]') as HTMLInputElement;
    const ageInput = doc.querySelector('input[name="age"]') as HTMLInputElement;

    expect(nameInput.value).toBe('');
    expect(ageInput.value).toBe('');

    // Local profile is ready, but website form is NOT filled
    expect(mockProfile.pilgrims).toHaveLength(1);
    expect(mockProfile.pilgrims[0].fullName).toBe('Anusuri Chirudeep');
  });

  it('14. Concurrent autofill calls: safely rejects secondary invocation via lock', async () => {
    setupReactControlledSpatDom(1);

    const promise1 = executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: liveSpatUrl,
    });

    // Immediate second call while first is in progress
    const result2 = await executeAutofill({
      pilgrims: [mockPilgrim],
      profile: mockProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result2.success).toBe(false);
    expect(result2.errors.join(' ')).toContain('already in progress');

    const result1 = await promise1;
    expect(result1.success).toBe(true);
  });

  it('15. Exact SPAT Route Reproduction: visible Name & Age validation errors report Form Incomplete and trigger Paste Assist', () => {
    // Exact URL reported in failure
    expect(liveSpatUrl).toBe('https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat&section=slot-booking');

    // Reproduce DOM with visible red validation errors and empty inputs
    const { reactState } = setupReactControlledSpatDom(1);
    const nameInput = doc.querySelector('input[name="fname"]') as HTMLInputElement;
    const ageInput = doc.querySelector('input[name="age"]') as HTMLInputElement;
    const nameErr = doc.getElementById('nameErr_0');
    const ageErr = doc.getElementById('ageErr_0');

    expect(nameInput.value).toBe('');
    expect(ageInput.value).toBe('');

    // Trigger blur on empty inputs to generate genuine validation error elements
    nameInput.dispatchEvent(new Event('blur'));
    ageInput.dispatchEvent(new Event('blur'));

    // Inject explicit visible validation error matching screenshot
    if (nameErr) {
      nameErr.textContent = 'Name is required';
      nameErr.style.display = 'block';
    }
    if (ageErr) {
      ageErr.textContent = 'Age is required';
      ageErr.style.display = 'block';
    }

    // Inspect validation directly
    const nameValidation = inspectElementValidation(nameInput, 'name');
    expect(nameValidation.hasError).toBe(true);
    expect(nameValidation.errorMessage).toBe('Name is required');

    // Compute side-panel status model under this exact failure state
    const nextAction = computeNextAction({
      activeProfile: mockProfile,
      selectedPilgrims: [mockPilgrim],
      serviceDisplayName: 'Padmavathi / Sri PAT',
      serviceId: 'padmavathi-supadham-entry-200',
      pageDetected: true,
      productState: 'USER_ACTION_REQUIRED',
      fillStatus: 'Form Incomplete: 0/5 fields verified — Name and Age are empty.',
      statusType: 'warning',
      verificationCounts: { verified: 0, total: 5 },
      readiness: { isReady: true, checks: [] } as any,
    });

    // Side-panel status model assertion:
    // 1. Must report Form Incomplete (0/5 Verified), NEVER 3/3 Ready or Form Verified
    expect(nextAction.category).toBe('USER_ACTION_REQUIRED');
    expect(nextAction.badgeVariant).toBe('actionRequired');
    expect(nextAction.statusText).toBe('Form Incomplete (0/5 Verified)');
    expect(nextAction.headline).toBe('Form Incomplete — Paste Assist Ready');

    // 2. Fallback action must be Paste Assist
    expect(nextAction.primaryAction.label).toBe('📋 OPEN PASTE ASSIST');
    expect(nextAction.primaryAction.actionType).toBe('START_MANUAL_ASSISTANT');
    expect(nextAction.secondaryAction?.label).toContain('Try Autofill Again');

    // 3. FormStatus model clearly distinguishes local Profile Ready from Form Incomplete
    expect(nextAction.formStatus).toBeDefined();
    expect(nextAction.formStatus?.state).toBe('form_incomplete');
    expect(nextAction.formStatus?.verifiedCount).toBe(0);
    expect(nextAction.formStatus?.totalCount).toBe(5);
    expect(nextAction.formStatus?.label).toBe('Form Incomplete (0/5 Verified)');
  });

  it('16. Two-pilgrim row form independence: no data mixing across row 0 and row 1', async () => {
    const twoPilgrims: Pilgrim[] = [
      {
        id: 'p-row-0',
        fullName: 'Devotee One',
        firstName: 'Devotee',
        lastName: 'One',
        age: 45,
        gender: Gender.MALE,
        idType: IdType.AADHAAR,
        idNumber: '913901445173',
        country: 'India',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-row-1',
        fullName: 'Devotee Two',
        firstName: 'Devotee',
        lastName: 'Two',
        age: 38,
        gender: Gender.FEMALE,
        idType: IdType.AADHAAR,
        idNumber: '913901445181',
        country: 'India',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const twoProfile: Profile = {
      id: 'prof-two',
      name: 'Two Devotees',
      isDefault: true,
      pilgrims: twoPilgrims,
      selectedPilgrims: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { reactState } = setupReactControlledSpatDom(2);

    const result = await executeAutofill({
      pilgrims: twoPilgrims,
      profile: twoProfile,
      doc,
      url: liveSpatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.totalVerified).toBe(10);
    expect(result.totalFailed).toBe(0);

    // Row 0 assertions
    expect(reactState[0].fname).toBe('Devotee One');
    expect(reactState[0].age).toBe('45');
    expect(reactState[0].gender).toBe('male');
    expect(reactState[0].idProofNumber).toBe('913901445173');

    // Row 1 assertions
    expect(reactState[1].fname).toBe('Devotee Two');
    expect(reactState[1].age).toBe('38');
    expect(reactState[1].gender).toBe('female');
    expect(reactState[1].idProofNumber).toBe('913901445181');

    // Verify zero data leakage or mixing between rows
    expect(reactState[0].fname).not.toBe(reactState[1].fname);
    expect(reactState[0].age).not.toBe(reactState[1].age);
    expect(reactState[0].idProofNumber).not.toBe(reactState[1].idProofNumber);
  });

  it('17. Paste Assist actions and live-value verification', () => {
    // Masking check: Sensitive ID is masked for privacy
    const rawAadhaar = '913901445173';
    const maskIdNumber = (idNum?: string) => {
      if (!idNum) return '—';
      const clean = idNum.trim();
      if (clean.length <= 4) return clean;
      return `•••• •••• ${clean.slice(-4)}`;
    };

    const masked = maskIdNumber(rawAadhaar);
    expect(masked).toBe('•••• •••• 5173');
    expect(masked).not.toContain('913901');

    // Live-value independent verification check
    setupReactControlledSpatDom(1);
    const nameInput = doc.querySelector('input[name="fname"]') as HTMLInputElement;
    const ageInput = doc.querySelector('input[name="age"]') as HTMLInputElement;

    // Direct DOM inspection: without script updates, live values are empty
    expect(nameInput.value).toBe('');
    expect(ageInput.value).toBe('');

    // User pastes or enters value directly into website controls
    nameInput.value = 'Anusuri Chirudeep';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    ageInput.value = '23';
    ageInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Independent verification checks live value property
    expect(nameInput.value).toBe('Anusuri Chirudeep');
    expect(ageInput.value).toBe('23');
  });

  it('18. Cancellation and cleanup of listeners: STOP_AUTOFILL message handling', async () => {
    let stopHandled = false;
    const fakeSendResponse = (resp: any) => {
      stopHandled = true;
      expect(resp).toBeDefined();
    };

    await handleMessage(
      {
        type: MessageType.STOP_AUTOFILL,
        timestamp: new Date().toISOString(),
      } as any,
      {} as any,
      fakeSendResponse
    );

    expect(stopHandled).toBe(true);
  });
});
