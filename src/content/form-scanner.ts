// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Form Scanner
// Scans the DOM for form fields with multi-signal extraction
// ─────────────────────────────────────────────────

import type { ScannedField } from '@shared/types';
import { normalizeText } from '@shared/utils';
import logger from '@shared/logger';

/** Selectors to find form fields */
const FIELD_SELECTORS = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
  'textarea',
  'select',
  'mat-select',
  '[role="combobox"]',
  '[role="listbox"]',
  'p-dropdown',
  'ng-select',
].join(', ');

/**
 * Check if a field represents a pilgrim's name (which indicates the start of a pilgrim row).
 */
function isPilgrimNameField(el: Element, label?: string): boolean {
  const normLabel = label ? normalizeText(label) : '';
  const normName = el.getAttribute('name') ? normalizeText(el.getAttribute('name')!) : '';
  const normId = el.id ? normalizeText(el.id) : '';
  const normPlaceholder = (el as HTMLInputElement).placeholder ? normalizeText((el as HTMLInputElement).placeholder) : '';

  // Exclude ID card name / photo ID
  if (normLabel.includes('id') || normName.includes('id') || normLabel.includes('photo') || normName.includes('photo')) {
    return false;
  }

  const nameMatches = ['name', 'full name', 'pilgrim name', 'devotee name', 'passenger name'];
  return (
    nameMatches.includes(normLabel) ||
    nameMatches.includes(normName) ||
    nameMatches.includes(normId) ||
    nameMatches.includes(normPlaceholder) ||
    normName.endsWith('.name') ||
    normName.endsWith('[name]')
  );
}

let scanSessionId = 0;

/** Live element registry allowing direct node reference without selector round-tripping */
export const elementRegistry = new Map<string, HTMLElement>();

/**
 * Resolve an element by selector or registry cache, validating DOM containment.
 */
