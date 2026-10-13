import React from 'react';
import { Icon, type IconName } from './Icon';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: IconName;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  icon,
  action,
  onDismiss,
  className = '',
}) => {
  const defaultIcons: Record<AlertVariant, IconName> = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    error: 'alert-circle',
  };

  const variantStyles: Record<AlertVariant, {
    container: string;
    icon: string;
    title: string;
    body: string;
  }> = {
    info: {
      container: 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-200',
      body: 'text-blue-800 dark:text-blue-300',
    },
    success: {
      container: 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60',
      icon: 'text-emerald-600 dark:text-emerald-400',
      title: 'text-emerald-900 dark:text-emerald-200',
      body: 'text-emerald-800 dark:text-emerald-300',
    },
    warning: {
      container: 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-800/60',
      icon: 'text-amber-600 dark:text-amber-400',
      title: 'text-amber-950 dark:text-amber-100',
      body: 'text-amber-900 dark:text-amber-200',
    },
    error: {
      container: 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60',
      icon: 'text-rose-600 dark:text-rose-400',
      title: 'text-rose-950 dark:text-rose-100',
      body: 'text-rose-900 dark:text-rose-200',
    },
  };

  const currentIcon = icon || defaultIcons[variant];
  const styles = variantStyles[variant];

  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={`
        rounded-2xl border p-3.5 shadow-2xs transition-all duration-150
        ${styles.container}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${styles.icon}`}>
          <Icon name={currentIcon} size={18} />
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-xs font-bold leading-tight mb-1 ${styles.title}`}>
              {title}
            </h4>
          )}
          <div className={`text-xs leading-relaxed font-medium ${styles.body}`}>
            {children}
          </div>

          {action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={action.onClick}
                className="text-xs font-bold underline hover:no-underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 rounded-sm"
              >
                {action.label} →
              </button>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
