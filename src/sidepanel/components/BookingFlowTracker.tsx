import React from 'react';

interface BookingFlowTrackerProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  pageDetected: boolean;
  serviceDetected: boolean;
  formDetected: boolean;
}

export const BookingFlowTracker: React.FC<BookingFlowTrackerProps> = ({
  currentStep,
  pageDetected,
  serviceDetected,
  formDetected,
}) => {
  const steps = [
    { num: 1, label: 'Page', done: pageDetected, current: !pageDetected || currentStep === 1 },
    { num: 2, label: 'Pilgrims', done: serviceDetected, current: pageDetected && currentStep === 2 },
    { num: 3, label: 'Fill', done: currentStep >= 4, current: currentStep === 3 },
    { num: 4, label: 'Verify', done: currentStep >= 5, current: currentStep === 4 },
    { num: 5, label: 'Review', done: false, current: currentStep === 5 },
  ];

  return (
    <div className="bg-[#FFFDF7] dark:bg-[#2A1733] border border-[rgba(212,167,44,0.3)] rounded-xl p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B2A86] dark:text-[#D4A72C]">
          TTD Booking Flow
        </span>
        <span className="text-[10px] text-[#6B5A70] dark:text-[#A898B0]">
          User-Reviewed Submission
        </span>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute left-3 right-3 top-3.5 h-[1.5px] bg-[#E5D7B7] dark:bg-[#4A2D5E] -z-0" />

        {steps.map((s, idx) => {
          const isDone = s.done;
          const isCurrent = s.current;

          let badgeBg = 'bg-[#FFF8E8] text-[#8B7D8F] border-[rgba(212,167,44,0.3)]';
          if (isDone) {
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
                {isDone ? '✓' : s.num}
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center truncate max-w-[56px] ${
                isCurrent ? 'text-[#5B2A86] dark:text-[#F0CC63] font-bold' : 'text-[#6B5A70] dark:text-[#A898B0]'
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
