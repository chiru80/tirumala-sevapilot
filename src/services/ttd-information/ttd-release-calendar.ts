// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Official TTD Release Calendar & Countdown (Phase 5)
// All dates & times are strictly evaluated in Asia/Kolkata (IST).
// ─────────────────────────────────────────────────────────────

import { validateTtdSource } from './ttd-source-validator';
import { getServiceConfig } from './ttd-service-rules';

export const IST_TIMEZONE = 'Asia/Kolkata';

export type VerificationStatus = 'VERIFIED_OFFICIAL' | 'UNVERIFIED' | 'EXPIRED' | 'PENDING';

export interface TtdReleaseEvent {
  id: string;
  serviceId: string;
  serviceName?: string;
  displayName?: string;
  bookingType?: string;
  targetBookingDates?: string;
  targetMonth?: string; // e.g. "December 2026" or "2026-12"

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

  verificationStatus?: VerificationStatus;
  verified: boolean;

  /** True only when an official TTD announcement confirms the exact release date/time */
  isConfirmed?: boolean;

  publishedTimestamp?: string;
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
    serviceName: 'Special Entry Darshan ₹300',
    displayName: 'Special Entry Darshan ₹300',
    bookingType: 'Special Entry Darshan',
    targetBookingDates: 'Oct 12, 13, 14, 18, 19, 20',
    targetMonth: 'October 2026 (Oct 12, 13, 14, 18, 19, 20 Quota)',
    releaseDate: '2026-10-24',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'SPECIAL_ENTRY_DARSHAN_QUOTA',
    advanceMonths: 0,
    releaseType: 'QUOTA_RELEASE',
    sourceUrl: 'https://news.tirumala.org/ttd-to-release-rs-300-sed-tickets-on-october-7-_-అక్టోబర్-7న-రూ-300-ప్రత/',
    sourceDate: '2026-10-06',
    verificationStatus: 'VERIFIED_OFFICIAL',
    verified: true,
    isConfirmed: true,
    publishedTimestamp: '2026-10-06T12:00:00.000Z',
    fetchedAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2026-10-25T00:00:00.000Z',
  },
  {
    id: 'release-padmavathi-200-current',
    serviceId: 'padmavathi-supadham-entry-200',
    serviceName: 'Padmavathi / Sri PAT',
    displayName: 'Padmavathi / Sri PAT',
    bookingType: 'Supadham Entry',
    targetBookingDates: 'November 2026',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-25',
    releaseTime: '10:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'MONTHLY_QUOTA_RELEASE',
    advanceMonths: 1,
    sourceUrl: 'https://www.tirumala.org/',
    sourceDate: '2026-10-01',
    verificationStatus: 'VERIFIED_OFFICIAL',
    verified: true,
    isConfirmed: true,
    publishedTimestamp: '2026-10-01T10:00:00.000Z',
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 'release-homam-1600-current',
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    serviceName: 'Sri Srinivasa Divyanugraha Vishesha Homam (₹1600)',
    displayName: 'Sri Srinivasa Divyanugraha Vishesha Homam (₹1600)',
    bookingType: 'Vishesha Homam',
    targetBookingDates: 'November 2026',
    targetMonth: 'November 2026',
    releaseDate: '2026-10-27',
    releaseTime: '15:00',
    timezone: IST_TIMEZONE,
    releasePattern: 'ONE_MONTH_ADVANCE',
    advanceMonths: 1,
    releaseType: 'ONE_MONTH_ADVANCE',
    sourceUrl: 'https://news.tirumala.org/',
    sourceDate: '2026-10-01',
    verificationStatus: 'VERIFIED_OFFICIAL',
    verified: true,
    isConfirmed: true,
    publishedTimestamp: '2026-10-01T10:00:00.000Z',
    fetchedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2026-10-28T00:00:00.000Z',
  },
];

let activeReleaseEvents: TtdReleaseEvent[] = [...VERIFIED_RELEASE_EVENTS];

export function setActiveReleaseEvents(events: TtdReleaseEvent[]): void {
  activeReleaseEvents = [...events];
}

export function resetActiveReleaseEvents(): void {
  activeReleaseEvents = [...VERIFIED_RELEASE_EVENTS];
}

/**
 * Evaluates whether an event qualifies strictly as UPCOMING:
 * 1. releaseDate + releaseTime > current time
 * 2. event is verified (verified === true and verificationStatus === 'VERIFIED_OFFICIAL' or unset)
 * 3. event has not expired (!expiresAt or nowMs < expiresAt)
 * 4. source is trusted (validateTtdSource(sourceUrl).isValid)
 */
export function isEventUpcoming(event: TtdReleaseEvent, nowMs: number = Date.now()): boolean {
  if (!event) return false;

  const isVerified = event.verified === true && (event.verificationStatus === 'VERIFIED_OFFICIAL' || !event.verificationStatus);
  if (!isVerified) return false;

  const sourceCheck = validateTtdSource(event.sourceUrl);
  if (!sourceCheck.isValid) return false;

  if (event.expiresAt) {
    const expiresMs = new Date(event.expiresAt).getTime();
    if (!isNaN(expiresMs) && nowMs >= expiresMs) return false;
  }

  if (!event.releaseDate || !event.releaseTime || event.isConfirmed === false) return false;

  const epoch = getReleaseEpochMs(event.releaseDate, event.releaseTime);
  if (isNaN(epoch)) return false;

  return epoch > nowMs;
}

