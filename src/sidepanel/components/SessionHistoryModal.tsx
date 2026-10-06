import React from 'react';
import type { SessionHistoryItem } from '@shared/types';
import { t } from '@i18n/index';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionHistoryItem[];
  onClearHistory: () => void;
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#321B3F]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF7] dark:bg-[#211526] border-2 border-[#D4A72C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#5B2A86] text-white p-3.5 border-b border-[#D4A72C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📜</span>
            <h3 className="font-serif font-bold text-sm text-[#F0CC63]">
              {t('sessionHistory.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-[#F0CC63] text-sm font-bold p-1 cursor-pointer"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Notice */}
        <div className="bg-[#FFF8E8] dark:bg-[#2A1733] p-3 border-b border-[rgba(212,167,44,0.3)] text-xs text-[#6B5A70] dark:text-[#A898B0] flex items-center gap-2">
          <span>🔒</span>
          <span>{t('sessionHistory.privacyNotice')}</span>
        </div>

        {/* List */}
        <div className="p-3.5 overflow-y-auto space-y-2 flex-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8B7D8F]">
              {t('sessionHistory.noSessions')}
            </div>
          ) : (
            sessions.map(s => {
              const isCompleted = s.status === 'completed';
              const dateStr = new Date(s.timestamp).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const timeStr = new Date(s.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-[rgba(212,167,44,0.3)] bg-white dark:bg-[#2A1733]/60 text-xs shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#5B2A86] dark:text-[#F0CC63]">
                      {s.serviceName}
                    </span>
                    <span className="text-xs text-[#8B7D8F]">
                      {dateStr} • {timeStr}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-xs text-[#321B3F] dark:text-[#E5D7B7]">
                    <span>👥 {t('sessionHistory.devoteesCount', { count: s.pilgrimCount })}</span>
                    <span className={`font-semibold ${isCompleted ? 'text-[#2E7D5B]' : 'text-[#D4A72C]'}`}>
                      {isCompleted ? '✓' : '⚠'} {t('sessionHistory.fieldsFilled', { filled: s.fieldsFilled, total: s.fieldsTotal })}
                    </span>
                  </div>

                  {s.durationMs > 0 && (
                    <div className="text-xs text-[#8B7D8F] pt-0.5">
                      {t('sessionHistory.completedIn', { duration: s.durationMs })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="p-3 bg-[#FFF8E8] dark:bg-[#2A1733] border-t border-[rgba(212,167,44,0.3)] flex justify-end">
            <button
              onClick={onClearHistory}
              className="text-xs text-[#B3261E] hover:underline font-bold cursor-pointer"
            >
              {t('sessionHistory.clearHistory')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
