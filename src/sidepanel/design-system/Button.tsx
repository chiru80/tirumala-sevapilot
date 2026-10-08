import React from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  className = '',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
    lg: 'text-base px-5 py-3 min-h-[48px] gap-2.5 shadow-sm',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[#54258A] hover:bg-[#431D6E] text-white focus-visible:outline-[#54258A] shadow-xs hover:shadow-md border border-[#54258A]/30',
    secondary: 'bg-[#F5F2EA] hover:bg-[#ECE7DA] text-[#321B3F] dark:bg-[#2E1E36] dark:hover:bg-[#382642] dark:text-[#F8EFD8] border border-[rgba(84,37,138,0.12)] dark:border-[rgba(212,167,44,0.2)] focus-visible:outline-[#54258A]',
    outline: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[#54258A] dark:text-[#E9D5FF] border border-[#54258A]/30 dark:border-[#A855F7]/30 focus-visible:outline-[#54258A]',
    ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[#6B5A70] dark:text-[#A692B4] hover:text-[#321B3F] dark:hover:text-[#F8EFD8] focus-visible:outline-[#54258A]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:outline-rose-600 shadow-xs border border-rose-700/30',
    gold: 'bg-[#D4A72C] hover:bg-[#BF9320] text-[#2A1733] font-bold focus-visible:outline-[#D4A72C] shadow-xs border border-[#D4A72C]/40',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
      ) : leadingIcon ? (
        <Icon name={leadingIcon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="shrink-0" />
      ) : null}

      <span>{children}</span>

      {!isLoading && trailingIcon && (
        <Icon name={trailingIcon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="shrink-0" />
      )}
    </button>
  );
});

Button.displayName = 'Button';
