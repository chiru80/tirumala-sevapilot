import React from 'react';
import { t } from '@i18n/index';

interface QuickActionsProps {
  onNavigate: (page: string) => void;
  onOpenPrivacy?: () => void;
  onOpenBookingHistory?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNavigate,
  onOpenPrivacy,
  onOpenBookingHistory,
}) => {
  const handleBookingHistory = () => {
    if (onOpenBookingHistory) {
      onOpenBookingHistory();
    } else {
      onNavigate('bookings');
    }
  };

  const actions = [
    {
      id: 'pilgrims',
      label: t('nav.pilgrims') || 'Pilgrims',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      action: () => onNavigate('pilgrims'),
    },
    {
      id: 'profiles',
      label: t('nav.profiles') || 'Profiles',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      action: () => onNavigate('profiles'),
    },
    {
      id: 'history',
      label: t('nav.bookings') || 'History',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      action: handleBookingHistory,
    },
    {
      id: 'settings',
      label: t('nav.settings') || 'Settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      action: () => onNavigate('settings'),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D4A72C]" />
        <p className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
          {t('dashboard.quickActions') || 'QUICK ACTIONS'}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map((act) => (
          <button
            key={act.id}
            onClick={act.action}
            className="flex flex-col items-center p-2.5 bg-white dark:bg-[#2A1733] rounded-2xl border border-[rgba(84,37,138,0.1)] hover:border-[#D4A72C]/60 hover:bg-[#FAF8F5] dark:hover:bg-[#3E1B68]/20 cursor-pointer transition-all group shadow-2xs min-h-[58px] justify-center"
            aria-label={act.label}
          >
            <svg
              className="w-5 h-5 text-[#54258A] dark:text-[#D4A72C] mb-1 group-hover:scale-110 transition-transform shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={act.icon} />
            </svg>
            <span className="text-xs font-bold text-[#30213A] dark:text-[#F8EFD8] truncate w-full text-center">
              {act.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
