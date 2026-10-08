// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 6: Srivari Seva Hardening Verification Suite
// Master Prompt Section 23 (A through K)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReadinessEngine,
  ServiceReadinessEngine,
} from '../../src/services/readiness-engine';
import {
  getCanonicalService,
  resolveCanonicalService,
  getCanonicalServiceLimits,
} from '../../src/services/canonical-service-registry';
import {
  ServiceType,
  Gender,
  IdType,
  type Profile,
  type Pilgrim,
} from '../../src/shared/types';
import {
  detectActiveBookingStep,
} from '../../src/content/autofill/page-workflow';
import {
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from '../../src/services/workflows/step-detectors';
import {
  resolveSrivariEnrollmentFields,
} from '../../src/content/autofill/field-resolver';
import {
  detectTtdTemporaryLock,
} from '../../src/services/ttd-information/ttd-lock-detector';
import {
  classifyError,
} from '../../src/services/error-classification';
import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';
import {
  setPhotoIdProofDropdown,
  autofillPilgrimRow,
} from '../../src/content/ttd-pilgrim-autofill';
import { resolveGeneralDetails } from '../../src/shared/utils';

describe('Phase 6 — Srivari Seva Hardening & Verification', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const validAadhaar = '99999999001' + generateVerhoeffChecksum('99999999001');

  const baseValidPilgrim: Pilgrim = {
    id: 'p1',
    firstName: 'Chiranjeevi',
    lastName: 'Rao',
    fullName: 'Chiranjeevi Rao',
    dateOfBirth: '1990-05-15',
    age: 36,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: validAadhaar,
    mobile: '9876543210',
    photo: 'data:image/jpeg;base64,mockphotodata',
    country: 'India',
    state: 'Andhra Pradesh',
    district: 'Tirupati',
    city: 'Tirupati',
    pinCode: '517501',
    srivariSeva: {
      doorNumber: '12-34',
      street: 'Temple Street',
    },
    createdAt: '2026-01-01',
  };

  const baseValidProfile: Profile = {
    id: 'prof-srivari',
    name: 'Sevak Profile',
    pilgrims: [baseValidPilgrim],
    selectedPilgrims: { 'srivari-seva': ['p1'] },
    isDefault: true,
    general: {
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
      mobile: '9876543210',
    },
    createdAt: '2026-01-01',
  };

  function setupFullEnrollmentDom(options: {
    mentallyFitChecked?: boolean;
    physicallyFitChecked?: boolean;
    declarationChecked?: boolean;
    fillValues?: boolean;
  } = {}) {
    const {
      mentallyFitChecked = true,
      physicallyFitChecked = true,
      declarationChecked = true,
      fillValues = false,
    } = options;

    document.body.innerHTML = `
      <h1>Srivari Seva</h1>
      <h2>Unified Profile Enrollment</h2>
      <form id="srivariSevaForm">
        <div id="identity-section">
          <h3>Identity Proof</h3>
          <label for="idProofType">ID Proof Type *</label>
          <select id="idProofType" name="idProofType">
            <option value="">Select ID Type</option>
            <option value="Aadhaar">Aadhaar</option>
            <option value="Voter ID">Voter ID</option>
          </select>
          <label for="idProofNumber">ID Proof Number *</label>
          <input id="idProofNumber" name="idProofNumber" value="${fillValues ? validAadhaar : ''}" />
          <label for="mobile">Mobile Number *</label>
          <input id="mobile" name="mobile" value="${fillValues ? '9876543210' : ''}" />
          <label for="photo">Photo *</label>
          <input id="photo" name="photo" type="file" />
        </div>
        <div id="basic-section">
          <h3>Basic Details</h3>
          <label for="name">Name *</label>
          <input id="name" name="name" value="${fillValues ? 'Chiranjeevi Rao' : ''}" />
          <label for="dob">Date of Birth *</label>
          <input id="dob" name="dateOfBirth" value="${fillValues ? '1990-05-15' : ''}" />
          <label for="age">Age *</label>
          <input id="age" name="age" value="${fillValues ? '36' : ''}" />
          <label for="gender">Gender *</label>
          <select id="gender" name="gender">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <label for="profession">Profession</label>
          <input id="profession" name="profession" />
        </div>
        <div id="fitness-section">
          <h3>Fitness</h3>
          <label><input type="checkbox" id="mentallyFit" name="mentallyFit" ${mentallyFitChecked ? 'checked' : ''} /> Mentally Fit</label>
          <label><input type="checkbox" id="physicallyFit" name="physicallyFit" ${physicallyFitChecked ? 'checked' : ''} /> Physically Fit</label>
        </div>
        <div id="address-section">
          <h3>Address Details</h3>
          <label for="country">Country *</label>
          <select id="country" name="country">
            <option value="">Select Country</option>
            <option value="India">India</option>
          </select>
          <label for="pincode">Pincode *</label>
          <input id="pincode" name="pincode" value="${fillValues ? '517501' : ''}" />
          <label for="state">State *</label>
          <select id="state" name="state">
            <option value="">Select State</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
          </select>
          <label for="district">District *</label>
          <input id="district" name="district" value="${fillValues ? 'Tirupati' : ''}" />
          <label for="city">City *</label>
          <input id="city" name="city" value="${fillValues ? 'Tirupati' : ''}" />
          <label for="street">Street *</label>
          <input id="street" name="street" value="${fillValues ? 'Temple Street' : ''}" />
          <label for="doorNumber">Door Number *</label>
          <input id="doorNumber" name="doorNumber" value="${fillValues ? '12-34' : ''}" />
        </div>
        <div id="declaration-section">
          <label><input type="checkbox" id="declaration" name="declaration" ${declarationChecked ? 'checked' : ''} /> I hereby declare that all information is true</label>
        </div>
      </form>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // A & B: Required Field Mapping & No Invented Defaults
  // ─────────────────────────────────────────────────────────────
  describe('A & B. Required-Field Mapping & Zero Invented Defaults', () => {
    it('missing gender remains empty and blocks readiness (no Male default)', () => {
      const pilgrimNoGender: Pilgrim = {
        ...baseValidPilgrim,
        gender: '' as any,
      };
      const profile: Profile = {
        ...baseValidProfile,
        pilgrims: [pilgrimNoGender],
      };

      const evalResult = ReadinessEngine.evaluate(profile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evalResult.isBookingReady).toBe(false);
      expect(evalResult.missingFields.some(f => f.includes('Gender'))).toBe(true);
    });

    it('missing ID type remains empty and blocks readiness (no Aadhaar default)', () => {
      const pilgrimNoIdType: Pilgrim = {
        ...baseValidPilgrim,
        idType: '' as any,
      };
      const profile: Profile = {
        ...baseValidProfile,
        pilgrims: [pilgrimNoIdType],
      };

      const evalResult = ReadinessEngine.evaluate(profile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evalResult.isBookingReady).toBe(false);
      expect(evalResult.missingFields.some(f => f.includes('ID Proof'))).toBe(true);
    });

    it('missing country remains empty and blocks readiness (no India default)', () => {
      const pilgrimNoCountry: Pilgrim = {
        ...baseValidPilgrim,
        country: '',
      };
      const profile: Profile = {
        ...baseValidProfile,
        general: {
          ...baseValidProfile.general!,
          country: '',
        },
        pilgrims: [pilgrimNoCountry],
      };

      const evalResult = ReadinessEngine.evaluate(profile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evalResult.isBookingReady).toBe(false);
      expect(evalResult.missingFields.some(f => f.toLowerCase().includes('country'))).toBe(true);
    });

    it('missing street / doorNumber blocks readiness and is flagged explicitly', () => {
      const pilgrimNoAddress: Pilgrim = {
        ...baseValidPilgrim,
        srivariSeva: undefined,
      };
      const profile: Profile = {
        ...baseValidProfile,
        pilgrims: [pilgrimNoAddress],
      };

      const evalResult = ReadinessEngine.evaluate(profile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evalResult.isBookingReady).toBe(false);
      expect(evalResult.missingFields.some(f => f.toLowerCase().includes('street') || f.toLowerCase().includes('address'))).toBe(true);
    });

    it('resolveGeneralDetails does not invent Andhra Pradesh or India for empty address', () => {
      const emptyProfile = {
        id: 'prof-empty',
        name: 'Empty Profile',
        pilgrims: [],
        createdAt: '2026-01-01',
      } as unknown as Profile;

      const details = resolveGeneralDetails(emptyProfile);
      expect(details.state).toBe('');
      expect(details.country).toBe('');
    });

    it('setPhotoIdProofDropdown returns false and does nothing when idTypeValue is empty', async () => {
      const select = document.createElement('select');
      select.innerHTML = '<option value="">Select ID</option><option value="aadhaar">Aadhaar Card</option>';
      document.body.appendChild(select);

      const result = await setPhotoIdProofDropdown(select, '');
      expect(result).toBe(false);
      expect(select.value).toBe('');
    });

    it('autofillPilgrimRow rejects missing gender and idType without inventing Male or Aadhaar', async () => {
      const rowContainer = document.createElement('div');
      rowContainer.innerHTML = `
        <input aria-label="Devotee Name" value="" />
        <select aria-label="Gender"><option value="">Select</option><option value="Male">Male</option></select>
        <select aria-label="Photo ID Proof"><option value="">Select</option><option value="Aadhaar Card">Aadhaar Card</option></select>
      `;
      document.body.appendChild(rowContainer);

      const missingPilgrim: Pilgrim = {
        ...baseValidPilgrim,
        gender: '' as any,
        idType: '' as any,
      };

      const result = await autofillPilgrimRow(
        { container: rowContainer, index: 0 },
        missingPilgrim,
        new Set(),
        document,
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fields.gender.error).toContain('empty in profile');
      expect(result.fields.photoIdProof.error).toContain('empty in profile');
      expect(result.fields.gender.filled).toBe(false);
      expect(result.fields.photoIdProof.filled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // C: Readiness Contract & User Action Required
  // ─────────────────────────────────────────────────────────────
  describe('C. Readiness Contract & User Action Boundaries', () => {
    it('returns USER_ACTION_REQUIRED when mentallyFit or physicallyFit is unchecked', () => {
      setupFullEnrollmentDom({ mentallyFitChecked: false, physicallyFitChecked: true });
      const domEval = ReadinessEngine.evaluateDomReadiness(document, baseValidProfile, 'srivari-seva');

      expect(domEval.isReady).toBe(false);
      expect(domEval.status).toBe('USER_ACTION_REQUIRED');
      expect(domEval.actionRequired).toBe(true);
      expect(domEval.actionMessage).toContain('Fit');
    });

    it('returns USER_ACTION_REQUIRED when declaration checkbox is unchecked', () => {
      setupFullEnrollmentDom({ mentallyFitChecked: true, physicallyFitChecked: true, declarationChecked: false });
      const domEval = ReadinessEngine.evaluateDomReadiness(document, baseValidProfile, 'srivari-seva');

      expect(domEval.isReady).toBe(false);
      expect(domEval.status).toBe('USER_ACTION_REQUIRED');
      expect(domEval.actionRequired).toBe(true);
      expect(domEval.actionMessage).toContain('declaration');
    });

    it('returns USER_ACTION_REQUIRED when required photo is missing from profile', () => {
      setupFullEnrollmentDom({ mentallyFitChecked: true, physicallyFitChecked: true, declarationChecked: true });
      const profileNoPhoto: Profile = {
        ...baseValidProfile,
        pilgrims: [{
          ...baseValidPilgrim,
          photo: '',
        }],
      };
      const domEval = ReadinessEngine.evaluateDomReadiness(document, profileNoPhoto, 'srivari-seva');

      expect(domEval.isReady).toBe(false);
      expect(domEval.actionRequired).toBe(true);
      expect(domEval.actionMessage).toContain('photo');
    });

    it('returns READY only when all machine fields complete and user attestations confirmed', () => {
      setupFullEnrollmentDom({
        mentallyFitChecked: true,
        physicallyFitChecked: true,
        declarationChecked: true,
        fillValues: true,
      });

      // Select dropdowns
      const idTypeSelect = document.getElementById('idProofType') as HTMLSelectElement;
      idTypeSelect.value = 'Aadhaar';
      const genderSelect = document.getElementById('gender') as HTMLSelectElement;
      genderSelect.value = 'Male';
      const countrySelect = document.getElementById('country') as HTMLSelectElement;
      countrySelect.value = 'India';
      const stateSelect = document.getElementById('state') as HTMLSelectElement;
      stateSelect.value = 'Andhra Pradesh';

      const domEval = ReadinessEngine.evaluateDomReadiness(document, baseValidProfile, 'srivari-seva');
      expect(domEval.isReady).toBe(true);
      expect(domEval.status).toBe('READY');
      expect(domEval.actionRequired).toBe(false);
    });

    it('ServiceReadinessEngine.evaluate reports ACTION_REQUIRED when live DOM requires user action', () => {
      setupFullEnrollmentDom({ mentallyFitChecked: false });
      const result = ServiceReadinessEngine.evaluate({
        profile: baseValidProfile,
        serviceType: ServiceType.SRIVARI_SEVA,
        serviceId: 'srivari-seva',
        currentPageState: {
          pageDetected: true,
          dom: document,
          url: 'https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile',
        },
      });

      expect(result.status).toBe('ACTION_REQUIRED');
      expect(result.headline).toContain('Fit');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // D: Exact Party Size Enforcement
  // ─────────────────────────────────────────────────────────────
  describe('D. Exact Party Size Enforcement (Strictly 1 Devotee)', () => {
    it('0 pilgrims is blocked (status BLOCKED)', () => {
      setupFullEnrollmentDom();
      const emptyProfile: Profile = {
        ...baseValidProfile,
        pilgrims: [],
      };
      const domEval = ReadinessEngine.evaluateDomReadiness(document, emptyProfile, 'srivari-seva');
      expect(domEval.isReady).toBe(false);
      expect(domEval.status).toBe('BLOCKED');
    });

    it('exactly 1 pilgrim is valid', () => {
      const limits = getCanonicalServiceLimits('srivari-seva');
      expect(limits.exactPilgrims).toBe(1);
      expect(limits.maxPilgrims).toBe(1);
      expect(limits.minPilgrims).toBe(1);
    });

    it('2 pilgrims is blocked for Srivari Seva', () => {
      setupFullEnrollmentDom();
      const multiProfile: Profile = {
        ...baseValidProfile,
        pilgrims: [baseValidPilgrim, { ...baseValidPilgrim, id: 'p2', firstName: 'Second' }],
      };
      const domEval = ReadinessEngine.evaluateDomReadiness(document, multiProfile, 'srivari-seva');
      expect(domEval.isReady).toBe(false);
      expect(domEval.status).toBe('BLOCKED');
      expect(domEval.actionMessage).toContain('exactly 1 devotee');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // E: User Modification Protection
  // ─────────────────────────────────────────────────────────────
  describe('E. User-Entered Value Protection', () => {
    it('preserves existing meaningful values entered by the user', () => {
      setupFullEnrollmentDom();
      const mobileInput = document.getElementById('mobile') as HTMLInputElement;
      mobileInput.value = '9123456789'; // User manually typed their phone number

      const { fields } = resolveSrivariEnrollmentFields(document);
      const mobileField = fields.get('mobile');
      expect(mobileField).toBeDefined();
      expect((mobileField?.element as HTMLInputElement).value).toBe('9123456789');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // F: Dynamic DOM & Dependent Dropdowns
  // ─────────────────────────────────────────────────────────────
  describe('F. Dynamic DOM & Dependent Dropdowns', () => {
    it('resolves fields even when injected dynamically into the DOM', () => {
      // Empty container initially
      document.body.innerHTML = '<div id="container"></div>';
      expect(resolveSrivariEnrollmentFields(document).fields.size).toBe(0);

      // Delayed render
      document.getElementById('container')!.innerHTML = `
        <input name="name" id="name" />
        <input name="mobile" id="mobile" />
        <select name="gender"><option value="Female">Female</option></select>
      `;

      const { fields } = resolveSrivariEnrollmentFields(document);
      expect(fields.has('name')).toBe(true);
      expect(fields.has('mobile')).toBe(true);
      expect(fields.has('gender')).toBe(true);
    });

    it('dependent state dropdown recognizes presence after country is set', () => {
      document.body.innerHTML = `
        <form>
          <select id="country" name="country">
            <option value="India">India</option>
          </select>
          <select id="state" name="state">
            <option value="">Select State</option>
            <option value="AP">Andhra Pradesh</option>
          </select>
        </form>
      `;

      const { fields } = resolveSrivariEnrollmentFields(document);
      const countryField = fields.get('country')?.element as HTMLSelectElement;
      const stateField = fields.get('state')?.element as HTMLSelectElement;

      expect(countryField).toBeDefined();
      expect(stateField).toBeDefined();
      expect(Array.from(stateField.options).some(o => o.text.includes('Andhra Pradesh'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // G: File Input Handling
  // ─────────────────────────────────────────────────────────────
  describe('G. File Input Handling & Privacy', () => {
    it('detects missing required photo and flags USER_ACTION_REQUIRED gracefully', () => {
      setupFullEnrollmentDom({ fillValues: true });
      const noPhotoProfile: Profile = {
        ...baseValidProfile,
        pilgrims: [{
          ...baseValidPilgrim,
          photo: '',
        }],
      };

      const domEval = ReadinessEngine.evaluateDomReadiness(document, noPhotoProfile, 'srivari-seva');
      expect(domEval.actionRequired).toBe(true);
      expect(domEval.actionMessage).toContain('photo');
    });

    it('never logs base64 photo data into diagnostic messages', () => {
      const photoPayload = 'data:image/jpeg;base64,' + 'A'.repeat(500);
      const profileWithBigPhoto: Profile = {
        ...baseValidProfile,
        pilgrims: [{
          ...baseValidPilgrim,
          photo: photoPayload,
        }],
      };

      const evalResult = ReadinessEngine.evaluate(profileWithBigPhoto, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      const serialized = JSON.stringify(evalResult);
      expect(serialized).not.toContain('A'.repeat(100));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // H: Sensitive Logging Privacy (Zero PII Logging)
  // ─────────────────────────────────────────────────────────────
  describe('H. Sensitive Logging Privacy', () => {
    it('diagnostic missing field messages redact or use field names without raw ID or mobile', () => {
      const evalResult = ReadinessEngine.evaluate(baseValidProfile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      const serialized = JSON.stringify(evalResult);

      // Should not contain raw Aadhaar or raw Mobile
      expect(serialized).not.toContain(validAadhaar);
      expect(serialized).not.toContain('9876543210');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // I: Service Isolation
  // ─────────────────────────────────────────────────────────────
  describe('I. Service Isolation', () => {
    it('Srivari exact-1 rule does NOT leak into Special Entry ₹300 (1-6 allowed)', () => {
      const sedLimits = getCanonicalServiceLimits('special-entry-darshan-300');
      expect(sedLimits.minPilgrims).toBe(1);
      expect(sedLimits.maxPilgrims).toBe(6);
      expect(sedLimits.exactPilgrims).toBeUndefined();
    });

    it('Srivari exact-1 rule does NOT leak into Padmavathi ₹200 (1-6 allowed)', () => {
      const spatLimits = getCanonicalServiceLimits('padmavathi-supadham-entry-200');
      expect(spatLimits.minPilgrims).toBe(1);
      expect(spatLimits.maxPilgrims).toBe(6);
      expect(spatLimits.exactPilgrims).toBeUndefined();
    });

    it('Srivari exact-1 rule does NOT leak into Homam ₹1600 (strictly 2 required)', () => {
      const homamLimits = getCanonicalServiceLimits('sri-srinivasa-divyanugraha-homam');
      expect(homamLimits.exactPilgrims).toBe(2);
      expect(homamLimits.maxPilgrims).toBe(2);
    });

    it('Unknown URL does NOT default to Srivari or Special Entry', () => {
      const res = resolveCanonicalService('https://example.com/unrelated');
      expect(res.service).toBeUndefined();
      expect(res.isUncertain).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // J: Temporary TTD Booking Lock
  // ─────────────────────────────────────────────────────────────
  describe('J. Temporary TTD Booking Lock', () => {
    it('recognizes TTD temporary booking lock with higher priority than generic error', () => {
      const lockText = 'Booking with same pilgrim id is in progress. Please try again after some time';
      const lockRes = detectTtdTemporaryLock(lockText);

      expect(lockRes.isLocked).toBe(true);
      expect(lockRes.lockState?.status).toBe('temporary-lock');

      const classified = classifyError(new Error(lockText));
      expect(classified.code).toBe('TTD_TEMPORARY_BOOKING_LOCK');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // K: Route + DOM Detection
  // ─────────────────────────────────────────────────────────────
  describe('K. Route and DOM Detection', () => {
    it('recognizes Srivari route with 100% confidence', () => {
      const res = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile');
      expect(res.service?.serviceId).toBe('srivari-seva');
      expect(res.confidence).toBe(100);
    });

    it('recognizes Special Entry Darshan route with confidence >= 65', () => {
      const res = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/special-entry-darshan-300');
      expect(res.service?.serviceId).toBe('special-entry-darshan-300');
      expect(res.confidence).toBeGreaterThanOrEqual(65);
    });

    it('recognizes Padmavathi Supadham route with 100% confidence', () => {
      const res = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/spat/booking');
      expect(res.service?.serviceId).toBe('padmavathi-supadham-entry-200');
      expect(res.confidence).toBe(100);
    });

    it('returns undefined and uncertain for ambiguous/unknown URLs', () => {
      const res = resolveCanonicalService('https://ttdevasthanams.ap.gov.in/news/bulletin');
      expect(res.service).toBeUndefined();
      expect(res.isUncertain).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // L: Codex Review Finding Regression: Instructions Precedence
  // ─────────────────────────────────────────────────────────────
  describe('L. Codex Review Finding: Instructions Page Precedence', () => {
    it('preserves instruction-page precedence even when instructions text mentions enrollment section keywords', () => {
      document.body.innerHTML = `
        <div class="instructions-wrapper">
          <h1>Srivari Seva</h1>
          <h2>Instructions for Sevaks</h2>
          <p>Please note: All sevaks must bring original identity proof at reporting.</p>
          <p>You must fill your basic details accurately.</p>
          <p>Devotees must be in sound medical fitness to render physical seva.</p>
          <p>Profession and education information must be stated honestly.</p>
          <p>Current address details and contact details will be verified.</p>
          <label>
            <input type="checkbox" id="chkDeclare" />
            I hereby declare that I have read and agree to all instructions, terms and conditions.
          </label>
        </div>
      `;

      const instructionsUrl = 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions';

      // 1. detectSrivariSevaEnrollment must not trigger without enrollment URL/form
      const enrollRes = detectSrivariSevaEnrollment(document, instructionsUrl);
      expect(enrollRes.isCurrentStep).toBe(false);

      // 2. detectSrivariSevaInstructions must trigger
      const instRes = detectSrivariSevaInstructions(document, instructionsUrl);
      expect(instRes.isCurrentStep).toBe(true);

      // 3. detectActiveBookingStep must resolve to INSTRUCTIONS_REVIEW
      const activeStep = detectActiveBookingStep(document, instructionsUrl);
      expect(activeStep).toBe('INSTRUCTIONS_REVIEW');

      // 4. evaluateDomReadiness must evaluate instructions step and require declaration confirmation
      const domEval = ReadinessEngine.evaluateDomReadiness(document, baseValidProfile, 'srivari-seva');
      expect(domEval.step).toBe('INSTRUCTIONS_REVIEW');
      expect(domEval.actionRequired).toBe(true);
      expect(domEval.actionMessage).toContain('declaration checkbox');
      expect(domEval.isReady).toBe(false);
    });
  });
});
