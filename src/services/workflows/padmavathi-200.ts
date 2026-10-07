// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Workflow #2: Sri Padmavathi Ammavari ₹200
// Temple: Sri Padmavathi Ammavari Temple, Tiruchanoor
// Sequence: Queue → Availability → Slot → Additional Services →
//           Pilgrim Details → Review → Payment
//
// CRITICAL ARCHITECTURE RULE (Phase 3 Section 3 & 4):
// THERE IS NO GENERAL DETAILS STEP FOR THIS SERVICE.
// DO NOT AUTOMATICALLY INSERT OR REQUIRE:
// Email, City, State, Country, Pincode.
// ─────────────────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import type { ServiceWorkflow } from './types';
import {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectReviewDetails,
  detectPayment,
} from './step-detectors';

export const PADMAVATHI_SUPADHAM_ENTRY_200: ServiceWorkflow = {
  serviceId: 'padmavathi-supadham-entry-200',
  serviceName: 'Padmavathi / Sri PAT',
  workflowId: 'padmavathi-v1',
  workflowVersion: '1.0.0',
  serviceType: ServiceType.DARSHAN,
  temple: 'Sri Padmavathi Ammavari Temple, Tiruchanoor',
  ticketPrice: 200,
  maxPilgrims: 6,
  hasGeneralDetailsStep: false, // NO GENERAL DETAILS STEP

  additionalServices: [
    {
      id: 'additional_laddus',
      name: 'Additional Prasadam Laddu',
      isOptional: true,
      maxCount: 2,
      unitPrice: 50,
    },
  ],

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
      waiting: 'Waiting for Padmavathi Ammavari booking page...',
      detected: 'Queue detected. Please wait passively without refreshing.',
      ready: 'Padmavathi Ammavari booking page ready.',
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
    {
      stepId: 'padm200_queue',
      stepType: 'DIGITAL_QUEUE',
      name: 'Digital Queue / Waiting Room',
      order: 0,
      description: 'Virtual queue / high demand holding room',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectDigitalQueue(doc, url),
    },
    {
      stepId: 'padm200_availability',
      stepType: 'AVAILABILITY',
      name: 'Supadham Darshan Availability',
      order: 1,
      description: 'Darshan quota calendar and date selection',
      isAutomatedAutofill: false,
      requiredFields: ['selectedDate', 'ticketQuantity'],
      optionalFields: [],
      prohibitedFields: ['fullName', 'idNumber'],
      fieldClassifications: {
        selectedDate: 'USER_CONTROLLED',
        ticketQuantity: 'USER_CONTROLLED',
      },
      detect: (doc, url) => detectAvailability(doc, url),
    },
    {
      stepId: 'padm200_slot',
      stepType: 'SLOT_SELECTION',
      name: 'Supadham Slot Selection',
      order: 2,
      description: 'Time slot selection for entry',
      isAutomatedAutofill: false,
      requiredFields: ['timeSlot'],
      optionalFields: [],
      prohibitedFields: ['fullName', 'idNumber'],
      fieldClassifications: {
        timeSlot: 'USER_CONTROLLED',
      },
      detect: (doc, url) => detectSlotSelection(doc, url),
    },
    {
      stepId: 'padm200_additional',
      stepType: 'ADDITIONAL_SERVICES',
      name: 'Additional Services (If Present)',
      order: 3,
      description: 'Additional prasadam laddu offering',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: ['additionalLaddus'],
      prohibitedFields: ['idNumber', 'gender'],
      fieldClassifications: {
        additionalLaddus: 'OPTIONAL',
      },
      detect: (doc, url) => detectAdditionalServices(doc, url),
    },
    {
      stepId: 'padm200_pilgrims',
      stepType: 'PILGRIM_DETAILS',
      name: 'Devotee / Pilgrim Details',
      order: 4,
      description: 'Primary identity details for each devotee (up to 6)',
      isAutomatedAutofill: true,
      requiredFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
      optionalFields: ['dateOfBirth', 'mobile'],
      // Notice: General details fields are explicitly PROHIBITED here
      prohibitedFields: ['email', 'city', 'state', 'country', 'pinCode'],
      fieldClassifications: {
        fullName: 'REQUIRED',
        age: 'REQUIRED',
        gender: 'REQUIRED',
        idType: 'REQUIRED',
        idNumber: 'REQUIRED',
        dateOfBirth: 'OPTIONAL',
        mobile: 'OPTIONAL',
      },
      detect: (doc, url) => detectPilgrimDetails(doc, url),
    },
    // NOTE: STEP 5 GENERAL DETAILS IS DELIBERATELY OMITTED
    // For Padmavathi Ammavari, pilgrim details transitions directly to Review / Payment
    {
      stepId: 'padm200_review',
      stepType: 'REVIEW_DETAILS',
      name: 'Booking Review & Summary',
      order: 5,
      description: 'Review devotee data and darshan slot without general details',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectReviewDetails(doc, url),
    },
    {
      stepId: 'padm200_payment',
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
    const lowerUrl = url.toLowerCase();
    const sanitizedUrl = lowerUrl.replace(/:\d+/, '');

    // SPAT route dominance: /spat/ or flow=spat or flowIdentifier=spat
    if (sanitizedUrl.includes('/spat/') || sanitizedUrl.includes('flow=spat') || sanitizedUrl.includes('flowidentifier=spat')) {
      return {
        matches: true,
        confidence: 100,
      };
    }

    let score = 0;
    if (/padmavathi|ammavari|tiruchanoor|supadham|spat.*200|\bpat\b/i.test(sanitizedUrl)) {
      score += 50;
    }

    const text = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (
      text.includes('padmavathi') ||
      text.includes('ammavari') ||
      text.includes('tiruchanoor') ||
      text.includes('supadham') ||
      text.includes('₹200') ||
      text.includes('sri pat')
    ) {
      score += 45;
    }

    const confidence = Math.min(100, score);
    return {
      matches: confidence >= 40,
      confidence,
    };
  },
};
