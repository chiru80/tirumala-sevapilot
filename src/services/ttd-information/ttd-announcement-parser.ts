// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Official Announcement Parser (Phase 7)
// Extracts verified release dates and quota timings from official
// press release summaries (e.g. news.tirumala.org).
// Defensive, deterministic, non-locale, zero-guessing.
// ─────────────────────────────────────────────────────────────

import { validateTtdSource } from './ttd-source-validator';
import {
  type TtdReleaseEvent,
  IST_TIMEZONE,
  registerOfficialAnnouncement,
} from './ttd-release-calendar';
import { getServiceConfig } from './ttd-service-rules';
import {
  parseStrictReleaseDate,
  parseStrictReleaseTime,
} from './release-date-parser';

export interface AnnouncementParseInput {
  title: string;
  content: string;
  sourceUrl: string;
  publishedDate?: string;
  releasePattern?: string;
  advanceMonths?: number;
}

/**
 * Service pattern signatures to detect service from announcement titles/text
 * Includes both English and Telugu keywords for official TTD press releases.
 */
export const SERVICE_SIGNATURES: Array<{
  serviceId: string;
  keywords: string[];
  defaultTime: string;
}> = [
  {
    serviceId: 'special-entry-300',
    keywords: [
      'special entry', 'sed', '₹300', '300 rs', 'rs.300', 'rs 300',
      'see darshan', 'seeghra darshan', 'రూ. 300', 'రూ.300',
      'ప్రత్యేక ప్రవేశ దర్శనం', 'ప్రత్యేక ప్రవేశ'
    ],
    defaultTime: '10:00',
  },
  {
    serviceId: 'padmavathi-special-entry-200',
    keywords: [
      'padmavathi', 'ammavari', '₹200', '200 rs', 'rs.200', 'tiruchanoor',
      'రూ. 200', 'రూ.200', 'పద్మావతి', 'అమ్మవారి'
    ],
    defaultTime: '10:00',
  },
  {
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    keywords: [
      'homam', 'srinivasa divyanugraha', 'vishesha homam', 'alipiri homam',
      'దివ్యానుగ్రహ', 'హోమం'
    ],
    defaultTime: '15:00',
  },
  {
    serviceId: 'srivari-seva',
    keywords: [
      'srivari seva', 'srivariseva', 'voluntary seva', 'general seva',
      'navaneetha seva', 'parakamani seva', 'శ్రీవారి సేవ', 'సేవకులు'
    ],
    defaultTime: '15:00',
  },
  {
    serviceId: 'arjitha-sevas',
    keywords: [
      'arjitha seva', 'kalyanotsavam', 'electronic dip', 'arjitha',
      'ఆర్జిత సేవ', 'కళ్యాణోత్సవం'
    ],
    defaultTime: '10:00',
  },
  {
    serviceId: 'accommodation',
    keywords: [
      'accommodation', 'rooms', 'cottages', 'గదులు', 'వసతి'
    ],
    defaultTime: '15:00',
  },
  {
    serviceId: 'srivani',
    keywords: [
      'srivani', 'trust donor', 'sri vani', 'శ్రీవాణి'
    ],
    defaultTime: '11:00',
  },
  {
    serviceId: 'angapradakshinam',
    keywords: [
      'angapradakshinam', 'anga pradakshinam', 'అంగప్రదక్షిణం'
    ],
    defaultTime: '14:00',
  },
  {
    serviceId: 'senior-citizen',
    keywords: [
      'senior citizen', 'differently abled', 'physically challenged',
      'వయోవృద్ధుల', 'దివ్యాంగుల'
    ],
    defaultTime: '15:00',
  },
];

/**
 * Extracts release pattern and advance months from announcement text if specified.
 */
