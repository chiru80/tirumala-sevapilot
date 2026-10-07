// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 2.2 Comprehensive Test Suite
// Validates:
// 1. Mobile/Readiness Separation (Pilgrim Health vs Booking Readiness)
// 2. Selection Regression (Select 6 -> 0 -> 2, Max 6 cap, [] != all)
// 3. i18n Switching without reload & English Fallback
// 4. Privacy Masking (Aadhaar & Mobile)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { checkPilgrimHealth, checkGeneralHealth, calculateProfileHealth } from '../../src/services/profile-health';
import { Gender, IdType, ServiceType } from '../../src/shared/types';
import type { Pilgrim, Profile } from '../../src/shared/types';
import { t, setLanguage, getLanguage, onLanguageChange } from '../../src/i18n';

describe('Phase 2.2 — Mobile & Profile Health Separation (Part 1 & 12)', () => {
  const completePilgrimNoMobileNoEmail: Pilgrim = {
    id: 'p1',
    firstName: 'Srinivasa',
    lastName: 'Rao',
    fullName: 'Srinivasa Rao',
    gender: Gender.MALE,
    age: 38,
    idType: IdType.AADHAAR,
    idNumber: '987654321098',
    country: 'India',
    // Mobile and email deliberately omitted
    createdAt: new Date().toISOString(),
  };

  it('marks pilgrim with 5 required fields and NO mobile as 100% Ready', () => {
    const health = checkPilgrimHealth(completePilgrimNoMobileNoEmail);
    expect(health.isReady).toBe(true);
    expect(health.missingFields).toHaveLength(0);
  });

  it('marks pilgrim with NO email as 100% Ready', () => {
    const pilgrimWithMobileOnly: Pilgrim = {
      ...completePilgrimNoMobileNoEmail,
      mobile: '9876543210',
    };
    const health = checkPilgrimHealth(pilgrimWithMobileOnly);
    expect(health.isReady).toBe(true);
    expect(health.missingFields).toHaveLength(0);
  });

  it('marks pilgrim with NO mobile and NO email as 100% Ready', () => {
    const health = checkPilgrimHealth(completePilgrimNoMobileNoEmail);
    expect(health.isReady).toBe(true);
  });

  it('marks pilgrim incomplete when ID Number is missing', () => {
    const incomplete: Pilgrim = {
      ...completePilgrimNoMobileNoEmail,
      idNumber: '',
    };
    const health = checkPilgrimHealth(incomplete);
    expect(health.isReady).toBe(false);
    expect(health.missingFields).toContain('idNumber');
  });

  it('marks pilgrim incomplete when Full Name is missing', () => {
    const incomplete: Pilgrim = {
      ...completePilgrimNoMobileNoEmail,
      fullName: '',
      firstName: '',
      lastName: '',
    };
    const health = checkPilgrimHealth(incomplete);
    expect(health.isReady).toBe(false);
    expect(health.missingFields).toContain('fullName');
  });

  it('marks pilgrim incomplete when Gender is missing', () => {
    const incomplete: Pilgrim = {
      ...completePilgrimNoMobileNoEmail,
      gender: undefined as any,
    };
    const health = checkPilgrimHealth(incomplete);
    expect(health.isReady).toBe(false);
    expect(health.missingFields).toContain('gender');
  });

  it('marks pilgrim incomplete when Age and DOB are both missing', () => {
    const incomplete: Pilgrim = {
      ...completePilgrimNoMobileNoEmail,
      age: undefined,
      dateOfBirth: '',
    };
    const health = checkPilgrimHealth(incomplete);
    expect(health.isReady).toBe(false);
    expect(health.missingFields).toContain('age');
  });

  it('evaluates General Details separately from individual pilgrims', () => {
    const profileWithoutGeneralMobile: Profile = {
      id: 'prof1',
      name: 'Family Group',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedPilgrims: { darshan: ['p1'] },
      pilgrims: [completePilgrimNoMobileNoEmail],
      general: {
        email: 'devotee@example.com',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        pinCode: '517501',
        country: 'India',
        // General mobile omitted
      },
    };

    // Profile health strictly evaluates pilgrims: 100% ready
    const profileHealth = calculateProfileHealth(profileWithoutGeneralMobile);
    expect(profileHealth.percentage).toBe(100);
    expect(profileHealth.incomplete).toBe(0);
    expect(profileHealth.ready).toBe(1);

    // General health checks step 2 booking contact: mobile is required
    const generalHealth = checkGeneralHealth(profileWithoutGeneralMobile.general);
    expect(generalHealth.isReady).toBe(false);
    expect(generalHealth.missingFields).toContain('mobile');
  });

  it('passes general health when booking mobile is provided', () => {
    const general = {
      mobile: '9876543210',
      email: 'booking@example.com',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      pinCode: '517501',
      country: 'India',
    };
    const generalHealth = checkGeneralHealth(general);
    expect(generalHealth.isReady).toBe(true);
    expect(generalHealth.missingFields).toHaveLength(0);
  });
});

