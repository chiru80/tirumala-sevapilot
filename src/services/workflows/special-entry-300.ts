// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Workflow #1: Special Entry Darshan ₹300
// Temple: Sri Venkateswara Swamy Temple, Tirumala
// Sequence: Queue → Availability → Slot → Additional Services →
//           Pilgrim Details → General Details → Review → Payment
// ─────────────────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import type { ServiceWorkflow } from './types';
import {
  detectDigitalQueue,
  detectAvailability,
  detectSlotSelection,
  detectAdditionalServices,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
} from './step-detectors';

export const SPECIAL_ENTRY_DARSHAN_300: ServiceWorkflow = {
  serviceId: 'special-entry-darshan-300',
  serviceName: 'Special Entry Darshan ₹300',
  workflowVersion: '1.0.0',
  serviceType: ServiceType.DARSHAN,
  temple: 'Sri Venkateswara Swamy Temple, Tirumala',
  ticketPrice: 300,
  maxPilgrims: 6,
  hasGeneralDetailsStep: true,

  additionalServices: [
    {
      id: 'additional_laddus',
      name: 'Additional Laddus (₹50 each)',
      isOptional: true,
      maxCount: 2,
      unitPrice: 50,
    },
    {
      id: 'hundi_offering',
      name: 'Srivari Hundi Offering',
      isOptional: true,
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
      waiting: 'Waiting for booking page...',
      detected: 'Queue detected. Please wait passively without refreshing.',
      ready: 'Booking page ready.',
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
      stepId: 'sed300_queue',
      stepType: 'DIGITAL_QUEUE',
      name: 'Digital Queue / Waiting Room',
      order: 0,
      description: 'TTD high-concurrency virtual waiting room',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectDigitalQueue(doc, url),
    },
    {
      stepId: 'sed300_availability',
      stepType: 'AVAILABILITY',
      name: 'Darshan Availability Calendar',
      order: 1,
      description: 'Quota dates and slot calendar selection',
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
      stepId: 'sed300_slot',
      stepType: 'SLOT_SELECTION',
      name: 'Darshan Time Slot Selection',
      order: 2,
      description: 'Specific hourly darshan time slot',
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
      stepId: 'sed300_additional',
      stepType: 'ADDITIONAL_SERVICES',
      name: 'Additional Services (Optional Laddus / Hundi)',
      order: 3,
      description: 'Extra laddu prasadam count and hundi offering',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: ['additionalLaddus', 'hundiOffering'],
      prohibitedFields: ['idNumber', 'gender'],
      fieldClassifications: {
        additionalLaddus: 'OPTIONAL',
        hundiOffering: 'OPTIONAL',
      },
      detect: (doc, url) => detectAdditionalServices(doc, url),
    },
    {
      stepId: 'sed300_pilgrims',
      stepType: 'PILGRIM_DETAILS',
      name: 'Devotee / Pilgrim Details',
      order: 4,
      description: 'Primary identity details for each devotee (up to 6)',
      isAutomatedAutofill: true,
      requiredFields: ['fullName', 'age', 'gender', 'idType', 'idNumber'],
      optionalFields: ['dateOfBirth', 'mobile'],
      prohibitedFields: ['email', 'city', 'state', 'country', 'pinCode'],
      fieldClassifications: {
        fullName: 'REQUIRED',
        age: 'REQUIRED',
        gender: 'REQUIRED',
        idType: 'REQUIRED',
        idNumber: 'REQUIRED',
        dateOfBirth: 'OPTIONAL',
        mobile: 'OPTIONAL', // Devotee mobile optional per Phase 3 rules
      },
      detect: (doc, url) => detectPilgrimDetails(doc, url),
    },
    {
      stepId: 'sed300_general',
      stepType: 'GENERAL_DETAILS',
      name: 'General Booking Contact & Address',
      order: 5,
      description: 'Booking contact details and communications address',
      isAutomatedAutofill: true,
      requiredFields: ['city', 'state', 'country', 'pinCode'],
      optionalFields: ['email', 'mobile'],
      prohibitedFields: ['fullName', 'idNumber', 'idType', 'age', 'gender'],
      fieldClassifications: {
        email: 'OPTIONAL',
        mobile: 'OPTIONAL', // Contact mobile is optional unless required by live page
        city: 'REQUIRED',
        state: 'REQUIRED',
        country: 'REQUIRED',
        pinCode: 'REQUIRED',
      },
      detect: (doc, url) => detectGeneralDetails(doc, url),
    },
    {
      stepId: 'sed300_review',
      stepType: 'REVIEW_DETAILS',
      name: 'Booking Review & Verification',
      order: 6,
      description: 'Review devotee data and booking breakdown before payment',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectReviewDetails(doc, url),
    },
    {
      stepId: 'sed300_payment',
      stepType: 'PAYMENT',
      name: 'Payment Gateway',
      order: 7,
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

    if (/sed|special.*entry|\b300\b|srstd|spat\b/i.test(sanitizedUrl)) {
      score += 45;
    }

    const text = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (text.includes('special entry darshan') || text.includes('sed ₹300') || text.includes('sri pat') || text.includes('seeghra darshanam')) {
      score += 40;
    }

    if (text.includes('tirumala') || text.includes('venkateswara')) {
      score += 15;
    }

    const confidence = Math.min(100, score);
    return {
      matches: confidence >= 40,
      confidence,
    };
  },
};
