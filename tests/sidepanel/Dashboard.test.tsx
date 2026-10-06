// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Dashboard } from '../../src/sidepanel/pages/Dashboard';
import { Gender, IdType } from '../../src/shared/types';
import type { Profile } from '../../src/shared/types';

const storageMap = new Map<string, any>();

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
      url: 'https://ttdevasthanams.ap.gov.in/darshan/entry',
      title: 'TTD Special Entry Darshan',
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
  name: 'Family',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  selectedPilgrims: { darshan: ['p1'] },
  pilgrims: [
    {
      id: 'p1',
      firstName: 'Govinda',
      lastName: 'Sharma',
      fullName: 'Govinda Sharma',
      gender: Gender.MALE,
      age: 40,
      idType: IdType.AADHAAR,
      idNumber: '123456789012',
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

describe('Dashboard Component', () => {
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

  it('renders Dashboard with single dominant action ⚡ FILL & VERIFY', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Family')).toBeTruthy();
    });

    // Check single dominant action button exists
    const actionBtn = screen.getByRole('button', { name: /FILL & VERIFY/i });
    expect(actionBtn).toBeTruthy();

    // Check Privacy badge
    expect(screen.getAllByText(/Local data/i)[0]).toBeTruthy();

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
});
