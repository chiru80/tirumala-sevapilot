// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Service Recognition Engine
// Multi-signal service detection with transparent confidence scoring
// ─────────────────────────────────────────────────

import { ServiceType } from '@shared/types';
import { isOfficialTTDDomain } from '@shared/utils';
import { getServiceConfig } from './ttd-information/ttd-service-rules';

export type DetectionStatus = 'detected' | 'not-detected' | 'uncertain';

export interface DetectionSignal {
  type: 'url' | 'title' | 'heading' | 'label' | 'dom-marker';
  name: string;
  matched: boolean;
  score: number;
  evidence?: string;
}

export interface ServiceRecognitionResult {
  status: DetectionStatus;
  serviceType: ServiceType;
  serviceId?: string;
  serviceName: string;
  confidenceScore: number; // 0-100 calculated from real signals
  confidence: number; // 0-1 ratio for Phase 5 specification
  confidenceBand: 'High' | 'Medium' | 'Low';
  strategy: string;
  workflowId?: string;
  verified: boolean;
  reason?: string;
  signals: DetectionSignal[];
  summary: string;
  isOfficialDomain: boolean;
}


interface ServiceSignature {
  type: ServiceType;
  serviceId?: string;
  displayName: string;
  urlRegex: RegExp[];
  titleTokens: string[];
  headingTokens: string[];
  fieldLabelTokens: string[];
  domMarkers: string[];
}

