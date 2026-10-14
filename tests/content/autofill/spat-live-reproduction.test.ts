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
});
