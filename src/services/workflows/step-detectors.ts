// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 3 Workflow Step Detectors
// Robust multi-signal step & page detection
// ─────────────────────────────────────────────────────────────

import { isElementVisible } from '../../content/autofill/field-resolver';

/**
 * Check if the current page is in a digital queue / waiting state.
 */
export function detectDigitalQueue(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  // URL patterns
  if (/queue|waiting.*room|virtual.*queue|throttle|holding/i.test(url)) {
    score += 40;
  }

  // Common TTD / Cloudflare / Queue-it queue markers
  const queueSelectors = [
    '#queue-it_log',
    '#waitingRoom',
    '.queue-container',
    '.waiting-room',
    '[data-testid*="queue"]',
    '#queueStatus',
    '.virtual-queue',
    '.progress-queue',
    '#divQueue',
  ];

  for (const sel of queueSelectors) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 40;
      break;
    }
  }

  // Text tokens
  const pageText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
  const queueTokens = [
    'you are in queue',
    'waiting room',
    'estimated wait time',
    'please wait while we transfer you',
    'virtual queue',
    'queue number',
    'please do not refresh',
    'high demand',
  ];

  for (const token of queueTokens) {
    if (pageText.includes(token)) {
      score += 35;
      break;
    }
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Availability / Quota calendar step.
 */
export function detectAvailability(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/availability|quota|calendar|date-selection/i.test(url)) {
    score += 35;
  }

  const calendarMarkers = [
    'mat-calendar',
    '.mat-calendar',
    '.ui-datepicker',
    '.p-datepicker',
    '.calendar-container',
    '[data-testid*="calendar"]',
    '.quota-status',
    '.available-date',
  ];

  for (const sel of calendarMarkers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 35;
      break;
    }
  }

  const pageText = (doc.body?.innerText || '').toLowerCase();
  if (pageText.includes('select date') || pageText.includes('quota availability') || pageText.includes('green denotes available')) {
    score += 30;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Slot / Time Selection step.
 */
export function detectSlotSelection(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/slot|time-selection|select-slot/i.test(url)) {
    score += 35;
  }

  const slotMarkers = [
    '.slot-container',
    '.time-slot',
    '.slot-pill',
    'input[name*="slot" i]',
    'mat-button-toggle-group[name*="slot" i]',
    '[data-testid*="slot"]',
  ];

  for (const sel of slotMarkers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 35;
      break;
    }
  }

  const pageText = (doc.body?.innerText || '').toLowerCase();
  if (pageText.includes('select time slot') || pageText.includes('available slots') || pageText.includes('darshan time')) {
    score += 30;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Homam / Seva Booking Selection step.
 * Applies to Sri Srinivasa Divyanugraha Homam and similar Seva services.
 * Appears BEFORE the General Details step in those workflows.
 */
export function detectHomamSelection(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/homam|seva|srinivasa|divyanugraha/i.test(url)) {
    score += 40;
  }

  // Section heading markers
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-title, .step-title, mat-card-title'));
  for (const h of headings) {
    if (isElementVisible(h as HTMLElement)) {
      const text = (h.textContent || '').toLowerCase();
      if (
        text.includes('homam') ||
        text.includes('seva booking') ||
        text.includes('srinivasa') ||
        text.includes('divyanugraha')
      ) {
        score += 45;
        break;
      }
    }
  }

  // DOM markers specific to homam / seva booking
  const homamMarkers = [
    'input[formcontrolname*="homam" i]',
    'select[formcontrolname*="sevaType" i]',
    'input[formcontrolname*="seva" i]',
    '.homam-selection',
    '.seva-booking',
    '[data-testid*="homam"]',
    '[data-testid*="seva"]',
  ];

  for (const sel of homamMarkers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 40;
      break;
    }
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}


/**
 * Detect Additional Services step (Optional Laddus, Hundi).
 */
