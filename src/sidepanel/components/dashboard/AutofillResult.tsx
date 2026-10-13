import React from 'react';
import type { PilgrimRowReport } from '@shared/types';
import { Icon, Badge } from '../../design-system';
import { t } from '@i18n/index';

interface AutofillResultProps {
  pilgrimReports: PilgrimRowReport[];
  onRepair: () => void;
}

export const AutofillResult: React.FC<AutofillResultProps> = ({
  pilgrimReports,
  onRepair,
}) => {
  if (pilgrimReports.length === 0) return null;

  const totalPilgrims = pilgrimReports.length;
  const allVerified = pilgrimReports.every((p) => p.allValidated);

  // Accurate breakdown: Filled vs Skipped/Preserved vs Manual Input Required
  let filledCount = 0;
  let skippedPreservedCount = 0;
  let manualRequiredCount = 0;

  const filledFieldItems: { pilgrim: string; label: string }[] = [];
  const skippedPreservedItems: { pilgrim: string; label: string; reason?: string }[] = [];
  const manualRequiredItems: { pilgrim: string; label: string; error?: string }[] = [];

  for (const p of pilgrimReports) {
    const fields = Object.values(p.fields || {});
    for (const f of fields) {
      if (f.validated && f.filled) {
        filledCount++;
        filledFieldItems.push({ pilgrim: p.pilgrimName, label: f.label });
      } else if (f.validated && !f.filled) {
        skippedPreservedCount++;
        skippedPreservedItems.push({
          pilgrim: p.pilgrimName,
          label: f.label,
          reason: 'Preserved user-entered value',
        });
      } else {
        manualRequiredCount++;
        manualRequiredItems.push({
          pilgrim: p.pilgrimName,
          label: f.label,
          error: f.error || 'Requires manual input',
        });
      }
    }
  }

  return (
    <div
      role="region"
      aria-label={t('autofillResult.title') || 'Autofill Execution Results'}
      className={`rounded-2xl border-2 p-4 shadow-sm space-y-3.5 transition-all motion-reduce:transition-none ${
        allVerified
          ? 'border-emerald-500/40 bg-gradient-to-b from-white to-emerald-50/20 dark:from-[#2C1A35] dark:to-[#172E22]/20'
          : 'border-amber-500/40 bg-gradient-to-b from-white to-amber-50/20 dark:from-[#2C1A35] dark:to-[#382613]/20'
      }`}
    >
      {/* ─── Header: Overall Status ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${
              allVerified ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {allVerified ? '✓' : '⚠️'}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#321B3F] dark:text-[#F8EFD8] leading-tight">
              {allVerified
                ? (t('autofillResult.allVerifiedTitle') || 'Autofill Complete & Verified')
                : (t('autofillResult.attentionTitle') || 'Autofill Finished with Action Required')}
            </h3>
            <p className="text-[11px] text-[#6B5A70] dark:text-[#C5B4D4] font-medium mt-0.5">
              {t('autofillResult.devoteesProcessed', { count: totalPilgrims }) ||
                `${totalPilgrims} Devotee(s) processed on page`}
            </p>
          </div>
        </div>

        <Badge variant={allVerified ? 'ready' : 'actionRequired'} size="sm">
          {allVerified ? '100% Verified' : 'Action Required'}
        </Badge>
      </div>

      {/* ─── 3-Way Metrics Bar: Filled, Skipped, Manual Input Required ─── */}
      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span className="block text-base font-bold text-emerald-800 dark:text-emerald-300">
            {filledCount}
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            {t('autofillResult.filledFields') || 'Filled'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
          <span className="block text-base font-bold text-blue-800 dark:text-blue-300">
            {skippedPreservedCount}
          </span>
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
            {t('autofillResult.skippedPreserved') || 'Preserved'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <span className="block text-base font-bold text-amber-800 dark:text-amber-300">
            {manualRequiredCount}
          </span>
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            {t('autofillResult.manualRequired') || 'Manual Action'}
          </span>
        </div>
      </div>

      {/* ─── Preserved Fields Notice if any ─── */}
      {skippedPreservedCount > 0 && (
        <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <Icon name="shield" size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            {t('autofillResult.userValuesPreservedDesc', { count: skippedPreservedCount }) ||
              `${skippedPreservedCount} manually entered website value(s) were safely preserved without overwriting.`}
          </span>
        </div>
      )}

      {/* ─── Manual Input Required (Devotee Responsibility & Boundaries) ─── */}
      <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#24132D] border border-black/5 dark:border-white/10 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#54258A] dark:text-[#D4A72C]">
          <Icon name="alert-circle" size={13} />
          <span>{t('autofillResult.manualStepsHeading') || 'Next Steps (Manual Human Action)'}</span>
        </div>

        <ul className="text-[11px] text-[#6B5A70] dark:text-[#C5B4D4] space-y-1 pl-1 font-medium">
          <li className="flex items-center gap-2">
            <span className="text-[#54258A] dark:text-[#D4A72C] font-bold">1.</span>
            <span>{t('autofillResult.stepCaptcha') || 'Solve CAPTCHA challenge on the page'}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#54258A] dark:text-[#D4A72C] font-bold">2.</span>
            <span>{t('autofillResult.stepOtp') || 'Verify mobile OTP when prompted by TTD'}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#54258A] dark:text-[#D4A72C] font-bold">3.</span>
            <span>{t('autofillResult.stepDeclaration') || 'Acknowledge rules / declaration checkboxes manually'}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#54258A] dark:text-[#D4A72C] font-bold">4.</span>
            <span>{t('autofillResult.stepPayment') || 'Review summary and complete payment on official bank gateway'}</span>
          </li>
        </ul>
      </div>

      {/* ─── Repair Action if any field failed ─── */}
      {!allVerified && (
        <button
          type="button"
          onClick={onRepair}
          className="w-full min-h-[40px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white font-bold text-xs flex items-center justify-center gap-2 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#54258A]"
        >
          <Icon name="sparkles" size={14} />
          <span>{t('dashboard.repairMissingFields') || '⚡ Re-scan & Fill Missing Fields'}</span>
        </button>
      )}
    </div>
  );
};
