import React from 'react';
import { Icon, type IconName } from './Icon';

export type BadgeVariant =
  | 'ready'
  | 'working'
  | 'actionRequired'
  | 'blocked'
  | 'completed'
  | 'neutral'
  | 'gold';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: IconName;
  showDot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  showDot = false,
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
  };

  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    ready: {
      container: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    working: {
      container: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-500 animate-pulse',
    },
    actionRequired: {
      container: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700',
      dot: 'bg-amber-500',
    },
    blocked: {
      container: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500',
    },
    completed: {
      container: 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800',
      dot: 'bg-purple-500',
    },
    neutral: {
      container: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    gold: {
      container: 'bg-[#FFF9E6] dark:bg-[#332514] text-[#8C6B10] dark:text-[#F3DB83] border border-[#D4A72C]/40',
      dot: 'bg-[#D4A72C]',
    },
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full tracking-wide select-none
        ${sizeStyles[size]}
        ${variantStyles[variant].container}
        ${className}
      `}
      {...props}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantStyles[variant].dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
