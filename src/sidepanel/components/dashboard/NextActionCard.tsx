import React from 'react';
import { Card, Badge, Button, Icon } from '../../design-system';
import type { NextActionModel } from '../../presentation/next-action';

export interface NextActionCardProps {
  model: NextActionModel;
  onPrimaryClick: () => void;
  onSecondaryClick?: () => void;
  className?: string;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  model,
  onPrimaryClick,
  onSecondaryClick,
  className = '',
}) => {
  const {
    badgeVariant,
    statusText,
    headline,
    description,
    primaryAction,
    secondaryAction,
    missingDetails,
    safetyNotice,
  } = model;

  return (
    <Card
      variant="default"
      padding="lg"
      className={`relative overflow-hidden border-2 transition-all duration-200 ${
        badgeVariant === 'ready'
          ? 'border-emerald-500/40 bg-gradient-to-b from-white to-emerald-50/20 dark:from-[#2C1A35] dark:to-[#172E22]/20'
          : badgeVariant === 'working'
          ? 'border-blue-500/40 bg-gradient-to-b from-white to-blue-50/20 dark:from-[#2C1A35] dark:to-[#15233D]/20'
          : badgeVariant === 'actionRequired'
          ? 'border-amber-500/50 bg-gradient-to-b from-white to-amber-50/20 dark:from-[#2C1A35] dark:to-[#382613]/20'
          : badgeVariant === 'blocked'
          ? 'border-rose-500/40 bg-gradient-to-b from-white to-rose-50/20 dark:from-[#2C1A35] dark:to-[#331518]/20'
          : 'border-[rgba(84,37,138,0.15)] bg-white dark:bg-[#2C1A35]'
      } ${className}`}
    >
      <div className="space-y-3.5">
        {/* Status header with Badge */}
        <div className="flex items-center justify-between">
          <Badge variant={badgeVariant} showDot size="md">
            {statusText}
          </Badge>

          {badgeVariant === 'ready' && (
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Icon name="check" size={12} />
              100% Prepared
            </span>
          )}
        </div>

        {/* Big clean headline & human description */}
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#321B3F] dark:text-[#F8EFD8] tracking-tight leading-snug">
            {headline}
          </h2>
          <p className="text-xs text-[#6B5A70] dark:text-[#C5B4D4] leading-relaxed font-medium">
            {description}
          </p>
        </div>

        {/* Missing detail highlights if any */}
        {missingDetails && missingDetails.length > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Icon name="alert-triangle" size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold truncate">
              Missing: {missingDetails.join(', ')}
            </span>
          </div>
        )}

        {/* Safety boundary reminder if required */}
        {safetyNotice && (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Icon name="shield" size={13} className="shrink-0 text-[#54258A] dark:text-[#D4A72C]" />
            <span>{safetyNotice}</span>
          </div>
        )}

        {/* Primary CTA + Secondary CTA */}
        <div className="pt-1 space-y-2">
          <Button
            id="sp-hero-primary-action-btn"
            variant={primaryAction.variant}
            size="lg"
            fullWidth
            onClick={onPrimaryClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Button>

          {secondaryAction && secondaryAction.actionType !== 'NONE' && onSecondaryClick && (
            <button
              type="button"
              onClick={onSecondaryClick}
              className="w-full text-center text-xs font-semibold text-[#6B5A70] hover:text-[#321B3F] dark:text-[#A692B4] dark:hover:text-[#F8EFD8] py-1 cursor-pointer transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};
