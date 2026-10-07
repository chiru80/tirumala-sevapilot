import React, { useState, useEffect } from 'react';
import type { TtdTemporaryLockState } from '@shared/types';
import { t } from '@i18n/index';

interface TemporaryLockCardProps {
  lockState: TtdTemporaryLockState;
  onCheckBookingHistory: () => void;
  onTryAgain: () => void;
}

export const TemporaryLockCard: React.FC<TemporaryLockCardProps> = ({
  lockState,
  onCheckBookingHistory,
  onTryAgain,
}) => {
  const initialSeconds = lockState.remainingSeconds ?? (lockState.durationMinutes ? lockState.durationMinutes * 60 : 0);
  const [remaining, setRemaining] = useState<number>(initialSeconds);

  // Informational Countdown Timer — STRICTLY informational, never triggers auto-retry
  useEffect(() => {
    if (!lockState.hasExplicitTimer || initialSeconds <= 0) return;

    setRemaining(initialSeconds);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockState, initialSeconds]);

  const minutesRemaining = Math.max(1, Math.ceil(remaining / 60));
  const isExpired = lockState.hasExplicitTimer && remaining <= 0;

  return (
    <div
      className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 p-4 shadow-sm space-y-3.5 transition-all"
      role="alert"
      aria-live="assertive"
    >
      {/* Header Badge */}
      <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base text-amber-600 dark:text-amber-400 font-bold">⚠</span>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            BOOKING STATUS: Temporary TTD lock
          </span>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">
          Server-side hold
        </span>
      </div>

      {/* Main explanation copy */}
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-amber-950 dark:text-amber-100 leading-snug">
          {lockState.message || 'Your previous booking attempt is still holding this pilgrim.'}
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
          {isExpired
            ? 'Lock may have expired. Please verify booking history before trying again.'
            : lockState.hasExplicitTimer && remaining > 0
            ? `Try again in approximately ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}. TTD usually releases the lock after a few minutes.`
            : lockState.supportingMessage || 'TTD usually releases the temporary lock after a few minutes.'}
        </p>
      </div>

      {/* Informational Countdown Banner if explicit timer is present */}
      {lockState.hasExplicitTimer && (
        <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/70 dark:border-amber-700/60 flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            {isExpired ? 'Status:' : 'Estimated Release:'}
          </span>
          <span className="font-mono font-bold text-amber-950 dark:text-amber-100">
            {isExpired
              ? 'Lock may have expired.'
              : `~${minutesRemaining} min remaining`}
          </span>
        </div>
      )}

      {/* Recommended Actions */}
      <div className="space-y-2 pt-1">
        {/* Primary Action: Check Booking History */}
        <div className="space-y-1">
          <button
            onClick={onCheckBookingHistory}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#54258A] hover:bg-[#461F73] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
            aria-label="Check Booking History"
          >
            <span>📜</span>
            <span>Check Booking History</span>
          </button>
          <p className="text-[11px] text-center text-amber-800/90 dark:text-amber-300/90 font-medium">
            Make sure the previous attempt did not create a booking.
          </p>
        </div>

        {/* Secondary Action: Try Again (User-initiated only) */}
        <button
          onClick={onTryAgain}
          className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-white dark:bg-amber-900/60 border border-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-800/60 text-amber-950 dark:text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
          aria-label="Try Again"
        >
          <span>🔄</span>
          <span>Try Again</span>
        </button>
      </div>

      <div className="pt-1 text-[10px] text-amber-700/80 dark:text-amber-400/80 text-center">
        Informational only. SevaPilot preserves your pilgrim profiles and never auto-retries server locks.
      </div>
    </div>
  );
};
