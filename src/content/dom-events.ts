// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Angular-Aware DOM Event Dispatching
// Interacts with Angular Reactive Forms, Angular Material (mat-select, matInput),
// ControlValueAccessor, and custom government form controls
// ─────────────────────────────────────────────────

/**
 * Set a value on an input element using prototype descriptor to bypass framework overrides.
 */
export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

/**
 * Dispatch complete Angular-compatible event sequence on an input element.
 * Follows exact sequence required by Angular's DefaultValueAccessor & ControlValueAccessor:
 * focus -> focusin -> set value -> keydown -> beforeinput -> input -> keyup -> change -> blur -> focusout
 */
export function dispatchAngularCompatibleEvents(element: HTMLElement, value: string): void {
  // 1. Focus
  let focusinDispatched = false;
  const onFocusIn = () => { focusinDispatched = true; };
  element.addEventListener('focusin', onFocusIn, { once: true });
  try {
    element.focus();
  } catch {}
  element.removeEventListener('focusin', onFocusIn);
  if (!focusinDispatched) {
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true, cancelable: true, composed: true }));
  }

  // 2. Value assignment via prototype
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeValue(element, value);
  }

  // 3. Simulated typing & beforeinput
  const lastChar = value.slice(-1) || '0';
  element.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: lastChar,
  }));

  try {
    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: value,
    }));
  } catch {}

  // 4. Input event (Angular DefaultValueAccessor listens to this to update FormControl value)
  let inputDispatched = false;
  try {
    inputDispatched = element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: value,
    }));
  } catch {
    inputDispatched = false;
  }

  // Fallback standard input event ONLY if InputEvent was not dispatched
  if (!inputDispatched) {
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
  }

  // 5. Keyup
  element.dispatchEvent(new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: lastChar,
  }));

  // 6. Change event
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));

  // 7. Blur & focusout (Angular marks control as touched and re-evaluates validation on blur)
  let focusoutDispatched = false;
  const onFocusOut = () => { focusoutDispatched = true; };
  element.addEventListener('focusout', onFocusOut, { once: true });
  try {
    element.blur();
  } catch {}
  element.removeEventListener('focusout', onFocusOut);
  if (!focusoutDispatched) {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true, composed: true }));
  }
}

/** Backward-compatibility alias */
export const dispatchReactCompatibleEvents = (el: HTMLElement) => {
  const val = (el as HTMLInputElement).value || '';
  dispatchAngularCompatibleEvents(el, val);
};

/**
 * Set a select element's value and trigger proper events.
 * Supports native <select> elements, Angular Material (<mat-select>), and custom dropdowns.
 */
