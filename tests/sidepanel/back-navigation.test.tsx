/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import App from '../../src/sidepanel/App';
import { BackButton } from '../../src/sidepanel/design-system/BackButton';
import { ProfilesPage } from '../../src/sidepanel/components/profiles/ProfilesPage';
import { ProfileCreateModal } from '../../src/sidepanel/components/profiles/ProfileCreateModal';
import { PilgrimEditorModal } from '../../src/sidepanel/components/profiles/PilgrimEditor';
import { TravelChecklist } from '../../src/sidepanel/components/profiles/TravelChecklist';
import { Documents } from '../../src/sidepanel/pages/Documents';
import { More } from '../../src/sidepanel/pages/More';
import { Backup } from '../../src/sidepanel/pages/Backup';
import { Bookings } from '../../src/sidepanel/pages/Bookings';
import { Validation } from '../../src/sidepanel/pages/Validation';
import { Gender, IdType, ServiceType, type Profile, type Pilgrim } from '../../src/shared/types';
import { setLanguage, t } from '../../src/i18n';

// In-memory mock storage
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
    query: vi.fn(async () => [{ id: 101, url: 'https://ttdevasthanams.ap.gov.in', title: 'TTD' }]),
    create: vi.fn(async () => ({ id: 102 })),
    sendMessage: vi.fn(async () => ({ success: true })),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({ success: true })),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

