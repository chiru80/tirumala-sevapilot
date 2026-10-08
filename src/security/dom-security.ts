// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — DOM Security & Hostile Input Guard (Phase 9)
// Defends against deceptive, sensitive, or disabled DOM elements.
// Prevents autofill tampering with password, payment, OTP, or CAPTCHA.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

/**
 * Regex patterns identifying forbidden sensitive targets (passwords, payments, OTPs, CAPTCHAs).
 */
const FORBIDDEN_NAME_PATTERNS = /\b(password|passwd|pwd|cvv|cvc|cardnumber|card_number|card-number|cardno|card_no|card.?exp|creditcard|debitcard|payment|upi|upipin|netbanking|otp|one.?time.?password|passcode|secretcode|securitycode|captcha|recaptcha|hcaptcha)\b/i;

const FORBIDDEN_AUTOCOMPLETE_PATTERNS = /(current-password|new-password|cc-|credit-card|card-number|cvv|cvc|exp-|one-time-code)/i;

export interface TargetSecurityOptions {
  allowComboboxReadOnly?: boolean;
  allowDynamicDisabled?: boolean;
}

/**
 * Validates whether a DOM element is strictly FORBIDDEN from receiving any autofill values.
 * Returns true if the element is password, payment, OTP, CAPTCHA, hidden, disabled, or readOnly.
 */
export function isForbiddenAutofillTarget(
  el: HTMLElement | null | undefined,
  options: TargetSecurityOptions = {},
): boolean {
  if (!el || typeof el !== 'object') return true;

  // 1. Password and hidden check
  const inputEl = el as HTMLInputElement;
  const type = (inputEl.type || el.getAttribute('type') || '').toLowerCase().trim();
  if (type === 'password' || type === 'hidden') {
    return true;
  }

  // 2. Disabled controls (Site control preservation)
  if (!options.allowDynamicDisabled) {
    if (inputEl.disabled || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      return true;
    }
  }

  // 3. Readonly controls (allow custom combobox dropdowns which are legitimately readonly text inputs)
  const isCombobox =
    inputEl.getAttribute('role') === 'combobox' ||
    inputEl.getAttribute('role') === 'listbox' ||
    inputEl.tagName?.toLowerCase() === 'mat-select' ||
    inputEl.classList?.contains('mat-select') ||
    inputEl.classList?.contains('p-dropdown');

  if (inputEl.readOnly || el.hasAttribute('readonly')) {
    if (!(options.allowComboboxReadOnly && isCombobox)) {
      return true;
    }
  }

  if (!options.allowDynamicDisabled && el.getAttribute('aria-disabled') === 'true') {
    return true;
  }

  // 3. Autocomplete check
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase().trim();
  if (autocomplete && FORBIDDEN_AUTOCOMPLETE_PATTERNS.test(autocomplete)) {
    logger.warn('[DomSecurity] Rejected target with forbidden autocomplete:', autocomplete);
    return true;
  }

  // 4. Name / ID / Attribute pattern check
  const rawName = (el.getAttribute('name') || '').trim();
  const rawId = (el.id || '').trim();
  const rawFormControlName = (el.getAttribute('formcontrolname') || '').trim();
  const rawAriaLabel = (el.getAttribute('aria-label') || '').trim();
  const rawPlaceholder = ((el as HTMLInputElement).placeholder || '').trim();

  // Split camelCase words (e.g. mobileOtp -> mobile otp) and normalize
  const combinedAttributes = `${rawName} ${rawId} ${rawFormControlName} ${rawAriaLabel} ${rawPlaceholder}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  if (FORBIDDEN_NAME_PATTERNS.test(combinedAttributes)) {
    logger.warn('[DomSecurity] Rejected forbidden element target:', { name: rawName, id: rawId, formControlName: rawFormControlName, type });
    return true;
  }

  return false;
}

/**
 * Validates whether an element is visible and interactive in the document.
 */
export function isElementStrictlyInteractive(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  if (isForbiddenAutofillTarget(el)) return false;

  const win = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
  if (win?.getComputedStyle) {
    const style = win.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }

  // jsdom skip offset check
  if (typeof navigator !== 'undefined' && navigator?.userAgent?.includes('jsdom')) {
    return true;
  }

  return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
}
