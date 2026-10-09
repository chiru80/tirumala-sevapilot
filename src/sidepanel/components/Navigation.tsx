import React from 'react';
import { t } from '@i18n/index';

type Page = 'dashboard' | 'profiles' | 'more' | 'pilgrims' | 'bookings' | 'validation' | 'documents' | 'backup' | 'settings';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const navItems: Array<{ page: Page; label: string; ariaLabel: string; iconPath: string }> = [
    {
      page: 'dashboard',
      label: t('nav.home') || 'Home',
      ariaLabel: `Home — ${t('nav.homeA11y') || 'View booking status'}`,
      iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    },
    {
      page: 'profiles',
      label: t('nav.profiles') || 'Profile',
      ariaLabel: `Profiles — ${t('nav.profilesA11y') || 'Manage devotee profiles'}`,
      iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      page: 'more',
      label: t('nav.more') || 'More',
      ariaLabel: `More — ${t('nav.moreA11y') || 'Settings and secondary tools'}`,
      iconPath: 'M4 6h16M4 12h16M4 18h16',
    },
  ];

  return (
    <nav
      className="relative flex items-center justify-around border-t border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2C1A35] px-2 py-2 select-none"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map(({ page, iconPath, label, ariaLabel }) => {
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
            aria-label={ariaLabel}
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
