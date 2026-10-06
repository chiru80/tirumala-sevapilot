// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Pilgrim Row Detector & Context Locker
// Semantic ancestor scoring, row isolation, and stable DOM references
// ─────────────────────────────────────────────────

import logger from '@shared/logger';
import { resolvePilgrimFields, isElementVisible, type PilgrimFieldType } from './field-resolver';
import type { FieldResolution } from './field-resolver';

export type { PilgrimFieldType };

export interface PilgrimRowContext {
  index: number;
  element: HTMLElement;
  fingerprint: string;
  confidence: number;
  fields: Map<PilgrimFieldType, HTMLElement>;
  fieldResolutions: Map<PilgrimFieldType, FieldResolution>;
  isLocked: boolean;
}

// ─── Row Detection ───

/**
 * Detect all pilgrim row containers on the TTD page and lock their element references.
 *
 * Algorithm:
 * 1. Find visible Name field candidates
 * 2. For each Name, find ancestor containers
 * 3. Score ancestors by field completeness
 * 4. Prefer smallest ancestor with complete pilgrim field set
 * 5. Reject ancestors containing multiple Name fields
 * 6. Ensure no overlapping rows
 * 7. Sort by DOM order
 * 8. Return one stable row per pilgrim
 */
export function detectAndLockPilgrimRows(
  doc: Document = document,
  expectedCount: number = 1,
): PilgrimRowContext[] {
  const rowElements = findRowContainers(doc, expectedCount);
  logger.debug(`Found ${rowElements.length} row containers (expected: ${expectedCount})`);

  const lockedRows: PilgrimRowContext[] = [];

  for (let i = 0; i < rowElements.length; i++) {
    const rowEl = rowElements[i];
    const resolved = resolvePilgrimFields(rowEl, doc);
    const fields = new Map<PilgrimFieldType, HTMLElement>();
    let totalConfidence = 0;
    let fieldCount = 0;

    for (const [fieldType, resolution] of resolved) {
      fields.set(fieldType, resolution.element);
      totalConfidence += resolution.confidence;
      fieldCount++;
    }

    const avgConfidence = fieldCount > 0 ? Math.round(totalConfidence / fieldCount) : 0;
    const fingerprint = computeRowFingerprint(rowEl, i);

    lockedRows.push({
      index: i,
      element: rowEl,
      fingerprint,
      confidence: avgConfidence,
      fields,
      fieldResolutions: resolved,
      isLocked: true,
    });
  }

  return lockedRows;
}

/**
 * Find container elements representing each devotee entry.
 *
 * Uses a scored ancestor-climbing approach:
 * 1. Find all visible Name inputs
 * 2. For each Name, climb ancestors and score
 * 3. Pick the smallest ancestor containing the complete field set
 */
/**
 * Find container elements representing each devotee entry.
 *
 * Uses a scored ancestor-climbing approach:
 * 1. Find all visible Name inputs
 * 2. For each Name, climb ancestors and score for semantic pilgrim-field completeness
 * 3. Penalize multiple Name fields (-40) and overly large containers (-20)
 * 4. Prefer the smallest candidate containing the complete field set
 * 5. Eliminate overlapping containers (keep the more specific row, discard larger ancestor)
 * 6. Sort by DOM order
 * 7. Support 1-6 TTD pilgrims
 */
function findRowContainers(doc: Document, expectedCount: number): HTMLElement[] {
  // Step 1: Find all visible Name field candidates
  const allInputs = Array.from(doc.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
  ));

  const nameInputs = allInputs.filter(el => {
    if (!isElementVisible(el)) return false;

    const attrString = [
      el.id, el.getAttribute('name'), el.getAttribute('placeholder'),
      el.getAttribute('formcontrolname'), el.getAttribute('aria-label'),
    ].filter(Boolean).join(' ').toLowerCase();

    // Exclude non-pilgrim-name fields
    const excludePatterns = ['login', 'user', 'email', 'otp', 'search', 'captcha', 'password',
      'photo', 'mobile', 'phone', 'city', 'state', 'country', 'pin', 'address'];
    for (const ex of excludePatterns) {
      if (attrString.includes(ex)) return false;
    }

    // Check associated label too
    if (el.id) {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl?.textContent) {
        const lblText = labelEl.textContent.toLowerCase();
        for (const ex of ['id', 'photo', 'email', 'login', 'mobile', 'phone']) {
          if (lblText.includes(ex)) return false;
        }
      }
    }

    // Positive check: must contain 'name' in some attribute
    if (attrString.includes('name')) return true;

    // Check label
    if (el.id) {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl?.textContent?.toLowerCase().includes('name')) return true;
    }

    // Check parent mat-form-field label
    const matField = el.closest('mat-form-field, .mat-form-field, .mat-mdc-form-field');
    if (matField) {
      const matLabel = matField.querySelector('mat-label, label');
      if (matLabel?.textContent?.toLowerCase().includes('name')) return true;
    }

    return false;
  });

  if (nameInputs.length > 0) {
    const rows = isolateRowContainers(nameInputs, doc, expectedCount);
    // Support exactly 1–6 TTD pilgrims for this workflow
    return rows.slice(0, 6);
  }

  // Fallback strategies
  const fallbackRows = fallbackRowDetection(doc, expectedCount);
  return fallbackRows.slice(0, 6);
}

