// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Workflow #4: Srivari Seva Voluntary Service
// Service: Srivari Seva Voluntary Pilgrim Assistance
// Flow: Instructions → Review/Declaration (User Action) → 
//       Unified Profile / Enrollment (Identity, Basic, Fitness, Profession, Address) → 
//       Review / Submit
// ─────────────────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import type { ServiceWorkflow } from './types';
import {
  detectDigitalQueue,
  detectReviewDetails,
  detectPayment,
  detectSrivariSevaInstructions,
  detectSrivariSevaEnrollment,
} from './step-detectors';

export const SRIVARI_SEVA_WORKFLOW: ServiceWorkflow = {
  serviceId: 'srivari-seva',
  serviceName: 'Srivari Seva',
  workflowId: 'srivari-seva-enrollment-v1',
  workflowVersion: '1.0.0',
  serviceType: ServiceType.SRIVARI_SEVA,
  temple: 'Sri Venkateswara Swamy Temple, Tirumala (Voluntary Seva)',
  ticketPrice: 0,
  maxPilgrims: 1,
  exactPilgrims: 1,
  hasGeneralDetailsStep: true,

  additionalServices: [],

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
      waiting: 'Waiting for Srivari Seva enrollment page...',
      detected: 'Queue detected. Please wait passively without refreshing.',
      ready: 'Srivari Seva enrollment page ready.',
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
      stepId: 'srivari_queue',
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
      stepId: 'srivari_instructions',
      stepType: 'INSTRUCTIONS_REVIEW',
      name: 'Instructions & Declaration Review',
      order: 1,
      description: 'Review instructions tabs and confirm declaration checkbox manually',
      isAutomatedAutofill: false,
      requiredFields: ['declarationConfirmed'],
      optionalFields: [],
      prohibitedFields: ['fullName', 'idNumber', 'password'],
      fieldClassifications: {
        declarationConfirmed: 'USER_CONTROLLED',
      },
      detect: (doc, url) => detectSrivariSevaInstructions(doc, url),
    },
    {
      stepId: 'srivari_enrollment',
      stepType: 'SRIVARI_SEVA_ENROLLMENT',
      name: 'Srivari Seva Unified Profile Enrollment',
      order: 2,
      description: 'Unified profile enrollment with section-scoped required fields only',
      isAutomatedAutofill: true,
      requiredFields: [
        'name',
        'dateOfBirth',
        'age',
        'gender',
        'idProofType',
        'idProofNumber',
        'mobile',
        'photo',
        'country',
        'pincode',
        'state',
        'district',
        'city',
        'street',
        'doorNumber',
      ],
      optionalFields: [
        'fatherSpouseName',
        'email',
        'bloodGroup',
        'qualification',
        'profession',
        'areaOfInterest',
        'employeeId',
        'designation',
        'specialisation',
        'placeOfWork',
        'document',
        'mandal',
      ],
      prohibitedFields: ['otp', 'password', 'paymentMode', 'cvv'],
      fieldClassifications: {
        idProofType: 'REQUIRED',
        idProofNumber: 'REQUIRED',
        mobile: 'REQUIRED',
        photo: 'REQUIRED',
        name: 'REQUIRED',
        dateOfBirth: 'REQUIRED',
        age: 'REQUIRED',
        gender: 'REQUIRED',
        country: 'REQUIRED',
        pincode: 'REQUIRED',
        state: 'REQUIRED',
        district: 'REQUIRED',
        city: 'REQUIRED',
        street: 'REQUIRED',
        doorNumber: 'REQUIRED',
        mentallyFit: 'USER_CONTROLLED',
        physicallyFit: 'USER_CONTROLLED',
        fatherSpouseName: 'OPTIONAL',
        email: 'OPTIONAL',
        bloodGroup: 'OPTIONAL',
        qualification: 'OPTIONAL',
        profession: 'OPTIONAL',
        areaOfInterest: 'OPTIONAL',
        employeeId: 'OPTIONAL',
        designation: 'OPTIONAL',
        specialisation: 'OPTIONAL',
        placeOfWork: 'OPTIONAL',
        document: 'OPTIONAL',
        mandal: 'OPTIONAL',
      },
      detect: (doc, url) => detectSrivariSevaEnrollment(doc, url),
    },
    {
      stepId: 'srivari_review',
      stepType: 'REVIEW_DETAILS',
      name: 'Enrollment Review & Submission',
      order: 3,
      description: 'Review devotee data before manual submission',
      isAutomatedAutofill: false,
      requiredFields: [],
      optionalFields: [],
      prohibitedFields: ['*'],
      fieldClassifications: {},
      detect: (doc, url) => detectReviewDetails(doc, url),
    },
  ],

  detectService(url: string, doc: Document) {
    const lowerUrl = url.toLowerCase();
    const sanitizedUrl = lowerUrl.replace(/:\d+/, '');

    // Srivari Seva route dominance: /srivari-seva/ or /srivariseva/
    if (sanitizedUrl.includes('/srivari-seva') || sanitizedUrl.includes('/srivariseva') || sanitizedUrl.includes('flow=srivari-seva')) {
      return {
        matches: true,
        confidence: 100,
      };
    }

    let score = 0;
    if (/srivari[-_]?seva/i.test(sanitizedUrl)) {
      score += 50;
    }

    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, .page-title, .header-title'))
      .map(h => (h.textContent || '').toLowerCase())
      .join(' ');
    if (headings.includes('srivari seva')) {
      score += 45;
    } else {
      const formOrCard = doc.querySelector('#srivariSevaForm, [data-service*="srivari" i], #volunteerForm, .instructions-container');
      if (formOrCard) {
        score += 40;
      }
    }

    const confidence = Math.min(100, score);
    return {
      matches: confidence >= 50,
      confidence,
    };
  },
};
