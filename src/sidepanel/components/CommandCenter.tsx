import React, { useState, useEffect, useRef } from 'react';
import type { Profile } from '@shared/types';
import { t } from '@i18n/index';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  onNavigate: (tab: string) => void;
  onTriggerAutofill: () => void;
  onScanPage: () => void;
}

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  action: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  isOpen,
  onClose,
  profiles,
  onSelectProfile,
  onNavigate,
  onTriggerAutofill,
  onScanPage,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build searchable items
  const allItems: CommandItem[] = [
    // Actions
    {
      id: 'act-autofill',
      category: t('dashboard.action'),
      title: t('commandCenter.quickAutofill'),
      subtitle: t('commandCenter.quickAutofillDesc'),
      action: () => { onTriggerAutofill(); onClose(); },
    },
    {
      id: 'act-scan',
      category: t('dashboard.action'),
      title: t('commandCenter.rescan'),
      subtitle: t('commandCenter.rescanDesc'),
      action: () => { onScanPage(); onClose(); },
    },
    // Navigation
    {
      id: 'nav-dashboard',
      category: t('nav.dashboard'),
      title: t('commandCenter.dashboardWorkspace'),
      subtitle: t('commandCenter.dashboardWorkspaceDesc'),
      action: () => { onNavigate('dashboard'); onClose(); },
    },
    {
      id: 'nav-profiles',
      category: t('nav.profiles'),
      title: t('commandCenter.pilgrimsProfiles'),
      subtitle: t('commandCenter.pilgrimsProfilesDesc'),
      action: () => { onNavigate('profiles'); onClose(); },
    },
    {
      id: 'nav-validation',
      category: t('nav.validation'),
      title: t('commandCenter.validationReadiness'),
      subtitle: t('commandCenter.validationReadinessDesc'),
      action: () => { onNavigate('validation'); onClose(); },
    },
    {
      id: 'nav-documents',
      category: t('nav.documents'),
      title: t('commandCenter.documentVault'),
      subtitle: t('commandCenter.documentVaultDesc'),
      action: () => { onNavigate('documents'); onClose(); },
    },
    {
      id: 'nav-backup',
      category: t('nav.backup'),
      title: t('commandCenter.backupRestore'),
      subtitle: t('commandCenter.backupRestoreDesc'),
      action: () => { onNavigate('backup'); onClose(); },
    },
    {
      id: 'nav-settings',
      category: t('nav.settings'),
      title: t('commandCenter.settingsTitle'),
      subtitle: t('settings.shortcuts'),
      action: () => { onNavigate('settings'); onClose(); },
    },
  ];

  // Add profiles and devotees
  for (const p of profiles) {
    allItems.push({
      id: `group-${p.id}`,
      category: t('profiles.title'),
      title: `${p.name}`,
      subtitle: `${p.pilgrims?.length || 0} devotees • ${p.isDefault ? t('profiles.active') : ''}`,
      action: () => { onSelectProfile(p); onNavigate('dashboard'); onClose(); },
    });

    for (const pil of p.pilgrims || []) {
      allItems.push({
        id: `pilgrim-${pil.id}`,
        category: t('pilgrim.fullName'),
        title: pil.fullName || `${pil.firstName || ''} ${pil.lastName || ''}`,
        subtitle: `${pil.gender}, ${pil.age || '—'} • ${pil.idType} (${p.name})`,
        action: () => { onSelectProfile(p); onNavigate('profiles'); onClose(); },
      });
    }
  }

  const q = query.toLowerCase().trim();
  const filtered = q
    ? allItems.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    : allItems.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-[#321B3F]/60 backdrop-blur-xs flex items-start justify-center pt-16 p-4">
      <div className="bg-[#FFFDF7] dark:bg-[#211526] border-2 border-[#D4A72C] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Search input bar */}
        <div className="p-3.5 bg-[#FFF8E8] dark:bg-[#2A1733] border-b border-[rgba(212,167,44,0.3)] flex items-center gap-2.5">
          <span className="text-[#5B2A86] dark:text-[#D4A72C] text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('commandCenter.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#321B3F] dark:text-[#FFF8E8] placeholder-[#8B7D8F] focus:outline-hidden font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-[#8B7D8F] hover:text-[#321B3F] cursor-pointer p-1"
            >
              ✕
            </button>
          )}
          <kbd className="px-2 py-0.5 text-xs font-mono bg-[#FFFDF7] dark:bg-[#321B3F] border border-[rgba(212,167,44,0.4)] rounded text-[#6B5A70] dark:text-[#A898B0]">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-72 overflow-y-auto p-2.5 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#8B7D8F]">
              {t('commandCenter.noResults')}
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full text-left p-2.5 rounded-xl hover:bg-[#FFF8E8] dark:hover:bg-[#321B3F]/60 transition-colors flex items-center justify-between group cursor-pointer border border-transparent hover:border-[rgba(212,167,44,0.3)] min-h-[44px]"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#321B3F] dark:text-[#FFF8E8] truncate group-hover:text-[#5B2A86] dark:group-hover:text-[#F0CC63]">
                      {item.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold bg-[#E5D7B7]/50 dark:bg-[#4A2D5E] text-[#6B5A70] dark:text-[#E5D7B7]">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-xs text-[#6F6477] dark:text-[#A898B0] truncate mt-0.5">
                    {item.subtitle}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#D4A72C] opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