const mockPilgrim: Pilgrim = {
  id: 'p-1',
  firstName: 'Srinivasa',
  lastName: 'Ramanujan',
  fullName: 'Srinivasa Ramanujan',
  gender: Gender.MALE,
  age: 32,
  idType: IdType.AADHAAR,
  idNumber: '999988887777',
  mobile: '9876543210',
  country: 'India',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockProfile: Profile = {
  id: 'prof-1',
  name: 'Venkateswara Seva Group',
  description: 'Annual Darshan Group',
  defaultService: ServiceType.DARSHAN,
  isDefault: true,
  pilgrims: [mockPilgrim],
  selectedPilgrims: { darshan: ['p-1'] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SevaPilot Back Navigation Suite', () => {
  beforeEach(() => {
    storageMap.clear();
    storageMap.set('sp_settings', {
      onboardingComplete: true,
      language: 'en',
      theme: 'light',
      sensitivePreviewMasking: true,
    });
    storageMap.set('sp_profiles', [mockProfile]);
    setLanguage('en');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. BackButton Component Design System Tests', () => {
    it('renders with accessible label, min touch target, and click handler', () => {
      const handleClick = vi.fn();
      render(<BackButton onClick={handleClick} />);

      const button = screen.getByRole('button', { name: /^back$/i });
      expect(button).toBeDefined();
      expect(button.getAttribute('title')).toBe('Back');
      expect(button.className).toContain('min-h-[36px]');
      expect(button.className).toContain('min-w-[36px]');
      expect(button.className).toContain('focus-visible:outline-2');

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders localized text when showText is true and supports multi-language labels', () => {
      const languages = [
        { code: 'en' as const, expected: 'Back' },
        { code: 'te' as const, expected: 'వెనుకకు' },
        { code: 'hi' as const, expected: 'वापस' },
        { code: 'ta' as const, expected: 'பின்செல்' },
        { code: 'kn' as const, expected: 'ಹಿಂದೆ' },
      ];

      for (const { code, expected } of languages) {
        setLanguage(code);
        const { unmount } = render(<BackButton onClick={() => {}} showText />);
        const button = screen.getByRole('button', { name: expected });
        expect(button).toBeDefined();
        expect(screen.getByText(expected)).toBeDefined();
        unmount();
      }
    });

    it('allows custom override label and aria-label', () => {
      render(<BackButton onClick={() => {}} label="Return to Hub" showText />);
      const button = screen.getByRole('button', { name: 'Return to Hub' });
      expect(button).toBeDefined();
      expect(screen.getByText('Return to Hub')).toBeDefined();
    });
  });

  describe('2. Secondary Pages Direct & Fallback Tests', () => {
    it('Documents page renders BackButton when onBack is provided and invokes it', () => {
      const handleBack = vi.fn();
      render(<Documents onBack={handleBack} />);

      const backBtn = screen.getByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('Backup page renders BackButton when onBack is provided and invokes it', () => {
      const handleBack = vi.fn();
      render(<Backup onBack={handleBack} />);

      const backBtn = screen.getByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('Bookings page renders BackButton when onBack is provided and invokes it', () => {
      const handleBack = vi.fn();
      render(<Bookings onBack={handleBack} />);

      const backBtn = screen.getByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('Validation page renders BackButton when onBack is provided and invokes it', () => {
      const handleBack = vi.fn();
      render(<Validation onBack={handleBack} />);

      const backBtn = screen.getByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('More page hub view renders BackButton when onBack is provided and switches to sub-views', async () => {
      const handleBack = vi.fn();
      render(<More onNavigate={vi.fn()} onBack={handleBack} />);

      // In Hub view, Back button is present
      const backBtn = screen.getByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);

      // Open Shortcuts sub-view
      const shortcutsBtn = screen.getByText(/Keyboard Shortcuts/i);
      fireEvent.click(shortcutsBtn);

      // In Shortcuts view, Back button returns to Hub
      const returnToHub = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(returnToHub);

      // Should be back to main Hub title
      expect(screen.getByText(/More & Preferences/i)).toBeDefined();
    });
  });

  describe('3. Profiles Hierarchical Back Navigation Tests', () => {
    it('Profiles → Create Profile → Back returns to Profiles', async () => {
      const handleBack = vi.fn();
      render(<ProfilesPage onBack={handleBack} />);

      await waitFor(() => {
        expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
      });

      // Click Create Profile
      const createBtn = screen.getByRole('button', { name: /create profile/i });
      fireEvent.click(createBtn);

      // Create modal is open with placeholder
      expect(screen.getByPlaceholderText(/e\.g\. Family Darshan/i)).toBeDefined();

      // Click Back button in Create Modal
      const modalBackBtns = screen.getAllByRole('button', { name: /^back$/i });
      fireEvent.click(modalBackBtns[modalBackBtns.length - 1]);

      // Modal closed, back on profiles list
      expect(screen.queryByPlaceholderText(/e\.g\. Family Darshan/i)).toBeNull();
      expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
    });

    it('Profiles → Profile Details (Expanded) → Back collapses details', async () => {
      render(<ProfilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
      });

      // Initially no Back button if opened directly without onBack
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();

      // Click on "Edit" button to expand profile details
      const expandBtn = await screen.findByRole('button', { name: /^edit$/i });
      fireEvent.click(expandBtn);

      // Now expanded, Back button must appear
      const backBtn = await screen.findByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();

      // Click Back button collapses details
      fireEvent.click(backBtn);
      // Profile collapsed, Back button disappears
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    });

    it('Profiles → Profile details → Edit Devotee → Back returns to profile details', async () => {
      render(<ProfilesPage />);

      await waitFor(() => {
        expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
      });

      // Expand profile card via Edit button
      const expandBtn = await screen.findByRole('button', { name: /^edit$/i });
      fireEvent.click(expandBtn);

      // Click Edit Devotee button
      const editDevoteeBtn = await screen.findByRole('button', { name: /Edit Srinivasa Ramanujan/i });
      fireEvent.click(editDevoteeBtn);

      // Devotee editor modal is open
      expect(await screen.findByText('Edit Pilgrim Details')).toBeDefined();

      // Click Back button in Pilgrim Editor Modal
      const backButtons = screen.getAllByRole('button', { name: /^back$/i });
      // The modal back button is the last rendered back button
      fireEvent.click(backButtons[backButtons.length - 1]);

      // Editor modal closed, still on expanded profile details
      expect(screen.queryByText('Edit Pilgrim Details')).toBeNull();
      expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
    });

    it('Travel Checklist / Slip Modal Back button closes slip modal', () => {
      const handleClose = vi.fn();
      render(<TravelChecklist slipProfile={mockProfile} onClose={handleClose} />);

      expect(screen.getByText('Pilgrim Travel Checklist')).toBeDefined();
      const backBtn = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(backBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('Navigation never clears, mutates, or duplicates stored pilgrim profiles', async () => {
      const handleBack = vi.fn();
      render(<ProfilesPage onBack={handleBack} />);

      await waitFor(() => {
        expect(screen.getByText('Venkateswara Seva Group')).toBeDefined();
      });

      // Expand, open create, close create, open edit, close edit
      fireEvent.click(screen.getByText('Venkateswara Seva Group'));
      const createBtn = screen.getByRole('button', { name: /create profile/i });
      fireEvent.click(createBtn);
      const backBtns = screen.getAllByRole('button', { name: /^back$/i });
      fireEvent.click(backBtns[backBtns.length - 1]);

      // Verify stored profiles unchanged
      const stored = storageMap.get('sp_profiles');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('prof-1');
      expect(stored[0].pilgrims).toHaveLength(1);
      expect(stored[0].pilgrims[0].fullName).toBe('Srinivasa Ramanujan');
    });
  });

  describe('4. Full App End-to-End Navigation Journey Tests', () => {
    it('starts on Home (Dashboard) with NO redundant Back button', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Tirumala SevaPilot')).toBeDefined();
      });

      // No Back button in page header on dashboard
      const backButtons = screen.queryAllByRole('button', { name: /^back$/i });
      expect(backButtons).toHaveLength(0);
    });

    it('Home → Profiles → Back returns to Home', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Tirumala SevaPilot')).toBeDefined();
      });

      // Navigate to Profiles via bottom nav
      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      const profilesTab = within(mainNav).getByRole('button', { name: /profiles/i });
      fireEvent.click(profilesTab);

      // On Profiles screen, Back button is visible
      const backBtn = await screen.findByRole('button', { name: /^back$/i });
      expect(backBtn).toBeDefined();

      // Click Back button
      fireEvent.click(backBtn);

      // Returns to Home (Dashboard) and Back button is gone
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
      });
    });

    it('Home → More → Sacred Document Vault → Back returns to More → Back returns to Home', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Tirumala SevaPilot')).toBeDefined();
      });

      // 1. Navigate to More via bottom nav
      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      const moreTab = within(mainNav).getByRole('button', { name: /more/i });
      fireEvent.click(moreTab);

      await waitFor(() => {
        expect(screen.getByText(/More & Preferences/i)).toBeDefined();
      });

      // 2. Click Documents in More
      const docsBtn = screen.getByText(/Documents & Photos/i);
      fireEvent.click(docsBtn);

      // Now on Sacred Document Vault screen
      await waitFor(() => {
        expect(screen.getByText(/Sacred Document Vault/i)).toBeDefined();
      });

      // 3. Click Back on Vault screen
      const vaultBack = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(vaultBack);

      // Returns to More & Preferences
      await waitFor(() => {
        expect(screen.getByText(/More & Preferences/i)).toBeDefined();
      });

      // 4. Click Back on More screen
      const moreBack = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(moreBack);

      // Returns to Home
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
      });
    });

    it('Directly falling back to Home when history is minimal does not crash or loop', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Tirumala SevaPilot')).toBeDefined();
      });

      // Trigger popstate event when at home
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

      // App remains functional on Home
      expect(screen.getByText('Tirumala SevaPilot')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    });
  });
});
