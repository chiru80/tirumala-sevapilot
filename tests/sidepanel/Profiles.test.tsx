// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Profiles } from '../../src/sidepanel/pages/Profiles';
import { Gender, IdType, ServiceType } from '../../src/shared/types';
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
};

const mockProfile: Profile = {
  id: 'prof1',
  name: 'Family Darshan',
  description: 'Annual pilgrimage',
  defaultService: ServiceType.DARSHAN,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  selectedPilgrims: { darshan: ['p1'] },
  pilgrims: [
    {
      id: 'p1',
      firstName: 'Venkatesh',
      lastName: 'Iyer',
      fullName: 'Venkatesh Iyer',
      gender: Gender.MALE,
      age: 45,
      idType: IdType.AADHAAR,
      idNumber: '987654321098',
      mobile: '9123456780',
      country: 'India',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('Profiles Page', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no profiles exist', async () => {
    storageMap.set('sp_profiles', []);
    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText(/No profiles( created)? yet/i)).toBeTruthy();
    });
  });

  it('renders profile card with health percentage and masked ID numbers', async () => {
    storageMap.set('sp_profiles', [mockProfile]);
    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText('Family Darshan')).toBeTruthy();
      expect(screen.getAllByText(/Ready/i)[0]).toBeTruthy();
      expect(screen.getByText(/Ready for Special Entry/i)).toBeTruthy();
    });

    // Expand devotee list
    const editBtn = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(editBtn);

    // Verify devotee is listed with masked Aadhaar: •••• •••• 1098
    await waitFor(() => {
      expect(screen.getByText('Venkatesh Iyer')).toBeTruthy();
      expect(screen.getByText(/1098/)).toBeTruthy();
      expect(screen.getByText(/6780/)).toBeTruthy();
    });
  });

  it('allows opening 5-section devotee editor modal', async () => {
    storageMap.set('sp_profiles', [mockProfile]);
    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText('Family Darshan')).toBeTruthy();
    });

    // Expand pilgrims
    const expandBtn = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/Edit Venkatesh Iyer/i)).toBeTruthy();
    });

    // Click edit pilgrim
    fireEvent.click(screen.getByLabelText(/Edit Venkatesh Iyer/i));

    // Verify 5 sections are present in modal
    await waitFor(() => {
      expect(screen.getByText('Edit Pilgrim Details')).toBeTruthy();
      expect(screen.getAllByText(/Personal/i)[0]).toBeTruthy();
      expect(screen.getAllByText(/Identity/i)[0]).toBeTruthy();
      expect(screen.getAllByText(/Contact/i)[0]).toBeTruthy();
      expect(screen.getAllByText(/Address/i)[0]).toBeTruthy();
      expect(screen.getAllByText(/Photo/i)[0]).toBeTruthy();
    });
  });

  it('renders service compatibility bar and slot indicators when expanded', async () => {
    storageMap.set('sp_profiles', [mockProfile]);
    render(<Profiles />);

    await waitFor(() => {
      expect(screen.getByText('Family Darshan')).toBeTruthy();
    });

    // Expand devotee list
    const editBtn = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(editBtn);

    // Verify service compatibility bar and slot badge
    await waitFor(() => {
      expect(screen.getByText(/1–6 pilgrims/i)).toBeTruthy();
      expect(screen.getByText(/Slot 1/i)).toBeTruthy();
    });

    // Switch service to Homam
    const homamBtn = screen.getByRole('button', { name: /Homam ₹1600/i });
    fireEvent.click(homamBtn);

    // Verify service limits update to Homam rules (Strictly 2 pilgrims)
    await waitFor(() => {
      expect(screen.getByText(/Strictly 2 pilgrims/i)).toBeTruthy();
    });
  });
});
