import React from 'react';
import { BackButton } from './BackButton';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  action,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`border-b border-black/5 dark:border-white/5 pb-2.5 flex items-center justify-between gap-2 select-none ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {onBack && <BackButton onClick={onBack} />}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold font-serif tracking-tight text-[#54258A] dark:text-[#F8EFD8] truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] font-medium truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
