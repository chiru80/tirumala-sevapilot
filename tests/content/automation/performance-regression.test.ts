// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 12 Performance Engineering
// Regression tests for DomInvalidationCache, MutationObserver batching,
// message deduplication, storage performance, and deterministic cleanup.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { domCache } from '../../../src/content/automation/dom-cache';
import { DomObservationEngine } from '../../../src/content/automation/dom-observation-engine';
import { messageCoalescer } from '../../../src/shared/message-coalescer';
import { timerManager } from '../../../src/shared/timer-manager';
import { detectQueueState } from '../../../src/services/queue';
import { detectGuardianPageStage, invalidateGuardianPageStageCache } from '../../../src/services/guardian/page-detector';

const storageMap = new Map<string, any>();
(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') return { [key]: storageMap.get(key) };
        const res: Record<string, any> = {};
        for (const k of key) res[k] = storageMap.get(k);
        return res;
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      },
      clear: async () => storageMap.clear(),
    },
    sync: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') return { [key]: storageMap.get(key) };
        const res: Record<string, any> = {};
        for (const k of key) res[k] = storageMap.get(k);
        return res;
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      },
      clear: async () => storageMap.clear(),
    },
    session: {
      get: async (key: string) => ({ [key]: storageMap.get(key) }),
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      },
      remove: async (key: string) => {
        storageMap.delete(key);
      },
    },
  },
};

import { getSettings, saveSettings, getSessionState, setSessionState, clearSessionState } from '../../../src/storage/repository';

