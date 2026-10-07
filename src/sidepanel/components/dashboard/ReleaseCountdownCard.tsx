import React, { useState, useEffect } from 'react';
import { t } from '@i18n/index';
import {
  getUpcomingReleaseEvent,
  calculateReleaseCountdown,
  type TtdReleaseEvent,
  type ReleaseCountdownResult,
} from '../../../services/ttd-information/ttd-release-calendar';

export interface ReleaseCountdownCardProps {
  serviceId?: string;
  onOpenTtd?: () => void;
  onPrepareBooking?: () => void;
}

/**
 * Formats a release pattern identifier into a human-readable label.
 */
export function formatReleasePattern(pattern?: string, advanceMonths?: number): string {
  if (pattern === 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA' || (advanceMonths === 3 && pattern?.includes('MONTH'))) {
    return '3 MONTHS IN ADVANCE';
  }
  if (pattern === 'ONE_MONTH_ADVANCE' || (advanceMonths === 1 && pattern?.includes('MONTH'))) {
    return '1 MONTH IN ADVANCE';
  }
  if (pattern === 'TWO_MONTHS_ADVANCE' || (advanceMonths === 2 && pattern?.includes('MONTH'))) {
    return '2 MONTHS IN ADVANCE';
  }
  if (pattern === 'MONTHLY_QUOTA_RELEASE') {
    return advanceMonths ? `${advanceMonths} MONTH${advanceMonths > 1 ? 'S' : ''} IN ADVANCE` : 'MONTHLY RELEASE';
  }
  if (pattern) {
    return pattern.replace(/_/g, ' ');
  }
  return '';
}

/**
 * Formats a release date (YYYY-MM-DD) and time (HH:mm) into "24 October · 10:00 AM IST".
 */
function formatReleaseDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '';
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const months = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateFormatted = !isNaN(day) && !isNaN(month) && months[month] ? `${day} ${months[month]}` : dateStr;

  if (!timeStr) return dateFormatted;
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = minStr || '00';
  if (isNaN(hour)) return `${dateFormatted} · ${timeStr} IST`;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${dateFormatted} · ${displayHour}:${min} ${ampm} IST`;
}

export function ReleaseCountdownCard({ serviceId, onOpenTtd, onPrepareBooking }: ReleaseCountdownCardProps) {
  const [event, setEvent] = useState<TtdReleaseEvent | undefined>(() => getUpcomingReleaseEvent(serviceId));
  const [countdownResult, setCountdownResult] = useState<ReleaseCountdownResult | null>(null);

  useEffect(() => {
    const activeEvent = getUpcomingReleaseEvent(serviceId);
    setEvent(activeEvent);
    if (activeEvent) {
      setCountdownResult(calculateReleaseCountdown(activeEvent));
    }
  }, [serviceId]);

  useEffect(() => {
    if (!event) return;

    // Update countdown every second
    const interval = setInterval(() => {
      setCountdownResult(calculateReleaseCountdown(event));
    }, 1000);

    return () => clearInterval(interval);
  }, [event]);

  if (!event || !countdownResult) {
    return null;
  }

  const isConfirmed = event.isConfirmed !== false && Boolean(event.releaseDate && event.releaseTime);
  const isUnconfirmed = !isConfirmed || countdownResult.state === 'NOT_CONFIRMED';
  const isUnverified = countdownResult.state === 'UNVERIFIED' || !event.verified || isUnconfirmed;
  const isReached = countdownResult.state === 'RELEASE_TIME_REACHED';
  const isPassed = countdownResult.state === 'PASSED';
  const isVerified = countdownResult.isVerified;
  const releasePatternLabel = formatReleasePattern(event.releasePattern, event.advanceMonths);

  // ─── UNVERIFIED / UNCONFIRMED STATE: No fabricated countdown ───
  if (isUnverified || isUnconfirmed) {
    return (
      <div
        className="p-4 rounded-2xl border bg-white dark:bg-[#1E1B24] border-[#E5DEEB] dark:border-[#382F45] shadow-xs"
        role="region"
        aria-label="NEXT TTD RELEASE"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-[#6F6477] dark:text-[#A89CB5] uppercase">
            NEXT RELEASE
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF8E1] text-[#B78103] dark:bg-[#3E2E04] dark:text-[#FFE082]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            Source needs verification
          </span>
        </div>

        <div className="mt-1">
          <h3 className="text-sm font-bold text-[#1E1427] dark:text-[#F3EFF8]">
            {event.displayName || 'Special Entry Darshan — ₹300'}
          </h3>
          {releasePatternLabel && (
            <p className="text-[10px] font-semibold tracking-wider text-[#8B7C99] dark:text-[#A89CB5] uppercase mt-0.5">
              Release pattern: {releasePatternLabel}
            </p>
          )}
        </div>

        <div className="mt-3 p-3 rounded-xl bg-[#FFF8E1] dark:bg-[#3E2E04]">
          <span className="block text-xs font-bold text-[#B78103] dark:text-[#FFE082]">
            Release date unavailable
          </span>
          <p className="text-xs text-[#8B6914] dark:text-[#E5C84E] mt-1 leading-relaxed">
            Check the latest official TTD announcement. Official release date not yet confirmed.
          </p>
          <p className="text-[11px] text-[#8B6914] dark:text-[#E5C84E] mt-0.5 opacity-80">
            {event.advanceMonths
              ? `Expected booking pattern: Approximately ${event.advanceMonths} month${event.advanceMonths > 1 ? 's' : ''} in advance.`
              : 'Expected release pattern per official TTD guidelines.'}
          </p>
        </div>

        {onOpenTtd && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onOpenTtd}
              className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
              aria-label="View TTD Updates"
            >
              View TTD Updates ↗
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── VERIFIED STATE: Full countdown + release intelligence ───
  return (
    <div
      className="p-4 rounded-2xl border bg-white dark:bg-[#1E1B24] border-[#E5DEEB] dark:border-[#382F45] shadow-xs"
      role="region"
      aria-label="NEXT TTD RELEASE"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold tracking-wider text-[#6F6477] dark:text-[#A89CB5] uppercase">
          NEXT RELEASE
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            isVerified
              ? 'bg-[#EBF7EE] text-[#1B5E20] dark:bg-[#13381B] dark:text-[#A5D6A7]'
              : 'bg-[#FFF8E1] text-[#B78103] dark:bg-[#3E2E04] dark:text-[#FFE082]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
          {isVerified ? 'Official source verified' : 'Source needs verification'}
        </span>
      </div>

      <div className="mt-1">
        <h3 className="text-sm font-bold text-[#1E1427] dark:text-[#F3EFF8]">
          {event.displayName || 'Special Entry Darshan — ₹300'}
        </h3>

        {releasePatternLabel && (
          <p className="text-[10px] font-semibold tracking-wider text-[#8B7C99] dark:text-[#A89CB5] uppercase mt-1">
            Release pattern: {releasePatternLabel}
          </p>
        )}

        <p className="text-xs text-[#6F6477] dark:text-[#A89CB5] mt-1">
          Target: {event.targetMonth}
        </p>
        <p className="text-xs text-[#6F6477] dark:text-[#A89CB5] mt-0.5 font-medium">
          {event.releaseDate
            ? formatReleaseDateTime(event.releaseDate, event.releaseTime)
            : 'Pending official announcement'}
        </p>
      </div>

      <div className="mt-3.5 p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#252030] flex items-center justify-between">
        <div>
          <span className="block text-[10px] uppercase font-semibold text-[#8B7C99] dark:text-[#A89CB5]">
            {isReached
              ? t('intelligence.releaseTimeReached')
              : isPassed
              ? t('intelligence.quotaReleased')
              : 'COUNTDOWN · IST'}
          </span>
          <span
            className="text-base font-extrabold tracking-tight text-[#54258A] dark:text-[#D4A72C]"
            aria-live="polite"
          >
            {countdownResult.formattedCountdown}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {onOpenTtd && (
          <button
            type="button"
            onClick={onOpenTtd}
            className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
            aria-label="Open Official Source"
          >
            Open TTD ↗
          </button>
        )}
        {onPrepareBooking && (
          <button
            type="button"
            onClick={onPrepareBooking}
            className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#54258A] text-[#54258A] hover:bg-[#F3EFF8] dark:border-[#D4A72C] dark:text-[#D4A72C] dark:hover:bg-[#2A2416]"
            aria-label={t('intelligence.prepareBooking')}
          >
            {t('intelligence.prepareBooking')}
          </button>
        )}
      </div>
    </div>
  );
}
