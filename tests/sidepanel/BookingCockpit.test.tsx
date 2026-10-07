// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Booking Cockpit Unit Tests (Phase 2)
// Verifies all 8 Cockpit CTA states, zero technical metric clutter,
// 4-step How It Works with trust highlight, and Settings Diagnostics.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { Dashboard } from '../../src/sidepanel/pages/Dashboard';
import { Settings } from '../../src/sidepanel/pages/Settings';
import { Gender, IdType } from '../../src/shared/types';
import type { Profile } from '../../src/shared/types';
import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';

const validMockAadhaar = '23456789012' + generateVerhoeffChecksum('23456789012');
const storageMap = new Map<string, any>();
let mockActiveTabUrl = 'https://ttdevasthanams.ap.gov.in/darshan/entry';

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: any) => {
        if (typeof key === 'string') {
          return { [key]: storageMap.get(key) };
        }
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
    query: vi.fn(async () => [
      {
        id: 101,
        url: mockActiveTabUrl,
        title: 'TTD Special Entry Darshan',
      },
    ]),
    create: vi.fn(async () => ({ id: 102 })),
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
  name: 'Family',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  selectedPilgrims: { 'special-entry-darshan-300': ['p1'] },
  pilgrims: [
    {
      id: 'p1',
      firstName: 'Govinda',
      lastName: 'Sharma',
      fullName: 'Govinda Sharma',
      gender: Gender.MALE,
      age: 40,
      idType: IdType.AADHAAR,
      idNumber: validMockAadhaar,
      mobile: '9876543210',
      country: 'India',
      createdAt: new Date().toISOString(),
    },
  ],
  general: {
    mobile: '9876543210',
    email: 'devotee@gmail.com',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
  },
};

describe('Phase 2 — Booking Cockpit / Premium Home UX', () => {
  beforeEach(() => {
    storageMap.clear();
    mockActiveTabUrl = 'https://ttdevasthanams.ap.gov.in/darshan/entry';
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async () => ({ success: true }));
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

  it('1. First-time user state: renders CREATE PROFILE, no diagnostic score percentages, and 4-step How It Works', async () => {
    storageMap.set('sp_profiles', []);
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/No profile yet/i)).toBeTruthy();
    });

    // Primary CTA dominates with CREATE PROFILE
    const createBtn = screen.getAllByRole('button', { name: /CREATE PROFILE/i })[0];
    expect(createBtn).toBeTruthy();

    // Verify zero technical metric clutter on Home
    expect(screen.queryByText(/80%/i)).toBeNull();
    expect(screen.queryByText(/4 of 6 checks/i)).toBeNull();
    expect(screen.queryByText(/readiness score/i)).toBeNull();

    // Verify 4-step How It Works card and trust highlight
    expect(screen.getAllByText(/HOW IT WORKS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CREATE PROFILE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SELECT PILGRIMS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FILL & VERIFY/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/YOU STAY IN CONTROL/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/You stay in complete control/i)).toBeTruthy();

    // Clicking navigates to profiles
    fireEvent.click(createBtn);
    expect(onNavigate).toHaveBeenCalledWith('profiles');
  });

  it('2. Profile ready + No TTD page: renders PREPARE BOOKING and secondary OPEN TTD BOOKING', async () => {
    mockActiveTabUrl = 'https://google.com';
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Primary dominant action is PREPARE BOOKING
    const prepareBtn = screen.getByRole('button', { name: /PREPARE BOOKING/i });
    expect(prepareBtn).toBeTruthy();

    // Secondary action is OPEN TTD BOOKING
    const openBtn = screen.getByRole('button', { name: /OPEN TTD/i });
    expect(openBtn).toBeTruthy();

    // Clicking prepare navigates to profiles
    fireEvent.click(prepareBtn);
    expect(onNavigate).toHaveBeenCalledWith('profiles');
  });

  it('3. TTD detected + Ready: displays ⚡ FILL & VERIFY with canonical service price badge', async () => {
    mockActiveTabUrl = 'https://ttdevasthanams.ap.gov.in/darshan/entry';
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/TTD PAGE READY/i)).toBeTruthy();
    });

    // Primary dominant action is FILL & VERIFY
    const actionBtn = screen.getByRole('button', { name: /FILL & VERIFY/i });
    expect(actionBtn).toBeTruthy();

    // Price badge is rendered in cockpit banner
    expect(screen.getByText('₹300')).toBeTruthy();
    expect(screen.getAllByText(/Special Entry Darshan ₹300/i).length).toBeGreaterThan(0);

    // Clean status pill
    expect(screen.getByText(/Ready to fill/i)).toBeTruthy();
  });

  it('4. Action required (no pilgrims selected): displays SELECT PILGRIMS', async () => {
    const profileWithoutSelection: Profile = {
      ...sampleProfile,
      selectedPilgrims: { 'special-entry-darshan-300': [] },
    };
    storageMap.set('sp_profiles', [profileWithoutSelection]);

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    const selectBtn = screen.getByRole('button', { name: /SELECT PILGRIMS/i });
    expect(selectBtn).toBeTruthy();
  });

  it('5. Temporary lock state: renders non-auto-retry TRY AGAIN and CHECK BOOKING HISTORY', async () => {
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (msg: any) => {
      if (msg?.type === 'GET_PAGE_STATE' || msg?.type === 'PAGE_SCAN' || msg?.type === 'GET_ACTIVE_STEP') {
        return {
          success: true,
          data: {
            temporaryLock: {
              isLocked: true,
              title: 'TEMPORARY TTD LOCK',
              message: 'Your previous booking attempt is still active.',
              detectedAt: new Date().toISOString(),
              durationMinutes: 15,
            },
          },
        };
      }
      return { success: true };
    });

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Dedicated TemporaryLock banner is displayed
    expect(screen.getByText(/Temporary TTD lock/i)).toBeTruthy();
    expect(screen.getByText(/Server-side hold/i)).toBeTruthy();

    // Dominant action buttons provide TRY AGAIN and CHECK BOOKING HISTORY
    const tryAgainBtn = screen.getByRole('button', { name: /TRY AGAIN/i });
    expect(tryAgainBtn).toBeTruthy();

    const historyBtn = screen.getByRole('button', { name: /CHECK BOOKING HISTORY/i });
    expect(historyBtn).toBeTruthy();
  });

  it('6. Settings diagnostics: System Diagnostics inspector opens safely on demand', async () => {
    render(<Settings onSettingsChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/System Diagnostics/i)).toBeTruthy();
    });

    const inspectBtn = screen.getByRole('button', { name: /Open System Diagnostics/i });
    expect(inspectBtn).toBeTruthy();

    // Click opens the diagnostic modal
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /SYSTEM DIAGNOSTICS/i })).toBeTruthy();
      expect(screen.getByText(/ZERO-PII POLICY/i)).toBeTruthy();
    });

    // Close button dismisses modal
    const closeBtn = screen.getByRole('button', { name: /Close Diagnostics/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
