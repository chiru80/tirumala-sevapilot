import React, { useEffect, useRef, useState } from 'react';
import { Card, Badge, Button, Icon } from '../../design-system';
import { t } from '@i18n/index';

export type SessionStateType = 'CAPTCHA' | 'OTP' | 'QUEUE' | 'EXPIRED' | 'TEMPORARY_LOCK';

export interface SafeSessionGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialState?: SessionStateType;
}

export const SafeSessionGuidanceModal: React.FC<SafeSessionGuidanceModalProps> = ({
  isOpen,
  onClose,
  initialState = 'CAPTCHA',
}) => {
  const [selectedState, setSelectedState] = useState<SessionStateType>(initialState);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedState(initialState);
  }, [initialState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const statesConfig: Array<{
    id: SessionStateType;
    title: string;
    icon: 'shield' | 'lock' | 'clock' | 'alert-circle' | 'refresh-cw';
    badge: string;
    badgeVariant: 'ready' | 'working' | 'actionRequired' | 'blocked' | 'neutral';
    whyItAppears: string;
    devoteeAction: string;
    safetyBoundary: string;
  }> = [
    {
      id: 'CAPTCHA',
      title: t('safeSession.captchaTitle') || 'CAPTCHA Security Verification',
      icon: 'shield',
      badge: t('safeSession.actionRequired') || 'Action Required',
      badgeVariant: 'actionRequired',
      whyItAppears:
        t('safeSession.captchaWhy') ||
        "TTD deploys CAPTCHA checkpoints to verify that requests originate from genuine human devotees rather than automated scrapers or bots.",
      devoteeAction:
        t('safeSession.captchaAction') ||
        "Solve the visual challenge or alphanumeric text directly on the active TTD browser tab. Once solved, continue to the next step.",
      safetyBoundary:
        t('safeSession.captchaBoundary') ||
        "SevaPilot strictly never touches, auto-solves, or bypasses CAPTCHA inputs. All security challenges remain 100% devotee-controlled.",
    },
    {
      id: 'OTP',
      title: t('safeSession.otpTitle') || 'Mobile SMS OTP Verification',
      icon: 'lock',
      badge: t('safeSession.humanAction') || 'Human Verification',
      badgeVariant: 'actionRequired',
      whyItAppears:
        t('safeSession.otpWhy') ||
        "TTD requires two-factor identity verification by dispatching a numeric one-time password to your registered Indian mobile number.",
      devoteeAction:
        t('safeSession.otpAction') ||
        "Check your mobile SMS messages, enter the received 6-digit code manually into the TTD portal field, and click Verify.",
      safetyBoundary:
        t('safeSession.otpBoundary') ||
        "SevaPilot never intercepts, requests, reads, or transmits OTPs. Your personal mobile verification remains strictly confidential and manual.",
    },
    {
      id: 'QUEUE',
      title: t('safeSession.queueTitle') || 'Digital Waiting Queue',
      icon: 'clock',
      badge: t('safeSession.passiveWaiting') || 'Passive Waiting',
      badgeVariant: 'working',
      whyItAppears:
        t('safeSession.queueWhy') ||
        "During quota releases, hundreds of thousands of devotees access the portal simultaneously. TTD assigns virtual queue tokens to manage traffic safely.",
      devoteeAction:
        t('safeSession.queueAction') ||
        "Wait patiently in your existing tab. Do NOT refresh the page, close the browser, or open duplicate booking tabs, as doing so may forfeit your position.",
      safetyBoundary:
        t('safeSession.queueBoundary') ||
        "SevaPilot provides passive, non-intrusive queue monitoring. It never sends burst polling requests or attempts queue-jumping manipulation.",
    },
    {
      id: 'EXPIRED',
      title: t('safeSession.expiredTitle') || 'Session Expired',
      icon: 'alert-circle',
      badge: t('safeSession.sessionEnded') || 'Session Ended',
      badgeVariant: 'blocked',
      whyItAppears:
        t('safeSession.expiredWhy') ||
        "TTD session tokens have a strict security lifetime (usually 10-15 minutes). If left idle or if payment times out, the server terminates the session.",
      devoteeAction:
        t('safeSession.expiredAction') ||
        "Return to the official TTD homepage (ttdevasthanams.ap.gov.in), log in afresh with your mobile number, and initiate a new booking flow.",
      safetyBoundary:
        t('safeSession.expiredBoundary') ||
        "SevaPilot never attempts to force-revalidate or spoof an expired session token. Devotees are guided to restart safely.",
    },
    {
      id: 'TEMPORARY_LOCK',
      title: t('safeSession.lockTitle') || 'Temporary Slot Hold / Lock',
      icon: 'alert-circle',
      badge: t('safeSession.serverHold') || 'Server-Side Hold',
      badgeVariant: 'blocked',
      whyItAppears:
        t('safeSession.lockWhy') ||
        "If a previous booking attempt was interrupted, payment cancelled, or concurrent login detected, TTD temporarily reserves the slot token for 5–10 minutes.",
      devoteeAction:
        t('safeSession.lockAction') ||
        "Wait for the cooldown timer to elapse naturally. You may also check 'Booking History' on the official TTD site to verify if a prior payment was already recorded.",
      safetyBoundary:
        t('safeSession.lockBoundary') ||
        "SevaPilot strictly eliminates automated retry buttons while a lock is active, preventing repeated attempts that would extend TTD's server-side cooldown hold.",
    },
  ];

  const current = statesConfig.find((s) => s.id === selectedState) || statesConfig[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safe-session-guidance-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-[430px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#25142E] border border-black/15 dark:border-white/15 p-4 shadow-xl space-y-3.5 focus:outline-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#54258A] dark:bg-[#D4A72C]" />
            <h2 id="safe-session-guidance-title" className="text-xs font-bold uppercase tracking-wider text-[#54258A] dark:text-[#D4A72C]">
              {t('safeSession.title') || 'SAFE SESSION GUIDANCE'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close') || 'Close dialog'}
            className="p-1 rounded-lg text-[#6B5A70] hover:text-black dark:text-[#A692B4] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* State Selector Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none" role="tablist">
          {statesConfig.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={selectedState === s.id}
              onClick={() => setSelectedState(s.id)}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer select-none ${
                selectedState === s.id
                  ? 'bg-[#54258A] text-white dark:bg-[#D4A72C] dark:text-[#25142E]'
                  : 'bg-black/5 dark:bg-white/5 text-[#6B5A70] dark:text-[#C5B4D4] hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {s.title.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Selected State Details Card */}
        <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#FAF7F2] dark:bg-[#2C1A35] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Icon name={current.icon} size={16} className="text-[#54258A] dark:text-[#D4A72C]" />
              <h3 className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
                {current.title}
              </h3>
            </div>
            <Badge variant={current.badgeVariant} size="sm">
              {current.badge}
            </Badge>
          </div>

          {/* Why It Appears */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B5A70] dark:text-[#A692B4] block">
              {t('safeSession.whyHeading') || 'Why does this appear on TTD?'}
            </span>
            <p className="text-xs text-[#321B3F] dark:text-[#F8EFD8] leading-relaxed">
              {current.whyItAppears}
            </p>
          </div>

          {/* Devotee Action */}
          <div className="space-y-1 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              {t('safeSession.actionHeading') || 'What should you do?'}
            </span>
            <p className="text-xs text-emerald-900 dark:text-emerald-100 font-medium leading-relaxed">
              {current.devoteeAction}
            </p>
          </div>

          {/* Safety Compliance Invariant */}
          <div className="space-y-1 p-2.5 rounded-lg bg-black/3 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B5A70] dark:text-[#A692B4] block flex items-center gap-1">
              <Icon name="shield" size={11} className="text-[#54258A] dark:text-[#D4A72C]" />
              {t('safeSession.boundaryHeading') || 'Policy & Safety Boundary'}
            </span>
            <p className="text-[11px] text-[#6B5A70] dark:text-[#C5B4D4] leading-relaxed">
              {current.safetyBoundary}
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-[11px] text-center text-[#6B5A70] dark:text-[#A692B4] pt-1">
          {t('safeSession.neverBypassNote') ||
            'Tirumala SevaPilot never circumvents anti-bot checks or restrictions on any TTD service.'}
        </div>

        {/* Close Button */}
        <Button variant="primary" size="md" fullWidth onClick={onClose}>
          {t('common.gotIt') || 'Got It'}
        </Button>
      </div>
    </div>
  );
};