const SERVICE_SIGNATURES: ServiceSignature[] = [
  {
    type: ServiceType.ARJITHA_SEVA,
    serviceId: 'sri-srinivasa-divyanugraha-homam',
    displayName: 'Sri Srinivasa Divyanugraha Homam',
    urlRegex: [
      /\/srinivasa.*homam/i,
      /\/divyanugraha/i,
      /\/homam\b/i,
      /\/homam-booking/i,
      /flow=homam/i,
      /service=homam/i,
    ],
    titleTokens: [
      'srinivasa divyanugraha homam',
      'divyanugraha homam',
      'divyanugraha',
      'homam booking',
    ],
    headingTokens: [
      'srinivasa divyanugraha homam',
      'divyanugraha homam',
      'sri srinivasa divyanugraha homam',
      'divyanugraha',
      'homam booking',
    ],
    fieldLabelTokens: [
      'gothram',
      'gotram',
      'kulagothram',
    ],
    domMarkers: [
      '#homamForm',
      '.homam-booking',
      '[data-service*="homam" i]',
      '[data-testid*="homam"]',
    ],
  },
  {
    type: ServiceType.DARSHAN,
    serviceId: 'padmavathi-supadham-entry-200',
    displayName: 'Padmavathi / Sri PAT',
    urlRegex: [
      /\/spat\//i,
      /\/spat\b/i,
      /flow=spat/i,
      /flowidentifier=spat/i,
      /\/padmavathi/i,
      /\/ammavari/i,
      /\/tiruchanoor/i,
      /\/supadham/i,
      /spat.*200/i,
      /pat-200/i,
      /flow=padmavathi/i,
    ],
    titleTokens: [
      'padmavathi ammavari',
      'padmavathi',
      'ammavari',
      'tiruchanoor',
      'supadham entry',
      'sri pat',
      'spat',
    ],
    headingTokens: [
      'padmavathi ammavari',
      'ammavari temple',
      'tiruchanoor',
      'supadham',
      'padmavathi',
      'sri pat',
      'spat',
    ],
    fieldLabelTokens: [
      'pilgrim details',
      'photo id proof',
      'photo id number',
      'additional laddus',
    ],
    domMarkers: [
      '#padmavathiForm',
      '[data-service*="padmavathi" i]',
      '[data-service*="ammavari" i]',
      '[data-service*="spat" i]',
    ],
  },
  {
    type: ServiceType.DARSHAN,
    serviceId: 'special-entry-darshan-300',
    displayName: 'Special Entry Darshan ₹300',
    urlRegex: [
      /\/sed\b/i,
      /\/special.*entry.*darshan/i,
      /\/srstd/i,
      /\/darshan/i,
    ],
    titleTokens: [
      'special entry darshan',
      'darshan',
      'tirumala darshan',
    ],
    headingTokens: [
      'special entry darshan',
      'darshan booking',
      'slot selection',
      'special darshan',
    ],
    fieldLabelTokens: [
      'pilgrim details',
      'photo id proof',
      'photo id number',
      'laddu count',
      'darshan slot',
    ],
    domMarkers: [
      '#darshanForm',
      '.darshan-container',
      '[data-service="darshan"]',
      '#pilgrimTable',
    ],
  },
  {
    type: ServiceType.ARJITHA_SEVA,
    displayName: 'Arjitha Seva Electronic Dip & Booking',
    urlRegex: [
      /\/arjitha.*seva/i,
      /\/seva.*booking/i,
      /\/arjithaseva/i,
      /\/electronic-dip/i,
    ],
    titleTokens: [
      'arjitha seva',
      'seva booking',
      'electronic dip',
    ],
    headingTokens: [
      'arjitha seva',
      'suprabhatam',
      'thomala',
      'archana',
      'abhishekam',
      'kalyanotsavam',
      'electronic dip registration',
    ],
    fieldLabelTokens: [
      'seva name',
      'seva date',
      'reporting time',
      'primary devotee',
    ],
    domMarkers: [
      '#sevaForm',
      '.seva-card',
      '[data-service="seva"]',
    ],
  },
  {
    type: ServiceType.ACCOMMODATION,
    displayName: 'Tirumala / Tirupati Accommodation',
    urlRegex: [
      /\/accommodation/i,
      /\/room.*booking/i,
      /\/choultry/i,
      /\/guest.*house/i,
      /\/cottage/i,
    ],
    titleTokens: [
      'accommodation',
      'room booking',
      'cottage booking',
      'choultry',
    ],
    headingTokens: [
      'accommodation booking',
      'room type',
      'check-in date',
      'choultry booking',
      'guest house',
      'advance booking',
    ],
    fieldLabelTokens: [
      'check-in date',
      'check-in time',
      'caution deposit',
      'room type',
      'no of days',
    ],
    domMarkers: [
      '#accommodationForm',
      '.room-selection',
      '[data-service="accommodation"]',
    ],
  },
  {
    type: ServiceType.SRIVANI,
    displayName: 'SriVani Trust Darshan',
    urlRegex: [
      /\/srivani/i,
      /\/trust.*darshan/i,
    ],
    titleTokens: [
      'srivani',
      'srivani trust',
      'trust darshan',
    ],
    headingTokens: [
      'srivani trust',
      'donation receipt',
      'srivani donor darshan',
    ],
    fieldLabelTokens: [
      'donation amount',
      'donor certificate',
      'pan card',
    ],
    domMarkers: [
      '#srivaniForm',
      '.donor-section',
    ],
  },
  {
    type: ServiceType.SRIVARI_SEVA,
    serviceId: 'srivari-seva',
    displayName: 'Srivari Seva',
    urlRegex: [
      /\/srivari[-_]?seva/i,
      /\/volunteer/i,
    ],
    titleTokens: [
      'srivari volunteer',
      'srivari seva',
      'parakamani seva',
    ],
    headingTokens: [
      'srivari seva',
      'volunteer registration',
      'srivari seva team',
      'seva team leader',
      'general seva',
      'navaneetha seva',
      'instructions',
    ],
    fieldLabelTokens: [
      'id proof type',
      'id proof number',
      'mentally fit',
      'physically fit',
      'mandal',
      'qualification',
      'door number',
      'team size',
      'institution name',
      'seva batch',
    ],
    domMarkers: [
      '#srivariSevaForm',
      '[data-service*="srivari-seva" i]',
      '[data-testid*="srivari-seva"]',
      '#volunteerForm',
    ],
  },
];

/**
 * ServiceRecognitionEngine evaluates multiple real DOM & network signals
 * to determine the exact TTD service with transparent confidence.
 */