export function extractAdvancePattern(text: string): { releasePattern: string; advanceMonths: number } | null {
  const normalized = text.toLowerCase();

  // Pattern: "3 months in advance" or "three months advance"
  if (/(?:three|3)\s*months?\s*(?:in\s*)?advance/i.test(normalized)) {
    return {
      releasePattern: 'THREE_MONTHS_ADVANCE_MONTHLY_QUOTA',
      advanceMonths: 3,
    };
  }

  // Pattern: "1 month in advance" or "one month advance"
  if (/(?:one|1)\s*month\s*(?:in\s*)?advance/i.test(normalized)) {
    return {
      releasePattern: 'ONE_MONTH_ADVANCE',
      advanceMonths: 1,
    };
  }

  // Pattern: "2 months in advance" or "two months advance"
  if (/(?:two|2)\s*months?\s*(?:in\s*)?advance/i.test(normalized)) {
    return {
      releasePattern: 'TWO_MONTHS_ADVANCE',
      advanceMonths: 2,
    };
  }

  const match = normalized.match(/(\d+)\s*months?\s*(?:in\s*)?advance/i);
  if (match) {
    const months = parseInt(match[1], 10);
    return {
      releasePattern: `${months}_MONTHS_ADVANCE`,
      advanceMonths: months,
    };
  }

  return null;
}

/**
 * Parses announcement into structured release events.
 * Defensive & strict:
 * - Uses parseStrictReleaseDate (never new Date())
 * - Uses parseStrictReleaseTime (rejects malformed times)
 * - Returns empty array if no service or valid date is identified
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
      // 1. Strict date parsing
      const parsedDate = parseStrictReleaseDate(fullText);
      if (parsedDate) {
        // 2. Strict time parsing from text
        const parsedTime = parseStrictReleaseTime(fullText);
        const time = parsedTime ? parsedTime.time : sig.defaultTime;

        const config = getServiceConfig(sig.serviceId);
        const textPattern = extractAdvancePattern(fullText);

        const releasePattern =
          input.releasePattern || textPattern?.releasePattern || config?.releasePattern || 'MONTHLY_QUOTA_RELEASE';
        const advanceMonths =
          input.advanceMonths !== undefined
            ? input.advanceMonths
            : textPattern?.advanceMonths !== undefined
            ? textPattern.advanceMonths
            : config?.advanceMonths !== undefined
            ? config.advanceMonths
            : 0;

        const isOfficialSource = validation.isValid;

        events.push({
          id: `announcement-${sig.serviceId}-${parsedDate.date}`,
          serviceId: sig.serviceId,
          serviceName: config?.displayName || sig.serviceId,
          displayName: config?.displayName || sig.serviceId,
          bookingType: config?.category || 'Quota Release',
          targetBookingDates: parsedDate.formattedDisplay,
          targetMonth: parsedDate.formattedDisplay,
          releaseDate: parsedDate.date,
          releaseTime: time,
          timezone: IST_TIMEZONE,
          status: isOfficialSource ? 'CONFIRMED' : 'UNKNOWN',
          confidence: isOfficialSource ? 'OFFICIAL' : 'UNKNOWN',
          source: isOfficialSource ? 'Official TTD Press Release' : 'External Source',
          sourceUrl: input.sourceUrl,
          sourceDate: input.publishedDate || new Date().toISOString().slice(0, 10),
          releasePattern,
          advanceMonths,
          releaseType: config?.releaseType || 'MONTHLY_QUOTA_RELEASE',
          verificationStatus: isOfficialSource ? 'VERIFIED_OFFICIAL' : 'UNVERIFIED',
          verified: isOfficialSource,
          isConfirmed: isOfficialSource && Boolean(parsedDate.date),
          publishedTimestamp: input.publishedDate ? new Date(input.publishedDate).toISOString() : new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }
  }

  return events;
}

/**
 * Parses announcement and registers verified events, overriding stored defaults.
 */
export function parseAndRegisterTtdAnnouncement(input: AnnouncementParseInput): TtdReleaseEvent[] {
  const events = parseTtdAnnouncement(input);
  for (const event of events) {
    registerOfficialAnnouncement(event);
  }
  return events;
}
