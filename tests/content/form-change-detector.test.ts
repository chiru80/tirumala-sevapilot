// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { FormChangeDetector } from '../../src/content/form-change-detector';
import type { ScannedField } from '../../src/shared/types';

describe('FormChangeDetector Lightweight Signature Comparison', () => {
  it('should detect when fields are added or removed dynamically', () => {
    const initialFields: ScannedField[] = [
      { element: '#name', type: 'text', name: 'name', groupIndex: 0 },
      { element: '#age', type: 'number', name: 'age', groupIndex: 0 },
      { element: '#gender', type: 'select', name: 'gender', groupIndex: 0 },
    ];

    // First scan establishes baseline
    const r1 = FormChangeDetector.compare('darshan', initialFields);
    expect(r1.hasChanged).toBe(false);

    // Identical scan has no changes
    const r2 = FormChangeDetector.compare('darshan', initialFields);
    expect(r2.hasChanged).toBe(false);

    // Modified scan: 'gender' removed, 'mobile' added
    const modifiedFields: ScannedField[] = [
      { element: '#name', type: 'text', name: 'name', groupIndex: 0 },
      { element: '#age', type: 'number', name: 'age', groupIndex: 0 },
      { element: '#mobile', type: 'tel', name: 'mobile', groupIndex: 0 },
    ];

    const r3 = FormChangeDetector.compare('darshan', modifiedFields);
    expect(r3.hasChanged).toBe(true);
    expect(r3.fieldsRemoved.length).toBe(1);
    expect(r3.fieldsAdded.length).toBe(1);
    expect(r3.fieldsRemoved[0]).toContain('gender');
    expect(r3.fieldsAdded[0]).toContain('mobile');
  });
});
