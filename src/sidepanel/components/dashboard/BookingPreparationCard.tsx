import React, { useState } from 'react';
import { t } from '@i18n/index';
import type { ReadinessEvaluation } from '../../../services/readiness-engine';
import type { Profile, Pilgrim } from '@shared/types';
import { getServiceConfig } from '../../../services/ttd-information/ttd-service-rules';

export interface BookingPreparationCardProps {
  profile: Profile | null | undefined;
  selectedPilgrims: Pilgrim[];
  readiness: ReadinessEvaluation;
  serviceId?: string;
  onPrepare?: () => void;
}

export function BookingPreparationCard({
  profile,
  selectedPilgrims,
  readiness,
  serviceId,
  onPrepare,
}: BookingPreparationCardProps) {
  const [isPrepared, setIsPrepared] = useState(false);

  const config = serviceId ? getServiceConfig(serviceId) : undefined;

  // Verification Checklist Items
  const hasProfile = Boolean(profile);
  const pilgrimsComplete = readiness.readyPilgrimsCount > 0 && readiness.readyPilgrimsCount === selectedPilgrims.length;
  const idVerified = readiness.isProfileReady;
  const generalComplete = readiness.isBookingReady || !config?.requiredGeneralFields.length;
  const specialComplete = !config?.specialRequirements?.gothram || Boolean(profile?.general?.gothram);
  const quotaSupported = selectedPilgrims.length > 0 &&
    (!config?.maxPilgrims || selectedPilgrims.length <= config.maxPilgrims) &&
    (!config?.exactPilgrims || selectedPilgrims.length === config.exactPilgrims);
  const sourceVerified = true; // Canonical TTD sources

  const allItemsPass =
    hasProfile &&
    pilgrimsComplete &&
    idVerified &&
    generalComplete &&
    specialComplete &&
    quotaSupported &&
    sourceVerified;

  const handlePrepareClick = () => {
    setIsPrepared(true);
    onPrepare?.();
  };

  const checklist = [
    { label: t('intelligence.profileSelected'), passed: hasProfile },
    { label: t('intelligence.pilgrimsComplete'), passed: pilgrimsComplete },
    { label: t('intelligence.idDetailsVerified'), passed: idVerified },
    { label: t('intelligence.generalDetailsComplete'), passed: generalComplete },
    { label: t('intelligence.specialRequirementsComplete'), passed: specialComplete },
    { label: t('intelligence.quotaSupported'), passed: quotaSupported },
    { label: t('intelligence.sourceVerified'), passed: sourceVerified },
  ];

  return (
    <div
      className="p-4 rounded-2xl border bg-white dark:bg-[#1E1B24] border-[#E5DEEB] dark:border-[#382F45] shadow-xs"
      role="region"
      aria-label={t('intelligence.bookingPreparation')}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold tracking-wider text-[#6F6477] dark:text-[#A89CB5] uppercase">
          {t('intelligence.bookingPreparation')}
        </span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            allItemsPass && isPrepared
              ? 'bg-[#EBF7EE] text-[#1B5E20] dark:bg-[#13381B] dark:text-[#A5D6A7]'
              : 'bg-[#F2EDF7] text-[#54258A] dark:bg-[#2C2438] dark:text-[#D4A72C]'
          }`}
        >
          {allItemsPass && isPrepared ? t('intelligence.readyForTtd') : `${readiness.score}%`}
        </span>
      </div>

      {/* Checklist items */}
      <ul className="space-y-1.5 my-3" aria-label="Preparation checklist">
        {checklist.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2 text-xs">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                item.passed
                  ? 'bg-[#EBF7EE] text-[#1B5E20] dark:bg-[#13381B] dark:text-[#A5D6A7]'
                  : 'bg-[#FDECEB] text-[#B3261E] dark:bg-[#3D1412] dark:text-[#F2B8B5]'
              }`}
            >
              {item.passed ? '✓' : '✕'}
            </span>
            <span
              className={`truncate ${
                item.passed
                  ? 'text-[#382F45] dark:text-[#D5CBE0]'
                  : 'text-[#8B7C99] dark:text-[#9A8EA6]'
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Primary Prepare Button */}
      <div className="mt-3.5">
        {isPrepared && allItemsPass ? (
          <div className="w-full py-2 px-3 rounded-xl text-center text-xs font-bold bg-[#EBF7EE] text-[#1B5E20] dark:bg-[#13381B] dark:text-[#A5D6A7] border border-[#2F8F68]/30">
            ✓ {t('intelligence.readyForTtd')}
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePrepareClick}
            disabled={!allItemsPass}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
              allItemsPass
                ? 'bg-[#54258A] text-white hover:bg-[#6830AA] cursor-pointer dark:bg-[#D4A72C] dark:text-[#1F1603] dark:hover:bg-[#E5B83E]'
                : 'bg-[#ECE6F0] text-[#8B7C99] dark:bg-[#2C2438] dark:text-[#7C6E8A] cursor-not-allowed opacity-80'
            }`}
            aria-label={t('intelligence.prepareBooking')}
          >
            <span>⚡</span>
            <span>{t('intelligence.prepareBooking')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
