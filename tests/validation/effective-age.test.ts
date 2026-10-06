import { describe, it, expect } from 'vitest';
import { getEffectiveAge } from '../../src/shared/utils';

describe('P1 — DOB → Age Normalization (getEffectiveAge)', () => {
  it('1. uses valid numeric age when present', () => {
    const pilgrim = { age: 35, dateOfBirth: '1990-05-15' };
    expect(getEffectiveAge(pilgrim)).toBe(35);
  });

  it('2. uses valid string age when present', () => {
    const pilgrim = { age: '42' as any, dateOfBirth: '1980-01-01' };
    expect(getEffectiveAge(pilgrim)).toBe(42);
  });

  it('3. calculates age from DOB when stored age is missing or 0', () => {
    // Reference date: 2026-09-25
    const refDate = new Date(2026, 8, 25); // Sept 25, 2026
    const pilgrim = { age: 0, dateOfBirth: '2000-09-20' }; // Birthday passed 5 days ago
    expect(getEffectiveAge(pilgrim, refDate)).toBe(26);
  });

  it('4. correctly handles birthday not yet reached in current year', () => {
    const refDate = new Date(2026, 8, 25); // Sept 25, 2026
    const pilgrim = { dateOfBirth: '2000-11-10' }; // Birthday in November
    expect(getEffectiveAge(pilgrim, refDate)).toBe(25);
  });

  it('5. correctly handles exact birthday today', () => {
    const refDate = new Date(2026, 8, 25); // Sept 25, 2026
    const pilgrim = { dateOfBirth: '1995-09-25' };
    expect(getEffectiveAge(pilgrim, refDate)).toBe(31);
  });

  it('6. correctly handles leap year baby (Feb 29) on a non-leap year (e.g. 2025)', () => {
    // Born Feb 29, 2000
    // On Feb 28, 2025: not yet 25 (month is Feb, date 28 < 29)
    const feb28 = new Date(2025, 1, 28);
    const pilgrim = { dateOfBirth: '2000-02-29' };
    expect(getEffectiveAge(pilgrim, feb28)).toBe(24);

    // On March 1, 2025: turned 25
    const mar1 = new Date(2025, 2, 1);
    expect(getEffectiveAge(pilgrim, mar1)).toBe(25);
  });

  it('7. correctly handles leap year baby (Feb 29) on a leap year (e.g. 2024)', () => {
    // Born Feb 29, 2000
    // On Feb 29, 2024: exactly 24
    const feb29 = new Date(2024, 1, 29);
    const pilgrim = { dateOfBirth: '2000-02-29' };
    expect(getEffectiveAge(pilgrim, feb29)).toBe(24);
  });

  it('8. returns undefined when neither age nor DOB is usable', () => {
    expect(getEffectiveAge(null)).toBeUndefined();
    expect(getEffectiveAge(undefined)).toBeUndefined();
    expect(getEffectiveAge({ age: 0, dateOfBirth: '' })).toBeUndefined();
    expect(getEffectiveAge({ age: -5, dateOfBirth: 'invalid-date' })).toBeUndefined();
    expect(getEffectiveAge({ age: 200 })).toBeUndefined(); // exceeds max 125
  });
});
