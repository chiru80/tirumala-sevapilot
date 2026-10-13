import React, { useState } from 'react';
import { Card, Badge, Button, Icon } from '../../design-system';
import type { Profile, Pilgrim } from '@shared/types';
import { t } from '@i18n/index';
import { safeOpenUrl } from '../../../security/url-security';

export interface ManualEntryAssistantProps {
  serviceId: string;
  serviceDisplayName: string;
  activeProfile: Profile | null;
  selectedPilgrims: Pilgrim[];
  onOpenTtd?: () => void;
  onClose?: () => void;
  className?: string;
}

export const ManualEntryAssistant: React.FC<ManualEntryAssistantProps> = ({
  serviceId,
  serviceDisplayName,
  activeProfile,
  selectedPilgrims,
  onOpenTtd,
  onClose,
  className = '',
}) => {
  // Track revealed state for sensitive ID numbers (per pilgrim ID)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  // Track which pilgrims the user has checked off as entered
  const [completedPilgrims, setCompletedPilgrims] = useState<Record<string, boolean>>({});
  const [isGeneralCompleted, setIsGeneralCompleted] = useState<boolean>(false);

  const toggleReveal = (pilgrimId: string) => {
    setRevealedIds((prev) => ({
      ...prev,
      [pilgrimId]: !prev[pilgrimId],
    }));
  };

  const togglePilgrimCompleted = (pilgrimId: string) => {
    setCompletedPilgrims((prev) => ({
      ...prev,
      [pilgrimId]: !prev[pilgrimId],
    }));
  };

  const handleResetChecklist = () => {
    setCompletedPilgrims({});
    setIsGeneralCompleted(false);
  };

  const handleOpenTtd = () => {
    if (onOpenTtd) {
      onOpenTtd();
    } else {
      safeOpenUrl('https://ttdevasthanams.ap.gov.in/');
    }
  };

  const totalDevotees = selectedPilgrims.length;
  const completedCount = selectedPilgrims.filter((p) => completedPilgrims[p.id]).length;
  const general = activeProfile?.general;
  const hasGeneral = Boolean(general?.email || general?.city || general?.state || general?.pinCode);

  const maskIdNumber = (idNum?: string) => {
    if (!idNum) return '—';
    const clean = idNum.trim();
    if (clean.length <= 4) return clean;
    return `•••• •••• ${clean.slice(-4)}`;
  };

  return (
    <Card
      variant="default"
      padding="md"
      role="region"
      aria-label={t('manualEntry.ariaRegion') || 'Manual-Entry Assistant'}
      className={`border-2 border-[#D4A72C]/40 bg-gradient-to-b from-[#FAF7F2] to-white dark:from-[#26152F] dark:to-[#1E1028] space-y-3.5 shadow-sm ${className}`}
    >
      {/* ─── 1. Policy Compliance Header & TTD May 2026 Boundary Notice ─── */}
      <div className="space-y-2 border-b border-black/10 dark:border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D4A72C] animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#54258A] dark:text-[#D4A72C]">
              {t('manualEntry.title') || 'MANUAL-ENTRY ASSISTANT'}
            </h3>
          </div>
          <Badge variant="gold" size="sm">
            {t('manualEntry.policyBadge') || 'TTD POLICY COMPLIANT (MAY 2026)'}
          </Badge>
        </div>

        {/* Official Policy Boundary Disclosure */}
        <div
          role="note"
          className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1"
        >
          <div className="flex items-start gap-1.5 font-bold">
            <Icon name="shield" size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{t('manualEntry.policyNoticeTitle') || 'Zero Automation Policy Notice'}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            {t('manualEntry.policyBanner') ||
              "In accordance with TTD's May 2026 announcement, autofill and automated copy-paste mechanisms were abolished for Srivani bookings. SevaPilot provides this verified manual reference checklist so you can safely enter your details yourself without violating TTD anti-bot controls."}
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B5A70] dark:text-[#A692B4] pt-0.5">
          <span>
            {t('manualEntry.progress', { completed: completedCount, total: totalDevotees }) ||
              `Devotees entered: ${completedCount} / ${totalDevotees}`}
          </span>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleResetChecklist}
              className="text-[10px] font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
            >
              {t('manualEntry.resetChecklist') || 'Reset Checklist'}
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. Devotee-by-Devotee Field Instructions ─── */}
      <div className="space-y-3">
        {selectedPilgrims.map((pilgrim, idx) => {
          const isDone = Boolean(completedPilgrims[pilgrim.id]);
          const isRevealed = Boolean(revealedIds[pilgrim.id]);
          const name = (pilgrim.fullName || `${pilgrim.firstName || ''} ${pilgrim.lastName || ''}`).trim();

          return (
            <div
              key={pilgrim.id}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 opacity-85'
                  : 'bg-white dark:bg-[#2C1A35] border-black/10 dark:border-white/10'
              }`}
            >
              {/* Pilgrim Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] truncate">
                    {name}
                  </span>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-[#54258A] dark:text-[#D4A72C] select-none">
                  <input
                    id={`sp-manual-check-${pilgrim.id}`}
                    type="checkbox"
                    checked={isDone}
                    onChange={() => togglePilgrimCompleted(pilgrim.id)}
                    aria-label={`Mark devotee ${idx + 1} (${name}) as entered`}
                    className="w-4 h-4 rounded text-[#54258A] focus:ring-[#54258A] cursor-pointer"
                  />
                  <span>{isDone ? (t('manualEntry.entered') || 'Entered ✓') : (t('manualEntry.markEntered') || 'Mark entered')}</span>
                </label>
              </div>

              {/* Field Step Instructions */}
              <div className="space-y-2 pt-2 text-xs">
                {/* Step 1: Full Name */}
                <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-black/2 dark:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                      {t('manualEntry.stepName') || '1. Devotee Name'}
                    </span>
                    <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all">
                      {name}
                    </span>
                    <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                      {t('manualEntry.nameInstruction') || 'Type full name into TTD Name field exactly as printed on photo ID.'}
                    </p>
                  </div>
                </div>

                {/* Step 2: Age & Gender */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5">
                    <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                      {t('manualEntry.stepAge') || '2. Age'}
                    </span>
                    <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all">
                      {pilgrim.age ?? '—'}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5">
                    <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                      {t('manualEntry.stepGender') || '3. Gender'}
                    </span>
                    <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8]">
                      {pilgrim.gender ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Step 3: Photo ID Type & Number with Privacy Masking */}
                <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4]">
                      {t('manualEntry.stepId') || '4. Photo ID Proof'} ({pilgrim.idType || 'ID'})
                    </span>
                    <button
                      type="button"
                      id={`sp-manual-toggle-id-${pilgrim.id}`}
                      onClick={() => toggleReveal(pilgrim.id)}
                      aria-label={t('manualEntry.toggleIdMask') || 'Toggle ID number visibility'}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
                    >
                      <Icon name={isRevealed ? 'lock' : 'eye'} size={11} />
                      <span>{isRevealed ? (t('manualEntry.hideId') || 'Hide') : (t('manualEntry.showId') || 'Reveal digits')}</span>
                    </button>
                  </div>

                  <div className="font-mono font-semibold text-xs text-[#321B3F] dark:text-[#F8EFD8] select-all">
                    {isRevealed ? (pilgrim.idNumber || '—') : maskIdNumber(pilgrim.idNumber)}
                  </div>

                  <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4]">
                    {t('manualEntry.idInstruction') ||
                      'Select ID proof type from dropdown, then manually type ID number into TTD field.'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 3. General Details Checklist (If applicable) ─── */}
      {hasGeneral && (
        <div
          className={`p-3 rounded-xl border transition-all ${
            isGeneralCompleted
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 opacity-85'
              : 'bg-white dark:bg-[#2C1A35] border-black/10 dark:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
            <span className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
              {t('manualEntry.generalHeading') || 'General Contact & Address Details'}
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-[#54258A] dark:text-[#D4A72C] select-none">
              <input
                type="checkbox"
                checked={isGeneralCompleted}
                onChange={() => setIsGeneralCompleted((prev) => !prev)}
                aria-label="Mark general contact details as entered"
                className="w-4 h-4 rounded text-[#54258A] focus:ring-[#54258A] cursor-pointer"
              />
              <span>{isGeneralCompleted ? (t('manualEntry.entered') || 'Entered ✓') : (t('manualEntry.markEntered') || 'Mark entered')}</span>
            </label>
          </div>

          <div className="pt-2 space-y-1.5 text-xs">
            {general?.email && (
              <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5">
                <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                  {t('manualEntry.contactEmail') || 'Email'}
                </span>
                <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all">
                  {general.email}
                </span>
              </div>
            )}
            {(general?.city || general?.state || general?.pinCode) && (
              <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5">
                <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                  {t('manualEntry.address') || 'Address / City / State / Pincode'}
                </span>
                <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all">
                  {[general.city, general.state, general.pinCode].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. Safe Human Boundary Invariant ─── */}
      <div className="p-2.5 rounded-xl bg-black/3 dark:bg-white/5 text-[11px] text-[#6B5A70] dark:text-[#A692B4] space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-[#321B3F] dark:text-[#F8EFD8]">
          <Icon name="shield" size={12} className="text-[#54258A] dark:text-[#D4A72C]" />
          <span>{t('manualEntry.humanBoundaryHeading') || 'Human Safety Boundary'}</span>
        </div>
        <p className="leading-tight">
          {t('manualEntry.humanBoundaryReminder') ||
            'CAPTCHA challenge, mobile SMS OTP, declarations, and payments must always be completed manually by you on the TTD page. SevaPilot strictly never automates these steps.'}
        </p>
      </div>

      {/* ─── 5. Portal Navigation Action ─── */}
      <div className="pt-1 flex items-center justify-between gap-2">
        <Button
          variant="gold"
          size="md"
          fullWidth
          onClick={handleOpenTtd}
          aria-label="Open official TTD booking portal page"
        >
          <Icon name="external-link" size={14} className="mr-1.5" />
          {t('manualEntry.openTtd') || 'Open TTD Booking Page ↗'}
        </Button>
        {onClose && (
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            aria-label="Close manual assistant panel"
          >
            {t('manualEntry.close') || 'Close'}
          </Button>
        )}
      </div>
    </Card>
  );
};
