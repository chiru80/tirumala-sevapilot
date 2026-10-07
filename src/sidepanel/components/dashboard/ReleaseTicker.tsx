import React, { useState, useEffect } from 'react';
import {
  getUpcomingVerifiedReleases,
  calculateReleaseCountdown,
  type TtdReleaseEvent,
} from '../../../services/ttd-information/ttd-release-calendar';
import { t } from '@i18n/index';

interface ReleaseTickerProps {
  onOpenSource?: (url: string) => void;
}

function formatReleaseTickerItem(event: TtdReleaseEvent): { text: string; isPast: boolean } {
  const countdown = calculateReleaseCountdown(event);
  const isPast = countdown.state === 'PASSED' || countdown.state === 'RELEASE_TIME_REACHED';
  const name = event.displayName || event.serviceName || 'TTD Quota';
  const target = event.targetBookingDates || event.targetMonth || '';

  if (isPast) {
    return {
      text: `${name} • ${target} quota released`,
      isPast: true,
    };
  }

  if (event.releaseDate && event.releaseTime) {
    const [, monthStr, dayStr] = event.releaseDate.split('-');
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const dateFormatted = !isNaN(day) && !isNaN(month) && months[month] ? `${day} ${months[month]}` : event.releaseDate;

    const [hourStr, minStr] = event.releaseTime.split(':');
    const hour = parseInt(hourStr, 10);
    const min = minStr || '00';
    const ampm = !isNaN(hour) && hour >= 12 ? 'PM' : 'AM';
    const displayHour = !isNaN(hour) ? (hour % 12 || 12) : event.releaseTime;
    const timeFormatted = `${displayHour}:${min} ${ampm} IST`;

    if (target && !target.toLowerCase().includes('pending')) {
      return {
        text: `${name} • Tickets for ${target} • Release ${dateFormatted} at ${timeFormatted}`,
        isPast: false,
      };
    }

    return {
      text: `${name} • Next verified release: ${dateFormatted} at ${timeFormatted}`,
      isPast: false,
    };
  }

  return {
    text: `${name} • TTD release date not announced yet`,
    isPast: false,
  };
}

export const ReleaseTicker: React.FC<ReleaseTickerProps> = ({ onOpenSource }) => {
  const [events, setEvents] = useState<TtdReleaseEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Only verified official upcoming TTD releases
    const verified = getUpcomingVerifiedReleases().filter(e => e.verified && e.sourceUrl);
    setEvents(verified);
  }, []);

  const handleClick = (url: string) => {
    if (onOpenSource) {
      onOpenSource(url);
    } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (events.length === 0) {
    return (
      <div
        className="w-full bg-[#FAF7F2] dark:bg-[#2A1835] border-y border-[rgba(84,37,138,0.08)] py-1.5 px-3 flex items-center justify-between text-xs"
        role="region"
        aria-label="TTD Release Announcements"
      >
        <span className="font-bold text-[10px] tracking-wider uppercase text-[#8D6E18] dark:text-[#D4A72C]">
          TTD RELEASE UPDATE
        </span>
        <span className="text-[#6F6477] dark:text-[#C5B4D4] truncate font-medium">
          Release date not announced yet · Official release information will appear here when verified.
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-gradient-to-r from-[#FAF7F2] via-[#FDFBF7] to-[#FAF7F2] dark:from-[#2A1733] dark:via-[#22132A] dark:to-[#2A1733] border-y border-[rgba(84,37,138,0.1)] py-1.5 px-2.5 shadow-2xs select-none"
      role="region"
      aria-label="TTD Release Announcements"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-2">
        {/* Badge */}
        <div className="shrink-0 flex items-center gap-1.5 bg-[#54258A]/10 dark:bg-[#D4A72C]/15 text-[#54258A] dark:text-[#F0CC63] px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A72C] animate-pulse" />
          <span>RELEASES</span>
        </div>

        {/* Ticker Items */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className={`flex items-center gap-6 whitespace-nowrap text-xs transition-transform ${
              isPaused ? '' : 'animate-marquee'
            }`}
            style={{
              display: 'inline-flex',
              animationDuration: '24s',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
          >
            {events.map((event) => {
              const { text, isPast } = formatReleaseTickerItem(event);
              return (
                <button
                  key={event.id}
                  onClick={() => handleClick(event.sourceUrl)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#30213A] dark:text-[#F8EFD8] hover:text-[#54258A] dark:hover:text-[#F0CC63] font-medium transition-colors cursor-pointer group"
                  title="Open official TTD announcement"
                  aria-label={`${text}. Click to open official update.`}
                >
                  <span className={`text-[10px] ${isPast ? 'text-gray-400' : 'text-[#D4A72C]'}`}>●</span>
                  <span>{text}</span>
                  <span className="text-[10px] text-[#54258A] dark:text-[#D4A72C] opacity-60 group-hover:opacity-100 transition-opacity">
                    ↗
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
