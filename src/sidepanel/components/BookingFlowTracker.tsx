import React from 'react';

interface BookingFlowTrackerProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  pageDetected: boolean;
  serviceDetected: boolean;
  formDetected: boolean;
  isTemporaryLock?: boolean;
  statusMessage?: string;
}

export const BookingFlowTracker: React.FC<BookingFlowTrackerProps> = ({
  currentStep,
  pageDetected,
  serviceDetected,
  formDetected,
  isTemporaryLock,
  statusMessage,
}) => {
  const steps = isTemporaryLock
    ? [
        { num: 1, label: 'Page', done: true, current: false, isWarning: false },
        { num: 2, label: 'Pilgrims', done: true, current: false, isWarning: false },
        { num: 3, label: 'Fill', done: true, current: false, isWarning: false },
        { num: 4, label: 'Verify', done: true, current: false, isWarning: false },
        { num: 5, label: 'Review / Payment', done: false, current: true, isWarning: true },
      ]
    : [
        { num: 1, label: 'Page', done: pageDetected, current: !pageDetected || currentStep === 1, isWarning: false },
        { num: 2, label: 'Pilgrims', done: serviceDetected, current: pageDetected && currentStep === 2, isWarning: false },
        { num: 3, label: 'Fill', done: currentStep >= 4, current: currentStep === 3, isWarning: false },
        { num: 4, label: 'Verify', done: currentStep >= 5, current: currentStep === 4, isWarning: false },
        { num: 5, label: 'Review', done: false, current: currentStep === 5, isWarning: false },
      ];

  return (
    <div className="bg-[#FFFDF7] dark:bg-[#2A1733] border border-[rgba(212,167,44,0.3)] rounded-xl p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B2A86] dark:text-[#D4A72C]">
          BOOKING FLOW
        </span>
        <span className="text-[10px] text-[#6B5A70] dark:text-[#A898B0]">
          User-controlled submission
        </span>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute left-3 right-3 top-3.5 h-[1.5px] bg-[#E5D7B7] dark:bg-[#4A2D5E] -z-0" />

        {steps.map((s, idx) => {
          const isDone = s.done;
          const isCurrent = s.current;
          const isWarning = s.isWarning;

          let badgeBg = 'bg-[#FFF8E8] text-[#8B7D8F] border-[rgba(212,167,44,0.3)]';
          if (isWarning) {
            badgeBg = 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/50';
          } else if (isDone) {
            badgeBg = 'bg-[#2E7D5B] text-white border-[#2E7D5B]';
          } else if (isCurrent) {
            badgeBg = 'bg-[#5B2A86] text-white border-[#D4A72C] ring-2 ring-[#D4A72C]/40';
          }

          return (
            <div key={idx} className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${badgeBg}`}
                title={s.label}
              >
                {isWarning ? '⚠' : isDone ? '✓' : s.num}
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center truncate max-w-[62px] ${
                isWarning
                  ? 'text-amber-700 dark:text-amber-300 font-bold'
                  : isCurrent
                  ? 'text-[#5B2A86] dark:text-[#F0CC63] font-bold'
                  : 'text-[#6B5A70] dark:text-[#A898B0]'
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {isTemporaryLock && (
        <div className="mt-2.5 pt-2 border-t border-amber-200 dark:border-amber-900/50 flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          <span>Status:</span>
          <span>{statusMessage || 'Previous booking attempt is still active.'}</span>
        </div>
      )}
    </div>
  );
};
