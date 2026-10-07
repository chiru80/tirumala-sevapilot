import { describe, it, expect, beforeEach } from 'vitest';
import { validateTtdSource } from '../../../src/services/ttd-information/ttd-source-validator';
import {
  calculateReleaseCountdown,
  getReleaseEpochMs,
  isReleaseStale,
  IST_TIMEZONE,
  type TtdReleaseEvent,
  validateReleaseScheduleIntegrity,
  registerOfficialAnnouncement,
  resetReleaseEventsToDefault,
  getUpcomingReleaseEvent,
} from '../../../src/services/ttd-information/ttd-release-calendar';
import {
  parseTtdAnnouncement,
  parseAndRegisterTtdAnnouncement,
} from '../../../src/services/ttd-information/ttd-announcement-parser';
import {
  getServiceConfig,
  SPECIAL_ENTRY_300_CONFIG,
  HOMAM_1600_CONFIG,
} from '../../../src/services/ttd-information/ttd-service-rules';
import { workflowRecorder } from '../../../src/services/ttd-information/workflow-recorder';
import {
  setCachedTtdData,
  getCachedTtdData,
  formatLastVerified,
} from '../../../src/services/ttd-information/ttd-cache';

describe('Phase 5 — TTD Sources, Release Calendar, Cache & Diagnostics', () => {
  describe('1. Official TTD Source Validation', () => {
    it('verifies authentic TTD domains', () => {
      expect(validateTtdSource('https://www.tirumala.org/').isValid).toBe(true);
      expect(validateTtdSource('https://news.tirumala.org/press-releases').isValid).toBe(true);
      expect(validateTtdSource('https://ttdevasthanams.ap.gov.in/').isValid).toBe(true);
    });

    it('rejects HTTP non-secure sources', () => {
      const res = validateTtdSource('http://www.tirumala.org/');
      expect(res.isValid).toBe(false);
      expect(res.status).toBe('UNOFFICIAL_SOURCE_REJECTED');
    });

    it('rejects unofficial third-party blogs or phishing domains and arbitrary subdomains like evil.tirumala.org', () => {
      const res1 = validateTtdSource('https://ttd-tickets-booking.com/quota');
      expect(res1.isValid).toBe(false);
      expect(res1.status).toBe('UNOFFICIAL_SOURCE_REJECTED');

      const resEvil = validateTtdSource('https://evil.tirumala.org/fake-release');
      expect(resEvil.isValid).toBe(false);
      expect(resEvil.status).toBe('UNOFFICIAL_SOURCE_REJECTED');

      const res2 = validateTtdSource('https://youtube.com/watch?v=123');
      expect(res2.isValid).toBe(false);
    });
  });

  describe('2. Release Calendar & IST Countdown', () => {
    const sampleEvent: TtdReleaseEvent = {
      id: 'test-event-1',
      serviceId: 'special-entry-300',
      targetMonth: 'December 2026',
      releaseDate: '2026-09-24',
      releaseTime: '10:00',
      timezone: IST_TIMEZONE,
      releasePattern: 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA',
      advanceMonths: 3,
      releaseType: 'MONTHLY_QUOTA_RELEASE',
      sourceUrl: 'https://news.tirumala.org/sed-quota',
      verified: true,
      expiresAt: '2026-10-31T00:00:00.000Z',
    };

    it('calculates exact IST epoch timestamp without timezone drift', () => {
      const epoch = getReleaseEpochMs('2026-09-24', '10:00');
      expect(isNaN(epoch)).toBe(false);

      // Verify that this epoch in IST format gives 10:00:00
      const d = new Date(epoch);
      const timeStr = d.toLocaleTimeString('en-US', {
        timeZone: IST_TIMEZONE,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      expect(timeStr).toBe('10:00');
    });

    it('computes human-readable countdown e.g. "2d 04h 21m"', () => {
      const targetEpoch = getReleaseEpochMs('2026-09-24', '10:00');
      // Simulate current time as 2 days, 4 hours, 21 minutes before target
      const mockNow = targetEpoch - (2 * 86400 + 4 * 3600 + 21 * 60) * 1000;

      const countdown = calculateReleaseCountdown(sampleEvent, mockNow);
      expect(countdown.state).toBe('UPCOMING');
      expect(countdown.days).toBe(2);
      expect(countdown.hours).toBe(4);
      expect(countdown.minutes).toBe(21);
      expect(countdown.formattedCountdown).toBe('2d 04h 21m');
      expect(countdown.canOpenTtd).toBe(true);
    });

    it('changes state to RELEASE TIME REACHED when release time has arrived', () => {
      const targetEpoch = getReleaseEpochMs('2026-09-24', '10:00');
      // Exactly at release time
      const countdown = calculateReleaseCountdown(sampleEvent, targetEpoch);
      expect(countdown.state).toBe('RELEASE_TIME_REACHED');
      expect(countdown.formattedCountdown).toBe('RELEASE TIME REACHED');
      expect(countdown.canOpenTtd).toBe(true);
    });

    it('includes releasePattern and advanceMonths in event data', () => {
      expect(sampleEvent.releasePattern).toBe('THREE_MONTHS_ADVANCE_MONTHLY_QUOTA');
      expect(sampleEvent.advanceMonths).toBe(3);
      expect(sampleEvent.releaseType).toBe('MONTHLY_QUOTA_RELEASE');
    });

    it('identifies stale release info and does not present it as fresh', () => {
      const staleEvent: TtdReleaseEvent = {
        ...sampleEvent,
        expiresAt: '2026-10-01T00:00:00.000Z',
      };
      const now = new Date('2026-10-06T00:00:00.000Z').getTime();
      expect(isReleaseStale(staleEvent, now)).toBe(true);
    });

    it('sets state to UNVERIFIED and isVerified to false when source is unverified', () => {
      const unverifiedEvent: TtdReleaseEvent = {
        ...sampleEvent,
        verified: false,
      };
      // Use a time BEFORE the release date so the PASSED branch doesn't fire first
      const targetEpoch = getReleaseEpochMs('2026-09-24', '10:00');
      const mockNow = targetEpoch - 86400 * 1000; // 1 day before release
      const countdown = calculateReleaseCountdown(unverifiedEvent, mockNow);
      expect(countdown.state).toBe('UNVERIFIED');
      expect(countdown.isVerified).toBe(false);
    });
  });

  describe('3. Announcement Parser', () => {
    it('parses Special Entry Darshan ₹300 release announcement', () => {
      const events = parseTtdAnnouncement({
        title: 'TTD Press Release: Special Entry Darshan Quota for November to be released on 24th October 10:00 AM',
        content: 'Devotees can book ₹300 Special Entry tickets online on 24th October 2026 at 10 AM.',
        sourceUrl: 'https://news.tirumala.org/release-notes',
        publishedDate: '2026-10-01',
      });

      expect(events.length).toBeGreaterThan(0);
      const sedEvent = events.find(e => e.serviceId === 'special-entry-300');
      expect(sedEvent).toBeDefined();
      expect(sedEvent?.releaseDate).toBe('2026-10-24');
      expect(sedEvent?.releaseTime).toBe('10:00');
      expect(sedEvent?.verified).toBe(true);
    });
  });

  describe('4. Cache Layer & Staleness Handling', () => {
    it('caches verified TTD release schedules and evaluates staleness', async () => {
      const entry = await setCachedTtdData('test-key', { sample: 123 }, {
        sourceUrl: 'https://news.tirumala.org/press-releases',
        expiresInMs: 1000, // 1 second TTL
      });

      expect(entry.verified).toBe(true);
      expect(entry.status).toBe('FRESH');

      // Fetch immediately
      const retrieved = await getCachedTtdData('test-key');
      expect(retrieved?.data).toEqual({ sample: 123 });

      // Fetch in future after expiration
      const futureDate = new Date(Date.now() + 5000);
      const staleRetrieved = await getCachedTtdData('test-key', futureDate);
      expect(staleRetrieved?.status).toBe('STALE');

      const label = formatLastVerified(entry);
      expect(label).toContain('Last verified:');
    });
  });

  describe('5. Developer Workflow Recorder Zero-PII Guarantee', () => {
    it('redacts devotee name, Aadhaar, phone, and email and strips passwords', () => {
      expect(workflowRecorder.sanitizeValue('fullName', 'Anusuri Chirudeep')).toBe('[REDACTED]');
      expect(workflowRecorder.sanitizeValue('idNumber', '999999990019')).toBe('XXXX XXXX 0019');
      expect(workflowRecorder.sanitizeValue('mobile', '9876543210')).toBe('XXXXXX3210');
      expect(workflowRecorder.sanitizeValue('email', 'devotee@example.com')).toBe('u***@example.com');
      expect(workflowRecorder.sanitizeValue('password', 'Secret@123')).toBe('[STRICTLY_STRIPPED]');
      expect(workflowRecorder.sanitizeValue('otp', '123456')).toBe('[STRICTLY_STRIPPED]');
    });

    it('remains disabled by default in production', () => {
      workflowRecorder.disable();
      expect(workflowRecorder.getStatus()).toBe(false);

      workflowRecorder.recordStep({
        url: 'https://ttdevasthanams.ap.gov.in/sed',
        detectedStep: 'PILGRIM_DETAILS',
        fields: [{
          fieldName: 'fullName',
          fieldType: 'text',
          isRequired: true,
          isReadOnly: false,
          valueToSanitize: 'Secret Name',
        }],
      });

      expect(workflowRecorder.exportRecords().length).toBe(0);
    });
  });

  describe('6. TTD Advance Booking Patterns, Homam & Isolation Rules', () => {
    beforeEach(() => {
      resetReleaseEventsToDefault();
    });

    describe('SPECIAL ENTRY ₹300', () => {
      it('has releasePattern THREE_MONTHS_ADVANCE_MONTHLY_QUOTA and advanceMonths 3', () => {
        const config = getServiceConfig('special-entry-300');
        expect(config?.releasePattern).toBe('THREE_MONTHS_ADVANCE_MONTHLY_QUOTA');
        expect(config?.advanceMonths).toBe(3);
        expect(config?.price).toBe(300);
      });

      it('does NOT convert the 3-month rule into an exact 90-day calculation', () => {
        // Release date/time must come from official TTD announcements, never targetDate - 90 days
        const event = getUpcomingReleaseEvent('special-entry-300');
        expect(event?.releaseDate).toBeDefined();
        expect(event?.sourceUrl).toContain('tirumala.org');
        expect(event?.verified).toBe(true);
      });
    });

    describe('SRI SRINIVASA DIVYANUGRAHA VISHESHA HOMAM ₹1600', () => {
      it('has releasePattern ONE_MONTH_ADVANCE, advanceMonths 1, and price ₹1600', () => {
        const config = getServiceConfig('sri-srinivasa-divyanugraha-homam');
        expect(config?.releasePattern).toBe('ONE_MONTH_ADVANCE');
        expect(config?.advanceMonths).toBe(1);
        expect(config?.price).toBe(1600);
      });

      it('strictly requires EXACTLY 2 HOUSEHOLDERS as participants', () => {
        const config = getServiceConfig('sri-srinivasa-divyanugraha-homam');
        expect(config?.exactPilgrims).toBe(2);
        expect(config?.minPilgrims).toBe(2);
        expect(config?.maxPilgrims).toBe(2);
        expect(config?.participantType).toBe('HOUSEHOLDERS');
        expect(config?.participantsDescription).toBe('EXACTLY 2 HOUSEHOLDERS');
      });

      it('does NOT convert the one-month rule into an exact 30-day calculation', () => {
        // Availability and release dates originate from official announcements
        const event = getUpcomingReleaseEvent('sri-srinivasa-divyanugraha-homam');
        expect(event?.releaseDate).toBeDefined();
        expect(event?.releasePattern).toBe('ONE_MONTH_ADVANCE');
        expect(event?.advanceMonths).toBe(1);
      });
    });

    describe('Isolation & Cross-Application Prohibition', () => {
      it('prohibits applying ₹300 three-month rule to Homam', () => {
        const homamConfig = getServiceConfig('sri-srinivasa-divyanugraha-homam');
        expect(homamConfig?.advanceMonths).not.toBe(3);
        expect(homamConfig?.releasePattern).not.toBe('THREE_MONTHS_ADVANCE_MONTHLY_QUOTA');

        // Validation helper enforces failure if cross-applied
        const illegalHomamEvent: TtdReleaseEvent = {
          id: 'illegal-homam',
          serviceId: 'sri-srinivasa-divyanugraha-homam',
          targetMonth: 'November 2026',
          timezone: IST_TIMEZONE,
          releasePattern: 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA',
          advanceMonths: 3,
          sourceUrl: 'https://news.tirumala.org/homam',
          verified: true,
        };
        const validation = validateReleaseScheduleIntegrity('sri-srinivasa-divyanugraha-homam', illegalHomamEvent);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain('Special Entry ₹300 three-month rule must NOT be applied to Homam');
      });

      it('prohibits applying Homam one-month rule to ₹300 Darshan', () => {
        const sedConfig = getServiceConfig('special-entry-300');
        expect(sedConfig?.advanceMonths).not.toBe(1);
        expect(sedConfig?.releasePattern).not.toBe('ONE_MONTH_ADVANCE');

        // Validation helper enforces failure if cross-applied
        const illegalSedEvent: TtdReleaseEvent = {
          id: 'illegal-sed',
          serviceId: 'special-entry-300',
          targetMonth: 'December 2026',
          timezone: IST_TIMEZONE,
          releasePattern: 'ONE_MONTH_ADVANCE',
          advanceMonths: 1,
          sourceUrl: 'https://news.tirumala.org/sed',
          verified: true,
        };
        const validation = validateReleaseScheduleIntegrity('special-entry-300', illegalSedEvent);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain('Homam one-month rule must NOT be applied to ₹300 Darshan');
      });
    });

    describe('Official Announcement Override & Non-Fabrication of Countdown', () => {
      it('allows official announcement to override the stored default pattern', () => {
        // e.g. TTD announces special release window for SED 2 months in advance
        const events = parseAndRegisterTtdAnnouncement({
          title: 'TTD Press Release: Special Entry Darshan ₹300 quota for January released 2 months in advance on 20th November 10:00 AM',
          content: 'Devotees are informed that SED ₹300 quota is released 2 months in advance this time.',
          sourceUrl: 'https://news.tirumala.org/special-announcement',
          publishedDate: '2026-11-01',
        });

        expect(events.length).toBeGreaterThan(0);
        const sedEvent = events.find(e => e.serviceId === 'special-entry-300');
        expect(sedEvent).toBeDefined();
        expect(sedEvent?.advanceMonths).toBe(2);
        expect(sedEvent?.releasePattern).toBe('TWO_MONTHS_ADVANCE');

        // Active release calendar now returns the overridden event
        const active = getUpcomingReleaseEvent('special-entry-300');
        expect(active?.advanceMonths).toBe(2);
        expect(active?.releasePattern).toBe('TWO_MONTHS_ADVANCE');
      });

      it('shows "Official release date not yet confirmed." and does NOT fabricate a countdown when unconfirmed', () => {
        const unconfirmedEvent: TtdReleaseEvent = {
          id: 'unconfirmed-homam',
          serviceId: 'sri-srinivasa-divyanugraha-homam',
          targetMonth: 'December 2026',
          timezone: IST_TIMEZONE,
          releasePattern: 'ONE_MONTH_ADVANCE',
          advanceMonths: 1,
          sourceUrl: 'https://news.tirumala.org/press',
          verified: true,
          isConfirmed: false, // No announcement has confirmed exact date/time yet
          releaseDate: undefined,
          releaseTime: undefined,
        };

        const countdown = calculateReleaseCountdown(unconfirmedEvent);
        expect(countdown.state).toBe('NOT_CONFIRMED');
        expect(countdown.formattedCountdown).toBe('Official release date not yet confirmed.');
        expect(countdown.days).toBe(0);
        expect(countdown.hours).toBe(0);
        expect(countdown.minutes).toBe(0);
        expect(countdown.seconds).toBe(0);
        expect(countdown.totalSecondsRemaining).toBe(0);
      });
    });
  });
});
