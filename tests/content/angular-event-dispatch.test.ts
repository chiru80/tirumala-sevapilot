// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { dispatchAngularCompatibleEvents } from '../../src/content/dom-events';
import { performTextTransaction } from '../../src/content/autofill/field-transaction';
import { verifyField } from '../../src/content/autofill/verification';

describe('Angular Event Dispatch Audit (P2)', () => {
  it('dispatches clean event sequence without duplicate input events', () => {
    document.body.innerHTML = '<input id="nameInput" type="text" />';
    const input = document.getElementById('nameInput') as HTMLInputElement;

    const eventCounts: Record<string, number> = {
      focus: 0,
      focusin: 0,
      keydown: 0,
      beforeinput: 0,
      input: 0,
      keyup: 0,
      change: 0,
      blur: 0,
      focusout: 0,
    };

    Object.keys(eventCounts).forEach(evt => {
      input.addEventListener(evt, () => {
        eventCounts[evt]++;
      });
    });

    dispatchAngularCompatibleEvents(input, 'Chiranjeevi');

    expect(input.value).toBe('Chiranjeevi');
    expect(eventCounts.input).toBe(1); // EXACTLY 1 input event, no duplicates!
    expect(eventCounts.change).toBe(1);
    expect(eventCounts.focusin).toBe(1);
    expect(eventCounts.focusout).toBe(1);
  });

  it('updates simulated Angular FormControl and triggers change detection', async () => {
    document.body.innerHTML = '<input id="devoteeAge" type="text" />';
    const input = document.getElementById('devoteeAge') as HTMLInputElement;

    // Simulate Angular ControlValueAccessor
    const angularFormControl = {
      value: '',
      touched: false,
      dirty: false,
      setValue(val: string) {
        this.value = val;
        this.dirty = true;
      },
      markAsTouched() {
        this.touched = true;
      },
    };

    input.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      angularFormControl.setValue(target.value);
    });

    input.addEventListener('blur', () => {
      angularFormControl.markAsTouched();
    });

    await performTextTransaction(input, '42');

    expect(input.value).toBe('42');
    expect(angularFormControl.value).toBe('42');
    expect(angularFormControl.dirty).toBe(true);
    expect(angularFormControl.touched).toBe(true);

    // Verify verification succeeds
    const verification = verifyField(input, '42', 'age');
    expect(verification.status).toBe('verified');
  });
});
