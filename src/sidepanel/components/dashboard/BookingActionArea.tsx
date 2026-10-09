import React, { useState } from 'react';
import { Card, Badge, Button, Icon } from '../../design-system';
import type { Profile, Pilgrim } from '@shared/types';
import type { ProfileReadinessReport, PilgrimValidationItem } from '../../presentation/profile-readiness-tester';
import { t } from '@i18n/index';

export interface BookingActionAreaProps {
  // Service Context
  serviceDisplayName: string;
  ticketPrice?: number;
  maxPilgrims?: number;
  isUnknownService?: boolean;
  onOpenServiceSelector: () => void;

  // Profiles
  profiles: Profile[];
  activeProfile: Profile | null;
  selectedPilgrims: Pilgrim[];
  onSelectProfile: (profileId: string) => Promise<void> | void;
  onManageProfiles: () => void;
  onCreateProfile?: () => void;

  // Readiness
  readinessReport: ProfileReadinessReport;
  pageDetected: boolean;
  isFilling: boolean;
  fillStage?: { stage: string; currentField?: string; currentPilgrim?: number };

  // Actions
  onPrimaryFill: () => void;
  onEmergencyStop: () => void;
  onOpenTtdPortal: () => void;
  onEditProfile?: () => void;

  className?: string;
}

