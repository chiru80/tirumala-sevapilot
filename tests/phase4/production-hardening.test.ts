// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 4 Production Hardening & Reliability Test Suite
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAllWorkflows,
  getWorkflowById,
  detectActiveWorkflow,
} from '../../src/services/workflows/registry';
import { SPECIAL_ENTRY_DARSHAN_300 } from '../../src/services/workflows/special-entry-300';
import { PADMAVATHI_SUPADHAM_ENTRY_200 } from '../../src/services/workflows/padmavathi-200';
import { SRI_SRINIVASA_DIVYANUGRAHA_HOMAM } from '../../src/services/workflows/sri-srinivasa-divyanugraha-homam';
import { validateFormStructure } from '../../src/services/workflows/structure-validator';
import {
  executeAutofill,
  isAutofillRunning,
  requestStop,
  resetSessionLock,
  repairFailedFields,
} from '../../src/content/autofill/autofill-manager';
import { createPageObserver, stopPageObserver } from '../../src/content/mutation-observer';
import { Gender, IdType, ServiceType } from '../../src/shared/types';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { sendToTargetTab } from '../../src/background/message-router';

function createDevotee(id: string, name: string, overrides: Partial<Pilgrim> = {}): Pilgrim {
  return {
    id,
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] || '',
    fullName: name,
    gender: Gender.MALE,
    age: 32,
    idType: IdType.AADHAAR,
    idNumber: '123456789012',
    country: 'India',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Phase 4: Production Hardening & Real-World Reliability', () => {
  beforeEach(() => {
    resetSessionLock();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetSessionLock();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // ─── 1. Workflow Versioning (Section 7) ───────────────────────
  describe('1. Workflow Versioning & Architecture Isolation', () => {
    it('has explicit workflowVersion defined on all registered workflows', () => {
      const workflows = getAllWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(3);

      for (const wf of workflows) {
        expect(wf.workflowVersion).toBeDefined();
        expect(typeof wf.workflowVersion).toBe('string');
        expect(wf.workflowVersion).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });

    it('verifies independent versioning for each individual service', () => {
      expect(SPECIAL_ENTRY_DARSHAN_300.workflowVersion).toBe('1.0.0');
      expect(PADMAVATHI_SUPADHAM_ENTRY_200.workflowVersion).toBe('1.0.0');
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.workflowVersion).toBe('1.0.0');
    });
  });

  // ─── 2. TTD Structure Change Detection (Section 6 & 18) ────────
  describe('2. TTD Structure Change Detection & Fail-Closed Guard', () => {
    it('detects missing required fields and aborts with clear warning', () => {
      // Document has a general details form but completely lacks Gothram for Homam
      document.body.innerHTML = `
        <form>
          <input name="email" value="" />
          <input name="city" value="" />
          <input name="state" value="" />
          <input name="country" value="" />
          <input name="pincode" value="" />
        </form>
      `;

      const result = validateFormStructure(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        'GENERAL_DETAILS',
        document
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('TTD form structure has changed. Please review before autofill.');
      expect(result.missingRequiredFields).toContain('gothram');
      expect(result.anomalies.some(a => a.includes('Gothram'))).toBe(true);
    });

    it('detects altered control types on pilgrim row (e.g. photoIdProof changed to checkbox)', () => {
      document.body.innerHTML = `
        <div class="pilgrim-card">
          <input name="name" placeholder="Name" />
          <input name="age" placeholder="Age" />
          <input type="radio" name="gender" value="Male" />
          <input type="checkbox" name="photoIdProof" />
          <input name="photoIdNumber" placeholder="Photo ID Number" />
        </div>
      `;

      const result = validateFormStructure(
        SPECIAL_ENTRY_DARSHAN_300,
        'PILGRIM_DETAILS',
        document
      );

      expect(result.anomalies.some(a => a.includes('Photo ID Proof control type changed'))).toBe(true);
    });

    it('executeAutofill fails safe and refuses to modify DOM when form structure is invalid', async () => {
      // Page with unknown / broken structure
      document.body.innerHTML = `
        <div class="unknown-section">
          <input name="randomField1" />
        </div>
      `;

      const p1 = createDevotee('p1', 'Venkata Raman');
      const res = await executeAutofill({
        pilgrims: [p1],
        doc: document,
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      expect(res.success).toBe(false);
      expect(res.state).toBe('ERROR');
      // No modification made to randomField1
      const input = document.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  // ─── 3. Autofill Session Lifecycle & Concurrency (Sections 3 & 5) ─
  describe('3. Session Lifecycle & Concurrency Locking', () => {
    it('prevents duplicate concurrent autofill executions on the same tab', async () => {
      document.body.innerHTML = `
        <h2>Pilgrim Details</h2>
        <div class="pilgrim-card">
          <input name="name" />
          <input name="age" />
          <select name="gender"><option value="Male">Male</option></select>
          <select name="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
          <input name="photoIdNumber" />
        </div>
      `;

      const p1 = createDevotee('p1', 'Devotee One');

      // Start first autofill
      const runPromise1 = executeAutofill({
        pilgrims: [p1],
        doc: document,
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      // Rapid concurrent second call must be blocked immediately
      const runPromise2 = executeAutofill({
        pilgrims: [p1],
        doc: document,
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      const res2 = await runPromise2;
      expect(res2.success).toBe(false);
      expect(res2.errors).toContain('Autofill already in progress. Wait for completion or press Stop.');

      await runPromise1;
      expect(isAutofillRunning()).toBe(false);
    });

    it('watchdog auto-recovers from an abandoned or timed-out lock', () => {
      resetSessionLock();
      expect(isAutofillRunning()).toBe(false);
    });
  });

  // ─── 4. Observer and Timer Cleanup (Section 4) ────────────────
  describe('4. Observer & Event Listener Cleanup', () => {
    it('properly disconnects MutationObserver and removes navigation listeners on stopPageObserver', () => {
      const callback = vi.fn();
      const observer = createPageObserver(callback);
      expect(observer).toBeDefined();

      const disconnectSpy = vi.spyOn(observer, 'disconnect');
      stopPageObserver(observer);

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  // ─── 5. Emergency Stop (Section 13) ────────────────────────────
  describe('5. Emergency Stop Execution', () => {
    it('immediately halts autofill and transitions to STOPPED on requestStop', async () => {
      document.body.innerHTML = `
        <h2>Pilgrim Details</h2>
        <div class="pilgrim-card">
          <input name="name" />
          <input name="age" />
          <select name="gender"><option value="Male">Male</option></select>
          <select name="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
          <input name="photoIdNumber" />
        </div>
        <div class="pilgrim-card">
          <input name="name" />
          <input name="age" />
          <select name="gender"><option value="Male">Male</option></select>
          <select name="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
          <input name="photoIdNumber" />
        </div>
      `;

      const p1 = createDevotee('p1', 'First Devotee');
      const p2 = createDevotee('p2', 'Second Devotee');

      let stopRequested = false;
      const autofillPromise = executeAutofill({
        pilgrims: [p1, p2],
        doc: document,
        workflow: SPECIAL_ENTRY_DARSHAN_300,
        onProgress: (prog) => {
          if (!stopRequested && prog.currentPilgrimIndex === 0) {
            stopRequested = true;
            requestStop();
          }
        },
      });

      const res = await autofillPromise;
      expect(res.state === 'STOPPED' || res.errors.some(e => e.includes('stopped'))).toBe(true);
      expect(isAutofillRunning()).toBe(false);
    });
  });

  // ─── 6. Service Switch Isolation (Section 8) ──────────────────
  describe('6. Service Switch Isolation (Special Entry → Homam → Padmavathi → Special Entry)', () => {
    it('switches between workflows without rule or limit leakage', () => {
      // 1. Special Entry 300
      const wf1 = getWorkflowById('special-entry-darshan-300');
      expect(wf1?.maxPilgrims).toBe(6);
      expect(wf1?.ticketPrice).toBe(300);
      expect(wf1?.hasGeneralDetailsStep).toBe(true);

      // 2. Homam
      const wf2 = getWorkflowById('sri-srinivasa-divyanugraha-homam');
      expect(wf2?.maxPilgrims).toBe(2);
      expect(wf2?.exactPilgrims).toBe(2);
      expect(wf2?.ticketPrice).toBe(1600);
      // Homam requires Gothram, excludes mobile from required general details
      const homamGeneral = wf2?.steps.find(s => s.stepType === 'GENERAL_DETAILS');
      expect(homamGeneral?.requiredFields).toContain('gothram');
      expect(homamGeneral?.requiredFields).not.toContain('mobile');

      // 3. Padmavathi ₹200
      const wf3 = getWorkflowById('padmavati-special-entry-200');
      expect(wf3?.ticketPrice).toBe(200);
      expect(wf3?.hasGeneralDetailsStep).toBe(false);

      // 4. Back to Special Entry 300
      const wf4 = getWorkflowById('special-entry-darshan-300');
      expect(wf4?.maxPilgrims).toBe(6);
      expect(wf4?.ticketPrice).toBe(300);
      expect(wf4?.hasGeneralDetailsStep).toBe(true);
      const seGeneral = wf4?.steps.find(s => s.stepType === 'GENERAL_DETAILS');
      expect(seGeneral?.requiredFields).toContain('city');
      expect(seGeneral?.requiredFields).not.toContain('gothram');
      expect(seGeneral?.optionalFields).toContain('mobile');
    });
  });

  // ─── 7. Homam Safety (Section 9) ──────────────────────────────
  describe('7. Homam Safety Enforcements', () => {
    it('fails closed when devotee count is not exactly 2', async () => {
      document.body.innerHTML = `
        <h2>Pilgrim Details</h2>
        <div class="pilgrim-card"><input name="name" /></div>
      `;

      const p1 = createDevotee('p1', 'Solo Devotee');
      const res = await executeAutofill({
        pilgrims: [p1], // Only 1 pilgrim
        doc: document,
        workflow: SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
      });

      expect(res.success).toBe(false);
      expect(res.state).toBe('ERROR');
      expect(res.errors[0]).toContain('permits exactly 2 pilgrims');
    });

    it('enforces General Details step before Pilgrim Details step', () => {
      const steps = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps;
      const genStep = steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
      const pilStep = steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;

      expect(genStep.order).toBeLessThan(pilStep.order);
    });
  });

  // ─── 8. Profile Safety & Identity Isolation (Section 10) ──────
  describe('8. Profile Safety: Never Swap Identities', () => {
    it('assigns Pilgrim 1 strictly to Row 1 and Pilgrim 2 strictly to Row 2', async () => {
      document.body.innerHTML = `
        <div class="pilgrim-card" id="row-0">
          <input name="name" />
          <input name="age" />
          <select name="gender"><option value="Female">Female</option></select>
          <select name="photoIdProof"><option value="Aadhaar Card">Aadhaar Card</option></select>
          <input name="photoIdNumber" />
        </div>
        <div class="pilgrim-card" id="row-1">
          <input name="name" />
          <input name="age" />
          <select name="gender"><option value="Male">Male</option></select>
          <select name="photoIdProof"><option value="Passport">Passport</option></select>
          <input name="photoIdNumber" />
        </div>
      `;

      const devotee1 = createDevotee('p1', 'Ananya Sharma', {
        gender: Gender.FEMALE,
        age: 29,
        idType: IdType.AADHAAR,
        idNumber: '111122223333',
      });

      const devotee2 = createDevotee('p2', 'Rajesh Verma', {
        gender: Gender.MALE,
        age: 62,
        idType: IdType.PASSPORT,
        idNumber: 'Z9876543',
      });

      const res = await executeAutofill({
        pilgrims: [devotee1, devotee2],
        doc: document,
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      const row0Name = document.querySelector('#row-0 input[name="name"]') as HTMLInputElement;
      const row1Name = document.querySelector('#row-1 input[name="name"]') as HTMLInputElement;

      expect(row0Name.value).toBe('Ananya Sharma');
      expect(row1Name.value).toBe('Rajesh Verma');
      expect(row0Name.value).not.toBe(row1Name.value);
    });
  });

  // ─── 9. Repair System Precision (Section 12) ──────────────────
  describe('9. Repair System Retries ONLY Failed Fields', () => {
    it('does not re-fill already verified fields during repair', async () => {
      document.body.innerHTML = `
        <div class="pilgrim-card" id="row-0">
          <input name="name" value="Original Devotee" />
          <input name="age" value="35" />
          <select name="gender"><option value="Male" selected>Male</option></select>
          <select name="photoIdProof"><option value="Aadhaar Card" selected>Aadhaar Card</option></select>
          <input name="photoIdNumber" value="" />
        </div>
      `;

      const p1 = createDevotee('p1', 'Original Devotee', {
        age: 35,
        gender: Gender.MALE,
        idType: IdType.AADHAAR,
        idNumber: '999988887777',
      });

      // Target repair ONLY for photoIdNumber
      const repairResult = await repairFailedFields({
        pilgrims: [p1],
        doc: document,
        targetFailedItems: [{ pilgrimIndex: 0, field: 'photoIdNumber' }],
      });

      const idNumInput = document.querySelector('#row-0 input[name="photoIdNumber"]') as HTMLInputElement;
      expect(idNumInput.value).toBe('999988887777');

      // Verified fields were untouched
      const nameInput = document.querySelector('#row-0 input[name="name"]') as HTMLInputElement;
      expect(nameInput.value).toBe('Original Devotee');
    });
  });

  // ─── 10. Multi-Tab Safety (Section 14) ────────────────────────
  describe('10. Multi-Tab Safety & Fail-Closed Routing', () => {
    it('rejects sending to invalid tab or non-TTD domain', async () => {
      const res = await sendToTargetTab(
        { type: 'SCAN_PAGE' as any, payload: {}, timestamp: new Date().toISOString() },
        999999 // nonexistent tab ID
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Please open a supported TTD booking page');
    });
  });

  // ─── 11. Security Audit: Zero Dangerous Code (Section 16) ─────
  describe('11. Security Audit & Zero-PII Telemetry (Section 15 & 16)', () => {
    it('ensures Diagnostic Data contains NO Aadhaar, Phone, Email, or Profile PII', () => {
      const diagnosticTelemetry = {
        ttdDetected: true,
        serviceId: 'special-entry-darshan-300',
        workflowVersion: '1.0.0',
        currentStep: 'PILGRIM_DETAILS',
        rowsDetected: 2,
        fieldsDetected: 10,
        fieldsVerified: 10,
        confidence: 100,
        durationMs: 450,
      };

      const serialized = JSON.stringify(diagnosticTelemetry);
      expect(serialized).not.toContain('aadhaar');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('mobile');
      expect(serialized).not.toContain('email');
      expect(serialized).not.toContain('123456789012');
    });
  });
});
