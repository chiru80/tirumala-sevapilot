import React from 'react';
import { t } from '@i18n/index';

export const HowItWorksCard: React.FC = () => {
  const steps = [
    {
      num: '①',
      title: t('home.step1Title') || 'CREATE PROFILE',
      desc: t('home.step1Desc') || 'Save your pilgrim details once.',
    },
    {
      num: '②',
      title: t('home.step2Title') || 'OPEN TTD & SELECT PILGRIMS',
      desc: t('home.step2Desc') || 'Open official TTD portal and choose who is travelling.',
    },
    {
      num: '③',
      title: t('home.step3Title') || 'FILL & VERIFY',
      desc: t('home.step3Desc') || '1-click autofill with instant verification.',
    },
    {
      num: '④',
      title: t('home.step4Title') || 'YOU STAY IN CONTROL',
      desc: t('home.step4Desc') || 'CAPTCHA, OTP, and payments remain 100% yours.',
    },
  ];

  return (
    <div
      className="rounded-2xl border border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2A1733] p-4 shadow-2xs space-y-3"
      role="region"
      aria-label={t('home.howItWorks') || 'How It Works'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A72C]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
            {t('home.howItWorks') || 'HOW IT WORKS'}
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
          Private & Secure
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center text-center p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#22132A] border border-[rgba(84,37,138,0.06)] dark:border-[rgba(212,167,44,0.1)] transition-all hover:border-[#D4A72C]/40"
          >
            <span className="text-sm font-bold text-[#D4A72C] dark:text-[#F0CC63] mb-1">
              {step.num}
            </span>
            <span className="text-[11px] font-bold text-[#30213A] dark:text-[#F8EFD8] leading-tight mb-1">
              {step.title}
            </span>
            <p className="text-[10px] text-[#6F6477] dark:text-[#C5B4D4] leading-normal font-medium">
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Trust Highlight: You Stay in Control */}
      <div className="mt-2 rounded-xl bg-gradient-to-r from-emerald-50/80 to-amber-50/60 dark:from-emerald-950/20 dark:to-amber-950/20 border border-emerald-500/20 p-2.5 flex items-center gap-2.5">
        <span className="text-sm shrink-0">🛡️</span>
        <div className="text-[11px] leading-tight text-[#4A3B52] dark:text-[#E2D4EE]">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">You stay in complete control: </span>
          <span>SevaPilot never automates CAPTCHA, OTP, or payments. All pilgrim data remains strictly on your computer.</span>
        </div>
      </div>
    </div>
  );
};