export const BookingActionArea: React.FC<BookingActionAreaProps> = ({
  serviceDisplayName,
  ticketPrice,
  maxPilgrims = 6,
  isUnknownService = false,
  onOpenServiceSelector,
  profiles,
  activeProfile,
  selectedPilgrims,
  onSelectProfile,
  onManageProfiles,
  onCreateProfile,
  readinessReport,
  pageDetected,
  isFilling,
  onPrimaryFill,
  onEmergencyStop,
  onOpenTtdPortal,
  onEditProfile,
  className = '',
}) => {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const selectedCount = selectedPilgrims.length;
  const isReady = readinessReport.isReady;

  return (
    <Card
      variant="default"
      padding="md"
      role="region"
      aria-label={t('bookingWorkflow.ariaRegion') || 'Booking Workflow'}
      className={`relative overflow-hidden border-2 space-y-3.5 transition-all duration-200 motion-reduce:transition-none ${
        isReady
          ? 'border-emerald-500/40 bg-gradient-to-b from-white to-emerald-50/15 dark:from-[#2C1A35] dark:to-[#172E22]/20'
          : 'border-[#54258A]/30 dark:border-[#D4A72C]/40 bg-white dark:bg-[#2C1A35]'
      } ${className}`}
    >
      {/* ─── 1. Selected Service & Active Profile Prominent Banner ─── */}
      <div className="space-y-2 border-b border-black/5 dark:border-white/10 pb-3">
        {/* Service Header Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#54258A] dark:text-[#D4A72C] shrink-0">
              {t('bookingWorkflow.service') || 'SERVICE'}:
            </span>
            <button
              type="button"
              onClick={onOpenServiceSelector}
              aria-label={t('bookingWorkflow.changeServiceA11y', { name: serviceDisplayName }) || `Change service: ${serviceDisplayName}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] hover:text-[#54258A] dark:hover:text-[#D4A72C] transition-colors truncate cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-[#54258A] rounded-md px-1 py-0.5"
            >
              <span className="truncate max-w-[190px]">{serviceDisplayName}</span>
              <Icon name="chevron-down" size={13} className="shrink-0 text-[#6B5A70] dark:text-[#A692B4]" />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {typeof ticketPrice === 'number' && ticketPrice > 0 ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#54258A]/10 dark:bg-[#D4A72C]/20 text-[#54258A] dark:text-[#D4A72C]">
                ₹{ticketPrice}
              </span>
            ) : isUnknownService ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                {t('bookingWorkflow.unspecifiedService') || 'Generic Mode'}
              </span>
            ) : null}

            <span className="text-[10px] font-semibold text-[#6B5A70] dark:text-[#A692B4] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
              {t('bookingWorkflow.maxDevotees', { count: maxPilgrims }) || `Max ${maxPilgrims}`}
            </span>
          </div>
        </div>

        {/* Profile Switcher Row */}
        <div className="flex items-center justify-between gap-2 bg-[#F9F7F4] dark:bg-[#24132D] p-2 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon name="users" size={16} className="text-[#54258A] dark:text-[#D4A72C] shrink-0" />
            <div className="min-w-0 flex-1">
              <label htmlFor="sp-profile-select-dropdown" className="block text-[10px] font-bold uppercase tracking-wider text-[#6B5A70] dark:text-[#A692B4]">
                {t('bookingWorkflow.activeProfile') || 'Active Profile'}
              </label>
              {profiles.length > 0 ? (
                <select
                  id="sp-profile-select-dropdown"
                  value={activeProfile?.id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id === '__new__') {
                      onCreateProfile ? onCreateProfile() : onManageProfiles();
                    } else if (id) {
                      onSelectProfile(id);
                    }
                  }}
                  className="w-full text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer truncate"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id} className="text-[#321B3F] dark:bg-[#2C1A35] dark:text-[#F8EFD8]">
                      {p.name} ({p.pilgrims?.length || 0} Devotees)
                    </option>
                  ))}
                  <option value="__new__" className="text-[#54258A] dark:text-[#D4A72C] font-semibold">
                    + {t('bookingWorkflow.createNewProfile') || 'Create New Profile'}
                  </option>
                </select>
              ) : (
                <button
                  type="button"
                  onClick={onManageProfiles}
                  className="text-xs font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
                >
                  {t('bookingWorkflow.createProfilePrompt') || 'Create a profile to begin'}
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onManageProfiles}
            aria-label={t('bookingWorkflow.manageProfilesA11y') || 'Manage all profiles'}
            className="text-[11px] font-semibold text-[#54258A] dark:text-[#D4A72C] hover:underline px-2 py-1 rounded-md shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#54258A]"
          >
            {t('bookingWorkflow.manage') || 'Manage'}
          </button>
        </div>
      </div>

      {/* ─── 2. Concise Readiness Summary Callout ─── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={isReady ? 'ready' : 'actionRequired'} showDot size="sm">
            {readinessReport.headline}
          </Badge>

          <span className="text-[11px] font-semibold text-[#6B5A70] dark:text-[#A692B4]">
            {t('bookingWorkflow.devoteesSelected', { selected: selectedCount, max: maxPilgrims }) ||
              `${selectedCount} / ${maxPilgrims} Selected`}
          </span>
        </div>

        <p className="text-xs text-[#6B5A70] dark:text-[#C5B4D4] font-medium leading-relaxed">
          {readinessReport.summary}
        </p>

        {/* Unknown service safety indicator */}
        {isUnknownService && (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Icon name="shield" size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {t('bookingWorkflow.unknownServiceSafetyText') ||
                'Safe generic mode active: Baseline devotee fields validated without assuming ₹300 Special Entry requirements.'}
            </span>
          </div>
        )}

        {/* Missing fields list if any */}
        {readinessReport.missingItems && readinessReport.missingItems.length > 0 && (
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 flex items-center gap-1.5 flex-wrap">
            <Icon name="alert-triangle" size={13} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-semibold">{t('bookingWorkflow.missing') || 'Missing'}:</span>
            <span>{readinessReport.missingItems.join(', ')}</span>
          </div>
        )}
      </div>

      {/* ─── 3. 4 Core Action Buttons ─── */}
      <div className="space-y-2 pt-1">
        {/* Dominant Primary Action CTA */}
        {isFilling ? (
          <Button
            id="sp-booking-emergency-stop-btn"
            variant="danger"
            size="lg"
            fullWidth
            onClick={onEmergencyStop}
            className="shadow-sm"
          >
            <Icon name="x" size={16} className="mr-1.5" />
            {t('bookingWorkflow.stopAutofill') || 'Stop Autofill'}
          </Button>
        ) : !pageDetected ? (
          <Button
            id="sp-booking-open-ttd-btn"
            variant="gold"
            size="lg"
            fullWidth
            onClick={onOpenTtdPortal}
            className="shadow-sm"
          >
            <Icon name="external-link" size={15} className="mr-1.5" />
            {t('bookingWorkflow.openTtdPortal') || 'Open Official TTD Portal ↗'}
          </Button>
        ) : (
          <Button
            id="sp-booking-fill-details-btn"
            variant={isReady ? 'primary' : 'gold'}
            size="lg"
            fullWidth
            onClick={onPrimaryFill}
            disabled={!activeProfile || selectedCount === 0}
            className="shadow-md"
          >
            <Icon name="sparkles" size={16} className="mr-1.5" />
            {isReady
              ? (t('bookingWorkflow.fillDetails') || '⚡ Fill Details on TTD Page')
              : (t('bookingWorkflow.fillAvailable') || 'Fill Available Details')}
          </Button>
        )}

        {/* Secondary Workflow Action Row (Review Fields, Select Profile, Save/Edit Profile) */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Review Fields Toggle Button */}
          <button
            type="button"
            id="sp-review-fields-toggle-btn"
            onClick={() => setIsReviewOpen((prev) => !prev)}
            aria-expanded={isReviewOpen}
            aria-controls="sp-devotees-review-panel"
            className={`
              inline-flex items-center justify-center gap-1.5
              min-h-[38px] px-2.5 py-1.5 rounded-xl border
              text-xs font-bold transition-all cursor-pointer select-none
              ${
                isReviewOpen
                  ? 'bg-[#54258A]/10 dark:bg-[#D4A72C]/20 border-[#54258A]/40 dark:border-[#D4A72C]/50 text-[#54258A] dark:text-[#D4A72C]'
                  : 'bg-white dark:bg-[#24132D] border-black/10 dark:border-white/10 text-[#321B3F] dark:text-[#F8EFD8] hover:bg-black/5 dark:hover:bg-white/5'
              }
              focus-visible:ring-2 focus-visible:ring-[#54258A] dark:focus-visible:ring-[#D4A72C]
            `}
          >
            <Icon name="users" size={14} />
            <span>
              {isReviewOpen
                ? (t('bookingWorkflow.hideFields') || 'Hide Fields')
                : (t('bookingWorkflow.reviewFields', { count: selectedCount }) || `Review Fields (${selectedCount})`)}
            </span>
            <Icon
              name="chevron-down"
              size={12}
              className={`opacity-70 transition-transform ${isReviewOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Save / Edit Profile Button */}
          <button
            type="button"
            id="sp-save-edit-profile-btn"
            onClick={() => (onEditProfile ? onEditProfile() : onManageProfiles())}
            className="
              inline-flex items-center justify-center gap-1.5
              min-h-[38px] px-2.5 py-1.5 rounded-xl border
              bg-white dark:bg-[#24132D] border-black/10 dark:border-white/10
              text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]
              hover:bg-black/5 dark:hover:bg-white/5 transition-all
              cursor-pointer select-none
              focus-visible:ring-2 focus-visible:ring-[#54258A] dark:focus-visible:ring-[#D4A72C]
            "
          >
            <Icon name="settings" size={13} />
            <span>{t('bookingWorkflow.editProfile') || 'Edit Profile'}</span>
          </button>
        </div>
      </div>

      {/* ─── 4. Collapsible Per-Pilgrim Fields & Validation Review Panel ─── */}
      {isReviewOpen && (
        <div
          id="sp-devotees-review-panel"
          className="space-y-2.5 pt-2 border-t border-black/5 dark:border-white/10 animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
            <span>{t('bookingWorkflow.devoteeFieldValidation') || 'Devotee Validation Status'}</span>
            <span className="text-[10px] font-semibold text-[#6B5A70] dark:text-[#A692B4]">
              {readinessReport.passedChecks} / {readinessReport.totalChecks} {t('bookingWorkflow.checksPassed') || 'checks'}
            </span>
          </div>

          {readinessReport.pilgrimValidationItems && readinessReport.pilgrimValidationItems.length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
              {readinessReport.pilgrimValidationItems.map((item: PilgrimValidationItem) => (
                <div
                  key={item.pilgrimId || item.pilgrimIndex}
                  className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                    item.isValid
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'
                      : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/30 text-rose-900 dark:text-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold truncate">
                      {item.pilgrimIndex + 1}. {item.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        item.isValid
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      {item.isValid ? '✓ Valid' : '⚠️ Action Needed'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#6B5A70] dark:text-[#C5B4D4] flex items-center gap-2 flex-wrap">
                    <span>{item.gender || '—'}</span>
                    <span>•</span>
                    <span>Age {item.age || '—'}</span>
                    <span>•</span>
                    <span>{item.idType || 'ID'}: {item.idNumberMasked}</span>
                  </div>

                  {item.errors && item.errors.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 pt-1 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                      {item.errors.map((err: string, errIdx: number) => (
                        <li key={errIdx} className="leading-tight">{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-[#6B5A70] dark:text-[#A692B4] rounded-xl bg-black/5 dark:bg-white/5">
              {t('bookingWorkflow.noDevoteesSelected') || 'No devotees selected in this profile.'}
            </div>
          )}
        </div>
      )}

      {/* ─── 5. Human Boundary Invariant Guarantee ─── */}
      <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[#6B5A70] dark:text-[#A692B4] text-center">
        <Icon name="shield" size={12} className="text-[#54258A] dark:text-[#D4A72C] shrink-0" />
        <span>
          {t('safety.safeAssistanceDesc') ||
            'Zero synthetic requests. CAPTCHA, OTP, and payments remain strictly manual.'}
        </span>
      </div>
    </Card>
  );
};
