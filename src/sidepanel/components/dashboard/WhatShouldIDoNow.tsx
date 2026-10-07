// ─────────────────────────────────────────────────
// Tirumala SevaPilot — "What Should I Do Now?" Guidance
// Core UX Pillar: Always answers the user's next action clearly.
// ─────────────────────────────────────────────────

import React from 'react';

export type UserBookingStage =
  | 'NO_PROFILE'
  | 'PROFILE_READY'
  | 'RELEASE_APPROACHING'
  | 'TTD_PAGE_OPEN'
  | 'TEMPORARY_LOCK'
  | 'REVIEW_AND_PAYMENT';

export interface WhatShouldIDoNowProps {
  stage: UserBookingStage;
  onActionClick?: () => void;
  actionText?: string;
}

export const WhatShouldIDoNow: React.FC<WhatShouldIDoNowProps> = ({
  stage,
  onActionClick,
  actionText,
}) => {
  const getStageContent = () => {
    switch (stage) {
      case 'NO_PROFILE':
        return {
          title: 'Add your pilgrims first',
          step: '1. Preparation',
          description: 'Set up your devotee profiles and photo IDs before booking day so everything is ready in advance.',
          action: actionText || 'Create Profile ↗',
          badgeColor: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
        };
      case 'PROFILE_READY':
        return {
          title: 'Wait for next TTD release',
          step: '2. Readiness Ready',
          description: 'Your pilgrim profile and photo IDs are verified. When TTD booking opens, open the official portal.',
          action: actionText || 'Launch Portal ↗',
          badgeColor: 'bg-[#5B2A86]/10 text-[#5B2A86] dark:text-[#D4A72C]',
        };
      case 'RELEASE_APPROACHING':
        return {
          title: 'Prepare your booking session',
          step: '3. Pre-Release',
          description: 'Release opens shortly. Log in to TTD with your mobile OTP and keep SevaPilot ready.',
          action: actionText || 'Check Release Calendar',
          badgeColor: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
        };
      case 'TTD_PAGE_OPEN':
        return {
          title: 'Press Fill & Verify',
          step: '4. Live Booking',
          description: 'SevaPilot has prewarmed your details. Press Fill & Verify to populate all fields in under a second.',
          action: actionText || 'Proceed to Fill ↗',
          badgeColor: 'bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#4ADE80]',
        };
      case 'TEMPORARY_LOCK':
        return {
          title: 'Wait for TTD lock expiry',
          step: '5. Server Cooldown',
          description: 'TTD is holding your previous attempt. Do not re-enter details repeatedly; wait for the cooldown timer.',
          action: actionText || 'Wait to Retry',
          badgeColor: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
        };
      case 'REVIEW_AND_PAYMENT':
        return {
          title: 'Review and complete payment',
          step: '6. Final Confirmation',
          description: 'Your details have been verified. Double check pilgrim details on TTD and complete payment yourself.',
          action: actionText || 'Continue on TTD',
          badgeColor: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
        };
    }
  };

  const content = getStageContent();

  return (
    <div className="rounded-2xl border border-[#5B2A86]/15 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3.5 space-y-2 shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#735A88] dark:text-[#B6A2C7]">
          🧭 WHAT SHOULD I DO NOW?
        </span>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${content.badgeColor}`}>
          {content.step}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-black text-[#321B3F] dark:text-[#F8EFD8]">
          {content.title}
        </h4>
        <p className="text-[11px] text-[#735A88] dark:text-[#B6A2C7] leading-relaxed">
          {content.description}
        </p>
      </div>

      {onActionClick && (
        <button
          onClick={onActionClick}
          className="text-xs font-bold text-[#5B2A86] dark:text-[#D4A72C] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
        >
          <span>{content.action}</span>
        </button>
      )}
    </div>
  );
};