/**
 * For each name input, climb the DOM tree to find candidate ancestors,
 * score each candidate for semantic pilgrim-field completeness, and select
 * the smallest candidate that contains the complete field set.
 */
function isolateRowContainers(
  nameInputs: HTMLInputElement[],
  doc: Document,
  expectedCount: number,
): HTMLElement[] {
  const chosenContainers: HTMLElement[] = [];

  for (const nameEl of nameInputs) {
    // Generate candidate ancestors up the hierarchy
    const candidates: Array<{ container: HTMLElement; score: number; depth: number }> = [];
    let current: HTMLElement | null = nameEl.parentElement;
    let depth = 0;

    while (current && current !== doc.body && current !== doc.documentElement) {
      depth++;
      const score = scoreContainerForPilgrimFields(current, nameInputs, nameEl);
      candidates.push({ container: current, score, depth });
      current = current.parentElement;
    }

    const validCandidates = candidates.filter(c => c.score > 0);
    if (validCandidates.length === 0) {
      // Fail closed: do NOT fallback to parentElement or document.body
      continue;
    }

    // Sort candidates:
    // 1. Highest score first
    // 2. Smallest depth first (prefer smaller, closer container when score is tied)
    validCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.depth - b.depth;
    });

    const best = validCandidates[0].container;
    if (!chosenContainers.includes(best)) {
      chosenContainers.push(best);
    }
  }

  // Ensure no overlapping containers (keep more specific row, discard larger ancestor)
  const deduped = removeOverlappingContainers(chosenContainers);

  // Sort by DOM order
  deduped.sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return deduped;
}

/**
 * Score a candidate container for semantic pilgrim-field completeness.
 *
 * Scoring concept:
 * - Name present: +30
 * - Age present: +20
 * - Gender present: +20
 * - ID Type present: +20
 * - ID Number present: +20
 * - Multiple Name fields: -40
 * - Very large container (>12 controls): -20
 * - Hidden/unusable: -100
 */
function scoreContainerForPilgrimFields(
  container: HTMLElement,
  allNameInputs: HTMLInputElement[],
  primaryNameInput?: HTMLInputElement,
): number {
  if (!isElementVisible(container)) {
    return -100;
  }

  let score = 0;

  // Name check: +30
  const namesInContainer = allNameInputs.filter(ni => container.contains(ni));
  if (namesInContainer.length === 1) {
    score += 30;
  } else if (namesInContainer.length > 1) {
    score += 30;
    // Penalize candidates containing multiple Name fields: -40
    score -= 40;
  }

  // Check controls inside container
  const allInputs = Array.from(container.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])'
  ));
  const selects = Array.from(container.querySelectorAll<HTMLElement>(
    'select, mat-select, [role="combobox"], [role="listbox"], p-dropdown, ng-select'
  ));

  // Age check: +20
  const hasAge = allInputs.some(input => {
    const str = `${input.name} ${input.id} ${input.getAttribute('formcontrolname')} ${input.placeholder}`.toLowerCase();
    return input.type === 'number' || str.includes('age');
  });
  if (hasAge) score += 20;

  // Gender check: +20 (select or radio)
  const hasGenderSelect = selects.some(sel => {
    const str = `${sel.getAttribute('name')} ${sel.id} ${sel.getAttribute('formcontrolname')} ${sel.getAttribute('aria-label')}`.toLowerCase();
    return str.includes('gender') || str.includes('sex');
  });
  const hasGenderRadio = container.querySelectorAll('input[type="radio"]').length > 0;
  if (hasGenderSelect || hasGenderRadio) score += 20;

  // ID Type check: +20
  const hasIdType = selects.some(sel => {
    const str = `${sel.getAttribute('name')} ${sel.id} ${sel.getAttribute('formcontrolname')} ${sel.getAttribute('aria-label')}`.toLowerCase();
    return str.includes('proof') || str.includes('idtype') || str.includes('prooftype') || str.includes('photoid');
  });
  if (hasIdType) score += 20;

  // ID Number check: +20
  const hasIdNumber = allInputs.some(input => {
    const str = `${input.name} ${input.id} ${input.getAttribute('formcontrolname')} ${input.placeholder}`.toLowerCase();
    return (str.includes('idnumber') || str.includes('aadhaar') || str.includes('cardnumber') || str.includes('proofnumber')) &&
      !str.includes('otp') && !str.includes('mobile') && !str.includes('phone');
  });
  if (hasIdNumber) score += 20;

  // Scope check: penalty for very large containers
  const totalControls = allInputs.length + selects.length;
  if (totalControls > 12) {
    score -= 20;
  }

  // Fail-closed requirement: a valid pilgrim container must have semantic completeness
  // (e.g. Name + at least one of Age, Gender, ID Type, or ID Number -> score >= 50)
  if (score < 50) {
    return 0;
  }

  return score;
}

