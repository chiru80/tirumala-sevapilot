// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Page Workflow / Step Detection
// Detects the active TTD booking step by inspecting
// visible forms/sections, NOT body.textContent
// ─────────────────────────────────────────────────

import { isElementVisible } from './field-resolver';
import { findLabelText } from '../form-scanner';
import logger from '@shared/logger';

import {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from '../../services/workflows/step-detectors';
import type { WorkflowStepType, ServiceWorkflow } from '../../services/workflows/types';
import type { BookingStep } from './types';

export type { BookingStep };

/**
 * Detect the active booking step by inspecting visible form sections.
 *
 * Does NOT rely on document.body.textContent.
 * Only inspects visible forms/sections, step indicators, and actual controls.
 */
export function detectActiveBookingStep(doc: Document = document, url: string = ''): BookingStep {
  const targetUrl = url || (doc as any)?.location?.href || (typeof window !== 'undefined' ? window.location?.href : '') || '';

  // Srivari Seva specific route and form detection
  if (detectSrivariSevaEnrollment(doc, targetUrl).isCurrentStep) {
    return 'SRIVARI_SEVA_ENROLLMENT';
  }
  if (detectSrivariSevaInstructions(doc, targetUrl).isCurrentStep) {
    return 'INSTRUCTIONS_REVIEW';
  }

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

  // Strategy 2: Check visible section headings & titles
  const visibleHeadings = Array.from(doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, .section-title, .form-title, .card-title, mat-card-title, .step-title, .card-header, legend, [class*="header" i], [class*="title" i], [class*="heading" i], div, p, span, strong, b'
  )).filter(el => {
    if (!isElementVisible(el)) return false;
    const t = (el.textContent || '').trim().toLowerCase();
    return t.length > 0 && t.length < 60;
  });

  for (const heading of visibleHeadings) {
    const text = (heading.textContent || '').toLowerCase();
    if (text.includes('pilgrim details') || text.includes('devotee details') || text.includes('pilgrim information')) {
      return 'PILGRIM_DETAILS';
    }
    if (text.includes('general details') || text.includes('contact details') || text.includes('address details')) {
      return 'GENERAL_DETAILS';
    }
  }

  // Strategy 3: URL pattern match if page is on pilgrim/darshan path.
  // IMPORTANT: TTD can keep /pilgrim-details in the URL after moving to the
  // General Details section. Never let that stale route token override a
  // strong live General Details signal.
  const liveGeneralDetails = detectGeneralDetails(doc, targetUrl);
  if (liveGeneralDetails.isCurrentStep && liveGeneralDetails.confidence >= 65) {
    return 'GENERAL_DETAILS';
  }

  // Legacy URL fallback is used only when the live DOM does not identify General Details.
  if (targetUrl && (/pilgrim_details|flow=spat|spat.*pilgrim|\/spat\/|\/sed\/.*pilgrim/i.test(targetUrl) || (/pilgrim|devotee/i.test(targetUrl) && !/payment/i.test(targetUrl)))) {
    return 'PILGRIM_DETAILS';
  }

  // Strategy 4: Detect by visible form field patterns & interactive status
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

  const countedElements = new Set<Element>();

  const nameInputs = doc.querySelectorAll<HTMLElement>(
    'input[formcontrolname*="name" i], input[name*="pilgrimName" i], input[name*="devoteeName" i], input[placeholder*="name" i]:not([type="email"]):not([placeholder*="city" i]):not([placeholder*="state" i])'
  );
  for (const el of Array.from(nameInputs)) {
    if (isVisibleFormField(el) && !countedElements.has(el)) {
      countedElements.add(el);
      score++;
      if (doc.activeElement === el) hasActiveInput = true;
    }
  }

  const ageInputs = doc.querySelectorAll<HTMLElement>(
    'input[formcontrolname*="age" i], input[name*="age" i], input[type="number"][placeholder*="age" i]'
  );
  for (const el of Array.from(ageInputs)) {
    if (isVisibleFormField(el) && !countedElements.has(el)) {
      countedElements.add(el);
      score++;
    }
  }

  const genderSelects = doc.querySelectorAll<HTMLElement>(
    'select[formcontrolname*="gender" i], mat-select[formcontrolname*="gender" i], [formcontrolname*="gender" i]'
  );
  for (const el of Array.from(genderSelects)) {
    if (isVisibleFormField(el) && !countedElements.has(el)) {
      countedElements.add(el);
      score++;
    }
  }

  const idProofSelects = doc.querySelectorAll<HTMLElement>(
    'select[formcontrolname*="proof" i], mat-select[formcontrolname*="proof" i], [formcontrolname*="idtype" i], [formcontrolname*="idproof" i]'
  );
  for (const el of Array.from(idProofSelects)) {
    if (isVisibleFormField(el) && !countedElements.has(el)) {
      countedElements.add(el);
      score++;
    }
  }

  // Also check form controls by their visible associated labels
  const allControls = doc.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, mat-select, [role="combobox"]');
  for (const el of Array.from(allControls)) {
    if (countedElements.has(el) || !isVisibleFormField(el)) continue;
    const lbl = (findLabelText(el, doc) || '').toLowerCase();
    if (!lbl) continue;
    if (lbl.includes('name') && !lbl.includes('user') && !lbl.includes('login') && !lbl.includes('photo') && !lbl.includes('id')) {
      countedElements.add(el);
      score++;
      if (doc.activeElement === el) hasActiveInput = true;
    } else if (lbl.includes('age') || lbl.includes('years')) {
      countedElements.add(el);
      score++;
    } else if (lbl.includes('gender') || lbl.includes('sex')) {
      countedElements.add(el);
      score++;
    } else if (lbl.includes('id proof') || lbl.includes('photo id proof') || lbl.includes('id type') || lbl.includes('identity proof')) {
      countedElements.add(el);
      score++;
    } else if (lbl.includes('id number') || lbl.includes('photo id number') || lbl.includes('photo id no') || lbl.includes('aadhaar')) {
      countedElements.add(el);
      score++;
    }
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



export {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
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
  if (detectSrivariSevaInstructions(doc, url).isCurrentStep) return 'INSTRUCTIONS_REVIEW';
  if (detectSrivariSevaEnrollment(doc, url).isCurrentStep) return 'SRIVARI_SEVA_ENROLLMENT';
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

  const basic = detectActiveBookingStep(doc, url);
  if (basic === 'INSTRUCTIONS_REVIEW') return 'INSTRUCTIONS_REVIEW';
  if (basic === 'SRIVARI_SEVA_ENROLLMENT') return 'SRIVARI_SEVA_ENROLLMENT';
  if (basic === 'PILGRIM_DETAILS') return 'PILGRIM_DETAILS';
  if (basic === 'GENERAL_DETAILS') return 'GENERAL_DETAILS';

  return 'UNKNOWN';
}

