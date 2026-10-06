// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Phase 3 — Queue Monitor Tests
// Passive detection-only. No bypass, no spam.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DigitalQueueMonitor } from '../../src/content/queue/queue-monitor';

function makeQueueDoc(): Document {
  const doc = new DOMParser().parseFromString(
    '<html><body><div id="waitingRoom">You are in queue</div></body></html>',
    'text/html'
  );
  return doc;
}

function makeBookingDoc(): Document {
  const doc = new DOMParser().parseFromString(
    '<html><body><form><input formcontrolname="name"/><input formcontrolname="age"/></form></body></html>',
    'text/html'
  );
  return doc;
}

describe('DigitalQueueMonitor — Passive Queue Observation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in IDLE state', () => {
    const monitor = new DigitalQueueMonitor(makeBookingDoc());
    const status = monitor.getStatus();
    expect(status.state).toBe('IDLE');
    expect(status.isQueueActive).toBe(false);
  });

  it('detects QUEUE_DETECTED when DOM contains queue signals', () => {
    const queueDoc = makeQueueDoc();
    const monitor = new DigitalQueueMonitor(queueDoc);
    monitor.start();
    const status = monitor.getStatus();
    // After start, evaluate() is called; queue DOM should be detected
    expect(status.state).toBe('QUEUE_DETECTED');
    expect(status.isQueueActive).toBe(true);
    monitor.stop();
  });

  it('transitions to BOOKING_READY when queue signals disappear', () => {
    const queueDoc = makeQueueDoc();
    const monitor = new DigitalQueueMonitor(queueDoc);
    monitor.start();
    expect(monitor.getStatus().state).toBe('QUEUE_DETECTED');

    // Simulate queue clearing: remove queue element
    const queueEl = queueDoc.getElementById('waitingRoom');
    queueEl?.parentNode?.removeChild(queueEl);

    // Trigger re-evaluation via fake timer
    vi.advanceTimersByTime(3100);
    const status = monitor.getStatus();
    expect(status.state).toBe('BOOKING_READY');
    expect(status.isQueueActive).toBe(false);
    monitor.stop();
  });

  it('emits status to subscribers on state change', () => {
    const queueDoc = makeQueueDoc();
    const monitor = new DigitalQueueMonitor(queueDoc);
    const received: string[] = [];
    monitor.onStatusChange(status => received.push(status.state));
    monitor.start();
    // Subscriber should have received at least one status
    expect(received.length).toBeGreaterThan(0);
    monitor.stop();
  });

  it('stop() cleans up properly — no lingering observers', () => {
    const monitor = new DigitalQueueMonitor(makeQueueDoc());
    monitor.start();
    monitor.stop();
    const status = monitor.getStatus();
    expect(status.state).toBe('IDLE');
  });

  it('returns "No queue detected" message when in IDLE state', () => {
    const monitor = new DigitalQueueMonitor(makeBookingDoc());
    const status = monitor.getStatus();
    expect(status.message).toContain('No queue detected');
  });

  it('does NOT bypass queue — canFill is never set to true by queue monitor', () => {
    // The queue monitor ONLY observes and reports; it never triggers autofill
    const monitor = new DigitalQueueMonitor(makeQueueDoc());
    monitor.start();
    // Verify monitor only produces status reports, never a "fill" signal
    const status = monitor.getStatus();
    expect(status).not.toHaveProperty('canFill');
    expect(status).not.toHaveProperty('bypassQueue');
    monitor.stop();
  });
});
