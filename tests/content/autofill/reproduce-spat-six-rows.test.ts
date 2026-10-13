// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeAutofill } from '../../../src/content/autofill/autofill-manager';
import { detectWorkflowStep } from '../../../src/content/autofill/page-workflow';
import { detectAndLockPilgrimRows } from '../../../src/content/autofill/row-detector';
import { detectSlotSelection, detectPilgrimDetails } from '../../../src/services/workflows/step-detectors';
import { ServiceRecognitionEngine } from '../../../src/services/service-recognition-engine';
import { resolveCanonicalService, isServiceAutofillAllowed } from '../../../src/services/canonical-service-registry';
import { bookingSessionManager } from '../../../src/content/autofill/booking-session';
import { handleMessage } from '../../../src/background/message-router';
import { Gender, IdType, MessageType, type Pilgrim, type Profile } from '../../../src/shared/types';
import logger from '../../../src/shared/logger';

describe('SPAT 6-Row Pilgrim Autofill Regression Suite', () => {
  let doc: Document;
  const spatUrl = 'https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat&section=slot-booking';

  const mockPilgrims: Pilgrim[] = [
    { id: 'p1', fullName: 'Pilgrim One', firstName: 'Pilgrim', lastName: 'One', age: 35, gender: Gender.MALE, idType: IdType.AADHAAR, idNumber: '999999990019', mobile: '9876543210', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p2', fullName: 'Pilgrim Two', firstName: 'Pilgrim', lastName: 'Two', age: 32, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '999999990020', mobile: '9876543211', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p3', fullName: 'Pilgrim Three', firstName: 'Pilgrim', lastName: 'Three', age: 60, gender: Gender.MALE, idType: IdType.AADHAAR, idNumber: '999999990021', mobile: '9876543212', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p4', fullName: 'Pilgrim Four', firstName: 'Pilgrim', lastName: 'Four', age: 58, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '999999990022', mobile: '9876543213', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p5', fullName: 'Pilgrim Five', firstName: 'Pilgrim', lastName: 'Five', age: 25, gender: Gender.MALE, idType: IdType.AADHAAR, idNumber: '999999990023', mobile: '9876543214', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p6', fullName: 'Pilgrim Six', firstName: 'Pilgrim', lastName: 'Six', age: 22, gender: Gender.FEMALE, idType: IdType.AADHAAR, idNumber: '999999990024', mobile: '9876543215', country: 'India', createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const mockProfile: Profile = {
    id: 'prof-1',
    name: 'Family Profile',
    isDefault: true,
    pilgrims: mockPilgrims,
    selectedPilgrims: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD SPAT Booking');
    bookingSessionManager.reset();
  });

  function createSixRowFormHtml(options: {
    hasStaleSlotText?: boolean;
    headerTitle?: string;
    omitFieldRowIndex?: number;
    omitFieldKey?: string;
  } = {}): string {
    const { hasStaleSlotText = true, headerTitle = 'Pilgrim Details', omitFieldRowIndex, omitFieldKey } = options;

    const rowsHtml = [0, 1, 2, 3, 4, 5].map(i => `
      <div class="pilgrim-row" id="pilgrim-row-${i}">
        <h3>Pilgrim ${i + 1}</h3>
        <div class="form-field-group">
          <label for="name_${i}">Name as per Photo ID *</label>
          <input type="text" id="name_${i}" name="name_${i}" formcontrolname="name" class="ng-invalid ng-touched" />
          <span class="error-msg mat-error">Name is required</span>
        </div>
        <div class="form-field-group">
          <label for="age_${i}">Age *</label>
          <input type="number" id="age_${i}" name="age_${i}" formcontrolname="age" class="ng-invalid ng-touched" />
          <span class="error-msg mat-error">Age is required</span>
        </div>
        <div class="form-field-group">
          <label for="gender_${i}">Gender *</label>
          <select id="gender_${i}" name="gender_${i}" formcontrolname="gender" class="ng-invalid ng-touched">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <span class="error-msg mat-error">Gender is required</span>
        </div>
        <div class="form-field-group">
          <label for="idProof_${i}">Photo ID Proof *</label>
          <select id="idProof_${i}" name="idProof_${i}" formcontrolname="idProof" class="ng-invalid ng-touched">
            <option value="">Select ID Proof</option>
            <option value="Aadhaar">Aadhaar</option>
            <option value="Passport">Passport</option>
          </select>
          <span class="error-msg mat-error">Photo ID Proof is required</span>
        </div>
        ${omitFieldRowIndex === i && omitFieldKey === 'idNumber' ? '' : `
        <div class="form-field-group">
          <label for="idNumber_${i}">Photo ID Number *</label>
          <input type="text" id="idNumber_${i}" name="idNumber_${i}" formcontrolname="idNumber" class="ng-invalid ng-touched" />
          <span class="error-msg mat-error">Photo ID Number is required</span>
        </div>
        `}
      </div>
    `).join('\n');

    return `
      <div class="booking-flow-container">
        <h1>${headerTitle}</h1>
        ${hasStaleSlotText ? '<div class="slot-info-badge">Time Slot: 10:00 AM (Slot Selection Confirmed)</div>' : ''}
        <form id="pilgrimForm">
          ${rowsHtml}
          <div class="actions">
            <button type="submit" id="btnContinue">Continue</button>
          </div>
        </form>
      </div>
    `;
  }

  // 1. Service Detection
  it('1. correctly identifies SPAT service from canonical registry and recognition engine', () => {
    doc.body.innerHTML = createSixRowFormHtml();
    const resolution = resolveCanonicalService(spatUrl, doc);
    expect(resolution.service).toBeDefined();
    expect(resolution.service?.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(resolution.service?.displayName).toBe('Padmavathi / Sri PAT');
    expect(resolution.confidence).toBe(100);

    const recognition = ServiceRecognitionEngine.recognize(spatUrl, doc);
    expect(recognition.status).toBe('detected');
    expect(recognition.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(recognition.serviceName).toBe('Padmavathi / Sri PAT');
  });

  // 2. Unknown service fail-closed
  it('2. fails closed when page exhibits explicit unknown/unconfirmed service marker', () => {
    doc.body.innerHTML = `
      <div data-service="unknown" data-service-id="unconfirmed-service">
        <h1>Unconfirmed Service Portal</h1>
      </div>
    ` + createSixRowFormHtml();

    const resolution = resolveCanonicalService(spatUrl, doc);
    expect(resolution.isUncertain).toBe(true);
    expect(resolution.service?.automationPolicy).toBe('UNCONFIRMED_FAIL_CLOSED');
    expect(isServiceAutofillAllowed('unknown-service')).toBe(false);

    const recognition = ServiceRecognitionEngine.recognize(spatUrl, doc);
    expect(recognition.status).toBe('uncertain');
    expect(recognition.serviceId).toBe('unknown-service');
  });

  // 3. Workflow step detection despite stale section=slot-booking
  it('3. detects PILGRIM_DETAILS step despite stale section=slot-booking URL parameter', () => {
    doc.body.innerHTML = createSixRowFormHtml({ hasStaleSlotText: true });

    // Step detector directly
    const slotStep = detectSlotSelection(doc, spatUrl);
    expect(slotStep.isCurrentStep).toBe(false);
    expect(slotStep.confidence).toBe(0);

    const pilgrimStep = detectPilgrimDetails(doc, spatUrl);
    expect(pilgrimStep.isCurrentStep).toBe(true);
    expect(pilgrimStep.confidence).toBeGreaterThanOrEqual(40);

    // Full workflow detector
    const step = detectWorkflowStep(doc, spatUrl);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  // 4. Six-row field resolution and autofill
  it('4. detects all 6 pilgrim rows and fills and verifies all 30 fields', async () => {
    doc.body.innerHTML = createSixRowFormHtml();

    const lockedRows = detectAndLockPilgrimRows(doc, 6);
    expect(lockedRows).toHaveLength(6);

    const result = await executeAutofill({
      pilgrims: mockPilgrims,
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe('COMPLETE');
    expect(result.step).toBe('pilgrim');
    expect(result.totalVerified).toBe(30);
    expect(result.totalFailed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify DOM inputs actually contain values
    for (let i = 0; i < 6; i++) {
      const nameInput = doc.getElementById(`name_${i}`) as HTMLInputElement;
      const ageInput = doc.getElementById(`age_${i}`) as HTMLInputElement;
      const genderSelect = doc.getElementById(`gender_${i}`) as HTMLSelectElement;
      const idProofSelect = doc.getElementById(`idProof_${i}`) as HTMLSelectElement;
      const idNumberInput = doc.getElementById(`idNumber_${i}`) as HTMLInputElement;

      expect(nameInput.value).toBe(mockPilgrims[i].fullName);
      expect(ageInput.value).toBe(String(mockPilgrims[i].age));
      expect(genderSelect.value).toBe(mockPilgrims[i].gender);
      expect(idProofSelect.value).toBe('Aadhaar');
      expect(idNumberInput.value).toBe(mockPilgrims[i].idNumber);
    }
  }, 30000);

  // 5. Missing or unmapped fields with clear failure reporting
  it('5. handles missing field in row 2 with accurate failure reporting without inventing data', async () => {
    // Omit idNumber in row 2
    doc.body.innerHTML = createSixRowFormHtml({ omitFieldRowIndex: 2, omitFieldKey: 'idNumber' });

    const result = await executeAutofill({
      pilgrims: mockPilgrims,
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    expect(result.success).toBe(false);
    expect(result.totalVerified).toBe(29);
    expect(result.totalFailed).toBe(1);
    expect(result.failedItems).toHaveLength(1);
    expect(result.failedItems[0].field).toBe('photoIdNumber');
    expect(result.failedItems[0].pilgrimIndex).toBe(2);
  }, 30000);

  // 6. Preservation of user-edited values
  it('6. preserves manually modified user values and never overwrites them silently', async () => {
    doc.body.innerHTML = createSixRowFormHtml();

    // Emulate human user typing manual age for Pilgrim 1
    const age0 = doc.getElementById('age_0') as HTMLInputElement;
    age0.value = '42';
    bookingSessionManager.recordUserModifiedField('age_0', 0);
    bookingSessionManager.recordUserModifiedField('age', 0);

    const result = await executeAutofill({
      pilgrims: mockPilgrims,
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    expect(result.success).toBe(true);
    // age0 must stay 42 (not overwritten with profile's 35)
    expect(age0.value).toBe('42');
  }, 30000);

  // 7. Respect disabled / readOnly controls
  it('7. respects disabled and readOnly controls and does not force values', async () => {
    doc.body.innerHTML = createSixRowFormHtml();

    const name0 = doc.getElementById('name_0') as HTMLInputElement;
    name0.disabled = true;

    const result = await executeAutofill({
      pilgrims: [mockPilgrims[0]],
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    expect(result.success).toBe(false);
    expect(result.failedItems.some(f => f.field === 'name' && f.pilgrimIndex === 0)).toBe(true);
  }, 30000);

  // 8. No PII in logs
  it('8. logs safe diagnostic evidence without emitting Devotee PII', async () => {
    const loggedMessages: string[] = [];
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation((...args) => {
      loggedMessages.push(args.map(a => String(a)).join(' '));
    });
    const debugSpy = vi.spyOn(logger, 'debug').mockImplementation((...args) => {
      loggedMessages.push(args.map(a => String(a)).join(' '));
    });

    doc.body.innerHTML = createSixRowFormHtml();
    await executeAutofill({
      pilgrims: mockPilgrims,
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    infoSpy.mockRestore();
    debugSpy.mockRestore();

    // Verify PII (full names, 12-digit aadhaar numbers, mobile numbers) are not leaked
    for (const msg of loggedMessages) {
      expect(msg).not.toContain('999999990019');
      expect(msg).not.toContain('9876543210');
      expect(msg).not.toContain('Pilgrim One');
    }
  }, 30000);

  // 9. Messaging from popup/sidepanel via message router
  it('9. routes REQUEST_FILL message to active TTD tab properly', async () => {
    const tabsMap = new Map<number, any>();
    const sentMessages: Array<{ tabId: number; message: any }> = [];

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        query: vi.fn(async (queryInfo: any) => {
          if (queryInfo.active) {
            return [{ id: 404, url: spatUrl, active: true }];
          }
          return [];
        }),
        get: vi.fn(async (tabId: number) => ({ id: tabId, url: spatUrl })),
        sendMessage: vi.fn(async (tabId: number, msg: any) => {
          sentMessages.push({ tabId, message: msg });
          return { success: true, data: [] };
        }),
      },
      runtime: {
        getManifest: () => ({ content_scripts: [] }),
        sendMessage: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    };

    let responseResult: any = null;
    await handleMessage(
      {
        type: MessageType.REQUEST_FILL,
        payload: {
          pilgrims: mockPilgrims,
          profile: mockProfile,
        },
        timestamp: new Date().toISOString(),
      } as any,
      {} as any,
      (res) => { responseResult = res; }
    );

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].tabId).toBe(404);
    expect(sentMessages[0].message.type).toBe(MessageType.FILL_FIELDS);
    expect(sentMessages[0].message.payload.pilgrims).toHaveLength(6);
    expect(responseResult?.success).toBe(true);
  });

  // 10. Empty fill reporting
  it('10. reports clear failure when no fields are filled or form is empty', async () => {
    doc.body.innerHTML = '<div class="empty-page"><h1>Nothing Here</h1></div>';

    const result = await executeAutofill({
      pilgrims: mockPilgrims,
      profile: mockProfile,
      doc,
      url: spatUrl,
    });

    expect(result.success).toBe(false);
    expect(result.totalVerified).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/Pilgrim fields could not be safely identified|Form fields could not be safely identified|TTD form structure has changed/);
  });
});
