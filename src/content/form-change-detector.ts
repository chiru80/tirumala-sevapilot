// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Form Change Detector
// Lightweight fingerprint comparison to detect website form alterations
// ─────────────────────────────────────────────────

import type { ScannedField, FieldMapping } from '@shared/types';
import logger from '@shared/logger';

export interface FormChangeReport {
  hasChanged: boolean;
  fieldsRemoved: string[];
  fieldsAdded: string[];
  message: string;
}

export class FormChangeDetector {
  private static lastSignatures: Map<string, string[]> = new Map();

  /**
   * Generate an array of lightweight field signatures: `tag:name:id:type`
   */
  public static generateSignatures(fields: ScannedField[]): string[] {
    return fields.map(f => {
      const idOrName = f.id || f.name || f.label || 'anon';
      return `${f.type}:${idOrName}:${f.groupIndex ?? 0}`;
    });
  }

  /**
   * Compare previous scan signatures with current form scan
   */
  public static compare(serviceKey: string, currentFields: ScannedField[]): FormChangeReport {
    const currentSigs = this.generateSignatures(currentFields);
    const previousSigs = this.lastSignatures.get(serviceKey);

    // Save for next comparison
    this.lastSignatures.set(serviceKey, currentSigs);

    if (!previousSigs || previousSigs.length === 0) {
      return {
        hasChanged: false,
        fieldsRemoved: [],
        fieldsAdded: [],
        message: 'Initial form scan registered.',
      };
    }

    const prevSet = new Set(previousSigs);
    const currSet = new Set(currentSigs);

    const removed = previousSigs.filter(sig => !currSet.has(sig));
    const added = currentSigs.filter(sig => !prevSet.has(sig));

    const hasSignificantChange = removed.length > 0 || added.length > 0;

    return {
      hasChanged: hasSignificantChange,
      fieldsRemoved: removed,
      fieldsAdded: added,
      message: hasSignificantChange
        ? `One or more fields have changed (${removed.length} removed, ${added.length} added).`
        : 'Form structure intact.',
    };
  }

  /**
   * Reset saved signature for a service (e.g. after user clicks [Re-detect Fields])
   */
  public static reset(serviceKey: string): void {
    this.lastSignatures.delete(serviceKey);
  }
}