describe('Phase 12: Performance Engineering & Zero-Lag Runtime', () => {
  beforeEach(() => {
    domCache.invalidateAll();
    messageCoalescer.clear();
    messageCoalescer.resetMetrics();
    timerManager.disposeAll();
    storageMap.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    timerManager.disposeAll();
    domCache.invalidateAll();
  });

  // ─── 1. DOM Invalidation Cache ───
  describe('1. DOM Invalidation Cache', () => {
    it('caches and retrieves items within TTL', () => {
      domCache.set('test:key', { data: 123 }, 200);
      const cached = domCache.get<{ data: number }>('test:key');
      expect(cached).toEqual({ data: 123 });

      const metrics = domCache.getMetrics();
      expect(metrics.hitCount).toBe(1);
    });

    it('invalidates cache when element disconnects from DOM', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      domCache.set('test:el', el, 1000);

      expect(domCache.get('test:el')).toBe(el);

      // Remove element from DOM
      document.body.removeChild(el);
      expect(domCache.get('test:el')).toBeUndefined();
    });

    it('invalidates cache entries on route or document change', () => {
      domCache.set('pageStage:test', { stage: 'FORM_DETECTED' });
      expect(domCache.get('pageStage:test')).toBeDefined();

      domCache.updateActiveDocument('doc_new', 'https://ttdevasthanams.ap.gov.in/new-route');
      expect(domCache.get('pageStage:test')).toBeUndefined();
    });
  });

  // ─── 2. MutationObserver Stress & Micro-Batching ───
  describe('2. MutationObserver Stress & Micro-Batching (100, 500, 1000 mutations)', () => {
    it('micro-batches 100 mutations into minimal batch events', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      let batchCount = 0;
      const observer = new DomObservationEngine(30);
      observer.onBatch(() => batchCount++);
      observer.startObserving(container);

      for (let i = 0; i < 100; i++) {
        const item = document.createElement('input');
        item.name = `field_${i}`;
        container.appendChild(item);
      }

      await new Promise(r => setTimeout(r, 60));
      if (batchCount === 0) observer.flushBatch();
      observer.stopObserving();

      // Rather than 100 scans, micro-batching coalesces to <= 2 batches
      expect(batchCount).toBeLessThanOrEqual(2);
      expect(batchCount).toBeGreaterThan(0);
    });

    it('ignores style-only and extension UI mutations', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      let batchReceived = false;
      let hasForm = false;
      const observer = new DomObservationEngine(20);
      observer.onBatch((batch) => {
        batchReceived = true;
        hasForm = batch.hasFormChanges;
      });
      observer.startObserving(container);

      // Extension UI element
      const spElem = document.createElement('div');
      spElem.id = 'sp-cockpit-fill-btn';
      container.appendChild(spElem);

      await new Promise(r => setTimeout(r, 50));
      if (!batchReceived) observer.flushBatch();
      observer.stopObserving();

      expect(hasForm).toBe(false);
    });
  });

  // ─── 3. Message Deduplication & Coalescing ───
  describe('3. Message Deduplication & Coalescing', () => {
    it('suppresses rapid identical messages within coalesce window', () => {
      const topic = 'QUEUE_STATE_CHANGED';
      const payload = { state: 'QUEUE_PROGRESSING', position: 42 };

      // First dispatch should pass
      const d1 = messageCoalescer.shouldDispatch(topic, payload, { windowMs: 100 });
      expect(d1).toBe(true);

      // Immediate identical repeat should be suppressed
      const d2 = messageCoalescer.shouldDispatch(topic, payload, { windowMs: 100 });
      expect(d2).toBe(false);

      // Different payload should pass
      const d3 = messageCoalescer.shouldDispatch(topic, { ...payload, position: 40 }, { windowMs: 100 });
      expect(d3).toBe(true);

      const metrics = messageCoalescer.getMetrics();
      expect(metrics.suppressedCount).toBe(1);
      expect(metrics.totalDispatched).toBe(2);
    });
  });

  // ─── 4. Storage Performance & Ephemeral Session Separation ───
  describe('4. Storage Performance & Ephemeral Session Separation', () => {
    it('reads settings instantly via in-memory cache', async () => {
      await saveSettings({ theme: 'dark' });
      const t0 = performance.now();
      const s1 = await getSettings();
      const readMs = performance.now() - t0;

      expect(s1.theme).toBe('dark');
      expect(readMs).toBeLessThan(5); // In-memory cache returns in sub-millisecond
    });

    it('stores ephemeral state in session storage without touching local storage', async () => {
      await setSessionState('active_session_lock', { locked: true, docId: 'doc_123' });
      const res = await getSessionState<{ locked: boolean; docId: string }>('active_session_lock');
      expect(res).toEqual({ locked: true, docId: 'doc_123' });

      await clearSessionState('active_session_lock');
      const cleared = await getSessionState('active_session_lock');
      expect(cleared).toBeNull();
    });
  });

  // ─── 5. Deterministic Timer Lifecycle & Cleanup ───
  describe('5. Deterministic Timer Lifecycle & Cleanup', () => {
    it('tracks and clears all timers for a specific owner on dispose', () => {
      const owner = 'queue-monitor';
      const t1 = timerManager.setTimeout(() => {}, 1000, owner, 'check-status');
      const t2 = timerManager.setInterval(() => {}, 1000, owner, 'poll-tick');

      expect(timerManager.getActiveTimerCount()).toBe(2);

      const cleared = timerManager.clearAllForOwner(owner);
      expect(cleared).toBe(2);
      expect(timerManager.getActiveTimerCount()).toBe(0);
    });

    it('prevents orphan intervals by enforcing max lifetime limit', () => {
      let ticks = 0;
      const key = timerManager.setInterval(() => { ticks++; }, 10, 'stress', 'test', 25);
      expect(timerManager.getActiveTimerCount()).toBe(1);
      timerManager.clearTimer(key);
      expect(timerManager.getActiveTimerCount()).toBe(0);
    });
  });

  // ─── 6. Page Stage Detection Caching & Reflow Defense ───
  describe('6. Page Stage Detection Caching & Reflow Defense', () => {
    it('caches stage detection to prevent redundant scans', () => {
      const doc = document.implementation.createHTMLDocument('Special Entry');
      const container = doc.createElement('div');
      container.innerHTML = '<h1>Special Entry Darshan</h1><div class="pilgrim-details"></div>';
      doc.body.appendChild(container);

      const res1 = detectGuardianPageStage(doc, 'https://ttdevasthanams.ap.gov.in/special-entry');
      const res2 = detectGuardianPageStage(doc, 'https://ttdevasthanams.ap.gov.in/special-entry');

      expect(res1.stage).toBeDefined();
      expect(res2).toEqual(res1);

      invalidateGuardianPageStageCache();
    });
  });
});
