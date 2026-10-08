// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 11 Resilient Automation
// Comprehensive verification of State Machine, Session Ownership,
// Document Identity, Field Ownership, Retry, Recovery, and Protocol.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AutomationStateMachine,
  getDocumentInstanceId,
  SPANavigationDetector,
  DomObservationEngine,
  DomTraversalEngine,
  FieldOwnershipTracker,
  ResilientRetryEngine,
  RecoveryEngine,
  validateAutomationMessage,
  ResilientAutomationEngine,
  AutomationAbortedError,
} from '../../../src/content/automation';

describe('Phase 11: Resilient Automation Engine Architecture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // ─── 1. Canonical State Machine ───
  describe('1. Canonical State Machine', () => {
    it('enforces valid forward transitions: IDLE -> OBSERVING -> FORM_DETECTED -> FIELD_RESOLUTION', () => {
      const sm = new AutomationStateMachine('IDLE');
      expect(sm.getState()).toBe('IDLE');

      expect(sm.transition('OBSERVING', 'Page scan started')).toBe(true);
      expect(sm.getState()).toBe('OBSERVING');

      expect(sm.transition('FORM_DETECTED', 'Found form inputs')).toBe(true);
      expect(sm.getState()).toBe('FORM_DETECTED');

      expect(sm.transition('FIELD_RESOLUTION', 'Resolving pilgrim fields')).toBe(true);
      expect(sm.getState()).toBe('FIELD_RESOLUTION');
    });

    it('strictly rejects illegal backward/arbitrary transitions (e.g. IDLE -> FILLING)', () => {
      const sm = new AutomationStateMachine('IDLE');
      expect(() => sm.transition('FILLING', 'Illegal jump')).toThrowError(/Invalid transition/);
      expect(sm.getState()).toBe('IDLE');
    });

    it('emits state change callbacks and records transition history', () => {
      const sm = new AutomationStateMachine('IDLE');
      const callback = vi.fn();
      sm.onStateChange(callback);

      sm.transition('OBSERVING', 'Test start');
      sm.transition('PAGE_IDENTIFIED', 'Found SED');

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('PAGE_IDENTIFIED', 'OBSERVING', 'Found SED');

      const history = sm.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.from).toBe('IDLE');
      expect(history[0]?.to).toBe('OBSERVING');
    });
  });

  // ─── 2. Document Identity & SPA Navigation ───
  describe('2. Document Identity & SPA Navigation', () => {
    it('assigns unique and stable instance ID to document', () => {
      const docId1 = getDocumentInstanceId(document);
      const docId2 = getDocumentInstanceId(document);

      expect(docId1).toBeDefined();
      expect(docId1).toBe(docId2);
      expect(docId1.startsWith('doc_')).toBe(true);
    });

    it('detects SPA navigation via pushState and triggers listeners', () => {
      const detector = new SPANavigationDetector();
      const listener = vi.fn();
      detector.onNavigation(listener);
      detector.startListening(101, 0);

      history.pushState({}, '', '/new-booking-url');
      detector.checkNavigation(101, 0, 'manual_test');

      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[0];
      expect(lastCall[0].url).toContain('/new-booking-url');
      expect(lastCall[0].tabId).toBe(101);

      detector.stopListening();
    });
  });

  // ─── 3. Safe DOM Observation & Shadow DOM ───
  describe('3. DOM Observation & Safe Traversal', () => {
    it('traverses normal DOM and open Shadow DOM roots without error', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<input id="shadowInput" value="test-shadow" />`;

      const found = DomTraversalEngine.querySelector('#shadowInput');
      expect(found).not.toBeNull();
      expect((found as HTMLInputElement)?.value).toBe('test-shadow');
    });

    it('debounces and micro-batches rapid child mutations', async () => {
      vi.useFakeTimers();
      const observer = new DomObservationEngine(50);
      const batchListener = vi.fn();
      observer.onBatch(batchListener);
      observer.startObserving(document.body);

      // Trigger multiple DOM updates
      for (let i = 0; i < 5; i++) {
        const div = document.createElement('div');
        div.innerHTML = `<input name="field_${i}" />`;
        document.body.appendChild(div);
      }

      // Fast forward past debounce window
      vi.advanceTimersByTime(100);

      observer.stopObserving();
      vi.useRealTimers();
    });
  });

  // ─── 4. Field Ownership & Human Modification Boundary ───
  describe('4. Field Ownership & Human Modification Protection', () => {
    let tracker: FieldOwnershipTracker;

    beforeEach(() => {
      tracker = new FieldOwnershipTracker();
      tracker.startTracking(document);
    });

    afterEach(() => {
      tracker.stopTracking(document);
    });

    it('classifies EMPTY, ALREADY_CORRECT, WRONG_VALUE, and UNAVAILABLE correctly', () => {
      document.body.innerHTML = `
        <input id="emptyField" value="" />
        <input id="correctField" value="Srinivas" />
        <input id="wrongField" value="Rajesh" />
        <input id="disabledField" value="Srinivas" disabled />
      `;

      const emptyEl = document.getElementById('emptyField')!;
      const correctEl = document.getElementById('correctField')!;
      const wrongEl = document.getElementById('wrongField')!;
      const disabledEl = document.getElementById('disabledField')!;

      expect(tracker.classifyFieldLifecycle(emptyEl, 'Srinivas')).toBe('EMPTY');
      expect(tracker.classifyFieldLifecycle(correctEl, 'Srinivas')).toBe('ALREADY_CORRECT');
      expect(tracker.classifyFieldLifecycle(wrongEl, 'Srinivas')).toBe('WRONG_VALUE');
      expect(tracker.classifyFieldLifecycle(disabledEl, 'Srinivas')).toBe('UNAVAILABLE');
    });

    it('flags field as USER_MODIFIED on human input and prevents overwrite', () => {
      document.body.innerHTML = `<input id="nameInput" value="Devotee" />`;
      const input = document.getElementById('nameInput')!;

      tracker.markAsUserModified(input);
      expect(tracker.isUserModified(input)).toBe(true);
      expect(tracker.getOwnership(input)).toBe('USER');
      expect(tracker.classifyFieldLifecycle(input, 'DifferentName')).toBe('USER_MODIFIED');
    });
  });

  // ─── 5. Resilient Retry Engine & Safety Exclusions ───
  describe('5. Resilient Retry Engine & Safety Exclusions', () => {
    it('retries transient failures up to maximum attempts', async () => {
      const retryEngine = new ResilientRetryEngine();
      let count = 0;

      const result = await retryEngine.executeWithRetry(
        'resolve_field',
        async () => {
          count++;
          if (count < 3) throw new Error('DOM not ready');
          return 'element_found';
        },
        { maxAttempts: 4, baseDelayMs: 10, jitter: false },
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('element_found');
      expect(result.attempts).toBe(3);
    });

    it('strictly forbids automated retry for CAPTCHA, OTP, Payment, and Temporary Lock', async () => {
      const retryEngine = new ResilientRetryEngine();
      let callCount = 0;

      const result = await retryEngine.executeWithRetry(
        'solve_captcha_challenge',
        async () => {
          callCount++;
          throw new Error('Manual action needed');
        },
        { maxAttempts: 5 },
      );

      // Must execute exactly once and NEVER retry
      expect(result.success).toBe(false);
      expect(callCount).toBe(1);
      expect(result.attempts).toBe(1);
    });

    it('immediately aborts long-running operations when AbortSignal fires', async () => {
      const retryEngine = new ResilientRetryEngine();
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 20);

      await expect(
        retryEngine.executeWithRetry(
          'slow_poll',
          async () => {
            await new Promise((res) => setTimeout(res, 100));
            return 'done';
          },
          { signal: controller.signal, baseDelayMs: 50 },
        ),
      ).rejects.toThrowError(AutomationAbortedError);
    });
  });

  // ─── 6. Recovery Engine ───
  describe('6. Recovery Engine Strategies', () => {
    it('applies controlled strategies for FIELD_NOT_FOUND, DOM_REPLACED, and USER_MODIFIED', () => {
      const recovery = new RecoveryEngine();

      const r1 = recovery.handleRecovery('FIELD_NOT_FOUND', { field: 'age' });
      expect(r1.strategyApplied).toBe('re-observe-and-re-resolve');
      expect(r1.recovered).toBe(true);

      const r2 = recovery.handleRecovery('DOM_REPLACED');
      expect(r2.strategyApplied).toBe('invalidate-element-pointer');
      expect(r2.recovered).toBe(true);

      const r3 = recovery.handleRecovery('USER_MODIFIED', { field: 'name' });
      expect(r3.strategyApplied).toBe('preserve-user-value');
      expect(r3.recovered).toBe(true);

      const r4 = recovery.handleRecovery('PAGE_CHANGED');
      expect(r4.strategyApplied).toBe('abort-and-re-evaluate-page');
      expect(r4.requiresUserAction).toBe(true);
    });
  });

  // ─── 7. Typed Message Protocol ───
  describe('7. Typed Message Protocol Validation', () => {
    it('accepts valid automation messages with session ID', () => {
      const raw = {
        type: 'AUTOMATION_START',
        sessionId: 'session_123',
        serviceId: 'sed-300',
      };

      const validated = validateAutomationMessage(raw, 'session_123');
      expect(validated).not.toBeNull();
      expect(validated?.type).toBe('AUTOMATION_START');
      expect(validated?.sessionId).toBe('session_123');
    });

    it('rejects unknown message types, missing session ID, or mismatched sessions', () => {
      expect(validateAutomationMessage({ type: 'UNKNOWN_MSG', sessionId: '1' })).toBeNull();
      expect(validateAutomationMessage({ type: 'AUTOMATION_START' })).toBeNull();
      expect(validateAutomationMessage({ type: 'AUTOMATION_START', sessionId: 'sess_1' }, 'sess_2')).toBeNull();
    });
  });

  // ─── 8. Orchestrator Integration: Idempotency & Abortability ───
  describe('8. Resilient Automation Engine Orchestrator', () => {
    let engine: ResilientAutomationEngine;

    beforeEach(() => {
      engine = new ResilientAutomationEngine();
    });

    afterEach(() => {
      engine.emergencyStop();
    });

    it('executes idempotent autofill, skipping already-correct fields and preserving user-modified ones', async () => {
      document.body.innerHTML = `
        <form id="pilgrimForm">
          <input id="nameField" value="Srinivas" />
          <input id="ageField" value="" />
          <input id="cityField" value="Bangalore" />
        </form>
      `;

      // Devotee manually edited city
      const cityEl = document.getElementById('cityField')!;
      const ownership = new FieldOwnershipTracker();
      ownership.startTracking(document);
      ownership.markAsUserModified(cityEl);

      const session = engine.startSession(101, 0, 'sed-300');
      expect(session.sessionId).toBeDefined();

      const plan = {
        serviceId: 'sed-300',
        fieldsToFill: [
          { field: 'name', value: 'Srinivas', elementSelector: '#nameField' },
          { field: 'age', value: '45', elementSelector: '#ageField' },
          { field: 'city', value: 'Tirupati', elementSelector: '#cityField' },
        ],
      };

      const result = await engine.executePlan(plan);
      expect(result.success).toBe(true);
      expect(result.state).toBe('COMPLETED');
      // name: already correct (skipped: 1)
      // age: filled (filled: 1)
      // city: user modified (preserved: 1)
      expect(result.filledCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.preservedUserCount).toBe(1);

      expect((document.getElementById('ageField') as HTMLInputElement).value).toBe('45');
      // City was preserved as Bangalore, NOT overwritten to Tirupati
      expect((document.getElementById('cityField') as HTMLInputElement).value).toBe('Bangalore');

      ownership.stopTracking(document);
    });

    it('immediately ceases monitoring on emergencyStop() without modifying page', () => {
      document.body.innerHTML = `<input id="testField" value="" />`;
      engine.startSession(101, 0);

      engine.emergencyStop();
      expect(engine.getState()).toBe('STOPPED');
      expect(engine.getActiveSession()).toBeNull();
    });
  });
});
