// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeAutofill, requestStop } from '../../src/content/autofill/autofill-manager';
import { PerformanceProfiler } from '../../src/content/autofill/performance-profiler';
import { prewarmBookingProfile, clearPrewarmCache } from '../../src/content/autofill/profile-prewarm';
import { DomSnapshot } from '../../src/content/autofill/dom-snapshot';
import { FieldCache } from '../../src/content/autofill/field-cache';
import { buildExecutionPlan, isFieldSatisfied } from '../../src/content/autofill/execution-plan';
import { AutofillScheduler } from '../../src/content/autofill/autofill-scheduler';
import { detectAndLockPilgrimRows } from '../../src/content/autofill/row-detector';
import { getCanonicalService } from '../../src/services/canonical-service-registry';
import { SPECIAL_ENTRY_DARSHAN_300 } from '../../src/services/workflows/special-entry-300';
import { PADMAVATHI_SUPADHAM_ENTRY_200 } from '../../src/services/workflows/padmavathi-200';
import { SRI_SRINIVASA_DIVYANUGRAHA_HOMAM } from '../../src/services/workflows/sri-srinivasa-divyanugraha-homam';
import { SRIVARI_SEVA_WORKFLOW } from '../../src/services/workflows/srivari-seva-workflow';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

function createMockPilgrim(id: string, name: string, age: number, overrides: Partial<Pilgrim> = {}): Pilgrim {
  return {
    id,
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] || 'Kumar',
    fullName: name,
    age,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '123456789012',
    country: 'India',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockProfile(pilgrims: Pilgrim[]): Profile {
  return {
    id: 'prof-phase3',
    name: 'Devotee Family',
    pilgrims,
    selectedPilgrims: {},
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    general: {
      email: 'bhakta@example.com',
      mobile: '9876543210',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
    },
  };
}

describe('Phase 3: Ultra-Fast Autofill Engine Matrix', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking Form');
    doc.body.innerHTML = '';
    clearPrewarmCache();
  });

  function setupPilgrimDOM(count: number, initialValues?: Array<Partial<{ name: string; age: string; gender: string; idType: string; idNum: string }>>): void {
    const container = doc.createElement('div');
    container.className = 'mat-table ttd-pilgrim-container';

    for (let i = 0; i < count; i++) {
      const init = initialValues?.[i] || {};
      const row = doc.createElement('div');
      row.className = 'mat-row pilgrim-row';
      row.id = `devotee-row-${i}`;

      row.innerHTML = `
        <div class="col-name">
          <input name="pilgrimName_${i}" formcontrolname="name" placeholder="Pilgrim Name" value="${init.name || ''}" />
        </div>
        <div class="col-age">
          <input name="age_${i}" formcontrolname="age" placeholder="Age" type="number" value="${init.age || ''}" />
        </div>
        <div class="col-gender">
          <select name="gender_${i}" formcontrolname="gender">
            <option value="">Select Gender</option>
            <option value="Male" ${init.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option value="Female" ${init.gender === 'Female' ? 'selected' : ''}>Female</option>
          </select>
        </div>
        <div class="col-idproof">
          <select name="photoIdProof_${i}" formcontrolname="photoIdProof">
            <option value="">Select ID Proof</option>
            <option value="Aadhaar Card" ${init.idType === 'Aadhaar Card' ? 'selected' : ''}>Aadhaar Card</option>
            <option value="Passport" ${init.idType === 'Passport' ? 'selected' : ''}>Passport</option>
          </select>
        </div>
        <div class="col-idnumber">
          <input name="photoIdNumber_${i}" formcontrolname="photoIdNumber" placeholder="Photo ID Number" value="${init.idNum || ''}" />
        </div>
      `;
      container.appendChild(row);
    }
    doc.body.appendChild(container);
  }

  // ─── A. Performance Profiler & Zero-PII Telemetry ───
  describe('A. Performance Profiler & Zero-PII Telemetry', () => {
    it('records timing and count metrics without any PII fields', () => {
      const profiler = new PerformanceProfiler('special-entry-darshan-300', 'sed-workflow', 2);
      profiler.startPhase('scan');
      profiler.endPhase('scan');
      profiler.startPhase('resolve');
      profiler.recordFieldResolved(10);
      profiler.endPhase('resolve');
      profiler.startPhase('fill');
      profiler.recordFieldFilled();
      profiler.recordFieldSkipped();
      profiler.endPhase('fill');
      profiler.startPhase('verify');
      profiler.recordFieldVerified();
      profiler.recordFieldVerified();
      profiler.endPhase('verify');

      const metrics = profiler.getMetrics();
      expect(metrics.serviceId).toBe('special-entry-darshan-300');
      expect(metrics.pilgrimCount).toBe(2);
      expect(metrics.fieldsResolved).toBe(10);
      expect(metrics.fieldsFilled).toBe(1);
      expect(metrics.fieldsSkipped).toBe(1);
      expect(metrics.fieldsVerified).toBe(2);
      expect(metrics.totalMs).toBeGreaterThanOrEqual(0);

      const metricsJson = JSON.stringify(metrics);
      expect(metricsJson).not.toContain('Aadhaar');
      expect(metricsJson).not.toContain('123456789012');
      expect(metricsJson).not.toContain('Ravi');
      expect(metricsJson).not.toContain('bhakta@example.com');
      expect(metricsJson).not.toContain('9876543210');
    });
  });

  // ─── B. Profile Prewarming ───
  describe('B. Profile Prewarming', () => {
    it('precomputes normalized immutable booking data and reuses cache', () => {
      const p1 = createMockPilgrim('p1', 'Venkatesh Rao', 40);
      const profile = createMockProfile([p1]);

      const plan1 = prewarmBookingProfile(profile, undefined, 'special-entry-darshan-300');
      expect(plan1.pilgrims.length).toBe(1);
      expect(plan1.pilgrims[0].fullName).toBe('Venkatesh Rao');
      expect(plan1.pilgrims[0].sanitizedIdNumber).toBe('123456789012');
      expect(plan1.general.email).toBe('bhakta@example.com');

      // Second call should return cached object
      const plan2 = prewarmBookingProfile(profile, undefined, 'special-entry-darshan-300');
      expect(plan1).toBe(plan2);

      // Invalidate cache
      clearPrewarmCache();
      const plan3 = prewarmBookingProfile(profile, undefined, 'special-entry-darshan-300');
      expect(plan3).not.toBe(plan1);
      expect(plan3.pilgrims[0].fullName).toBe('Venkatesh Rao');
    });
  });

  // ─── C. Fast DOM Snapshot & Field Fingerprint Cache ───
  describe('C. Fast DOM Snapshot & Field Fingerprint Cache', () => {
    it('creates scoped snapshot without repeated body querying', () => {
      setupPilgrimDOM(2);
      const snapshot = DomSnapshot.takeSnapshot(doc);
      expect(snapshot.inputs.length).toBeGreaterThan(0);
      expect(snapshot.selects.length).toBeGreaterThan(0);

      const cachedInputs = snapshot.getVisibleInputs();
      expect(cachedInputs.length).toBe(snapshot.inputs.length);
    });

    it('field cache associates fingerprints with elements and tracks invalidations', () => {
      setupPilgrimDOM(1);
      const input = doc.querySelector('input[name="pilgrimName_0"]') as HTMLInputElement;
      expect(input).toBeTruthy();

      const cache = new FieldCache();
      const fp = cache.getOrCompute(input, 'pilgrim');
      expect(fp).toBeTruthy();
      expect(fp.tagName.toUpperCase()).toBe('INPUT');
      expect(fp.name).toBe('pilgrimName_0');

      // Second get returns cached fingerprint
      expect(cache.get(input)).toBe(fp);

      // Invalidation clears cache
      cache.invalidate(input);
      expect(cache.get(input)).toBeUndefined();
    });
  });

  // ─── D. Single-Pass Execution Plan & Differential Autofill ───
  describe('D. Single-Pass Execution Plan & Differential Autofill', () => {
    it('detects when field is already satisfied and skips redundant write', () => {
      const input = doc.createElement('input');
      input.value = 'Govinda';
      expect(isFieldSatisfied(input, 'Govinda', 'name', false)).toBe(true);
      expect(isFieldSatisfied(input, 'Srinivasa', 'name', false)).toBe(false);

      const select = doc.createElement('select');
      const opt = doc.createElement('option');
      opt.value = 'Male';
      opt.text = 'Male';
      opt.selected = true;
      select.appendChild(opt);
      expect(isFieldSatisfied(select, 'Male', 'gender', true)).toBe(true);
      expect(isFieldSatisfied(select, 'Female', 'gender', true)).toBe(false);
    });

    it('builds execution plan across all locked rows in one pass', () => {
      setupPilgrimDOM(3);
      const p1 = createMockPilgrim('p1', 'Pilgrim One', 30);
      const p2 = createMockPilgrim('p2', 'Pilgrim Two', 35);
      const p3 = createMockPilgrim('p3', 'Pilgrim Three', 40);
      const profile = createMockProfile([p1, p2, p3]);
      const prewarmed = prewarmBookingProfile(profile, undefined, 'special-entry-darshan-300');

      const lockedRows = detectAndLockPilgrimRows(doc, 3);
      expect(lockedRows.length).toBe(3);

      const plan = buildExecutionPlan(lockedRows, prewarmed, doc, 'sed-workflow');
      expect(plan.rows.length).toBe(3);
      expect(plan.totalFieldsCount).toBe(15); // 3 rows * 5 fields
    });

    it('executes differential fill preserving already correct fields', async () => {
      // Row 0 has name already correct, row 1 is empty
      setupPilgrimDOM(2, [
        { name: 'Ravi Kumar', age: '35', gender: 'Male', idType: 'Aadhaar Card', idNum: '123456789012' },
        { name: '', age: '', gender: '', idType: '', idNum: '' },
      ]);

      const p1 = createMockPilgrim('p1', 'Ravi Kumar', 35);
      const p2 = createMockPilgrim('p2', 'Suresh Kumar', 42);
      const profile = createMockProfile([p1, p2]);

      const result = await executeAutofill({
        profile,
        pilgrims: [p1, p2],
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan',
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      expect(result.success).toBe(true);
      expect(result.metrics?.fieldsVerified).toBe(10);
      // Row 0 fields were differentialPreserved:
      const p0Results = result.pilgrimResults[0].results;
      const preservedCount = p0Results.filter(r => r.strategy === 'differentialPreserved').length;
      expect(preservedCount).toBeGreaterThan(0);
      expect(result.metrics?.fieldsSkipped).toBeGreaterThan(0);
    });
  });

  // ─── E. Controlled Concurrency & Double-Click Protection ───
  describe('E. Controlled Concurrency & Double-Click Protection', () => {
    it('blocks secondary concurrent autofill invocation safely', async () => {
      setupPilgrimDOM(1);
      const p1 = createMockPilgrim('p1', 'Anand Kumar', 28);
      const profile = createMockProfile([p1]);

      const firstPromise = executeAutofill({
        profile,
        pilgrims: [p1],
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan',
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      const secondResult = await executeAutofill({
        profile,
        pilgrims: [p1],
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan',
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.errors[0]).toContain('already in progress');

      const firstResult = await firstPromise;
      expect(firstResult.success).toBe(true);
    });
  });

  // ─── F. Cancellation (Abort) Support ───
  describe('F. Cancellation Support', () => {
    it('stops autofill immediately when requestStop is triggered', async () => {
      setupPilgrimDOM(6);
      const pilgrims = Array.from({ length: 6 }, (_, i) =>
        createMockPilgrim(`p${i}`, `Pilgrim ${i}`, 20 + i)
      );
      const profile = createMockProfile(pilgrims);

      // Start autofill and stop during execution
      const fillPromise = executeAutofill({
        profile,
        pilgrims,
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/special-entry-darshan',
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      requestStop();

      const result = await fillPromise;
      // Should terminate cleanly without erroring uncaught
      expect(result.state).toBe('STOPPED');
    });
  });

  // ─── G. Service Safety Invariants ───
  describe('G. Service Safety Invariants', () => {
    it('₹200 Padmavathi workflow strictly forbids General Details execution', async () => {
      const p1 = createMockPilgrim('p1', 'Padma Devi', 32);
      const profile = createMockProfile([p1]);

      const result = await executeAutofill({
        profile,
        pilgrims: [p1],
        step: 'general',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/padmavathi-darshan',
        workflow: PADMAVATHI_SUPADHAM_ENTRY_200,
      });

      // Workflow explicitly declares hasGeneralDetailsStep: false -> immediately completes without DOM touches
      expect(result.success).toBe(true);
      expect(result.state).toBe('COMPLETE');
      expect(result.generalResults).toHaveLength(0);
    });

    it('Homam permits exactly 2 pilgrims', async () => {
      setupPilgrimDOM(1);
      const p1 = createMockPilgrim('p1', 'Yajamana', 45);
      const profile = createMockProfile([p1]);

      const result = await executeAutofill({
        profile,
        pilgrims: [p1], // Only 1, but Homam requires exactly 2!
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/homam',
        workflow: SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('permits exactly 2 pilgrims');
    });

    it('Srivari Seva permits exactly 1 participant', async () => {
      const p1 = createMockPilgrim('p1', 'Sevak 1', 30);
      const p2 = createMockPilgrim('p2', 'Sevak 2', 32);
      const profile = createMockProfile([p1, p2]);

      const result = await executeAutofill({
        profile,
        pilgrims: [p1, p2], // 2 pilgrims, Srivari Seva permits max 1
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/srivari-seva',
        workflow: SRIVARI_SEVA_WORKFLOW,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/permits exactly 1|allows a maximum of 1/i);
    });
  });

  // ─── H. Temporary TTD Booking Lock Handling ───
  describe('H. Temporary TTD Booking Lock Handling', () => {
    it('stops autofill immediately when temporary booking lock is detected', async () => {
      // Inject TTD temporary booking lock message in DOM
      const lockDiv = doc.createElement('div');
      lockDiv.className = 'error-msg alert-danger';
      lockDiv.textContent = 'Booking with same pilgrim id is in progress. Please try again after some time.';
      doc.body.appendChild(lockDiv);

      const p1 = createMockPilgrim('p1', 'Ramesh', 40);
      const profile = createMockProfile([p1]);

      const result = await executeAutofill({
        profile,
        pilgrims: [p1],
        step: 'pilgrim',
        doc,
        url: 'https://ttdevasthanams.ap.gov.in/sed',
        workflow: SPECIAL_ENTRY_DARSHAN_300,
      });

      expect(result.state).toBe('TTD_TEMPORARY_BOOKING_LOCK');
      expect(result.success).toBe(false);
      expect(result.temporaryLock).toBeDefined();
    });
  });

  // ─── I. Scheduler & Micro-Task DOM Settling ───
  describe('I. Scheduler & DOM Settling', () => {
    it('AutofillScheduler yields frames without throwing', async () => {
      await expect(AutofillScheduler.nextFrame()).resolves.toBeUndefined();
      await expect(AutofillScheduler.settleDom()).resolves.toBeUndefined();
    });
  });
});
