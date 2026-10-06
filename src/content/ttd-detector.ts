// ─────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Service Detector
// ─────────────────────────────────────────────────

import { ServiceType } from '@shared/types';

interface DetectionResult {
  type: ServiceType;
  confidence: number;
  name: string;
}

interface DetectionRule {
  type: ServiceType;
  name: string;
  urlPatterns: RegExp[];
  pageMarkers: string[];
  weight: number;
}

const DETECTION_RULES: DetectionRule[] = [
  {
    type: ServiceType.DARSHAN,
    name: 'Special Entry Darshan',
    urlPatterns: [
      /\/sed\b/i,
      /\/special.*entry.*darshan/i,
      /\/darshan/i,
      /\/srstd/i,
      /\/spat\b/i,
      /\/spat\//i,
      /flow=spat/i,
      /slot-booking/i,
      /pilgrim-details/i,
    ],
    pageMarkers: [
      'special entry darshan',
      'special entry darshan (sri pat)',
      'sri pat',
      'spat',
      'pilgrim details',
      'sed booking',
      'darshan booking',
      'srstd',
      'suprabhatam',
    ],
    weight: 1.0,
  },
  {
    type: ServiceType.ARJITHA_SEVA,
    name: 'Arjitha Seva',
    urlPatterns: [
      /\/arjitha.*seva/i,
      /\/seva.*booking/i,
      /\/arjithaseva/i,
    ],
    pageMarkers: [
      'arjitha seva',
      'seva booking',
      'archana',
      'abhishekam',
      'kalyanotsavam',
    ],
    weight: 1.0,
  },
  {
    type: ServiceType.ACCOMMODATION,
    name: 'Accommodation',
    urlPatterns: [
      /\/accommodation/i,
      /\/room.*booking/i,
      /\/choultry/i,
      /\/guest.*house/i,
    ],
    pageMarkers: [
      'accommodation',
      'room booking',
      'choultry',
      'guest house',
      'cottage',
    ],
    weight: 1.0,
  },
  {
    type: ServiceType.SRIVANI,
    name: 'Srivani Trust',
    urlPatterns: [
      /\/srivani/i,
      /\/trust.*darshan/i,
    ],
    pageMarkers: [
      'srivani',
      'srivani trust',
      'trust darshan',
    ],
    weight: 1.0,
  },
  {
    type: ServiceType.SRIVARI_SEVA,
    name: 'Srivari Seva',
    urlPatterns: [
      /\/srivari.*seva/i,
      /\/volunteer/i,
    ],
    pageMarkers: [
      'srivari seva',
      'volunteer',
      'seva volunteer',
    ],
    weight: 1.0,
  },
];

/**
 * Detect which TTD service is being accessed.
 * Uses URL patterns and page content markers.
 */
export function detectService(url: string, doc: Document): DetectionResult | null {
  let bestMatch: DetectionResult | null = null;
  let highestScore = 0;

  for (const rule of DETECTION_RULES) {
    let score = 0;

    // URL pattern matching (strongest signal)
    for (const pattern of rule.urlPatterns) {
      if (pattern.test(url)) {
        score += 50 * rule.weight;
        break;
      }
    }

    // Page content markers
    const bodyText = (doc.body?.textContent ?? '').toLowerCase();
    const titleText = (doc.title ?? '').toLowerCase();

    for (const marker of rule.pageMarkers) {
      if (titleText.includes(marker.toLowerCase())) {
        score += 30 * rule.weight;
      }
      if (bodyText.includes(marker.toLowerCase())) {
        score += 10 * rule.weight;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = {
        type: rule.type,
        confidence: Math.min(score, 100),
        name: rule.name,
      };
    }
  }

  // If no specific service matched, try generic detection
  if (!bestMatch || highestScore < 20) {
    const hostname = new URL(url).hostname;
    if (
      hostname === 'ttdevasthanams.ap.gov.in' ||
      hostname === 'tirupatibalaji.ap.gov.in'
    ) {
      return {
        type: ServiceType.GENERIC,
        confidence: 30,
        name: 'TTD Service (Generic)',
      };
    }
    return null;
  }

  return bestMatch;
}