export class ServiceRecognitionEngine {
  public static recognize(url: string, doc?: Document): ServiceRecognitionResult {
    const isOfficialDomain = isOfficialTTDDomain(url);

    // Route Dominance: SPAT URLs strictly resolve to Padmavathi / Sri PAT (₹200)
    // Generic page headings like "Special Entry Darshan" must NOT override the explicit SPAT route.
    const lowerUrl = (url || '').toLowerCase();
    const isSpatRoute =
      lowerUrl.includes('/spat/') ||
      lowerUrl.includes('/spat?') ||
      lowerUrl.endsWith('/spat') ||
      lowerUrl.includes('flow=spat') ||
      lowerUrl.includes('flowidentifier=spat');

    if (isSpatRoute) {
      const config = getServiceConfig('padmavathi-supadham-entry-200');
      const verified = Boolean(config?.verified && isOfficialDomain);
      const summary = 'Identified Padmavathi / Sri PAT (₹200) with 100% confidence via dominant SPAT route pattern.';
      const signals: DetectionSignal[] = [
        {
          type: 'url',
          name: 'SPAT Route Dominance',
          matched: true,
          score: 40,
          evidence: url,
        },
      ];
      return {
        status: 'detected',
        serviceType: ServiceType.DARSHAN,
        serviceId: 'padmavathi-supadham-entry-200',
        serviceName: 'Padmavathi / Sri PAT',
        confidenceScore: 100,
        confidence: 1,
        confidenceBand: 'High',
        strategy: 'spat-route-dominance',
        workflowId: 'padmavathi-v1',
        verified,
        reason: summary,
        signals,
        summary,
        isOfficialDomain,
      };
    }

    // Route Dominance: Srivari Seva route patterns strictly resolve to Srivari Seva
    const isSrivariSevaRoute =
      lowerUrl.includes('/srivari-seva') ||
      lowerUrl.includes('/srivariseva') ||
      lowerUrl.includes('flow=srivari-seva') ||
      lowerUrl.includes('service=srivari-seva');

    if (isSrivariSevaRoute) {
      const config = getServiceConfig('srivari-seva');
      const verified = Boolean(config?.verified && isOfficialDomain);
      const summary = 'Identified Srivari Seva with 100% confidence via dominant Srivari Seva route pattern.';
      const signals: DetectionSignal[] = [
        {
          type: 'url',
          name: 'Srivari Seva Route Dominance',
          matched: true,
          score: 40,
          evidence: url,
        },
      ];
      return {
        status: 'detected',
        serviceType: ServiceType.SRIVARI_SEVA,
        serviceId: 'srivari-seva',
        serviceName: 'Srivari Seva',
        confidenceScore: 100,
        confidence: 1,
        confidenceBand: 'High',
        strategy: 'srivari-seva-route-dominance',
        workflowId: 'srivari-seva-enrollment-v1',
        verified,
        reason: summary,
        signals,
        summary,
        isOfficialDomain,
      };
    }
    const titleText = (doc?.title ?? '').toLowerCase();
    const headingElements = doc ? Array.from(doc.querySelectorAll('h1, h2, h3, h4, .page-title, .header-title')) : [];
    const headingsText = headingElements.map(h => (h.textContent ?? '').toLowerCase()).join(' ');
    const labelsText = doc ? Array.from(doc.querySelectorAll('label, th, span.form-label')).map(l => (l.textContent ?? '').toLowerCase()).join(' ') : '';
    const bodyText = (doc?.body?.textContent ?? '').toLowerCase().slice(0, 3000);

    let bestScore = 0;
    let secondBestScore = 0;
    let bestSignature: ServiceSignature | null = null;
    let bestSignals: DetectionSignal[] = [];

    for (const signature of SERVICE_SIGNATURES) {
      const signals: DetectionSignal[] = [];
      let totalScore = 0;

      // 1. URL Pattern match (Weight: 40)
      let urlMatched = false;
      let matchedPattern = '';
      for (const pattern of signature.urlRegex) {
        if (pattern.test(url)) {
          urlMatched = true;
          matchedPattern = pattern.source;
          break;
        }
      }
      signals.push({
        type: 'url',
        name: 'URL Route Pattern',
        matched: urlMatched,
        score: urlMatched ? 40 : 0,
        evidence: urlMatched ? matchedPattern : undefined,
      });
      if (urlMatched) totalScore += 40;

      // 2. Heading match (Weight: 25)
      let headingMatched = false;
      let matchedHeading = '';
      for (const token of signature.headingTokens) {
        if (headingsText.includes(token)) {
          headingMatched = true;
          matchedHeading = token;
          break;
        }
      }
      signals.push({
        type: 'heading',
        name: 'Page Headings',
        matched: headingMatched,
        score: headingMatched ? 25 : 0,
        evidence: headingMatched ? matchedHeading : undefined,
      });
      if (headingMatched) totalScore += 25;

      // 3. Document Title match (Weight: 15)
      let titleMatched = false;
      let matchedTitleToken = '';
      for (const token of signature.titleTokens) {
        if (titleText.includes(token)) {
          titleMatched = true;
          matchedTitleToken = token;
          break;
        }
      }
      signals.push({
        type: 'title',
        name: 'Document Title',
        matched: titleMatched,
        score: titleMatched ? 15 : 0,
        evidence: titleMatched ? matchedTitleToken : undefined,
      });
      if (titleMatched) totalScore += 15;

      // 4. Form Labels match (Weight: 15)
      let labelMatched = false;
      let matchedLabelToken = '';
      for (const token of signature.fieldLabelTokens) {
        if (labelsText.includes(token)) {
          labelMatched = true;
          matchedLabelToken = token;
          break;
        }
      }
      signals.push({
        type: 'label',
        name: 'Form Field Labels',
        matched: labelMatched,
        score: labelMatched ? 15 : 0,
        evidence: labelMatched ? matchedLabelToken : undefined,
      });
      if (labelMatched) totalScore += 15;

      // 5. DOM Structure markers (Weight: 5)
      let domMatched = false;
      if (doc) {
        for (const selector of signature.domMarkers) {
          if (doc.querySelector(selector)) {
            domMatched = true;
            break;
          }
        }
      }
      signals.push({
        type: 'dom-marker',
        name: 'DOM Structure Marker',
        matched: domMatched,
        score: domMatched ? 5 : 0,
      });
      if (domMatched) totalScore += 5;

      if (totalScore > bestScore) {
        secondBestScore = bestScore;
        bestScore = totalScore;
        bestSignature = signature;
        bestSignals = signals;
      } else if (totalScore > secondBestScore) {
        secondBestScore = totalScore;
      }
    }

    const CONFIDENCE_THRESHOLD = 50;
    const MINIMUM_MARGIN = 15;
    const hasSufficientMargin = (bestScore - secondBestScore) >= MINIMUM_MARGIN;

    // Determine status & confidence band
    if (bestSignature && bestScore >= CONFIDENCE_THRESHOLD && hasSufficientMargin) {
      const config = bestSignature.serviceId ? getServiceConfig(bestSignature.serviceId) : undefined;
      const verified = Boolean(config?.verified && isOfficialDomain);
      const summary = `Identified ${bestSignature.displayName} with ${bestScore}% confidence based on ${bestSignals.filter(s => s.matched).length} verified signals.`;

      return {
        status: 'detected',
        serviceType: bestSignature.type,
        serviceId: bestSignature.serviceId,
        serviceName: bestSignature.displayName,
        confidenceScore: Math.min(100, bestScore),
        confidence: Math.min(1, Math.round(bestScore) / 100),
        confidenceBand: bestScore >= 70 ? 'High' : 'Medium',
        strategy: 'multi-signal (URL, Title, Heading, Label, DOM)',
        workflowId: config?.workflowId,
        verified,
        reason: summary,
        signals: bestSignals,
        summary,
        isOfficialDomain,
      };
    }

    if (bestSignature && bestScore >= 20) {
      const summaryMsg = !hasSufficientMargin && bestScore >= CONFIDENCE_THRESHOLD
        ? `Uncertain service classification: competing signals detected between services (margin: ${bestScore - secondBestScore}% < ${MINIMUM_MARGIN}%).`
        : `Possible match for ${bestSignature.displayName} (${bestScore}% confidence). Awaiting explicit form elements.`;

      const config = bestSignature.serviceId ? getServiceConfig(bestSignature.serviceId) : undefined;

      return {
        status: 'uncertain',
        serviceType: bestSignature.type,
        serviceId: bestSignature.serviceId,
        serviceName: bestSignature.displayName,
        confidenceScore: bestScore,
        confidence: Math.round(bestScore) / 100,
        confidenceBand: 'Low',
        strategy: 'multi-signal partial match',
        workflowId: config?.workflowId,
        verified: false,
        reason: summaryMsg,
        signals: bestSignals,
        summary: summaryMsg,
        isOfficialDomain,
      };
    }

    if (isOfficialDomain) {
      return {
        status: 'uncertain',
        serviceType: ServiceType.DARSHAN,
        serviceName: 'TTD Portal (General Service)',
        confidenceScore: 30,
        confidence: 0.3,
        confidenceBand: 'Low',
        strategy: 'domain-fallback',
        workflowId: undefined,
        verified: false,
        reason: 'Connected to official TTD portal. Navigate to a booking service (Darshan or Accommodation) to activate full assistance.',
        signals: [],
        summary: 'Connected to official TTD portal. Navigate to a booking service (Darshan or Accommodation) to activate full assistance.',
        isOfficialDomain: true,
      };
    }

    return {
      status: 'not-detected',
      serviceType: ServiceType.GENERIC,
      serviceName: 'Unsupported Page',
      confidenceScore: 0,
      confidence: 0,
      confidenceBand: 'Low',
      strategy: 'none',
      workflowId: undefined,
      verified: false,
      reason: 'SevaPilot is waiting for a supported TTD booking page (ttdevasthanams.ap.gov.in).',
      signals: [],
      summary: 'SevaPilot is waiting for a supported TTD booking page (ttdevasthanams.ap.gov.in).',
      isOfficialDomain: false,
    };
  }
}

