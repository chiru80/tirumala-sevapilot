// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Official TTD Source Metadata & Channels
// ─────────────────────────────────────────────────────────────

import { validateTtdSource, type SourceVerificationStatus } from './ttd-source-validator';

export interface TtdSourceMetadata {
  id: string;
  name: string;
  primaryUrl: string;
  type: 'portal' | 'news' | 'announcements';
  isOfficial: true;
  lastChecked?: string;
  description: string;
}

export const OFFICIAL_TTD_SOURCES: Record<string, TtdSourceMetadata> = {
  mainPortal: {
    id: 'ttd-main',
    name: 'Tirumala Tirupati Devasthanams Official Website',
    primaryUrl: 'https://www.tirumala.org/',
    type: 'portal',
    isOfficial: true,
    description: 'Primary portal for temple administration, seva details, and notifications.',
  },
  newsPortal: {
    id: 'ttd-news',
    name: 'TTD News & Media Releases',
    primaryUrl: 'https://news.tirumala.org/',
    type: 'news',
    isOfficial: true,
    description: 'Official press releases, monthly quota schedules, and quota release timings.',
  },
  bookingPortal: {
    id: 'ttd-booking',
    name: 'TTD Online Booking Portal',
    primaryUrl: 'https://ttdevasthanams.ap.gov.in/',
    type: 'portal',
    isOfficial: true,
    description: 'Official citizen booking portal for Darshan, Sevas, and Accommodation.',
  },
};

/**
 * Audit information regarding a source reference.
 */
export interface SourceAuditRecord {
  url: string;
  verificationStatus: SourceVerificationStatus;
  verifiedAt: string;
  sourceNote?: string;
}

export function auditSourceUrl(url: string, note?: string): SourceAuditRecord {
  const validation = validateTtdSource(url);
  return {
    url,
    verificationStatus: validation.status,
    verifiedAt: new Date().toISOString(),
    sourceNote: note || validation.reason,
  };
}
