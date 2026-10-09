import React from 'react';
import { Card, Icon, Badge } from '../../design-system';
import type { ProfileReadinessReport } from '../../presentation/profile-readiness-tester';
import { t } from '@i18n/index';

export interface BookingReadinessSummaryProps {
  report: ProfileReadinessReport;
  onFixClick: () => void;
  onTestClick: () => void;
  className?: string;
}

export const BookingReadinessSummary: React.FC<BookingReadinessSummaryProps> = ({
  report,
  onFixClick,
  onTestClick,
  className = '',
}) => {
  const { isReady, checklist, passedChecks, totalChecks, missingItems, serviceName } = report;

  return (
    <Card variant="default" padding="md" className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isReady ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-bold uppercase tracking-wider text-[#321B3F] dark:text-[#F8EFD8]">
            {t('readiness.bookingReadiness') || 'Booking Readiness'}
          </span>
        </div>

        <Badge variant={isReady ? 'ready' : 'actionRequired'} size="sm">
          {isReady ? `${passedChecks}/${totalChecks} Ready` : `${missingItems.length} Missing`}
        </Badge>
      </div>

      {/* Service-aware Checklist Items */}
      <div className="space-y-1.5 pt-0.5">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                  item.passed
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                }`}
                aria-hidden="true"
              >
                {item.passed ? '✓' : '!'}
              </span>
              <span
                className={`truncate font-medium ${
                  item.passed
                    ? 'text-[#321B3F] dark:text-[#F8EFD8]'
                    : 'text-amber-800 dark:text-amber-300 font-semibold'
                }`}
              >
                {item.label}
              </span>
            </div>

            <span className="text-[11px] font-medium text-[#6B5A70] dark:text-[#A692B4] shrink-0 ml-2">
              {item.passed ? (t('readiness.ready') || 'Ready') : (t('readiness.needed') || 'Needed')}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Summary / Quick Action */}
      <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
        <span className="text-[#6B5A70] dark:text-[#A692B4] font-medium text-[11px] truncate">
          {serviceName}
        </span>

        {isReady ? (
          <button
            type="button"
            onClick={onTestClick}
            className="font-semibold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
          >
            {t('readiness.testDetails') || 'Test Details'} →
          </button>
        ) : (
          <button
            type="button"
            onClick={onFixClick}
            className="font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{t('readiness.fixProfile') || 'Fix profile'}</span>
            <Icon name="arrow-right" size={12} />
          </button>
        )}
      </div>
    </Card>
  );
};
