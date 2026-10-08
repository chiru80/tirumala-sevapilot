import React, { useState, useEffect } from 'react';
import {
  getUpcomingVerifiedReleases,
  calculateReleaseCountdown,
  type TtdReleaseEvent,
} from '../../../services/ttd-information/ttd-release-calendar';
import { t } from '@i18n/index';
import { safeOpenUrl } from '../../../security/url-security';

interface UpcomingReleasesCardProps {
  onOpenSource?: (url: string) => void;
}

function formatReleaseDateOnly(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '';
  const [, monthStr, dayStr] = dateStr.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const months = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateFormatted = !isNaN(day) && !isNaN(month) && months[month] ? `${day} ${months[month]}` : dateStr;
  if (!timeStr) return dateFormatted;

  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = minStr || '00';
  const ampm = !isNaN(hour) && hour >= 12 ? 'PM' : 'AM';
  const displayHour = !isNaN(hour) ? (hour % 12 || 12) : hourStr;
  return `${dateFormatted} · ${displayHour}:${min} ${ampm} IST`;
}

export const UpcomingReleasesCard: React.FC<UpcomingReleasesCardProps> = ({ onOpenSource }) => {
  const [events, setEvents] = useState<TtdReleaseEvent[]>([]);

  useEffect(() => {
    // Only verified official upcoming TTD events
    const verified = getUpcomingVerifiedReleases().filter(e => e.verified);
    setEvents(verified);
  }, []);

  const handleOpen = (url: string) => {
    if (onOpenSource) {
      onOpenSource(url);
    } else {
      safeOpenUrl(url);
    }
  };

  return (
    <div
      className="rounded-2xl border border-[rgba(84,37,138,0.12)] bg-white dark:bg-[#2A1733] p-4 shadow-2xs space-y-3"
      role="region"
      aria-label={t('home.upcomingReleases') || 'Upcoming TTD Releases'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A72C]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6477] dark:text-[#A692B4]">
            {t('home.upcomingReleases') || 'UPCOMING TTD RELEASES'}
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2F8F68]/12 text-[#1B5E20] dark:text-[#A5D6A7]">
          {t('home.officialUpdate') || 'Official TTD update'}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#22132A] text-center space-y-2">
          <p className="text-xs text-[#6F6477] dark:text-[#C5B4D4] font-medium">
            Release date not announced yet
          </p>
          <button
            onClick={() => handleOpen('https://news.tirumala.org/')}
            className="text-xs font-bold text-[#54258A] dark:text-[#D4A72C] hover:underline cursor-pointer"
          >
            {t('home.viewTtdUpdates') || 'VIEW TTD UPDATES ↗'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((evt) => {
            const countdown = calculateReleaseCountdown(evt);
            const isConfirmed = evt.isConfirmed && evt.releaseDate && evt.releaseTime;

            let statusLabel = '';
            let statusBadgeClass = '';

            if (!isConfirmed) {
              statusLabel = 'Release date not announced yet';
              statusBadgeClass = 'bg-[#FFF8E8] text-[#8D6E18] dark:bg-[#3D2F1B] dark:text-[#FFE082]';
            } else if (countdown.days > 0) {
              statusLabel = `Opens in ${countdown.days} day${countdown.days > 1 ? 's' : ''}`;
              statusBadgeClass = 'bg-[#FAF5FF] text-[#54258A] dark:bg-[#3E1B68]/30 dark:text-[#E1BEE7] font-semibold';
            } else if (countdown.hours > 0) {
              statusLabel = `Opens in ${countdown.hours}h ${countdown.minutes}m`;
              statusBadgeClass = 'bg-[#FFF8E8] text-[#8D6E18] dark:bg-[#3D2F1B] dark:text-[#FFE082] font-semibold';
            } else {
              statusLabel = `Opens in ${countdown.minutes}m`;
              statusBadgeClass = 'bg-[#FFF8E8] text-[#8D6E18] dark:bg-[#3D2F1B] dark:text-[#FFE082] font-semibold';
            }

            return (
              <div
                key={evt.id}
                className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#22132A] border border-[rgba(84,37,138,0.06)] dark:border-[rgba(212,167,44,0.1)] flex items-center justify-between gap-3 transition-colors hover:border-[#D4A72C]/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#30213A] dark:text-[#F8EFD8] truncate">
                      {evt.displayName || evt.serviceId}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6F6477] dark:text-[#C5B4D4] mt-0.5 font-medium truncate">
                    {evt.targetMonth ? `${evt.targetMonth} · ` : ''}
                    {isConfirmed ? formatReleaseDateOnly(evt.releaseDate, evt.releaseTime) : 'Check official TTD schedule'}
                  </p>
                </div>

                {evt.sourceUrl && (
                  <button
                    onClick={() => handleOpen(evt.sourceUrl)}
                    className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#54258A]/8 text-[#54258A] dark:bg-[#D4A72C]/15 dark:text-[#F0CC63] hover:bg-[#54258A]/15 dark:hover:bg-[#D4A72C]/25 transition-all cursor-pointer whitespace-nowrap"
                    aria-label={`View official details for ${evt.displayName}`}
                  >
                    {t('home.viewDetails') || 'VIEW DETAILS ↗'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
