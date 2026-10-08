// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Field Ownership & Lifecycle Tracker (Phase 11)
// Protects human-modified form fields against silent overwriting.
// Classifies field lifecycle: EMPTY, ALREADY_CORRECT, USER_MODIFIED,
// WRONG_VALUE, UNAVAILABLE, EXPECTED.
// ─────────────────────────────────────────────────────────────

import type { FieldOwnership, FieldLifecycleState } from './types';
import logger from '@shared/logger';

const OWNERSHIP_DATA_KEY = '__sp_field_ownership__';
const USER_MODIFIED_ATTR = 'data-sp-user-modified';

export class FieldOwnershipTracker {
  private isListening = false;
  private readonly userModifiedElements: WeakSet<HTMLElement> = new WeakSet();
  private readonly extensionFilledElements: WeakSet<HTMLElement> = new WeakSet();

  /**
   * Starts listening to user input and change events across document forms.
   * Disregards synthetic events marked with SevaPilot internal signatures.
   */
  public startTracking(root: ParentNode = document): void {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    root.addEventListener('input', this.handleUserInput as EventListener, true);
    root.addEventListener('change', this.handleUserInput as EventListener, true);
    root.addEventListener('keydown', this.handleUserKeydown as EventListener, true);

    logger.debug('[FieldOwnershipTracker] Started tracking human field interactions.');
  }

  private handleUserInput = (e: Event): void => {
    // If the event was marked as synthetic by SevaPilot automation, do not treat as human edit
    const isSynthetic = (e as unknown as { isTrusted?: boolean; __sp_synthetic__?: boolean }).__sp_synthetic__;
    if (isSynthetic || !e.isTrusted) {
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target && this.isEligibleFormField(target)) {
      this.markAsUserModified(target);
    }
  };

  private handleUserKeydown = (e: KeyboardEvent): void => {
    if (!e.isTrusted) return;
    const target = e.target as HTMLElement | null;
    if (target && this.isEligibleFormField(target)) {
      // Exclude tab or navigation keys
      if (!['Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.markAsUserModified(target);
      }
    }
  };

  private isEligibleFormField(el: HTMLElement): boolean {
    const tag = el.tagName?.toLowerCase();
    return ['input', 'select', 'textarea', 'mat-select'].includes(tag);
  }

  /**
   * Flags an element as explicitly user-modified.
   */
  public markAsUserModified(element: HTMLElement): void {
    this.userModifiedElements.add(element);
    this.extensionFilledElements.delete(element);
    element.setAttribute(USER_MODIFIED_ATTR, 'true');
    element.dataset[OWNERSHIP_DATA_KEY] = 'USER';
    logger.debug('[FieldOwnershipTracker] Field marked as USER modified:', {
      tag: element.tagName,
      id: element.id,
      name: element.getAttribute('name'),
    });
  }

  /**
   * Flags an element as filled and owned by the extension.
   */
  public markAsExtensionFilled(element: HTMLElement): void {
    this.extensionFilledElements.add(element);
    element.dataset[OWNERSHIP_DATA_KEY] = 'EXTENSION';
  }

  /**
   * Returns current ownership of a field element.
   */
  public getOwnership(element: HTMLElement): FieldOwnership {
    if (this.userModifiedElements.has(element) || element.getAttribute(USER_MODIFIED_ATTR) === 'true') {
      return 'USER';
    }
    if (this.extensionFilledElements.has(element)) {
      return 'EXTENSION';
    }
    return 'UNKNOWN';
  }

  public isUserModified(element: HTMLElement): boolean {
    return this.getOwnership(element) === 'USER';
  }

  /**
   * Classifies current lifecycle state of a form field against an expected value.
   */
  public classifyFieldLifecycle(
    element: HTMLElement,
    expectedValue: string,
  ): FieldLifecycleState {
    // 1. Check if disabled or read-only
    const isDisabled =
      (element as HTMLInputElement).disabled ||
      (element as HTMLInputElement).readOnly ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.getAttribute('readonly') !== null;

    if (isDisabled) {
      return 'UNAVAILABLE';
    }

    // 2. Check if devotee manually altered this field
    if (this.isUserModified(element)) {
      return 'USER_MODIFIED';
    }

    // 3. Read current DOM value
    const currentValue = this.readElementValue(element);

    if (!currentValue || currentValue.trim().length === 0) {
      return 'EMPTY';
    }

    const normCurrent = currentValue.trim().toLowerCase();
    const normExpected = expectedValue.trim().toLowerCase();

    if (normCurrent === normExpected) {
      return 'ALREADY_CORRECT';
    }

    return 'WRONG_VALUE';
  }

  private readElementValue(element: HTMLElement): string {
    const input = element as HTMLInputElement;
    if (typeof input.value === 'string') {
      return input.value;
    }
    // For mat-select or custom dropdowns
    const text = element.textContent || '';
    return text.trim();
  }

  public stopTracking(root: ParentNode = document): void {
    if (!this.isListening || typeof window === 'undefined') return;
    this.isListening = false;

    root.removeEventListener('input', this.handleUserInput as EventListener, true);
    root.removeEventListener('change', this.handleUserInput as EventListener, true);
    root.removeEventListener('keydown', this.handleUserKeydown as EventListener, true);

    logger.debug('[FieldOwnershipTracker] Stopped tracking human interactions.');
  }
}
