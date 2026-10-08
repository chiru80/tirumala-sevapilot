import React from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'sparkles',
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-6 rounded-2xl
        border border-dashed border-slate-200 dark:border-slate-800
        bg-white/50 dark:bg-black/10
        ${className}
      `}
    >
      <div className="w-10 h-10 rounded-full bg-[#54258A]/10 dark:bg-[#D4A72C]/10 flex items-center justify-center text-[#54258A] dark:text-[#D4A72C] mb-3">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="text-sm font-bold text-[#321B3F] dark:text-[#F8EFD8] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] max-w-xs leading-relaxed mb-4">
        {description}
      </p>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
