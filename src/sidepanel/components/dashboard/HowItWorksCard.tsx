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
      title: t('home.step2Title') || 'SELECT PILGRIMS',
      desc: t('home.step2Desc') || 'Choose who is travelling.',
    },
    {
      num: '③',
      title: t('home.step3Title') || 'FILL & VERIFY',
      desc: t('home.step3Desc') || 'Fill supported TTD forms and verify the details.',
    },
  ];

  return (
    <div
      className="rounded-2xl border border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2A1733] p-4 shadow-2xs space-y-3"
      role="region"
      aria-label={t('home.howItWorks') || 'How It Works'}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D4A72C]" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
          {t('home.howItWorks') || 'HOW IT WORKS'}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-0.5">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center text-center p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#22132A] border border-[rgba(84,37,138,0.06)] dark:border-[rgba(212,167,44,0.1)]"
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
    </div>
  );
};
