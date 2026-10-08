// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Queue State Detector (Phase 10)
// Multi-signal DOM & page analyzer for TTD Digital Waiting Rooms
// ─────────────────────────────────────────────────────────────

import { isElementVisible } from '../../content/autofill/field-resolver';
import { detectCaptchaPresence } from '../guardian/page-detector';
import { detectTtdTemporaryLock } from '../ttd-information/ttd-lock-detector';
import type { QueueDetectionResult, QueueProgressInfo, QueueState } from './types';

/**
 * Known structural selectors for TTD and gateway waiting room implementations.
 */
const QUEUE_DOM_SELECTORS = [
  '#queue-it_log',
  '#waitingRoom',
  '.queue-container',
  '.waiting-room',
  '[data-testid*="queue"]',
  '#queueStatus',
  '.virtual-queue',
  '.progress-queue',
  '#divQueue',
  '.waiting-screen',
  '#queue-box',
  '.queue-banner',
] as const;

/**
 * Text tokens that signal a virtual queue or traffic holding page.
 */
const QUEUE_TEXT_TOKENS = [
  'you are in queue',
  'virtual waiting room',
  'waiting room',
  'estimated wait time',
  'please wait while we transfer you',
  'queue number',
  'please do not refresh',
  'high demand',
  'waiting for slot',
  'traffic surge',
  'queue position',
] as const;

/**
 * Extracts visible official queue position number from verified DOM nodes.
 * Returns undefined if no official position is visibly reported.
 */
