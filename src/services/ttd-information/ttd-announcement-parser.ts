// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Official Announcement Parser (Phase 5)
// Extracts verified release dates and quota timings from official
// press release summaries (e.g. news.tirumala.org).
// ─────────────────────────────────────────────────────────────

import { validateTtdSource } from './ttd-source-validator';
import { type TtdReleaseEvent, IST_TIMEZONE } from './ttd-release-calendar';
import { getServiceConfig } from './ttd-service-rules';

export interface AnnouncementParseInput {
  title: string;
  content: string;
  sourceUrl: string;
  publishedDate?: string;
}

/**
 * Service pattern signatures to detect service from announcement titles/text
 */
const SERVICE_SIGNATURES: Array<{
  serviceId: string;
  keywords: string[];
  defaultTime: string;
}> = [
  {
    serviceId: 'special-entry-300',
    keywords: ['special entry', 'sed', '₹300', '300 rs', 'rs.300', 'see darshan'],
    defaultTime: '10:00',
  },
  {
    serviceId: 'padmavathi-special-entry-200',
    keywords: ['padmavathi', 'ammavari', '₹200', '200 rs', 'tiruchanoor'],
    defaultTime: '10:00',
  },
  {
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    keywords: ['homam', 'srinivasa divyanugraha', 'vishesha homam', 'alipiri homam'],
    defaultTime: '15:00',
  },
  {
    serviceId: 'arjitha-sevas',
    keywords: ['arjitha seva', 'kalyanotsavam', 'electronic dip', 'arjitha'],
    defaultTime: '10:00',
  },
  {
    serviceId: 'accommodation',
    keywords: ['accommodation', 'rooms', 'cottages'],
    defaultTime: '15:00',
  },
  {
    serviceId: 'srivani',
    keywords: ['srivani', 'trust donor', 'sri vani'],
    defaultTime: '11:00',
  },
  {
    serviceId: 'angapradakshinam',
    keywords: ['angapradakshinam', 'anga pradakshinam'],
    defaultTime: '14:00',
  },
  {
    serviceId: 'senior-citizen',
    keywords: ['senior citizen', 'differently abled', 'physically challenged'],
    defaultTime: '15:00',
  },
];

/**
 * Month names lookup
 */
const MONTHS_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Extracts date pattern (e.g. "24th September 2026", "24-09-2026", "September 24")
 */
function extractReleaseDate(text: string): { releaseDate: string; targetMonth: string } | null {
  const normalized = text.toLowerCase();

  // Pattern 1: e.g. "24th September 2026" or "24 September 2026" or "24 Oct"
  const dateRegex1 = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?/i;
  const match1 = text.match(dateRegex1);

  if (match1) {
    const day = match1[1].padStart(2, '0');
    const monthStr = match1[2].toLowerCase();
    const month = MONTHS_MAP[monthStr] || '10';
    const year = match1[3] || '2026';
    return {
      releaseDate: `${year}-${month}-${day}`,
      targetMonth: `${monthStr.toUpperCase()} ${year}`,
    };
  }

  // Pattern 2: e.g. "September 24, 2026"
  const dateRegex2 = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/i;
  const match2 = text.match(dateRegex2);

  if (match2) {
    const monthStr = match2[1].toLowerCase();
    const month = MONTHS_MAP[monthStr] || '10';
    const day = match2[2].padStart(2, '0');
    const year = match2[3] || '2026';
    return {
      releaseDate: `${year}-${month}-${day}`,
      targetMonth: `${monthStr.toUpperCase()} ${year}`,
    };
  }

  // Fallback: look for ISO-like dates e.g. 2026-10-24
  const isoMatch = text.match(/\b(202\d)-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return {
      releaseDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      targetMonth: `${isoMatch[1]}-${isoMatch[2]}`,
    };
  }

  return null;
}

/**
 * Extracts release time (e.g. "10:00 AM", "10 AM", "15:00 hrs")
 */
function extractReleaseTime(text: string, defaultTime: string): string {
  // e.g. 10:00 AM or 10 AM or 3:00 PM or 3 PM
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const match = text.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] || '00';
    const meridian = match[3].toLowerCase();

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // 24-hour pattern e.g. 10:00 or 15:00
  const militaryRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
  const militaryMatch = text.match(militaryRegex);
  if (militaryMatch) {
    return `${militaryMatch[1].padStart(2, '0')}:${militaryMatch[2]}`;
  }

  return defaultTime;
}

/**
 * Parses announcement into structured release events.
 */
export function parseTtdAnnouncement(input: AnnouncementParseInput): TtdReleaseEvent[] {
  const fullText = `${input.title} \n ${input.content}`;
  const validation = validateTtdSource(input.sourceUrl);
  const events: TtdReleaseEvent[] = [];

  for (const sig of SERVICE_SIGNATURES) {
    const isServiceMentioned = sig.keywords.some(kw =>
      fullText.toLowerCase().includes(kw.toLowerCase())
    );

    if (isServiceMentioned) {
      const extracted = extractReleaseDate(fullText);
      if (extracted) {
        const time = extractReleaseTime(fullText, sig.defaultTime);
        const config = getServiceConfig(sig.serviceId);

        events.push({
          id: `announcement-${sig.serviceId}-${extracted.releaseDate}`,
          serviceId: sig.serviceId,
          displayName: config?.displayName || sig.serviceId,
          targetMonth: extracted.targetMonth,
          releaseDate: extracted.releaseDate,
          releaseTime: time,
          timezone: IST_TIMEZONE,
          sourceUrl: input.sourceUrl,
          sourceDate: input.publishedDate || new Date().toISOString().slice(0, 10),
          verified: validation.isValid,
          fetchedAt: new Date().toISOString(),
        });
      }
    }
  }

  return events;
}
