import React from 'react';
import { Card, Icon, Badge } from '../../design-system';
import type { ProfileReadinessReport } from '../../presentation/profile-readiness-tester';
import type { PilgrimRowReport } from '@shared/types';
import { t } from '@i18n/index';

export type FormFieldState = 'Not started' | 'Filled and verified' | 'Rejected' | 'Needs manual entry';

export interface FieldItemDisplay {
  id: string;
  label: string;
  state: FormFieldState;
  devoteeIndex?: number;
  error?: string;
  maskedValue?: string;
}

export interface BookingReadinessSummaryProps {
  report: ProfileReadinessReport;
  pageDetected?: boolean;
  isFilling?: boolean;
  pilgrimReports?: PilgrimRowReport[];
  fieldResults?: Array<{
    id: string;
    label: string;
    status: 'filled' | 'failed' | 'conflict' | 'skipped';
    error?: string;
    maskedValue?: string;
  }>;
  fillStatus?: string | null;
  onFixClick: () => void;
  onTestClick: () => void;
  className?: string;
}

export const BookingReadinessSummary: React.FC<BookingReadinessSummaryProps> = ({
  report,
  pageDetected = false,
  isFilling = false,
  pilgrimReports = [],
  fieldResults = [],
  fillStatus,
  onFixClick,
  onTestClick,
  className = '',
}) => {
  const { isReady, checklist, passedChecks, totalChecks, missingItems, serviceName } = report;

  // ─── Calculate Live Form Readiness From Actual Page Values ───
  const hasAttemptedFill = (pilgrimReports && pilgrimReports.length > 0) || (fieldResults && fieldResults.length > 0);

  // Derive field-level states: 'Not started' | 'Filled and verified' | 'Rejected' | 'Needs manual entry'
  const formFieldItems: FieldItemDisplay[] = [];

  if (pilgrimReports && pilgrimReports.length > 0) {
    pilgrimReports.forEach((pr, pIdx) => {
      const fieldKeys: Array<{ key: string; label: string }> = [
        { key: 'name', label: `Devotee ${pIdx + 1} Name` },
        { key: 'age', label: `Devotee ${pIdx + 1} Age` },
        { key: 'gender', label: `Devotee ${pIdx + 1} Gender` },
        { key: 'photoIdProof', label: `Devotee ${pIdx + 1} ID Proof` },
        { key: 'photoIdNumber', label: `Devotee ${pIdx + 1} ID Number` },
      ];

      fieldKeys.forEach(({ key, label }) => {
        const fStatus = pr.fields?.[key];
        let state: FormFieldState = 'Not started';

        if (fStatus) {
          if (fStatus.validated && fStatus.filled) {
            state = 'Filled and verified';
          } else if (fStatus.error && (fStatus.error.toLowerCase().includes('not accepted') || fStatus.error.toLowerCase().includes('rejected') || fStatus.error.toLowerCase().includes('validation error'))) {
            state = 'Rejected';
          } else if (fStatus.filled === false || fStatus.validated === false || fStatus.error) {
            state = 'Needs manual entry';
          }
        }

        formFieldItems.push({
          id: `${pIdx}_${key}`,
          label,
          state,
          devoteeIndex: pIdx + 1,
          error: fStatus?.error,
          maskedValue: fStatus?.maskedValue,
        });
      });
    });
  } else if (fieldResults && fieldResults.length > 0) {
    fieldResults.forEach((fr, idx) => {
      let state: FormFieldState = 'Not started';
      if (fr.status === 'filled') {
        state = 'Filled and verified';
      } else if (fr.error && (fr.error.toLowerCase().includes('not accepted') || fr.error.toLowerCase().includes('rejected'))) {
        state = 'Rejected';
      } else {
        state = 'Needs manual entry';
      }
      formFieldItems.push({
        id: fr.id || `field_${idx}`,
        label: fr.label,
        state,
        error: fr.error,
        maskedValue: fr.maskedValue,
      });
    });
  } else {
    // Default baseline fields when not yet filled
    const defaultFields = ['Devotee Name', 'Age', 'Gender', 'Photo ID Proof', 'Photo ID Number'];
    defaultFields.forEach((label, idx) => {
      formFieldItems.push({
        id: `default_${idx}`,
        label,
        state: 'Not started',
      });
    });
  }

  const totalFormFields = formFieldItems.length;
  const verifiedFormFields = formFieldItems.filter((f) => f.state === 'Filled and verified').length;
  const rejectedFormFields = formFieldItems.filter((f) => f.state === 'Rejected').length;
  const isFormFullyVerified = totalFormFields > 0 && verifiedFormFields === totalFormFields;
  const isFillRejected = rejectedFormFields > 0 || (hasAttemptedFill && verifiedFormFields === 0) || (fillStatus?.toLowerCase().includes('not accepted') ?? false);

  return (
    <Card variant="default" padding="md" className={`space-y-4 ${className}`}>
      {/* ─── SECTION A: Profile Data Available (Local Profile Checks) ─── */}
      <div className="space-y-2.5 pb-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isReady ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-[#321B3F] dark:text-[#F8EFD8]">
              {t('readiness.bookingReadiness') || 'Booking Readiness (Profile Data Available)'}
            </span>
          </div>

          <Badge variant={isReady ? 'ready' : 'actionRequired'} size="sm">
            {isReady ? `${passedChecks}/${totalChecks} Profile Ready` : `${missingItems.length} Missing`}
          </Badge>
        </div>

        <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] leading-tight">
          Confirms your saved devotee data is complete in extension storage. (Does not mean the TTD page form is filled).
        </p>

        {/* Profile Checklist Items */}
        <div className="space-y-1.5 pt-0.5">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                    item.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  }`}
                  aria-hidden="true"
                >
                  {item.passed ? '✓' : '!'}
                </span>
                <span
                  className={`truncate font-medium ${
                    item.passed
                      ? 'text-[#321B3F] dark:text-[#F8EFD8]'
                      : 'text-amber-800 dark:text-amber-300 font-semibold'
                  }`}
                >
                  {item.label}
                </span>
              </div>

              <span className="text-[11px] font-medium text-[#6B5A70] dark:text-[#A692B4] shrink-0 ml-2">
                {item.passed ? (t('readiness.ready') || 'Ready') : (t('readiness.needed') || 'Needed')}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-1 flex items-center justify-between text-xs">
          <span className="text-[#6B5A70] dark:text-[#A692B4] font-medium text-[11px] truncate">
            {serviceName}
          </span>
          {isReady ? (
            <button
              type="button"
              onClick={onTestClick}
              className="font-semibold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer text-[11px]"
            >
              {t('readiness.testDetails') || 'Test Details'} →
            </button>
          ) : (
            <button
              type="button"
              onClick={onFixClick}
              className="font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
            >
              <span>{t('readiness.fixProfile') || 'Fix profile'}</span>
              <Icon name="arrow-right" size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ─── SECTION B: Booking Form on TTD Page (Actual Page State) ─── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isFormFullyVerified
                  ? 'bg-emerald-500'
                  : hasAttemptedFill
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-[#321B3F] dark:text-[#F8EFD8]">
              {t('readiness.bookingFormFilled') || '2. Booking Form on Page (Live Verification)'}
            </span>
          </div>

          <Badge
            variant={
              isFormFullyVerified
                ? 'ready'
                : hasAttemptedFill
                ? (isFillRejected ? 'blocked' : 'actionRequired')
                : 'neutral'
            }
            size="sm"
          >
            {hasAttemptedFill
              ? `${verifiedFormFields}/${totalFormFields} Verified`
              : (t('readiness.notStarted') || 'Not started')}
          </Badge>
        </div>

        <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] leading-tight">
          Calculated strictly from actual values read and verified from the official TTD page controls.
        </p>

        {/* Rejection / Reset Notice */}
        {hasAttemptedFill && isFillRejected && (
          <div
            id="sp-autofill-rejected-alert"
            className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Icon name="alert-triangle" size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Automatic fill was not accepted by the page.</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Please use the user-mediated Paste Assist below to enter your devotee details into the TTD fields.
            </p>
          </div>
        )}

        {/* Live Field-Level States */}
        <div className="space-y-1.5 pt-0.5">
          {formFieldItems.map((field) => {
            const isVerified = field.state === 'Filled and verified';
            const isRejected = field.state === 'Rejected';
            const isManualNeeded = field.state === 'Needs manual entry';

            return (
              <div
                key={field.id}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-black/2 dark:bg-white/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                      isVerified
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : isRejected
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                        : isManualNeeded
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    {isVerified ? '✓' : isRejected ? '✕' : isManualNeeded ? '!' : '•'}
                  </span>
                  <span className="truncate font-medium text-[#321B3F] dark:text-[#F8EFD8]">
                    {field.label}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    isVerified
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : isRejected
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      : isManualNeeded
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                  }`}
                >
                  {field.state}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
