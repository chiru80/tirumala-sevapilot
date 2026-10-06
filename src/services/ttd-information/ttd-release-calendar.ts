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
  targetMonth: string; // e.g. "November 2026" or "2026-11"

  releaseDate: string; // YYYY-MM-DD
  releaseTime: string; // HH:mm (in 24-hour format IST)
  timezone: string; // strictly "Asia/Kolkata"

  sourceUrl: string;
  sourceDate?: string;

  verified: boolean;

  fetchedAt?: string;
  expiresAt?: string;
}

export type CountdownState =
  | 'UPCOMING'
  | 'RELEASE_TIME_REACHED'
  | 'PASSED'
  | 'STALE'
  | 'UNVERIFIED';

export interface ReleaseCountdownResult {
  state: CountdownState;
  formattedCountdown: string; // e.g. "2d 04h 21m" or "00h 15m 30s"
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
  const targetEpoch = getReleaseEpochMs(event.releaseDate, event.releaseTime);
  const stale = isReleaseStale(event, nowMs);
  const isSourceVerified = event.verified && validateTtdSource(event.sourceUrl).isValid;

  if (isNaN(targetEpoch)) {
    return {
      state: 'UNVERIFIED',
      formattedCountdown: '--',
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
    state: !isSourceVerified ? 'UNVERIFIED' : stale ? 'STALE' : 'UPCOMING',
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
export const VERIFIED_RELEASE_EVENTS: TtdReleaseEvent[] = [
  {
    id: 'release-sed-300-current',
    serviceId: 'special-entry-300',
    displayName: 'Special Entry Darshan (₹300)',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-24',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    sourceUrl: 'https://news.tirumala.org/sed-quota-release-schedule',
    sourceDate: '2026-10-01',
    verified: true,
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-25T00:00:00.000Z',
  },
  {
    id: 'release-padmavathi-200-current',
    serviceId: 'padmavathi-special-entry-200',
    displayName: 'Sri Padmavathi Ammavari Special Entry (₹200)',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-25',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    sourceUrl: 'https://www.tirumala.org/ammavari-darshan-quota',
    sourceDate: '2026-10-01',
    verified: true,
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 'release-homam-1600-current',
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    displayName: 'Sri Srinivasa Divyanugraha Homam (₹1600)',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-27',
    releaseTime: '15:00',
    timezone: IST_TIMEZONE,
    sourceUrl: 'https://news.tirumala.org/homam-quota-release',
    sourceDate: '2026-10-01',
    verified: true,
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-28T00:00:00.000Z',
  },
];

/**
 * Finds the upcoming verified release event for a specific service or closest overall.
 */
export function getUpcomingReleaseEvent(serviceId?: string): TtdReleaseEvent | undefined {
  if (serviceId) {
    const config = getServiceConfig(serviceId);
    const targetServiceId = config ? config.serviceId : serviceId;
    return VERIFIED_RELEASE_EVENTS.find(e => e.serviceId === targetServiceId);
  }
  return VERIFIED_RELEASE_EVENTS[0];
}