export function extractOfficialQueuePosition(doc: Document): { position?: number; rawText?: string } {
  // 1. Dedicated position element selectors
  const positionSelectors = [
    '#queue-position',
    '.queue-position',
    '[data-testid*="queue-position"]',
    '#queueNumber',
    '.queue-number',
    '.position-value',
  ];

  for (const sel of positionSelectors) {
    const el = doc.querySelector<HTMLElement>(sel);
    if (el && isElementVisible(el)) {
      const text = (el.textContent || '').trim();
      const match = text.match(/\b\d+\b/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > 0) {
          return { position: num, rawText: text };
        }
      }
    }
  }

  // 2. Scan text nodes with strict contextual regex
  const bodyText = (doc.body?.innerText || doc.body?.textContent || '');
  const positionPatterns = [
    /(?:your\s+position\s+(?:in\s+queue|in\s+line|is)?\s*[:#-]?\s*)([\d,]+)/i,
    /(?:queue\s+position\s+(?:is)?\s*[:#-]?\s*)([\d,]+)/i,
    /(?:queue\s+number\s*[:#-]?\s*)([\d,]+)/i,
    /(?:number\s+in\s+line\s*[:#-]?\s*)([\d,]+)/i,
    /(?:(?:users?|devotees?|pilgrims?)\s+ahead\s+of\s+you\s*[:#-]?\s*)([\d,]+)/i,
  ];

  for (const regex of positionPatterns) {
    const match = bodyText.match(regex);
    if (match && match[1]) {
      const sanitized = match[1].replace(/,/g, '');
      const num = parseInt(sanitized, 10);
      if (!isNaN(num) && num > 0) {
        return { position: num, rawText: match[0].trim() };
      }
    }
  }

  return {};
}

/**
 * Extracts explicit official waiting time if reported by TTD DOM.
 * Never fabricates or calculates estimates.
 */
export function extractOfficialWaitTime(doc: Document): string | undefined {
  const waitSelectors = [
    '#wait-time',
    '.wait-time',
    '[data-testid*="wait-time"]',
    '#estimatedWaitTime',
  ];

  for (const sel of waitSelectors) {
    const el = doc.querySelector<HTMLElement>(sel);
    if (el && isElementVisible(el)) {
      const text = (el.textContent || '').trim();
      if (text) return text;
    }
  }

  const bodyText = (doc.body?.innerText || doc.body?.textContent || '');
  const waitPatterns = [
    /(?:estimated\s+wait(?:\s+time)?\s*[:#-]?\s*)([0-9]+\s*(?:minutes?|hours?|mins?|secs?))/i,
    /(?:approximate\s+wait(?:\s+time)?\s*[:#-]?\s*)([0-9]+\s*(?:minutes?|hours?|mins?|secs?))/i,
    /(?:expected\s+wait(?:\s+time)?\s*[:#-]?\s*)([0-9]+\s*(?:minutes?|hours?|mins?|secs?))/i,
    /(?:waiting\s+time\s*[:#-]?\s*)([0-9]+\s*(?:minutes?|hours?|mins?|secs?))/i,
  ];

  for (const regex of waitPatterns) {
    const match = bodyText.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Analyzes the current document and URL to classify the TTD Queue state.
 * Employs multiple signals and respects human boundaries (CAPTCHA, Lock, Expiry).
 */
export function detectQueueState(doc: Document = document, url: string = ''): QueueDetectionResult {
  const reasons: string[] = [];
  const targetUrl = url || (typeof window !== 'undefined' ? window.location?.href || '' : '');

  // 1. Temporary Booking Lock Check (Highest priority safety boundary)
  const lockResult = detectTtdTemporaryLock(doc, targetUrl);
  if (lockResult.isLocked && lockResult.lockState) {
    reasons.push('TTD Temporary Booking Lock takes safety precedence over queue');
    return {
      state: 'QUEUE_BLOCKED',
      isQueuePresent: false,
      confidence: 100,
      reasons,
      isCaptchaPresent: false,
      isSessionExpired: false,
      isTemporaryLock: true,
      errorMessage: lockResult.lockState.message || 'TTD temporary booking hold active',
    };
  }

  // 2. Explicit Error Check (using textContent to prevent synchronous layout reflow)
  const pageText = (doc.body?.textContent || '').toLowerCase();
  const isErrorPresent =
    pageText.includes('service unavailable') ||
    pageText.includes('queue service error') ||
    pageText.includes('something went wrong while waiting') ||
    pageText.includes('high traffic - please try again later');

  if (isErrorPresent && (pageText.includes('queue') || pageText.includes('waiting'))) {
    reasons.push('TTD queue error message detected on page');
    return {
      state: 'QUEUE_ERROR',
      isQueuePresent: true,
      confidence: 85,
      reasons,
      isCaptchaPresent: false,
      isSessionExpired: false,
      isTemporaryLock: false,
      errorMessage: 'TTD queue encountered a temporary error. Please follow on-screen instructions.',
    };
  }

  // 3. Session Expiration Check
  const isSessionExpired =
    pageText.includes('session has expired') ||
    pageText.includes('session timed out') ||
    pageText.includes('please login again to continue');

  if (isSessionExpired) {
    reasons.push('Session expiration notice detected');
    return {
      state: 'QUEUE_SESSION_EXPIRED',
      isQueuePresent: false,
      confidence: 90,
      reasons,
      isCaptchaPresent: false,
      isSessionExpired: true,
      isTemporaryLock: false,
      errorMessage: 'Your TTD session has expired. Manual login is required.',
    };
  }

  // 4. Multi-signal Queue Presence Scoring
  let score = 0;

  // Signal A: URL markers (40 pts)
  if (/queue|waiting.*room|virtual.*queue|throttle|holding|entry-queue/i.test(targetUrl)) {
    score += 40;
    reasons.push(`Queue indicator found in URL: ${targetUrl.slice(0, 50)}`);
  }

  // Signal B: Stable DOM Selectors (40 pts)
  for (const sel of QUEUE_DOM_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && isElementVisible(el as HTMLElement)) {
      score += 40;
      reasons.push(`Stable queue DOM element found: ${sel}`);
      break;
    }
  }

  // Signal C: Semantic Queue Text Tokens (35 pts)
  for (const token of QUEUE_TEXT_TOKENS) {
    if (pageText.includes(token)) {
      score += 35;
      reasons.push(`Verified queue text token found: "${token}"`);
      break;
    }
  }

  // 5. Evaluate Confidence
  const confidence = Math.min(100, score);
  if (confidence < 40) {
    return {
      state: 'QUEUE_NOT_PRESENT',
      isQueuePresent: false,
      confidence: 0,
      reasons: ['No confirmed queue indicators detected on page'],
      isCaptchaPresent: false,
      isSessionExpired: false,
      isTemporaryLock: false,
    };
  }

  // 6. Interactive CAPTCHA within Queue (Human boundary)
  const isCaptchaPresent = detectCaptchaPresence(doc);
  if (isCaptchaPresent) {
    reasons.push('Interactive CAPTCHA challenge present inside queue page');
    return {
      state: 'QUEUE_CAPTCHA_REQUIRED',
      isQueuePresent: true,
      confidence,
      reasons,
      isCaptchaPresent: true,
      isSessionExpired: false,
      isTemporaryLock: false,
    };
  }

  // 7. Extract Official Progress Indicators
  const { position, rawText } = extractOfficialQueuePosition(doc);
  const waitTime = extractOfficialWaitTime(doc);

  const progress: QueueProgressInfo = {
    position,
    rawPositionText: rawText,
    officialWaitTime: waitTime,
    isOfficialEstimate: Boolean(position || waitTime),
    statusMessage: position ? `Queue position: ${position}` : 'TTD is processing your request in the waiting room.',
    lastUpdated: new Date().toISOString(),
  };

  if (position) {
    reasons.push(`Official queue position verified: ${position}`);
  }
  if (waitTime) {
    reasons.push(`Official wait time reported by TTD: ${waitTime}`);
  }

  // Determine state: PROGRESSING if position changed/present, else WAITING
  const state: QueueState = position ? 'QUEUE_PROGRESSING' : 'QUEUE_WAITING';

  return {
    state,
    isQueuePresent: true,
    confidence,
    reasons,
    progress,
    isCaptchaPresent: false,
    isSessionExpired: false,
    isTemporaryLock: false,
  };
}
