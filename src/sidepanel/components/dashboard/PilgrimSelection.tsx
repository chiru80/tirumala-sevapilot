import React, { useState } from 'react';
import type { Pilgrim } from '@shared/types';
import { checkPilgrimHealth } from '../../../services/profile-health';
import { t } from '@i18n/index';

interface PilgrimSelectionProps {
  pilgrims: Pilgrim[];
  selectedIds: string[];
  onToggle: (pilgrimId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditPilgrim?: (pilgrim: Pilgrim) => void;
  maxAllowed?: number;
  exactCount?: number;
}

export const PilgrimSelection: React.FC<PilgrimSelectionProps> = ({
  pilgrims,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onEditPilgrim,
  maxAllowed,
  exactCount,
}) => {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  if (pilgrims.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 text-center">
        <p className="text-sm font-medium text-[#6F6477] dark:text-[#A692B4]">
          {t('dashboard.noDevoteesInProfile')}
        </p>
      </div>
    );
  }

  const effectiveMax = exactCount ?? maxAllowed ?? 6;
  const selectedCount = selectedIds.filter(id => pilgrims.some(p => p.id === id)).length;

  const handleToggle = (pilgrim: Pilgrim) => {
    const isCurrentlySelected = selectedIds.includes(pilgrim.id);

    // Prevent selecting beyond quota limit (e.g. 2 for Homam, 6 for SED)
    if (!isCurrentlySelected && selectedCount >= effectiveMax) {
      setWarningMessage(
        exactCount
          ? `Maximum ${exactCount} persons per booking`
          : t('dashboard.maxPilgrimsReached')
      );
      return;
    }

    // If attempting to select an incomplete devotee, warn user
    const health = checkPilgrimHealth(pilgrim);
    if (!isCurrentlySelected && !health.isReady) {
      const missingList = health.missingFields.map(f => {
        if (f === 'idNumber') return 'ID Number';
        if (f === 'fullName') return 'Name';
        if (f === 'age') return 'Age';
        if (f === 'gender') return 'Gender';
        if (f === 'idType') return 'ID Type';
        return f;
      }).join(', ');

      setWarningMessage(`Cannot select "${health.pilgrimName}": Missing ${missingList}`);
      return;
    }

    setWarningMessage(null);
    onToggle(pilgrim.id);
  };

  return (
    <div className="rounded-2xl border border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2A1733] p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
            {t('dashboard.selectDevotees')} ({selectedCount}/{Math.min(effectiveMax, pilgrims.length)})
          </span>
          {exactCount === 2 && (
            <span className="text-[12px] font-semibold text-[#54258A] dark:text-[#D4A72C] bg-[rgba(84,37,138,0.08)] dark:bg-[rgba(212,167,44,0.12)] px-2 py-0.5 rounded-md">
              Maximum 2 persons per booking
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            onClick={onSelectAll}
            className="text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer py-1"
          >
            {t('dashboard.selectAll')}
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={onDeselectAll}
            className="text-[#6F6477] dark:text-[#A692B4] hover:underline cursor-pointer py-1"
          >
            {t('dashboard.deselectAll')}
          </button>
        </div>
      </div>

      {warningMessage && (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between" role="alert">
          <span>⚠ {warningMessage}</span>
          <button
            onClick={() => setWarningMessage(null)}
            className="font-bold text-sm ml-2 cursor-pointer p-1"
            aria-label="Dismiss warning"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
        {pilgrims.map((pilgrim) => {
          const isSelected = selectedIds.includes(pilgrim.id);
          const health = checkPilgrimHealth(pilgrim);
          const name = health.pilgrimName;

          return (
            <div
              key={pilgrim.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                  handleToggle(pilgrim);
                }
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none min-h-[44px] ${
                isSelected
                  ? 'bg-[#F9F7FC] dark:bg-[#3E1B68]/30 border-[#54258A]/40 text-[#30213A] dark:text-[#F8EFD8] shadow-2xs'
                  : 'bg-white dark:bg-[#1B1022]/40 border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-[#6F6477] dark:text-[#A692B4] hover:border-[#54258A]/30'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(pilgrim)}
                  className="w-4 h-4 rounded text-[#54258A] focus:ring-[#54258A] cursor-pointer shrink-0"
                  aria-label={`Select ${name}`}
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate text-[#30213A] dark:text-[#F8EFD8]">
                    {name}
                  </p>
                  <p className="text-xs text-[#6F6477] dark:text-[#A692B4] truncate">
                    Age {pilgrim.age || '—'} &bull; {pilgrim.gender || '—'} &bull; {pilgrim.idType || 'Aadhaar'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {health.isReady ? (
                  <span className="text-xs font-bold text-[#1B5E20] bg-[#E8F5E9] dark:bg-[#1B3E2B] dark:text-[#A5D6A7] px-2.5 py-1 rounded-full border border-[#2E7D5B]/20">
                    ✓ Ready
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPilgrim?.(pilgrim);
                    }}
                    className="text-xs font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 px-2.5 py-1 rounded-full cursor-pointer border border-amber-300 dark:border-amber-700"
                    title={`Missing: ${health.missingFields.join(', ')}`}
                  >
                    ⚠ Missing {health.missingFields[0] === 'idNumber' ? 'ID' : health.missingFields[0]}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
