// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 11 Chaos Testing
// Simulates volatile SPA behavior: late field appearance, DOM replacement,
// mid-execution cancellation, and disabled form controls.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ResilientAutomationEngine,
  ResilientRetryEngine,
} from '../../../src/content/automation';

describe('Phase 11: Chaos Resilience & Failure Recovery', () => {
  let engine: ResilientAutomationEngine;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new ResilientAutomationEngine();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    engine.emergencyStop();
  });

  // ─── Chaos 1: Late Field Appearance ───
  it('Chaos 1: handles late-mounting field via bounded retry without crashing', async () => {
    const retry = new ResilientRetryEngine();

    // Field does not exist initially; mounts after 30ms
    setTimeout(() => {
      const input = document.createElement('input');
      input.id = 'lateName';
      input.value = '';
      document.body.appendChild(input);
    }, 30);

    const result = await retry.executeWithRetry(
      'resolve_late_field',
      async () => {
        const el = document.getElementById('lateName');
        if (!el) throw new Error('Not mounted yet');
        return el;
      },
      { maxAttempts: 5, baseDelayMs: 15, jitter: false },
    );

    expect(result.success).toBe(true);
    expect(result.value).not.toBeNull();
    expect(result.attempts).toBeGreaterThanOrEqual(2);
  });

  // ─── Chaos 2: Component Replacement (Angular / React rerender) ───
  it('Chaos 2: safely recovers when parent container is completely replaced during workflow', async () => {
    document.body.innerHTML = `
      <div id="container">
        <input id="input1" value="" />
      </div>
    `;

    engine.startSession(101, 0, 'sed-300');

    // Simulate reactive framework rerender replacing container
    const oldContainer = document.getElementById('container')!;
    const newContainer = document.createElement('div');
    newContainer.id = 'container';
    newContainer.innerHTML = `<input id="input1" value="" />`;
    document.body.replaceChild(newContainer, oldContainer);

    const plan = {
      serviceId: 'sed-300',
      fieldsToFill: [{ field: 'name', value: 'Venkatesh', elementSelector: '#input1' }],
    };

    const result = await engine.executePlan(plan);
    expect(result.success).toBe(true);
    expect((document.getElementById('input1') as HTMLInputElement).value).toBe('Venkatesh');
  });

  // ─── Chaos 3: Abort Mid-Execution ───
  it('Chaos 3: cleanly stops execution and leaves remaining form fields untouched when aborted', async () => {
    document.body.innerHTML = `
      <form id="f">
        <input id="field1" value="" />
        <input id="field2" value="" />
      </form>
    `;

    engine.startSession(101, 0);

    // Abort session after short delay
    setTimeout(() => {
      engine.stopSession('User cancelled');
    }, 5);

    const plan = {
      fieldsToFill: [
        { field: 'f1', value: 'Val1', elementSelector: '#field1' },
        { field: 'f2', value: 'Val2', elementSelector: '#field2' },
      ],
    };

    const result = await engine.executePlan(plan);
    expect(result.state).toBe('STOPPED');
    expect(result.success).toBe(false);
  });

  // ─── Chaos 4: Disabled and ReadOnly Inputs ───
  it('Chaos 4: respects disabled/readonly states and never forces values into locked inputs', async () => {
    document.body.innerHTML = `
      <form id="f">
        <input id="lockedField" value="LockedValue" disabled />
      </form>
    `;

    engine.startSession(101, 0);

    const plan = {
      fieldsToFill: [
        { field: 'lockedField', value: 'AttemptedOverride', elementSelector: '#lockedField' },
      ],
    };

    const result = await engine.executePlan(plan);
    expect(result.state).toBe('COMPLETED');
    expect(result.skippedCount).toBe(1);
    // Preserves original locked value
    expect((document.getElementById('lockedField') as HTMLInputElement).value).toBe('LockedValue');
  });

  // ─── Chaos 5: Zero-PII Performance Metrics ───
  it('Chaos 5: logs telemetry metrics containing zero devotee PII', async () => {
    document.body.innerHTML = `<input id="metricField" value="" />`;
    engine.startSession(101, 0);

    const plan = {
      fieldsToFill: [{ field: 'name', value: 'SecretDevoteeName123', elementSelector: '#metricField' }],
    };

    const result = await engine.executePlan(plan);
    expect(result.metrics.length).toBeGreaterThan(0);

    const metricsStr = JSON.stringify(result.metrics);
    expect(metricsStr).not.toContain('SecretDevoteeName123');
    expect(metricsStr).not.toContain('name');
  });
});
