import React from 'react';
import { t } from '@i18n/index';

interface PrimaryActionProps {
  isReady: boolean;
  isFilling: boolean;
  isComplete: boolean;
  allVerified: boolean;
  onClick: () => void;
  onStop: () => void;
  disabledReason?: string;
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  isReady,
  isFilling,
  isComplete,
  allVerified,
  onClick,
  onStop,
  disabledReason,
}) => {
  const isGeneralDetailsBlocker = disabledReason === t('dashboard.completeGeneralDetails') || disabledReason === 'Complete General Details';

  const getButtonText = () => {
    if (isFilling) return t('dashboard.fillingAndVerifying');
    if (isComplete && allVerified) return t('dashboard.allDetailsVerified');
    if (isComplete && !allVerified) return t('dashboard.repairMissingFields');
    if (isGeneralDetailsBlocker) return t('dashboard.completeGeneralDetails');
    return t('dashboard.fillAndVerify');
  };

  const isDisabled = isFilling || (!isReady && !isComplete && !isGeneralDetailsBlocker);

  return (
    <div className="space-y-2.5">
      <button
        id="sp-hero-primary-action-btn"
        onClick={onClick}
        disabled={isDisabled}
        className={`w-full min-h-[48px] py-3.5 px-6 rounded-2xl font-bold text-base tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-md select-none focus-visible:ring-4 focus-visible:ring-gold-400 focus-visible:outline-none active:scale-[0.99] ${
          isFilling
            ? 'bg-[#3E1B68] text-white/90 cursor-wait ring-2 ring-[#D4A72C]/40'
            : isComplete && allVerified
            ? 'bg-[#2F8F68] text-white border-2 border-[#2F8F68]/60 hover:bg-[#277857]'
            : isGeneralDetailsBlocker
            ? 'bg-amber-600 hover:bg-amber-700 text-white border-2 border-amber-400 hover:shadow-lg'
            : isDisabled
            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-transparent shadow-none'
            : 'bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white border-2 border-[#D4A72C]/70 hover:border-[#D4A72C] hover:shadow-xl hover:shadow-[#54258A]/20'
        }`}
        aria-label={getButtonText()}
      >
        {isFilling ? (
          <svg className="w-5 h-5 animate-spin text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51"/>
          </svg>
        ) : isComplete && allVerified ? (
          <span className="text-lg">✓</span>
        ) : (
          <span className="text-amber-300 font-bold text-lg">⚡</span>
        )}
        <span>{getButtonText()}</span>
      </button>

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

      {/* Subtext explanation */}
      {!isFilling && (
        <p className="text-center text-xs font-medium text-[#6F6477] dark:text-[#D4C3E0]">
          {disabledReason || t('dashboard.reviewNotice')}
        </p>
      )}
    </div>
  );
};
