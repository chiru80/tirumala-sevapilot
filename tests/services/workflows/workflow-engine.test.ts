// ─────────────────────────────────────────────────────────────
// Phase 3 — Workflow Engine Tests
// evaluateStepReadiness, canExecuteAutofill, resolveActiveStep
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  evaluateStepReadiness,
  canExecuteAutofill,
} from '../../../src/services/workflows/workflow-engine';
import { getWorkflowById } from '../../../src/services/workflows/registry';
import type { ServiceWorkflow, WorkflowStepDefinition } from '../../../src/services/workflows/types';
import { IdType, Gender } from '../../../src/shared/types';
import type { Profile, Pilgrim } from '../../../src/shared/types';

// ─── Helpers ─────────────────────────────────────────────────

function makeReadyPilgrim(id: string): Pilgrim {
  return {
    id,
    firstName: 'Venkata',
    lastName: 'Rao',
    fullName: 'Venkata Rao',
    gender: Gender.MALE,
    age: 42,
    idType: IdType.PASSPORT,
    idNumber: 'A1234567',
    country: 'India',
    createdAt: new Date().toISOString(),
  };
}

function makeReadyProfile(pilgrims: Pilgrim[]): Profile {
  return {
    id: 'test-profile',
    name: 'Test Profile',
    pilgrims,
    selectedPilgrims: {},
    isDefault: true,
    general: {
      mobile: '9876543210',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pinCode: '500001',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── canExecuteAutofill ───────────────────────────────────────

describe('Workflow Engine — canExecuteAutofill', () => {
  it('Test E: returns paused with message when workflow is undefined (unknown service)', () => {
    const result = canExecuteAutofill(undefined, undefined);
    expect(result.canFill).toBe(false);
    expect(result.reason).toContain('Service workflow not recognized');
  });

  it('returns paused when currentStep is undefined', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const result = canExecuteAutofill(workflow, undefined);
    expect(result.canFill).toBe(false);
    expect(result.reason).toContain('could not be safely identified');
  });

  it('returns paused for DIGITAL_QUEUE step (no bypass allowed)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const queueStep = workflow.steps.find(s => s.stepType === 'DIGITAL_QUEUE')!;
    const result = canExecuteAutofill(workflow, queueStep);
    expect(result.canFill).toBe(false);
  });

  it('returns paused for PAYMENT step (user must control payment)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const paymentStep = workflow.steps.find(s => s.stepType === 'PAYMENT')!;
    const result = canExecuteAutofill(workflow, paymentStep);
    expect(result.canFill).toBe(false);
    expect(result.reason).toContain('user-controlled');
  });

  it('returns canFill=true for PILGRIM_DETAILS step in SED ₹300', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const result = canExecuteAutofill(workflow, pilgrimStep);
    expect(result.canFill).toBe(true);
  });

  it('returns canFill=true for GENERAL_DETAILS step in SED ₹300', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const generalStep = workflow.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
    const result = canExecuteAutofill(workflow, generalStep);
    expect(result.canFill).toBe(true);
  });

  it('CRITICAL: returns canFill=false for GENERAL_DETAILS on Padmavathi ₹200 (no general step)', () => {
    const padmaWorkflow = getWorkflowById('padmavathi-supadham-entry-200')!;
    // Simulate if somehow a general step were passed for this workflow
    const mockGeneralStep: WorkflowStepDefinition = {
      stepId: 'fake_general',
      stepType: 'GENERAL_DETAILS',
      name: 'General Details',
      order: 99,
      description: 'Should not exist for Padmavathi',
      isAutomatedAutofill: true,
      requiredFields: ['city'],
      optionalFields: [],
      prohibitedFields: [],
      fieldClassifications: {},
      detect: () => ({ isCurrentStep: false, confidence: 0 }),
    };
    const result = canExecuteAutofill(padmaWorkflow, mockGeneralStep);
    expect(result.canFill).toBe(false);
    expect(result.reason).toContain('does not have a General Details step');
  });
});

// ─── evaluateStepReadiness ────────────────────────────────────

