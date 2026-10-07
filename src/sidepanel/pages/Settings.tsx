import React, { useState, useEffect } from 'react';
import { t, setLanguage } from '@i18n/index';
import { getSettings, saveSettings, clearAllData } from '@storage/repository';
import { EXTENSION_VERSION, STORAGE_KEYS } from '@shared/constants';
import type { Settings as SettingsType, AutofillMode } from '@shared/types';
import { TempleDivider } from '../components/TempleDivider';

export function Settings({ onSettingsChange }: { onSettingsChange: () => void }) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [resetFloatStatus, setResetFloatStatus] = useState<string | null>(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
  }

  async function updateSetting<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (key === 'language') {
      setLanguage(value as any);
    }
    await saveSettings({ [key]: value });
    onSettingsChange();
  }

  async function handleResetFloatingPosition() {
    await chrome.storage.local.remove(STORAGE_KEYS.FLOATING_POS);
    setResetFloatStatus(t('settings.positionReset'));
    setTimeout(() => setResetFloatStatus(null), 2500);
  }

  async function handleClearAll() {
    await clearAllData();
    setShowClearConfirm(false);
    window.location.reload();
  }

  if (!settings) return null;

  return (
    <div className="p-4 space-y-4 animate-fade-in text-[#321B3F] dark:text-[#F8EFD8]">
      <div>
        <h2 className="text-xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">{t('settings.title')}</h2>
        <p className="text-sm text-[#6B5A70] dark:text-[#A692B4] mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <TempleDivider variant="compact" />

      {/* Autofill Mode Selector */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-2.5">
        <div>
          <label className="sp-label text-sm font-bold text-[#5B2A86] dark:text-gold-300">{t('settings.autofillMode')}</label>
          <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
            {t('settings.autofillModeDesc')}
          </p>
        </div>
        <div className="space-y-2">
          {[
            {
              id: 'safe',
              title: t('settings.safeMode'),
              desc: t('settings.safeModeDesc'),
            },
            {
              id: 'fast',
              title: t('settings.fastMode'),
              desc: t('settings.fastModeDesc'),
            },
            {
              id: 'manual',
              title: t('settings.manualMode'),
              desc: t('settings.manualModeDesc'),
            },
          ].map(m => (
            <div
              key={m.id}
              onClick={async () => {
                const newMode = m.id as AutofillMode;
                if (newMode === 'fast') {
                  await saveSettings({ autofillMode: 'fast', confirmationMode: 'high-confidence-direct' });
                  setSettings(prev => prev ? { ...prev, autofillMode: 'fast', confirmationMode: 'high-confidence-direct' } : null);
                  onSettingsChange();
                } else {
                  await updateSetting('autofillMode', newMode);
                }
              }}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                settings.autofillMode === m.id
                  ? 'bg-[#FFF8E8] dark:bg-[#321B3F] border-[#D4A72C] shadow-xs'
                  : 'bg-white dark:bg-[#2A1733]/50 border-[rgba(212,167,44,0.2)] hover:border-gold-500/50'
              }`}
            >
              <input
                type="radio"
                name="autofillMode"
                checked={settings.autofillMode === m.id}
                onChange={() => {}}
                className="mt-1 accent-[#5B2A86] w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-bold text-sm text-[#5B2A86] dark:text-[#F0CC63]">{m.title}</div>
                <div className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5 leading-relaxed">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Flight Confirmation Modal Control */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-2">
        <label className="sp-label text-sm font-bold text-[#5B2A86] dark:text-gold-300">{t('settings.preFlightModal')}</label>
        <p className="text-xs text-[#6B5A70] dark:text-[#A692B4]">
          {t('settings.preFlightModalDesc')}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => updateSetting('confirmationMode', 'high-confidence-direct')}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
              settings.confirmationMode === 'high-confidence-direct'
                ? 'bg-[#FFF8E8] dark:bg-[#321B3F] border-[#D4A72C] shadow-xs'
                : 'bg-white dark:bg-[#2A1733]/50 border-[rgba(212,167,44,0.2)] hover:border-gold-500/50'
            }`}
          >
            <div className="font-bold text-sm text-[#5B2A86] dark:text-[#F0CC63] flex items-center gap-1.5">
              <span>{t('settings.instantFill')}</span>
            </div>
            <div className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-1 leading-relaxed">
              {t('settings.instantFillDesc')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => updateSetting('confirmationMode', 'always-preview')}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
              settings.confirmationMode === 'always-preview'
                ? 'bg-[#FFF8E8] dark:bg-[#321B3F] border-[#D4A72C] shadow-xs'
                : 'bg-white dark:bg-[#2A1733]/50 border-[rgba(212,167,44,0.2)] hover:border-gold-500/50'
            }`}
          >
            <div className="font-bold text-sm text-[#5B2A86] dark:text-[#F0CC63] flex items-center gap-1.5">
              <span>{t('settings.safetyModal')}</span>
            </div>
            <div className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-1 leading-relaxed">
              {t('settings.safetyModalDesc')}
            </div>
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-1.5">
        <label className="sp-label text-sm font-bold text-[#5B2A86] dark:text-gold-300">{t('settings.language')}</label>
        <select
          value={settings.language}
          onChange={e => updateSetting('language', e.target.value as SettingsType['language'])}
          className="sp-input text-base font-serif"
        >
          <option value="en">English</option>
          <option value="te">తెలుగు</option>
          <option value="hi">हिन्दी</option>
          <option value="ta">தமிழ்</option>
          <option value="kn">ಕನ್ನಡ</option>
        </select>
      </div>

      {/* Theme: Temple Ivory vs Temple Night Mode */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-1.5">
        <label className="sp-label text-sm font-bold text-[#5B2A86] dark:text-gold-300">{t('settings.themeAesthetics')}</label>
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {[
            { id: 'light', label: t('settings.themeIvory') },
            { id: 'dark', label: t('settings.themeNight') },
            { id: 'system', label: t('settings.themeSystem') },
          ].map(th => (
            <button
              key={th.id}
              onClick={() => updateSetting('theme', th.id as any)}
              className={`min-h-[44px] py-2 px-2 rounded-xl text-sm font-semibold transition-all border cursor-pointer ${
                settings.theme === th.id
                  ? 'bg-[#5B2A86] text-white border-gold-500 shadow-xs'
                  : 'bg-cream/50 dark:bg-[#211526] text-[#6B5A70] dark:text-[#A692B4] border-gold-500/20 hover:border-gold-500/50'
              }`}
            >
              {th.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-3">
        <ToggleRow
          label={t('settings.floatingHelper')}
          description={t('settings.floatingHelperDesc')}
          checked={settings.floatingHelperEnabled}
          onChange={v => updateSetting('floatingHelperEnabled', v)}
        />
        <div className="flex justify-between items-center pt-1 border-t border-gold-500/10">
          <span className="text-xs text-[#6B5A70] dark:text-[#A692B4]">{t('settings.floatingPosition')}</span>
          <button
            onClick={handleResetFloatingPosition}
            className="text-xs font-semibold text-[#5B2A86] dark:text-[#F0CC63] underline cursor-pointer p-1"
          >
            {resetFloatStatus || t('settings.resetPosition')}
          </button>
        </div>
        <ToggleRow
          label={t('settings.autoFillOnDetect')}
          description={t('settings.autoFillOnDetectDesc')}
          checked={settings.autoFillOnDetect ?? false}
          onChange={v => updateSetting('autoFillOnDetect', v)}
        />
        <ToggleRow
          label={t('settings.autoScan')}
          description={t('settings.autoScanDesc')}
          checked={settings.autoScanEnabled}
          onChange={v => updateSetting('autoScanEnabled', v)}
        />
        <ToggleRow
          label={t('settings.maskSensitive')}
          description={t('settings.maskSensitiveDesc')}
          checked={settings.sensitivePreviewMasking}
          onChange={v => updateSetting('sensitivePreviewMasking', v)}
        />
        <ToggleRow
          label={t('settings.diagnosticsMode')}
          description={t('settings.diagnosticsModeDesc')}
          checked={settings.diagnosticsMode}
          onChange={v => updateSetting('diagnosticsMode', v)}
        />
      </div>

      {/* Shortcuts */}
      <div className="sp-card bg-cream/50 dark:bg-[#2D1A38] border-gold-500/25 space-y-2.5">
        <span className="sp-section-title text-sm">{t('settings.shortcuts')}</span>
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-[#6B5A70] dark:text-[#A692B4]">{t('settings.togglePanel')}</span>
          <kbd className="px-2.5 py-1 rounded-md bg-white dark:bg-[#211526] border border-gold-500/30 text-xs font-mono font-bold text-[#5B2A86] dark:text-gold-300 shadow-xs">
            Alt+Shift+S
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6B5A70] dark:text-[#A692B4]">{t('settings.triggerAutofill')}</span>
          <kbd className="px-2.5 py-1 rounded-md bg-white dark:bg-[#211526] border border-gold-500/30 text-xs font-mono font-bold text-[#5B2A86] dark:text-gold-300 shadow-xs">
            Alt+Shift+A
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6B5A70] dark:text-[#A692B4]">{t('settings.searchCommand')}</span>
          <kbd className="px-2.5 py-1 rounded-md bg-white dark:bg-[#211526] border border-gold-500/30 text-xs font-mono font-bold text-[#5B2A86] dark:text-gold-300 shadow-xs">
            Ctrl+K / ⌘K
          </kbd>
        </div>
      </div>

      {/* Reset & Version */}
      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-[#6B5A70] dark:text-[#A692B4]">
          <span className="font-bold text-[#5B2A86] dark:text-[#F8EFD8]">{t('settings.extensionVersion')}</span>
          <span className="font-mono font-medium text-[#6F6477] dark:text-[#D4C3E0]">Version {EXTENSION_VERSION} · Phase 2.3</span>
        </div>

        {showClearConfirm ? (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2">
            <h4 className="text-xs font-bold text-temple-red">{t('settings.clearDataModalTitle')}</h4>
            <p className="text-xs text-[#6F6477] dark:text-[#D4C3E0] font-medium leading-relaxed">{t('settings.clearConfirm')}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowClearConfirm(false)} className="sp-btn-secondary flex-1 min-h-[44px] text-xs py-1.5 px-3">
                {t('common.cancel')}
              </button>
              <button onClick={handleClearAll} className="sp-btn-danger flex-1 min-h-[44px] text-xs py-1.5 px-3">
                {t('settings.confirmClear')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs text-gray-400 hover:text-temple-red transition-colors cursor-pointer py-1"
          >
            {t('settings.clearDataTitle')}
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 pr-3">
        <p className="text-sm font-semibold text-[#321B3F] dark:text-[#F8EFD8]">{label}</p>
        <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] leading-relaxed mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
          checked ? 'bg-[#5B2A86] border-gold-500' : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white dark:bg-[#F8EFD8] shadow-sm transition-transform absolute top-0.5 ${
            checked ? 'translate-x-5.5 bg-gold-200' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