export async function triggerSelectChange(
  element: HTMLElement,
  value: string,
  doc?: Document,
): Promise<boolean> {
  const documentContext = doc || element.ownerDocument || document;

  // Case 1: Native <select> element
  let selectEl: HTMLSelectElement | null = null;
  if (element instanceof HTMLSelectElement) {
    selectEl = element;
  } else {
    selectEl = element.querySelector('select');
  }

  if (selectEl) {
    let optionIndex = -1;
    const target = value.toLowerCase().replace(/[\s_-]/g, '').trim();
    const isMale = target === 'male' || target === 'm';
    const isFemale = target === 'female' || target === 'f';

    // Exact or token match
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optVal = opt.value.toLowerCase().replace(/[\s_-]/g, '').trim();
      const optText = (opt.textContent ?? '').toLowerCase().replace(/[\s_-]/g, '').trim();

      if (isMale) {
        if (optVal.includes('female') || optText.includes('female')) continue;
        if (optVal === 'male' || optText === 'male' || optVal === 'm' || optText === 'm' || /\bmale\b/i.test(opt.textContent || '') || /\bmale\b/i.test(opt.value)) {
          optionIndex = i;
          break;
        }
      } else if (isFemale) {
        if (optVal === 'female' || optText === 'female' || optVal === 'f' || optText === 'f' || /\bfemale\b/i.test(opt.textContent || '') || /\bfemale\b/i.test(opt.value)) {
          optionIndex = i;
          break;
        }
      } else {
        if (optVal === target || optText === target) {
          optionIndex = i;
          break;
        }
      }
    }

    // Alias / substring match
    if (optionIndex === -1) {
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        const rawVal = opt.value.toLowerCase().trim();
        const rawText = (opt.textContent ?? '').toLowerCase().trim();

        if (!rawVal && !rawText) continue;
        if (rawText.includes('select') || rawText.includes('choose')) continue;

        if (isMale) {
          if (rawText.includes('female') || rawVal.includes('female')) continue;
          if (rawText === 'male' || rawVal === 'male' || rawVal === 'm' || /\bmale\b/i.test(rawText) || /\bmale\b/i.test(rawVal)) {
            optionIndex = i;
            break;
          }
          continue;
        }
        if (isFemale) {
          if (rawText === 'female' || rawVal === 'female' || rawVal === 'f' || /\bfemale\b/i.test(rawText) || /\bfemale\b/i.test(rawVal)) {
            optionIndex = i;
            break;
          }
          continue;
        }
        if (
          (target.includes('aadhaar') || target.includes('aadhar')) &&
          (rawText.includes('aadhaar') || rawText.includes('aadhar') || rawVal.includes('aadhaar') || rawVal.includes('aadhar'))
        ) {
          optionIndex = i;
          break;
        }

        if (rawVal.includes(target) || rawText.includes(target) || target.includes(rawText)) {
          optionIndex = i;
          break;
        }
      }
    }

    if (optionIndex !== -1) {
      for (let i = 0; i < selectEl.options.length; i++) {
        selectEl.options[i].selected = i === optionIndex;
      }

      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex')?.set;
      if (nativeSetter) {
        nativeSetter.call(selectEl, optionIndex);
      } else {
        selectEl.selectedIndex = optionIndex;
      }

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(selectEl, selectEl.options[optionIndex].value);
      } else {
        selectEl.value = selectEl.options[optionIndex].value;
      }

      selectEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
      selectEl.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true, composed: true }));
      return true;
    }
  }

  // Case 2: Custom dropdown component (Angular Material mat-select, PrimeNG, etc.)
  return await triggerCustomDropdownSelect(element, value, documentContext);
}

/**
 * Handle custom Angular dropdown inputs (<mat-select>, CDK overlay, custom combobox).
 * Correctly opens the panel, clicks <mat-option> to update FormControl, and validates state.
 */
