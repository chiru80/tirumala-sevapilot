// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Workflow #3: Sri Srinivasa Divyanugraha Homam
// Temple: Sri Venkateswara Swamy Temple, Tirumala
//
// VERIFIED FIELD ORDER (from observed TTD booking page):
//   Queue / Availability
//   → Homam Booking Selection
//   → GENERAL DETAILS   ← comes BEFORE Pilgrim Details
//   → PILGRIM DETAILS
//   → Review
//   → Payment
//
// GENERAL DETAILS FIELDS (all REQUIRED):
//   Gothram, Mobile, Email, Country, State, City, Pincode
//
// PILGRIM DETAILS FIELDS (all REQUIRED):
//   Name, Age, Gender, Photo ID Proof, Photo ID Number
//
// ARCHITECTURE RULE:
//   This workflow is COMPLETELY INDEPENDENT of:
//     • special-entry-darshan-300  (Pilgrim first, then General)
//     • padmavathi-supadham-entry-200  (No General Details at all)
//   It MUST NOT reuse their field ordering or required-field rules.
// ─────────────────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import type { ServiceWorkflow } from './types';
import {
  detectDigitalQueue,
  detectAvailability,
  detectHomamSelection,
  detectGeneralDetails,
  detectPilgrimDetails,
  detectReviewDetails,
  detectPayment,
} from './step-detectors';

