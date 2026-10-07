import React, { useState } from 'react';
import type { Pilgrim } from '@shared/types';
import { checkPilgrimHealth } from '../../../services/profile-health';
import { t } from '@i18n/index';

export interface PilgrimSelectionProps {
  pilgrims: Pilgrim[];
  selectedIds: string[];
  onToggle: (pilgrimId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditPilgrim?: (pilgrim: Pilgrim) => void;
  onAddPilgrim?: () => void;
  maxAllowed?: number;
  exactCount?: number;
  serviceId?: string;
}

export const PilgrimSelection: React.FC<PilgrimSelectionProps> = ({
  pilgrims,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onEditPilgrim,
  onAddPilgrim,
  maxAllowed,
  exactCount,
  serviceId,
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
    const health = checkPilgrimHealth(pilgrim, serviceId);
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
      {/* ─── Header & Quota Title ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
            SELECT PILGRIMS ({selectedCount} of {Math.min(effectiveMax, pilgrims.length)} selected)
          </span>
          {exactCount === 2 && (
            <span className="text-[12px] font-semibold text-[#54258A] dark:text-[#D4A72C] bg-[rgba(84,37,138,0.08)] dark:bg-[rgba(212,167,44,0.12)] px-2 py-0.5 rounded-md">
              Maximum 2 pilgrims per booking
            </span>
          )}
          {exactCount === 1 && (
            <span className="text-[12px] font-semibold text-[#54258A] dark:text-[#D4A72C] bg-[rgba(84,37,138,0.08)] dark:bg-[rgba(212,167,44,0.12)] px-2 py-0.5 rounded-md">
              Maximum 1 participant per booking
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            onClick={onSelectAll}
            className="text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer py-1"
          >
            Select all
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={onDeselectAll}
            className="text-[#6F6477] dark:text-[#A692B4] hover:underline cursor-pointer py-1"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* ─── Visual Quota Slot Indicator Bar ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] select-none">
        {Array.from({ length: effectiveMax }).map((_, slotIdx) => {
          const isFilled = slotIdx < selectedCount;
          return (
            <div
              key={slotIdx}
              className={`px-2 py-1 rounded-lg border font-bold flex items-center gap-1 shrink-0 transition-colors ${
                isFilled
                  ? 'bg-[#54258A]/10 dark:bg-[#D4A72C]/15 border-[#54258A]/40 dark:border-[#D4A72C]/40 text-[#54258A] dark:text-[#D4A72C]'
                  : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60 text-gray-400 dark:text-gray-500'
              }`}
            >
              <span>Slot {slotIdx + 1}</span>
              {isFilled && <span className="text-emerald-600 dark:text-emerald-400">✓</span>}
            </div>
          );
        })}
      </div>

      {/* ─── Warning / Action Banner ─── */}
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

      {/* ─── Visual Pilgrim Cards List ─── */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
        {pilgrims.map((pilgrim, idx) => {
          const isSelected = selectedIds.includes(pilgrim.id);
          const health = checkPilgrimHealth(pilgrim, serviceId);
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
                  aria-label={isSelected ? `${name} (Selected)` : `Select ${name}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 shrink-0">
                      Slot {idx + 1}
                    </span>
                    <p className="font-bold text-sm truncate text-[#30213A] dark:text-[#F8EFD8]">
                      {name}
                    </p>
                  </div>
                  <p className="text-xs text-[#6F6477] dark:text-[#A692B4] truncate mt-0.5">
                    Age {pilgrim.age || '—'} · {pilgrim.gender || '—'} · {pilgrim.idType ? 'ID verified' : 'ID verified'}
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
                    ⚠ Needs attention
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* ─── Add Devotee Slot Card (when quota allows) ─── */}
        {onAddPilgrim && pilgrims.length < effectiveMax && (
          <button
            type="button"
            onClick={onAddPilgrim}
            className="w-full p-2.5 rounded-xl border border-dashed border-[#54258A]/30 dark:border-[#D4A72C]/30 text-[#54258A] dark:text-[#D4A72C] text-xs font-bold hover:bg-[#54258A]/5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>+ Add Devotee (Slot {pilgrims.length + 1})</span>
          </button>
        )}
      </div>
    </div>
  );
};
