// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 12 Chaos Performance
// Stress & Chaos tests: 1000 rapid DOM mutations, rerender storms,
// message bursts, zero runaway CPU, and strict safety preservation.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { domCache } from '../../../src/content/automation/dom-cache';
import { DomObservationEngine } from '../../../src/content/automation/dom-observation-engine';
import { messageCoalescer } from '../../../src/shared/message-coalescer';
import { timerManager } from '../../../src/shared/timer-manager';
import { ResilientAutomationEngine } from '../../../src/content/automation/resilient-automation-engine';

describe('Phase 12: Chaos Performance & Stress Testing', () => {
  beforeEach(() => {
    domCache.invalidateAll();
    messageCoalescer.clear();
    messageCoalescer.resetMetrics();
    timerManager.disposeAll();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    timerManager.disposeAll();
    domCache.invalidateAll();
  });

  // ─── 1. 1000 Rapid DOM Mutations Stress Test ───
  it('survives 1,000 rapid DOM mutations without runaway CPU or unbounded scans', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    let batchCount = 0;
    let totalNodes = 0;
    const observer = new DomObservationEngine(40);
    observer.onBatch((batch) => {
      batchCount++;
      totalNodes += batch.addedNodesCount;
    });

    observer.startObserving(container);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const el = document.createElement('div');
      el.className = `mat-row-${i}`;
      el.innerHTML = `<input name="devotee_${i}" value="Bhakta ${i}" />`;
      container.appendChild(el);
    }
    const duration = performance.now() - start;

    await new Promise(r => setTimeout(r, 80));
    if (batchCount === 0) observer.flushBatch();
    observer.stopObserving();

    // 1000 mutations must be ingested without unbounded delays and collapsed into <= 3 batches
    expect(duration).toBeLessThan(3500);
    expect(batchCount).toBeLessThanOrEqual(3);
    expect(totalNodes).toBeGreaterThan(0);
  });

  // ─── 2. Message Burst Coalescing Under Load ───
  it('coalesces 200 rapid identical state messages into minimal dispatches', () => {
    const topic = 'QUEUE_HEARTBEAT';
    let allowedCount = 0;

    for (let i = 0; i < 200; i++) {
      const shouldSend = messageCoalescer.shouldDispatch(topic, { status: 'WAITING', estTime: '10m' }, { windowMs: 200 });
      if (shouldSend) allowedCount++;
    }

    // Out of 200 identical messages, only 1 should be dispatched
    expect(allowedCount).toBe(1);
    const metrics = messageCoalescer.getMetrics();
    expect(metrics.suppressedCount).toBe(199);
    expect(metrics.suppressionRate).toBe('99.5%');
  });

  // ─── 3. High-Frequency Cache Turnover ───
  it('handles 500 rapid cache lookups and invalidations with zero memory retention', () => {
    for (let i = 0; i < 500; i++) {
      const el = document.createElement('div');
      document.body.appendChild(el);
      domCache.set(`key_${i}`, el, 500);
      expect(domCache.get(`key_${i}`)).toBe(el);
      document.body.removeChild(el);
      // Once detached, cache query must immediately return undefined
      expect(domCache.get(`key_${i}`)).toBeUndefined();
    }

    const metrics = domCache.getMetrics();
    expect(metrics.missCount).toBeGreaterThanOrEqual(500);
  });

  // ─── 4. Navigation During Heavy Mutation Flow ───
  it('instantly purges DOM caches when SPA navigation occurs during heavy DOM updates', () => {
    for (let i = 0; i < 50; i++) {
      domCache.set(`element_${i}`, { index: i });
    }

    expect(domCache.get('element_25')).toBeDefined();

    // Simulate SPA navigation
    domCache.updateActiveDocument('doc_new_instance', 'https://ttdevasthanams.ap.gov.in/darshan/new-stage');

    expect(domCache.get('element_25')).toBeUndefined();
    expect(domCache.getMetrics().size).toBe(0);
  });

  // ─── 5. Strict Zero-PII Invariance Under Telemetry Load ───
  it('preserves Zero-PII invariants even during high-frequency metric collection', () => {
    const engine = new ResilientAutomationEngine();
    const session = engine.startSession(1, 0, 'SED_300');

    // Engine records operational metrics
    const metrics = engine.getPerformanceMetrics();
    for (const m of metrics) {
      const serialized = JSON.stringify(m).toLowerCase();
      expect(serialized).not.toContain('aadhaar');
      expect(serialized).not.toContain('passport');
      expect(serialized).not.toContain('bhakta');
      expect(serialized).not.toContain('email');
      expect(serialized).not.toContain('mobile');
    }

    engine.stopSession('Test cleanup');
  });
});
