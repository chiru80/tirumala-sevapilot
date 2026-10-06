import React from 'react';
import type { NotificationItem } from '@shared/types';
import { t } from '@i18n/index';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  onNavigate?: (route: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onClearAll,
  onNavigate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#321B3F]/60 backdrop-blur-xs flex items-start justify-center pt-16 p-4">
      <div className="bg-[#FFFDF7] dark:bg-[#211526] border-2 border-[#D4A72C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-[#5B2A86] text-white p-3.5 border-b border-[#D4A72C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <h3 className="font-serif font-bold text-sm text-[#F0CC63]">
              {t('notifications.title')}
            </h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="text-xs font-bold bg-[#B3261E] text-white px-2 py-0.5 rounded-full">
                {notifications.filter(n => !n.read).length} {t('notifications.new')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-[#E5D7B7] hover:text-white underline cursor-pointer"
              >
                {t('notifications.clearAll')}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:text-[#F0CC63] text-sm font-bold p-1 cursor-pointer"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-3.5 overflow-y-auto space-y-2 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8B7D8F]">
              {t('notifications.noNotifications')}
            </div>
          ) : (
            notifications.map(n => {
              let icon = 'ℹ';
              let badgeColor = 'text-[#5B2A86] bg-[#5B2A86]/10';

              if (n.type === 'success') {
                icon = '✓';
                badgeColor = 'text-[#2E7D5B] bg-[#2E7D5B]/10';
              } else if (n.type === 'warning') {
                icon = '⚠';
                badgeColor = 'text-[#D4A72C] bg-[#D4A72C]/15';
              } else if (n.type === 'error') {
                icon = '✕';
                badgeColor = 'text-[#B3261E] bg-[#B3261E]/10';
              }

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (n.actionRoute && onNavigate) {
                      onNavigate(n.actionRoute);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    n.read
                      ? 'bg-[#FFFDF7] dark:bg-[#2A1733]/50 border-[rgba(212,167,44,0.2)] opacity-75'
                      : 'bg-[#FFF8E8] dark:bg-[#321B3F] border-[#D4A72C] shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${badgeColor}`}>
                      {icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#321B3F] dark:text-[#F8EFD8] truncate">
                          {n.title}
                        </span>
                        <span className="text-xs text-[#8B7D8F] shrink-0">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B5A70] dark:text-[#A692B4] mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