export function detectAdditionalServices(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/additional-service|prasad|laddu|hundi/i.test(url)) {
    score += 35;
  }

  const markers = [
    'input[name*="laddu" i]',
    'input[formcontrolname*="laddu" i]',
    'input[name*="hundi" i]',
    'input[formcontrolname*="hundi" i]',
    '.laddu-selection',
    '.hundi-offering',
  ];

  for (const sel of markers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 40;
      break;
    }
  }

  const pageText = (doc.body?.innerText || '').toLowerCase();
  if (pageText.includes('additional laddu') || pageText.includes('extra laddu') || pageText.includes('hundi offering')) {
    score += 30;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Pilgrim Details step (Name, Age, Gender, ID Proof, ID Number).
 */
export function detectPilgrimDetails(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/pilgrim|devotee|passenger|darshan-entry/i.test(url)) {
    score += 25;
  }

  // Check section title or headings
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-title, .step-title, mat-card-title'));
  for (const h of headings) {
    if (isElementVisible(h as HTMLElement)) {
      const text = (h.textContent || '').toLowerCase();
      if (text.includes('pilgrim details') || text.includes('devotee details') || text.includes('pilgrim information')) {
        score += 45;
        break;
      }
    }
  }

  // Check visible devotee form inputs
  const devoteeInputs = doc.querySelectorAll(
    'input[formcontrolname*="name" i], input[name*="pilgrim" i], select[formcontrolname*="gender" i], input[formcontrolname*="age" i], select[formcontrolname*="proof" i]'
  );

  let visibleCount = 0;
  for (const input of Array.from(devoteeInputs)) {
    if (isElementVisible(input as HTMLElement)) {
      visibleCount++;
    }
  }

  if (visibleCount >= 3) {
    score += 40;
  } else if (visibleCount >= 1) {
    score += 20;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect General Details step (Email, City, State, Country, Pincode).
 */
export function detectGeneralDetails(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/general|contact|address/i.test(url)) {
    score += 25;
  }

  // Check section headings
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-title, .step-title, mat-card-title'));
  for (const h of headings) {
    if (isElementVisible(h as HTMLElement)) {
      const text = (h.textContent || '').toLowerCase();
      if (text.includes('general details') || text.includes('contact details') || text.includes('address details')) {
        score += 45;
        break;
      }
    }
  }

  // Check visible general inputs (city, state, pin, email)
  const generalInputs = doc.querySelectorAll(
    'input[type="email"], input[formcontrolname*="email" i], input[formcontrolname*="city" i], select[formcontrolname*="state" i], input[formcontrolname*="pincode" i], input[formcontrolname*="pinCode" i]'
  );

  let visibleCount = 0;
  for (const input of Array.from(generalInputs)) {
    if (isElementVisible(input as HTMLElement)) {
      visibleCount++;
    }
  }

  if (visibleCount >= 2) {
    score += 40;
  } else if (visibleCount >= 1) {
    score += 20;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Review Details step.
 */
export function detectReviewDetails(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  if (/review|summary|preview|verify-details/i.test(url)) {
    score += 35;
  }

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-title, .step-title, mat-card-title'));
  for (const h of headings) {
    if (isElementVisible(h as HTMLElement)) {
      const text = (h.textContent || '').toLowerCase();
      if (text.includes('review booking') || text.includes('booking summary') || text.includes('review details')) {
        score += 45;
        break;
      }
    }
  }

  const reviewMarkers = [
    '.review-container',
    '.booking-summary',
    '.summary-card',
    '[data-testid*="review"]',
    '#bookingSummary',
  ];

  for (const sel of reviewMarkers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 35;
      break;
    }
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect Payment Gateway step.
 * IMPORTANT: This step is strictly monitored for user safety. SevaPilot NEVER automates payment.
 */
export function detectPayment(doc: Document = document, url: string = ''): { isCurrentStep: boolean; confidence: number } {
  let score = 0;

  // Known gateway patterns (BillDesk, Razorpay, SBI, Axis, HDFC, payment-gateway)
  const gatewayUrlRegex = /billdesk|razorpay|sbiepay|paygov|atomtech|payment|pgi|checkout|pg-checkout/i;
  if (gatewayUrlRegex.test(url)) {
    score += 60;
  }

  const paymentMarkers = [
    '#paymentForm',
    '.payment-gateway',
    '.pg-container',
    '[data-testid*="payment"]',
    '#btnPayNow',
    'button[name*="pay" i]',
    'input[name*="paymentMode" i]',
    '.payment-mode',
  ];

  for (const sel of paymentMarkers) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 30;
      break;
    }
  }

  const pageText = (doc.body?.innerText || '').toLowerCase();
  if (
    pageText.includes('proceed to payment') ||
    pageText.includes('select payment option') ||
    pageText.includes('credit / debit card') ||
    pageText.includes('net banking') ||
    pageText.includes('upi / qr')
  ) {
    score += 25;
  }

  const confidence = Math.min(100, score);
  return {
    isCurrentStep: confidence >= 40,
    confidence,
  };
}

/**
 * Detect actual allowed ticket quantity on the page if reported.
 * Protects against future TTD changes (e.g. if Homam allows a limit other than 2).
 */
export function detectPageTicketLimit(doc: Document = document): number | null {
  const text = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
  
  // Look for patterns like "1 person", "2 persons", "max 2 persons", "quota: 2"
  const match = text.match(/(?:max(?:imum)?\s*)?(\d+)\s*(?:person|persons|devotee|devotees|ticket|tickets|pilgrim|pilgrims)\s*(?:per\s*(?:booking|transaction|quota))?/i);
  if (match) {
    const count = parseInt(match[1], 10);
    if (!isNaN(count) && count > 0 && count <= 10) {
      return count;
    }
  }

  // Also check ticket quantity select / dropdown if present
  const qtySelect = doc.querySelector<HTMLSelectElement>('select[formcontrolname*="ticket" i], select[name*="person" i], select[name*="count" i]');
  if (qtySelect && qtySelect.options.length > 0) {
    const maxVal = Math.max(...Array.from(qtySelect.options).map(o => parseInt(o.value, 10)).filter(n => !isNaN(n)));
    if (maxVal > 0) return maxVal;
  }

  return null;
}

