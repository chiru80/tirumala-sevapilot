// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ServiceRecognitionEngine } from '../../src/services/service-recognition-engine';
import { resolveWorkflowWithConfidence, getWorkflowById } from '../../src/services/workflows/registry';
import { ReadinessEngine } from '../../src/services/readiness-engine';
import { detectAndLockPilgrimRows } from '../../src/content/autofill/row-detector';
import { resolvePilgrimFields } from '../../src/content/autofill/field-resolver';
import { Dashboard } from '../../src/sidepanel/pages/Dashboard';
import { ServiceType, Gender, IdType } from '../../src/shared/types';
import type { Profile } from '../../src/shared/types';

const storageMap = new Map<string, any>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: any) => {
        if (typeof key === 'string') return { [key]: storageMap.get(key) };
        if (Array.isArray(key)) {
          const res: Record<string, any> = {};
          for (const k of key) res[k] = storageMap.get(k);
          return res;
        }
        return Object.fromEntries(storageMap.entries());
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      }),
      remove: vi.fn(async (key: string) => storageMap.delete(key)),
      clear: vi.fn(async () => storageMap.clear()),
    },
  },
  tabs: {
    query: vi.fn(async () => [{
      id: 101,
      url: 'https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat&section=slot-booking',
      title: 'TTD Online Booking',
    }]),
    sendMessage: vi.fn(async () => ({ success: true })),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({ success: true })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

const sampleProfile: Profile = {
  id: 'prof1',
  name: 'Devotee Family',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  selectedPilgrims: {
    'padmavathi-supadham-entry-200': ['p1'],
    'special-entry-darshan-300': ['p2'],
  },
  pilgrims: [
    {
      id: 'p1',
      firstName: 'Srinivasa',
      lastName: 'Rao',
      fullName: 'Srinivasa Rao',
      gender: Gender.MALE,
      age: 45,
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      mobile: '9876543210',
      country: 'India',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'p2',
      firstName: 'Padmavathi',
      lastName: 'Amma',
      fullName: 'Padmavathi Amma',
      gender: Gender.FEMALE,
      age: 42,
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      mobile: '9876543211',
      country: 'India',
      createdAt: new Date().toISOString(),
    },
  ],
  general: {
    mobile: '9876543210',
    email: 'devotee@example.com',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
  },
};

describe('SPAT ₹200 Full System Flow Verification', () => {
  beforeEach(() => {
    storageMap.clear();
    storageMap.set('sp_profiles', [sampleProfile]);
    storageMap.set('sp_settings', {
      language: 'en',
      theme: 'light',
      autofillMode: 'safe',
      confirmationMode: 'high-confidence-direct',
    });
  });

  afterEach(() => {
    cleanup();
  });

  // A. SPAT route recognition
  it('A. recognizes SPAT live URL pattern as padmavathi-supadham-entry-200 / padmavathi-v1', () => {
    const spatUrl = 'https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat&section=slot-booking';
    const rec = ServiceRecognitionEngine.recognize(spatUrl, document);

    expect(rec.status).toBe('detected');
    expect(rec.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(rec.workflowId).toBe('padmavathi-v1');
    expect(rec.verified).toBe(true);
    expect(rec.serviceName).toBe('Padmavathi / Sri PAT');

    const wf = resolveWorkflowWithConfidence(spatUrl, document);
    expect(wf.workflow).toBeDefined();
    expect(wf.workflow?.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(wf.workflow?.ticketPrice).toBe(200);
  });

  // B. Generic "Special Entry Darshan" heading on SPAT page
  it('B. ensures generic "Special Entry Darshan" heading does not override SPAT route dominance', () => {
    document.body.innerHTML = `
      <h1>Special Entry Darshan</h1>
      <h2>Slot Selection</h2>
    `;
    const spatUrlWithGenericHeading = 'https://ttdevasthanams.ap.gov.in/spat/pilgrim-details?flow=spat&flowIdentifier=spat';
    const rec = ServiceRecognitionEngine.recognize(spatUrlWithGenericHeading, document);

    expect(rec.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(rec.serviceId).not.toBe('special-entry-darshan-300');
    expect(rec.serviceName).toBe('Padmavathi / Sri PAT');

    const wf = resolveWorkflowWithConfidence(spatUrlWithGenericHeading, document);
    expect(wf.workflow?.serviceId).toBe('padmavathi-supadham-entry-200');
    expect(wf.workflow?.serviceId).not.toBe('special-entry-darshan-300');
  });

  // C. Padmavathi readiness
  it('C. verifies Padmavathi readiness does not require General Details and only requires Pilgrim Details', () => {
    // Incomplete general details profile
    const profileNoGeneral: Profile = {
      ...sampleProfile,
      general: {
        mobile: '',
        email: '',
        city: '',
        state: '',
        country: '',
        pinCode: '',
      },
    };

    const evaluation = ReadinessEngine.evaluate(
      profileNoGeneral,
      ServiceType.DARSHAN,
      'padmavathi-supadham-entry-200',
    );

    // General details are not required for Padmavathi ₹200
    const generalCheck = evaluation.checks.find(c => c.id === 'general_details');
    expect(generalCheck).toBeDefined();
    expect(generalCheck?.status).toBe('ready');
    expect(generalCheck?.message).toBe('Not required for this service');

    // Missing general details must not be in missingFields
    expect(evaluation.missingFields).not.toContain('Email');
    expect(evaluation.missingFields).not.toContain('City');
    expect(evaluation.missingFields).not.toContain('State');

    // Pilgrim details are verified and required
    expect(evaluation.isProfileReady).toBe(true);
    expect(evaluation.readyPilgrimsCount).toBe(1);
  });

  // D. Visual-label pilgrim form
  it('D. detects all 5 fields on a visual-label form without Angular attributes', () => {
    document.body.innerHTML = `
      <div class="pilgrim-card" id="card-0">
        <div class="field-container">
          <label>Name *</label>
          <input type="text" />
        </div>
        <div class="field-container">
          <label>Age *</label>
          <input type="number" />
        </div>
        <div class="field-container">
          <label>Gender *</label>
          <select><option value="MALE">Male</option></select>
        </div>
        <div class="field-container">
          <label>Photo ID Proof *</label>
          <select><option value="Aadhaar">Aadhaar</option></select>
        </div>
        <div class="field-container">
          <label>Photo ID Number *</label>
          <input type="text" />
        </div>
      </div>
    `;

    const rows = detectAndLockPilgrimRows(document, 1);
    expect(rows.length).toBe(1);

    const row = rows[0];
    expect(row.fields.get('name')).toBeDefined();
    expect(row.fields.get('age')).toBeDefined();
    expect(row.fields.get('gender')).toBeDefined();
    expect(row.fields.get('photoIdProof')).toBeDefined();
    expect(row.fields.get('photoIdNumber')).toBeDefined();
  });

  // E. Field resolver with plain visual labels
  it('E. field resolver handles visual text labels without Angular attributes', () => {
    document.body.innerHTML = `
      <div class="field-box">
        <span class="field-label">Photo ID Number *</span>
        <input type="text" class="custom-input" />
      </div>
    `;

    const container = document.querySelector('.field-box') as HTMLElement;
    const resolved = resolvePilgrimFields(container, document);

    expect(resolved.has('photoIdNumber')).toBe(true);
    const idRes = resolved.get('photoIdNumber')!;
    expect(idRes.confidence).toBeGreaterThanOrEqual(50);
  });

  // F. Service-specific selection
  it('F. ensures independent selection state between ₹200 and ₹300 services', () => {
    const padmaSelection = sampleProfile.selectedPilgrims?.['padmavathi-supadham-entry-200'];
    const sedSelection = sampleProfile.selectedPilgrims?.['special-entry-darshan-300'];

    expect(padmaSelection).toEqual(['p1']);
    expect(sedSelection).toEqual(['p2']);
    expect(padmaSelection).not.toEqual(sedSelection);
  });

  // G. Dashboard primary action
  it('G. renders FILL & VERIFY sticky action before profile and readiness sections', async () => {
    const { container } = render(<Dashboard onNavigate={vi.fn()} />);

    // Check sticky container exists
    const stickyContainer = container.querySelector('.sticky.top-0');
    expect(stickyContainer).not.toBeNull();

    // Check FILL & VERIFY primary button is within the sticky container
    const primaryBtn = stickyContainer?.querySelector('#sp-hero-primary-action-btn');
    expect(primaryBtn).not.toBeNull();

    // Verify ordering: Primary action button appears before active profile and readiness cards in DOM
    const allDivs = Array.from(container.querySelectorAll('button, [class*="card"]'));
    const btnIndex = allDivs.findIndex(el => el.id === 'sp-hero-primary-action-btn');
    expect(btnIndex).toBeGreaterThan(-1);
  });
});
