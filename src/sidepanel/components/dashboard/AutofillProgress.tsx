import React from 'react';
import { t } from '@i18n/index';

interface AutofillProgressProps {
  currentPilgrim: number;
  totalPilgrims: number;
  currentField: string;
  onCancel: () => void;
}

export const AutofillProgress: React.FC<AutofillProgressProps> = ({
  currentPilgrim,
  totalPilgrims,
  currentField,
  onCancel,
}) => {
  const PILGRIM_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'idType', label: 'Photo ID Proof' },
    { key: 'idNumber', label: 'Photo ID Number' },
  ];

  const currentKey = (currentField || '').toLowerCase();
  const currentIdx = PILGRIM_FIELDS.findIndex(f =>
    currentKey.includes(f.key.toLowerCase()) || f.key.toLowerCase().includes(currentKey)
  );

  // Overall progress percentage
  const totalSteps = totalPilgrims * PILGRIM_FIELDS.length;
  const currentStep = Math.max(0, (currentPilgrim - 1) * PILGRIM_FIELDS.length + (currentIdx >= 0 ? currentIdx + 1 : 0));
  const progressPct = totalSteps > 0 ? Math.min(Math.round((currentStep / totalSteps) * 100), 100) : 0;

  const accessibleStatus = `Filling & Verifying Devotee ${currentPilgrim} of ${totalPilgrims}`;

  return (
    <div
      className="rounded-2xl border-2 border-[#54258A]/30 dark:border-[#D4A72C]/40 bg-white dark:bg-[#2A1733] p-4 shadow-md space-y-3"
      role="status"
      aria-live="polite"
      aria-label={accessibleStatus}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#54258A] dark:text-[#D4A72C]">
            Filling & Verifying...
          </span>
          <h3 className="text-base font-bold text-[#30213A] dark:text-[#F8EFD8] mt-0.5">
            Devotee {currentPilgrim} of {totalPilgrims}
          </h3>
        </div>
        <span className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#E5E0EB] dark:bg-[#3E1B68]/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#54258A] to-[#D4A72C] transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Field Checklist */}
      <div className="space-y-2 py-1">
        {PILGRIM_FIELDS.map((f, i) => {
          const isDone = currentIdx > i;
          const isCurrent = currentIdx === i;

          return (
            <div key={f.key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-4 text-center font-bold text-sm ${
                  isDone
                    ? 'text-[#2F8F68]'
                    : isCurrent
                    ? 'text-blue-600 dark:text-blue-400 animate-spin inline-block'
                    : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {isDone ? '✓' : isCurrent ? '⟳' : '○'}
                </span>
                <span className={`${
                  isDone
                    ? 'text-[#2F8F68] font-medium'
                    : isCurrent
                    ? 'text-[#54258A] dark:text-[#D4A72C] font-bold'
                    : 'text-[#6F6477] dark:text-[#A692B4]'
                }`}>
                  {f.label}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {isDone ? t('dashboard.verified') : isCurrent ? t('dashboard.active') : t('dashboard.pending')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-300 font-bold text-xs border border-red-200 dark:border-red-800/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        aria-label={t('dashboard.cancelOperation')}
      >
        <span>{t('dashboard.cancelOperation')}</span>
      </button>
    </div>
  );
};
