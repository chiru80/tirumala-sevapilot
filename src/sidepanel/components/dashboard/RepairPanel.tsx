import React from 'react';
import type { PilgrimRowReport } from '@shared/types';
import { t } from '@i18n/index';

interface RepairPanelProps {
  pilgrimReports: PilgrimRowReport[];
  onRetryField: (pilgrimIndex: number, fieldType: string) => void;
  onRepairAll: () => void;
  isRetrying?: boolean;
}

export const RepairPanel: React.FC<RepairPanelProps> = ({
  pilgrimReports,
  onRetryField,
  onRepairAll,
  isRetrying = false,
}) => {
  // Collect all unverified fields
  const failedItems: Array<{
    pilgrimIndex: number;
    pilgrimName: string;
    fieldType: string;
    label: string;
    error?: string;
  }> = [];

  for (const report of pilgrimReports) {
    if (!report.allValidated) {
      for (const field of Object.values(report.fields)) {
        if (!field.validated) {
          failedItems.push({
            pilgrimIndex: report.pilgrimIndex,
            pilgrimName: report.pilgrimName,
            fieldType: field.fieldType,
            label: field.label,
            error: field.error,
          });
        }
      }
    }
  }

  if (failedItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgba(201,138,24,0.3)] bg-[#FFFDF7] dark:bg-[#2A1733] p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8D6E18] dark:text-[#FFE082]">
          {t('dashboard.targetedFieldRepair')} ({failedItems.length})
        </span>
        <button
          onClick={onRepairAll}
          disabled={isRetrying}
          className="min-h-[44px] text-xs font-bold px-3.5 py-2 bg-[#54258A] hover:bg-[#3E1B68] text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs"
        >
          {isRetrying ? t('dashboard.repairing') : t('dashboard.repairAll')}
        </button>
      </div>

      <div className="space-y-2">
        {failedItems.map((item) => (
          <div
            key={`${item.pilgrimIndex}_${item.fieldType}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#1B1022]/60 border border-[rgba(0,0,0,0.08)] text-xs min-h-[44px]"
          >
            <div className="min-w-0 pr-2">
              <span className="font-bold text-[#30213A] dark:text-[#F8EFD8] block truncate text-xs">
                Pilgrim {item.pilgrimIndex + 1}: {item.label}
              </span>
              <span className="text-xs text-[#B64747] dark:text-[#EF9A9A] truncate block mt-0.5">
                {item.error || t('dashboard.couldNotVerify')}
              </span>
            </div>

            <button
              onClick={() => onRetryField(item.pilgrimIndex, item.fieldType)}
              disabled={isRetrying}
              className="text-xs font-bold px-3 py-1.5 bg-[#54258A]/10 text-[#54258A] dark:text-[#D4A72C] rounded-lg hover:bg-[#54258A]/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {t('dashboard.retry')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
