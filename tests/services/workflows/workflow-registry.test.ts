// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 3 — Workflow Registry Tests (Section 19 Test A, B, E)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  getAllWorkflows,
  getWorkflowById,
  detectActiveWorkflow,
  isServiceRecognized,
  resolveWorkflowWithConfidence,
} from '../../../src/services/workflows/registry';

// ─── Section 19 Test A — SED ₹300 Workflow ───────────────────
describe('Workflow Registry — SED ₹300 (special-entry-darshan-300)', () => {
  it('is registered in the workflow registry', () => {
    const all = getAllWorkflows();
    const found = all.find(w => w.serviceId === 'special-entry-darshan-300');
    expect(found).toBeDefined();
  });

  it('can be retrieved by serviceId', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    expect(workflow).toBeDefined();
    expect(workflow!.serviceId).toBe('special-entry-darshan-300');
    expect(workflow!.ticketPrice).toBe(300);
    expect(workflow!.temple).toContain('Tirumala');
  });

  it('has General Details step (hasGeneralDetailsStep = true)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    expect(workflow!.hasGeneralDetailsStep).toBe(true);
  });

  it('has exactly the correct Phase 3 step sequence', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const types = workflow!.steps.map(s => s.stepType);
    expect(types).toContain('DIGITAL_QUEUE');
    expect(types).toContain('AVAILABILITY');
    expect(types).toContain('SLOT_SELECTION');
    expect(types).toContain('ADDITIONAL_SERVICES');
    expect(types).toContain('PILGRIM_DETAILS');
    expect(types).toContain('GENERAL_DETAILS');
    expect(types).toContain('REVIEW_DETAILS');
    expect(types).toContain('PAYMENT');
  });

  it('strictly enforces payment non-automation', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    expect(workflow!.paymentConfig.strictNonAutomation).toBe(true);
  });

  it('has correct Pilgrim Details required fields (no email/address)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const pilgrimStep = workflow!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(pilgrimStep).toBeDefined();
    expect(pilgrimStep!.requiredFields).toContain('fullName');
    expect(pilgrimStep!.requiredFields).toContain('age');
    expect(pilgrimStep!.requiredFields).toContain('gender');
    expect(pilgrimStep!.requiredFields).toContain('idType');
    expect(pilgrimStep!.requiredFields).toContain('idNumber');
    // Address fields must NOT appear in pilgrim required fields
    expect(pilgrimStep!.requiredFields).not.toContain('email');
    expect(pilgrimStep!.requiredFields).not.toContain('city');
    expect(pilgrimStep!.requiredFields).not.toContain('state');
  });

  it('has General Details required fields (city, state, country, pinCode)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const generalStep = workflow!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(generalStep).toBeDefined();
    expect(generalStep!.requiredFields).toContain('city');
    expect(generalStep!.requiredFields).toContain('state');
    expect(generalStep!.requiredFields).toContain('country');
    expect(generalStep!.requiredFields).toContain('pinCode');
  });

  it('classifies mobile as OPTIONAL in Pilgrim Details step (Phase 3 Rule 11)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const pilgrimStep = workflow!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(pilgrimStep!.fieldClassifications['mobile']).toBe('OPTIONAL');
  });

  it('classifies mobile as OPTIONAL in General Details step (Phase 3 Rule 11)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const generalStep = workflow!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(generalStep!.fieldClassifications['mobile']).toBe('OPTIONAL');
  });

  it('prohibits identity fields during General Details step', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const generalStep = workflow!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(generalStep!.prohibitedFields).toContain('idNumber');
    expect(generalStep!.prohibitedFields).toContain('idType');
  });

  it('prohibits address fields during Pilgrim Details step', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const pilgrimStep = workflow!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(pilgrimStep!.prohibitedFields).toContain('email');
    expect(pilgrimStep!.prohibitedFields).toContain('city');
  });

  it('Payment and Review steps have isAutomatedAutofill = false', () => {
    const workflow = getWorkflowById('special-entry-darshan-300');
    const paymentStep = workflow!.steps.find(s => s.stepType === 'PAYMENT');
    const reviewStep = workflow!.steps.find(s => s.stepType === 'REVIEW_DETAILS');
    expect(paymentStep!.isAutomatedAutofill).toBe(false);
    expect(reviewStep!.isAutomatedAutofill).toBe(false);
  });
});

