import React from 'react';

interface TempleDividerProps {
  className?: string;
  variant?: 'simple' | 'ornate' | 'compact';
}

export function TempleDivider({ className = '', variant = 'simple' }: TempleDividerProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center gap-2 my-2 opacity-75 ${className}`} aria-hidden="true">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
        <span className="text-[10px] text-gold-600 dark:text-gold-400">✦</span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
      </div>
    );
  }

  if (variant === 'ornate') {
    return (
      <div className={`flex items-center justify-center gap-2.5 my-3 ${className}`} aria-hidden="true">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold-500/50 to-gold-500/80" />
        <svg className="w-5 h-5 text-gold-600 dark:text-gold-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          {/* Subtle temple kalasam / lotus flower motif */}
          <path d="M12 2C12 2 10 5 10 7C10 8.1 10.9 9 12 9C13.1 9 14 8.1 14 7C14 5 12 2 12 2Z" />
          <path d="M12 10C8.5 10 6 12.5 6 15C6 17.5 8.5 19 12 19C15.5 19 18 17.5 18 15C18 12.5 15.5 10 12 10ZM12 17.5C9.5 17.5 8 16.5 8 15C8 13.5 9.5 12 12 12C14.5 12 16 13.5 16 15C16 16.5 14.5 17.5 12 17.5Z" />
          <circle cx="12" cy="21.5" r="1.5" />
          <circle cx="4" cy="15" r="1" opacity="0.6" />
          <circle cx="20" cy="15" r="1" opacity="0.6" />
        </svg>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-gold-500/50 to-gold-500/80" />
      </div>
    );
  }

  // Default clean simple temple divider
  return (
    <div className={`flex items-center justify-center gap-2.5 my-2.5 ${className}`} aria-hidden="true">
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold-500/40 to-gold-600/70" />
      <div className="flex items-center gap-1 text-gold-600 dark:text-gold-400">
        <span className="text-[7px] opacity-60">◆</span>
        <span className="text-[11px] font-serif">✦</span>
        <span className="text-[7px] opacity-60">◆</span>
      </div>
      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-gold-500/40 to-gold-600/70" />
    </div>
  );
}
