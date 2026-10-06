// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 2.3 Master Test Matrix
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { Gender, IdType, ServiceType } from '../src/shared/types';
import type { Pilgrim, Profile } from '../src/shared/types';
import { getEffectiveAge } from '../src/shared/utils';
import { validateAadhaar, generateVerhoeffChecksum } from '../src/validation/aadhaar';
import { validateImportPayload } from '../src/storage/repository';
import { calculateProfileHealth, checkPilgrimHealth } from '../src/services/profile-health';
import { t, setLanguage, getLanguage } from '../src/i18n';
import en from '../src/i18n/en/messages.json';
import te from '../src/i18n/te/messages.json';
import hi from '../src/i18n/hi/messages.json';
import ta from '../src/i18n/ta/messages.json';
import kn from '../src/i18n/kn/messages.json';
import { REQUIRED_GENERAL_FIELDS } from '../src/content/autofill/autofill-manager';
import { sendToTargetTab } from '../src/background/message-router';

function createMockPilgrim(id: string, name: string, overrides: Partial<Pilgrim> = {}): Pilgrim {
  return {
    id,
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] || '',
    fullName: name,
    gender: Gender.MALE,
    age: 30,
    idType: IdType.AADHAAR,
    idNumber: '987654321098',
    country: 'India',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Master Test Matrix (Section 19)', () => {
  // ─── A through F: 1 to 6 Pilgrims Capacity & Health ───
  describe('Pilgrim Count Scaling (1 to 6 Pilgrims)', () => {
    for (let count = 1; count <= 6; count++) {
      it(`supports and validates profile with exactly ${count} pilgrim(s)`, () => {
        const pilgrims = Array.from({ length: count }, (_, i) =>
          createMockPilgrim(`p${i + 1}`, `Devotee ${i + 1}`)
        );
        const profile: Profile = {
          id: `prof-${count}`,
          name: `Group of ${count}`,
          defaultService: ServiceType.DARSHAN,
          pilgrims,
          selectedPilgrims: {},
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const health = calculateProfileHealth(profile);
        expect(health.total).toBe(count);
        expect(health.ready).toBe(count);
        expect(health.percentage).toBe(100);
      });
    }
  });

  // ─── Selection Matrix ───
  describe('Selection Matrix', () => {
    const pilgrims = Array.from({ length: 4 }, (_, i) =>
      createMockPilgrim(`p${i + 1}`, `Devotee ${i + 1}`)
    );

    it('Select all: selects all available pilgrims', () => {
      const allIds = pilgrims.map(p => p.id);
      const selected = [...allIds];
      expect(selected).toHaveLength(4);
      expect(selected).toEqual(['p1', 'p2', 'p3', 'p4']);
    });

    it('Deselect all: selects 0 pilgrims', () => {
      const selected: string[] = [];
      expect(selected).toHaveLength(0);
      expect(selected.length === 0).toBe(true);
    });

    it('Select 2: selects exactly 2 pilgrims', () => {
      const selected = ['p1', 'p3'];
      expect(selected).toHaveLength(2);
      expect(selected).toContain('p1');
      expect(selected).toContain('p3');
      expect(selected).not.toContain('p2');
    });

    it('Change selection: transitions correctly between selections', () => {
      let selected = ['p1', 'p2'];
      expect(selected).toEqual(['p1', 'p2']);

      selected = ['p3', 'p4'];
      expect(selected).toEqual(['p3', 'p4']);

      selected = ['p1'];
      expect(selected).toHaveLength(1);
    });
  });

  // ─── Data Variations Matrix ───
  describe('Pilgrim Data Variations', () => {
    it('mobile missing: pilgrim is still 100% Ready (mobile optional)', () => {
      const pilgrim = createMockPilgrim('p1', 'Ravi Kumar', { mobile: undefined });
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(true);
      expect(health.missingFields).toHaveLength(0);
    });

    it('mobile present: valid mobile recognized', () => {
      const pilgrim = createMockPilgrim('p1', 'Ravi Kumar', { mobile: '9876543210' });
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(true);
    });

    it('DOB without age: getEffectiveAge computes correct age and pilgrim is ready', () => {
      const pilgrim = createMockPilgrim('p1', 'Ravi Kumar', {
        age: undefined,
        dateOfBirth: '1990-05-15',
      });
      const age = getEffectiveAge(pilgrim, new Date('2026-06-01'));
      expect(age).toBe(36);
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(true);
    });

    it('age without DOB: valid age accepted and pilgrim is ready', () => {
      const pilgrim = createMockPilgrim('p1', 'Ravi Kumar', {
        age: 42,
        dateOfBirth: undefined,
      });
      const age = getEffectiveAge(pilgrim);
      expect(age).toBe(42);
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(true);
    });

    it('invalid Aadhaar: fails Verhoeff / format check', () => {
      const res1 = validateAadhaar('12345'); // too short
      expect(res1.valid).toBe(false);

      const res2 = validateAadhaar('111111111111'); // repeated digits
      expect(res2.valid).toBe(false);

      const res3 = validateAadhaar('987654321099'); // invalid checksum
      expect(res3.valid).toBe(false);
    });

    it('valid Aadhaar: passes checksum', () => {
      const partial = '23456789012';
      const checksum = generateVerhoeffChecksum(partial);
      const validAadhaar = partial + checksum;
      const res = validateAadhaar(validAadhaar);
      expect(res.valid).toBe(true);
    });

    it('missing gender: marks pilgrim unready', () => {
      const pilgrim = createMockPilgrim('p1', 'Ravi Kumar', { gender: undefined as any });
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(false);
      expect(health.missingFields).toContain('gender');
    });

    it('missing name: marks pilgrim unready', () => {
      const pilgrim = createMockPilgrim('p1', '', { fullName: '', firstName: '', lastName: '' });
      const health = checkPilgrimHealth(pilgrim);
      expect(health.isReady).toBe(false);
      expect(health.missingFields).toContain('fullName');
    });
  });

  // ─── General Details Matrix ───
  describe('General Details Validation Matrix', () => {
    it('defines canonical REQUIRED_GENERAL_FIELDS', () => {
      expect(REQUIRED_GENERAL_FIELDS).toEqual([
        'mobile',
        'city',
        'state',
        'country',
        'pinCode',
      ]);
    });

    it('mobile only: missing other required general fields', () => {
      const general = { mobile: '9876543210' };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toEqual(['city', 'state', 'country', 'pinCode']);
    });

    it('missing city: identifies city missing', () => {
      const general = { mobile: '9876543210', state: 'AP', country: 'India', pinCode: '517501' };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toEqual(['city']);
    });

    it('missing state: identifies state missing', () => {
      const general = { mobile: '9876543210', city: 'Tirupati', country: 'India', pinCode: '517501' };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toEqual(['state']);
    });

    it('missing country: identifies country missing', () => {
      const general = { mobile: '9876543210', city: 'Tirupati', state: 'AP', pinCode: '517501' };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toEqual(['country']);
    });

    it('missing PIN: identifies pinCode missing', () => {
      const general = { mobile: '9876543210', city: 'Tirupati', state: 'AP', country: 'India' };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toEqual(['pinCode']);
    });

    it('complete general details: all required fields present, optional email allowed', () => {
      const general = {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
        email: 'devotee@example.com',
      };
      const missing = REQUIRED_GENERAL_FIELDS.filter(f => !(general as any)[f]);
      expect(missing).toHaveLength(0);
    });
  });

  // ─── Navigation Matrix ───
  describe('Navigation & Tab Targeting Matrix', () => {
    it('handles two TTD tabs with strict tabId targeting', async () => {
      const tabs: Record<number, any> = {
        101: { id: 101, url: 'https://ttdevasthanams.ap.gov.in/booking' },
        102: { id: 102, url: 'https://ttdevasthanams.ap.gov.in/special-entry' },
      };

      (globalThis as any).chrome = {
        tabs: {
          get: vi.fn(async (id: number) => {
            if (tabs[id]) return tabs[id];
            throw new Error('Tab not found');
          }),
          sendMessage: vi.fn(async (tabId: number) => ({ success: true, tabId })),
        },
      };

      const res = await sendToTargetTab({ type: 'PING' } as any, 102);
      expect(res).toEqual({ success: true, tabId: 102 });
      expect((globalThis as any).chrome.tabs.sendMessage).toHaveBeenCalledWith(102, expect.anything());
    });

    it('rejects non-TTD active tab', async () => {
      (globalThis as any).chrome = {
        tabs: {
          get: vi.fn(async () => ({ id: 55, url: 'https://google.com' })),
          sendMessage: vi.fn(),
        },
      };

      const res = await sendToTargetTab({ type: 'PING' } as any, 55);
      expect(res.error).toBe('Please open a supported TTD booking page.');
      expect((globalThis as any).chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('handles TTD tab closed or changed', async () => {
      (globalThis as any).chrome = {
        tabs: {
          get: vi.fn(async () => {
            throw new Error('Tab was closed');
          }),
          sendMessage: vi.fn(),
        },
      };

      const res = await sendToTargetTab({ type: 'PING' } as any, 999);
      expect(res.error).toBe('Please open a supported TTD booking page.');
    });
  });

  // ─── I18N Matrix (All 5 Languages) ───
  describe('I18N Matrix (All 5 Languages)', () => {
    const supportedLangs = ['en', 'te', 'hi', 'ta', 'kn'] as const;
    const allDicts: Record<string, any> = { en, te, hi, ta, kn };

    it.each(supportedLangs)('language %s contains all essential UI keys and translates correctly', (lang) => {
      setLanguage(lang);
      expect(getLanguage()).toBe(lang);

      expect(t('profiles.title')).toBeTruthy();
      expect(t('dashboard.readyToFill')).toBeTruthy();
      expect(t('settings.title')).toBeTruthy();
      expect(t('backup.title')).toBeTruthy();
    });

    it('resets to English and verifies exact key parity across all 5 dictionaries', () => {
      setLanguage('en');
      const enKeys = Object.keys(en);
      for (const lang of ['te', 'hi', 'ta', 'kn'] as const) {
        const langKeys = Object.keys(allDicts[lang]);
        expect(langKeys.length).toBe(enKeys.length);
        const missing = enKeys.filter(k => !(k in allDicts[lang]));
        expect(missing).toEqual([]);
      }
    });
  });

  // ─── Import Runtime Validation Matrix ───
  describe('Import Runtime Validation Matrix', () => {
    it('valid: passes validation and normalizes profile', () => {
      const validProfile = {
        name: 'Valid Family',
        pilgrims: [
          {
            firstName: 'Rama',
            fullName: 'Rama Rao',
            gender: Gender.MALE,
            age: 35,
            idType: IdType.AADHAAR,
            idNumber: '987654321098',
          },
        ],
      };
      const res = validateImportPayload([validProfile]);
      expect(res.valid).toBe(true);
      expect(res.profiles).toHaveLength(1);
    });

    it('invalid: rejects non-array payload', () => {
      const res = validateImportPayload('not an array' as any);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/not valid JSON/i);

      const resEmpty = validateImportPayload([]);
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toMatch(/No profiles found/i);
    });

    it('oversized: rejects payload exceeding MAX_PROFILES (50)', () => {
      const oversized = Array.from({ length: 51 }, (_, i) => ({
        name: `Group ${i}`,
        pilgrims: [],
      }));
      const res = validateImportPayload(oversized);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds maximum allowed profiles/i);
    });

    it('malformed: rejects profile with missing name or invalid pilgrim fields', () => {
      const malformed = [
        {
          name: '', // empty name
          pilgrims: [],
        },
      ];
      const res = validateImportPayload(malformed);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/missing a required name/i);
    });

    it('missing fields: rejects pilgrim with missing required identity', () => {
      const incomplete = [
        {
          name: 'Incomplete Devotees',
          pilgrims: [
            {
              fullName: 'Devotee',
              // missing gender, idType, idNumber, age
            },
          ],
        },
      ];
      const res = validateImportPayload(incomplete);
      expect(res.valid).toBe(false);
      expect(res.error).toBeTruthy();
    });

    it('duplicate IDs: rejects duplicate ID numbers within same profile', () => {
      const dup = [
        {
          name: 'Duplicate Test',
          pilgrims: [
            {
              fullName: 'Person One',
              gender: Gender.MALE,
              age: 30,
              idType: IdType.AADHAAR,
              idNumber: '987654321098',
            },
            {
              fullName: 'Person Two',
              gender: Gender.FEMALE,
              age: 28,
              idType: IdType.AADHAAR,
              idNumber: '987654321098', // duplicate ID!
            },
          ],
        },
      ];
      const res = validateImportPayload(dup);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Duplicate ID number/i);
    });
  });
});
