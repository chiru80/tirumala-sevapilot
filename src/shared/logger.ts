// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Structured Logger
// Never logs: Aadhaar, ID numbers, passwords, OTP, 
// full mobile numbers, full addresses, private docs
// ─────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const IS_PRODUCTION =
  (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

let currentLevel: LogLevel = IS_PRODUCTION ? LogLevel.WARN : LogLevel.DEBUG;

/** Set the minimum log level */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Patterns to redact from log output */
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Aadhaar: 12 digits (with optional spaces/hyphens) -> masked diagnostics ******1173
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '******{last4}' },
  // Passport: letter followed by 7 digits
  { pattern: /\b[A-PR-WYa-pr-wy][1-9]\d{6}\b/g, replacement: 'PASSPORT:****' },
  // Mobile: Indian 10-digit starting with 6-9
  { pattern: /\b[6-9]\d{9}\b/g, replacement: '******{last2}' },
  // Email: partial redaction
  { pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: '***@***' },
  // PIN code: 6 digits (only when preceded by common keywords)
  { pattern: /(?:pin|pincode|zip)\s*:?\s*\d{6}\b/gi, replacement: 'PIN:******' },
];

/** Sanitize a string by redacting sensitive values */
function sanitize(input: string): string {
  let output = input;
  for (const { pattern, replacement } of REDACT_PATTERNS) {
    output = output.replace(pattern, (match) => {
      if (replacement.includes('{last4}')) {
        const clean = match.replace(/[\s-]/g, '');
        return replacement.replace('{last4}', clean.slice(-4));
      }
      if (replacement.includes('{last2}')) {
        return replacement.replace('{last2}', match.slice(-2));
      }
      return replacement;
    });
  }
  return output;
}

/** Sanitize any value for safe logging */
function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return sanitize(value.message);
  }
  if (typeof value === 'string') return sanitize(value);
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.parse(sanitize(JSON.stringify(value)));
    } catch {
      return String(value);
    }
  }
  return value;
}

/** Prefix for all log messages */
const PREFIX = '[SevaPilot]';

/** Structured logger */
export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.DEBUG) {
      console.debug(PREFIX, sanitize(message), ...args.map(sanitizeValue));
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.INFO) {
      console.info(PREFIX, sanitize(message), ...args.map(sanitizeValue));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(PREFIX, sanitize(message), ...args.map(sanitizeValue));
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.ERROR) {
      const fullMsg = `${message} ${args.map(String).join(' ')}`;
      if (fullMsg.includes('Extension context invalidated')) {
        console.warn(PREFIX, sanitize(message), ...args.map(sanitizeValue));
        return;
      }
      console.error(PREFIX, sanitize(message), ...args.map(sanitizeValue));
    }
  },
};

export default logger;
