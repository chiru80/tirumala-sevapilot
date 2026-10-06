import React from 'react';
import type { TtdPageStatus, CountdownState } from '../../hooks/useTtdPage';
import { t } from '@i18n/index';

interface TtdStatusCardProps {
  status: TtdPageStatus;
  serviceName: string;
  currentTime?: string;
  countdown?: CountdownState;
  onOpenTtd: () => void;
}

export const TtdStatusCard: React.FC<TtdStatusCardProps> = ({
  status,
  serviceName,
  currentTime,
  countdown,
  onOpenTtd,
}) => {
  if (status === 'LOADING') {
    return (
      <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-semibold text-[#6F6477] dark:text-[#D4C3E0]">
            {t('dashboard.checkingConnection')}
          </span>
        </div>
      </div>
    );
  }

  if (status === 'TTD_DETECTED') {
    return (
      <div className="rounded-2xl border border-[#2F8F68]/30 bg-[#F2FBF6] dark:bg-[#1B3E2B]/30 p-4 shadow-xs transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#2F8F68]/15 flex items-center justify-center shrink-0">
              <span className="w-3 h-3 rounded-full bg-[#2F8F68] animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F68] dark:text-[#4ADE80] block">
                🟢 {t('dashboard.ttdBookingPage')}
              </span>
              <p className="text-base font-bold text-[#30213A] dark:text-[#F8EFD8] truncate mt-0.5">
                {serviceName || 'Special Entry Darshan'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenTtd}
            className="min-h-[44px] text-xs font-bold px-3 py-1.5 rounded-xl bg-[#2F8F68]/10 text-[#1B5E20] dark:text-[#4ADE80] hover:bg-[#2F8F68]/20 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center"
            aria-label={t('dashboard.activeTab')}
          >
            {t('dashboard.activeTab')}
          </button>
        </div>

        {/* IST clock & countdown */}
        <div className="mt-3 pt-2.5 border-t border-[rgba(47,143,104,0.15)] flex items-center justify-between text-xs">
          <span className="text-[#6F6477] dark:text-[#D4C3E0] font-medium">
            {currentTime ? `IST ${currentTime}` : 'IST Live'}
          </span>
          {countdown?.isOpen ? (
            <span className="font-bold text-[#2F8F68] animate-pulse">
              {t('dashboard.bookingWindowOpen')}
            </span>
          ) : countdown ? (
            <span className="font-mono font-medium text-[#30213A] dark:text-[#F8EFD8]">
              {t('dashboard.nextWindow')}: {countdown.hours}:{countdown.minutes}:{countdown.seconds}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === 'UNSUPPORTED') {
    return (
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-700/40 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-lg">🟡</span>
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
              {t('dashboard.ttdPageDetected')}
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              {t('dashboard.unsupportedMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // NOT_TTD
  return (
    <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800/60 flex items-center justify-center shrink-0">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
              ⚪ {t('dashboard.ttdNotDetected')}
            </span>
            <p className="text-xs text-[#6F6477] dark:text-[#D4C3E0] mt-0.5">
              {t('dashboard.openSupportedPage')}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenTtd}
          className="min-h-[44px] text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white hover:shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center"
        >
          {t('dashboard.openTTD')}
        </button>
      </div>
    </div>
  );
};
