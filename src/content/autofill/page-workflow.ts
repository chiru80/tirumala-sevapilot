// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Page Workflow / Step Detection
// Detects the active TTD booking step by inspecting
// visible forms/sections, NOT body.textContent
// ─────────────────────────────────────────────────

import { isElementVisible } from './field-resolver';
import logger from '@shared/logger';

export type BookingStep = 'PILGRIM_DETAILS' | 'GENERAL_DETAILS' | 'UNKNOWN';

/**
 * Detect the active booking step by inspecting visible form sections.
 *
 * Does NOT rely on document.body.textContent.
 * Only inspects visible forms/sections, step indicators, and actual controls.
 */
export function detectActiveBookingStep(doc: Document = document): BookingStep {
  // Strategy 1: Check visible step indicators
  const stepIndicators = Array.from(doc.querySelectorAll<HTMLElement>(
    '.step-indicator, .stepper, .wizard-step, mat-step-header, .mat-step-header, .mat-mdc-step-header, [role="tab"], .nav-step, .progress-step'
  )).filter(el => isElementVisible(el));

  for (const indicator of stepIndicators) {
    const isActive = indicator.classList.contains('active')
      || indicator.classList.contains('mat-step-header-selected')
      || indicator.getAttribute('aria-selected') === 'true'
      || indicator.classList.contains('current');

    if (isActive) {
      const text = (indicator.textContent || '').toLowerCase();
      if (text.includes('pilgrim') || text.includes('devotee') || text.includes('personal')) {
        return 'PILGRIM_DETAILS';
      }
      if (text.includes('general') || text.includes('contact') || text.includes('address')) {
        return 'GENERAL_DETAILS';
      }
    }
  }

  // Strategy 2: Check visible section headings
  const visibleHeadings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, .section-title, .form-title, .card-title, mat-card-title, .step-title'
  )).filter(el => isElementVisible(el));

  for (const heading of visibleHeadings) {
    const text = (heading.textContent || '').toLowerCase();
    if (text.includes('pilgrim details') || text.includes('devotee details') || text.includes('pilgrim information')) {
      return 'PILGRIM_DETAILS';
    }
    if (text.includes('general details') || text.includes('contact details') || text.includes('address details')) {
      return 'GENERAL_DETAILS';
    }
  }

  // Strategy 3: Detect by visible form field patterns & interactive status
  const pilgrimFields = countVisiblePilgrimFields(doc);
  const generalFields = countVisibleGeneralFields(doc);

  // If one group clearly dominates
  if (pilgrimFields.score >= 2 && generalFields.score === 0) {
    return 'PILGRIM_DETAILS';
  }
  if (generalFields.score >= 2 && pilgrimFields.score === 0) {
    return 'GENERAL_DETAILS';
  }

  // Strategy 4: Check for visible sections containing the fields
  const pilgrimSections = findVisibleSectionsWithFields(doc, [
    'input[formcontrolname*="name" i]',
    'input[formcontrolname*="age" i]',
    'select[formcontrolname*="gender" i], mat-select[formcontrolname*="gender" i]',
    'select[formcontrolname*="proof" i], mat-select[formcontrolname*="proof" i]',
  ]);

  const generalSections = findVisibleSectionsWithFields(doc, [
    'input[type="email"], input[formcontrolname*="email" i]',
    'input[type="tel"], input[formcontrolname*="mobile" i]',
    'input[formcontrolname*="city" i]',
    'select[formcontrolname*="state" i], mat-select[formcontrolname*="state" i]',
  ]);

  // When both pilgrim and general fields exist in DOM:
  // Inspect focus, interactive state, and section dominance
  if (pilgrimFields.score >= 2 && generalFields.score >= 2) {
    if (pilgrimFields.hasActiveInput && !generalFields.hasActiveInput) {
      return 'PILGRIM_DETAILS';
    }
    if (generalFields.hasActiveInput && !pilgrimFields.hasActiveInput) {
      return 'GENERAL_DETAILS';
    }
    if (pilgrimSections > generalSections + 1) {
      return 'PILGRIM_DETAILS';
    }
    if (generalSections > pilgrimSections + 1) {
      return 'GENERAL_DETAILS';
    }
    // Ambiguous state: both field sets coexist without clear active indicator or focused field.
    // Quality principle: never make a dangerous guess — return UNKNOWN.
    logger.warn(`Ambiguous booking step: pilgrim score ${pilgrimFields.score} vs general score ${generalFields.score}`);
    return 'UNKNOWN';
  }

  if (pilgrimFields.score >= 2 && pilgrimFields.score > generalFields.score) {
    return 'PILGRIM_DETAILS';
  }
  if (generalFields.score >= 2 && generalFields.score > pilgrimFields.score) {
    return 'GENERAL_DETAILS';
  }

  return 'UNKNOWN';
}

interface FieldDetectionScore {
  score: number;
  hasActiveInput: boolean;
}

