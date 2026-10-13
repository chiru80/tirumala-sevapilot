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
import { More } from './pages/More';
import { getSettings } from '@storage/repository';
import { EXTENSION_VERSION } from '@shared/constants';
import { setLanguage, useI18n, type Language } from '@i18n/index';
import type { Settings as SettingsType } from '@shared/types';

type Page = 'dashboard' | 'profiles' | 'more' | 'pilgrims' | 'bookings' | 'validation' | 'documents' | 'backup' | 'settings';

export default function App() {
  const { language: activeLanguage } = useI18n();
  const [history, setHistory] = useState<Page[]>(['dashboard']);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const currentPage: Page = history[history.length - 1] || 'dashboard';

  const navigate = (page: Page) => {
    setHistory((prev) => {
      const current = prev[prev.length - 1];
      if (current === page) return prev;
      const nextHistory = [...prev, page];
      if (nextHistory.length > 25) {
        return nextHistory.slice(nextHistory.length - 25);
      }
      return nextHistory;
    });

    try {
      window.history.pushState({ page }, '');
    } catch {
      // Safe fallback if environment restricts pushState
    }
  };

  const goBack = () => {
    setHistory((prev) => {
      if (prev.length <= 1) {
        return ['dashboard'];
      }
      const next = prev.slice(0, prev.length - 1);
      return next.length > 0 ? next : ['dashboard'];
    });
  };

  const canGoBack = history.length > 1 && currentPage !== 'dashboard';

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page) {
        setHistory((prev) => {
          if (prev.length <= 1) return ['dashboard'];
          return prev.slice(0, prev.length - 1);
        });
      } else {
        goBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      <header className="relative bg-[#FFFDF7] dark:bg-[#2C1A35] border-b border-[rgba(84,37,138,0.08)] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Temple Emblem / Logo */}
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden shadow-sm shrink-0 border border-[#D4A72C]/40 bg-[#2C1A35]">
              <img
                src="/icons/icon48.png"
                alt="Tirumala SevaPilot Logo"
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <h1 className="text-base font-bold tracking-tight font-serif text-[#54258A] dark:text-[#F8EFD8] leading-none">
                Tirumala SevaPilot
              </h1>
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
        {currentPage === 'dashboard' && <Dashboard onNavigate={(page) => navigate(page as Page)} />}
        {(currentPage === 'profiles' || currentPage === 'pilgrims') && (
          <Profiles onBack={canGoBack ? goBack : undefined} onNavigate={(page) => navigate(page as Page)} />
        )}
        {currentPage === 'more' && (
          <More
            onNavigate={(page) => navigate(page as Page)}
            onBack={canGoBack ? goBack : undefined}
            onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            isDark={theme === 'dark'}
          />
        )}
        {currentPage === 'bookings' && <Bookings onBack={goBack} />}
        {currentPage === 'documents' && <Documents onBack={goBack} />}
        {currentPage === 'validation' && <Validation onBack={goBack} />}
        {currentPage === 'backup' && <Backup onBack={goBack} />}
        {currentPage === 'settings' && (
          <Settings
            onBack={goBack}
            onSettingsChange={() => loadSettings()}
          />
        )}
      </main>

      {/* Traditional Temple Navigation Bar */}
      <Navigation
        currentPage={currentPage}
        onNavigate={navigate}
      />
    </div>
  );
}