async function triggerCustomDropdownSelect(
  element: HTMLElement,
  value: string,
  doc: Document,
): Promise<boolean> {
  const target = value.toLowerCase().replace(/[\s_-]/g, '').trim();
  const isMale = target === 'male' || target === 'm';
  const isFemale = target === 'female' || target === 'f';

  // Find the interactive trigger element
  const triggerEl = element.querySelector<HTMLElement>(
    '.mat-select-trigger, .mat-mdc-select-trigger, [role="combobox"], button'
  ) || element;

  // Step A: Focus & cleanly click the trigger once (DO NOT click parentElement as it toggles/closes)
  triggerEl.focus();
  triggerEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
  triggerEl.click();
  triggerEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));

  // Step B: Poll for overlay options to render in DOM (up to 300ms)
  let matchedOption: HTMLElement | null = null;
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 50));

    const searchRoots = [
      doc.querySelector('.cdk-overlay-container'),
      doc.querySelector('.mat-select-panel'),
      doc.querySelector('.mat-mdc-select-panel'),
      element.parentElement,
      doc.body,
    ];

    for (const root of searchRoots) {
      if (!root) continue;
      const options = Array.from(root.querySelectorAll<HTMLElement>(
        'mat-option, .mat-mdc-option, [role="option"], .p-dropdown-item, .dropdown-item, li'
      ));

      for (const opt of options) {
        const rawText = opt.textContent?.trim().toLowerCase() ?? '';
        const normText = rawText.replace(/[\s_-]/g, '');
        const rawVal = opt.getAttribute('value')?.toLowerCase().trim() ?? '';
        const reflectVal = opt.getAttribute('ng-reflect-value')?.toLowerCase().trim() ?? '';

        if (!normText && !rawVal && !reflectVal) continue;
        if (normText.includes('select') || normText.includes('choose')) continue;

        if (isMale) {
          if (normText.includes('female') || rawVal.includes('female') || reflectVal.includes('female')) {
            continue; // NEVER match female when target is male
          }
          if (
            normText === 'male' || rawVal === 'male' || reflectVal === 'male' ||
            normText === 'm' || rawVal === 'm' || reflectVal === 'm' ||
            /\bmale\b/i.test(rawText) || /\bmale\b/i.test(rawVal) || /\bmale\b/i.test(reflectVal)
          ) {
            matchedOption = opt;
            break;
          }
          continue; // Prevent fallthrough to includes(target)
        }

        if (isFemale) {
          if (
            normText === 'female' || rawVal === 'female' || reflectVal === 'female' ||
            normText === 'f' || rawVal === 'f' || reflectVal === 'f' ||
            /\bfemale\b/i.test(rawText) || /\bfemale\b/i.test(rawVal) || /\bfemale\b/i.test(reflectVal)
          ) {
            matchedOption = opt;
            break;
          }
          continue; // Prevent fallthrough
        }

        if (normText === target || rawVal === target || reflectVal === target) {
          matchedOption = opt;
          break;
        }

        if (
          (target.includes('aadhaar') || target.includes('aadhar')) &&
          (normText.includes('aadhaar') || normText.includes('aadhar') || rawVal.includes('aadhaar') || reflectVal.includes('aadhaar'))
        ) {
          matchedOption = opt;
          break;
        }

        if (normText.includes(target) || target.includes(normText)) {
          matchedOption = opt;
          break;
        }
      }
      if (matchedOption) break;
    }

    if (matchedOption) break;
  }

  // Step C: Dispatch complete user-interaction sequence on the target option
  if (matchedOption) {
    matchedOption.scrollIntoView?.({ block: 'nearest' });
    matchedOption.focus?.();
    matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    matchedOption.click();
    matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));

    // Allow Angular's _selectViaInteraction to propagate changes
    await new Promise(r => setTimeout(r, 60));

    // Also dispatch change / selectionChange on the component
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    element.dispatchEvent(new CustomEvent('selectionChange', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: { value },
    }));

    if (element instanceof HTMLInputElement) {
      dispatchAngularCompatibleEvents(element, matchedOption.textContent?.trim() || value);
    }
    return true;
  }

  // Fallback: If element is an input, set native value and dispatch events
  if (element instanceof HTMLInputElement) {
    let displayVal = value;
    if (target.includes('aadhaar') || target.includes('aadhar')) displayVal = 'Aadhaar Card';
    dispatchAngularCompatibleEvents(element, displayVal);
    return true;
  }

  return false;
}

/**
 * Set a radio button's checked state and notify Angular.
 */
export function triggerRadioChange(name: string, value: string, doc: Document): boolean {
  const radios = doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`);

  for (const radio of radios) {
    const radioVal = radio.value.toLowerCase().trim();
    const targetVal = value.toLowerCase().trim();

    if (radioVal === targetVal || radioVal.charAt(0) === targetVal.charAt(0)) {
      radio.checked = true;
      radio.focus();
      radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      radio.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      radio.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
      radio.blur();
      radio.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true, composed: true }));
      return true;
    }
  }

  return false;
}

/**
 * Set date input value and dispatch events.
 */
export function setDateValue(element: HTMLInputElement, isoDate: string): void {
  dispatchAngularCompatibleEvents(element, isoDate);
}
