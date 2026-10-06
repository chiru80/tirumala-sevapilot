import React from 'react';
import type { Profile, PreFlightReport } from '@shared/types';
import { t } from '@i18n/index';

interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onFixDetails: () => void;
  serviceName: string;
  activeProfile: Profile | null;
  report: PreFlightReport;
  fieldCount: number;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  onFixDetails,
  serviceName,
  activeProfile,
  report,
  fieldCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#321B3F]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF7] dark:bg-[#211526] border-2 border-[#D4A72C] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#5B2A86] to-[#421B68] text-white p-4 border-b border-[#D4A72C]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛕</span>
              <h3 className="font-serif font-bold text-base tracking-wide text-[#F0CC63]">
                {t('preFlight.title')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-[#E5D7B7] hover:text-white text-xl font-bold p-1 cursor-pointer"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[#E5D7B7] mt-1">
            {t('preFlight.subtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-[#321B3F] dark:text-[#FFF8E8]">
          {/* Summary Strip */}
          <div className="grid grid-cols-3 gap-2 bg-[#FFF8E8] dark:bg-[#321B3F]/50 p-3 rounded-xl border border-[rgba(212,167,44,0.3)] text-center">
            <div>
              <div className="text-xs text-[#6B5A70] dark:text-[#A898B0] font-bold uppercase">{t('preFlight.service')}</div>
              <div className="text-sm font-bold text-[#5B2A86] dark:text-[#F0CC63] truncate mt-0.5">{serviceName}</div>
            </div>
            <div>
              <div className="text-xs text-[#6B5A70] dark:text-[#A898B0] font-bold uppercase">{t('preFlight.group')}</div>
              <div className="text-sm font-bold text-[#321B3F] dark:text-[#FFF8E8] truncate mt-0.5">
                {activeProfile?.name || 'Default'}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#6B5A70] dark:text-[#A898B0] font-bold uppercase">{t('preFlight.devotees')}</div>
              <div className="text-sm font-bold text-[#2E7D5B] mt-0.5">
                {activeProfile?.pilgrims.length || 0} {t('dashboard.ready')}
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B5A70] dark:text-[#A898B0]">
              {t('preFlight.readinessVerification')}
            </div>
            <div className="space-y-2">
              {report.checks.map(check => {
                const isPass = check.passed;
                const isError = check.severity === 'error';

                return (
                  <div
                    key={check.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs border ${
                      isPass
                        ? 'bg-[#E8F5E9]/60 dark:bg-[#1B3E2B]/40 border-[#2E7D5B]/30 text-[#1B5E20] dark:text-[#A5D6A7]'
                        : isError
                        ? 'bg-[#FFEBEE] dark:bg-[#4E1C1C]/40 border-[#B3261E]/30 text-[#B3261E] dark:text-[#EF9A9A]'
                        : 'bg-[#FFF8E8] dark:bg-[#3D2F1B]/40 border-[#D4A72C]/30 text-[#8D6E18] dark:text-[#FFE082]'
                    }`}
                  >
                    <span className="font-bold text-sm leading-none mt-0.5">
                      {isPass ? '✓' : isError ? '✕' : '⚠'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs">{check.label}</div>
                      {check.details && (
                        <div className="text-xs opacity-90 mt-0.5">{check.details}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-900 dark:text-blue-200">
            <p className="leading-relaxed">
              ℹ {t('dashboard.reviewNotice')}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-[#FFF8E8] dark:bg-[#2A1733] border-t border-[rgba(212,167,44,0.3)] flex gap-2.5">
          <button
            onClick={onFixDetails}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl border border-[rgba(84,37,138,0.2)] bg-white dark:bg-[#321B3F] text-xs font-bold text-[#5B2A86] dark:text-[#D4A72C] hover:bg-gold-50 cursor-pointer"
          >
            {t('preFlight.fixDetails')}
          </button>
          <button
            onClick={onProceed}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#5B2A86] to-[#421B68] text-white font-bold text-xs shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⚡ {t('preFlight.proceed')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
