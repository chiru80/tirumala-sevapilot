// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 10 Queue Intelligence
// Production-grade TTD Digital Waiting Room Awareness Layer
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectQueueState,
  extractOfficialQueuePosition,
  extractOfficialWaitTime,
} from '../../../src/services/queue/queue-detector';
import { QueueManager } from '../../../src/services/queue/queue-manager';
import type { QueueSession, QueueDetectionResult } from '../../../src/services/queue/types';

describe('Phase 10: TTD Queue Intelligence & Safe Waiting', () => {
  let qManager: QueueManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    qManager = new QueueManager();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    qManager.emergencyStop();
  });

  // ─── 1. Queue Detection & Canonical States ───
  describe('1. Detection & Canonical States', () => {
    it('returns QUEUE_NOT_PRESENT on ordinary booking pages without queue indicators', () => {
      document.body.innerHTML = `
        <div class="booking-container">
          <h2>Special Entry Darshan (₹300)</h2>
          <form id="pilgrimForm">
            <input name="name" />
          </form>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/sed-booking');
      expect(result.state).toBe('QUEUE_NOT_PRESENT');
      expect(result.isQueuePresent).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('detects QUEUE_WAITING when waiting room elements and text are present', () => {
      document.body.innerHTML = `
        <div id="waitingRoom" class="queue-container">
          <h2>TTD Virtual Waiting Room</h2>
          <p>You are in the queue for Tirumala darshan booking.</p>
          <p>Please do not refresh or close this window.</p>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_WAITING');
      expect(result.isQueuePresent).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(40);
      expect(result.progress?.position).toBeUndefined();
    });

    it('detects QUEUE_PROGRESSING when official numeric queue position is present', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <h2>Virtual Waiting Room</h2>
          <div class="queue-position">
            <span>Your position in line: <strong>420</strong></span>
          </div>
          <div class="wait-time">Estimated wait time: 15 minutes</div>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/waiting-room');
      expect(result.state).toBe('QUEUE_PROGRESSING');
      expect(result.isQueuePresent).toBe(true);
      expect(result.progress?.position).toBe(420);
      expect(result.progress?.officialWaitTime).toContain('15 minutes');
      expect(result.progress?.isOfficialEstimate).toBe(true);
    });

    it('detects QUEUE_ERROR when explicit TTD error messages appear in queue', () => {
      document.body.innerHTML = `
        <div class="queue-container">
          <h2>Queue Service Error</h2>
          <p>Service unavailable due to high traffic - please try again later.</p>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_ERROR');
      expect(result.isQueuePresent).toBe(true);
      expect(result.errorMessage).toBeDefined();
    });
  });

  // ─── 2. Priority Boundaries: Temporary Booking Lock ───
  describe('2. Safety Boundary: Temporary Booking Lock Takes Precedence', () => {
    it('prioritizes TTD_TEMPORARY_BOOKING_LOCK over queue state (QUEUE_BLOCKED)', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <div class="alert alert-warning" role="alert">
            Your own previous attempt is still holding these pilgrims. Please wait a few minutes.
          </div>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_BLOCKED');
      expect(result.isTemporaryLock).toBe(true);
      expect(result.isQueuePresent).toBe(false);
      expect(result.errorMessage).toContain('holding this pilgrim');
    });
  });

  // ─── 3. Human Boundaries: CAPTCHA & Session Expiration ───
  describe('3. Human Boundaries: CAPTCHA & Session Expiration', () => {
    it('detects QUEUE_CAPTCHA_REQUIRED when CAPTCHA is present on queue page', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <h2>TTD Virtual Waiting Room</h2>
          <p>Please verify you are human to proceed.</p>
          <div class="g-recaptcha" data-sitekey="dummy"></div>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_CAPTCHA_REQUIRED');
      expect(result.isCaptchaPresent).toBe(true);
      expect(result.isQueuePresent).toBe(true);
    });

    it('detects QUEUE_SESSION_EXPIRED when session timed out message appears', () => {
      document.body.innerHTML = `
        <div class="queue-message">
          <h2>Your session has expired</h2>
          <p>Please login again to continue booking.</p>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_SESSION_EXPIRED');
      expect(result.isSessionExpired).toBe(true);
      expect(result.isQueuePresent).toBe(false);
    });
  });

  // ─── 4. Truth Boundary: Never Fabricate Numbers or Wait Times ───
  describe('4. Position & Wait-Time Extraction Authenticity', () => {
    it('extracts official position accurately from various DOM patterns', () => {
      document.body.innerHTML = `<div>Your queue position is 1,248 in line.</div>`;
      const pos1 = extractOfficialQueuePosition(document);
      expect(pos1.position).toBe(1248);

      document.body.innerHTML = `<div>Users ahead of you: 85</div>`;
      const pos2 = extractOfficialQueuePosition(document);
      expect(pos2.position).toBe(85);
    });

    it('does not invent or fabricate a position when absent', () => {
      document.body.innerHTML = `<div>TTD is currently processing devotees. Please wait.</div>`;
      const pos = extractOfficialQueuePosition(document);
      expect(pos.position).toBeUndefined();
      expect(pos.rawText).toBeUndefined();
    });

    it('extracts official wait time only when explicitly reported by TTD', () => {
      document.body.innerHTML = `<div>Approximate wait time: 8 minutes</div>`;
      const waitTime = extractOfficialWaitTime(document);
      expect(waitTime).toBe('8 minutes');
    });

    it('returns undefined for wait time if none is provided (never calculates fake estimate)', () => {
      document.body.innerHTML = `<div>High devotee volume. Your turn will arrive shortly.</div>`;
      const waitTime = extractOfficialWaitTime(document);
      expect(waitTime).toBeUndefined();
    });
  });

  // ─── 5. Queue Manager Lifecycle & Observer Cleanup ───
  describe('5. Queue Manager & Safe Observation Lifecycle', () => {
    it('initializes session and attaches observers on evaluateAndStart()', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <p>TTD Virtual Waiting Room</p>
        </div>
      `;

      const result = qManager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_WAITING');
      expect(qManager.isMonitoring()).toBe(true);

      const session = qManager.getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.state).toBe('QUEUE_WAITING');
      expect(session?.sessionId).toBeDefined();
    });

    it('transitions to QUEUE_COMPLETED and calls callbacks when queue DOM disappears', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <p>TTD Virtual Waiting Room</p>
        </div>
      `;
      qManager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(qManager.isMonitoring()).toBe(true);

      let completionFired = false;
      let completedSession: QueueSession | null = null;
      qManager.onQueueCompleted((session) => {
        completionFired = true;
        completedSession = session;
      });

      // Devotee admitted -> Queue DOM replaced with slot selection
      document.body.innerHTML = `
        <div class="calendar-container">
          <h2>Select Darshan Date and Time Slot</h2>
        </div>
      `;

      // Re-evaluate
      const afterResult = qManager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/slot-selection');
      expect(afterResult.state).toBe('QUEUE_NOT_PRESENT');
      expect(completionFired).toBe(true);
      expect((completedSession as QueueSession | null)?.state).toBe('QUEUE_COMPLETED');
      expect(qManager.isMonitoring()).toBe(false);
    });

    it('cleans up observers and timers on stopMonitoring()', () => {
      document.body.innerHTML = `<div id="waitingRoom">TTD Virtual Queue</div>`;
      qManager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(qManager.isMonitoring()).toBe(true);

      qManager.stopMonitoring();
      expect(qManager.isMonitoring()).toBe(false);
      expect(qManager.getActiveSession()).toBeNull();
    });

    it('immediately ceases monitoring on emergencyStop() without modifying TTD page', () => {
      document.body.innerHTML = `<div id="waitingRoom">TTD Virtual Queue</div>`;
      qManager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');

      let notifiedEvent: string | undefined;
      qManager.onStateChange((_, event) => {
        notifiedEvent = event;
      });

      qManager.emergencyStop();
      expect(qManager.isMonitoring()).toBe(false);
      expect(qManager.getActiveSession()).toBeNull();
      expect(notifiedEvent).toBe('QUEUE_INTERRUPTED');
      // Verify page DOM remains untouched
      expect(document.getElementById('waitingRoom')).not.toBeNull();
    });
  });

  // ─── 6. Multi-Tab Session Isolation ───
  describe('6. Multi-Tab Session Isolation', () => {
    it('isolates queue sessions across different tab IDs with unique session IDs', () => {
      const tab1Manager = new QueueManager(101);
      const tab2Manager = new QueueManager(102);

      document.body.innerHTML = `<div id="waitingRoom">TTD Virtual Queue</div>`;
      tab1Manager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');
      tab2Manager.evaluateAndStart(document, 'https://ttdevasthanams.ap.gov.in/queue');

      const session1 = tab1Manager.getActiveSession();
      const session2 = tab2Manager.getActiveSession();

      expect(session1?.tabId).toBe(101);
      expect(session2?.tabId).toBe(102);
      expect(session1?.sessionId).not.toBe(session2?.sessionId);

      tab1Manager.emergencyStop();
      tab2Manager.emergencyStop();
    });
  });

  // ─── 7. Security & Zero-PII Policy ───
  describe('7. Security & Zero-PII Verification', () => {
    it('never includes PII or tokens in session state or progress objects', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <input type="hidden" id="queueToken" value="secret_queue_token_abc123" />
          <p>Position: 15</p>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue?queue_token=sensitive_token_xyz');
      expect(JSON.stringify(result)).not.toContain('secret_queue_token_abc123');
      expect(JSON.stringify(result)).not.toContain('sensitive_token_xyz');
    });

    it('ignores malicious script tags or executable payloads in DOM text', () => {
      document.body.innerHTML = `
        <div id="waitingRoom">
          <p>TTD Virtual Queue</p>
          <script>alert("malicious_execution");</script>
          <div class="queue-position">Position: 50</div>
        </div>
      `;

      const result = detectQueueState(document, 'https://ttdevasthanams.ap.gov.in/queue');
      expect(result.state).toBe('QUEUE_PROGRESSING');
      expect(result.progress?.position).toBe(50);
      // Ensure no raw script code was executed or injected
      expect(result.progress?.statusMessage).toBe('Queue position: 50');
    });
  });
});
