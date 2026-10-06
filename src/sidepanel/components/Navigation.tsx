import React from 'react';
import { t } from '@i18n/index';

type Page = 'dashboard' | 'profiles' | 'pilgrims' | 'bookings' | 'validation' | 'documents' | 'backup' | 'settings';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const navItems: Array<{ page: Page; label: string; iconPath: string }> = [
    {
      page: 'dashboard',
      label: t('nav.home'),
      iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    },
    {
      page: 'profiles',
      label: t('nav.profiles'),
      iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      page: 'pilgrims',
      label: t('nav.pilgrims'),
      iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      page: 'settings',
      label: t('nav.settings'),
      iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
  ];

  return (
    <nav
      className="relative flex items-center justify-around border-t border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2C1A35] px-2 py-2 select-none"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map(({ page, iconPath, label }) => {
        const isActive = currentPage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl min-h-[44px] text-xs font-semibold transition-all duration-150 cursor-pointer ${
              isActive
                ? 'text-[#54258A] dark:text-[#F8EFD8] font-bold'
                : 'text-[#6F6477] dark:text-[#A692B4] hover:text-[#54258A] dark:hover:text-[#F8EFD8]'
            }`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span className="absolute -top-2 w-6 h-[3px] rounded-full bg-[#54258A] dark:bg-[#D4A72C]" />
            )}

            <svg
              className={`w-5 h-5 mb-0.5 ${
                isActive ? 'text-[#54258A] dark:text-[#D4A72C]' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={iconPath} />
            </svg>
            <span className="tracking-tight leading-none text-xs">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