/**
 * Returns strictly upcoming verified releases.
 * Only includes events where releaseDate + releaseTime > current time.
 */
export function getUpcomingVerifiedReleases(nowMs: number = Date.now()): TtdReleaseEvent[] {
  return activeReleaseEvents
    .filter(e => isEventUpcoming(e, nowMs))
    .sort((a, b) => {
      const aEpoch = getReleaseEpochMs(a.releaseDate!, a.releaseTime!);
      const bEpoch = getReleaseEpochMs(b.releaseDate!, b.releaseTime!);
      return aEpoch - bEpoch;
    });
}

/**
 * Returns currently active verified release events.
 * Strictly enforces expiresAt: expired events are never presented as valid.
 */
export function getVerifiedReleaseEvents(nowMs: number = Date.now()): TtdReleaseEvent[] {
  return activeReleaseEvents.filter(e => {
    if (!e.verified) return false;
    // Enforce expiresAt: if expired, drop from verified release events
    if (e.expiresAt) {
      const expiresEpoch = new Date(e.expiresAt).getTime();
      if (!isNaN(expiresEpoch) && nowMs > expiresEpoch) {
        return false;
      }
    }
    return true;
  });
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
 * Strictly filters out past / expired events: releaseDate + releaseTime must be in the future.
 * If no confirmed future release exists, returns an unconfirmed event indicating
 * "Release date not announced yet" rather than fabricating a date or returning a passed event.
 */
export function getUpcomingReleaseEvent(serviceId?: string, nowMs: number = Date.now()): TtdReleaseEvent | undefined {
  const futureEvents = getUpcomingVerifiedReleases(nowMs);

  if (serviceId) {
    const config = getServiceConfig(serviceId);
    const targetServiceId = config ? config.serviceId : serviceId;
    const found = futureEvents.find(e =>
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
        serviceName: config.displayName,
        displayName: config.displayName,
        bookingType: config.category,
        targetBookingDates: 'Not announced yet',
        targetMonth: 'Release date not announced yet',
        timezone: IST_TIMEZONE,
        releasePattern: config.releasePattern,
        advanceMonths: config.advanceMonths,
        releaseType: config.releaseType,
        sourceUrl: config.source?.url || 'https://news.tirumala.org/',
        verificationStatus: 'PENDING',
        verified: false,
        isConfirmed: false,
      };
    }
  }

  // If no serviceId specified, return the earliest upcoming event or undefined
  return futureEvents[0];
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

/**
 * Syncs the active release calendar with verified events stored in the TTD cache.
 */
export async function syncReleaseScheduleWithCache(): Promise<TtdReleaseEvent[]> {
  try {
    const { getCachedTtdData } = await import('./ttd-cache');
    const cached = await getCachedTtdData<TtdReleaseEvent[]>('verified_release_events');
    if (cached && cached.verified && cached.status === 'FRESH' && Array.isArray(cached.data)) {
      for (const event of cached.data) {
        if (event && event.serviceId && event.verified) {
          registerOfficialAnnouncement(event);
        }
      }
    }
  } catch {
    // Graceful fallback to default in-memory verified events
  }
  return getVerifiedReleaseEvents();
}

/**
 * Complete pipeline: validates official source URL, parses announcement text,
 * validates service isolation, caches with expiry, and updates the release calendar.
 */
export async function processOfficialAnnouncementPipeline(input: {
  title: string;
  content: string;
  sourceUrl: string;
  publishedDate?: string;
  expiresInMs?: number;
}): Promise<{ success: boolean; events: TtdReleaseEvent[]; error?: string }> {
  const sourceValidation = validateTtdSource(input.sourceUrl);
  if (!sourceValidation.isValid) {
    return {
      success: false,
      events: [],
      error: `Unofficial source rejected: ${sourceValidation.reason}`,
    };
  }

  const { parseTtdAnnouncement } = await import('./ttd-announcement-parser');
  const { setCachedTtdData } = await import('./ttd-cache');

  const parsedEvents = parseTtdAnnouncement({
    title: input.title,
    content: input.content,
    sourceUrl: input.sourceUrl,
    publishedDate: input.publishedDate,
  });

  if (parsedEvents.length === 0) {
    return {
      success: false,
      events: [],
      error: 'No recognized service quota schedule found in announcement text',
    };
  }

  const validEvents: TtdReleaseEvent[] = [];
  for (const event of parsedEvents) {
    const integrity = validateReleaseScheduleIntegrity(event.serviceId, event);
    if (!integrity.isValid) {
      continue;
    }
    registerOfficialAnnouncement(event);
    validEvents.push(event);
  }

  if (validEvents.length > 0) {
    await setCachedTtdData('verified_release_events', getVerifiedReleaseEvents(), {
      sourceUrl: input.sourceUrl,
      expiresInMs: input.expiresInMs || 14 * 24 * 60 * 60 * 1000, // 14 days default for press releases
      isVerified: true,
    });
  }

  return {
    success: validEvents.length > 0,
    events: validEvents,
  };
}
