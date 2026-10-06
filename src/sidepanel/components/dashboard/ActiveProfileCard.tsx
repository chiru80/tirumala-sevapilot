import React from 'react';
import type { Profile } from '@shared/types';
import type { ProfileHealth } from '../../../services/profile-health';
import { t } from '@i18n/index';

interface ActiveProfileCardProps {
  profile: Profile | null;
  selectedCount: number;
  health: ProfileHealth;
  onChangeProfile: () => void;
}

export const ActiveProfileCard: React.FC<ActiveProfileCardProps> = ({
  profile,
  selectedCount,
  health,
  onChangeProfile,
}) => {
  if (!profile) {
    return (
      <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
              {t('dashboard.activeProfile')}
            </span>
            <p className="text-sm font-semibold text-[#6F6477] dark:text-[#D4C3E0] mt-0.5">
              {t('dashboard.noProfileSelected')}
            </p>
          </div>
          <button
            onClick={onChangeProfile}
            className="min-h-[44px] text-sm font-bold px-4 py-2 rounded-xl bg-[#54258A]/10 text-[#54258A] dark:text-[#D4A72C] hover:bg-[#54258A]/20 transition-all cursor-pointer"
            aria-label={t('dashboard.selectProfile')}
          >
            {t('dashboard.selectProfile')}
          </button>
        </div>
      </div>
    );
  }

  const isAllReady = health.total > 0 && health.ready === health.total;

  return (
    <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
            {t('dashboard.activeProfile')}
          </span>
          <h3 className="text-lg font-bold text-[#30213A] dark:text-[#F8EFD8] truncate mt-0.5">
            {profile.name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#54258A] dark:text-[#F0CC63] bg-[#54258A]/8 dark:bg-[#D4A72C]/15 px-2 py-0.5 rounded-md">
              {t('dashboard.pilgrimsSelectedCount', { count: selectedCount })}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
              isAllReady
                ? 'text-[#1B5E20] bg-[#E8F5E9] border-[#2E7D5B]/30 dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
                : 'text-[#8D6E18] bg-[#FFF8E8] border-[#D4A72C]/40 dark:bg-[#3D2F1B] dark:text-[#FFE082]'
            }`}
            role="status"
            aria-label={`${t('dashboard.profileHealth')}: ${isAllReady ? '100% READY' : `${health.percentage}%`}`}
          >
            <span className="font-bold">{isAllReady ? '✓' : '⚠'}</span>
            <span>
              {isAllReady
                ? t('dashboard.oneHundredPercentReady')
                : t('dashboard.readyCount', { ready: health.ready, total: health.total })}
            </span>
          </div>

          <button
            onClick={onChangeProfile}
            className="text-xs font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer py-1 px-1"
            aria-label={t('dashboard.changeProfile')}
          >
            {t('dashboard.changeProfile')} →
          </button>
        </div>
      </div>
    </div>
  );
};
