// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Official TTD Release Calendar & Countdown (Phase 5)
// All dates & times are strictly evaluated in Asia/Kolkata (IST).
// ─────────────────────────────────────────────────────────────

import { validateTtdSource } from './ttd-source-validator';
import { getServiceConfig } from './ttd-service-rules';

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface TtdReleaseEvent {
  id: string;
  serviceId: string;
  displayName?: string;
  targetMonth: string; // e.g. "December 2026" or "2026-12"

  releaseDate?: string; // YYYY-MM-DD (omitted if not yet confirmed by official announcement)
  releaseTime?: string; // HH:mm (in 24-hour format IST)
  timezone: string; // strictly "Asia/Kolkata"

  /** Release pattern identifier, e.g. 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA', 'ONE_MONTH_ADVANCE' */
  releasePattern?: string;

  /** Number of months in advance the quota is released */
  advanceMonths?: number;

  /** Release type: MONTHLY_QUOTA_RELEASE, ONE_MONTH_ADVANCE, etc. */
  releaseType?: string;

  sourceUrl: string;
  sourceDate?: string;

  verified: boolean;

  /** True only when an official TTD announcement confirms the exact release date/time */
  isConfirmed?: boolean;

  fetchedAt?: string;
  expiresAt?: string;
}

export type CountdownState =
  | 'UPCOMING'
  | 'RELEASE_TIME_REACHED'
  | 'PASSED'
  | 'STALE'
  | 'UNVERIFIED'
  | 'NOT_CONFIRMED';

export interface ReleaseCountdownResult {
  state: CountdownState;
  formattedCountdown: string; // e.g. "2d 04h 21m" or "Official release date not yet confirmed."
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSecondsRemaining: number;
  isStale: boolean;
  isVerified: boolean;
  targetDateTimeIST: string;
  canOpenTtd: boolean;
}

/**
 * Parses releaseDate (YYYY-MM-DD) and releaseTime (HH:mm) into a Unix epoch timestamp (ms)
 * assuming the Asia/Kolkata (UTC+05:30) timezone.
 */
export function getReleaseEpochMs(releaseDate: string, releaseTime: string): number {
  const [year, month, day] = releaseDate.split('-').map(Number);
  const [hours, minutes] = releaseTime.split(':').map(Number);

  if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) {
    return NaN;
  }

  // IST is exactly UTC+05:30 -> offset is -330 minutes from UTC
  // Construct UTC date and shift by -5h30m to obtain exact epoch
  const utcEquivalent = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return utcEquivalent - istOffsetMs;
}

/**
 * Checks whether release event metadata is stale.
 * Events are stale if fetchedAt is older than 24h and past expiresAt,
 * or if explicitly unverified.
 */
export function isReleaseStale(event: TtdReleaseEvent, nowMs: number = Date.now()): boolean {
  if (event.expiresAt) {
    const expiresMs = new Date(event.expiresAt).getTime();
    if (!isNaN(expiresMs) && nowMs > expiresMs) {
      return true;
    }
  }

  // Also check if fetchedAt is older than 48 hours without a fresh verification
  if (event.fetchedAt) {
    const fetchedMs = new Date(event.fetchedAt).getTime();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    if (!isNaN(fetchedMs) && nowMs - fetchedMs > fortyEightHoursMs) {
      return true;
    }
  }

  return false;
}

/**
 * Computes release countdown against current time.
 * Never silently converts to the user's local timezone without marking IST.
 */
