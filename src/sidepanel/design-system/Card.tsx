import React from 'react';

export type CardVariant = 'default' | 'interactive' | 'elevated' | 'highlighted' | 'accent';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-2.5',
    md: 'p-3.5',
    lg: 'p-5',
  };

  const variantStyles: Record<CardVariant, string> = {
    default: 'bg-white dark:bg-[#2C1A35] border border-[rgba(84,37,138,0.1)] dark:border-[rgba(212,167,44,0.18)] shadow-2xs',
    interactive: 'bg-white dark:bg-[#2C1A35] border border-[rgba(84,37,138,0.12)] dark:border-[rgba(212,167,44,0.2)] shadow-xs hover:border-[#54258A]/30 dark:hover:border-[#D4A72C]/40 hover:shadow-sm cursor-pointer transition-all duration-150',
    elevated: 'bg-white dark:bg-[#2C1A35] border border-[rgba(84,37,138,0.08)] dark:border-[rgba(212,167,44,0.15)] shadow-md',
    highlighted: 'bg-[#FAF7F2] dark:bg-[#281830] border-2 border-[#D4A72C]/50 dark:border-[#D4A72C]/60 shadow-xs',
    accent: 'bg-gradient-to-br from-[#FAF8FC] to-[#F5EFFB] dark:from-[#2A1635] dark:to-[#22132B] border border-[#54258A]/20 dark:border-[#54258A]/40 shadow-xs',
  };

  return (
    <div
      className={`
        rounded-2xl
        transition-colors duration-150
        ${paddingStyles[padding]}
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
