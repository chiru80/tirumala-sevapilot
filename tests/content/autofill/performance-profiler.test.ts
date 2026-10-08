// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 11 Performance Profiler
// Verifies real timing instrumentation, performance.mark/measure,
// phase durations, granular operations, and zero-PII metrics.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceProfiler, type PerformanceMetrics } from '../../../src/content/autofill/performance-profiler';

describe('Phase 11: Performance Profiler & Real Timing Instrumentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes session with high-resolution start time and safe performance marks', () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const profiler = new PerformanceProfiler('special-entry-darshan-300', 'sed-workflow', 2);

    expect(markSpy).toHaveBeenCalledWith(expect.stringMatching(/^sevapilot:perf-.*:start$/));
    const metrics = profiler.getMetrics();
    expect(metrics.serviceId).toBe('special-entry-darshan-300');
    expect(metrics.workflowId).toBe('sed-workflow');
    expect(metrics.pilgrimCount).toBe(2);
    expect(metrics.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('measures individual phase durations with performance.mark and performance.measure', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const measureSpy = vi.spyOn(performance, 'measure');

    const profiler = new PerformanceProfiler('special-entry-darshan-300');

    profiler.startPhase('scan');
    await new Promise((r) => setTimeout(r, 15));
    const scanDuration = profiler.endPhase('scan');

    expect(scanDuration).toBeGreaterThanOrEqual(10);
    expect(markSpy).toHaveBeenCalledWith(expect.stringMatching(/^sevapilot:perf-.*:scan:start$/));
    expect(markSpy).toHaveBeenCalledWith(expect.stringMatching(/^sevapilot:perf-.*:scan:end$/));
    expect(measureSpy).toHaveBeenCalledWith(
      'sevapilot:scan',
      expect.stringMatching(/^sevapilot:perf-.*:scan:start$/),
      expect.stringMatching(/^sevapilot:perf-.*:scan:end$/),
    );

    profiler.startPhase('fill');
    await new Promise((r) => setTimeout(r, 10));
    const fillDuration = profiler.endPhase('fill');
    expect(fillDuration).toBeGreaterThanOrEqual(8);

    const metrics = profiler.finish(true);
    expect(metrics.scanMs).toBe(scanDuration);
    expect(metrics.fillMs).toBe(fillDuration);
    expect(metrics.totalMs).toBeGreaterThanOrEqual(scanDuration + fillDuration);
  });

  it('tracks granular operation durations and Angular wait timings', async () => {
    const profiler = new PerformanceProfiler();

    profiler.startOperation('dom-query-resolution');
    await new Promise((r) => setTimeout(r, 10));
    const opDuration = profiler.endOperation('dom-query-resolution');
    expect(opDuration).toBeGreaterThanOrEqual(8);

    profiler.recordAngularWait(45.5);
    profiler.recordAngularWait(20.5);

    const metrics = profiler.finish(true);
    expect(metrics.angularWaitMs).toBe(66);
  });

  it('accurately counts resolved, filled, verified, skipped, and retry events', () => {
    const profiler = new PerformanceProfiler();

    profiler.recordFieldResolved(6);
    profiler.recordFieldFilled(4);
    profiler.recordFieldVerified(4);
    profiler.recordFieldSkipped(2);
    profiler.recordRetry(1);

    const metrics = profiler.finish(true);
    expect(metrics.fieldsResolved).toBe(6);
    expect(metrics.fieldsFilled).toBe(4);
    expect(metrics.fieldsVerified).toBe(4);
    expect(metrics.fieldsSkipped).toBe(2);
    expect(metrics.retries).toBe(1);
    expect(metrics.success).toBe(true);
  });

  it('strictly preserves zero-PII guarantee in performance metrics', () => {
    const profiler = new PerformanceProfiler('special-entry-darshan-300', 'sed-workflow', 4);
    profiler.recordFieldResolved(8);
    profiler.recordFieldFilled(8);
    profiler.recordFieldVerified(8);

    const metrics = profiler.finish(true);
    const serialized = JSON.stringify(metrics);

    // Verify zero PII fields exist
    expect(serialized).not.toContain('aadhaar');
    expect(serialized).not.toContain('mobile');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('name');
    expect(serialized).not.toContain('address');
    expect(serialized).not.toContain('base64');
  });

  it('handles environments where performance.mark or measure throw without crashing', () => {
    vi.spyOn(performance, 'mark').mockImplementation(() => {
      throw new Error('Not allowed');
    });
    vi.spyOn(performance, 'measure').mockImplementation(() => {
      throw new Error('Not allowed');
    });

    expect(() => {
      const profiler = new PerformanceProfiler();
      profiler.startPhase('scan');
      profiler.endPhase('scan');
      profiler.startOperation('test-op');
      profiler.endOperation('test-op');
      profiler.finish(true);
      profiler.cleanup();
    }).not.toThrow();
  });
});
