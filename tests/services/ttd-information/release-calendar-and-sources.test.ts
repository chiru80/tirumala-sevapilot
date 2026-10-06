import { describe, it, expect } from 'vitest';
import { validateTtdSource } from '../../../src/services/ttd-information/ttd-source-validator';
import {
  calculateReleaseCountdown,
  getReleaseEpochMs,
  isReleaseStale,
  IST_TIMEZONE,
  type TtdReleaseEvent,
} from '../../../src/services/ttd-information/ttd-release-calendar';
import { parseTtdAnnouncement } from '../../../src/services/ttd-information/ttd-announcement-parser';
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
      targetMonth: 'November 2026',
      releaseDate: '2026-10-24',
      releaseTime: '10:00',
      timezone: IST_TIMEZONE,
      sourceUrl: 'https://news.tirumala.org/sed-quota',
      verified: true,
      expiresAt: '2026-10-25T00:00:00.000Z',
    };

    it('calculates exact IST epoch timestamp without timezone drift', () => {
      const epoch = getReleaseEpochMs('2026-10-24', '10:00');
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
      const targetEpoch = getReleaseEpochMs('2026-10-24', '10:00');
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
      const targetEpoch = getReleaseEpochMs('2026-10-24', '10:00');
      // Exactly at release time
      const countdown = calculateReleaseCountdown(sampleEvent, targetEpoch);
      expect(countdown.state).toBe('RELEASE_TIME_REACHED');
      expect(countdown.formattedCountdown).toBe('RELEASE TIME REACHED');
      expect(countdown.canOpenTtd).toBe(true);
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
      const countdown = calculateReleaseCountdown(unverifiedEvent, Date.now());
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
});
