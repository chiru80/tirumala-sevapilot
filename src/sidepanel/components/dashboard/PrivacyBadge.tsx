import React, { useState } from 'react';
import { t } from '@i18n/index';

interface PrivacyBadgeProps {
  onOpenModal?: () => void;
}

export const PrivacyBadge: React.FC<PrivacyBadgeProps> = React.memo(({ onOpenModal }) => {
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setShowExplanation(prev => !prev);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#54258A]/5 dark:bg-[#D4A72C]/10 border border-[#54258A]/15 dark:border-[#D4A72C]/20 text-[#54258A] dark:text-[#D4A72C] hover:bg-[#54258A]/10 dark:hover:bg-[#D4A72C]/20 transition-all cursor-pointer select-none shadow-xs active:scale-[0.98]"
        aria-label="Data stored locally"
      >
        <span>{t('dashboard.localData')}</span>
      </button>

      {showExplanation && (
        <div className="absolute bottom-full left-0 mb-2 w-72 p-3.5 bg-white dark:bg-[#2A1733] border border-[rgba(84,37,138,0.25)] rounded-2xl shadow-xl z-50 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#54258A] dark:text-[#D4A72C] flex items-center gap-1.5">
              <span>🔐</span> {t('dashboard.localPrivacyModel')}
            </span>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-[#6F6477] hover:text-black dark:text-[#A692B4] font-bold cursor-pointer text-sm p-1"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-[#6F6477] dark:text-[#D4C3E0] leading-relaxed">
            {t('dashboard.localPrivacyDesc')}
          </p>
          <ul className="text-xs text-[#6F6477] dark:text-[#D4C3E0] space-y-1 list-disc pl-4">
            <li>{t('dashboard.noRemoteServers')}</li>
            <li>{t('dashboard.noExternalSharing')}</li>
            <li>{t('dashboard.officialTtdOnly')}</li>
          </ul>
        </div>
      )}
    </div>
  );
});
