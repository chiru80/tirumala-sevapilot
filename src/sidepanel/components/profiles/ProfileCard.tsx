import React from 'react';
import { t } from '@i18n/index';
import type { Profile, Pilgrim } from '@shared/types';
import { calculateProfileHealth, checkPilgrimHealth } from '../../../services/profile-health';
import { maskIdDisplay } from './PilgrimEditor';
import { QuickPilgrimForm } from './QuickPilgrimForm';
import { GeneralDetailsSection } from './GeneralDetailsSection';

export function maskPhoneDisplay(val?: string): string {
  if (!val) return '—';
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `••••••${digits.slice(-4)}`;
  }
  return '••••';
}

export interface ProfileCardProps {
  profile: Profile;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetDefault: (profileId: string) => void;
  onPrintSlip: (profile: Profile) => void;
  onDuplicateProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onToggleSelectAll: (profile: Profile) => void;
  onEditPilgrim: (profileId: string, pilgrim: Pilgrim) => void;
  onDuplicatePilgrim: (profileId: string, pilgrimId: string) => void;
  onDeletePilgrim: (profileId: string, pilgrimId: string) => void;
  onAddPilgrim: (profileId: string, pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>) => void;
  showAddPilgrim: boolean;
  onSetShowAddPilgrim: (show: boolean) => void;
  onRefresh: () => void;
}

