// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Fingerprint Cache (Phase 3)
// Safe, bounded caching of element fingerprints and resolved bindings.
// Never stores sensitive field values. Uses WeakMaps to avoid memory leaks.
// ─────────────────────────────────────────────────

import type { LogicalFieldType, FieldResolution } from './types';

export interface FieldFingerprint {
  tagName: string;
  type?: string;
  name?: string;
  id?: string;
  formControlName?: string;
  ariaLabel?: string;
  placeholder?: string;
  role?: string;
  sectionId?: string;
  isConnected: boolean;
}

export class FieldCache {
  private static fingerprintMap = new WeakMap<Element, FieldFingerprint>();
  private static resolutionMap = new Map<string, FieldResolution>();

  /**
   * Compute and store an immutable fingerprint for an element.
   * Excludes values, inputs, or sensitive data.
   */
  public static getFingerprint(element: HTMLElement, sectionId?: string): FieldFingerprint {
    const existing = this.fingerprintMap.get(element);
    if (existing && existing.isConnected && element.isConnected) {
      return existing;
    }

    const fingerprint: FieldFingerprint = {
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute('type') || undefined,
      name: element.getAttribute('name') || undefined,
      id: element.id || undefined,
      formControlName: element.getAttribute('formcontrolname') || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
      placeholder: (element as HTMLInputElement).placeholder || undefined,
      role: element.getAttribute('role') || undefined,
      sectionId,
      isConnected: element.isConnected,
    };

    this.fingerprintMap.set(element, fingerprint);
    return fingerprint;
  }

  /**
   * Cache a successful field resolution for a specific row and field.
   */
  public static setResolution(rowKey: string, field: LogicalFieldType, resolution: FieldResolution): void {
    const key = `${rowKey}:${field}`;
    this.resolutionMap.set(key, resolution);
  }

  /**
   * Retrieve a cached resolution if the underlying element is still in the DOM and connected.
   */
  public static getResolution(rowKey: string, field: LogicalFieldType): FieldResolution | undefined {
    const key = `${rowKey}:${field}`;
    const cached = this.resolutionMap.get(key);
    if (!cached) return undefined;

    if (!cached.element.isConnected) {
      this.resolutionMap.delete(key);
      return undefined;
    }

    return cached;
  }

  /**
   * Invalidate resolutions for a specific row or section.
   */
  public static invalidateRow(rowKey: string): void {
    for (const key of Array.from(this.resolutionMap.keys())) {
      if (key.startsWith(`${rowKey}:`)) {
        this.resolutionMap.delete(key);
      }
    }
  }

  /**
   * Invalidate the entire resolution cache (e.g. on route change or major rerender).
   */
  public static clear(): void {
    this.resolutionMap.clear();
  }

  public getOrCompute(element: HTMLElement, sectionId?: string): FieldFingerprint {
    return FieldCache.getFingerprint(element, sectionId);
  }

  public get(element: HTMLElement): FieldFingerprint | undefined {
    return FieldCache.fingerprintMap.get(element);
  }

  public invalidate(element: HTMLElement): void {
    FieldCache.fingerprintMap.delete(element);
  }
}
