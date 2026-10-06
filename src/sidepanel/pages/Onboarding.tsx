import React, { useState } from 'react';
import { saveSettings } from '@storage/repository';
import { TempleDivider } from '../components/TempleDivider';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      num: '1 / 5',
      title: 'Create Your Pilgrim Profile',
      description: 'Add your devotee details (Name, Age, Gender, Aadhaar, Mobile) once. All information stays strictly inside your browser.',
      icon: '👤',
    },
    {
      num: '2 / 5',
      title: 'Organize Booking Squads',
      description: 'Group family members or friends into squads matching TTD darshan quota limits (e.g., up to 6 pilgrims for Special Entry Darshan).',
      icon: '👥',
    },
    {
      num: '3 / 5',
      title: 'Open Official TTD Portal',
      description: 'Navigate to ttdevasthanams.ap.gov.in. SevaPilot automatically recognizes whether you are booking Darshan or Accommodation.',
      icon: '🛕',
    },
    {
      num: '4 / 5',
      title: 'Pre-Flight Safety Review',
      description: 'Verify your devotee details and readiness checklist before autofilling. SevaPilot ensures no incomplete profiles are submitted.',
      icon: '🔍',
    },
    {
      num: '5 / 5',
      title: '1-Click Fast Autofill',
      description: 'When the booking window opens, populate all devotee rows accurately in under 1 second. You maintain full control over final submission.',
      icon: '⚡',
    },
  ];

  async function handleFinish() {
    await saveSettings({ onboardingComplete: true });
    onComplete();
  }

  const current = steps[step];

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF7] dark:bg-[#211526] text-[#321B3F] dark:text-[#FFF8E8] transition-colors p-6 justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7650A3] via-[#5B2A86] to-[#421B68] flex items-center justify-center text-[#F0CC63] shadow-sm border border-[#D4A72C]">
              🛕
            </div>
            <div>
              <h1 className="font-serif font-bold text-base text-[#5B2A86] dark:text-[#F0CC63] leading-none">
                SevaPilot
              </h1>
              <p className="text-[10px] text-[#6B5A70] dark:text-[#A898B0] mt-0.5">
                TTD Booking Preparation Assistant
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#FFF8E8] dark:bg-[#321B3F] border border-[rgba(212,167,44,0.4)] text-[#5B2A86] dark:text-[#F0CC63]">
            {current.num}
          </span>
        </div>

        <div className="mt-3">
          <TempleDivider variant="compact" />
        </div>
      </div>

      {/* Slide Body */}
      <div className="flex flex-col items-center text-center my-auto py-6 space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-[#FFF8E8] dark:bg-[#321B3F] border-2 border-[#D4A72C] flex items-center justify-center text-4xl shadow-md">
          {current.icon}
        </div>

        <h2 className="font-serif font-bold text-lg text-[#5B2A86] dark:text-[#F0CC63] tracking-wide">
          {current.title}
        </h2>

        <p className="text-xs text-[#6B5A70] dark:text-[#A898B0] leading-relaxed max-w-xs">
          {current.description}
        </p>

        {/* Progress dots */}
        <div className="flex gap-1.5 pt-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === step
                  ? 'w-6 bg-[#5B2A86] dark:bg-[#F0CC63]'
                  : 'w-1.5 bg-[#D4A72C]/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2">
        {step < steps.length - 1 ? (
          <>
            <button
              onClick={() => setStep(s => s + 1)}
              className="w-full py-2.5 bg-gradient-to-r from-[#5B2A86] to-[#421B68] text-white rounded-xl text-xs font-bold border border-[#D4A72C] shadow-sm hover:from-[#421B68] hover:to-[#321450] cursor-pointer"
            >
              Continue ({step + 1}/5) →
            </button>
            <button
              onClick={handleFinish}
              className="w-full py-2 bg-transparent text-xs text-[#6B5A70] dark:text-[#A898B0] hover:text-[#321B3F] cursor-pointer"
            >
              Skip Onboarding
            </button>
          </>
        ) : (
          <button
            onClick={handleFinish}
            className="w-full py-3 bg-gradient-to-r from-[#5B2A86] via-[#4A216E] to-[#421B68] text-white rounded-xl text-xs font-bold border-2 border-[#D4A72C] shadow-md hover:border-[#F0CC63] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🛕</span>
            <span>Get Started with SevaPilot</span>
            <span className="text-[#F0CC63]">✦</span>
          </button>
        )}
      </div>
    </div>
  );
}