// ─── Section 19 Test B — Padmavathi ₹200 Workflow ────────────
describe('Workflow Registry — Padmavathi ₹200 (padmavathi-supadham-entry-200)', () => {
  it('is registered in the workflow registry', () => {
    const all = getAllWorkflows();
    const found = all.find(w => w.serviceId === 'padmavathi-supadham-entry-200');
    expect(found).toBeDefined();
  });

  it('can be retrieved by serviceId', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    expect(workflow).toBeDefined();
    expect(workflow!.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(workflow!.ticketPrice).toBe(200);
    expect(workflow!.temple).toContain('Tiruchanoor');
  });

  it('can be retrieved by alias padmavati-special-entry-200', () => {
    const workflow = getWorkflowById('padmavati-special-entry-200');
    expect(workflow).toBeDefined();
    expect(workflow!.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(workflow!.ticketPrice).toBe(200);
  });

  it('CRITICAL: does NOT have a General Details step (hasGeneralDetailsStep = false)', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    expect(workflow!.hasGeneralDetailsStep).toBe(false);
  });

  it('CRITICAL: does NOT include GENERAL_DETAILS in its steps array', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    const types = workflow!.steps.map(s => s.stepType);
    expect(types).not.toContain('GENERAL_DETAILS');
  });

  it('has correct Padmavathi-specific step sequence (Pilgrim → Review → Payment)', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    const types = workflow!.steps.map(s => s.stepType);
    expect(types).toContain('PILGRIM_DETAILS');
    expect(types).toContain('REVIEW_DETAILS');
    expect(types).toContain('PAYMENT');
    // Verify order: PILGRIM_DETAILS comes before REVIEW_DETAILS
    const pilgrimIdx = types.indexOf('PILGRIM_DETAILS');
    const reviewIdx = types.indexOf('REVIEW_DETAILS');
    expect(pilgrimIdx).toBeLessThan(reviewIdx);
  });

  it('classifies mobile as OPTIONAL in Pilgrim Details step', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    const pilgrimStep = workflow!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(pilgrimStep!.fieldClassifications['mobile']).toBe('OPTIONAL');
  });

  it('strictly enforces payment non-automation', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200');
    expect(workflow!.paymentConfig.strictNonAutomation).toBe(true);
  });
});

