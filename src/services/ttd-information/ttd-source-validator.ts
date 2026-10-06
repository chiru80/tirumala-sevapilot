// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Official TTD Source Validator (Phase 5)
// Ensures release schedules and workflows are derived strictly
// from official TTD channels, rejecting unofficial third parties.
// ─────────────────────────────────────────────────────────────

/**
 * Authoritative official TTD domain whitelist.
 * Only these domains are accepted for verified schedules and workflows.
 */
export const OFFICIAL_TTD_DOMAINS = [
  'tirumala.org',
  'news.tirumala.org',
  'www.tirumala.org',
  'ttdevasthanams.ap.gov.in',
  'tirupatibalaji.ap.gov.in',
] as const;

export type OfficialTtdDomain = typeof OFFICIAL_TTD_DOMAINS[number];

export type SourceVerificationStatus =
  | 'OFFICIAL_SOURCE_VERIFIED'
  | 'SOURCE_NEEDS_VERIFICATION'
  | 'UNOFFICIAL_SOURCE_REJECTED';

export interface SourceValidationResult {
  isValid: boolean;
  status: SourceVerificationStatus;
  domain?: string;
  isHttps: boolean;
  isOfficial: boolean;
  reason: string;
}

/**
 * Validates whether a given URL is an official, authentic TTD source.
 * Enforces HTTPS and strict hostname verification.
 */
export function validateTtdSource(url: string | undefined | null): SourceValidationResult {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      isValid: false,
      status: 'SOURCE_NEEDS_VERIFICATION',
      isHttps: false,
      isOfficial: false,
      reason: 'No source URL provided.',
    };
  }

  try {
    const parsed = new URL(url.trim());

    // 1. Must use secure HTTPS
    if (parsed.protocol !== 'https:') {
      return {
        isValid: false,
        status: 'UNOFFICIAL_SOURCE_REJECTED',
        domain: parsed.hostname,
        isHttps: false,
        isOfficial: false,
        reason: 'Source does not use secure HTTPS protocol.',
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Strict exact domain matching against whitelist (strictly rejects evil.tirumala.org lookalikes)
    const isWhitelisted = (OFFICIAL_TTD_DOMAINS as readonly string[]).includes(hostname);

    if (!isWhitelisted) {
      return {
        isValid: false,
        status: 'UNOFFICIAL_SOURCE_REJECTED',
        domain: hostname,
        isHttps: true,
        isOfficial: false,
        reason: `Domain (${hostname}) is not in the authoritative official TTD whitelist. Unofficial domains or arbitrary subdomains are rejected.`,
      };
    }

    return {
      isValid: true,
      status: 'OFFICIAL_SOURCE_VERIFIED',
      domain: hostname,
      isHttps: true,
      isOfficial: true,
      reason: `Official TTD source verified: ${hostname}`,
    };
  } catch {
    return {
      isValid: false,
      status: 'SOURCE_NEEDS_VERIFICATION',
      isHttps: false,
      isOfficial: false,
      reason: 'Malformed or invalid URL.',
    };
  }
}
