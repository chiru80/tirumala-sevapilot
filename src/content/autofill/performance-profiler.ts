// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Performance Profiler (Phase 3)
// Zero-PII instrumentation layer measuring autofill latencies,
// phase durations, field counts, and retries.
// ─────────────────────────────────────────────────

import logger from '@shared/logger';

export interface PerformanceMetrics {
  sessionId: string;
  serviceId?: string;
  workflowId?: string;
  pilgrimCount: number;
  fieldsResolved: number;
  fieldsFilled: number;
  fieldsVerified: number;
  fieldsSkipped: number;
  retries: number;
  scanMs: number;
  resolveMs: number;
  fillMs: number;
  verifyMs: number;
  angularWaitMs?: number;
  totalMs: number;
  success: boolean;
  timestamp: number;
}

export class PerformanceProfiler {
  private sessionId: string;
  private serviceId?: string;
  private workflowId?: string;
  private pilgrimCount = 0;
  private fieldsResolved = 0;
  private fieldsFilled = 0;
  private fieldsVerified = 0;
  private fieldsSkipped = 0;
  private retries = 0;
  private angularWaitMs = 0;

  private startTimes: Map<string, number> = new Map();
  private durations: Map<string, number> = new Map();
  private sessionStart: number;

  constructor(serviceId?: string, workflowId?: string, pilgrimCount = 0) {
    this.sessionId = `perf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.serviceId = serviceId;
    this.workflowId = workflowId;
    this.pilgrimCount = pilgrimCount;
    this.sessionStart = performance.now();
    this.startTimes.set('total', this.sessionStart);
    this.safeMark(`sevapilot:${this.sessionId}:start`);
  }

  private safeMark(name: string): void {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark(name);
      }
    } catch {
      // Graceful fallback for restricted environments
    }
  }

  private safeMeasure(name: string, startMark: string, endMark: string): void {
    try {
      if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
        performance.measure(name, startMark, endMark);
      }
    } catch {
      // Graceful fallback
    }
  }

  public setContext(serviceId?: string, workflowId?: string, pilgrimCount?: number): void {
    if (serviceId) this.serviceId = serviceId;
    if (workflowId) this.workflowId = workflowId;
    if (pilgrimCount !== undefined) this.pilgrimCount = pilgrimCount;
  }

  public startPhase(phase: 'scan' | 'resolve' | 'fill' | 'verify'): void {
    this.startTimes.set(phase, performance.now());
    this.safeMark(`sevapilot:${this.sessionId}:${phase}:start`);
  }

  public endPhase(phase: 'scan' | 'resolve' | 'fill' | 'verify'): number {
    const start = this.startTimes.get(phase);
    if (start === undefined) return 0;
    const duration = Math.round((performance.now() - start) * 100) / 100;
    const existing = this.durations.get(phase) || 0;
    this.durations.set(phase, Math.round((existing + duration) * 100) / 100);
    this.startTimes.delete(phase);

    const endMark = `sevapilot:${this.sessionId}:${phase}:end`;
    this.safeMark(endMark);
    this.safeMeasure(
      `sevapilot:${phase}`,
      `sevapilot:${this.sessionId}:${phase}:start`,
      endMark,
    );

    return duration;
  }

  public startOperation(opName: string): void {
    this.startTimes.set(`op:${opName}`, performance.now());
    this.safeMark(`sevapilot:${this.sessionId}:op:${opName}:start`);
  }

  public endOperation(opName: string): number {
    const start = this.startTimes.get(`op:${opName}`);
    if (start === undefined) return 0;
    const duration = Math.round((performance.now() - start) * 100) / 100;
    const existing = this.durations.get(`op:${opName}`) || 0;
    this.durations.set(`op:${opName}`, Math.round((existing + duration) * 100) / 100);
    this.startTimes.delete(`op:${opName}`);

    const endMark = `sevapilot:${this.sessionId}:op:${opName}:end`;
    this.safeMark(endMark);
    this.safeMeasure(
      `sevapilot:op:${opName}`,
      `sevapilot:${this.sessionId}:op:${opName}:start`,
      endMark,
    );

    return duration;
  }

  public recordAngularWait(durationMs: number): void {
    this.angularWaitMs += Math.round(durationMs * 100) / 100;
  }

  public recordFieldResolved(count: number = 1): void {
    this.fieldsResolved += count;
  }

  public recordFieldFilled(count: number = 1): void {
    this.fieldsFilled += count;
  }

  public recordFieldVerified(count: number = 1): void {
    this.fieldsVerified += count;
  }

  public recordFieldSkipped(count: number = 1): void {
    this.fieldsSkipped += count;
  }

  public recordRetry(count: number = 1): void {
    this.retries += count;
  }

  public finish(success: boolean): PerformanceMetrics {
    const totalMs = Math.round((performance.now() - this.sessionStart) * 100) / 100;
    this.durations.set('total', totalMs);

    const finishMark = `sevapilot:${this.sessionId}:finish`;
    this.safeMark(finishMark);
    this.safeMeasure(
      'sevapilot:total',
      `sevapilot:${this.sessionId}:start`,
      finishMark,
    );

    const metrics: PerformanceMetrics = {
      sessionId: this.sessionId,
      serviceId: this.serviceId,
      workflowId: this.workflowId,
      pilgrimCount: this.pilgrimCount,
      fieldsResolved: this.fieldsResolved,
      fieldsFilled: this.fieldsFilled,
      fieldsVerified: this.fieldsVerified,
      fieldsSkipped: this.fieldsSkipped,
      retries: this.retries,
      scanMs: this.durations.get('scan') || 0,
      resolveMs: this.durations.get('resolve') || 0,
      fillMs: this.durations.get('fill') || 0,
      verifyMs: this.durations.get('verify') || 0,
      angularWaitMs: this.angularWaitMs,
      totalMs,
      success,
      timestamp: Date.now(),
    };

    logger.debug('[PerformanceProfiler] Session completed:', {
      pilgrims: metrics.pilgrimCount,
      resolved: metrics.fieldsResolved,
      filled: metrics.fieldsFilled,
      verified: metrics.fieldsVerified,
      skipped: metrics.fieldsSkipped,
      totalMs: `${metrics.totalMs}ms`,
      phases: `scan: ${metrics.scanMs}ms, resolve: ${metrics.resolveMs}ms, fill: ${metrics.fillMs}ms, verify: ${metrics.verifyMs}ms`,
      angularWaitMs: `${metrics.angularWaitMs}ms`,
    });

    return metrics;
  }

  public cleanup(): void {
    try {
      if (typeof performance !== 'undefined') {
        if (typeof performance.clearMarks === 'function') {
          performance.clearMarks(`sevapilot:${this.sessionId}:start`);
          performance.clearMarks(`sevapilot:${this.sessionId}:finish`);
        }
      }
    } catch {
      // Ignore cleanup error
    }
  }

  public getMetrics(success = true): PerformanceMetrics {
    return this.finish(success);
  }
}