export const SRI_SRINIVASA_DIVYANUGRAHA_HOMAM: ServiceWorkflow = {
  serviceId: 'sri-srinivasa-divyanugraha-homam',
  workflowVersion: '1.0.0',
  serviceName: 'Sri Srinivasa Divyanugraha Homam',
  serviceType: ServiceType.ARJITHA_SEVA,
  temple: 'Sri Venkateswara Swamy Temple, Tirumala',
  ticketPrice: 1600, // 2 persons = ₹1600 total
  maxPilgrims: 2,    // Exactly 2 persons per booking/login
  exactPilgrims: 2,  // Strictly 2 devotees per booking
  minPilgrims: 2,
  releaseWindow: {
    type: 'approximate-month-ahead',
    description: 'Homam availability is generally released approximately one month in advance. Check the official TTD availability page.',
  },

  // CRITICAL: This workflow HAS a General Details step AND it appears BEFORE Pilgrim Details.
  // This is the opposite of SED-300 where Pilgrim Details appears first.
  hasGeneralDetailsStep: true,

  additionalServices: [], // No additional services observed for this homam

  queueConfig: {
    canHaveQueue: true,
    queueSelectors: [
      '#queue-it_log',
      '#waitingRoom',
      '.queue-container',
      '[data-testid*="queue"]',
      '#queueStatus',
    ],
    queueTextTokens: [
      'you are in queue',
      'waiting room',
      'estimated wait time',
      'virtual queue',
      'please wait while we transfer you',
    ],
    statusMessages: {
      waiting: 'Waiting for Sri Srinivasa Divyanugraha Homam booking page...',
      detected: 'Queue detected. Please wait passively without refreshing.',
      ready: 'Homam booking page ready.',
    },
  },

  paymentConfig: {
    detectPayment: (doc, url) => detectPayment(doc, url).isCurrentStep,
    gatewaySelectors: [
      '#paymentForm',
      '.payment-gateway',
      '.pg-container',
      '#btnPayNow',
      'input[name*="paymentMode" i]',
    ],
    gatewayUrlPatterns: [
      /billdesk/i,
      /razorpay/i,
      /sbiepay/i,
      /paygov/i,
      /payment/i,
      /checkout/i,
    ],
    strictNonAutomation: true,
  },

  steps: [
    // ─── Step 0: Digital Queue ────────────────────────────────
    {
      stepId: 'homam_queue',
      stepType: 'DIGITAL_QUEUE',
      name: 'Digital Queue / Waiting Room',
      order: 0,
      description: 'Virtual queue / high-demand holding page',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectDigitalQueue(doc, url),
    },

    // ─── Step 1: Availability ─────────────────────────────────
    {
      stepId: 'homam_availability',
      stepType: 'AVAILABILITY',
      name: 'Homam Schedule / Availability',
      order: 1,
      description: 'Homam date and quota availability',
      isAutomatedAutofill: false,
      requiredFields: ['selectedDate'],
      optionalFields: [],
      prohibitedFields: ['fullName', 'idNumber', 'gothram'],
      fieldClassifications: {
        selectedDate: 'USER_CONTROLLED',
      },
      detect: (doc, url) => detectAvailability(doc, url),
    },

    // ─── Step 2: Homam Selection ──────────────────────────────
    {
      stepId: 'homam_selection',
      stepType: 'HOMAM_SELECTION',
      name: 'Homam Booking Selection',
      order: 2,
      description: 'Select the specific Homam / Seva type to book',
      isAutomatedAutofill: false,
      requiredFields: ['homamType'],
      optionalFields: [],
      prohibitedFields: ['fullName', 'idNumber', 'gothram'],
      fieldClassifications: {
        homamType: 'USER_CONTROLLED',
      },
      detect: (doc, url) => detectHomamSelection(doc, url),
    },

    // ─── Step 3: General Details (FIRST before Pilgrim) ───────
    //
    // ARCHITECTURE NOTE:
    // For Sri Srinivasa Divyanugraha Homam, General Details appears
    // BEFORE Pilgrim Details. This is the opposite of SED-300.
    //
    // ALL fields below are REQUIRED per the observed TTD booking page.
    // The workflow engine must consult this definition — NOT the
    // global profile defaults — to determine what is required here.
    //
    {
      stepId: 'homam_general',
      stepType: 'GENERAL_DETAILS',
      name: 'General Details (Booking Contact)',
      order: 3,
      description:
        'Booking contact and address details — appears BEFORE Pilgrim Details for this service. Mobile is not part of Homam workflow.',
      isAutomatedAutofill: true,
      // ── All 6 fields observed on live Homam form are REQUIRED ──────────
      requiredFields: ['gothram', 'email', 'city', 'state', 'country', 'pinCode'],
      optionalFields: [],
      // Identity fields are prohibited at this step
      prohibitedFields: ['fullName', 'idNumber', 'idType', 'age', 'gender'],
      fieldClassifications: {
        gothram: 'REQUIRED',   // Service-specific religious field (ONE booking-level field)
        email:   'REQUIRED',
        city:    'REQUIRED',
        state:   'REQUIRED',
        country: 'REQUIRED',
        pinCode: 'REQUIRED',
      },
      detect: (doc, url) => detectGeneralDetails(doc, url),
    },

    // ─── Step 4: Pilgrim Details (AFTER General Details) ──────
    {
      stepId: 'homam_pilgrims',
      stepType: 'PILGRIM_DETAILS',
      name: 'Devotee / Pilgrim Details',
      order: 4,
      description: 'Identity details for each participating devotee',
      isAutomatedAutofill: true,
      requiredFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
      optionalFields: [],
      // General detail fields are explicitly prohibited at this step
      prohibitedFields: ['gothram', 'mobile', 'email', 'city', 'state', 'country', 'pinCode'],
      fieldClassifications: {
        fullName: 'REQUIRED',
        age:      'REQUIRED',
        gender:   'REQUIRED',
        idType:   'REQUIRED',
        idNumber: 'REQUIRED',
      },
      detect: (doc, url) => detectPilgrimDetails(doc, url),
    },

    // ─── Step 5: Review ───────────────────────────────────────
    {
      stepId: 'homam_review',
      stepType: 'REVIEW_DETAILS',
      name: 'Booking Review & Confirmation',
      order: 5,
      description: 'Review all Homam and devotee details before payment',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectReviewDetails(doc, url),
    },

    // ─── Step 6: Payment ──────────────────────────────────────
    {
      stepId: 'homam_payment',
      stepType: 'PAYMENT',
      name: 'Payment Gateway',
      order: 6,
      description: 'Final payment processing (User-controlled only)',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectPayment(doc, url),
    },
  ],

  detectService(url: string, doc: Document) {
    let score = 0;
    const lowerUrl = url.toLowerCase();
    const sanitizedUrl = lowerUrl.replace(/:\d+/, '');

    // Strong URL signals for this service
    if (/srinivasa.*homam|divyanugraha|homam.*booking|seva.*homam|flow=homam|service=homam/i.test(sanitizedUrl)) {
      score += 55;
    } else if (/homam/i.test(sanitizedUrl)) {
      score += 35;
    }

    const text = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();

    if (text.includes('srinivasa divyanugraha homam') || text.includes('divyanugraha homam')) {
      score += 55;
    } else if (text.includes('divyanugraha')) {
      score += 40;
    } else if (text.includes('homam')) {
      score += 25;
    }

    // Check headings and DOM markers
    const hasHomamHeading = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-title, mat-card-title')).some(el => {
      const hText = (el.textContent || '').toLowerCase();
      return hText.includes('homam') || hText.includes('divyanugraha');
    });
    if (hasHomamHeading) {
      score += 25;
    }

    if (doc.querySelector('[data-service*="homam" i], #homamForm, .homam-booking, [data-testid*="homam"]')) {
      score += 55;
    }

    if (text.includes('tirumala') || text.includes('venkateswara')) {
      score += 10;
    }

    const confidence = Math.min(100, score);
    return {
      matches: confidence >= 50,
      confidence,
    };
  },
};

export { validateHomamBooking } from '../../validation/homam-validator';
