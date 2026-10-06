// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Duplicate ID Detector
// ─────────────────────────────────────────────────

import type { Pilgrim, ValidationResult } from '@shared/types';

/**
 * Check for duplicate ID numbers within a group of pilgrims.
 * Returns a warning for each pair of pilgrims sharing the same ID.
 */
export function detectDuplicateIds(pilgrims: Pilgrim[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const idMap = new Map<string, string[]>(); // idNumber → pilgrim names

  for (const pilgrim of pilgrims) {
    if (!pilgrim.idNumber) continue;

    const normalizedId = pilgrim.idNumber.replace(/[\s-]/g, '').toLowerCase();
    const existing = idMap.get(normalizedId);

    if (existing) {
      existing.push(pilgrim.fullName || `${pilgrim.firstName} ${pilgrim.lastName}`);
    } else {
      idMap.set(normalizedId, [pilgrim.fullName || `${pilgrim.firstName} ${pilgrim.lastName}`]);
    }
  }

  for (const [, names] of idMap) {
    if (names.length > 1) {
      results.push({
        field: 'idNumber',
        valid: false,
        warning: `Duplicate ID number shared by: ${names.join(', ')}`,
      });
    }
  }

  return results;
}