// ─── Section 19 Test E — Unknown Service Handling ────────────
describe('Workflow Registry — Unknown / Unrecognized Service', () => {
  it('returns undefined for an unknown serviceId', () => {
    const result = getWorkflowById('unknown-service-xyz-999');
    expect(result).toBeUndefined();
  });

  it('detectActiveWorkflow returns undefined for blank URL + empty DOM', () => {
    const mockDoc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    const result = detectActiveWorkflow('https://example.com/unknown', mockDoc);
    expect(result).toBeUndefined();
  });

  it('isServiceRecognized returns false for an unrecognized URL', () => {
    const mockDoc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    const result = isServiceRecognized('https://example.com/random', mockDoc);
    expect(result).toBe(false);
  });

  it('getAllWorkflows returns at least 2 registered workflows', () => {
    const all = getAllWorkflows();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── detectActiveWorkflow — Service Detection Logic ───────────
describe('Workflow Registry — detectActiveWorkflow by URL and DOM', () => {
  it('detects SED ₹300 from URL containing "special-entry" text', () => {
    const html = '<html><body>Special Entry Darshan tickets</body></html>';
    const mockDoc = new DOMParser().parseFromString(html, 'text/html');
    const result = detectActiveWorkflow('https://ttdevasthanams.ap.gov.in/sed/special-entry', mockDoc);
    expect(result).toBeDefined();
    expect(result?.serviceId).toBe('special-entry-darshan-300');
  });

  it('detects Padmavathi ₹200 from DOM containing "Padmavathi Ammavari" text', () => {
    const html = '<html><body>Padmavathi Ammavari Temple Supadham Entry</body></html>';
    const mockDoc = new DOMParser().parseFromString(html, 'text/html');
    const result = detectActiveWorkflow('https://ttdevasthanams.ap.gov.in/padmavathi', mockDoc);
    expect(result).toBeDefined();
    expect(result?.serviceId).toBe('padmavathi-supadham-entry-200');
  });
});

// ─── Section 19 Test C — Sri Srinivasa Divyanugraha Homam Workflow in Registry ───
describe('Workflow Registry — Sri Srinivasa Divyanugraha Homam', () => {
  it('is registered in the workflow registry', () => {
    const all = getAllWorkflows();
    const found = all.find(w => w.serviceId === 'sri-srinivasa-divyanugraha-homam');
    expect(found).toBeDefined();
  });

  it('can be retrieved by serviceId', () => {
    const workflow = getWorkflowById('sri-srinivasa-divyanugraha-homam');
    expect(workflow).toBeDefined();
    expect(workflow!.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    expect(workflow!.ticketPrice).toBe(1600);
    expect(workflow!.temple).toContain('Tirumala');
  });

  it('enforces exactly 2 persons limit and ₹1600 total', () => {
    const workflow = getWorkflowById('sri-srinivasa-divyanugraha-homam');
    expect(workflow!.maxPilgrims).toBe(2);
    expect(workflow!.minPilgrims).toBe(2);
    expect(workflow!.ticketPrice).toBe(1600);
  });

  it('has General Details step BEFORE Pilgrim Details step', () => {
    const workflow = getWorkflowById('sri-srinivasa-divyanugraha-homam');
    expect(workflow!.hasGeneralDetailsStep).toBe(true);

    const generalStep = workflow!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    const pilgrimStep = workflow!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(generalStep).toBeDefined();
    expect(pilgrimStep).toBeDefined();
    expect(generalStep!.order).toBeLessThan(pilgrimStep!.order);
  });

  it('requires Gothram in General Details and forbids mobile requirement', () => {
    const workflow = getWorkflowById('sri-srinivasa-divyanugraha-homam');
    const generalStep = workflow!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(generalStep!.requiredFields).toContain('gothram');
    expect(generalStep!.requiredFields).not.toContain('mobile');
    expect(generalStep!.fieldClassifications['gothram']).toBe('REQUIRED');
    expect(generalStep!.fieldClassifications['mobile']).toBeUndefined();
  });
});

// ─── Padmavathi ₹200 Distinct Characteristics ─────────────────
describe('Workflow Registry — Padmavathi ₹200 vs SED ₹300 Differences', () => {
  it('Padmavathi allows up to 6 pilgrims and does NOT have General Details step', () => {
    const padmavathi = getWorkflowById('padmavathi-supadham-entry-200');
    expect(padmavathi!.maxPilgrims).toBe(6);
    expect(padmavathi!.hasGeneralDetailsStep).toBe(false);
    const generalStep = padmavathi!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(generalStep).toBeUndefined();
    const pilgrimStep = padmavathi!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    expect(pilgrimStep).toBeDefined();
    expect(pilgrimStep!.isAutomatedAutofill).toBe(true);
  });

  it('SED ₹300 allows General Details autofill after Pilgrim Details', () => {
    const sed = getWorkflowById('special-entry-darshan-300');
    expect(sed!.hasGeneralDetailsStep).toBe(true);
    const pilgrimStep = sed!.steps.find(s => s.stepType === 'PILGRIM_DETAILS');
    const generalStep = sed!.steps.find(s => s.stepType === 'GENERAL_DETAILS');
    expect(pilgrimStep).toBeDefined();
    expect(generalStep).toBeDefined();
    expect(generalStep!.isAutomatedAutofill).toBe(true);
    expect(pilgrimStep!.isAutomatedAutofill).toBe(true);
    expect(pilgrimStep!.order).toBeLessThan(generalStep!.order);
  });
});

// ─── Uncertainty Resolution — resolveWorkflowWithConfidence ───
describe('Workflow Registry — resolveWorkflowWithConfidence and Uncertainty Margin', () => {
  it('returns high confidence and isUncertain=false for clear match', () => {
    const html = '<html><body>Sri Srinivasa Divyanugraha Homam Alipiri Sapthagiri Pradakshina Mandapam</body></html>';
    const mockDoc = new DOMParser().parseFromString(html, 'text/html');
    const res = resolveWorkflowWithConfidence('https://ttdevasthanams.ap.gov.in/homam', mockDoc);

    expect(res.workflow?.serviceId).toBe('sri-srinivasa-divyanugraha-homam');
    expect(res.confidence).toBeGreaterThanOrEqual(50);
    expect(res.isUncertain).toBe(false);
  });

  it('returns isUncertain=true with warning message when no service matches', () => {
    const html = '<html><body>Random non-TTD page content</body></html>';
    const mockDoc = new DOMParser().parseFromString(html, 'text/html');
    const res = resolveWorkflowWithConfidence('https://example.com/unrelated', mockDoc);

    expect(res.workflow).toBeUndefined();
    expect(res.confidence).toBe(0);
    expect(res.isUncertain).toBe(true);
    expect(res.message).toBe('Service workflow not recognized. Autofill is paused.');
  });
});

