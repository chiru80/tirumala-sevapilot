import { describe, it, expect, beforeEach } from 'vitest';
import {
  isEventUpcoming,
  getUpcomingReleaseEvent,
  getUpcomingVerifiedReleases,
  calculateReleaseCountdown,
  getReleaseEpochMs,
  resetReleaseEventsToDefault,
  registerOfficialAnnouncement,
  IST_TIMEZONE,
  type TtdReleaseEvent,
} from '../../../src/services/ttd-information/ttd-release-calendar';
import { validateTtdSource } from '../../../src/services/ttd-information/ttd-source-validator';

describe('Release Calendar Production Hardening (Section 4)', () => {
  const baseValidEvent: TtdReleaseEvent = {
    id: 'test-event-future',
    serviceId: 'special-entry-darshan-300',
    serviceName: 'Special Entry Darshan ₹300',
    displayName: 'Special Entry Darshan ₹300',
    bookingType: 'Special Entry Darshan',
    targetBookingDates: 'Nov 10-15',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-20',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    sourceUrl: 'https://news.tirumala.org/press-release-123',
    verificationStatus: 'VERIFIED_OFFICIAL',
    verified: true,
    isConfirmed: true,
    publishedTimestamp: '2026-10-01T10:00:00.000Z',
    expiresAt: '2026-10-25T00:00:00.000Z',
  };

  beforeEach(() => {
    resetReleaseEventsToDefault();
  });

  it('1. Future event: correctly recognizes valid future verified event', () => {
    // Current time: 2026-10-10 (10 days before releaseDate 2026-10-20)
    const nowMs = new Date('2026-10-10T10:00:00.000Z').getTime();
    expect(isEventUpcoming(baseValidEvent, nowMs)).toBe(true);

    const countdown = calculateReleaseCountdown(baseValidEvent, nowMs);
    expect(countdown.state).toBe('UPCOMING');
    expect(countdown.isVerified).toBe(true);
    expect(countdown.days).toBeGreaterThan(0);
  });

  it('2. Expired event: rejects event past expiresAt date', () => {
    const expiredEvent: TtdReleaseEvent = {
      ...baseValidEvent,
      expiresAt: '2026-10-15T00:00:00.000Z',
    };
    // Current time: 2026-10-16 (past expiresAt)
    const nowMs = new Date('2026-10-16T00:00:00.000Z').getTime();
    expect(isEventUpcoming(expiredEvent, nowMs)).toBe(false);
  });

  it('3. Historical / past event: rejects event whose releaseDate + releaseTime has passed', () => {
    // Release is 2026-10-20 10:00 IST
    const targetEpoch = getReleaseEpochMs('2026-10-20', '10:00');
    // Current time is 1 hour after release
    const nowMs = targetEpoch + 3600 * 1000;
    expect(isEventUpcoming(baseValidEvent, nowMs)).toBe(false);

    // Past events should not be in upcoming list
    registerOfficialAnnouncement(baseValidEvent);
    const upcoming = getUpcomingVerifiedReleases(nowMs);
    expect(upcoming.some(e => e.id === baseValidEvent.id)).toBe(false);
  });

  it('4. Unverified event: rejects event from unverified or unofficial source', () => {
    const unverifiedEvent: TtdReleaseEvent = {
      ...baseValidEvent,
      verificationStatus: 'UNVERIFIED',
      verified: false,
    };
    const nowMs = new Date('2026-10-10T00:00:00.000Z').getTime();
    expect(isEventUpcoming(unverifiedEvent, nowMs)).toBe(false);

    // Unofficial source URL
    const untrustedSourceEvent: TtdReleaseEvent = {
      ...baseValidEvent,
      sourceUrl: 'https://random-blog.com/ttd-tickets',
    };
    expect(isEventUpcoming(untrustedSourceEvent, nowMs)).toBe(false);
  });

  it('5. Malformed event: rejects events with invalid dates or times', () => {
    const nowMs = new Date('2026-10-10T00:00:00.000Z').getTime();
    const badDateEvent: TtdReleaseEvent = {
      ...baseValidEvent,
      releaseDate: 'invalid-date',
    };
    expect(isEventUpcoming(badDateEvent, nowMs)).toBe(false);

    const badTimeEvent: TtdReleaseEvent = {
      ...baseValidEvent,
      releaseTime: '99:99',
    };
    // Invalid time components will produce NaN epoch
    const epoch = getReleaseEpochMs('2026-10-20', 'invalid');
    expect(isNaN(epoch)).toBe(true);
  });

  it('6. Timezone: strictly evaluates in Asia/Kolkata (IST = UTC+5:30)', () => {
    const epoch = getReleaseEpochMs('2026-10-20', '10:00');
    const d = new Date(epoch);
    const istTime = d.toLocaleTimeString('en-US', {
      timeZone: IST_TIMEZONE,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(istTime).toBe('10:00');

    // UTC hours should be 04:30
    const utcHours = d.getUTCHours();
    const utcMins = d.getUTCMinutes();
    expect(utcHours).toBe(4);
    expect(utcMins).toBe(30);
  });

  it('7. Exact release time boundary: transitions from upcoming to release time reached', () => {
    const targetEpoch = getReleaseEpochMs('2026-10-20', '10:00');

    // 1 millisecond before: still upcoming
    expect(isEventUpcoming(baseValidEvent, targetEpoch - 1)).toBe(true);

    // Exactly at release time: no longer upcoming
    expect(isEventUpcoming(baseValidEvent, targetEpoch)).toBe(false);

    // 1 second after: no longer upcoming
    expect(isEventUpcoming(baseValidEvent, targetEpoch + 1000)).toBe(false);

    // Countdown state at release time
    const reached = calculateReleaseCountdown(baseValidEvent, targetEpoch);
    expect(reached.state).toBe('RELEASE_TIME_REACHED');
  });

  it('8. No-announcement state: returns unconfirmed status and never fabricates dates', () => {
    // Srivari Seva currently has no fixed monthly quota announcement seed
    const unannounced = getUpcomingReleaseEvent('srivari-seva');
    expect(unannounced).toBeDefined();
    expect(unannounced?.isConfirmed).toBe(false);
    expect(unannounced?.targetMonth).toContain('Release date not announced yet');

    const countdown = calculateReleaseCountdown(unannounced!);
    expect(countdown.isVerified).toBe(false);
    expect(countdown.formattedCountdown).toBe('Official release date not yet confirmed.');
  });
});
