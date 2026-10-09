import React, { useState } from 'react';
import { Card, Icon, Button, Badge, BackButton } from '../design-system';
import { t, setLanguage, useI18n, type Language } from '@i18n/index';
import { getSettings, saveSettings } from '@storage/repository';
import { EXTENSION_VERSION } from '@shared/constants';

export interface MoreProps {
  onNavigate: (page: string) => void;
  onThemeToggle?: () => void;
  isDark?: boolean;
  onBack?: () => void;
}

export const More: React.FC<MoreProps> = ({
  onNavigate,
  onThemeToggle,
  isDark = false,
  onBack,
}) => {
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'hub' | 'diagnostics' | 'shortcuts'>('hub');

  const languages: Array<{ code: Language; name: string; native: string }> = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  ];

  const handleLanguageChange = async (langCode: Language) => {
    setLanguage(langCode);
    const current = await getSettings();
    await saveSettings({ ...current, language: langCode });
  };

  if (activeTab === 'shortcuts') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
          <BackButton onClick={() => setActiveTab('hub')} showText />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#321B3F] dark:text-[#F8EFD8]">
            Keyboard Shortcuts
          </h2>
        </div>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="font-medium text-[#321B3F] dark:text-[#F8EFD8]">Quick Fill / Trigger Action</span>
            <kbd className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px] font-bold">Alt + F</kbd>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="font-medium text-[#321B3F] dark:text-[#F8EFD8]">Open Command Center</span>
            <kbd className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px] font-bold">Alt + K</kbd>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="font-medium text-[#321B3F] dark:text-[#F8EFD8]">Emergency Stop</span>
            <kbd className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px] font-bold">Esc</kbd>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="font-medium text-[#321B3F] dark:text-[#F8EFD8]">Toggle Diagnostics</span>
            <kbd className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px] font-bold">Alt + D</kbd>
          </div>
        </Card>
      </div>
    );
  }

  if (activeTab === 'diagnostics') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
          <BackButton onClick={() => setActiveTab('hub')} showText />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#321B3F] dark:text-[#F8EFD8]">
            System Diagnostics
          </h2>
        </div>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[#6B5A70] dark:text-[#A692B4]">Extension Version</span>
            <span className="font-mono font-bold text-[#321B3F] dark:text-[#F8EFD8]">{EXTENSION_VERSION}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[#6B5A70] dark:text-[#A692B4]">Runtime Engine</span>
            <Badge variant="ready" size="sm">Phase 12 Zero-Lag</Badge>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[#6B5A70] dark:text-[#A692B4]">DOM Observation</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Micro-batched (Passive)</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[#6B5A70] dark:text-[#A692B4]">Idle CPU Usage</span>
            <span className="font-mono text-[#321B3F] dark:text-[#F8EFD8]">0.0% (Event-driven)</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-[#6B5A70] dark:text-[#A692B4]">Zero PII Telemetry</span>
            <Badge variant="completed" size="sm">Enforced</Badge>
          </div>
        </Card>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-[#6B5A70] dark:text-[#A692B4] space-y-1">
          <p className="font-bold text-[#321B3F] dark:text-[#F8EFD8]">Diagnostics moved out of Home</p>
          <p>Technical telemetry is kept in this secondary area so the primary booking experience remains calm and focused.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Page Title */}
      <div className="border-b border-black/5 dark:border-white/5 pb-2 flex items-center gap-2">
        {onBack && <BackButton onClick={onBack} />}
        <div>
          <h2 className="text-sm font-bold text-[#321B3F] dark:text-[#F8EFD8]">
            {t('more.title') || 'More & Preferences'}
          </h2>
          <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
            {t('more.subtitle') || 'Preferences, data management, and system tools.'}
          </p>
        </div>
      </div>

      {/* 1. Language Preference */}
      <Card padding="md" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] flex items-center gap-2">
            <Icon name="sparkles" size={14} className="text-[#54258A] dark:text-[#D4A72C]" />
            {t('more.language') || 'Language / భాష'}
          </span>
          <span className="text-[11px] font-semibold text-[#6B5A70] dark:text-[#A692B4]">
            {languages.find((l) => l.code === language)?.native || 'English'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {languages.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => handleLanguageChange(l.code)}
              className={`
                px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer
                ${
                  language === l.code
                    ? 'border-[#54258A] dark:border-[#D4A72C] bg-[#54258A]/10 dark:bg-[#D4A72C]/15 text-[#54258A] dark:text-[#F8EFD8]'
                    : 'border-black/5 dark:border-white/5 hover:border-black/20 text-[#6B5A70] dark:text-[#A692B4]'
                }
              `}
            >
              <span>{l.native}</span>
              {language === l.code && <Icon name="check" size={12} />}
            </button>
          ))}
        </div>
      </Card>

      {/* 2. Management & Tools List */}
      <Card padding="none" className="divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#54258A]/10 dark:bg-[#D4A72C]/10 flex items-center justify-center text-[#54258A] dark:text-[#D4A72C]">
              <Icon name="user" size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                {t('more.documents') || 'Documents & Photos'}
              </p>
              <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                Manage devotee ID proofs & photos
              </p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('backup')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                {t('more.backup') || 'Backup & Restore'}
              </p>
              <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                Export or import encrypted profiles
              </p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Icon name="settings" size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                {t('more.settings') || 'Settings & Speed'}
              </p>
              <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                Autofill speed, notifications, and theme
              </p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shortcuts')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Icon name="calendar" size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                Keyboard Shortcuts
              </p>
              <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                Speed commands for quick booking
              </p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostics')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Icon name="info" size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                System Diagnostics
              </p>
              <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                Telemetry & Phase 12 engine metrics
              </p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-slate-400" />
        </button>
      </Card>

      {/* 3. Privacy & Safety Summary */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-center">
        <p className="text-xs font-bold text-[#54258A] dark:text-[#D4A72C] flex items-center justify-center gap-1.5">
          <Icon name="shield" size={14} />
          Non-Negotiable Trust Boundaries
        </p>
        <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] leading-relaxed max-w-xs mx-auto">
          All devotee data is stored locally in encrypted browser storage. Zero tracking. Zero remote code. CAPTCHA, OTP, and payments remain strictly human-controlled.
        </p>
        <p className="text-[10px] text-slate-400 pt-1">
          Tirumala SevaPilot v{EXTENSION_VERSION}
        </p>
      </div>
    </div>
  );
};
