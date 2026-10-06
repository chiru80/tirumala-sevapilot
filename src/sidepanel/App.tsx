import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './pages/Dashboard';
import { Profiles } from './pages/Profiles';
import { Validation } from './pages/Validation';
import { Settings } from './pages/Settings';
import { Bookings } from './pages/Bookings';
import { Documents } from './pages/Documents';
import { Backup } from './pages/Backup';
import { Onboarding } from './pages/Onboarding';
import { getSettings } from '@storage/repository';
import { EXTENSION_VERSION } from '@shared/constants';
import { setLanguage, useI18n, type Language } from '@i18n/index';
import type { Settings as SettingsType } from '@shared/types';

type Page = 'dashboard' | 'profiles' | 'pilgrims' | 'bookings' | 'validation' | 'documents' | 'backup' | 'settings';

export default function App() {
  const { language: activeLanguage } = useI18n();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Apply theme (default light warm ivory temple mode; 'dark' activates Temple Night Mode)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  async function loadSettings() {
    try {
      const s = await getSettings();
      setSettings(s);

      // Set language
      const validLangs: Language[] = ['en', 'te', 'hi', 'ta', 'kn'];
      const activeLang = validLangs.includes(s.language as Language) ? (s.language as Language) : 'en';
      setLanguage(activeLang);

      // Set theme
      if (s.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      } else {
        setTheme(s.theme as 'light' | 'dark');
      }

      // Show onboarding if first time
      if (!s.onboardingComplete) {
        setShowOnboarding(true);
      }
    } catch {
      // First load with no settings
      setShowOnboarding(true);
    }
  }


  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          loadSettings();
        }}
      />
    );
  }

  return (
    <div key={activeLanguage} className="flex flex-col h-screen bg-[#FFFDF7] dark:bg-[#211526] text-[#321B3F] dark:text-[#F8EFD8] temple-watermark transition-colors duration-200">
      {/* Clean Premium Header */}
      <header className="relative bg-[#FFFDF7] dark:bg-[#2C1A35] border-b border-[rgba(84,37,138,0.08)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Temple Emblem */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#54258A] to-[#3E1B68] shadow-sm">
              <svg className="w-4 h-4 text-[#D4A72C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 2 10.5 5 10.5 8C10.5 9.5 11.2 10.5 12 11C12.8 10.5 13.5 9.5 13.5 8C13.5 5 12 2 12 2Z" fill="#D4A72C" />
                <path d="M7 6C7 6 8.5 8.5 8.5 11C8.5 13 7.5 14.5 6 15C5 13 5.5 10 7 6Z" fill="#D4A72C" opacity="0.7" />
                <path d="M17 6C17 6 15.5 8.5 15.5 11C15.5 13 16.5 14.5 18 15C19 13 18.5 10 17 6Z" fill="#D4A72C" opacity="0.7" />
                <path d="M11 12H13V22H11V12Z" fill="#D4A72C" opacity="0.5" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold tracking-tight font-serif text-[#54258A] dark:text-[#F8EFD8] leading-none">
                  SevaPilot
                </h1>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[#54258A]/10 text-[#54258A] dark:bg-[#D4A72C]/15 dark:text-[#D4A72C] font-semibold">
                  v{EXTENSION_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#6F6477] dark:text-[#A692B4] font-medium leading-tight mt-0.5">
                TTD Booking Assistant
              </p>
            </div>
          </div>

          <span className="text-xs font-serif italic text-[#D4A72C]/80 dark:text-[#D4A72C]/70">
            Om Namo Venkatesaya
          </span>
        </div>

        {/* Subtle gold accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A72C]/30 to-transparent" />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && <Dashboard onNavigate={(page) => setCurrentPage(page as Page)} />}
        {(currentPage === 'profiles' || currentPage === 'pilgrims') && <Profiles />}
        {currentPage === 'bookings' && <Bookings />}
        {currentPage === 'documents' && <Documents />}
        {currentPage === 'validation' && <Validation />}
        {currentPage === 'backup' && <Backup />}
        {currentPage === 'settings' && (
          <Settings
            onSettingsChange={() => loadSettings()}
          />
        )}
      </main>

      {/* Traditional Temple Navigation Bar */}
      <Navigation
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
    </div>
  );
}