describe('Workflow Engine — evaluateStepReadiness', () => {
  it('returns unknown status when workflow is undefined', () => {
    const result = evaluateStepReadiness(undefined, undefined, null, []);
    expect(result.isComplete).toBe(false);
    expect(result.stepType).toBe('UNKNOWN');
    expect(result.statusMessage).toContain('Service workflow not recognized');
  });

  it('returns queue status for DIGITAL_QUEUE step', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const queueStep = workflow.steps.find(s => s.stepType === 'DIGITAL_QUEUE')!;
    const result = evaluateStepReadiness(workflow, queueStep, null, []);
    expect(result.stepType).toBe('DIGITAL_QUEUE');
    expect(result.isComplete).toBe(false);
  });

  it('returns score 0 for PILGRIM_DETAILS when no pilgrims selected', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const result = evaluateStepReadiness(workflow, pilgrimStep, null, []);
    expect(result.isComplete).toBe(false);
    expect(result.score).toBe(0);
  });

  it('returns score 100 for PILGRIM_DETAILS when all pilgrims are ready', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const pilgrim = makeReadyPilgrim('p1');
    const profile = makeReadyProfile([pilgrim]);
    const result = evaluateStepReadiness(workflow, pilgrimStep, profile, [pilgrim]);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });

  // Section 19 Test C & D — Mobile Optional
  it('Test C: PILGRIM_DETAILS is 100% when mobile is absent (mobile is OPTIONAL)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const pilgrim = makeReadyPilgrim('p1');
    // Explicitly ensure no mobile
    delete (pilgrim as any).mobile;
    const profile = makeReadyProfile([pilgrim]);
    const result = evaluateStepReadiness(workflow, pilgrimStep, profile, [pilgrim]);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missingFields).not.toContain('mobile');
  });

  it('Test D: PILGRIM_DETAILS is 100% when mobile IS populated (optional filled)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const pilgrim = makeReadyPilgrim('p1');
    pilgrim.mobile = '9876543210';
    const profile = makeReadyProfile([pilgrim]);
    const result = evaluateStepReadiness(workflow, pilgrimStep, profile, [pilgrim]);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });

  it('Test C (Padmavathi): mobile absent does not affect PILGRIM_DETAILS readiness', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const pilgrim = makeReadyPilgrim('p1');
    delete (pilgrim as any).mobile;
    const profile = makeReadyProfile([pilgrim]);
    const result = evaluateStepReadiness(workflow, pilgrimStep, profile, [pilgrim]);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });

  it('GENERAL_DETAILS returns ready immediately for Padmavathi (no general step)', () => {
    const workflow = getWorkflowById('padmavathi-supadham-entry-200')!;
    // There's no GENERAL_DETAILS step in this workflow, but if engine is called with one,
    // it should immediately return complete since hasGeneralDetailsStep is false
    const mockGeneralStep: WorkflowStepDefinition = {
      stepId: 'fake',
      stepType: 'GENERAL_DETAILS',
      name: 'General',
      order: 99,
      description: 'N/A',
      isAutomatedAutofill: true,
      requiredFields: ['city', 'state'],
      optionalFields: [],
      prohibitedFields: [],
      fieldClassifications: {},
      detect: () => ({ isCurrentStep: false, confidence: 0 }),
    };
    const result = evaluateStepReadiness(workflow, mockGeneralStep, null, []);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.statusMessage).toContain('not required');
  });

  it('GENERAL_DETAILS returns correctly for SED ₹300 when all fields present', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const generalStep = workflow.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
    const profile = makeReadyProfile([makeReadyPilgrim('p1')]);
    const result = evaluateStepReadiness(workflow, generalStep, profile, []);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });

  it('GENERAL_DETAILS returns incomplete for SED ₹300 when city is missing', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const generalStep = workflow.steps.find(s => s.stepType === 'GENERAL_DETAILS')!;
    const profile = makeReadyProfile([]);
    profile.general = { state: 'Telangana', country: 'India', pinCode: '500001' }; // city missing
    const result = evaluateStepReadiness(workflow, generalStep, profile, []);
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toContain('city');
  });

  it('PAYMENT step returns 100% and correct status message', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const paymentStep = workflow.steps.find(s => s.stepType === 'PAYMENT')!;
    const result = evaluateStepReadiness(workflow, paymentStep, null, []);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.statusMessage).toContain('manually');
  });

  it('REVIEW_DETAILS step returns 100% ready (no autofill required)', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const reviewStep = workflow.steps.find(s => s.stepType === 'REVIEW_DETAILS')!;
    const result = evaluateStepReadiness(workflow, reviewStep, null, []);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });

  it('Multi-pilgrim: all 3 ready pilgrims produce score 100', () => {
    const workflow = getWorkflowById('special-entry-darshan-300')!;
    const pilgrimStep = workflow.steps.find(s => s.stepType === 'PILGRIM_DETAILS')!;
    const pilgrims = [
      makeReadyPilgrim('p1'),
      makeReadyPilgrim('p2'),
      makeReadyPilgrim('p3'),
    ];
    const profile = makeReadyProfile(pilgrims);
    const result = evaluateStepReadiness(workflow, pilgrimStep, profile, pilgrims);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
  });
});
