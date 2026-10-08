import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = 'md',
  className = '',
  style,
  ...props
}) => {
  const roundedStyles = {
    sm: 'rounded-sm',
    md: 'rounded-lg',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      className={`
        bg-slate-200/70 dark:bg-slate-800/70
        animate-pulse
        ${roundedStyles[rounded]}
        ${className}
      `}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};
