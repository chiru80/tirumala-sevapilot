import React from 'react';
import { Icon } from './Icon';
import { t } from '@i18n/index';

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
  label?: string;
  showText?: boolean;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label,
  showText = false,
  className = '',
  ...props
}) => {
  const accessibleLabel = label || t('common.back') || t('nav.back') || 'Back';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={`
        inline-flex items-center justify-center gap-1.5
        min-h-[36px] min-w-[36px] px-2 py-1.5 rounded-xl
        text-[#54258A] dark:text-[#D4A72C]
        hover:bg-[#54258A]/10 dark:hover:bg-[#D4A72C]/15
        active:scale-95 transition-all duration-150
        cursor-pointer select-none
        focus-visible:outline-2 focus-visible:outline-[#54258A] dark:focus-visible:outline-[#D4A72C] focus-visible:outline-offset-2
        shrink-0
        ${className}
      `}
      {...props}
    >
      <Icon name="arrow-left" size={18} className="shrink-0" />
      {showText && (
        <span className="text-xs font-semibold">{accessibleLabel}</span>
      )}
    </button>
  );
};
