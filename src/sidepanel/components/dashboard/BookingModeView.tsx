import React from 'react';
import { Card, Badge, Button, Icon } from '../../design-system';
import type { NextActionModel } from '../../presentation/next-action';
import { t } from '@i18n/index';

export interface BookingModeViewProps {
  serviceDisplayName: string;
  ticketPrice?: number;
  releaseTimingText?: string;
  preparedPilgrimCount: number;
  nextAction: NextActionModel;
  onPrimaryAction: () => void;
  onExitBookingMode: () => void;
  className?: string;
}

export const BookingModeView: React.FC<BookingModeViewProps> = ({
  serviceDisplayName,
  ticketPrice,
  releaseTimingText,
  preparedPilgrimCount,
  nextAction,
  onPrimaryAction,
  onExitBookingMode,
  className = '',
}) => {
  const { badgeVariant, statusText, headline, description, primaryAction } = nextAction;

  return (
    <div className={`p-4 space-y-4 animate-in fade-in duration-200 ${className}`}>
      {/* Top Header Mode Indicator */}
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#54258A] dark:bg-[#D4A72C] animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#54258A] dark:text-[#F8EFD8]">
            {t('bookingMode.title') || 'BOOKING MODE'}
          </h2>
        </div>

        <button
          type="button"
          onClick={onExitBookingMode}
          className="text-xs font-semibold text-[#6B5A70] hover:text-[#321B3F] dark:text-[#A692B4] dark:hover:text-[#F8EFD8] cursor-pointer"
        >
          {t('bookingMode.exit') || 'Exit Mode'}
        </button>
      </div>

      {/* Main Focus Card */}
      <Card
        variant="elevated"
        padding="lg"
        className="space-y-5 text-center bg-gradient-to-b from-white to-[#FAF8F5] dark:from-[#2C1A35] dark:to-[#22132B] border-2 border-[#54258A]/30 dark:border-[#D4A72C]/40 shadow-lg"
      >
        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={badgeVariant} showDot size="md" className="px-3 py-1 text-xs">
            {statusText}
          </Badge>
        </div>

        {/* Big Service Name */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#321B3F] dark:text-[#F8EFD8] tracking-tight">
            {serviceDisplayName} {ticketPrice ? `(₹${ticketPrice})` : ''}
          </h3>
          <p className="text-xs text-[#6B5A70] dark:text-[#C5B4D4] font-medium">
            {t('bookingMode.pilgrimsPrepared', { count: preparedPilgrimCount }) || `${preparedPilgrimCount} Devotee(s) Prepared`}
          </p>
        </div>

        {/* Release Context if available */}
        {releaseTimingText && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs text-[#321B3F] dark:text-[#F8EFD8] font-semibold">
            <Icon name="clock" size={14} className="text-[#54258A] dark:text-[#D4A72C]" />
            <span>{releaseTimingText}</span>
          </div>
        )}

        {/* Action Description */}
        <div className="space-y-1 py-1">
          <p className="text-sm font-bold text-[#321B3F] dark:text-[#F8EFD8]">
            {headline}
          </p>
          <p className="text-xs text-[#6B5A70] dark:text-[#C5B4D4] leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="pt-2 space-y-3">
          <Button
            variant={primaryAction.variant === 'gold' ? 'gold' : primaryAction.variant === 'danger' ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            onClick={onPrimaryAction}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={onExitBookingMode}
          >
            {t('bookingMode.stopBookingMode') || 'Stop Booking Mode'}
          </Button>
        </div>
      </Card>

      {/* Safety & Passive Observer Invariant Guarantee */}
      <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#2C1A35]/70 border border-black/5 dark:border-white/5 text-center space-y-1">
        <p className="text-[11px] font-semibold text-[#54258A] dark:text-[#D4A72C] flex items-center justify-center gap-1.5">
          <Icon name="shield" size={13} />
          {t('safety.safeAssistanceTitle') || 'Zero Automation Boundaries'}
        </p>
        <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] leading-relaxed">
          {t('safety.safeAssistanceDesc') || 'SevaPilot assists with fast field entry. CAPTCHA, OTP, and payments remain strictly in your control.'}
        </p>
      </div>
    </div>
  );
};
