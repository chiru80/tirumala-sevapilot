// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { detectActiveBookingStep } from '../../../src/content/autofill/page-workflow';

describe('Page Workflow (TTD Step Detection)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    doc.body.innerHTML = '';
  });

  it('detects PILGRIM_DETAILS from active mat-step-header stepper', () => {
    doc.body.innerHTML = `
      <div class="stepper">
        <mat-step-header class="mat-step-header-selected">
          <div class="mat-step-label">Pilgrim Details</div>
        </mat-step-header>
        <mat-step-header>
          <div class="mat-step-label">General Details</div>
        </mat-step-header>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  it('detects GENERAL_DETAILS from active stepper', () => {
    doc.body.innerHTML = `
      <div class="stepper">
        <mat-step-header>
          <div class="mat-step-label">Pilgrim Details</div>
        </mat-step-header>
        <mat-step-header class="mat-step-header-selected">
          <div class="mat-step-label">General Details</div>
        </mat-step-header>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('GENERAL_DETAILS');
  });

  it('detects PILGRIM_DETAILS from visible section headings', () => {
    doc.body.innerHTML = `
      <div class="container">
        <h3>Pilgrim Information</h3>
        <form>
          <input formcontrolname="name" />
        </form>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  it('detects GENERAL_DETAILS from visible contact headings', () => {
    doc.body.innerHTML = `
      <div class="container">
        <h3>Contact & Address Details</h3>
        <form>
          <input type="email" />
        </form>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('GENERAL_DETAILS');
  });

  it('detects PILGRIM_DETAILS by form field patterns when headings are generic', () => {
    doc.body.innerHTML = `
      <div class="card">
        <input formcontrolname="name" placeholder="Name" />
        <input formcontrolname="age" type="number" placeholder="Age" />
        <select formcontrolname="gender"><option>Male</option></select>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('PILGRIM_DETAILS');
  });

  it('detects GENERAL_DETAILS by address and email field patterns', () => {
    doc.body.innerHTML = `
      <div class="card">
        <input type="email" formcontrolname="email" />
        <input type="tel" formcontrolname="mobile" />
        <input formcontrolname="city" />
        <select formcontrolname="state"><option>AP</option></select>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('GENERAL_DETAILS');
  });

  it('returns UNKNOWN on empty or non-TTD pages', () => {
    doc.body.innerHTML = `
      <div>
        <p>Welcome to Google</p>
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when both pilgrim and general fields exist without clear active focus or stepper indicator', () => {
    doc.body.innerHTML = `
      <div class="row">
        <!-- Equal pilgrim fields -->
        <input formcontrolname="name" placeholder="Name" />
        <input formcontrolname="age" type="number" placeholder="Age" />
        <!-- Equal general fields -->
        <input type="email" formcontrolname="email" />
        <input type="tel" formcontrolname="mobile" />
      </div>
    `;
    const step = detectActiveBookingStep(doc);
    expect(step).toBe('UNKNOWN');
  });
});
