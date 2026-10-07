// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { Dashboard } from '../../src/sidepanel/pages/Dashboard';
import * as releaseCal from '../../src/services/ttd-information/ttd-release-calendar';
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
    query: vi.fn(async () => [{
      id: 101,
      url: mockActiveTabUrl,
      title: 'TTD Special Entry Darshan',
    }]),
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

describe('Dashboard Component — Redesign & Consumer Experience', () => {
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

  it('renders Dashboard with single dominant action ⚡ FILL & VERIFY', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Check single dominant action button exists
    const actionBtn = screen.getByRole('button', { name: /FILL & VERIFY/i });
    expect(actionBtn).toBeTruthy();

    // Check Privacy badge
    expect(screen.getAllByText(/Data stored locally|Local data/i)[0]).toBeTruthy();

    // Check Quick Actions
    expect(screen.getByText(/Quick Actions/i)).toBeTruthy();
  });

  it('renders TTD status and booking readiness cards', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    expect(screen.getByText(/Booking Readiness/i)).toBeTruthy();
  });

  // ─── Verification of Scenarios A through I ───

  it('A. First-time user: renders CREATE PROFILE and simple welcome without percentage clutter', async () => {
    storageMap.set('sp_profiles', []);
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/No profile yet/i)).toBeTruthy();
    });

    // Primary CTA dominates with CREATE PROFILE
    const createBtn = screen.getAllByRole('button', { name: /CREATE PROFILE/i })[0];
    expect(createBtn).toBeTruthy();

    // Should NOT show confusing percentages or check counts on home
    expect(screen.queryByText(/80%/i)).toBeNull();
    expect(screen.queryByText(/4 of 6 checks/i)).toBeNull();

    // Clicking navigates to profiles
    fireEvent.click(createBtn);
    expect(onNavigate).toHaveBeenCalledWith('profiles');
  });

  it('B. Existing profile: renders clean profile summary with Ready status and HOW IT WORKS', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Clean devotee count and Ready status
    expect(screen.getByText(/1 pilgrim/i)).toBeTruthy();
    expect(screen.getAllByText(/Ready/i).length).toBeGreaterThan(0);

    // HOW IT WORKS card is rendered with 3 simple steps
    expect(screen.getByText(/HOW IT WORKS/i)).toBeTruthy();
    expect(screen.getAllByText(/CREATE PROFILE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SELECT PILGRIMS/i).length).toBeGreaterThan(0);
  });

  it('C. TTD page detected: renders TTD PAGE READY and service context', async () => {
    mockActiveTabUrl = 'https://ttdevasthanams.ap.gov.in/darshan/entry';
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/TTD PAGE READY/i)).toBeTruthy();
    });

    const actionBtn = screen.getByRole('button', { name: /FILL & VERIFY/i });
    expect(actionBtn).toBeTruthy();
  });

  it('D. TTD page not detected: renders contextual OPEN TTD BOOKING action', async () => {
    mockActiveTabUrl = 'https://google.com';
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Dominant action changes contextually to OPEN TTD BOOKING
    const openBtn = screen.getByRole('button', { name: /OPEN TTD/i });
    expect(openBtn).toBeTruthy();
    expect(screen.getByText(/Open a supported TTD booking page to start/i)).toBeTruthy();
  });

  it('F. Upcoming releases: displays verified official TTD quota information', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/UPCOMING TTD RELEASES/i)).toBeTruthy();
    });

    // Official TTD badge
    expect(screen.getByText(/Official TTD update/i)).toBeTruthy();

    // Verified release info
    expect(screen.getAllByText(/Special Entry Darshan/i).length).toBeGreaterThan(0);
  });

  it('G. No verified release: displays fallback message without fabricating dates or countdowns', async () => {
    const spy = vi.spyOn(releaseCal, 'getVerifiedReleaseEvents').mockReturnValue([]);
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Latest TTD release schedule unavailable/i)).toBeTruthy();
    });

    // Official TTD link is provided instead of fake dates
    expect(screen.getByText(/VIEW TTD UPDATES ↗/i)).toBeTruthy();
    spy.mockRestore();
  });

  it('H. Backend readiness: internal checks operate silently without exposing checklist on Home', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Detailed checks are not visible on Home
    expect(screen.queryByText(/Profile selected & complete/i)).toBeNull();
    expect(screen.queryByText(/Required special details complete/i)).toBeNull();
    expect(screen.queryByText(/System Verification State/i)).toBeNull();

    // Home shows clean consumer status with modal diagnostics trigger
    expect(screen.getByText(/Booking Readiness/i)).toBeTruthy();
    const diagBtn = screen.getByRole('button', { name: /Open system diagnostics modal/i });
    expect(diagBtn).toBeTruthy();
  });

  it('E. Temporary lock: renders CHECK BOOKING HISTORY and TRY AGAIN without showing Fill failed', async () => {
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

    // Should NOT show "Fill failed"
    expect(screen.queryByText(/Fill failed/i)).toBeNull();

    // Primary action provides CHECK BOOKING HISTORY or TRY AGAIN
    const lockBtn = screen.getByRole('button', { name: /CHECK BOOKING HISTORY/i });
    expect(lockBtn).toBeTruthy();

    const tryAgainBtn = screen.getByRole('button', { name: /TRY AGAIN/i });
    expect(tryAgainBtn).toBeTruthy();
  });

  it('I. Optional fields: pilgrim mobile number is optional for Special Entry Darshan and does not block readiness', async () => {
    const profileWithoutPilgrimMobile: Profile = {
      ...sampleProfile,
      pilgrims: [
        {
          ...sampleProfile.pilgrims[0],
          mobile: undefined, // Optional mobile
        },
      ],
    };
    storageMap.set('sp_profiles', [profileWithoutPilgrimMobile]);

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Dominant action is still ready to FILL & VERIFY
    const actionBtn = screen.getByRole('button', { name: /FILL & VERIFY/i });
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.hasAttribute('disabled')).toBe(false);
  });
});

