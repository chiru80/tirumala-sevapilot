import React from 'react';
import { t } from '@i18n/index';

export type DashboardContextState =
  | 'FIRST_TIME_USER'
  | 'NO_TTD_PAGE'
  | 'PROFILE_READY'
  | 'TTD_PAGE_READY'
  | 'FILLING'
  | 'READY_FOR_REVIEW'
  | 'ACTION_REQUIRED'
  | 'DIGITAL_QUEUE'
  | 'TEMPORARY_TTD_LOCK';

export interface PrimaryActionProps {
  isReady: boolean;
  isFilling: boolean;
  isComplete: boolean;
  allVerified: boolean;
  onClick: () => void | Promise<void>;
  onStop: () => void;
  disabledReason?: string;
  isTemporaryLock?: boolean;

  // Enhanced Context-Aware props (Master Prompt Redesign)
  contextState?: DashboardContextState;
  actionLabel?: string;
  supportingText?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  isReady,
  isFilling,
  isComplete,
  allVerified,
  onClick,
  onStop,
  disabledReason,
  isTemporaryLock,
  contextState,
  actionLabel,
  supportingText,
  secondaryAction,
}) => {
  const isGeneralDetailsBlocker =
    disabledReason === t('dashboard.completeGeneralDetails') ||
    disabledReason === 'Complete General Details';

  // Determine button label
  const getButtonText = () => {
    if (actionLabel) return actionLabel;

    if (contextState === 'TEMPORARY_TTD_LOCK' || isTemporaryLock) {
      return t('home.checkBookingHistory') || 'CHECK BOOKING HISTORY';
    }

    if (contextState === 'FIRST_TIME_USER') {
      return t('home.createProfile') || 'CREATE PROFILE';
    }

    if (contextState === 'NO_TTD_PAGE') {
      return t('home.openTtd') || 'OPEN TTD BOOKING ↗';
    }

    if (contextState === 'DIGITAL_QUEUE') {
      return actionLabel || t('queue.waiting') || 'WAITING IN QUEUE';
    }

    if (contextState === 'ACTION_REQUIRED') {
      if (disabledReason === 'Select pilgrims' || disabledReason === t('dashboard.selectPilgrims')) {
        return t('dashboard.selectPilgrims') || 'SELECT PILGRIMS';
      }
      if (isGeneralDetailsBlocker) {
        return t('dashboard.completeGeneralDetails') || 'COMPLETE GENERAL DETAILS';
      }
      return 'ACTION REQUIRED';
    }

    if (isFilling) return t('dashboard.fillingAndVerifying') || 'FILLING…';
    if (isComplete && allVerified) return t('home.readyForReview') || '✓ READY FOR REVIEW';
    if (isComplete && !allVerified) return t('dashboard.repairMissingFields') || 'REPAIR MISSING FIELDS';
    if (isGeneralDetailsBlocker) return t('dashboard.completeGeneralDetails') || 'COMPLETE DETAILS';

    return t('dashboard.fillAndVerify') || '⚡ FILL & VERIFY';
  };

  // Determine disabled state
  const isDisabled =
    contextState === 'DIGITAL_QUEUE' ||
    isFilling ||
    (!isReady &&
      !isComplete &&
      !isGeneralDetailsBlocker &&
      contextState !== 'FIRST_TIME_USER' &&
      contextState !== 'NO_TTD_PAGE' &&
      contextState !== 'PROFILE_READY' &&
      contextState !== 'ACTION_REQUIRED' &&
      contextState !== 'TEMPORARY_TTD_LOCK');

  // Determine styling
  const getButtonClass = () => {
    if (contextState === 'TEMPORARY_TTD_LOCK' || isTemporaryLock) {
      return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-2 border-amber-400/80 hover:border-amber-300 hover:shadow-lg shadow-md';
    }
    if (contextState === 'DIGITAL_QUEUE') {
      return 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-2 border-blue-400/80 hover:border-blue-300 shadow-md cursor-wait';
    }
    if (isFilling) {
      return 'bg-[#3E1B68] text-white/90 cursor-wait ring-2 ring-[#D4A72C]/40';
    }
    if (isComplete && allVerified) {
      return 'bg-[#2F8F68] text-white border-2 border-[#2F8F68]/70 hover:bg-[#277857] shadow-md';
    }
    if (isGeneralDetailsBlocker) {
      return 'bg-amber-600 hover:bg-amber-700 text-white border-2 border-amber-400 hover:shadow-lg';
    }
    if (contextState === 'ACTION_REQUIRED') {
      return 'bg-gradient-to-r from-[#D4A72C] to-[#BA8E1F] text-[#30213A] font-extrabold border-2 border-[#F0CC63] hover:shadow-lg';
    }
    if (contextState === 'FIRST_TIME_USER') {
      return 'bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white border-2 border-[#D4A72C] hover:shadow-xl hover:shadow-[#54258A]/25';
    }
    if (contextState === 'NO_TTD_PAGE') {
      return 'bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white border-2 border-[#D4A72C]/80 hover:border-[#D4A72C] hover:shadow-lg';
    }
    if (isDisabled) {
      return 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-transparent shadow-none';
    }
    // Dominant ⚡ FILL & VERIFY
    return 'bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white border-2 border-[#D4A72C]/80 hover:border-[#D4A72C] hover:shadow-xl hover:shadow-[#54258A]/25';
  };

  // Determine subtext
  const getSubtext = () => {
    if (supportingText) return supportingText;
    if (contextState === 'DIGITAL_QUEUE') {
      return t('queue.keepOpenDesc') || 'Please keep this TTD page open. Do not refresh unnecessarily.';
    }
    if (contextState === 'TEMPORARY_TTD_LOCK' || isTemporaryLock) {
      return t('home.temporaryLockDesc') || 'TTD is processing your previous booking attempt. Lock releases automatically.';
    }
    if (contextState === 'FIRST_TIME_USER') {
      return t('home.welcomeHeroSubtitle') || 'Save your pilgrim details once and prepare your booking faster.';
    }
    if (contextState === 'NO_TTD_PAGE') {
      return t('home.openTtdSubtitle') || 'Open a supported TTD booking page to start.';
    }
    if (isComplete && allVerified) {
      return t('home.readyForReviewDesc') || 'Your details have been filled and verified. Review before you submit.';
    }
    if (disabledReason) {
      return disabledReason;
    }
    if (isReady) {
      return t('home.readySupporting') || 'Your selected pilgrim details are ready.';
    }
    return t('dashboard.reviewNotice') || 'Prepare faster. Review before you submit.';
  };

  const buttonText = getButtonText();

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        <button
          id="sp-hero-primary-action-btn"
          onClick={onClick}
          disabled={isDisabled && !secondaryAction}
          className={`w-full min-h-[48px] py-3 px-5 rounded-2xl font-bold text-base tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none focus-visible:ring-4 focus-visible:ring-gold-400 focus-visible:outline-none active:scale-[0.99] ${getButtonClass()}`}
          aria-label={buttonText}
        >
          {isFilling ? (
            <svg
              className="w-5 h-5 animate-spin text-white shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51" />
            </svg>
          ) : contextState === 'TEMPORARY_TTD_LOCK' || isTemporaryLock ? (
            <span className="text-amber-200 font-bold text-lg">⏳</span>
          ) : isComplete && allVerified ? (
            <span className="text-white font-bold text-lg">✓</span>
          ) : contextState === 'NO_TTD_PAGE' ? (
            <span className="text-[#D4A72C] font-bold text-lg">🌐</span>
          ) : contextState === 'FIRST_TIME_USER' ? (
            <span className="text-[#D4A72C] font-bold text-lg">✦</span>
          ) : (
            <span className="text-amber-300 font-bold text-lg">⚡</span>
          )}
          <span>{buttonText}</span>
        </button>

        {/* Secondary Action (e.g. Try Again, Prepare Booking, Learn how it works) */}
        {secondaryAction && !isFilling && (
          <button
            onClick={secondaryAction.onClick}
            className="w-full min-h-[38px] py-1.5 px-4 rounded-xl text-xs font-bold text-[#54258A] dark:text-[#D4A72C] bg-white dark:bg-[#2A1733] border border-[rgba(84,37,138,0.15)] hover:border-[#D4A72C] hover:bg-[#FAF8F5] dark:hover:bg-[#3E1B68]/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{secondaryAction.label}</span>
          </button>
        )}
      </div>

      {/* Emergency cancel during filling */}
      {isFilling && (
        <button
          onClick={onStop}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label={t('dashboard.cancelOperation')}
        >
          <span className="w-2.5 h-2.5 rounded-xs bg-white shrink-0" />
          <span>{t('dashboard.cancelOperation')}</span>
        </button>
      )}

      {/* Contextual Subtext Explanation */}
      {!isFilling && (
        <p className="text-center text-xs font-medium text-[#6F6477] dark:text-[#D4C3E0] px-1 leading-relaxed">
          {getSubtext()}
        </p>
      )}
    </div>
  );
};