function countVisiblePilgrimFields(doc: Document): FieldDetectionScore {
  let score = 0;
  let hasActiveInput = false;

  const nameInputs = doc.querySelectorAll<HTMLElement>(
    'input[formcontrolname*="name" i], input[name*="pilgrimName" i], input[name*="devoteeName" i], input[placeholder*="name" i]:not([type="email"]):not([placeholder*="city" i]):not([placeholder*="state" i])'
  );
  for (const el of Array.from(nameInputs)) {
    if (isVisibleFormField(el)) {
      score++;
      if (doc.activeElement === el) hasActiveInput = true;
    }
  }

  const ageInputs = doc.querySelectorAll<HTMLElement>(
    'input[formcontrolname*="age" i], input[name*="age" i], input[type="number"][placeholder*="age" i]'
  );
  for (const el of Array.from(ageInputs)) {
    if (isVisibleFormField(el)) { score++; }
  }

  const genderSelects = doc.querySelectorAll<HTMLElement>(
    'select[formcontrolname*="gender" i], mat-select[formcontrolname*="gender" i], [formcontrolname*="gender" i]'
  );
  for (const el of Array.from(genderSelects)) {
    if (isVisibleFormField(el)) { score++; }
  }

  const idProofSelects = doc.querySelectorAll<HTMLElement>(
    'select[formcontrolname*="proof" i], mat-select[formcontrolname*="proof" i], [formcontrolname*="idtype" i], [formcontrolname*="idproof" i]'
  );
  for (const el of Array.from(idProofSelects)) {
    if (isVisibleFormField(el)) { score++; }
  }

  return { score, hasActiveInput };
}

function countVisibleGeneralFields(doc: Document): FieldDetectionScore {
  let score = 0;
  let hasActiveInput = false;

  const emailInputs = doc.querySelectorAll<HTMLElement>(
    'input[type="email"], input[formcontrolname*="email" i], input[name*="email" i]'
  );
  for (const el of Array.from(emailInputs)) {
    if (isVisibleFormField(el)) {
      score++;
      if (doc.activeElement === el) hasActiveInput = true;
    }
  }

  const mobileInputs = doc.querySelectorAll<HTMLElement>(
    'input[type="tel"], input[formcontrolname*="mobile" i], input[name*="mobile" i], input[name*="phone" i]'
  );
  for (const el of Array.from(mobileInputs)) {
    if (isVisibleFormField(el)) { score++; }
  }

  const cityInputs = doc.querySelectorAll<HTMLElement>(
    'input[formcontrolname*="city" i], input[name*="city" i]'
  );
  for (const el of Array.from(cityInputs)) {
    if (isVisibleFormField(el)) { score++; }
  }

  const stateSelects = doc.querySelectorAll<HTMLElement>(
    'select[formcontrolname*="state" i], mat-select[formcontrolname*="state" i], input[formcontrolname*="state" i]'
  );
  for (const el of Array.from(stateSelects)) {
    if (isVisibleFormField(el)) { score++; }
  }

  return { score, hasActiveInput };
}

function isVisibleFormField(el: HTMLElement): boolean {
  if (!isElementVisible(el)) return false;
  // Ensure it's not inside a hidden section
  const section = el.closest('section, .step-content, .mat-stepper-content, .tab-content, [role="tabpanel"]');
  if (section && !isElementVisible(section as HTMLElement)) return false;
  return true;
}

function findVisibleSectionsWithFields(doc: Document, selectors: string[]): number {
  let count = 0;
  for (const selector of selectors) {
    const elements = doc.querySelectorAll<HTMLElement>(selector);
    for (const el of Array.from(elements)) {
      if (isVisibleFormField(el)) {
        count++;
        break; // Only count once per selector
      }
    }
  }
  return count;
}

import {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
} from '../../services/workflows/step-detectors';
import type { WorkflowStepType, ServiceWorkflow } from '../../services/workflows/types';

export {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
};

/**
 * Detect the comprehensive Phase 3 workflow step.
 */
export function detectWorkflowStep(
  doc: Document = document,
  url: string = window.location.href,
  workflow?: ServiceWorkflow,
): WorkflowStepType {
  if (detectPayment(doc, url).isCurrentStep) return 'PAYMENT';
  if (detectDigitalQueue(doc, url).isCurrentStep) return 'DIGITAL_QUEUE';
  if (detectReviewDetails(doc, url).isCurrentStep) return 'REVIEW_DETAILS';
  if (detectGeneralDetails(doc, url).isCurrentStep) {
    if (workflow && !workflow.hasGeneralDetailsStep) {
      return 'REVIEW_DETAILS';
    }
    return 'GENERAL_DETAILS';
  }
  if (detectPilgrimDetails(doc, url).isCurrentStep) return 'PILGRIM_DETAILS';
  if (detectAdditionalServices(doc, url).isCurrentStep) return 'ADDITIONAL_SERVICES';
  if (detectSlotSelection(doc, url).isCurrentStep) return 'SLOT_SELECTION';
  if (detectAvailability(doc, url).isCurrentStep) return 'AVAILABILITY';

  const basic = detectActiveBookingStep(doc);
  if (basic === 'PILGRIM_DETAILS') return 'PILGRIM_DETAILS';
  if (basic === 'GENERAL_DETAILS') return 'GENERAL_DETAILS';

  return 'UNKNOWN';
}

