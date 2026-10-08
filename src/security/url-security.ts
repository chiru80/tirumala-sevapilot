// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — URL Security & Safe Navigation (Phase 9)
// Strict origin allowlisting and pseudo-protocol defense.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

/**
 * Official TTD domains permitted for navigation and external references.
 */
export const ALLOWED_NAVIGATION_ORIGINS = [
  'https://ttdevasthanams.ap.gov.in',
  'https://tirupatibalaji.ap.gov.in',
  'https://news.tirumala.org',
  'https://tirumala.org',
  'https://www.tirumala.org',
] as const;

/**
 * Validates whether a URL is safe for navigation within or from the extension.
 * Rejects javascript:, data:, blob:, file:, and untrusted domains.
 */
export function isSafeNavigationUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    logger.warn('[UrlSecurity] Blocked dangerous pseudo-protocol:', lower.slice(0, 20));
    return false;
  }

  try {
    const parsed = new URL(trimmed);

    // Strictly HTTPS only
    if (parsed.protocol !== 'https:') {
      logger.warn('[UrlSecurity] Blocked non-HTTPS URL:', parsed.protocol);
      return false;
    }

    // Check credentials in URL (user:pass@host)
    if (parsed.username || parsed.password) {
      logger.warn('[UrlSecurity] Blocked URL with embedded credentials');
      return false;
    }

    // Verify origin against allowed official TTD origins
    const origin = parsed.origin.toLowerCase();
    const isAllowed = ALLOWED_NAVIGATION_ORIGINS.some(allowed => origin === allowed.toLowerCase());
    if (!isAllowed) {
      logger.warn('[UrlSecurity] Blocked navigation to untrusted domain:', origin);
      return false;
    }

    return true;
  } catch {
    logger.warn('[UrlSecurity] Failed to parse URL:', trimmed.slice(0, 30));
    return false;
  }
}

/**
 * Safely opens a validated URL in a new tab or window.
 * Fail-closed: Never executes if URL validation fails.
 */
export async function safeOpenUrl(url: string | null | undefined, fallbackOrigin = 'https://ttdevasthanams.ap.gov.in'): Promise<boolean> {
  const targetUrl = isSafeNavigationUrl(url) ? (url as string) : fallbackOrigin;

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    try {
      await chrome.tabs.create({ url: targetUrl });
      return true;
    } catch (err) {
      logger.debug('[UrlSecurity] chrome.tabs.create failed, falling back to window.open', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
