// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Srivari Seva Voluntary Enrollment Workflow — Verification Suite
// Master Prompt Section 27 (Tests A through K)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectActiveWorkflow,
  getWorkflowById,
  resolveWorkflowWithConfidence,
} from '../../src/services/workflows/registry';
import {
  detectDeclarationCheckbox,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from '../../src/services/workflows/step-detectors';
import {
  resolveSrivariEnrollmentFields,
  findSrivariSections,
  isRequiredField,
} from '../../src/content/autofill/field-resolver';
import {
  detectActiveBookingStep,
  detectWorkflowStep,
} from '../../src/content/autofill/page-workflow';
import {
  executeAutofill,
} from '../../src/content/autofill/autofill-manager';
import {
  ReadinessEngine,
} from '../../src/services/readiness-engine';
import { ServiceType, Gender, type Profile, type Pilgrim } from '../../src/shared/types';
import { SRIVARI_SEVA_WORKFLOW } from '../../src/services/workflows/srivari-seva-workflow';

describe('Srivari Seva Enrollment Workflow Verification (Section 27)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── A. URL Recognition & Service Disambiguation ─────────────
  describe('A. URL Recognition & Route Dominance', () => {
    it('recognizes /srivari-seva/instructions with 100% confidence', () => {
      const url = 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions';
      const resolution = resolveWorkflowWithConfidence(url, document);

      expect(resolution.workflow!.serviceId).toBe('srivari-seva');
      expect(resolution.workflow!.workflowId).toBe('srivari-seva-enrollment-v1');
      expect(resolution.confidence).toBe(100);
      expect(resolution.isUncertain).toBe(false);
    });

    it('recognizes /srivari-seva/unified-profile with 100% confidence', () => {
      const url = 'https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile';
      const resolution = resolveWorkflowWithConfidence(url, document);

      expect(resolution.workflow!.serviceId).toBe('srivari-seva');
      expect(resolution.workflow!.workflowId).toBe('srivari-seva-enrollment-v1');
      expect(resolution.confidence).toBe(100);
      expect(resolution.isUncertain).toBe(false);
    });

    it('does NOT trigger Darshan ₹300, Padmavathi ₹200, or Homam workflow', () => {
      const url = 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions';
      const resolution = resolveWorkflowWithConfidence(url, document);

      expect(resolution.workflow!.serviceId).not.toBe('special-entry-darshan-300');
      expect(resolution.workflow!.serviceId).not.toBe('padmavathi-supadham-entry-200');
      expect(resolution.workflow!.serviceId).not.toBe('sri-srinivasa-divyanugraha-homam');
    });

    it('retrieves the canonical Srivari Seva workflow by ID', () => {
      const wf = getWorkflowById('srivari-seva');
      expect(wf).toBeDefined();
      expect(wf?.serviceId).toBe('srivari-seva');
      expect(wf?.ticketPrice).toBe(0);
      expect(wf?.maxPilgrims).toBe(1);
      expect(wf?.exactPilgrims).toBe(1);
    });
  });

  // ─── B & C. Instructions Page & Declaration Safety ───────────
  describe('B & C. Instructions Page & Declaration Safety', () => {
    it('detects instructions step from URL and page semantics', () => {
      document.body.innerHTML = `
        <div class="instructions-container">
          <h1>Srivari Seva</h1>
          <h2>Instructions</h2>
          <div class="tabs">
            <span>How to apply</span>
            <span>General Instructions for All Sevaks</span>
          </div>
        </div>
      `;
      const url = 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions';
      const step = detectSrivariSevaInstructions(document, url);

      expect(step.isCurrentStep).toBe(true);
      expect(step.confidence).toBeGreaterThanOrEqual(50);
      expect(detectActiveBookingStep(document, url)).toBe('INSTRUCTIONS_REVIEW');
      expect(detectWorkflowStep(document, url)).toBe('INSTRUCTIONS_REVIEW');
    });

    it('detects declaration checkbox and strictly forbids autoCheck (autoCheck: false)', () => {
      document.body.innerHTML = `
        <label>
          <input type="checkbox" id="chkDeclaration" />
          I hereby declare that I will follow instructions, terms and conditions of Srivari Seva
        </label>
      `;

      const decl = detectDeclarationCheckbox(document);
      expect(decl.detected).toBe(true);
      expect(decl.checked).toBe(false);
      expect(decl.requiresUserAction).toBe(true);
      expect(decl.autoCheck).toBe(false);
    });

    it('pauses autofill with actionRequired = true when declaration is unchecked (NEVER checks it)', async () => {
      document.body.innerHTML = `
        <label>
          <input type="checkbox" id="chkDeclaration" />
          I hereby declare that I will follow instructions, terms and conditions of Srivari Seva
        </label>
      `;
      const checkbox = document.getElementById('chkDeclaration') as HTMLInputElement;

      const res = await executeAutofill({
        url: 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions',
        doc: document,
        pilgrims: [],
        workflow: SRIVARI_SEVA_WORKFLOW,
      });

      expect(res.step).toBe('srivari_instructions');
      expect(res.actionRequired).toBe(true);
      expect(res.instructionsState).toBe('READY_FOR_USER_CONFIRMATION');
      // Critical safety check: ensure the checkbox was NOT checked by SevaPilot!
      expect(checkbox.checked).toBe(false);
    });

    it('recognizes USER_CONFIRMED state when user manually checks declaration checkbox', async () => {
      document.body.innerHTML = `
        <label>
          <input type="checkbox" id="chkDeclaration" checked />
          I hereby declare that I will follow instructions, terms and conditions of Srivari Seva
        </label>
      `;

      const res = await executeAutofill({
        url: 'https://ttdevasthanams.ap.gov.in/srivari-seva/instructions',
        doc: document,
        pilgrims: [],
        workflow: SRIVARI_SEVA_WORKFLOW,
      });

      expect(res.step).toBe('srivari_instructions');
      expect(res.actionRequired).toBe(false);
      expect(res.instructionsState).toBe('USER_CONFIRMED');
      expect(res.success).toBe(true);
    });
  });

  // ─── D. Enrollment Form & 5 Sections Detection ──────────────
  describe('D. Enrollment Form & 5 Sections Detection', () => {
    it('detects unified profile page and distinguishes 5 separate sections', () => {
      document.body.innerHTML = `
        <h1>Srivari Seva</h1>
        <div class="card" id="sec-identity">
          <h3>Identity Proof</h3>
          <input name="idProofNumber" />
        </div>
        <div class="card" id="sec-basic">
          <h3>Basic Details</h3>
          <input name="fullName" />
        </div>
        <div class="card" id="sec-fitness">
          <h3>Fitness</h3>
          <input type="checkbox" name="mentallyFit" />
        </div>
        <div class="card" id="sec-profession">
          <h3>Profession & Education Details</h3>
          <input name="profession" />
        </div>
        <div class="card" id="sec-address">
          <h3>Address Details</h3>
          <input name="city" />
        </div>
      `;

      const url = 'https://ttdevasthanams.ap.gov.in/srivari-seva/unified-profile';
      const stepDetect = detectSrivariSevaEnrollment(document, url);
      expect(stepDetect.isCurrentStep).toBe(true);

      const sections = findSrivariSections(document);
      expect(sections.identityProof).not.toBeNull();
      expect(sections.basicDetails).not.toBeNull();
      expect(sections.fitness).not.toBeNull();
      expect(sections.profession).not.toBeNull();
      expect(sections.address).not.toBeNull();
    });
  });

  // ─── E. Asterisk Rule & Live DOM Dynamic Semantics ──────────
  describe('E. Asterisk Rule & Dynamic Required Evaluation', () => {
    it('treats fields with * as required and fields without * as optional', () => {
      document.body.innerHTML = `
        <div>
          <label>Name *</label>
          <input id="txtName" />
        </div>
        <div>
          <label>Father/Spouse Name</label>
          <input id="txtFather" />
        </div>
        <div>
          <label>Mandal (Optional)</label>
          <input id="txtMandal" />
        </div>
      `;

      const elName = document.getElementById('txtName')!;
      const elFather = document.getElementById('txtFather')!;
      const elMandal = document.getElementById('txtMandal')!;

      expect(isRequiredField(elName, undefined, document)).toBe(true);
      expect(isRequiredField(elFather, undefined, document)).toBe(false);
      expect(isRequiredField(elMandal, undefined, document)).toBe(false);
    });
  });

  // ─── F. Identity Proof Section ──────────────────────────────
  describe('F. Identity Proof Section Scoping', () => {
    it('correctly maps ID Proof Type, ID Proof Number, Mobile, and Photo', () => {
      document.body.innerHTML = `
        <div id="identity-section">
          <h3>Identity Proof</h3>
          <label>ID Proof Type *</label>
          <select name="idProofType"><option value="Aadhaar">Aadhaar Card</option></select>
          <label>ID Proof Number *</label>
          <input name="idProofNumber" />
          <label>Mobile Number *</label>
          <input name="mobile" type="tel" />
          <label>Photo Upload *</label>
          <input name="photo" type="file" />
        </div>
      `;

      const { fields, requiredMap } = resolveSrivariEnrollmentFields(document);
      expect(fields.get('idProofType')).toBeDefined();
      expect(fields.get('idProofNumber')).toBeDefined();
      expect(fields.get('mobile')).toBeDefined();
      expect(fields.get('photo')).toBeDefined();

      expect(requiredMap.get('idProofType')).toBe(true);
      expect(requiredMap.get('idProofNumber')).toBe(true);
      expect(requiredMap.get('mobile')).toBe(true);
      expect(requiredMap.get('photo')).toBe(true);
    });
  });

  // ─── G. Basic Details Section ───────────────────────────────
  describe('G. Basic Details Section Scoping', () => {
    it('marks Name, DOB, Age, Gender as required (*) and Father, Email, Blood Group as optional', () => {
      document.body.innerHTML = `
        <div id="basic-section">
          <h3>Basic Details</h3>
          <label>Name *</label>
          <input name="name" />
          <label>Father/Spouse Name</label>
          <input name="fatherSpouseName" />
          <label>Date of Birth *</label>
          <input name="dateOfBirth" />
          <label>Age *</label>
          <input name="age" />
          <label>Email Id</label>
          <input name="email" type="email" />
          <label>Blood Group</label>
          <input name="bloodGroup" />
          <label>Gender *</label>
          <select name="gender"><option value="Male">Male</option></select>
        </div>
      `;

      const { fields, requiredMap } = resolveSrivariEnrollmentFields(document);
      expect(requiredMap.get('name')).toBe(true);
      expect(requiredMap.get('dateOfBirth')).toBe(true);
      expect(requiredMap.get('age')).toBe(true);
      expect(requiredMap.get('gender')).toBe(true);

      expect(requiredMap.get('fatherSpouseName')).toBe(false);
      expect(requiredMap.get('email')).toBe(false);
      expect(requiredMap.get('bloodGroup')).toBe(false);
    });
  });

  // ─── H. Fitness Section ─────────────────────────────────────
  describe('H. Fitness Section & User Interaction Safety', () => {
    it('detects Mentally Fit and Physically Fit checkboxes and NEVER auto-checks them', () => {
      document.body.innerHTML = `
        <div id="fitness-section">
          <h3>Fitness *</h3>
          <label><input type="checkbox" id="cbMental" /> Mentally Fit</label>
          <label><input type="checkbox" id="cbPhysical" /> Physically Fit</label>
        </div>
      `;

      const { fields } = resolveSrivariEnrollmentFields(document);
      const cbMental = fields.get('mentallyFit')?.element as HTMLInputElement;
      const cbPhysical = fields.get('physicallyFit')?.element as HTMLInputElement;

      expect(cbMental).toBeDefined();
      expect(cbPhysical).toBeDefined();
      expect(cbMental.checked).toBe(false);
      expect(cbPhysical.checked).toBe(false);
    });
  });

  // ─── I. Profession & Education Details Section ──────────────
  describe('I. Profession & Education Details (Optional)', () => {
    it('treats all profession fields as optional when DOM lacks asterisk', () => {
      document.body.innerHTML = `
        <div id="prof-section">
          <h3>Profession & Education Details</h3>
          <label>Qualification</label><input name="qualification" />
          <label>Profession</label><input name="profession" />
          <label>Area Of Interest</label><input name="areaOfInterest" />
          <label>Employee Id</label><input name="employeeId" />
          <label>Designation / Retired as</label><input name="designation" />
          <label>Specialisation/Skill</label><input name="specialisation" />
          <label>Place of Working/Related</label><input name="placeOfWork" />
          <label>Upload Document</label><input name="document" type="file" />
        </div>
      `;

      const { requiredMap } = resolveSrivariEnrollmentFields(document);
      expect(requiredMap.get('qualification')).toBe(false);
      expect(requiredMap.get('profession')).toBe(false);
      expect(requiredMap.get('areaOfInterest')).toBe(false);
      expect(requiredMap.get('employeeId')).toBe(false);
      expect(requiredMap.get('designation')).toBe(false);
      expect(requiredMap.get('specialisation')).toBe(false);
      expect(requiredMap.get('placeOfWork')).toBe(false);
      expect(requiredMap.get('document')).toBe(false);
    });
  });

  // ─── J. Address Details Section ─────────────────────────────
  describe('J. Address Details Section', () => {
    it('marks Country, PIN, State, District, City, Street, Door Number as required and Mandal as optional', () => {
      document.body.innerHTML = `
        <div id="address-section">
          <h3>Address Details</h3>
          <label>Country *</label><select name="country"><option value="India">India</option></select>
          <label>Pincode *</label><input name="pincode" />
          <label>State *</label><select name="state"><option value="AP">Andhra Pradesh</option></select>
          <label>District *</label><input name="district" />
          <label>Mandal (Optional)</label><input name="mandal" />
          <label>City *</label><input name="city" />
          <label>Street *</label><input name="street" />
          <label>Door Number *</label><input name="doorNumber" />
        </div>
      `;

      const { requiredMap } = resolveSrivariEnrollmentFields(document);
      expect(requiredMap.get('country')).toBe(true);
      expect(requiredMap.get('pincode')).toBe(true);
      expect(requiredMap.get('state')).toBe(true);
      expect(requiredMap.get('district')).toBe(true);
      expect(requiredMap.get('city')).toBe(true);
      expect(requiredMap.get('street')).toBe(true);
      expect(requiredMap.get('doorNumber')).toBe(true);
      expect(requiredMap.get('mandal')).toBe(false);
    });
  });

  // ─── K. Photo vs Document Distinction ───────────────────────
  describe('K. Photo vs Document Section Scoping & Isolation', () => {
    it('isolates Identity Photo and Profession Supporting Document without cross-contamination', () => {
      document.body.innerHTML = `
        <div class="card" id="identity-card">
          <h3>Identity Proof</h3>
          <label>Photo upload *</label>
          <input type="file" id="file-photo" name="photoUpload" />
        </div>
        <div class="card" id="profession-card">
          <h3>Profession & Education Details</h3>
          <label>Upload Document</label>
          <input type="file" id="file-document" name="documentUpload" />
        </div>
      `;

      const { fields } = resolveSrivariEnrollmentFields(document);
      const photoEl = fields.get('photo')?.element;
      const docEl = fields.get('document')?.element;

      expect(photoEl).toBeDefined();
      expect(docEl).toBeDefined();
      expect(photoEl?.id).toBe('file-photo');
      expect(docEl?.id).toBe('file-document');
      expect(photoEl).not.toBe(docEl);
    });
  });

  // ─── Readiness Engine Integration ───────────────────────────
  describe('Readiness Engine Integration for Srivari Seva', () => {
    const validPilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Srinivasa',
      lastName: 'Ramanujan',
      fullName: 'Srinivasa Ramanujan',
      dateOfBirth: '1992-12-22',
      age: 32,
      gender: Gender.MALE,
      idType: 'Aadhaar' as any,
      idNumber: '999999990019', // Verhoeff valid Aadhaar
      mobile: '9876543210',
      photo: 'data:image/jpeg;base64,sample',
      country: 'India',
      state: 'Andhra Pradesh',
      district: 'Tirupati',
      city: 'Tirupati',
      pinCode: '517501',
      srivariSeva: {
        doorNumber: '1-23',
        street: 'Temple Street',
        // Optional fields left completely undefined
      },
      createdAt: new Date().toISOString(),
    };

    const validProfile: Profile = {
      id: 'prof1',
      name: 'Sevak Profile',
      pilgrims: [validPilgrim],
      selectedPilgrims: { 'srivari-seva': ['p1'] },
      isDefault: true,
      createdAt: new Date().toISOString(),
    };

    it('returns 100% readiness when 1 pilgrim has required identity + address details', () => {
      const evaluation = ReadinessEngine.evaluate(validProfile, ServiceType.SRIVARI_SEVA, 'srivari-seva');

      expect(evaluation.isBookingReady).toBe(true);
      expect(evaluation.isProfileReady).toBe(true);
      expect(evaluation.score).toBe(100);
      expect(evaluation.whyNotReady?.status).toBe('READY');
    });

    it('does NOT block readiness when optional fields (profession, mandal, email, blood group) are empty', () => {
      const evaluation = ReadinessEngine.evaluate(validProfile, ServiceType.SRIVARI_SEVA, 'srivari-seva');

      // None of the missing fields should mention profession, mandal, or qualification
      const missingStr = evaluation.missingFields.join(' ');
      expect(missingStr).not.toContain('profession');
      expect(missingStr).not.toContain('mandal');
      expect(missingStr).not.toContain('qualification');
      expect(missingStr).not.toContain('bloodGroup');
      expect(evaluation.isBookingReady).toBe(true);
    });

    it('blocks readiness when photo is missing for Srivari Seva', () => {
      const noPhotoPilgrim: Pilgrim = {
        ...validPilgrim,
        photo: undefined,
      };
      const noPhotoProfile: Profile = {
        ...validProfile,
        pilgrims: [noPhotoPilgrim],
      };

      const evaluation = ReadinessEngine.evaluate(noPhotoProfile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evaluation.isBookingReady).toBe(false);
      expect(evaluation.missingFields.some(m => m.includes('Photo'))).toBe(true);
    });

    it('blocks readiness when mobile is missing or not 10 digits for Srivari Seva', () => {
      const badMobilePilgrim: Pilgrim = {
        ...validPilgrim,
        mobile: '123',
      };
      const badMobileProfile: Profile = {
        ...validProfile,
        pilgrims: [badMobilePilgrim],
      };

      const evaluation = ReadinessEngine.evaluate(badMobileProfile, ServiceType.SRIVARI_SEVA, 'srivari-seva');
      expect(evaluation.isBookingReady).toBe(false);
      expect(evaluation.missingFields.some(m => m.includes('Mobile'))).toBe(true);
    });

    it('supports live DOM readiness evaluation (evaluateDomReadiness)', () => {
      document.body.innerHTML = `
        <h1>Srivari Seva</h1>
        <div id="identity">
          <h3>Identity Proof</h3>
          <label>ID Proof Type *</label><select name="idProofType"><option value="Aadhaar">Aadhaar</option></select>
          <label>ID Proof Number *</label><input name="idProofNumber" />
          <label>Mobile Number *</label><input name="mobile" />
          <label>Photo *</label><input name="photo" type="file" />
        </div>
        <div id="basic">
          <h3>Basic Details</h3>
          <label>Name *</label><input name="name" />
          <label>Date of Birth *</label><input name="dateOfBirth" />
          <label>Age *</label><input name="age" />
          <label>Gender *</label><select name="gender"><option value="Male">Male</option></select>
          <label>Profession</label><input name="profession" />
        </div>
        <div id="fitness">
          <h3>Fitness</h3>
          <label><input type="checkbox" name="mentallyFit" checked /> Mentally Fit</label>
          <label><input type="checkbox" name="physicallyFit" checked /> Physically Fit</label>
        </div>
        <div id="address">
          <h3>Address Details</h3>
          <label>Country *</label><select name="country"><option value="India">India</option></select>
          <label>Pincode *</label><input name="pincode" />
          <label>State *</label><select name="state"><option value="AP">Andhra Pradesh</option></select>
          <label>District *</label><input name="district" />
          <label>City *</label><input name="city" />
          <label>Street *</label><input name="street" />
          <label>Door Number *</label><input name="doorNumber" />
        </div>
      `;

      const domReadiness = ReadinessEngine.evaluateDomReadiness(document, validProfile, 'srivari-seva');
      expect(domReadiness.isReady).toBe(true);
      expect(domReadiness.step).toBe('SRIVARI_SEVA_ENROLLMENT');
      expect(domReadiness.missingRequiredFields.length).toBe(0);
      expect(domReadiness.optionalFieldsSkipped).toContain('profession');
    });
  });
});