/**
 * Remove containers that overlap.
 * If container A contains container B (A is an ancestor of B),
 * keep the more specific child container B, and discard the larger ancestor A.
 */
function removeOverlappingContainers(containers: HTMLElement[]): HTMLElement[] {
  // Filter out any container that contains another candidate container in the list
  return containers.filter(candidate => {
    const containsSmallerCandidate = containers.some(other =>
      other !== candidate && candidate.contains(other)
    );
    // If candidate contains another candidate, candidate is the larger ancestor — discard it
    return !containsSmallerCandidate;
  });
}

/**
 * Fallback row detection strategies when name-based climbing fails.
 */
function fallbackRowDetection(doc: Document, expectedCount: number): HTMLElement[] {
  // Strategy 1: Table rows
  const tableRows = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'tbody tr, table.pilgrim-table tr, mat-table mat-row, .mat-mdc-table .mat-mdc-row, [role="row"]'
    )
  ).filter(tr => {
    if (tr.querySelector('th')) return false;
    return tr.querySelectorAll('input:not([type="hidden"]), select, mat-select, [role="combobox"]').length >= 2;
  });

  if (tableRows.length >= expectedCount || (tableRows.length > 0 && expectedCount === 1)) {
    return tableRows;
  }

  // Strategy 2: Card/fieldset containers
  const cards = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '.pilgrim-card, .devotee-card, .pilgrim-row, mat-card, .mat-mdc-card, .card, fieldset'
    )
  ).filter(card => {
    return card.querySelectorAll('input:not([type="hidden"]), select, mat-select, [role="combobox"]').length >= 3;
  });

  if (cards.length >= expectedCount || (cards.length > 0 && expectedCount === 1)) {
    return cards;
  }

  // Strategy 3: Repeated sibling structures
  const repeatedSiblings = findRepeatedSiblingStructures(doc);
  if (repeatedSiblings.length >= expectedCount) {
    return repeatedSiblings;
  }

  // Fail closed: never use document.body or the entire form as a fallback
  return [];
}

/**
 * Find sibling elements that share the same structure (class, tag)
 * and contain form controls — likely repeated pilgrim rows.
 */
function findRepeatedSiblingStructures(doc: Document): HTMLElement[] {
  const containers = Array.from(doc.querySelectorAll<HTMLElement>('div, section, article, li'));
  const groups = new Map<string, HTMLElement[]>();

  for (const el of containers) {
    if (!isElementVisible(el)) continue;
    const controls = el.querySelectorAll('input:not([type="hidden"]), select, mat-select');
    if (controls.length < 3) continue;

    // Create a structural signature
    const sig = `${el.tagName}:${el.className}:${controls.length}`;
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(el);
  }

  // Find the group with the most repeated elements that have the same parent
  for (const [, elements] of groups) {
    if (elements.length >= 2) {
      // Check if they share a parent
      const parent = elements[0].parentElement;
      if (parent && elements.every(el => el.parentElement === parent)) {
        return elements;
      }
    }
  }

  return [];
}

function computeRowFingerprint(rowEl: HTMLElement, index: number): string {
  const inputCount = rowEl.querySelectorAll('input, select, mat-select').length;
  const tag = rowEl.tagName || 'UNKNOWN';
  const cls = (rowEl.className || '').slice(0, 50);
  return `row-${index}:${tag}:${cls}:${inputCount}`;
}

/**
 * Validate that the locked row is still attached to the live document.
 */
export function isRowValidInDOM(rowContext: PilgrimRowContext, doc: Document = document): boolean {
  return doc.contains(rowContext.element);
}

/**
 * Re-detect and re-lock a single row at a given index.
 */
export function reDetectRow(
  doc: Document,
  expectedCount: number,
  rowIndex: number,
): PilgrimRowContext | null {
  const rows = detectAndLockPilgrimRows(doc, expectedCount);
  return rows[rowIndex] || null;
}
