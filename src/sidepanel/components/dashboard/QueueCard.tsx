// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Queue Card (Phase 10)
// Safe Passive Waiting UI for TTD Digital Waiting Rooms
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { t } from '@i18n/index';
import type { QueueSession } from '@services/queue/types';

export interface QueueCardProps {
  session: QueueSession | null;
  onStopMonitoring?: () => void;
  onRefreshManually?: () => void;
}

export const QueueCard = React.memo(function QueueCard({ session, onStopMonitoring, onRefreshManually }: QueueCardProps) {
  if (!session) return null;

  const isCaptcha = session.state === 'QUEUE_CAPTCHA_REQUIRED';
  const isExpired = session.state === 'QUEUE_SESSION_EXPIRED';
  const isError = session.state === 'QUEUE_ERROR';
  const isCompleted = session.state === 'QUEUE_COMPLETED';
  const position = session.progress?.position;
  const waitTime = session.progress?.officialWaitTime;

  return (
    <div
      role="region"
      aria-label="TTD Digital Queue Status"
      aria-live="polite"
      className="p-4 rounded-2xl border-2 border-gold-500/40 bg-gradient-to-br from-gold-50/90 via-white to-amber-50/50 dark:from-[#341B42] dark:via-[#2A1637] dark:to-[#3E224E] shadow-md space-y-3 animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gold-500/20">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">⏳</span>
          <div>
            <h3 className="text-xs font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8] tracking-wide">
              {t('queue.title')}
            </h3>
            <p className="text-[10px] text-amber-700 dark:text-gold-300 font-medium">
              {t('queue.safeModeActive')}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300/40 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {session.state.replace('QUEUE_', '')}
        </span>
      </div>

      {/* Main Status Information */}
      <div className="space-y-1.5 text-xs text-[#4A3B52] dark:text-[#E2D5EC]">
        {isCompleted ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-semibold text-xs flex items-center gap-2">
            <span>✓</span>
            <span>{t('queue.completed')} {t('queue.transitioning')}</span>
          </div>
        ) : isCaptcha ? (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-800 dark:text-rose-200 font-semibold text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{t('queue.completeCaptcha')}</span>
          </div>
        ) : isExpired ? (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-800 dark:text-rose-200 font-semibold text-xs flex items-center gap-2">
            <span>🛑</span>
            <span>{t('queue.sessionExpired')}</span>
          </div>
        ) : isError ? (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
            {t('queue.error')}
          </div>
        ) : (
          <p className="text-xs">{t('queue.waitingDescription')}</p>
        )}

        {/* Official Position Display */}
        {position !== undefined ? (
          <div className="p-3 rounded-xl bg-white/80 dark:bg-black/20 border border-gold-500/30 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#6B5A70] dark:text-[#A692B4]">
              {t('queue.title')}
            </span>
            <span className="text-base font-extrabold text-[#5B2A86] dark:text-gold-300 font-mono tracking-tight">
              #{position}
            </span>
          </div>
        ) : (
          !isCompleted && (
            <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] italic">
              {t('queue.noPosition')}
            </p>
          )
        )}

        {/* Official Wait Time if provided */}
        {waitTime && (
          <div className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
            ⏱ {t('queue.officialWaitTime', { time: waitTime })}
          </div>
        )}
      </div>

      {/* Safety Instructions & Guidelines */}
      <div className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] bg-gold-500/5 p-2 rounded-lg border border-gold-500/10 space-y-1">
        <p className="font-semibold text-[#5B2A86] dark:text-gold-300">
          🛡 {t('queue.keepPageOpen')}
        </p>
        <p className="text-[10px]">
          {t('queue.noRefreshAdvice')}
        </p>
      </div>

      {/* User Actions (Manual only) */}
      <div className="flex items-center gap-2 pt-1">
        {onStopMonitoring && (
          <button
            type="button"
            onClick={onStopMonitoring}
            className="sp-btn-secondary flex-1 min-h-[36px] py-1.5 text-xs font-semibold hover:border-red-400 hover:text-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none cursor-pointer"
            aria-label={t('queue.stopMonitoring')}
          >
            {t('queue.stopMonitoring')}
          </button>
        )}
        {onRefreshManually && (
          <button
            type="button"
            onClick={onRefreshManually}
            className="sp-btn-secondary min-h-[36px] py-1.5 px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none cursor-pointer"
            title="Refresh the TTD browser page manually"
            aria-label={t('queue.refreshManually')}
          >
            {t('queue.refreshManually')}
          </button>
        )}
      </div>
    </div>
  );
});
