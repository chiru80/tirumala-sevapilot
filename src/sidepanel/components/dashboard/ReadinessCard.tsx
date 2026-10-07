import React from 'react';
import type { UseReadinessResult } from '../../hooks/useReadiness';
import { t } from '@i18n/index';

interface ReadinessCardProps {
  readiness: UseReadinessResult;
  onFixProfile: () => void;
}

export const ReadinessCard: React.FC<ReadinessCardProps> = ({
  readiness,
  onFixProfile,
}) => {
  const { score, isReady, checks, missingDetails } = readiness;

  let progressColor = 'bg-[#B64747]';
  if (score >= 100) {
    progressColor = 'bg-[#2F8F68]';
  } else if (score >= 60) {
    progressColor = 'bg-[#C98A18]';
  }

  return (
    <div
      className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs space-y-3"
      role="region"
      aria-label={t('dashboard.bookingReadiness')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
          {t('dashboard.bookingReadiness')}
        </span>
        <span
          className={`text-lg font-extrabold px-2.5 py-0.5 rounded-lg ${
            score >= 100
              ? 'text-[#1B5E20] bg-[#E8F5E9] dark:bg-[#1B3E2B] dark:text-[#A5D6A7]'
              : score >= 60
              ? 'text-[#8D6E18] bg-[#FFF8E8] dark:bg-[#3D2F1B] dark:text-[#FFE082]'
              : 'text-[#B64747] bg-[#FFEBEE] dark:bg-[#4E1C1C] dark:text-[#EF9A9A]'
          }`}
        >
          {score}% {score >= 100 ? t('dashboard.ready') : ''}
        </span>
      </div>

      {/* Progress Bar & Subtext */}
      <div className="space-y-1.5">
        <div className="w-full h-2.5 bg-[#E5E0EB] dark:bg-[#3E1B68]/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[#6F6477] dark:text-[#A692B4] font-medium">
          <span>{checks.filter(c => c.passed).length} of {checks.length} checks complete</span>
        </div>
      </div>

      {/* Readiness Check List */}
      <div className="space-y-2 pt-1">
        {checks.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`font-bold text-base shrink-0 ${c.passed ? 'text-[#2F8F68]' : 'text-[#C98A18]'}`}>
                {c.passed ? '✓' : '⚠'}
              </span>
              <span className={`truncate font-medium ${c.passed ? 'text-[#30213A] dark:text-[#F8EFD8]' : 'text-[#8D6E18] dark:text-[#FFE082]'}`}>
                {c.message}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Prominent Incomplete warning & Fix button */}
      {!isReady && missingDetails.length > 0 && (
        <div
          className="mt-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-3 shadow-2xs"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0 pr-2">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide truncate">
              ⚠ {missingDetails[0]}
            </p>
          </div>
          <button
            onClick={onFixProfile}
            className="min-h-[44px] text-sm font-bold px-4 py-2 rounded-xl bg-[#54258A] hover:bg-[#4A216E] text-white shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
            aria-label={missingDetails[0]?.toLowerCase().includes('open') ? 'Open TTD' : t('dashboard.fixProfile')}
          >
            {missingDetails[0]?.toLowerCase().includes('open') ? 'Open TTD →' : `${t('dashboard.fixProfile')} →`}
          </button>
        </div>
      )}
    </div>
  );
};
