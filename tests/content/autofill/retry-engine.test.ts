// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { retryWithVerification } from '../../../src/content/autofill/retry-engine';

describe('Retry Engine (Bounded Retries & Self-Healing)', () => {
  let doc: Document;
  let container: HTMLElement;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('TTD Booking');
    container = doc.createElement('div');
    container.id = 'test-container';
    doc.body.appendChild(container);
  });

  it('succeeds on first attempt when fill action succeeds immediately', async () => {
    const input = doc.createElement('input');
    input.setAttribute('formcontrolname', 'name');
    container.appendChild(input);

    const result = await retryWithVerification({
      fieldType: 'name',
      element: input,
      expectedValue: 'Ravi Kumar',
      container,
      excludeElements: new Set(),
      doc,
      fillAction: async (el) => {
        (el as HTMLInputElement).value = 'Ravi Kumar';
      },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.verification?.status).toBe('verified');
  });

  it('caps retries at maximum 3 attempts and never infinite-loops', async () => {
    const input = doc.createElement('input');
    input.setAttribute('formcontrolname', 'name');
    container.appendChild(input);

    let attemptsCount = 0;
    const result = await retryWithVerification({
      fieldType: 'name',
      element: input,
      expectedValue: 'Ravi Kumar',
      container,
      excludeElements: new Set(),
      doc,
      fillAction: async (el) => {
        attemptsCount++;
        // Intentionally fill wrong value to trigger retry
        (el as HTMLInputElement).value = 'Wrong Name';
      },
      config: { maxAttempts: 3, delays: [1, 1, 1] },
    });

    expect(result.success).toBe(false);
    expect(attemptsCount).toBe(3);
    expect(result.attempts).toBe(3);
    expect(result.verification?.status).toBe('failed');
  });

  it('heals when element was detached and re-resolves the fresh element', async () => {
    const oldInput = doc.createElement('input');
    oldInput.id = 'old-input';
    oldInput.setAttribute('formcontrolname', 'name');
    container.appendChild(oldInput);

    let callCount = 0;
    const result = await retryWithVerification({
      fieldType: 'name',
      element: oldInput,
      expectedValue: 'Ravi Kumar',
      container,
      excludeElements: new Set(),
      doc,
      fillAction: async (el) => {
        callCount++;
        if (callCount === 1) {
          // Simulate DOM re-render by removing oldInput and creating fresh input
          oldInput.remove();
          const freshInput = doc.createElement('input');
          freshInput.id = 'fresh-input';
          freshInput.setAttribute('formcontrolname', 'name');
          container.appendChild(freshInput);
          // Old element fails verification
          (el as HTMLInputElement).value = 'Old';
        } else {
          // Fresh element gets proper value
          (el as HTMLInputElement).value = 'Ravi Kumar';
        }
      },
      config: { maxAttempts: 3, delays: [5, 5, 5] },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.retriedElement?.id).toBe('fresh-input');
  });

  it('does NOT force-enable a disabled element and reports clean failure', async () => {
    const disabledInput = doc.createElement('input');
    disabledInput.setAttribute('formcontrolname', 'idNumber');
    disabledInput.disabled = true;
    container.appendChild(disabledInput);

    const result = await retryWithVerification({
      fieldType: 'photoIdNumber',
      element: disabledInput,
      expectedValue: '123456789012',
      container,
      excludeElements: new Set(),
      doc,
      fillAction: async () => {},
      config: { maxAttempts: 1, delays: [1] },
    });

    expect(result.success).toBe(false);
    expect(disabledInput.disabled).toBe(true); // NEVER force disabled = false
    expect(result.error).toContain('disabled');
  });
});
