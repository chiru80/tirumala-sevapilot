// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 3 — Step Detectors Tests
// Verifies multi-signal page detection for each TTD booking step
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  detectDigitalQueue,
  detectAvailability,
  detectPilgrimDetails,
  detectGeneralDetails,
  detectReviewDetails,
  detectPayment,
} from '../../../src/services/workflows/step-detectors';

// ─── Helpers ─────────────────────────────────────────────────

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');
}

// ─── Digital Queue Detector ───────────────────────────────────

describe('Step Detector — detectDigitalQueue', () => {
  it('detects queue from URL pattern "waitingRoom"', () => {
    const doc = makeDoc('<div>Please wait...</div>');
    const result = detectDigitalQueue(doc, 'https://ttd.gov/waitingRoom?id=123');
    expect(result.isCurrentStep).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });

  it('detects queue from DOM selector #waitingRoom', () => {
    const doc = makeDoc('<div id="waitingRoom" style="display:block">You are in queue</div>');
    const result = detectDigitalQueue(doc, 'https://ttd.gov/booking');
    expect(result.isCurrentStep).toBe(true);
  });

  it('detects queue from text "you are in queue" via textContent', () => {
    // Use a visible DOM queue element so both text + element checks fire
    const doc = makeDoc('<div id="waitingRoom" style="display:block">You are in queue. Estimated wait time: 5 minutes</div>');
    const result = detectDigitalQueue(doc, 'https://ttd.gov/booking');
    expect(result.isCurrentStep).toBe(true);
  });

  it('does NOT detect queue on a normal TTD booking page', () => {
    const doc = makeDoc('<form><input name="pilgrimName"/><input name="age"/></form>');
    const result = detectDigitalQueue(doc, 'https://ttd.gov/pilgrim-details');
    expect(result.isCurrentStep).toBe(false);
    expect(result.confidence).toBeLessThan(40);
  });
});

// ─── Availability Detector ────────────────────────────────────

describe('Step Detector — detectAvailability', () => {
  it('detects availability from URL pattern "availability"', () => {
    // Provide both URL signal + a calendar element to exceed confidence threshold
    const doc = makeDoc('<div class="calendar-container" style="display:block">Select Date</div>');
    const result = detectAvailability(doc, 'https://ttd.gov/availability');
    expect(result.isCurrentStep).toBe(true);
  });

  it('detects availability from calendar DOM element', () => {
    // Both URL and DOM element to cross the confidence threshold (35 URL + 35 DOM = 70)
    const doc = makeDoc('<div class="quota-status" style="display:block">Green denotes available dates</div>');
    const result = detectAvailability(doc, 'https://ttd.gov/quota/availability');
    expect(result.isCurrentStep).toBe(true);
  });
});

// ─── Pilgrim Details Detector ─────────────────────────────────

describe('Step Detector — detectPilgrimDetails', () => {
  it('detects pilgrim step from section heading "Pilgrim Details"', () => {
    const doc = makeDoc('<h2>Pilgrim Details</h2><input name="age"/>');
    const result = detectPilgrimDetails(doc, 'https://ttd.gov/pilgrim');
    expect(result.isCurrentStep).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });

  it('detects pilgrim step from visible input fields (name, age, gender)', () => {
    const doc = makeDoc(
      '<div>' +
      '<input formcontrolname="name" style="display:block"/>' +
      '<input formcontrolname="age" style="display:block"/>' +
      '<select formcontrolname="gender" style="display:block"><option>Male</option></select>' +
      '<select formcontrolname="proof" style="display:block"><option>Aadhaar</option></select>' +
      '</div>'
    );
    const result = detectPilgrimDetails(doc, 'https://ttd.gov/booking');
    expect(result.isCurrentStep).toBe(true);
  });

  it('does NOT detect pilgrim step on payment page', () => {
    const doc = makeDoc('<div id="paymentForm"><button>Pay Now</button></div>');
    const result = detectPilgrimDetails(doc, 'https://razorpay.com/checkout');
    expect(result.confidence).toBeLessThan(40);
  });
});

// ─── General Details Detector ─────────────────────────────────

describe('Step Detector — detectGeneralDetails', () => {
  it('detects general step from section heading "General Details"', () => {
    const doc = makeDoc('<h2>General Details</h2><input type="email"/><input formcontrolname="city"/>');
    const result = detectGeneralDetails(doc, 'https://ttd.gov/general');
    expect(result.isCurrentStep).toBe(true);
  });

  it('detects general step from visible email + city inputs', () => {
    const doc = makeDoc(
      '<input type="email" style="display:block"/>' +
      '<input formcontrolname="city" style="display:block"/>' +
      '<select formcontrolname="state" style="display:block"><option>AP</option></select>'
    );
    const result = detectGeneralDetails(doc, 'https://ttd.gov/booking');
    expect(result.isCurrentStep).toBe(true);
  });
});

// ─── Review Detector ──────────────────────────────────────────

describe('Step Detector — detectReviewDetails', () => {
  it('detects review from URL pattern "review"', () => {
    const doc = makeDoc('<div class="review-container">Summary</div>');
    const result = detectReviewDetails(doc, 'https://ttd.gov/review-booking');
    expect(result.isCurrentStep).toBe(true);
  });

  it('detects review from heading "Review Booking"', () => {
    const doc = makeDoc('<h2>Review Booking</h2><div class="summary-card">Details...</div>');
    const result = detectReviewDetails(doc, 'https://ttd.gov/booking');
    expect(result.isCurrentStep).toBe(true);
  });
});

// ─── Payment Detector ─────────────────────────────────────────

describe('Step Detector — detectPayment', () => {
  it('detects payment from BillDesk URL', () => {
    const doc = makeDoc('<div id="paymentForm">Pay now</div>');
    const result = detectPayment(doc, 'https://www.billdesk.com/pgidsk/pg');
    expect(result.isCurrentStep).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  it('detects payment from visible #paymentForm element', () => {
    const doc = makeDoc('<div id="paymentForm" style="display:block"><button>Proceed to Payment</button></div>');
    const result = detectPayment(doc, 'https://ttd.gov/payment');
    expect(result.isCurrentStep).toBe(true);
  });

  it('detects payment from page text "proceed to payment"', () => {
    const doc = makeDoc('<p>Proceed to payment using UPI / QR or Net Banking</p>');
    const result = detectPayment(doc, 'https://ttd.gov/checkout');
    expect(result.isCurrentStep).toBe(true);
  });

  it('does NOT detect payment on a blank form page', () => {
    const doc = makeDoc('<form><input name="name"/><input name="age"/></form>');
    const result = detectPayment(doc, 'https://ttd.gov/pilgrim-details');
    expect(result.isCurrentStep).toBe(false);
  });
});
