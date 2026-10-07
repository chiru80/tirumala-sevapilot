// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Fast DOM Snapshot (Phase 3)
// Scoped, atomic extraction of form controls and semantic metadata.
// Eliminates repetitive full-document traversals.
// ─────────────────────────────────────────────────

import { isElementVisible } from './field-resolver';

export interface SnapshotControl {
  element: HTMLElement;
  tagName: string;
  type: string;
  name: string;
  id: string;
  formControlName: string;
  ariaLabel: string;
  placeholder: string;
  disabled: boolean;
  readOnly: boolean;
  currentValue: string;
}

export interface SectionSnapshot {
  root: HTMLElement;
  controls: SnapshotControl[];
  inputs: SnapshotControl[];
  selects: SnapshotControl[];
  textareas: SnapshotControl[];
  radios: SnapshotControl[];
  timestamp: number;
}

const CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
  'select',
  'mat-select',
  '[role="combobox"]',
  '[role="listbox"]',
  'p-dropdown',
  'ng-select',
  'textarea',
].join(', ');

export class DomSnapshot {
  private static snapshotWeakMap = new WeakMap<HTMLElement, SectionSnapshot>();

  /**
   * Capture a scoped snapshot of candidate controls inside a container.
   * If an unexpired snapshot exists for the exact container and elements remain connected, returns it.
   */
  public static takeSnapshot(container: HTMLElement, maxAgeMs: number = 500): SectionSnapshot {
    const existing = this.snapshotWeakMap.get(container);
    if (existing && Date.now() - existing.timestamp < maxAgeMs) {
      // Validate that at least one control is still connected
      if (existing.controls.length === 0 || existing.controls[0].element.isConnected) {
        return existing;
      }
    }

    const rawElements = Array.from(container.querySelectorAll<HTMLElement>(CONTROL_SELECTOR));
    const controls: SnapshotControl[] = [];
    const inputs: SnapshotControl[] = [];
    const selects: SnapshotControl[] = [];
    const textareas: SnapshotControl[] = [];
    const radios: SnapshotControl[] = [];

    for (const el of rawElements) {
      if (!isElementVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || (tag === 'select' ? 'select' : '')).toLowerCase();
      const isInput = tag === 'input';
      const isSelect = tag === 'select' || tag === 'mat-select' || el.getAttribute('role') === 'combobox';
      const isTextArea = tag === 'textarea';
      const isRadio = type === 'radio';

      const inputEl = isInput ? (el as HTMLInputElement) : null;
      const textAreaEl = isTextArea ? (el as HTMLTextAreaElement) : null;
      const selectEl = tag === 'select' ? (el as HTMLSelectElement) : null;

      const disabled = Boolean(
        inputEl?.disabled ||
        textAreaEl?.disabled ||
        selectEl?.disabled ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('disabled')
      );

      const readOnly = Boolean(
        inputEl?.readOnly ||
        textAreaEl?.readOnly ||
        el.getAttribute('aria-readonly') === 'true' ||
        el.hasAttribute('readonly')
      );

      let currentValue = '';
      if (inputEl) currentValue = inputEl.value || '';
      else if (textAreaEl) currentValue = textAreaEl.value || '';
      else if (selectEl) currentValue = selectEl.value || '';
      else currentValue = (el.textContent || '').trim();

      const ctrl: SnapshotControl = {
        element: el,
        tagName: tag,
        type,
        name: el.getAttribute('name') || '',
        id: el.id || '',
        formControlName: el.getAttribute('formcontrolname') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        placeholder: inputEl?.placeholder || '',
        disabled,
        readOnly,
        currentValue,
      };

      controls.push(ctrl);
      if (isRadio) radios.push(ctrl);
      else if (isInput) inputs.push(ctrl);
      else if (isSelect) selects.push(ctrl);
      else if (isTextArea) textareas.push(ctrl);
    }

    const snapshot: SectionSnapshot = {
      root: container,
      controls,
      inputs,
      selects,
      textareas,
      radios,
      timestamp: Date.now(),
    };

    this.snapshotWeakMap.set(container, snapshot);
    return snapshot;
  }

  public static invalidate(container: HTMLElement): void {
    this.snapshotWeakMap.delete(container);
  }
}
