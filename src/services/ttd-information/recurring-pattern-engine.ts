// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Recurring Pattern Engine (Phase 7)
// Calculates EXPECTED release events based on established recurring
// official TTD schedule patterns.
// Strictly enforces: Expected != Confirmed.
// Any conflicting official announcement overrides expected data immediately.
// ─────────────────────────────────────────────────────────────

import {
  type ReleaseEvent,
  IST_TIMEZONE,
} from './release-types';
import { getServiceConfig } from './ttd-service-rules';

export interface RecurringPatternRule {
  serviceId: string;
  displayName: string;
  typicalReleaseDay: number; // Day of month (e.g. 24)
  typicalReleaseTime: string; // HH:mm in IST (e.g. "10:00")
  advanceMonths: number; // 0 = current month quota, 1 = next month quota
  releasePattern: string;
  sourceDescription: string;
}

export const RECURRING_PATTERNS: RecurringPatternRule[] = [
  {
    serviceId: 'special-entry-darshan-300',
    displayName: 'Special Entry Darshan ₹300',
    typicalReleaseDay: 24,
    typicalReleaseTime: '10:00',
    advanceMonths: 0,
    releasePattern: 'MONTHLY_QUOTA_RELEASE',
    sourceDescription: 'Recurring monthly TTD ₹300 quota release schedule',
  },
  {
    serviceId: 'padmavathi-supadham-entry-200',
    displayName: 'Padmavathi / Sri PAT',
    typicalReleaseDay: 25,
    typicalReleaseTime: '10:00',
    advanceMonths: 1,
    releasePattern: 'MONTHLY_QUOTA_RELEASE',
    sourceDescription: 'Recurring monthly Padmavathi Supadham quota schedule',
  },
  {
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    displayName: 'Sri Srinivasa Divyanugraha Homam (₹1600)',
    typicalReleaseDay: 27,
    typicalReleaseTime: '15:00',
    advanceMonths: 1,
    releasePattern: 'ONE_MONTH_ADVANCE',
    sourceDescription: 'Recurring monthly Divyanugraha Homam quota schedule',
  },
];

/**
 * Calculates an EXPECTED release event for a service and reference month.
 * Returns null if service does not have an established recurring pattern.
 */
export function calculateExpectedRelease(
  serviceId: string,
  referenceDate: Date | number = new Date()
): ReleaseEvent | null {
  const normId = serviceId.toLowerCase();
  const rule = RECURRING_PATTERNS.find(r =>
    r.serviceId === normId ||
    (normId.includes('special-entry') && r.serviceId.includes('special-entry')) ||
    (normId.includes('sed') && r.serviceId.includes('special-entry')) ||
    (normId.includes('padmavathi') && r.serviceId.includes('padmavathi')) ||
    (normId.includes('homam') && r.serviceId.includes('homam'))
  );

  if (!rule) return null;

  const refDate = typeof referenceDate === 'number' ? new Date(referenceDate) : referenceDate;
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1; // 1-12

  const pad = (n: number) => String(n).padStart(2, '0');
  const releaseDateStr = `${year}-${pad(month)}-${pad(rule.typicalReleaseDay)}`;

  const config = getServiceConfig(rule.serviceId);
  const targetMonthDate = new Date(year, month - 1 + rule.advanceMonths, 1);
  const targetMonthName = targetMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return {
    id: `expected-${rule.serviceId}-${releaseDateStr}`,
    serviceId: rule.serviceId,
    serviceName: rule.displayName,
    displayName: rule.displayName,
    bookingType: config?.category || 'Quota Release',
    targetBookingDates: targetMonthName,
    targetMonth: targetMonthName,
    releaseDate: releaseDateStr,
    releaseTime: rule.typicalReleaseTime,
    timezone: IST_TIMEZONE,
    status: 'EXPECTED',
    confidence: 'HIGH',
    source: rule.sourceDescription,
    sourceUrl: 'https://news.tirumala.org/',
    fetchedAt: refDate.toISOString(),
    expiresAt: new Date(refDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    releasePattern: rule.releasePattern,
    advanceMonths: rule.advanceMonths,
    releaseType: config?.releaseType || 'MONTHLY_QUOTA_RELEASE',
    verified: false,
    isConfirmed: false,
    notes: 'Estimated from recurring monthly historical pattern. Official press release will override upon announcement.',
  };
}

/**
 * Reconciles expected release(s) against confirmed official announcement(s).
 * RULE: Official confirmed event ALWAYS wins immediately over expected event.
 */
export function reconcileReleaseEvents(
  expectedEvent: ReleaseEvent,
  officialEvent: ReleaseEvent | null | undefined
): ReleaseEvent;
export function reconcileReleaseEvents(
  expectedEvents: ReleaseEvent[],
  officialEvents: ReleaseEvent[]
): ReleaseEvent[];
export function reconcileReleaseEvents(
  expected: ReleaseEvent | ReleaseEvent[],
  official: ReleaseEvent | ReleaseEvent[] | null | undefined
): ReleaseEvent | ReleaseEvent[] {
  if (Array.isArray(expected)) {
    const officialList = Array.isArray(official) ? official : official ? [official] : [];
    return expected.map(exp => {
      const match = officialList.find(off =>
        off.serviceId === exp.serviceId ||
        (off.serviceId.includes('special-entry') && exp.serviceId.includes('special-entry')) ||
        (off.serviceId.includes('padmavathi') && exp.serviceId.includes('padmavathi')) ||
        (off.serviceId.includes('homam') && exp.serviceId.includes('homam'))
      );
      if (match && (match.status === 'CONFIRMED' || match.isConfirmed)) {
        return {
          ...match,
          status: 'CONFIRMED' as const,
          confidence: 'OFFICIAL' as const,
        };
      }
      return exp;
    });
  }

  if (!official || Array.isArray(official)) {
    return expected;
  }

  if (official.status === 'CONFIRMED' || official.isConfirmed) {
    return {
      ...official,
      status: 'CONFIRMED' as const,
      confidence: 'OFFICIAL' as const,
    };
  }

  return expected;
}