export function resolveElement(selectorOrId: string, doc: Document = document): HTMLElement | null {
  if (!selectorOrId) return null;
  const cached = elementRegistry.get(selectorOrId);
  if (cached && doc.contains(cached)) {
    return cached;
  }
  try {
    const fresh = doc.querySelector<HTMLElement>(selectorOrId);
    if (fresh) {
      elementRegistry.set(selectorOrId, fresh);
    }
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Scan the document for all form fields.
 * Extracts multi-signal field information for mapping.
 */
export function scanForm(doc: Document): ScannedField[] {
  scanSessionId++;
  // Strip obsolete data-sp-field attributes to prevent stale selector collisions across dynamic re-renders
  try {
    doc.querySelectorAll('[data-sp-field]').forEach(el => el.removeAttribute('data-sp-field'));
  } catch {}
  elementRegistry.clear();

  const elements = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(FIELD_SELECTORS);
  const fields: ScannedField[] = [];
  let groupIndex = 0;
  let lastGroupParent: Element | null = null;
  let currentGroupHasName = false;

  elements.forEach((el) => {
    // Skip invisible elements
    if (!isVisible(el)) return;

    const label = findLabelText(el, doc);
    const isName = isPilgrimNameField(el, label);

    // Detect group (pilgrim card or table row) boundaries
    const cardParent = findPilgrimCard(el);
    if (cardParent && cardParent !== lastGroupParent) {
      if (lastGroupParent) {
        groupIndex++;
        currentGroupHasName = false;
      }
      lastGroupParent = cardParent;
    } else if (isName && currentGroupHasName) {
      // If we encounter another "Name" field within the same parent card/table,
      // it denotes the start of the next pilgrim row!
      groupIndex++;
      currentGroupHasName = false;
    }

    if (isName) {
      currentGroupHasName = true;
    }

    const field: ScannedField = {
      element: buildSelector(el, fields.length, doc),
      type: getFieldType(el, label),
      name: el.name || undefined,
      id: el.id || undefined,
      label,
      placeholder: (el as HTMLInputElement).placeholder || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      autocomplete: el.getAttribute('autocomplete') || undefined,
      required: el.required || el.getAttribute('aria-required') === 'true',
      options: getOptions(el),
      currentValue: getCurrentValue(el),
      groupIndex,
    };

    fields.push(field);
  });

  logger.debug(`Form scan: ${fields.length} fields found, ${groupIndex + 1} groups`);
  return fields;
}

function isVisible(el: Element): boolean {
  const win = el.ownerDocument?.defaultView || window;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // In jsdom test environment, offsetParent is always null because jsdom does not calculate layout
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom')) {
    return true;
  }

  return (el as HTMLElement).offsetParent !== null;
}

/** Build a guaranteed unique CSS selector for an element */
function buildSelector(el: Element, index: number, doc: Document): string {
  // Always attach a guaranteed unique SevaPilot tracking attribute to prevent ID collisions
  // (e.g. when pages assign duplicate id="0" to all fields in row 0)
  const spFieldId = `sp-fld-${scanSessionId}-${index}`;
  try {
    el.setAttribute('data-sp-field', spFieldId);
    const selector = `[data-sp-field="${spFieldId}"]`;
    if (el instanceof HTMLElement) {
      elementRegistry.set(selector, el);
    }
    return selector;
  } catch {
    // If setAttribute fails, fallback to unique path
  }

  if (el.id && doc.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    const sel = `#${CSS.escape(el.id)}`;
    if (el instanceof HTMLElement) elementRegistry.set(sel, el);
    return sel;
  }
  if (el.getAttribute('name') && doc.querySelectorAll(`[name="${CSS.escape(el.getAttribute('name')!)}"]`).length === 1) {
    const sel = `[name="${CSS.escape(el.getAttribute('name')!)}"]`;
    if (el instanceof HTMLElement) elementRegistry.set(sel, el);
    return sel;
  }

  // Fallback: tag + nth-child
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const pos = siblings.indexOf(el);
    const sel = `${buildSelector(parent, index, doc)} > ${el.tagName.toLowerCase()}:nth-child(${pos + 1})`;
    if (el instanceof HTMLElement) elementRegistry.set(sel, el);
    return sel;
  }
  return el.tagName.toLowerCase();
}

/** Determine the field type */
function getFieldType(el: HTMLElement, label?: string): ScannedField['type'] {
  if (
    el.tagName === 'SELECT' ||
    el.tagName === 'MAT-SELECT' ||
    el.tagName === 'P-DROPDOWN' ||
    el.tagName === 'NG-SELECT' ||
    el.getAttribute('role') === 'combobox' ||
    el.getAttribute('role') === 'listbox'
  ) {
    return 'select';
  }
  if (el.tagName === 'TEXTAREA') return 'textarea';

  // Check if it's a custom dropdown input (e.g. Gender, Photo ID Proof)
  const normLabel = label ? normalizeText(label) : '';
  if (
    normLabel.includes('gender') ||
    normLabel.includes('photo id proof') ||
    normLabel.includes('id proof') ||
    normLabel.includes('id type')
  ) {
    if (!normLabel.includes('number') && !normLabel.includes('no')) {
      return 'select';
    }
  }

  const inputType = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
  switch (inputType) {
    case 'text': return 'text';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'email': return 'email';
    case 'tel': return 'tel';
    case 'radio': return 'radio';
    case 'checkbox': return 'checkbox';
    case 'file': return 'file';
    default: return 'text';
  }
}

/**
 * Find label text for a field using multiple strategies:
 * 1. <label for="id">
 * 2. Wrapping <label>
 * 3. aria-labelledby
 * 4. Closest ancestor with text
 * 5. Previous sibling text
 */
