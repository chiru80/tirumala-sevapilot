import React from 'react';
import type { Profile } from '@shared/types';
import type { ProfileHealth } from '../../../services/profile-health';
import { t } from '@i18n/index';

interface ActiveProfileCardProps {
  profile: Profile | null;
  selectedCount: number;
  health: ProfileHealth;
  onChangeProfile: () => void;
  onManage?: () => void;
}

export const ActiveProfileCard: React.FC<ActiveProfileCardProps> = ({
  profile,
  selectedCount,
  health,
  onChangeProfile,
  onManage,
}) => {
  const handleAction = onManage || onChangeProfile;

  if (!profile) {
    return (
      <div className="rounded-2xl border border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2A1733] p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
              PROFILE
            </span>
            <p className="text-sm font-bold text-[#30213A] dark:text-[#F8EFD8] mt-0.5">
              {t('home.noProfileYet') || 'No profile yet'}
            </p>
            <p className="text-xs text-[#6F6477] dark:text-[#C5B4D4] mt-0.5 font-medium">
              {t('home.noProfileSubtitle') || 'Create a profile to prepare your booking faster.'}
            </p>
          </div>
          <button
            onClick={handleAction}
            className="min-h-[40px] text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white hover:opacity-95 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            aria-label={t('home.createProfile') || 'CREATE PROFILE'}
          >
            {t('home.createProfile') || 'CREATE PROFILE'}
          </button>
        </div>
      </div>
    );
  }

  const isAllReady = health.total > 0 && health.ready === health.total;
  const pilgrimPlural = profile.pilgrims?.length === 1 ? 'pilgrim' : 'pilgrims';

  return (
    <div className="rounded-2xl border border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2A1733] p-4 shadow-2xs transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
              {t('home.welcomeBack') || 'WELCOME BACK'}
            </span>
          </div>

          <h3 className="text-base font-bold text-[#30213A] dark:text-[#F8EFD8] truncate mt-0.5">
            {profile.name}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold text-[#54258A] dark:text-[#F0CC63] bg-[#54258A]/8 dark:bg-[#D4A72C]/15 px-2 py-0.5 rounded-md">
              {profile.pilgrims?.length || 0} {pilgrimPlural} ready
            </span>
            {selectedCount > 0 && selectedCount !== profile.pilgrims?.length && (
              <span className="text-[11px] text-[#6F6477] dark:text-[#C5B4D4] font-medium">
                ({selectedCount} selected)
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          {/* Consumer Status Badge: READY or ACTION REQUIRED */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
              isAllReady
                ? 'text-[#1B5E20] bg-[#E8F5E9] border-[#2E7D5B]/30 dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
                : 'text-[#8D6E18] bg-[#FFF8E8] border-[#D4A72C]/40 dark:bg-[#3D2F1B] dark:text-[#FFE082]'
            }`}
            role="status"
          >
            <span>{isAllReady ? '✓' : '⚠'}</span>
            <span>{isAllReady ? (t('home.ready') || 'Ready') : (t('home.actionRequired') || 'Action required')}</span>
          </span>

          <button
            onClick={handleAction}
            className="text-xs font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer py-0.5"
            aria-label={t('home.manageProfile') || 'Manage Profile →'}
          >
            {t('home.manageProfile') || 'Manage Profile →'}
          </button>
        </div>
      </div>
    </div>
  );
};
