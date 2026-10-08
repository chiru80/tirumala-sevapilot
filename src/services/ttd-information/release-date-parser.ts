// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Strict Release Date & Time Parser (Phase 7)
// Non-locale, deterministic, calendar-validated parsing.
// Strictly normalizes to YYYY-MM-DD and HH:mm in Asia/Kolkata (IST).
// NEVER relies on `new Date(untrustedString)` or browser locale parsing.
// ─────────────────────────────────────────────────────────────

export interface ParsedReleaseDate {
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  formattedDisplay: string; // e.g. "24 October 2026"
}

export interface ParsedReleaseTime {
  time: string; // HH:mm in 24-hr format (00:00 - 23:59)
  hours: number;
  minutes: number;
  formattedDisplay: string; // e.g. "10:00 AM IST"
}

const ENGLISH_MONTHS_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const TELUGU_MONTHS_MAP: Record<string, number> = {
  'జనవరి': 1,
  'ఫిబ్రవరి': 2,
  'మార్చి': 3,
  'ఏప్రిల్': 4,
  'మే': 5,
  'జూన్': 6,
  'జూలై': 7,
  'ఆగస్టు': 8,
  'ఆగస్ట్': 8,
  'సెప్టెంబర్': 9,
  'సెప్టెంబరు': 9,
  'అక్టోబర్': 10,
  'అక్టోబరు': 10,
  'నవంబర్': 11,
  'నవంబరు': 11,
  'డిసెంబర్': 12,
  'డిసెంబరు': 12,
};

const MONTH_NAMES_EN = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Checks whether year, month, and day form a real, valid calendar date.
 * Rejects e.g. Feb 30, Oct 32, Apr 31.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2020 || year > 2040) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Leap year check for February
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (isLeapYear && month === 2) {
    return day <= 29;
  }

  return day <= daysInMonth[month];
}

/**
 * Strict parser for release dates across known TTD formats.
 * Supports:
 * - DD-MM-YYYY or DD/MM/YYYY
 * - DD Month YYYY (e.g. "24th October 2026", "7 Oct 2026")
 * - Month DD, YYYY (e.g. "October 24, 2026", "Oct 7, 2026")
 * - Telugu: "అక్టోబర్ 24, 2026", "24 అక్టోబర్ 2026"
 * Returns null if invalid or unrecognized. NEVER guesses.
 */
export function parseStrictReleaseDate(
  rawText: string,
  referenceYear: number = new Date().getFullYear()
): ParsedReleaseDate | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  // 1. Format: YYYY-MM-DD (ISO)
  const isoMatch = text.match(/\b(202\d)-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return buildResult(y, m, d);
    }
  }

  // 2. Format: DD-MM-YYYY or DD/MM/YYYY
  const slashDashMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (slashDashMatch) {
    const d = parseInt(slashDashMatch[1], 10);
    const m = parseInt(slashDashMatch[2], 10);
    const y = parseInt(slashDashMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return buildResult(y, m, d);
    }
  }

  // 3. Format: Telugu dates (e.g. "అక్టోబర్ 24, 2026" or "24 అక్టోబరు 2026" or "అక్టోబర్ 7న")
  for (const [telMonth, mNum] of Object.entries(TELUGU_MONTHS_MAP)) {
    if (text.includes(telMonth)) {
      // Look for day number near the month name
      const dayMatch = text.match(new RegExp(`${telMonth}\\s*[-–]?\\s*(\\d{1,2})`)) ||
        text.match(new RegExp(`(\\d{1,2})(?:వ|న)?\\s*${telMonth}`));
      if (dayMatch) {
        const d = parseInt(dayMatch[1], 10);
        const yearMatch = text.match(/\b(202\d)\b/);
        const y = yearMatch ? parseInt(yearMatch[1], 10) : referenceYear;
        if (isValidCalendarDate(y, mNum, d)) {
          return buildResult(y, mNum, d);
        }
      }
    }
  }

  // 4. Format: DD Month YYYY (e.g. "20th November", "24th October 2026", "7 Oct 2026", "24 October")
  const ddMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?\b/gi;
  let ddMatch: RegExpExecArray | null;
  while ((ddMatch = ddMonthRegex.exec(text)) !== null) {
    const d = parseInt(ddMatch[1], 10);
    const mStr = ddMatch[2].toLowerCase();
    const m = ENGLISH_MONTHS_MAP[mStr];
    const y = ddMatch[3] ? parseInt(ddMatch[3], 10) : referenceYear;
    if (m && isValidCalendarDate(y, m, d)) {
      return buildResult(y, m, d);
    }
  }

  // 5. Format: Month DD, YYYY (e.g. "October 24, 2026" or "Oct 7")
  const monthDdRegex = /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/gi;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = monthDdRegex.exec(text)) !== null) {
    const mStr = mdMatch[1].toLowerCase();
    const m = ENGLISH_MONTHS_MAP[mStr];
    const d = parseInt(mdMatch[2], 10);
    const y = mdMatch[3] ? parseInt(mdMatch[3], 10) : referenceYear;
    if (m && isValidCalendarDate(y, m, d)) {
      return buildResult(y, m, d);
    }
  }

  return null;
}

function buildResult(y: number, m: number, d: number): ParsedReleaseDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${y}-${pad(m)}-${pad(d)}`;
  const formattedDisplay = `${d} ${MONTH_NAMES_EN[m]} ${y}`;
  return {
    date,
    year: y,
    month: m,
    day: d,
    formattedDisplay,
  };
}

/**
 * Strict parser for release times across known TTD formats.
 * Supports:
 * - "10:00 AM", "10 AM", "10:00 AM IST", "10 AM IST"
 * - "3:00 PM", "3 PM", "03:00 PM"
 * - "10:00", "15:00", "15:00 hrs", "15:00 IST"
 * Rejects invalid times (e.g. 25:00, 13:00 PM, 99:99).
 * Returns null if not found or invalid. NEVER guesses.
 */
export function parseStrictReleaseTime(rawText: string): ParsedReleaseTime | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  // 1. 12-hour format with AM/PM (e.g. "10:00 AM", "10 AM", "3:30 PM", "3 PM")
  const ampmRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const ampmMatch = text.match(ampmRegex);
  if (ampmMatch) {
    const rawHours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridian = ampmMatch[3].toLowerCase();

    if (rawHours < 1 || rawHours > 12) return null;
    if (minutes < 0 || minutes > 59) return null;

    let hours24 = rawHours;
    if (meridian === 'pm' && rawHours < 12) {
      hours24 += 12;
    } else if (meridian === 'am' && rawHours === 12) {
      hours24 = 0;
    }

    return buildTimeResult(hours24, minutes);
  }

  // 2. 24-hour format (e.g. "15:00", "10:00", "15:00 hrs", "15:00 IST")
  const militaryRegex = /\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(?:hrs|ist))?\b/i;
  const militaryMatch = text.match(militaryRegex);
  if (militaryMatch) {
    // Check it's not followed by am/pm which would have been caught above
    const after = text.slice(text.indexOf(militaryMatch[0]) + militaryMatch[0].length);
    if (!/^\s*(am|pm)/i.test(after)) {
      const hours = parseInt(militaryMatch[1], 10);
      const minutes = parseInt(militaryMatch[2], 10);
      return buildTimeResult(hours, minutes);
    }
  }

  return null;
}

function buildTimeResult(hours: number, minutes: number): ParsedReleaseTime {
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(hours)}:${pad(minutes)}`;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const formattedDisplay = `${displayHour}:${pad(minutes)} ${ampm} IST`;

  return {
    time,
    hours,
    minutes,
    formattedDisplay,
  };
}