function findLabelText(el: Element, doc: Document): string | undefined {
  // Strategy 1: <label for="id">
  if (el.id) {
    const label = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // Strategy 2: aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // Strategy 3: aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = doc.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim();
  }

  // Strategy 4: Wrapping <label>
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const text = parentLabel.textContent?.replace(
      (el as HTMLInputElement).value || '', '',
    ).trim();
    if (text) return text;
  }

  // Strategy 5: Previous sibling or parent with relevant text
  let prev = el.previousElementSibling;
  while (prev) {
    const text = prev.textContent?.trim();
    if (text && text.length > 0 && text.length < 80) {
      return text;
    }
    prev = prev.previousElementSibling;
  }

  // Strategy 6: Closest field wrapper container with label or mat-label
  const formFieldContainer = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .p-field, .field-wrapper, .form-field');
  if (formFieldContainer) {
    const labelChild = formFieldContainer.querySelector('label, mat-label, .mat-mdc-floating-label, .mat-form-field-label, .p-float-label, [class*="label"], [class*="title"]');
    if (labelChild && labelChild !== el && !labelChild.contains(el) && labelChild.textContent) {
      const text = labelChild.textContent.trim();
      if (text.length > 0 && text.length < 80) return text;
    }
  } else {
    let currentParent = el.parentElement;
    let depth = 0;
    while (currentParent && depth < 2) {
      if (currentParent.classList.contains('row') || currentParent.classList.contains('card') || currentParent.tagName === 'FORM') {
        break;
      }
      const labelChild = currentParent.querySelector('label, mat-label, .label, .form-label, .field-label');
      if (labelChild && labelChild !== el && !labelChild.contains(el) && labelChild.textContent) {
        const text = labelChild.textContent.trim();
        if (text.length > 0 && text.length < 80) return text;
      }
      currentParent = currentParent.parentElement;
      depth++;
    }
  }

  // Strategy 7: Placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder && placeholder.trim()) {
    return placeholder.trim();
  }

  return undefined;
}

/** Get options for select/radio elements */
function getOptions(el: Element): string[] | undefined {
  if (el.tagName === 'SELECT') {
    return Array.from((el as HTMLSelectElement).options)
      .filter(opt => opt.value && opt.value !== '')
      .map(opt => opt.textContent?.trim() ?? opt.value);
  }

  if ((el as HTMLInputElement).type === 'radio') {
    const name = (el as HTMLInputElement).name;
    if (name) {
      const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(name)}"]`);
      return Array.from(radios).map(r => {
        const label = findLabelText(r, document);
        return label ?? r.value;
      });
    }
  }

  return undefined;
}

/** Get current value of a field */
function getCurrentValue(el: Element): string | undefined {
  if (el.tagName === 'SELECT') {
    const select = el as HTMLSelectElement;
    return select.options[select.selectedIndex]?.textContent?.trim();
  }
  if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') {
    return (el as HTMLInputElement).checked ? 'checked' : undefined;
  }
  return (el as HTMLInputElement).value || undefined;
}

/**
 * Find the "pilgrim card" parent container.
 * Looks for repeated form patterns (cards/sections containing multiple fields).
 */
function findPilgrimCard(el: Element): Element | null {
  let current = el.parentElement;
  let depth = 0;
  const maxDepth = 8;

  while (current && depth < maxDepth) {
    const className = current.className?.toLowerCase() ?? '';
    const role = current.getAttribute('role');

    // Row-level containers (tables, CSS grids, mat-row)
    if (
      current.tagName === 'TR' ||
      role === 'row' ||
      className.includes('table-row') ||
      className.includes('mat-row') ||
      className.includes('cdk-row')
    ) {
      return current;
    }

    // Common patterns for pilgrim/passenger cards
    if (
      className.includes('card') ||
      className.includes('pilgrim') ||
      className.includes('passenger') ||
      className.includes('devotee') ||
      className.includes('person') ||
      className.includes('member') ||
      className.includes('traveler') ||
      className.includes('traveller') ||
      role === 'group' ||
      (current.tagName === 'FIELDSET')
    ) {
      // Check if this container has multiple form fields
      const fieldCount = current.querySelectorAll(FIELD_SELECTORS).length;
      if (fieldCount >= 3) return current;
    }

    current = current.parentElement;
    depth++;
  }

  return null;
}
