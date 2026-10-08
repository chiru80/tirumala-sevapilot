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

export const ReleaseCountdownCard = React.memo(function ReleaseCountdownCard({ serviceId, onOpenTtd, onPrepareBooking }: ReleaseCountdownCardProps) {
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

  const isConfirmed = event.status === 'CONFIRMED' || (event.isConfirmed !== false && Boolean(event.releaseDate && event.releaseTime));
  const isExpected = event.status === 'EXPECTED' || countdownResult.state === 'EXPECTED_APPROACHING';
  const isStale = countdownResult.state === 'STALE' || event.status === 'STALE';
  const isUnconfirmed = !isConfirmed && !isExpected && (countdownResult.state === 'NOT_CONFIRMED' || !event.isConfirmed);
  const isUnverified = countdownResult.state === 'UNVERIFIED' || !event.verified || isUnconfirmed;
  const isReached = countdownResult.state === 'RELEASE_TIME_REACHED';
  const isPassed = countdownResult.state === 'PASSED';
  const isVerified = countdownResult.isVerified;
  const releasePatternLabel = formatReleasePattern(event.releasePattern, event.advanceMonths);
  const isReleaseApproaching = isConfirmed && countdownResult.days === 0 && !isPassed;

  // ─── UNVERIFIED / UNCONFIRMED / STALE STATE: No fabricated countdown ───
  if (isUnverified || isUnconfirmed || isStale) {
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
              isStale
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                : 'bg-[#FFF8E1] text-[#B78103] dark:bg-[#3E2E04] dark:text-[#FFE082]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {isStale ? t('intelligence.statusStale') : 'Source needs verification'}
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
            {isStale ? t('intelligence.infoNeedsRefreshing') : 'Release date unavailable'}
          </span>
          <p className="text-xs text-[#8B6914] dark:text-[#E5C84E] mt-1 leading-relaxed">
            {isStale
              ? 'Release schedule information has aged past its verification window. Refresh for current TTD official announcements.'
              : 'Check the latest official TTD announcement. Official release date not yet confirmed.'}
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
              className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
              aria-label="View TTD Updates"
            >
              View TTD Updates ↗
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── EXPECTED STATE: Recurring pattern guidance without false second-by-second countdown ───
  if (isExpected) {
    return (
      <div
        className="p-4 rounded-2xl border bg-white dark:bg-[#1E1B24] border-[#E5DEEB] dark:border-[#382F45] shadow-xs"
        role="region"
        aria-label="EXPECTED TTD RELEASE"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-[#6F6477] dark:text-[#A89CB5] uppercase">
            EXPECTED RELEASE
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {t('intelligence.statusExpected')}
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
          <p className="text-xs text-[#6F6477] dark:text-[#A89CB5] mt-1">
            Expected Date: {event.releaseDate ? `${event.releaseDate} (${event.releaseTime || '10:00'} IST)` : 'Approximate recurring date'}
          </p>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
          <span className="block text-xs font-bold text-indigo-900 dark:text-indigo-200">
            {countdownResult.formattedCountdown}
          </span>
          <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-1">
            Derived from recurring monthly TTD schedule. Not yet confirmed by official announcement.
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          {onOpenTtd && (
            <button
              type="button"
              onClick={onOpenTtd}
              className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
              aria-label="View Official Announcements"
            >
              Check Official Announcement ↗
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── CONFIRMED VERIFIED STATE: Full countdown + release intelligence ───
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

      {/* Change detection alert banner if release was updated */}
      {event.isUpdated && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
          <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
            <span>⚠</span> {t('intelligence.releaseUpdated')}
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
            {event.previousReleaseDate && (
              <span>Previous: {event.previousReleaseDate} {event.previousReleaseTime || ''} → </span>
            )}
            <span>New: {event.releaseDate} {event.releaseTime || ''}</span>
          </div>
        </div>
      )}

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

      {/* Release Day Preparation Mode */}
      {isReleaseApproaching && (
        <div className="mt-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
          <span className="block text-[11px] font-bold text-[#54258A] dark:text-[#D4A72C] uppercase tracking-wider">
            {t('intelligence.releasePrepMode')}
          </span>
          <ul className="mt-1.5 space-y-1 text-[11px] text-[#4A3E54] dark:text-[#C5B8D1]">
            <li className="flex items-center gap-1.5">✓ {t('intelligence.prepTips.confirmProfile')}</li>
            <li className="flex items-center gap-1.5">✓ {t('intelligence.prepTips.confirmId')}</li>
            <li className="flex items-center gap-1.5">✓ {t('intelligence.prepTips.selectService')}</li>
            <li className="flex items-center gap-1.5">✓ {t('intelligence.prepTips.openPage')}</li>
            <li className="flex items-center gap-1.5">✓ {t('intelligence.prepTips.beReady')}</li>
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {onOpenTtd && (
          <button
            type="button"
            onClick={onOpenTtd}
            className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
            aria-label="Open Official Source"
          >
            Open TTD ↗
          </button>
        )}
        {onPrepareBooking && (
          <button
            type="button"
            onClick={onPrepareBooking}
            className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#54258A] text-[#54258A] hover:bg-[#F3EFF8] focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none dark:border-[#D4A72C] dark:text-[#D4A72C] dark:hover:bg-[#2A2416]"
            aria-label={t('intelligence.prepareBooking')}
          >
            {t('intelligence.prepareBooking')}
          </button>
        )}
      </div>
    </div>
  );
});
