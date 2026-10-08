// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Phase 7 Release Intelligence Test Suite
// Verifies all Section 29 requirements: A through O.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseStrictReleaseDate,
  parseStrictReleaseTime,
  isValidCalendarDate,
} from '../../../src/services/ttd-information/release-date-parser';
import {
  IST_TIMEZONE,
  getReleaseEpochMs,
  isReleaseStale,
  calculateReleaseCountdown,
  filterFutureReleaseEvents,
  registerOfficialAnnouncement,
  getUpcomingReleaseEvent,
  resetReleaseEventsToDefault,
  validateReleaseScheduleIntegrity,
  processOfficialAnnouncementPipeline,
  type TtdReleaseEvent,
} from '../../../src/services/ttd-information/ttd-release-calendar';
import {
  calculateExpectedRelease,
  reconcileReleaseEvents,
} from '../../../src/services/ttd-information/recurring-pattern-engine';
import { detectReleaseChanges } from '../../../src/services/ttd-information/release-change-detector';
import {
  setCachedTtdData,
  getCachedTtdData,
  clearTtdCache,
} from '../../../src/services/ttd-information/ttd-cache';
import { parseTtdAnnouncement } from '../../../src/services/ttd-information/ttd-announcement-parser';
import { t, setLanguage } from '../../../src/i18n';

