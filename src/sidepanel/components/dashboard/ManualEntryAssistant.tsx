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

export type PasteAssistViewMode = 'focused' | 'checklist';

export const ManualEntryAssistant: React.FC<ManualEntryAssistantProps> = ({
  serviceId,
  serviceDisplayName,
  activeProfile,
  selectedPilgrims,
  onOpenTtd,
  onClose,
  className = '',
}) => {
  // Srivani restriction: Keep Srivani manual-only; do NOT implement copy-paste assist for Srivani
  const isSrivani =
    serviceId === 'srivani' ||
    serviceId === 'srivani-trust' ||
    serviceId === 'sri-vani' ||
    serviceId.toLowerCase().includes('srivani');

  // View mode: 'focused' (one field at a time) or 'checklist' (full list)
  const [viewMode, setViewMode] = useState<PasteAssistViewMode>('focused');
  // Focused step navigation: current pilgrim index & current field step (0: Name, 1: Age, 2: Gender, 3: ID Proof, 4: ID Number)
  const [focusedPilgrimIdx, setFocusedPilgrimIdx] = useState<number>(0);
  const [focusedFieldStep, setFocusedFieldStep] = useState<number>(0);

  // Track revealed state for sensitive ID numbers (per pilgrim ID)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  // Track which pilgrims the user has checked off as entered
  const [completedPilgrims, setCompletedPilgrims] = useState<Record<string, boolean>>({});
  const [collapsedPilgrims, setCollapsedPilgrims] = useState<Record<string, boolean>>({});
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);
  const [isGeneralCompleted, setIsGeneralCompleted] = useState<boolean>(false);
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({});

  const handleCopy = async (key: string, textToCopy?: string) => {
    // Srivani manual-only enforcement: NEVER copy to clipboard for Srivani
    if (isSrivani || !textToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedFields((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedFields((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {
      // Gracefully ignore clipboard failures
    }
  };

  const toggleReveal = (pilgrimId: string) => {
    setRevealedIds((prev) => ({
      ...prev,
      [pilgrimId]: !prev[pilgrimId],
    }));
  };

  const toggleCollapse = (pilgrimId: string) => {
    setCollapsedPilgrims((prev) => ({
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
    setCollapsedPilgrims({});
    setFilterPendingOnly(false);
    setIsGeneralCompleted(false);
    setFocusedPilgrimIdx(0);
    setFocusedFieldStep(0);
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
  const pendingCount = totalDevotees - completedCount;
  const general = activeProfile?.general;
  const hasGeneral = Boolean(general?.email || general?.city || general?.state || general?.pinCode);

  const displayedPilgrims = filterPendingOnly
    ? selectedPilgrims.filter((p) => !completedPilgrims[p.id])
    : selectedPilgrims;

  const currentFocusedPilgrim = selectedPilgrims[focusedPilgrimIdx] || selectedPilgrims[0];

  const maskIdNumber = (idNum?: string) => {
    if (!idNum) return '—';
    const clean = idNum.trim();
    if (clean.length <= 4) return clean;
    return `•••• •••• ${clean.slice(-4)}`;
  };

  // Field steps definition for Focused Mode
  const fieldSteps = [
    { key: 'name', label: 'Devotee Full Name', stepNumber: 1 },
    { key: 'age', label: 'Age', stepNumber: 2 },
    { key: 'gender', label: 'Gender', stepNumber: 3 },
    { key: 'idType', label: 'Photo ID Proof Type', stepNumber: 4 },
    { key: 'idNumber', label: 'Photo ID Number', stepNumber: 5 },
  ];

  const handleNextStep = () => {
    if (focusedFieldStep < fieldSteps.length - 1) {
      setFocusedFieldStep((prev) => prev + 1);
    } else if (focusedPilgrimIdx < totalDevotees - 1) {
      setFocusedPilgrimIdx((prev) => prev + 1);
      setFocusedFieldStep(0);
    }
  };

  const handlePrevStep = () => {
    if (focusedFieldStep > 0) {
      setFocusedFieldStep((prev) => prev - 1);
    } else if (focusedPilgrimIdx > 0) {
      setFocusedPilgrimIdx((prev) => prev - 1);
      setFocusedFieldStep(fieldSteps.length - 1);
    }
  };

  return (
    <Card
      variant="default"
      padding="md"
      role="region"
      aria-label={t('manualEntry.ariaRegion') || 'Manual-Entry Assistant'}
      className={`border-2 border-[#D4A72C]/40 bg-gradient-to-b from-[#FAF7F2] to-white dark:from-[#26152F] dark:to-[#1E1028] space-y-3.5 shadow-sm ${className}`}
    >
      {/* ─── 1. Policy Compliance Header & Boundaries ─── */}
      <div className="space-y-2 border-b border-black/10 dark:border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D4A72C] animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#54258A] dark:text-[#D4A72C]">
              {isSrivani
                ? (t('manualEntry.srivaniTitle') || 'MANUAL-ENTRY CHECKLIST (SRIVANI RESTRICTION)')
                : (t('manualEntry.title') || 'PASTE ASSIST / MANUAL-ENTRY')}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {!isSrivani && (
              <div className="inline-flex rounded-lg border border-black/10 dark:border-white/10 p-0.5 bg-black/5 dark:bg-white/5">
                <button
                  type="button"
                  id="sp-mode-focused-btn"
                  onClick={() => setViewMode('focused')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                    viewMode === 'focused'
                      ? 'bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35] shadow-xs'
                      : 'text-[#6B5A70] dark:text-[#A692B4] hover:text-black dark:hover:text-white'
                  }`}
                >
                  One Field at a Time
                </button>
                <button
                  type="button"
                  id="sp-mode-checklist-btn"
                  onClick={() => setViewMode('checklist')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                    viewMode === 'checklist'
                      ? 'bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35] shadow-xs'
                      : 'text-[#6B5A70] dark:text-[#A692B4] hover:text-black dark:hover:text-white'
                  }`}
                >
                  Full Checklist
                </button>
              </div>
            )}
            <Badge variant={isSrivani ? 'blocked' : 'gold'} size="sm">
              {isSrivani ? 'SRIVANI MANUAL-ONLY' : 'USER-MEDIATED PASTE ASSIST'}
            </Badge>
          </div>
        </div>

        {/* Official Policy Boundary Disclosure */}
        <div
          role="note"
          className={`p-2.5 rounded-xl border text-xs space-y-1 ${
            isSrivani
              ? 'bg-rose-500/10 dark:bg-rose-400/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
              : 'bg-amber-500/10 dark:bg-amber-400/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-1.5 font-bold">
            <Icon name="shield" size={14} className={`shrink-0 mt-0.5 ${isSrivani ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
            <span>
              {isSrivani
                ? 'Srivani Trust Darshan Restriction: Manual Typing Only'
                : (t('manualEntry.policyNoticeTitle') || 'Zero Automation Policy & User-Mediated Paste Assist')}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {isSrivani
              ? 'TTD policy strictly prohibits automated autofill and copy-paste assistance for SRIVANI Trust Darshan. You must type devotee details manually into official website fields. Clipboard copy actions are disabled.'
              : (t('manualEntry.policyBanner') ||
                'Use these explicit copy-to-clipboard actions and field guidance to enter devotee details directly into official TTD controls. Keep Age entry and dropdown selections under your direct control.')}
          </p>
        </div>

        {/* All Completed Banner */}
        {completedCount === totalDevotees && totalDevotees > 0 && (
          <div id="sp-manual-all-completed-banner" className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Icon name="check" size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {t('manualEntry.allCompletedBanner') ||
                'ALL DEVOTEES ENTERED! Proceed with manual CAPTCHA, OTP, and payment submission on TTD.'}
            </span>
          </div>
        )}

        {/* Progress Tracker */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B5A70] dark:text-[#A692B4] pt-0.5 flex-wrap gap-2">
          <span>
            {t('manualEntry.progress', { completed: completedCount, total: totalDevotees }) ||
              `Devotees entered: ${completedCount} / ${totalDevotees}`}
          </span>
          <div className="flex items-center gap-2">
            {viewMode === 'checklist' && completedCount > 0 && completedCount < totalDevotees && (
              <button
                type="button"
                id="sp-manual-filter-pending-btn"
                onClick={() => setFilterPendingOnly((prev) => !prev)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#54258A]/30 dark:border-[#D4A72C]/40 text-[#54258A] dark:text-[#D4A72C] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                {filterPendingOnly
                  ? (t('manualEntry.showAll') || `Show All (${totalDevotees})`)
                  : (t('manualEntry.showPendingOnly') || `Pending Only (${pendingCount})`)}
              </button>
            )}
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
      </div>

      {/* ─── 2. Focused One-Field-at-a-Time Mode (User-Mediated Paste Assist) ─── */}
      {!isSrivani && viewMode === 'focused' && currentFocusedPilgrim && (
        <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#2C1A35] space-y-3">
          {/* Pilgrim Navigation Bar */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35] flex items-center justify-center text-[10px] font-bold">
                {focusedPilgrimIdx + 1}
              </span>
              <span className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                Devotee {focusedPilgrimIdx + 1} of {totalDevotees}
              </span>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-[#54258A] dark:text-[#D4A72C] select-none">
              <input
                id={`sp-focused-check-${currentFocusedPilgrim.id}`}
                type="checkbox"
                checked={Boolean(completedPilgrims[currentFocusedPilgrim.id])}
                onChange={() => togglePilgrimCompleted(currentFocusedPilgrim.id)}
                aria-label={`Mark devotee ${focusedPilgrimIdx + 1} as entered`}
                className="w-4 h-4 rounded text-[#54258A] focus:ring-[#54258A] cursor-pointer"
              />
              <span>
                {completedPilgrims[currentFocusedPilgrim.id]
                  ? (t('manualEntry.entered') || 'Entered ✓')
                  : (t('manualEntry.markEntered') || 'Mark entered')}
              </span>
            </label>
          </div>

          {/* Step Dots Indicator */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {fieldSteps.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFocusedFieldStep(idx)}
                className={`flex-1 py-1 text-[10px] font-bold rounded text-center transition-all cursor-pointer ${
                  focusedFieldStep === idx
                    ? 'bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35]'
                    : 'bg-black/5 dark:bg-white/5 text-[#6B5A70] dark:text-[#A692B4] hover:bg-black/10'
                }`}
              >
                {s.stepNumber}. {s.label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Current Focused Field Content */}
          <div className="p-3 rounded-xl bg-black/2 dark:bg-white/5 space-y-2.5">
            {/* Step 1: Name */}
            {focusedFieldStep === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4]">
                    Step 1 of 5: Devotee Full Name
                  </span>
                  <button
                    type="button"
                    id="sp-focused-copy-name"
                    onClick={() =>
                      handleCopy(
                        `focused-name-${currentFocusedPilgrim.id}`,
                        (currentFocusedPilgrim.fullName || `${currentFocusedPilgrim.firstName || ''} ${currentFocusedPilgrim.lastName || ''}`).trim()
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded bg-[#54258A] text-white hover:bg-[#54258A]/90 dark:bg-[#D4A72C] dark:text-[#2C1A35] transition-colors cursor-pointer"
                  >
                    <Icon name={copiedFields[`focused-name-${currentFocusedPilgrim.id}`] ? 'check' : 'copy'} size={12} />
                    <span>{copiedFields[`focused-name-${currentFocusedPilgrim.id}`] ? 'Copied! ✓' : 'Copy Name'}</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#201026] border border-black/10 dark:border-white/10 font-bold text-sm text-[#321B3F] dark:text-[#F8EFD8] select-all">
                  {(currentFocusedPilgrim.fullName || `${currentFocusedPilgrim.firstName || ''} ${currentFocusedPilgrim.lastName || ''}`).trim()}
                </div>
                <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                  Click <strong>Copy Name</strong>, then click the Name field on TTD and press <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px]">Ctrl+V</kbd> to paste.
                </p>
              </div>
            )}

            {/* Step 2: Age */}
            {focusedFieldStep === 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4]">
                    Step 2 of 5: Age (User Direct Control)
                  </span>
                  <button
                    type="button"
                    id="sp-focused-copy-age"
                    onClick={() =>
                      handleCopy(`focused-age-${currentFocusedPilgrim.id}`, String(currentFocusedPilgrim.age ?? ''))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded bg-[#54258A]/10 hover:bg-[#54258A]/20 dark:bg-[#D4A72C]/20 text-[#54258A] dark:text-[#D4A72C] transition-colors cursor-pointer"
                  >
                    <Icon name={copiedFields[`focused-age-${currentFocusedPilgrim.id}`] ? 'check' : 'copy'} size={12} />
                    <span>{copiedFields[`focused-age-${currentFocusedPilgrim.id}`] ? 'Copied! ✓' : 'Copy Age'}</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#201026] border border-black/10 dark:border-white/10 font-bold text-base text-[#321B3F] dark:text-[#F8EFD8] select-all">
                  {currentFocusedPilgrim.age ?? '—'}
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px] space-y-0.5">
                  <p className="font-semibold">Keep Age entry under your direct control:</p>
                  <p>Type the numeric age directly into the TTD Age input box.</p>
                </div>
              </div>
            )}

            {/* Step 3: Gender */}
            {focusedFieldStep === 2 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                  Step 3 of 5: Gender (Dropdown Selection)
                </span>
                <div className="p-2 rounded-lg bg-white dark:bg-[#201026] border border-black/10 dark:border-white/10 font-bold text-sm text-[#321B3F] dark:text-[#F8EFD8]">
                  {currentFocusedPilgrim.gender ?? '—'}
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px] space-y-0.5">
                  <p className="font-semibold">Keep dropdown selection under your direct control:</p>
                  <p>
                    Click the Gender dropdown on the TTD page and select{' '}
                    <strong>{currentFocusedPilgrim.gender ?? 'Male / Female'}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Photo ID Proof Type */}
            {focusedFieldStep === 3 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                  Step 4 of 5: Photo ID Proof Type (Dropdown Selection)
                </span>
                <div className="p-2 rounded-lg bg-white dark:bg-[#201026] border border-black/10 dark:border-white/10 font-bold text-sm text-[#321B3F] dark:text-[#F8EFD8]">
                  {currentFocusedPilgrim.idType || 'Aadhaar Card'}
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px] space-y-0.5">
                  <p className="font-semibold">Keep dropdown selection under your direct control:</p>
                  <p>
                    Select <strong>{currentFocusedPilgrim.idType || 'Aadhaar Card'}</strong> from the TTD ID Proof dropdown.
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Photo ID Number */}
            {focusedFieldStep === 4 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4]">
                    Step 5 of 5: Photo ID Number ({currentFocusedPilgrim.idType || 'ID'})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="sp-focused-toggle-id"
                      onClick={() => toggleReveal(currentFocusedPilgrim.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
                    >
                      <Icon name={revealedIds[currentFocusedPilgrim.id] ? 'lock' : 'eye'} size={11} />
                      <span>{revealedIds[currentFocusedPilgrim.id] ? 'Hide' : 'Reveal digits'}</span>
                    </button>
                    <button
                      type="button"
                      id="sp-focused-copy-id"
                      onClick={() =>
                        handleCopy(`focused-id-${currentFocusedPilgrim.id}`, currentFocusedPilgrim.idNumber)
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded bg-[#54258A] text-white hover:bg-[#54258A]/90 dark:bg-[#D4A72C] dark:text-[#2C1A35] transition-colors cursor-pointer"
                    >
                      <Icon name={copiedFields[`focused-id-${currentFocusedPilgrim.id}`] ? 'check' : 'copy'} size={12} />
                      <span>{copiedFields[`focused-id-${currentFocusedPilgrim.id}`] ? 'Copied! ✓' : 'Copy ID'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#201026] border border-black/10 dark:border-white/10 font-mono font-bold text-sm text-[#321B3F] dark:text-[#F8EFD8] select-all">
                  {revealedIds[currentFocusedPilgrim.id]
                    ? (currentFocusedPilgrim.idNumber || '—')
                    : maskIdNumber(currentFocusedPilgrim.idNumber)}
                </div>
                <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4]">
                  Click <strong>Copy ID</strong>, then paste into the TTD Photo ID Number input.
                </p>
              </div>
            )}

            {/* Focused Step Navigation Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                id="sp-focused-prev-btn"
                disabled={focusedPilgrimIdx === 0 && focusedFieldStep === 0}
                onClick={handlePrevStep}
                className="px-2.5 py-1 text-xs font-bold rounded border border-black/10 dark:border-white/10 text-[#54258A] dark:text-[#D4A72C] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ← Previous Field
              </button>

              <span className="text-[11px] font-semibold text-[#6B5A70] dark:text-[#A692B4]">
                Step {focusedFieldStep + 1} of 5
              </span>

              <button
                type="button"
                id="sp-focused-next-btn"
                disabled={focusedPilgrimIdx === totalDevotees - 1 && focusedFieldStep === fieldSteps.length - 1}
                onClick={handleNextStep}
                className="px-3 py-1 text-xs font-bold rounded bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#2C1A35] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next Field →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. Full Devotee Checklist Mode (or Srivani Manual Mode) ─── */}
      {(isSrivani || viewMode === 'checklist') && (
        <div className="space-y-3">
          {displayedPilgrims.map((pilgrim, idx) => {
            const isDone = Boolean(completedPilgrims[pilgrim.id]);
            const isRevealed = Boolean(revealedIds[pilgrim.id]);
            const isCollapsed = Boolean(collapsedPilgrims[pilgrim.id]);
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
                  <div
                    className="flex items-center gap-2 min-w-0 cursor-pointer select-none"
                    onClick={() => toggleCollapse(pilgrim.id)}
                  >
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
                      Devotee {idx + 1}: {name}
                    </span>
                    <Icon
                      name="chevron-down"
                      size={12}
                      className={`text-[#6B5A70] dark:text-[#A692B4] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
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

                {/* Field Step Instructions (Collapsible) */}
                {!isCollapsed && (
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
                          {isSrivani
                            ? 'Type name directly into TTD Name field (clipboard assist disabled).'
                            : (t('manualEntry.nameInstruction') || 'Paste name into TTD Name field or type manually.')}
                        </p>
                      </div>
                      {!isSrivani && (
                        <button
                          type="button"
                          id={`sp-paste-copy-name-${pilgrim.id}`}
                          onClick={() => handleCopy(`name-${pilgrim.id}`, name)}
                          aria-label={`Copy Devotee ${idx + 1} Name`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-[#54258A]/10 hover:bg-[#54258A]/20 dark:bg-[#D4A72C]/20 dark:hover:bg-[#D4A72C]/30 text-[#54258A] dark:text-[#D4A72C] transition-colors cursor-pointer shrink-0 mt-0.5"
                        >
                          <Icon name={copiedFields[`name-${pilgrim.id}`] ? 'check' : 'copy'} size={12} />
                          <span>{copiedFields[`name-${pilgrim.id}`] ? 'Copied! ✓' : 'Copy Name'}</span>
                        </button>
                      )}
                    </div>

                    {/* Step 2: Age & Gender */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                            {t('manualEntry.stepAge') || '2. Age'}
                          </span>
                          {!isSrivani && (
                            <button
                              type="button"
                              id={`sp-paste-copy-age-${pilgrim.id}`}
                              onClick={() => handleCopy(`age-${pilgrim.id}`, String(pilgrim.age ?? ''))}
                              aria-label={`Copy Devotee ${idx + 1} Age`}
                              className="text-[10px] font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
                            >
                              {copiedFields[`age-${pilgrim.id}`] ? 'Copied! ✓' : 'Copy'}
                            </button>
                          )}
                        </div>
                        <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all block">
                          {pilgrim.age ?? '—'}
                        </span>
                        <p className="text-[9px] text-[#6B5A70] dark:text-[#A692B4]">
                          Type numeric age into TTD field
                        </p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                          {t('manualEntry.stepGender') || '3. Gender'}
                        </span>
                        <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] block">
                          {pilgrim.gender ?? '—'}
                        </span>
                        <p className="text-[9px] text-[#6B5A70] dark:text-[#A692B4]">
                          Select from dropdown
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Photo ID Type & Number */}
                    <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4]">
                          {t('manualEntry.stepId') || '4. Photo ID Proof'} ({pilgrim.idType || 'ID'})
                        </span>
                        <div className="flex items-center gap-2">
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
                          {!isSrivani && (
                            <button
                              type="button"
                              id={`sp-paste-copy-id-${pilgrim.id}`}
                              onClick={() => handleCopy(`id-${pilgrim.id}`, pilgrim.idNumber)}
                              aria-label={`Copy Devotee ${idx + 1} ID Number`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-[#54258A]/10 hover:bg-[#54258A]/20 dark:bg-[#D4A72C]/20 dark:hover:bg-[#D4A72C]/30 text-[#54258A] dark:text-[#D4A72C] transition-colors cursor-pointer"
                            >
                              <Icon name={copiedFields[`id-${pilgrim.id}`] ? 'check' : 'copy'} size={12} />
                              <span>{copiedFields[`id-${pilgrim.id}`] ? 'Copied! ✓' : 'Copy ID'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="font-mono font-semibold text-xs text-[#321B3F] dark:text-[#F8EFD8] select-all">
                        {isRevealed ? (pilgrim.idNumber || '—') : maskIdNumber(pilgrim.idNumber)}
                      </div>

                      <p className="text-[10px] text-[#6B5A70] dark:text-[#A692B4]">
                        {isSrivani
                          ? 'Select ID type from dropdown and type ID number directly into TTD field.'
                          : (t('manualEntry.idInstruction') ||
                            'Select ID proof type from dropdown, then paste/type ID number into TTD field.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 4. General Details Checklist (If applicable) ─── */}
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
              <div className="p-1.5 rounded-lg bg-black/2 dark:bg-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6B5A70] dark:text-[#A692B4] block">
                    {t('manualEntry.contactEmail') || 'Email'}
                  </span>
                  <span className="font-semibold text-[#321B3F] dark:text-[#F8EFD8] select-all">
                    {general.email}
                  </span>
                </div>
                {!isSrivani && (
                  <button
                    type="button"
                    onClick={() => handleCopy('general-email', general.email)}
                    className="text-[10px] font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
                  >
                    {copiedFields['general-email'] ? 'Copied! ✓' : 'Copy'}
                  </button>
                )}
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

      {/* ─── 5. Safe Human Boundary Invariant ─── */}
      <div className="p-2.5 rounded-xl bg-black/3 dark:bg-white/5 text-[11px] text-[#6B5A70] dark:text-[#A692B4] space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-[#321B3F] dark:text-[#F8EFD8]">
          <Icon name="shield" size={12} className="text-[#54258A] dark:text-[#D4A72C]" />
          <span>{t('manualEntry.humanBoundaryHeading') || 'Human Safety Boundary'}</span>
        </div>
        <p className="leading-tight">
          {t('manualEntry.humanBoundaryReminder') ||
            'Never auto-click Continue, submit a booking, initiate payment, accept declarations, or bypass CAPTCHA/OTP. All authentication and submissions must be performed directly by you on the official TTD page.'}
        </p>
      </div>

      {/* ─── 6. Portal Navigation Action ─── */}
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