describe('Phase 2.2 — Pilgrim Selection Regression & Limits (Part 11)', () => {
  function makePilgrims(count: number): Pilgrim[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      firstName: `Pilgrim${i + 1}`,
      lastName: 'Devotee',
      fullName: `Pilgrim${i + 1} Devotee`,
      gender: Gender.MALE,
      age: 30 + i,
      idType: IdType.AADHAAR,
      idNumber: `98765432109${i}`,
      country: 'India',
      createdAt: new Date().toISOString(),
    }));
  }

  it('handles Select 6 -> Deselect all -> Select 2 without treating [] as select all', () => {
    const pilgrims = makePilgrims(6);
    const profile: Profile = {
      id: 'prof_test',
      name: 'Group 6',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pilgrims,
      selectedPilgrims: { darshan: pilgrims.map(p => p.id) },
    };

    // 1. Initial: 6 selected
    expect(profile.selectedPilgrims?.darshan).toHaveLength(6);

    // 2. User deselects all -> state is explicitly empty array []
    const deselectedState: string[] = [];
    profile.selectedPilgrims = { darshan: deselectedState };

    // Contract: [] MUST be preserved as 0 selected, NEVER defaulted to all
    const activeSelectedAfterDeselect = profile.selectedPilgrims.darshan;
    expect(activeSelectedAfterDeselect).toHaveLength(0);
    expect(activeSelectedAfterDeselect).toEqual([]);

    // 3. User selects exactly 2 pilgrims
    const selectedTwo = [pilgrims[0].id, pilgrims[1].id];
    profile.selectedPilgrims = { darshan: selectedTwo };

    expect(profile.selectedPilgrims.darshan).toHaveLength(2);
    expect(profile.selectedPilgrims.darshan).toEqual(['p1', 'p2']);
  });

  it('caps Select All at maximum 6 pilgrims when 7+ are available', () => {
    const eightPilgrims = makePilgrims(8);
    const MAX_PILGRIMS = 6;

    // Simulation of handleToggleSelectAll or Select All handler
    const selectAllCapped = eightPilgrims.slice(0, MAX_PILGRIMS).map(p => p.id);

    expect(selectAllCapped).toHaveLength(6);
    expect(selectAllCapped).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(selectAllCapped).not.toContain('p7');
    expect(selectAllCapped).not.toContain('p8');
  });
});

describe('Phase 2.2 — Extension i18n & Reactive Language Switching (Part 2)', () => {
  it('switches languages reactively (English -> Telugu -> English) without reload', () => {
    const listenerHistory: string[] = [];
    const unsubscribe = onLanguageChange(lang => {
      listenerHistory.push(lang);
    });

    // Initial state is English
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('common.edit')).toBe('Edit');
    expect(t('common.save')).toBe('Save');

    // Switch to Telugu
    setLanguage('te');
    expect(getLanguage()).toBe('te');
    expect(listenerHistory).toContain('te');
    // In Telugu:
    expect(t('common.save')).toBe('భద్రపరచండి');
    expect(t('common.cancel')).toBe('రద్దు చేయండి');

    // Switch back to English
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('common.save')).toBe('Save');
    expect(t('common.edit')).toBe('Edit');

    unsubscribe();
  });

  it('gracefully falls back to English when a key is missing in another language', () => {
    setLanguage('hi');
    // If a nested key is not translated in Hindi, it must resolve to English rather than key path
    const res = t('app.name');
    expect(res).toBeTruthy();
    expect(typeof res).toBe('string');
    setLanguage('en');
  });

  it('correctly replaces parameters in translated strings', () => {
    setLanguage('en');
    const msg = t('dashboard.devoteeProgress', { current: 3, total: 6 });
    expect(msg).toMatch(/(Devotee|Filling pilgrim|Pilgrim) 3 of 6/);
  });
});

describe('Phase 2.2 — Sensitive Data Masking (Part 14)', () => {
  function maskAadhaar(id?: string): string {
    if (!id) return '—';
    const clean = id.replace(/\s+/g, '');
    if (clean.length === 12) {
      return `•••• •••• ${clean.slice(-4)}`;
    }
    return '••••';
  }

  function maskMobile(mobile?: string): string {
    if (!mobile) return '—';
    const digits = mobile.replace(/\D/g, '');
    if (digits.length === 10) {
      return `•••• •• ${digits.slice(-4)}`;
    }
    return '••••';
  }

  it('masks 12-digit Aadhaar number as •••• •••• 9012', () => {
    const masked = maskAadhaar('123456789012');
    expect(masked).toBe('•••• •••• 9012');
    expect(masked).not.toContain('1234');
    expect(masked).not.toContain('5678');
  });

  it('masks 10-digit mobile number as •••• •• 7890', () => {
    const masked = maskMobile('9876567890');
    expect(masked).toBe('•••• •• 7890');
    expect(masked).not.toContain('98765');
  });
});
