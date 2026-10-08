// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Canonical Release Intelligence Model (Phase 7)
// Single source of truth for normalized TTD quota release events.
// All dates and times are canonically represented in Asia/Kolkata (IST).
// ─────────────────────────────────────────────────────────────

export const IST_TIMEZONE = 'Asia/Kolkata' as const;

/**
 * Authoritative release status.
 * CONFIRMED: Directly announced by official TTD source.
 * EXPECTED:  Derived from recurring official historical pattern.
 * ESTIMATED: Weaker inference.
 * UNKNOWN:   Insufficient data.
 * STALE:     Information whose freshness window has expired.
 */
export type ReleaseStatus =
  | 'CONFIRMED'
  | 'EXPECTED'
  | 'ESTIMATED'
  | 'UNKNOWN'
  | 'STALE';

/**
 * Authoritative release confidence.
 * OFFICIAL: Explicitly verified against official TTD domain.
 * HIGH:     Strong recurring official pattern or secondary official signal.
 * MEDIUM:   Limited historical precedent.
 * LOW:      Preliminary or weak inference.
 * UNKNOWN:  No credible evidence.
 */
export type ReleaseConfidence =
  | 'OFFICIAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export type VerificationStatus =
  | 'VERIFIED_OFFICIAL'
  | 'UNVERIFIED'
  | 'EXPIRED'
  | 'PENDING';

export interface ReleaseEvent {
  id: string;
  serviceId: string;
  serviceName?: string;
  displayName?: string;
  bookingType?: string;
  targetBookingDates?: string;
  targetMonth?: string;

  /** Release date in YYYY-MM-DD (Asia/Kolkata). Undefined if not confirmed/expected. */
  releaseDate?: string;

  /** Release time in HH:mm 24-hr format (Asia/Kolkata). Undefined if not announced. */
  releaseTime?: string;

  timezone: string;

  status?: ReleaseStatus;
  confidence?: ReleaseConfidence;

  /** Descriptive source label, e.g. "Official TTD Press Release" */
  source?: string;

  /** Canonical HTTPS URL of official announcement */
  sourceUrl: string;

  /** Date of publication mentioned in source (YYYY-MM-DD) */
  sourceDate?: string;

  /** ISO timestamps for lifecycle management */
  publishedAt?: string;
  publishedTimestamp?: string;
  fetchedAt?: string;
  expiresAt?: string;

  /** Pattern metadata */
  releasePattern?: string;
  advanceMonths?: number;
  releaseType?: string;

  /** Verification flags */
  verified: boolean;
  verificationStatus?: VerificationStatus;
  isConfirmed?: boolean;

  /** Change detection metadata */
  isUpdated?: boolean;
  previousReleaseDate?: string;
  previousReleaseTime?: string;
  changeNotes?: string;
  notes?: string;
}

export type CountdownState =
  | 'UPCOMING'
  | 'RELEASE_TIME_REACHED'
  | 'PASSED'
  | 'STALE'
  | 'UNVERIFIED'
  | 'NOT_CONFIRMED'
  | 'EXPECTED_APPROACHING';

export interface ReleaseCountdownResult {
  state: CountdownState;
  formattedCountdown: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSecondsRemaining: number;
  isStale: boolean;
  isVerified: boolean;
  targetDateTimeIST: string;
  canOpenTtd: boolean;
  status?: ReleaseStatus;
  isUpdated?: boolean;
}
