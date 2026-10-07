import React from 'react';
import type { PilgrimRowReport } from '@shared/types';
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
  const allVerified = pilgrimReports.every(p => p.allValidated);
  const totalFields = totalPilgrims * 5;
  const verifiedFieldsCount = pilgrimReports.reduce((acc, p) =>
    acc + Object.values(p.fields).filter(f => f.validated).length, 0
  );

  if (allVerified) {
    return (
      <div className="rounded-2xl border border-[#2F8F68]/30 bg-[#F2FBF6] dark:bg-[#1B3E2B]/30 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2F8F68] text-white flex items-center justify-center font-bold text-base shadow-xs">
              ✓
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B5E20] dark:text-[#A5D6A7]">
                {t('dashboard.allDetailsVerified')}
              </h3>
              <p className="text-xs text-[#2F8F68] font-medium mt-0.5">
                {totalPilgrims} / {totalPilgrims} {totalPilgrims === 1 ? 'pilgrim' : 'pilgrims'} selected &bull; {totalFields} / {totalFields} (100%)
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#1B5E20] bg-[#2F8F68]/15 px-2.5 py-1 rounded-full border border-[#2E7D5B]/20">
            100%
          </span>
        </div>

        <div className="space-y-1.5 border-t border-[#2F8F68]/15 pt-2">
          {pilgrimReports.map(p => (
            <div key={p.pilgrimIndex} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-white/70 dark:bg-[#1B1022]/40">
              <span className="font-semibold text-[#1B5E20] dark:text-[#A5D6A7] flex items-center gap-2">
                <span className="text-[#2F8F68] font-bold">✓</span>
                Pilgrim {p.pilgrimIndex + 1}: {p.pilgrimName}
              </span>
              <span className="text-xs text-[#2F8F68] font-bold">5/5 {t('dashboard.verified')}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#6F6477] dark:text-[#D4C3E0] font-medium pt-1">
          {t('dashboard.allDetailsVerifiedDesc')}
        </p>
      </div>
    );
  }

  // Partial / Attention needed
  const failedReports = pilgrimReports.filter(p => !p.allValidated);

  return (
    <div className="rounded-2xl border border-[#C98A18]/30 bg-[#FFFBF0] dark:bg-[#3D2F1B]/30 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#C98A18] text-white flex items-center justify-center font-bold text-base shadow-xs">
            ⚠
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#8D6E18] dark:text-[#FFE082]">
              {t('dashboard.detailsNeedAttention')}
            </h3>
            <p className="text-xs font-semibold text-[#8D6E18] dark:text-[#FFE082] mt-0.5">
              {t('dashboard.fieldsVerified', { verified: verifiedFieldsCount, total: totalFields })}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#C98A18]/15 pt-2">
        {failedReports.map(p => {
          const failedFields = Object.values(p.fields).filter(f => !f.validated);
          return (
            <div key={p.pilgrimIndex} className="p-3 rounded-xl bg-white/80 dark:bg-[#1B1022]/60 border border-[rgba(201,138,24,0.2)] text-xs space-y-1.5">
              <div className="font-bold text-sm text-[#30213A] dark:text-[#F8EFD8]">
                Pilgrim {p.pilgrimIndex + 1}: {p.pilgrimName}
              </div>
              {failedFields.map(f => (
                <div key={f.fieldType} className="flex items-center justify-between text-xs text-[#B64747] dark:text-[#EF9A9A] pl-2">
                  <span>{f.label}</span>
                  <span className="font-medium">{f.error || t('dashboard.couldNotVerify')}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={onRepair}
        className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#54258A] to-[#3E1B68] text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-md cursor-pointer transition-all active:scale-[0.99]"
      >
        <span>⚡ {t('dashboard.repairMissingFields')}</span>
      </button>
    </div>
  );
};
