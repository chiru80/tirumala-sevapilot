// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { waitForElement, waitForField, waitForForm, waitForService } from '../../src/content/smart-wait';
import { ServiceType } from '../../src/shared/types';

describe('Smart Wait System', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('waitForElement immediately resolves if element already exists', async () => {
    const div = document.createElement('div');
    div.id = 'target-element';
    div.textContent = 'Ready';
    document.body.appendChild(div);

    const result = await waitForElement('#target-element', { timeoutMs: 500, doc: document });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('target-element');
  });

  it('waitForElement resolves when element is added dynamically', async () => {
    setTimeout(() => {
      const input = document.createElement('input');
      input.className = 'dynamic-ttd-input';
      document.body.appendChild(input);
    }, 50);

    const result = await waitForElement('.dynamic-ttd-input', { timeoutMs: 1000, doc: document });
    expect(result).not.toBeNull();
    expect(result?.className).toBe('dynamic-ttd-input');
  });

  it('waitForField locates field by label asynchronously', async () => {
    setTimeout(() => {
      const formGroup = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = 'Full Name *';
      const input = document.createElement('input');
      input.name = 'pilgrimName';
      formGroup.appendChild(label);
      formGroup.appendChild(input);
      document.body.appendChild(formGroup);
    }, 50);

    const result = await waitForField(['full name', 'name'], { timeoutMs: 1000, doc: document });
    expect(result).not.toBeNull();
  });

  it('waitForForm detects TTD booking form when name and age appear', async () => {
    setTimeout(() => {
      const form = document.createElement('form');
      form.id = 'ttd-booking-form';

      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Devotee Name';
      const nameInput = document.createElement('input');
      nameInput.name = 'devoteeName';

      const ageLabel = document.createElement('label');
      ageLabel.textContent = 'Age';
      const ageInput = document.createElement('input');
      ageInput.name = 'devoteeAge';
      ageInput.type = 'number';

      form.appendChild(nameLabel);
      form.appendChild(nameInput);
      form.appendChild(ageLabel);
      form.appendChild(ageInput);
      document.body.appendChild(form);
    }, 50);

    const result = await waitForForm({ timeoutMs: 1000, doc: document });
    expect(result).not.toBeNull();
  });

  it('waitForService detects service text in body', async () => {
    document.body.innerHTML = '<h1>Special Entry Darshan (₹300) Booking</h1>';
    const detected = await waitForService(ServiceType.DARSHAN, { timeoutMs: 500, doc: document });
    expect(detected).toBe(true);
  });
});