export function ProfileCard({
  profile,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSetDefault,
  onPrintSlip,
  onDuplicateProfile,
  onDeleteProfile,
  onToggleSelectAll,
  onEditPilgrim,
  onDuplicatePilgrim,
  onDeletePilgrim,
  onAddPilgrim,
  showAddPilgrim,
  onSetShowAddPilgrim,
  onRefresh,
}: ProfileCardProps) {
  const health = calculateProfileHealth(profile);

  return (
    <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 transition-all">
      <div className="space-y-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ttd-100 to-gold-100 dark:from-ttd-900/40 dark:to-gold-900/40 border border-gold-500/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-serif font-bold text-[#5B2A86] dark:text-gold-300">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-serif font-bold text-base text-[#321B3F] dark:text-[#F8EFD8]">{profile.name}</p>
                {isSelected && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-400 border border-gold-500/30">
                    {t('profiles.active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                {profile.pilgrims.length} {profile.pilgrims.length === 1 ? 'pilgrim' : 'pilgrims'}
                {profile.description ? ` • ${profile.description}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Print Profile Button */}
            <button
              onClick={() => onPrintSlip(profile)}
              className="p-2 rounded-lg hover:bg-gold-100/50 dark:hover:bg-gold-900/30 text-gold-700 dark:text-gold-400 transition-colors"
              title={t('profiles.printProfile')}
              aria-label={t('profiles.printProfile')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <path d="M6 14h12v8H6z"/>
              </svg>
            </button>

            {/* Duplicate Profile Button */}
            <button
              onClick={() => onDuplicateProfile(profile.id)}
              className="p-2 rounded-lg hover:bg-ttd-50 dark:hover:bg-ttd-900/30 text-[#6B5A70] hover:text-[#5B2A86] dark:text-gray-400 transition-colors"
              title={t('profiles.duplicateProfile')}
              aria-label={t('profiles.duplicateProfile')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>

            {/* Delete Profile Button */}
            <button
              onClick={() => onDeleteProfile(profile.id)}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-temple-red transition-colors"
              aria-label={t('profiles.deleteProfile')}
              title={t('profiles.deleteProfile')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Profile Health Progress Bar */}
        <div className="p-3 rounded-xl bg-cream/60 dark:bg-[#211526]/80 border border-gold-500/20 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#5B2A86] dark:text-gold-300">
                {health.percentage === 100 ? '✓ Ready for Special Entry' : `⚠ ${health.incomplete} need attention`}
              </span>
              {health.percentage === 100 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/30">
                  100% READY
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-sm text-[#321B3F] dark:text-[#F8EFD8]">{health.percentage}%</span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                health.percentage === 100
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                  : 'bg-gradient-to-r from-amber-500 to-gold-600'
              }`}
              style={{ width: `${health.percentage}%` }}
            />
          </div>

          {health.percentage === 100 ? (
            <p className="text-xs text-[#1B5E20] dark:text-[#A5D6A7] font-medium pt-0.5">
              All required details complete
            </p>
          ) : Object.keys(health.missingByField).length > 0 ? (
            <div className="text-xs text-[#8D6E18] dark:text-[#FFE082] pt-0.5 space-y-0.5">
              <span className="font-semibold">Missing: </span>
              {Object.entries(health.missingByField)
                .map(([field, count]) => {
                  const label = field === 'fullName' ? 'Name'
                    : field === 'idNumber' ? 'ID Number'
                    : field === 'idType' ? 'ID Proof'
                    : field === 'mobile' ? 'Mobile'
                    : field === 'age' ? 'Age'
                    : field === 'gender' ? 'Gender'
                    : field;
                  return `${label} (${count})`;
                })
                .join(', ')}
            </div>
          ) : null}
        </div>

        {/* Profile Card Actions: [Select] and [Edit] */}
        <div className="flex items-center gap-2 pt-1">
          {!isSelected ? (
            <button
              onClick={() => onSetDefault(profile.id)}
              className="sp-btn-secondary flex-1 min-h-[44px] text-sm"
            >
              {t('profiles.select')}
            </button>
          ) : (
            <div className="flex-1 text-center py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300/40">
              ✓ {t('profiles.selected')}
            </div>
          )}

          <button
            onClick={onToggleExpand}
            className="sp-btn-primary flex-1 min-h-[44px] text-sm flex items-center justify-center gap-1.5"
          >
            <span>{isExpanded ? t('profiles.hide') : t('common.edit')}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded: Pilgrim List & Management */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gold-500/10 dark:border-gold-500/5 space-y-2.5">
          <div className="flex items-center justify-between py-1.5 px-2 bg-gold-50/60 dark:bg-[#321B3F]/50 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleSelectAll(profile)}
                className="font-semibold text-[#5B2A86] dark:text-[#F0CC63] underline cursor-pointer"
              >
                {((profile.selectedPilgrims?.['darshan'] || []).length === profile.pilgrims.length && profile.pilgrims.length > 0)
                  ? t('profiles.deselectAll')
                  : t('profiles.selectAll')}
              </button>
              <span className="text-[#6B5A70] dark:text-[#A692B4]">
                {(profile.selectedPilgrims?.['darshan'] || profile.pilgrims.map(p => p.id)).length} / {profile.pilgrims.length} {t('profiles.selected')}
              </span>
            </div>

            {!profile.isDefault && (
              <button
                onClick={() => onSetDefault(profile.id)}
                className="text-gold-700 dark:text-gold-400 font-semibold hover:underline cursor-pointer"
              >
                Set as Default
              </button>
            )}
          </div>

          {profile.pilgrims.map(pilgrim => {
            const pilgrimHealth = checkPilgrimHealth(pilgrim);
            const isComplete = pilgrimHealth.isReady;
            const missing = pilgrimHealth.missingFields.map(f => {
              if (f === 'fullName') return 'Name';
              if (f === 'idNumber') return 'ID Number';
              if (f === 'idType') return 'ID Proof';
              if (f === 'age') return 'Age';
              if (f === 'gender') return 'Gender';
              return f;
            });

            return (
              <div key={pilgrim.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream/50 dark:bg-[#211526]/70 border border-gold-500/15">
                <div className="w-8 h-8 rounded-full bg-[#5B2A86]/10 dark:bg-gold-500/20 text-[#5B2A86] dark:text-gold-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {(pilgrim.firstName || pilgrim.fullName || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#321B3F] dark:text-[#F8EFD8] truncate">
                      {pilgrim.fullName || `${pilgrim.firstName} ${pilgrim.lastName}`}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isComplete
                        ? 'bg-[#E8F5E9] text-[#1B5E20] dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
                        : 'bg-[#FFF8E8] text-[#8D6E18] dark:bg-[#3D2F1B] dark:text-[#FFE082]'
                    }`}>
                      {isComplete ? '✓ 100% Ready' : '⚠ Incomplete'}
                    </span>
                  </div>
                  {/* Masked Sensitive Data Display */}
                  <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                    {pilgrim.gender} • Age {pilgrim.age || '—'} • {pilgrim.idType} ({maskIdDisplay(pilgrim.idNumber)})
                    {pilgrim.mobile ? (
                      <span> • 📱 {maskPhoneDisplay(pilgrim.mobile)}</span>
                    ) : (
                      <span className="text-[#6B5A70]/70 dark:text-[#A692B4]/70"> • 📱 Optional</span>
                    )}
                    {!isComplete && (
                      <span className="text-[#B3261E] dark:text-[#EF9A9A] ml-1">
                        (Missing: {missing.join(', ')})
                      </span>
                    )}
                  </p>

                  {/* 5 Core Requirements Checklist + Optional Contact */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs">
                    <span className={pilgrim.fullName?.trim() || pilgrim.firstName?.trim() ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.fullName?.trim() || pilgrim.firstName?.trim() ? '✓' : '✗'} Name
                    </span>
                    <span className={pilgrim.gender ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.gender ? '✓' : '✗'} Gender
                    </span>
                    <span className={pilgrim.age || pilgrim.dateOfBirth ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.age || pilgrim.dateOfBirth ? '✓' : '✗'} Age
                    </span>
                    <span className={pilgrim.idType ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.idType ? '✓' : '✗'} ID Proof
                    </span>
                    <span className={pilgrimHealth.missingFields.includes('idNumber') ? 'text-rose-500 font-medium' : 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium'}>
                      {!pilgrimHealth.missingFields.includes('idNumber') ? '✓' : '✗'} ID Number
                    </span>
                    <span className="text-[#6B5A70] dark:text-[#A692B4]">
                      {pilgrim.mobile ? '✓ Mobile' : '○ Mobile — Optional'}
                    </span>
                    <span className="text-[#6B5A70] dark:text-[#A692B4]">
                      {pilgrim.email ? '✓ Email' : '○ Email — Optional'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Edit Pilgrim Button */}
                  <button
                    onClick={e => { e.stopPropagation(); onEditPilgrim(profile.id, { ...pilgrim }); }}
                    className="p-1.5 rounded-lg hover:bg-gold-100/50 dark:hover:bg-gold-900/30 text-gold-700 dark:text-gold-400 transition-colors"
                    title={t('profiles.editPilgrim')}
                    aria-label={`Edit ${pilgrim.fullName || 'Pilgrim'}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>

                  {/* Duplicate Pilgrim Button */}
                  <button
                    onClick={e => { e.stopPropagation(); onDuplicatePilgrim(profile.id, pilgrim.id); }}
                    className="p-1.5 rounded-lg hover:bg-ttd-50 dark:hover:bg-ttd-900/30 text-[#6B5A70] hover:text-[#5B2A86] dark:text-gray-400 transition-colors"
                    title={t('profiles.duplicatePilgrim')}
                    aria-label="Duplicate Pilgrim"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </button>

                  {/* Delete Pilgrim Button */}
                  <button
                    onClick={e => { e.stopPropagation(); onDeletePilgrim(profile.id, pilgrim.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-temple-red transition-colors"
                    title={t('profiles.deletePilgrim')}
                    aria-label="Delete Pilgrim"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {profile.pilgrims.length === 0 && (
            <p className="text-sm text-[#8B7D8F] text-center py-2">{t('profiles.noPilgrims')}</p>
          )}

          <button
            onClick={() => onSetShowAddPilgrim(true)}
            className="sp-btn-secondary w-full min-h-[44px] text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4"/></svg>
            <span>{t('profiles.addPilgrim')}</span>
          </button>

          {/* Quick Add Pilgrim Form */}
          {showAddPilgrim && (
            <QuickPilgrimForm
              onSave={(pilgrim) => onAddPilgrim(profile.id, pilgrim)}
              onCancel={() => onSetShowAddPilgrim(false)}
            />
          )}

          {/* Step 2 General Details Section (Email, City, State, Country, Pincode) */}
          <GeneralDetailsSection profile={profile} onUpdate={onRefresh} />
        </div>
      )}
    </div>
  );
}
