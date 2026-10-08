import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus dialog for accessibility
      dialogRef.current?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-xs',
    md: 'max-w-sm',
    lg: 'max-w-md',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`
          w-full ${maxWidthStyles[maxWidth]}
          bg-white dark:bg-[#281830]
          border border-[rgba(84,37,138,0.15)] dark:border-[rgba(212,167,44,0.25)]
          rounded-2xl shadow-xl overflow-hidden
          flex flex-col max-h-[90vh]
          outline-none
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-black/5 dark:border-white/5">
          <div>
            <h3 id="dialog-title" className="text-sm font-bold text-[#321B3F] dark:text-[#F8EFD8]">
              {title}
            </h3>
            {description && (
              <p id="dialog-description" className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-black/5 dark:border-white/5 bg-[#FAF8F5] dark:bg-[#211526]/50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
