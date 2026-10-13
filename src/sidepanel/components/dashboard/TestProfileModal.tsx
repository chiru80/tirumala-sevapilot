import React from 'react';
import { Dialog, Button, Badge, Icon } from '../../design-system';
import type { ProfileReadinessReport } from '../../presentation/profile-readiness-tester';
import { t } from '@i18n/index';

export interface TestProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ProfileReadinessReport;
  onFixProfile: () => void;
  onOpenTtd: () => void;
}

export const TestProfileModal: React.FC<TestProfileModalProps> = ({
  isOpen,
  onClose,
  report,
  onFixProfile,
  onOpenTtd,
}) => {
  const { isReady, headline, summary, checklist, serviceName, ticketPrice, missingItems } = report;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('testProfile.title') || 'Pre-Booking Readiness Check'}
      description={t('testProfile.desc') || 'Verifies your profile against official TTD rules before booking opens.'}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close') || 'Close'}
          </Button>

          {isReady ? (
            <Button
              variant="primary"
              size="sm"
              leadingIcon="external-link"
              onClick={() => {
                onClose();
                onOpenTtd();
              }}
            >
              {t('nextAction.openTtdBtn') || 'Open TTD'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leadingIcon="arrow-right"
              onClick={() => {
                onClose();
                onFixProfile();
              }}
            >
              {t('readiness.fixProfile') || 'Fix profile'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner with Status */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isReady
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8]">
              {serviceName} {ticketPrice ? `(₹${ticketPrice})` : ''}
            </span>
            <Badge variant={isReady ? 'ready' : 'actionRequired'} size="sm">
              {isReady ? (t('dashboard.ready') || 'Ready') : (t('readiness.actionRequired') || 'Action Required')}
            </Badge>
          </div>
          <p className="text-xs font-semibold text-[#321B3F] dark:text-[#F8EFD8]">
            {headline}: {summary}
          </p>
        </div>

        {/* Detailed Item Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B5A70] dark:text-[#A692B4]">
            {t('testProfile.verificationChecklist') || 'Verification Checklist'}
          </h4>

          <div className="space-y-1.5 rounded-xl border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
            {checklist.map((c) => (
              <div key={c.id} className="p-2.5 bg-white dark:bg-[#2C1A35] flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                      c.passed
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                    }`}
                  >
                    {c.passed ? '✓' : '!'}
                  </span>
                  <div>
                    <p className={`font-semibold ${c.passed ? 'text-[#321B3F] dark:text-[#F8EFD8]' : 'text-amber-900 dark:text-amber-200'}`}>
                      {c.label}
                    </p>
                    {c.message && (
                      <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                        {c.message}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                    c.passed
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  }`}
                >
                  {c.passed ? (t('readiness.pass') || 'PASS') : (t('readiness.actionNeeded') || 'ACTION')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Invariant Notice */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <Icon name="shield" size={14} className="shrink-0 text-[#54258A] dark:text-[#D4A72C]" />
          <span>
            {t('testProfile.zeroBookingNotice') || 'This check only validates details locally. No booking actions or network requests are performed.'}
          </span>
        </div>
      </div>
    </Dialog>
  );
};
