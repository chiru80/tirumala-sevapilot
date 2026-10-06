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
}

export function ReleaseCountdownCard({ serviceId, onOpenTtd }: ReleaseCountdownCardProps) {
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

  const isReached = countdownResult.state === 'RELEASE_TIME_REACHED';
  const isPassed = countdownResult.state === 'PASSED';
  const isVerified = countdownResult.isVerified;

  return (
    <div
      className="p-4 rounded-2xl border bg-white dark:bg-[#1E1B24] border-[#E5DEEB] dark:border-[#382F45] shadow-xs"
      role="region"
      aria-label={t('intelligence.nextRelease')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold tracking-wider text-[#6F6477] dark:text-[#A89CB5] uppercase">
          {t('intelligence.nextRelease')}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            isVerified
              ? 'bg-[#EBF7EE] text-[#1B5E20] dark:bg-[#13381B] dark:text-[#A5D6A7]'
              : 'bg-[#FFF8E1] text-[#B78103] dark:bg-[#3E2E04] dark:text-[#FFE082]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
          {isVerified ? t('intelligence.officialSourceVerified') : t('intelligence.sourceNeedsVerification')}
        </span>
      </div>

      <div className="mt-1">
        <h3 className="text-sm font-bold text-[#1E1427] dark:text-[#F3EFF8]">
          {event.displayName || 'Special Entry Darshan (₹300)'}
        </h3>
        <p className="text-xs text-[#6F6477] dark:text-[#A89CB5] mt-0.5">
          {event.targetMonth} • {event.releaseDate} at {event.releaseTime} IST
        </p>
      </div>

      <div className="mt-3.5 p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#252030] flex items-center justify-between">
        <div>
          <span className="block text-[10px] uppercase font-semibold text-[#8B7C99] dark:text-[#A89CB5]">
            {isReached
              ? t('intelligence.releaseTimeReached')
              : isPassed
              ? t('intelligence.quotaReleased')
              : 'COUNTDOWN (IST)'}
          </span>
          <span
            className="text-base font-extrabold tracking-tight text-[#54258A] dark:text-[#D4A72C]"
            aria-live="polite"
          >
            {countdownResult.formattedCountdown}
          </span>
        </div>

        {onOpenTtd && (
          <button
            type="button"
            onClick={onOpenTtd}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer bg-[#54258A] text-white hover:bg-[#6830AA] dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]"
            aria-label={t('intelligence.openTtd')}
          >
            {t('intelligence.openTtd')} ↗
          </button>
        )}
      </div>
    </div>
  );
}