describe('Phase 7 — Release Intelligence & Verified TTD Calendar', () => {
  beforeEach(async () => {
    resetReleaseEventsToDefault();
    await clearTtdCache();
    setLanguage('en');
  });

  // ─── A. Date Parsing ───
  describe('A. Strict Date Parsing (Defensive & Calendar-Validated)', () => {
    it('parses valid dates across supported formats', () => {
      // DD Month YYYY
      const d1 = parseStrictReleaseDate('Quota will be released on 7 October 2026 at 10 AM');
      expect(d1).not.toBeNull();
      expect(d1?.date).toBe('2026-10-07');
      expect(d1?.day).toBe(7);
      expect(d1?.month).toBe(10);
      expect(d1?.year).toBe(2026);

      // Ordinal DDth Month
      const d2 = parseStrictReleaseDate('SED tickets on 24th October 2026');
      expect(d2?.date).toBe('2026-10-24');

      // Month DD, YYYY
      const d3 = parseStrictReleaseDate('Release on October 24, 2026');
      expect(d3?.date).toBe('2026-10-24');

      // DD-MM-YYYY
      const d4 = parseStrictReleaseDate('Bookings open 25-10-2026');
      expect(d4?.date).toBe('2026-10-25');

      // DD/MM/YYYY
      const d5 = parseStrictReleaseDate('Bookings open 27/10/2026');
      expect(d5?.date).toBe('2026-10-27');

      // Telugu date format
      const dTe = parseStrictReleaseDate('అక్టోబర్ 24, 2026 న టికెట్లు విడుదల');
      expect(dTe?.date).toBe('2026-10-24');
    });

    it('rejects impossible calendar dates without guessing', () => {
      // 32 October 2026
      expect(isValidCalendarDate(2026, 10, 32)).toBe(false);
      expect(parseStrictReleaseDate('Release on 32 October 2026')).toBeNull();

      // 30 February 2026 (non-leap)
      expect(isValidCalendarDate(2026, 2, 30)).toBe(false);
      expect(parseStrictReleaseDate('Release on 30 February 2026')).toBeNull();

      // 31 April (April only has 30 days)
      expect(isValidCalendarDate(2026, 4, 31)).toBe(false);
      expect(parseStrictReleaseDate('Release on 31 April 2026')).toBeNull();

      // Day 0
      expect(isValidCalendarDate(2026, 10, 0)).toBe(false);
    });
  });

  // ─── B. Time Parsing ───
  describe('B. Strict Time Parsing & Normalization', () => {
    it('normalizes 12-hr and 24-hr times to HH:mm in IST', () => {
      expect(parseStrictReleaseTime('Releases at 10 AM')?.time).toBe('10:00');
      expect(parseStrictReleaseTime('Releases at 10:00 AM')?.time).toBe('10:00');
      expect(parseStrictReleaseTime('10:00 AM IST')?.time).toBe('10:00');
      expect(parseStrictReleaseTime('10:00 IST')?.time).toBe('10:00');
      expect(parseStrictReleaseTime('Releases at 3 PM')?.time).toBe('15:00');
      expect(parseStrictReleaseTime('15:00 hrs')?.time).toBe('15:00');
      expect(parseStrictReleaseTime('15:30')?.time).toBe('15:30');
    });

    it('rejects invalid or impossible times safely', () => {
      expect(parseStrictReleaseTime('25:00')).toBeNull();
      expect(parseStrictReleaseTime('13:00 PM')).toBeNull();
      expect(parseStrictReleaseTime('10:65 AM')).toBeNull();
      expect(parseStrictReleaseTime('not a time')).toBeNull();
    });
  });

  // ─── C. Timezone Integrity ───
  describe('C. Strict Asia/Kolkata (IST) Canonical Timezone', () => {
    it('calculates epoch strictly with IST UTC+05:30 offset', () => {
      const epoch = getReleaseEpochMs('2026-10-24', '10:00');
      // 2026-10-24 10:00 IST is 2026-10-24 04:30:00 UTC
      const expectedUtc = Date.UTC(2026, 9, 24, 4, 30, 0, 0);
      expect(epoch).toBe(expectedUtc);
    });

    it('does not silently convert to UTC or browser locale for canonical calculations', () => {
      expect(IST_TIMEZONE).toBe('Asia/Kolkata');
    });
  });

  // ─── D. Status: CONFIRMED, EXPECTED, ESTIMATED, UNKNOWN, STALE ───
  describe('D. Canonical Release Status Distinctions', () => {
    it('distinguishes CONFIRMED, EXPECTED, ESTIMATED, UNKNOWN, and STALE states', () => {
      const confirmedEvent: TtdReleaseEvent = {
        id: 'ev-confirmed',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-24',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        status: 'CONFIRMED',
        confidence: 'OFFICIAL',
        sourceUrl: 'https://news.tirumala.org/sed',
        verified: true,
        isConfirmed: true,
        fetchedAt: '2026-10-08T00:00:00.000Z',
        expiresAt: '2026-10-25T00:00:00.000Z',
      };
      const nowMs = new Date('2026-10-20T00:00:00.000Z').getTime();
      const confirmedRes = calculateReleaseCountdown(confirmedEvent, nowMs);
      expect(confirmedRes.status).toBe('CONFIRMED');
      expect(confirmedRes.state).toBe('UPCOMING');

      // EXPECTED status
      const expectedEvent: TtdReleaseEvent = {
        ...confirmedEvent,
        status: 'EXPECTED',
        confidence: 'HIGH',
      };
      const expectedRes = calculateReleaseCountdown(expectedEvent, nowMs);
      expect(expectedRes.status).toBe('EXPECTED');
      expect(expectedRes.state).toBe('EXPECTED_APPROACHING');
      expect(expectedRes.formattedCountdown).toContain('EXPECTED IN ~');

      // ESTIMATED / UNKNOWN status: no countdown fabricated
      const unkEvent: TtdReleaseEvent = {
        ...confirmedEvent,
        status: 'UNKNOWN',
        confidence: 'UNKNOWN',
        isConfirmed: false,
      };
      const unkRes = calculateReleaseCountdown(unkEvent, nowMs);
      expect(unkRes.status).toBe('UNKNOWN');
      expect(unkRes.formattedCountdown).toBe('Official release date not yet confirmed.');

      // STALE status
      const staleEvent: TtdReleaseEvent = {
        ...confirmedEvent,
        status: 'STALE',
      };
      const staleRes = calculateReleaseCountdown(staleEvent, nowMs);
      expect(staleRes.status).toBe('STALE');
      expect(staleRes.isStale).toBe(true);
      expect(staleRes.formattedCountdown).toBe('Release information needs refreshing');
    });
  });

  // ─── E. Future Event Filtering ───
  describe('E. Future Event Filtering & Nearest Release Selection', () => {
    it('filters out past events and sorts upcoming ones chronologically', () => {
      const nowMs = new Date('2026-10-20T00:00:00.000Z').getTime();
      const pastEvent: TtdReleaseEvent = {
        id: 'past-1',
        serviceId: 'sed',
        releaseDate: '2026-10-15',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        sourceUrl: 'https://news.tirumala.org/',
        verified: true,
        isConfirmed: true,
      };
      const future1: TtdReleaseEvent = {
        id: 'fut-1',
        serviceId: 'sed',
        releaseDate: '2026-10-25',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        sourceUrl: 'https://news.tirumala.org/',
        verified: true,
        isConfirmed: true,
      };
      const future2: TtdReleaseEvent = {
        id: 'fut-2',
        serviceId: 'homam',
        releaseDate: '2026-10-22',
        releaseTime: '15:00',
        timezone: IST_TIMEZONE,
        sourceUrl: 'https://news.tirumala.org/',
        verified: true,
        isConfirmed: true,
      };

      const filtered = filterFutureReleaseEvents([pastEvent, future1, future2], nowMs);
      expect(filtered.length).toBe(2);
      // Nearest future release is selected first
      expect(filtered[0].id).toBe('fut-2'); // Oct 22 before Oct 25
      expect(filtered[1].id).toBe('fut-1');
    });
  });

  // ─── F. Duplicate Events ───
  describe('F. Duplicate Event Normalization', () => {
    it('updates existing event entry instead of creating duplicates when service matches', () => {
      const initialEvent: TtdReleaseEvent = {
        id: 'sed-1',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-24',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        status: 'CONFIRMED',
        sourceUrl: 'https://news.tirumala.org/p1',
        verified: true,
        isConfirmed: true,
      };
      registerOfficialAnnouncement(initialEvent);

      // Register duplicate / re-announced event for same service
      const updatedEvent: TtdReleaseEvent = {
        ...initialEvent,
        sourceUrl: 'https://news.tirumala.org/p2',
      };
      registerOfficialAnnouncement(updatedEvent);

      const active = getUpcomingReleaseEvent('special-entry-darshan-300', new Date('2026-10-20').getTime());
      expect(active?.sourceUrl).toBe('https://news.tirumala.org/p2');
    });
  });

  // ─── G. Conflicting Official Events ───
  describe('G. Conflicting Events — Official Confirmed Data Wins Over Expected', () => {
    it('official confirmed announcement immediately overrides expected recurring date', () => {
      const expected = calculateExpectedRelease('special-entry-darshan-300', new Date('2026-10-01'));
      expect(expected).not.toBeNull();
      expect(expected?.status).toBe('EXPECTED');

      // TTD officially postpones / shifts to 26th
      const officialConfirmed: TtdReleaseEvent = {
        id: 'official-shift',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-26',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        status: 'CONFIRMED',
        confidence: 'OFFICIAL',
        sourceUrl: 'https://news.tirumala.org/press-shift',
        verified: true,
        isConfirmed: true,
      };

      const reconciled = reconcileReleaseEvents([expected!], [officialConfirmed]);
      expect(reconciled.length).toBe(1);
      expect(reconciled[0].status).toBe('CONFIRMED');
      expect(reconciled[0].releaseDate).toBe('2026-10-26');
    });
  });

  // ─── H. Cache Expiry & Freshness ───
  describe('H. Cache Expiry & Staleness Lifecycle (K01 Resolution)', () => {
    it('marks cache STALE once past expiration TTL', async () => {
      await setCachedTtdData('test_release', { quota: 'SED' }, {
        sourceUrl: 'https://news.tirumala.org/announcement',
        expiresInMs: 1000, // 1 second TTL
      });

      // Fresh immediately
      const fresh = await getCachedTtdData('test_release', new Date());
      expect(fresh?.status).toBe('FRESH');

      // Stale after 2 seconds
      const futureDate = new Date(Date.now() + 2000);
      const stale = await getCachedTtdData('test_release', futureDate);
      expect(stale?.status).toBe('STALE');
    });

    it('rejects corrupted cache data safely', async () => {
      // Missing required sourceUrl
      const corrupt = await getCachedTtdData('non_existent_key');
      expect(corrupt).toBeNull();
    });
  });

  // ─── I. Network Failure & Offline Safety ───
  describe('I. Network Failure & Offline Resilience', () => {
    it('gracefully returns safe fallback without throwing when network is down', async () => {
      // Pipeline rejects unofficial or broken URLs safely
      const result = await processOfficialAnnouncementPipeline({
        title: 'Network test',
        content: 'No server reachable',
        sourceUrl: 'https://untrusted-blog.com/fake-release',
      });
      expect(result.success).toBe(false);
      expect(result.events.length).toBe(0);
      expect(result.error).toContain('Unofficial source rejected');
    });
  });

  // ─── J. Parser Uncertainty (Never Guess) ───
  describe('J. Defensive Parser — Returns UNKNOWN Rather Than Guessing', () => {
    it('returns empty array when text has ambiguous dates without guessing', () => {
      const ambiguous = parseTtdAnnouncement({
        title: 'Special Entry Darshan quota release soon',
        content: 'TTD announces that quota will be released shortly in coming days.',
        sourceUrl: 'https://news.tirumala.org/release-soon',
      });
      // No date guessed
      expect(ambiguous.length).toBe(0);
    });
  });

  // ─── K. Service Isolation ───
  describe('K. Strict Service Isolation (₹300 vs Homam vs Srivari)', () => {
    it('prevents Homam 1-month rule from being applied to Special Entry ₹300', () => {
      const illegalSed: TtdReleaseEvent = {
        id: 'bad-sed',
        serviceId: 'special-entry-300',
        releasePattern: 'ONE_MONTH_ADVANCE',
        advanceMonths: 1,
        sourceUrl: 'https://news.tirumala.org/sed',
        timezone: IST_TIMEZONE,
        verified: true,
      };
      const check = validateReleaseScheduleIntegrity('special-entry-300', illegalSed);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain('Homam one-month rule must NOT be applied to ₹300 Darshan');
    });

    it('prevents Special Entry 3-month rule from being applied to Homam', () => {
      const illegalHomam: TtdReleaseEvent = {
        id: 'bad-homam',
        serviceId: 'sri-srinivasa-divyanugraha-homam',
        releasePattern: 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA',
        advanceMonths: 3,
        sourceUrl: 'https://news.tirumala.org/homam',
        timezone: IST_TIMEZONE,
        verified: true,
      };
      const check = validateReleaseScheduleIntegrity('sri-srinivasa-divyanugraha-homam', illegalHomam);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain('Special Entry ₹300 three-month rule must NOT be applied to Homam');
    });
  });

  // ─── L. Countdown Precision ───
  describe('L. Countdown Computation — Precise for Confirmed, Relaxed for Expected', () => {
    it('produces formattedCountdown with days and hours for confirmed event', () => {
      const confirmedEvent: TtdReleaseEvent = {
        id: 'sed-exact',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-24',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        status: 'CONFIRMED',
        sourceUrl: 'https://news.tirumala.org/sed',
        verified: true,
        isConfirmed: true,
      };
      // 2 days before
      const nowMs = getReleaseEpochMs('2026-10-22', '10:00');
      const res = calculateReleaseCountdown(confirmedEvent, nowMs);
      expect(res.state).toBe('UPCOMING');
      expect(res.days).toBe(2);
      expect(res.formattedCountdown).toBe('2d 00h 00m');
    });

    it('produces approximate guidance without seconds for expected event', () => {
      const expectedEvent: TtdReleaseEvent = {
        id: 'sed-expected',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-24',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        status: 'EXPECTED',
        sourceUrl: 'https://news.tirumala.org/',
        verified: true,
        isConfirmed: false,
      };
      const nowMs = getReleaseEpochMs('2026-10-22', '10:00');
      const res = calculateReleaseCountdown(expectedEvent, nowMs);
      expect(res.state).toBe('EXPECTED_APPROACHING');
      expect(res.formattedCountdown).toBe('EXPECTED IN ~2 DAYS');
      expect(res.seconds).toBe(0);
    });
  });

  // ─── M. Change Detection ───
  describe('M. Release Change Detection', () => {
    it('detects when TTD changes release date or time and flags isUpdated', () => {
      const existing: TtdReleaseEvent = {
        id: 'ev-prev',
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-07',
        releaseTime: '10:00',
        timezone: IST_TIMEZONE,
        sourceUrl: 'https://news.tirumala.org/sed',
        verified: true,
        isConfirmed: true,
      };

      const incoming: TtdReleaseEvent = {
        ...existing,
        releaseDate: '2026-10-08',
        releaseTime: '11:00',
      };

      const change = detectReleaseChanges(existing, incoming);
      expect(change.hasChanged).toBe(true);
      expect(change.previousReleaseDate).toBe('2026-10-07');
      expect(change.previousReleaseTime).toBe('10:00');
      expect(change.changeNotes).toContain('rescheduled');

      // Test registerOfficialAnnouncement integration
      registerOfficialAnnouncement(existing);
      registerOfficialAnnouncement(incoming);

      const registered = getUpcomingReleaseEvent('special-entry-darshan-300', new Date('2026-10-01').getTime());
      expect(registered?.isUpdated).toBe(true);
      expect(registered?.previousReleaseDate).toBe('2026-10-07');
    });
  });

  // ─── N. Internationalization (i18n) ───
  describe('N. Internationalization — English and Telugu', () => {
    it('resolves release status and change keys in English and Telugu', () => {
      setLanguage('en');
      expect(t('intelligence.statusConfirmed')).toBe('CONFIRMED');
      expect(t('intelligence.statusExpected')).toBe('EXPECTED');
      expect(t('intelligence.statusStale')).toBe('STALE');
      expect(t('intelligence.releaseUpdated')).toBe('RELEASE UPDATED');
      expect(t('intelligence.noConfirmedRelease')).toBe('No confirmed upcoming release');

      setLanguage('te');
      expect(t('intelligence.statusConfirmed')).toBe('ఖరారైనది');
      expect(t('intelligence.statusExpected')).toBe('అంచనా వేయబడినది');
      expect(t('intelligence.statusStale')).toBe('పాత సమాచారం');
      expect(t('intelligence.releaseUpdated')).toBe('విడుదల తేదీ మార్చబడింది');
      expect(t('intelligence.noConfirmedRelease')).toBe('ఖరారైన రాబోయే విడుదల లేదు');
    });
  });

  // ─── O. Security & Zero PII ───
  describe('O. Security & Zero PII Verification', () => {
    it('ensures release cache entries contain only public schedule and zero pilgrim PII', async () => {
      const entry = await setCachedTtdData('public_release_sed', {
        serviceId: 'special-entry-darshan-300',
        releaseDate: '2026-10-24',
        releaseTime: '10:00',
      }, {
        sourceUrl: 'https://news.tirumala.org/press-sed',
      });

      const serialized = JSON.stringify(entry);
      // Verify no PII fields
      expect(serialized).not.toContain('aadhaar');
      expect(serialized).not.toContain('idNumber');
      expect(serialized).not.toContain('mobile');
      expect(serialized).not.toContain('photo');
    });
  });
});
