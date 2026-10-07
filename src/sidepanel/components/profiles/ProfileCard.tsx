import React from 'react';
import { t } from '@i18n/index';
import type { Profile, Pilgrim } from '@shared/types';
import { calculateProfileHealth, checkPilgrimHealth } from '../../../services/profile-health';
import { getCanonicalService } from '@services/canonical-service-registry';
import { ServiceIntelligence } from '../../../services/service-intelligence';
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

function getServiceDisplayName(serviceId?: string): string {
  if (!serviceId) return 'Booking';
  const canonical = getCanonicalService(serviceId);
  if (canonical) return canonical.displayName;
  return 'Booking';
}

export interface ProfileCardProps {
  profile: Profile;
  isSelected: boolean;
  isExpanded: boolean;
  activeServiceId?: string;
  sensitivePreviewMasking?: boolean;
  onToggleExpand: () => void;
  onSetDefault: (profileId: string) => void;
  onPrintSlip: (profile: Profile) => void;
  onDuplicateProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onToggleSelectAll: (profile: Profile) => void;
  onTogglePilgrim?: (profileId: string, pilgrimId: string) => void;
  onAutoSelectPilgrims?: (profileId: string, pilgrimIds: string[]) => void;
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
  activeServiceId = 'special-entry-darshan-300',
  sensitivePreviewMasking = true,
  onToggleExpand,
  onSetDefault,
  onPrintSlip,
  onDuplicateProfile,
  onDeleteProfile,
  onToggleSelectAll,
  onTogglePilgrim,
  onAutoSelectPilgrims,
  onEditPilgrim,
  onDuplicatePilgrim,
  onDeletePilgrim,
  onAddPilgrim,
  showAddPilgrim,
  onSetShowAddPilgrim,
  onRefresh,
}: ProfileCardProps) {
  const serviceKey = activeServiceId || 'special-entry-darshan-300';
  const selectedList = profile.selectedPilgrims?.[serviceKey] ?? profile.selectedPilgrims?.['darshan'] ?? profile.pilgrims.map(p => p.id);
  const health = calculateProfileHealth(profile, false, serviceKey);
  const selectedPilgrimsList = profile.pilgrims.filter(p => selectedList.includes(p.id));
  const compatibility = ServiceIntelligence.checkCompatibility(profile, serviceKey, selectedPilgrimsList);
  const serviceRules = ServiceIntelligence.getRules(serviceKey);

  const isReady = health.total > 0 && health.incomplete === 0;
  const isActionRequired = health.total > 0 && health.incomplete > 0;
  const serviceName = getServiceDisplayName(serviceKey);

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

        {/* Profile Status Badge (Section 8: READY / ACTION REQUIRED / NOT READY) */}
        <div className="p-3 rounded-xl bg-cream/60 dark:bg-[#211526]/80 border border-gold-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isReady
                  ? 'bg-[#2F8F68]'
                  : isActionRequired
                  ? 'bg-[#C98A18]'
                  : 'bg-gray-400'
              }`}
            />
            <span className="font-bold text-xs text-[#30213A] dark:text-[#F8EFD8]">
              {isReady
                ? `Ready for ${serviceName} - all details verified`
                : isActionRequired
                ? `${health.incomplete} detail(s) need attention`
                : 'Add pilgrims to profile'}
            </span>
          </div>

          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isReady
                ? 'bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#A5D6A7]'
                : isActionRequired
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {isReady ? 'READY' : isActionRequired ? 'ACTION REQUIRED' : 'NOT READY'}
          </span>
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
          {/* Service Compatibility & Exact Limit Bar */}
          <div className="p-2.5 rounded-xl border border-gold-500/20 bg-cream/40 dark:bg-[#2A1733]/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[#5B2A86] dark:text-[#D4A72C]">
                  {serviceRules?.displayName || serviceName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gold-500/10 text-gold-700 dark:text-gold-300">
                  {serviceRules?.exactPilgrims
                    ? `Strictly ${serviceRules.exactPilgrims} pilgrims`
                    : `${serviceRules?.minPilgrims || 1}–${serviceRules?.maxPilgrims || 6} pilgrims`}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                compatibility.isCompatible
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {compatibility.isCompatible ? '✓ Compatible' : 'Limit / Requirements Alert'}
              </span>
            </div>

            {!compatibility.isCompatible && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gold-500/10 text-[11px]">
                <span className="text-amber-800 dark:text-amber-300 font-medium truncate">
                  {compatibility.countValidation.reason || compatibility.recommendations[0] || 'Requirements not met'}
                </span>
                {onAutoSelectPilgrims && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetIds = ServiceIntelligence.reconcilePilgrimSelection(profile, serviceKey);
                      onAutoSelectPilgrims(profile.id, targetIds);
                    }}
                    className="text-[10px] font-bold text-[#5B2A86] dark:text-[#D4A72C] underline hover:no-underline shrink-0 cursor-pointer"
                  >
                    Auto-select for {serviceRules?.exactPilgrims ? `${serviceRules.exactPilgrims} devotees` : 'service'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 bg-gold-50/60 dark:bg-[#321B3F]/50 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleSelectAll(profile)}
                className="font-semibold text-[#5B2A86] dark:text-[#F0CC63] underline cursor-pointer"
              >
                {(selectedList.length === profile.pilgrims.length && profile.pilgrims.length > 0)
                  ? t('profiles.deselectAll')
                  : t('profiles.selectAll')}
              </button>
              <span className="text-[#6B5A70] dark:text-[#A692B4]">
                {selectedList.length} / {profile.pilgrims.length} {t('profiles.selected')} ({serviceName})
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

          {profile.pilgrims.map((pilgrim, idx) => {
            const pilgrimHealth = checkPilgrimHealth(pilgrim, serviceKey);
            const isComplete = pilgrimHealth.isReady;
            const isPilgrimSelected = selectedList.includes(pilgrim.id);
            const missing = pilgrimHealth.missingFields.map(f => {
              if (f === 'fullName') return 'Name';
              if (f === 'idNumber') return 'ID Number';
              if (f === 'idType') return 'ID Proof';
              if (f === 'age') return 'Age';
              if (f === 'dateOfBirth') return 'Date of Birth';
              if (f === 'gender') return 'Gender';
              if (f === 'mobile') return 'Mobile';
              if (f === 'photo') return 'Photo';
              if (f === 'doorNumber') return 'Door Number';
              if (f === 'street') return 'Street';
              if (f === 'district') return 'District';
              if (f === 'pinCode') return 'PIN Code';
              return f;
            });

            return (
              <div key={pilgrim.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream/50 dark:bg-[#211526]/70 border border-gold-500/15">
                {/* Pilgrim Selection Checkbox */}
                {onTogglePilgrim && (
                  <input
                    type="checkbox"
                    checked={isPilgrimSelected}
                    onChange={() => onTogglePilgrim(profile.id, pilgrim.id)}
                    className="w-4 h-4 accent-[#5B2A86] rounded cursor-pointer shrink-0"
                    aria-label={`Select ${pilgrim.fullName || 'Pilgrim'} for ${serviceName}`}
                  />
                )}

                <div className="w-8 h-8 rounded-full bg-[#5B2A86]/10 dark:bg-gold-500/20 text-[#5B2A86] dark:text-gold-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {(pilgrim.firstName || pilgrim.fullName || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 shrink-0">
                      Slot {idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-[#321B3F] dark:text-[#F8EFD8] truncate">
                      {pilgrim.fullName || `${pilgrim.firstName} ${pilgrim.lastName}`}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isComplete
                        ? 'bg-[#E8F5E9] text-[#1B5E20] dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
                        : 'bg-[#FFF8E8] text-[#8D6E18] dark:bg-[#3D2F1B] dark:text-[#FFE082]'
                    }`}>
                      {isComplete ? '✓ Ready' : '⚠ Action required'}
                    </span>
                  </div>
                  {/* Sensitive Data Display with configurable masking */}
                  <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                    {pilgrim.gender} • Age {pilgrim.age || '—'} • {pilgrim.idType} ({sensitivePreviewMasking ? maskIdDisplay(pilgrim.idNumber) : (pilgrim.idNumber || '—')})
                    {pilgrim.mobile ? (
                      <span> • 📱 {sensitivePreviewMasking ? maskPhoneDisplay(pilgrim.mobile) : pilgrim.mobile}</span>
                    ) : (
                      <span className="text-[#6B5A70]/70 dark:text-[#A692B4]/70"> • 📱 Optional</span>
                    )}
                    {!isComplete && (
                      <span className="text-[#B3261E] dark:text-[#EF9A9A] ml-1">
                        (Missing: {missing.join(', ')})
                      </span>
                    )}
                  </p>

                  {/* Requirements Checklist */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs">
                    <span className={pilgrim.fullName?.trim() || pilgrim.firstName?.trim() ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.fullName?.trim() || pilgrim.firstName?.trim() ? '✓' : '✗'} Name
                    </span>
                    <span className={pilgrim.gender ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.gender ? '✓' : '✗'} Gender
                    </span>
                    <span className={pilgrim.age ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.age ? '✓' : '✗'} Age
                    </span>
                    {serviceKey.includes('srivari') && (
                      <span className={pilgrim.dateOfBirth ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                        {pilgrim.dateOfBirth ? '✓' : '✗'} DOB
                      </span>
                    )}
                    <span className={pilgrim.idType ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                      {pilgrim.idType ? '✓' : '✗'} ID Proof
                    </span>
                    <span className={pilgrimHealth.missingFields.includes('idNumber') ? 'text-rose-500 font-medium' : 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium'}>
                      {!pilgrimHealth.missingFields.includes('idNumber') ? '✓' : '✗'} ID Number
                    </span>
                    {serviceKey.includes('srivari') && (
                      <span className={pilgrim.photo ? 'text-[#1B5E20] dark:text-[#A5D6A7] font-medium' : 'text-rose-500 font-medium'}>
                        {pilgrim.photo ? '✓' : '✗'} Photo
                      </span>
                    )}
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

          {showAddPilgrim && (
            <QuickPilgrimForm
              onSave={(p) => onAddPilgrim(profile.id, p)}
              onCancel={() => onSetShowAddPilgrim(false)}
              targetServiceId={serviceKey}
            />
          )}

          {/* General Details Section */}
          <GeneralDetailsSection
            profile={profile}
            onUpdate={onRefresh}
            activeServiceId={serviceKey}
          />
        </div>
      )}
    </div>
  );
}
