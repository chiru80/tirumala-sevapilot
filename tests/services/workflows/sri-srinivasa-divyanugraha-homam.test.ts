// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 3 — Sri Srinivasa Divyanugraha Homam Workflow Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  getAllWorkflows,
  getWorkflowById,
  detectActiveWorkflow,
} from '../../../src/services/workflows/registry';
import {
  evaluateStepReadiness,
  canExecuteAutofill,
} from '../../../src/services/workflows/workflow-engine';
import {
  SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
  validateHomamBooking,
} from '../../../src/services/workflows/sri-srinivasa-divyanugraha-homam';
import { Gender, IdType } from '../../../src/shared/types';
import type { BookingProfile } from '../../../src/shared/types';
import { detectPageTicketLimit, detectDigitalQueue } from '../../../src/services/workflows/step-detectors';
import { detectAndLockPilgrimRows } from '../../../src/content/autofill/row-detector';
import { resolvePilgrimFields, resolveGeneralFields } from '../../../src/content/autofill/field-resolver';
import { executeAutofill } from '../../../src/content/autofill/autofill-manager';
import { detectWorkflowStep } from '../../../src/content/autofill/page-workflow';
import { performDropdownTransaction } from '../../../src/content/autofill/field-transaction';

describe('Workflow: Sri Srinivasa Divyanugraha Homam', () => {
  // ─── 1. Registration & Metadata ──────────────────────────
  describe('Registration & Metadata', () => {
    it('is registered in the global workflow registry', () => {
      const all = getAllWorkflows();
      const found = all.find(w => w.serviceId === 'sri-srinivasa-divyanugraha-homam');
      expect(found).toBeDefined();
    });

    it('can be retrieved by serviceId', () => {
      const wf = getWorkflowById('sri-srinivasa-divyanugraha-homam');
      expect(wf).toBeDefined();
      expect(wf?.serviceName).toBe('Sri Srinivasa Divyanugraha Homam');
      expect(wf?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    });

    it('enforces maximum and exact 2 persons per booking', () => {
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.maxPilgrims).toBe(2);
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.exactPilgrims).toBe(2);
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.minPilgrims).toBe(2);
    });

    it('enforces ₹1600 price rule for 2 persons', () => {
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.ticketPrice).toBe(1600);
    });

    it('configures approximate-month-ahead release window', () => {
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.releaseWindow?.type).toBe('approximate-month-ahead');
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.releaseWindow?.description).toContain('one month in advance');
    });

    it('has hasGeneralDetailsStep set to true', () => {
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.hasGeneralDetailsStep).toBe(true);
    });
  });

  // ─── 2. Mandatory Step Ordering ─────────────────────────────
  describe('Mandatory Step Ordering (General Details BEFORE Pilgrim Details)', () => {
    it('places GENERAL_DETAILS strictly before PILGRIM_DETAILS in the steps array', () => {
      const steps = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps;
      const generalIdx = steps.findIndex(s => s.stepType === 'GENERAL_DETAILS');
      const pilgrimIdx = steps.findIndex(s => s.stepType === 'PILGRIM_DETAILS');

      expect(generalIdx).toBeGreaterThanOrEqual(0);
      expect(pilgrimIdx).toBeGreaterThanOrEqual(0);
      expect(generalIdx).toBeLessThan(pilgrimIdx);
    });

    it('has order property of GENERAL_DETAILS lower than PILGRIM_DETAILS', () => {
      const generalStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
      const pilgrimStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;

      expect(generalStep.order).toBeLessThan(pilgrimStep.order);
      expect(generalStep.order).toBe(3);
      expect(pilgrimStep.order).toBe(4);
    });

    it('includes HOMAM_SELECTION step before GENERAL_DETAILS', () => {
      const steps = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps;
      const homamSelIdx = steps.findIndex(s => s.stepType === 'HOMAM_SELECTION');
      const generalIdx = steps.findIndex(s => s.stepType === 'GENERAL_DETAILS');

      expect(homamSelIdx).toBeGreaterThanOrEqual(0);
      expect(homamSelIdx).toBeLessThan(generalIdx);
    });

    it('ends with REVIEW_DETAILS followed by PAYMENT', () => {
      const steps = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps;
      const reviewIdx = steps.findIndex(s => s.stepType === 'REVIEW_DETAILS');
      const paymentIdx = steps.findIndex(s => s.stepType === 'PAYMENT');

      expect(reviewIdx).toBeGreaterThanOrEqual(0);
      expect(paymentIdx).toBeGreaterThanOrEqual(0);
      expect(reviewIdx).toBeLessThan(paymentIdx);
    });
  });

  // ─── 3. Field Classifications & Mobile Exclusion ───────────
  describe('Field Classifications & Prohibitions', () => {
    const generalStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
    const pilgrimStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;

    it('marks Gothram as REQUIRED in General Details (booking-level)', () => {
      expect(generalStep.requiredFields).toContain('gothram');
      expect(generalStep.fieldClassifications['gothram']).toBe('REQUIRED');
    });

    it('does NOT include Mobile number in Homam required fields', () => {
      expect(generalStep.requiredFields).not.toContain('mobile');
      expect(generalStep.fieldClassifications['mobile']).toBeUndefined();
    });

    it('marks Email as REQUIRED in General Details for this service', () => {
      expect(generalStep.requiredFields).toContain('email');
      expect(generalStep.fieldClassifications['email']).toBe('REQUIRED');
    });

    it('requires exactly the 6 observed General Details fields', () => {
      expect(generalStep.requiredFields).toEqual([
        'gothram',
        'email',
        'city',
        'state',
        'country',
        'pinCode',
      ]);
    });

    it('prohibits pilgrim identity fields during General Details', () => {
      expect(generalStep.prohibitedFields).toContain('fullName');
      expect(generalStep.prohibitedFields).toContain('idNumber');
      expect(generalStep.prohibitedFields).toContain('idType');
    });

    it('prohibits General Details fields during Pilgrim Details', () => {
      expect(pilgrimStep.prohibitedFields).toContain('gothram');
      expect(pilgrimStep.prohibitedFields).toContain('mobile');
      expect(pilgrimStep.prohibitedFields).toContain('email');
      expect(pilgrimStep.prohibitedFields).toContain('city');
    });
  });

  // ─── 4. Readiness Evaluation ──────────────────────────────────
  describe('Readiness Evaluation', () => {
    const generalStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
    const pilgrimStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;

    const baseProfile: BookingProfile = {
      id: 'p-homam',
      name: 'Homam Family',
      isDefault: true,
      serviceType: 'arjitha_seva' as any,
      selectedPilgrims: {},
      pilgrims: [
        {
          id: 'dev-1',
          fullName: 'Srinivasa Rao',
          firstName: 'Srinivasa',
          lastName: 'Rao',
          age: 45,
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '913901445173',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dev-2',
          fullName: 'Padmavathi Amma',
          firstName: 'Padmavathi',
          lastName: 'Amma',
          age: 40,
          gender: Gender.FEMALE,
          idType: IdType.AADHAAR,
          idNumber: '999999990019',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
      ],
      general: {
        gothram: 'Kashyapa',
        email: 'devotee@example.com',
        country: 'India',
        state: 'Andhra Pradesh',
        city: 'Tirupati',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('evaluates General Details as 100% complete when all 6 fields are present WITHOUT mobile', () => {
      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        generalStep,
        baseProfile,
      );

      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
      expect(readiness.missingFields).toHaveLength(0);
      expect(readiness.completedFields).toHaveLength(6);
      expect(readiness.missingFields).not.toContain('mobile');
    });

    it('flags readiness as incomplete when Gothram is missing', () => {
      const profileWithoutGothram: BookingProfile = {
        ...baseProfile,
        general: {
          ...baseProfile.general!,
          gothram: '',
        },
      };

      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        generalStep,
        profileWithoutGothram,
      );

      expect(readiness.isComplete).toBe(false);
      expect(readiness.missingFields).toContain('gothram');
      expect(readiness.score).toBeLessThan(100);
    });

    it('does NOT penalize readiness when mobile number is missing (mobile not required)', () => {
      const profileWithoutMobile: BookingProfile = {
        ...baseProfile,
        general: {
          ...baseProfile.general!,
          mobile: '', // Absent
        },
      };

      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        generalStep,
        profileWithoutMobile,
      );

      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
      expect(readiness.missingFields).not.toContain('mobile');
    });

    it('flags readiness as incomplete when Email is missing', () => {
      const profileWithoutEmail: BookingProfile = {
        ...baseProfile,
        general: {
          ...baseProfile.general!,
          email: '',
        },
      };

      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        generalStep,
        profileWithoutEmail,
      );

      expect(readiness.isComplete).toBe(false);
      expect(readiness.missingFields).toContain('email');
    });

    it('evaluates Pilgrim Details readiness accurately with 2 devotees', () => {
      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        pilgrimStep,
        baseProfile,
        baseProfile.pilgrims,
      );

      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
      expect(readiness.completedFields).toHaveLength(2);
    });

    it('accepts couple OR any two individual devotees without relationship restrictions', () => {
      // Two male devotees (e.g. brothers/friends)
      const twoMaleDevotees: BookingProfile = {
        ...baseProfile,
        pilgrims: [
          baseProfile.pilgrims[0],
          {
            ...baseProfile.pilgrims[1],
            gender: Gender.MALE,
            fullName: 'Govinda Rao',
          },
        ],
      };

      const readiness = evaluateStepReadiness(
        SRI_SRINIVASA_DIVYANUGRAHA_HOMAM,
        pilgrimStep,
        twoMaleDevotees,
        twoMaleDevotees.pilgrims,
      );

      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
    });
  });

  // ─── 5. Dedicated Homam Booking Validator ─────────────────────
  describe('Homam Booking Validator (validateHomamBooking)', () => {
    const validProfile: BookingProfile = {
      id: 'p-valid-homam',
      name: 'Homam Pair',
      isDefault: true,
      selectedPilgrims: {},
      pilgrims: [
        {
          id: 'dev-1',
          fullName: 'Srinivasa Rao',
          firstName: 'Srinivasa',
          lastName: 'Rao',
          age: 45,
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '913901445173',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dev-2',
          fullName: 'Lakshmi Devi',
          firstName: 'Lakshmi',
          lastName: 'Devi',
          age: 42,
          gender: Gender.FEMALE,
          idType: IdType.AADHAAR,
          idNumber: '999999990019',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
      ],
      general: {
        gothram: 'Kashyapa',
        email: 'devotee@example.com',
        country: 'India',
        state: 'Andhra Pradesh',
        city: 'Tirupati',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
    };

    it('validates a complete 2-person Homam booking successfully', () => {
      const res = validateHomamBooking(validProfile, validProfile.pilgrims);
      expect(res.isValid).toBe(true);
      expect(res.missingFields).toHaveLength(0);
      expect(res.ticketPrice).toBe(1600);
      expect(res.pilgrimCount).toBe(2);
      expect(res.summary).toContain('BOOKING READY');
    });

    it('reports missing Gothram explicitly (never generic message)', () => {
      const incomplete = {
        ...validProfile,
        general: { ...validProfile.general!, gothram: '' },
      };
      const res = validateHomamBooking(incomplete, incomplete.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain('Gothram');
      expect(res.summary).toContain('• Gothram');
    });

    it('reports missing Pilgrim 2 Photo ID Number specifically', () => {
      const incomplete = {
        ...validProfile,
        pilgrims: [
          validProfile.pilgrims[0],
          { ...validProfile.pilgrims[1], idNumber: '' },
        ],
      };
      const res = validateHomamBooking(incomplete, incomplete.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields.some(f => f.includes('Pilgrim 2 Photo ID Number'))).toBe(true);
      expect(res.summary).toContain('Pilgrim 2 Photo ID Number');
    });

    it('fails validation when only 1 pilgrim is selected', () => {
      const res = validateHomamBooking(validProfile, [validProfile.pilgrims[0]]);
      expect(res.isValid).toBe(false);
      expect(res.missingFields.some(f => f.includes('Exactly 2 pilgrims required'))).toBe(true);
    });

    it('fails validation when 3 pilgrims are selected', () => {
      const threePilgrims = [
        ...validProfile.pilgrims,
        { ...validProfile.pilgrims[0], id: 'dev-3', fullName: 'Third Pilgrim' },
      ];
      const res = validateHomamBooking(validProfile, threePilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields.some(f => f.includes('Exactly 2 pilgrims required'))).toBe(true);
    });

    it('validates invalid age for a pilgrim', () => {
      const invalidAge = {
        ...validProfile,
        pilgrims: [
          { ...validProfile.pilgrims[0], age: 0 },
          validProfile.pilgrims[1],
        ],
      };
      const res = validateHomamBooking(invalidAge, invalidAge.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain('Pilgrim 1 Age');
    });
  });

  // ─── 6. Two-Person Page Enforcement & Safety ─────────────────
  describe('Two-Person Limit Enforcement & Safety (Section 20)', () => {
    it('allows autofill when page reports 2 persons', () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h3>Sri Srinivasa Divyanugraha Homam</h3>
          <span class="quota">2 Persons</span>
        </div>
      `, 'text/html');

      const reported = detectPageTicketLimit(doc);
      expect(reported).toBe(2);

      const generalStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
      const result = canExecuteAutofill(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM, generalStep, false, doc);
      expect(result.canFill).toBe(true);
    });

    it('pauses autofill when page reports a limit other than 2', () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h3>Sri Srinivasa Divyanugraha Homam</h3>
          <span class="quota">1 Person per booking</span>
        </div>
      `, 'text/html');

      const reported = detectPageTicketLimit(doc);
      expect(reported).toBe(1);

      const generalStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
      const result = canExecuteAutofill(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM, generalStep, false, doc);
      expect(result.canFill).toBe(false);
      expect(result.reason).toBe('TTD page reports a different ticket limit. Review required.');
    });
  });

  // ─── 7. Security & Non-Automation ─────────────────────────────
  describe('Security & Strict Non-Automation', () => {
    it('strictly enforces non-automation on payment step', () => {
      expect(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.paymentConfig.strictNonAutomation).toBe(true);
      const paymentStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'PAYMENT')!;
      expect(paymentStep.isAutomatedAutofill).toBe(false);
    });

    it('strictly enforces non-automation on queue step', () => {
      const queueStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'DIGITAL_QUEUE')!;
      expect(queueStep.isAutomatedAutofill).toBe(false);
    });

    it('prohibits autofill on review step', () => {
      const reviewStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'REVIEW_DETAILS')!;
      expect(reviewStep.isAutomatedAutofill).toBe(false);
    });
  });

  // ─── 8. Service Detection (detectActiveWorkflow) ──────────────
  describe('Service Detection (detectActiveWorkflow)', () => {
    it('detects Homam service from URL with srinivasa-homam', () => {
      const mockDoc = new DOMParser().parseFromString('<html><body>Welcome</body></html>', 'text/html');
      const wf = detectActiveWorkflow('https://ttdevasthanams.ap.gov.in/srinivasa-homam', mockDoc);
      expect(wf).toBeDefined();
      expect(wf?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    });

    it('detects Homam service from DOM text "Sri Srinivasa Divyanugraha Homam"', () => {
      const html = '<html><body><h1>Sri Srinivasa Divyanugraha Homam Booking</h1></body></html>';
      const mockDoc = new DOMParser().parseFromString(html, 'text/html');
      const wf = detectActiveWorkflow('https://ttdevasthanams.ap.gov.in/booking', mockDoc);
      expect(wf).toBeDefined();
      expect(wf?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    });

    it('detects Homam from data-service marker', () => {
      const html = '<html><body><div data-service="homam">Booking</div></body></html>';
      const mockDoc = new DOMParser().parseFromString(html, 'text/html');
      const wf = detectActiveWorkflow('https://ttdevasthanams.ap.gov.in/portal', mockDoc);
      expect(wf).toBeDefined();
      expect(wf?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    });
  });

  // ─── 9. Missing Pilgrim 1 & 2 Specific Reporting ─────────────
  describe('Specific Missing Pilgrim Reporting (never generic)', () => {
    const validProfile: BookingProfile = {
      id: 'p-test',
      name: 'Test Homam',
      isDefault: true,
      pilgrims: [
        {
          id: 'dev-1',
          firstName: 'Devotee',
          lastName: 'One',
          fullName: 'Devotee One',
          age: 40,
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '913901445173',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dev-2',
          firstName: 'Devotee',
          lastName: 'Two',
          fullName: 'Devotee Two',
          age: 38,
          gender: Gender.FEMALE,
          idType: IdType.AADHAAR,
          idNumber: '999999990019',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
      ],
      general: {
        gothram: 'Kashyapa',
        email: 'devotee@example.com',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      createdAt: new Date().toISOString(),
    };

    it('reports missing Pilgrim 1 Name specifically when Pilgrim 1 name is missing', () => {
      const profile = {
        ...validProfile,
        pilgrims: [
          { ...validProfile.pilgrims[0], fullName: '', firstName: '', lastName: '' },
          validProfile.pilgrims[1],
        ],
      };
      const res = validateHomamBooking(profile, profile.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain('Pilgrim 1 Name');
      expect(res.summary).toContain('• Pilgrim 1 Name');
    });

    it('reports missing Pilgrim 2 Gender specifically when Pilgrim 2 gender is missing', () => {
      const profile = {
        ...validProfile,
        pilgrims: [
          validProfile.pilgrims[0],
          { ...validProfile.pilgrims[1], gender: undefined as any },
        ],
      };
      const res = validateHomamBooking(profile, profile.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain('Pilgrim 2 Gender');
      expect(res.summary).toContain('• Pilgrim 2 Gender');
    });

    it('reports missing Pilgrim 1 Photo ID Proof when missing', () => {
      const profile = {
        ...validProfile,
        pilgrims: [
          { ...validProfile.pilgrims[0], idType: undefined as any },
          validProfile.pilgrims[1],
        ],
      };
      const res = validateHomamBooking(profile, profile.pilgrims);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain('Pilgrim 1 Photo ID Proof');
    });
  });

  // ─── 10. Exactly 2 Pilgrim Rows Detection & Independence ──────
  describe('Exactly 2 Pilgrim Rows Detection & Independence', () => {
    it('detects and locks exactly 2 rows for Homam without collisions', () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h2>Devotee Details</h2>
          <div class="pilgrim-card" id="card-0">
            <label>Name</label><input type="text" name="name_0" />
            <label>Age</label><input type="number" name="age_0" />
            <label>Gender</label><select name="gender_0"><option>Male</option></select>
            <label>Photo ID Proof</label><select name="proof_0"><option>Aadhaar</option></select>
            <label>Photo ID Number</label><input type="text" name="idnum_0" />
          </div>
          <div class="pilgrim-card" id="card-1">
            <label>Name</label><input type="text" name="name_1" />
            <label>Age</label><input type="number" name="age_1" />
            <label>Gender</label><select name="gender_1"><option>Female</option></select>
            <label>Photo ID Proof</label><select name="proof_1"><option>Aadhaar</option></select>
            <label>Photo ID Number</label><input type="text" name="idnum_1" />
          </div>
        </div>
      `, 'text/html');

      const locked = detectAndLockPilgrimRows(doc, 2);
      expect(locked).toHaveLength(2);
      expect(locked[0].index).toBe(0);
      expect(locked[1].index).toBe(1);

      // Verify row 0 and row 1 name inputs are independent elements
      const name0 = locked[0].fields.get('name');
      const name1 = locked[1].fields.get('name');
      expect(name0).toBeDefined();
      expect(name1).toBeDefined();
      expect(name0).not.toBe(name1);
    });
  });

  // ─── 11. Dropdown Selection for Homam ──────────────────────────
  describe('Dropdown Selection for Homam (Gender & ID Proof)', () => {
    it('selects native dropdown option and triggers change event', async () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <select id="genderSelect">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      `, 'text/html');

      const select = doc.getElementById('genderSelect') as HTMLSelectElement;
      let eventFired = false;
      select.addEventListener('change', () => { eventFired = true; });

      await performDropdownTransaction(select, 'Female', 'gender', doc);
      expect(select.value).toBe('Female');
      expect(eventFired).toBe(true);
    });
  });

  // ─── 12. Digital Queue Recognition & Safety ───────────────────
  describe('Digital Queue Recognition & Safety (Section 12)', () => {
    it('detects waiting room state and prevents premature autofill', () => {
      const doc = new DOMParser().parseFromString(`
        <div id="waitingRoom">
          <p>You are in queue. Estimated wait time: 5 minutes.</p>
        </div>
      `, 'text/html');

      const queueRes = detectDigitalQueue(doc, 'https://ttdevasthanams.ap.gov.in/srinivasa-homam');
      expect(queueRes.isCurrentStep).toBe(true);

      const queueStep = SRI_SRINIVASA_DIVYANUGRAHA_HOMAM.steps.find(s => s.stepType === 'DIGITAL_QUEUE')!;
      const canFill = canExecuteAutofill(SRI_SRINIVASA_DIVYANUGRAHA_HOMAM, queueStep, false, doc);
      expect(canFill.canFill).toBe(false);
      expect(canFill.reason).toContain('Queue detected');
    });
  });

  // ─── 13. Dynamic Step Progression & SPA Navigation ────────────
  describe('Dynamic Step Progression & SPA Navigation', () => {
    it('correctly detects General Details step first on Homam form', () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h2>General Details</h2>
          <label>Gothram</label><input type="text" name="gothram" />
          <label>Email Address</label><input type="email" name="email" />
          <label>City</label><input type="text" name="city" />
          <label>State</label><input type="text" name="state" />
          <label>Country</label><input type="text" name="country" />
          <label>Pin Code</label><input type="text" name="pinCode" />
        </div>
      `, 'text/html');

      const step = detectWorkflowStep(doc, 'https://ttdevasthanams.ap.gov.in/srinivasa-homam', SRI_SRINIVASA_DIVYANUGRAHA_HOMAM);
      expect(step).toBe('GENERAL_DETAILS');
    });

    it('transitions to Pilgrim Details step after General Details is complete', () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h2>Devotee Details</h2>
          <div class="devotee-card">
            <label>Name</label><input type="text" name="name" />
            <label>Age</label><input type="number" name="age" />
            <label>Gender</label><select name="gender"><option>Male</option></select>
            <label>Photo ID Proof</label><select name="proof"><option>Aadhaar</option></select>
            <label>Photo ID Number</label><input type="text" name="idnumber" />
          </div>
        </div>
      `, 'text/html');

      const step = detectWorkflowStep(doc, 'https://ttdevasthanams.ap.gov.in/srinivasa-homam', SRI_SRINIVASA_DIVYANUGRAHA_HOMAM);
      expect(step).toBe('PILGRIM_DETAILS');
    });
  });

  // ─── 14. End-to-End Homam Autofill Pipeline ───────────────────
  describe('End-to-End Homam Autofill Pipeline', () => {
    it('autofills General Details with Gothram, Email, Address and WITHOUT mobile', async () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h2>General Details</h2>
          <label>Gothram</label><input type="text" id="gothram" />
          <label>Email Address</label><input type="email" id="email" />
          <label>City</label><input type="text" id="city" />
          <label>State</label>
          <select id="state">
            <option value="">Select State</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
          </select>
          <label>Country</label>
          <select id="country">
            <option value="">Select Country</option>
            <option value="India">India</option>
          </select>
          <label>Pin Code</label><input type="text" id="pinCode" />
        </div>
      `, 'text/html');

      const profile: BookingProfile = {
        id: 'p-homam-e2e',
        name: 'Homam Family',
        isDefault: true,
        pilgrims: [],
        general: {
          gothram: 'Kashyapa',
          email: 'devotee@example.com',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
          mobile: '9876543210',
        },
        createdAt: new Date().toISOString(),
      };

      const result = await executeAutofill({
        profile,
        doc,
        serviceId: 'sri-srinivasa-divyanugraha-homam',
      });

      expect(result.step).toBe('general');
      expect(result.success).toBe(true);

      // Verify DOM values
      const gothramInput = doc.getElementById('gothram') as HTMLInputElement;
      const emailInput = doc.getElementById('email') as HTMLInputElement;
      expect(gothramInput.value).toBe('Kashyapa');
      expect(emailInput.value).toBe('devotee@example.com');

      // Verify mobile was NOT filled or included in results
      const generalFieldKeys = result.generalResults.map(r => r.field);
      expect(generalFieldKeys).toContain('gothram');
      expect(generalFieldKeys).toContain('email');
      expect(generalFieldKeys).not.toContain('mobile');
    });

    it('autofills exactly 2 pilgrim rows in Pilgrim Details step', async () => {
      const doc = new DOMParser().parseFromString(`
        <div>
          <h2>Devotee Details</h2>
          <div class="card devotee-card" id="card-0">
            <label>Name</label><input type="text" name="name_0" />
            <label>Age</label><input type="number" name="age_0" />
            <label>Gender</label><select name="gender_0"><option value="Male">Male</option></select>
            <label>Photo ID Proof</label><select name="proof_0"><option value="Aadhaar Card">Aadhaar Card</option></select>
            <label>Photo ID Number</label><input type="text" name="idnumber_0" />
          </div>
          <div class="card devotee-card" id="card-1">
            <label>Name</label><input type="text" name="name_1" />
            <label>Age</label><input type="number" name="age_1" />
            <label>Gender</label><select name="gender_1"><option value="Female">Female</option></select>
            <label>Photo ID Proof</label><select name="proof_1"><option value="Aadhaar Card">Aadhaar Card</option></select>
            <label>Photo ID Number</label><input type="text" name="idnumber_1" />
          </div>
        </div>
      `, 'text/html');

      const pilgrims = [
        {
          id: 'dev-1',
          firstName: 'Srinivasa',
          lastName: 'Rao',
          fullName: 'Srinivasa Rao',
          age: 45,
          gender: Gender.MALE,
          idType: IdType.AADHAAR,
          idNumber: '913901445173',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dev-2',
          firstName: 'Lakshmi',
          lastName: 'Devi',
          fullName: 'Lakshmi Devi',
          age: 42,
          gender: Gender.FEMALE,
          idType: IdType.AADHAAR,
          idNumber: '999999990019',
          country: 'India',
          createdAt: new Date().toISOString(),
        },
      ];

      const result = await executeAutofill({
        pilgrims,
        doc,
        serviceId: 'sri-srinivasa-divyanugraha-homam',
      });

      expect(result.step).toBe('pilgrim');
      expect(result.success).toBe(true);
      expect(result.pilgrimResults).toHaveLength(2);
      expect(result.totalVerified).toBe(10); // 2 pilgrims * 5 fields
    });
  });
});