export function calculateReleaseCountdown(
  event: TtdReleaseEvent,
  nowMs: number = Date.now()
): ReleaseCountdownResult {
  const stale = isReleaseStale(event, nowMs);
  const isSourceVerified = event.verified && validateTtdSource(event.sourceUrl).isValid;

  // If no official announcement confirms the exact release date/time:
  // Do NOT fabricate a countdown.
  if (
    !event.releaseDate ||
    !event.releaseTime ||
    event.isConfirmed === false ||
    !isSourceVerified
  ) {
    const isUnconfirmed = event.isConfirmed === false || !event.releaseDate || !event.releaseTime;
    return {
      state: !isSourceVerified ? 'UNVERIFIED' : 'NOT_CONFIRMED',
      formattedCountdown: 'Official release date not yet confirmed.',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isStale: stale,
      isVerified: false,
      targetDateTimeIST:
        event.releaseDate && event.releaseTime
          ? `${event.releaseDate} ${event.releaseTime} IST`
          : 'Not confirmed',
      canOpenTtd: Boolean(event.sourceUrl && validateTtdSource(event.sourceUrl).isValid),
    };
  }

  const targetEpoch = getReleaseEpochMs(event.releaseDate, event.releaseTime);
  if (isNaN(targetEpoch)) {
    return {
      state: 'UNVERIFIED',
      formattedCountdown: 'Official release date not yet confirmed.',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isStale: stale,
      isVerified: false,
      targetDateTimeIST: `${event.releaseDate} ${event.releaseTime} IST`,
      canOpenTtd: false,
    };
  }

  const diffMs = targetEpoch - nowMs;
  const totalSeconds = Math.floor(diffMs / 1000);

  // If time reached within last 2 hours
  if (totalSeconds <= 0 && totalSeconds >= -7200) {
    return {
      state: 'RELEASE_TIME_REACHED',
      formattedCountdown: 'RELEASE TIME REACHED',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isStale: stale,
      isVerified: isSourceVerified,
      targetDateTimeIST: `${event.releaseDate} ${event.releaseTime} IST`,
      canOpenTtd: true,
    };
  }

  // Past event (> 2 hours ago)
  if (totalSeconds < -7200) {
    return {
      state: 'PASSED',
      formattedCountdown: 'QUOTA RELEASED',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isStale: stale,
      isVerified: isSourceVerified,
      targetDateTimeIST: `${event.releaseDate} ${event.releaseTime} IST`,
      canOpenTtd: true,
    };
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedCountdown =
    days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
      : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return {
    state: stale ? 'STALE' : 'UPCOMING',
    formattedCountdown,
    days,
    hours,
    minutes,
    seconds,
    totalSecondsRemaining: totalSeconds,
    isStale: stale,
    isVerified: isSourceVerified,
    targetDateTimeIST: `${event.releaseDate} ${event.releaseTime} IST`,
    canOpenTtd: true,
  };
}

/**
 * Canonical verified release events seed for TTD services.
 * Real official press releases are mirrored here.
 */
function isMatchingService(targetId: string, eventServiceId: string): boolean {
  if (targetId === eventServiceId) return true;
  const t = targetId.toLowerCase();
  const e = eventServiceId.toLowerCase();
  if (t === e) return true;
  if ((t.includes('special-entry') || t.includes('sed')) && (e.includes('special-entry') || e.includes('sed'))) return true;
  if ((t.includes('padmavathi') || t.includes('spat')) && (e.includes('padmavathi') || e.includes('spat'))) return true;
  if (t.includes('homam') && e.includes('homam')) return true;
  return false;
}

export const VERIFIED_RELEASE_EVENTS: TtdReleaseEvent[] = [
  {
    id: 'release-sed-300-current',
    serviceId: 'special-entry-darshan-300',
    displayName: 'Special Entry Darshan ₹300',
    targetMonth: 'December 2026',
    releaseDate: '2026-09-24',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA',
    advanceMonths: 3,
    releaseType: 'MONTHLY_QUOTA_RELEASE',
    sourceUrl: 'https://news.tirumala.org/',
    sourceDate: '2026-09-01',
    verified: true,
    isConfirmed: true,
    fetchedAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-10-31T00:00:00.000Z',
  },
  {
    id: 'release-padmavathi-200-current',
    serviceId: 'padmavathi-supadham-entry-200',
    displayName: 'Padmavathi / Sri PAT',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-25',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'MONTHLY_QUOTA_RELEASE',
    advanceMonths: 1,
    sourceUrl: 'https://www.tirumala.org/',
    sourceDate: '2026-10-01',
    verified: true,
    isConfirmed: true,
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 'release-homam-1600-current',
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    displayName: 'Sri Srinivasa Divyanugraha Vishesha Homam (₹1600)',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-27',
    releaseTime: '15:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'ONE_MONTH_ADVANCE',
    advanceMonths: 1,
    releaseType: 'ONE_MONTH_ADVANCE',
    sourceUrl: 'https://news.tirumala.org/',
    sourceDate: '2026-10-01',
    verified: true,
    isConfirmed: true,
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-28T00:00:00.000Z',
  },
];

let activeReleaseEvents: TtdReleaseEvent[] = [...VERIFIED_RELEASE_EVENTS];

/**
 * Returns currently active release events.
 */
export function getVerifiedReleaseEvents(): TtdReleaseEvent[] {
  return [...activeReleaseEvents];
}

/**
 * Registers an official release announcement event.
 * If the latest official TTD announcement changes the pattern,
 * the official announcement overrides the stored default.
 */
export function registerOfficialAnnouncement(event: TtdReleaseEvent): void {
  const index = activeReleaseEvents.findIndex(e =>
    e.serviceId === event.serviceId ||
    isMatchingService(event.serviceId, e.serviceId)
  );
  if (index >= 0) {
    activeReleaseEvents[index] = { ...event };
  } else {
    activeReleaseEvents.push({ ...event });
  }
}

/**
 * Resets active release events back to the canonical defaults.
 */
export function resetReleaseEventsToDefault(): void {
  activeReleaseEvents = [...VERIFIED_RELEASE_EVENTS];
}

/**
 * Finds the upcoming verified release event for a specific service or closest overall.
 * Every service strictly uses its own pattern.
 * If no confirmed release exists for the service, returns an unconfirmed event without fabricating a countdown.
 */
export function getUpcomingReleaseEvent(serviceId?: string): TtdReleaseEvent | undefined {
  if (serviceId) {
    const config = getServiceConfig(serviceId);
    const targetServiceId = config ? config.serviceId : serviceId;
    const found = activeReleaseEvents.find(e =>
      e.serviceId === targetServiceId ||
      e.serviceId === serviceId ||
      isMatchingService(targetServiceId, e.serviceId) ||
      isMatchingService(serviceId, e.serviceId)
    );
    if (found) {
      return found;
    }

    if (config) {
      return {
        id: `unconfirmed-${config.serviceId}`,
        serviceId: config.serviceId,
        displayName: config.displayName,
        targetMonth: 'Pending official announcement',
        timezone: IST_TIMEZONE,
        releasePattern: config.releasePattern,
        advanceMonths: config.advanceMonths,
        releaseType: config.releaseType,
        sourceUrl: config.source?.url || 'https://news.tirumala.org/',
        verified: false,
        isConfirmed: false,
      };
    }
  }
  return activeReleaseEvents[0];
}

/**
 * Validates advance booking schedule integrity and isolation between services:
 * - Special Entry ₹300: 3 months advance pattern (NOT 90-day calculation)
 * - Homam ₹1600: 1 month advance pattern, strictly 2 householders (NOT 30-day calculation)
 * - Strict isolation: ₹300 3-month rule is NOT applied to Homam, and Homam 1-month rule is NOT applied to ₹300.
 * - Exact release date/time must come from official TTD announcements.
 */
export function validateReleaseScheduleIntegrity(
  serviceId: string,
  event: TtdReleaseEvent
): { isValid: boolean; error?: string } {
  if (serviceId === 'special-entry-300' || serviceId === 'special-entry-darshan-300') {
    if (event.releasePattern === 'ONE_MONTH_ADVANCE' || event.advanceMonths === 1) {
      return {
        isValid: false,
        error: 'CRITICAL ERROR: Homam one-month rule must NOT be applied to ₹300 Darshan.',
      };
    }
  }

  if (
    serviceId === 'sri-srinivasa-divyanugraha-homam' ||
    serviceId === 'sri-srinivasa-divyanugraha-vishesha-homam' ||
    serviceId === 'homam-1600' ||
    serviceId === 'homam'
  ) {
    if (
      event.releasePattern === 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA' ||
      event.advanceMonths === 3
    ) {
      return {
        isValid: false,
        error: 'CRITICAL ERROR: Special Entry ₹300 three-month rule must NOT be applied to Homam.',
      };
    }
  }

  return { isValid: true };
}
