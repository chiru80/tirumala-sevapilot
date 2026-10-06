// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AutofillResult } from '../../src/sidepanel/components/dashboard/AutofillResult';
import type { PilgrimRowReport } from '../../src/shared/types';

describe('AutofillResult Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when report list is empty', () => {
    const { container } = render(<AutofillResult pilgrimReports={[]} onRepair={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 100% success state when all fields are verified', () => {
    const successReports: PilgrimRowReport[] = [
      {
        pilgrimIndex: 0,
        pilgrimName: 'Ravi Kumar',
        allDetected: true,
        allFilled: true,
        allValidated: true,
        errors: [],
        fields: {
          name: { fieldType: 'name', label: 'Name', detected: true, filled: true, validated: true },
          age: { fieldType: 'age', label: 'Age', detected: true, filled: true, validated: true },
          gender: { fieldType: 'gender', label: 'Gender', detected: true, filled: true, validated: true },
          photoIdProof: { fieldType: 'photoIdProof', label: 'Photo ID Proof', detected: true, filled: true, validated: true },
          photoIdNumber: { fieldType: 'photoIdNumber', label: 'Photo ID Number', detected: true, filled: true, validated: true },
        },
      },
    ];

    render(<AutofillResult pilgrimReports={successReports} onRepair={vi.fn()} />);

    expect(screen.getByText('ALL DETAILS VERIFIED')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('Devotee 1: Ravi Kumar')).toBeTruthy();
    expect(screen.getByText(/Review the TTD page before continuing/)).toBeTruthy();
  });

  it('renders partial failure state and handles Repair action', () => {
    const onRepair = vi.fn();
    const partialReports: PilgrimRowReport[] = [
      {
        pilgrimIndex: 0,
        pilgrimName: 'Ananya Sharma',
        allDetected: true,
        allFilled: false,
        allValidated: false,
        errors: ['Photo ID Number: Verification failed'],
        fields: {
          name: { fieldType: 'name', label: 'Name', detected: true, filled: true, validated: true },
          age: { fieldType: 'age', label: 'Age', detected: true, filled: true, validated: true },
          gender: { fieldType: 'gender', label: 'Gender', detected: true, filled: true, validated: true },
          photoIdProof: { fieldType: 'photoIdProof', label: 'Photo ID Proof', detected: true, filled: true, validated: true },
          photoIdNumber: { fieldType: 'photoIdNumber', label: 'Photo ID Number', detected: true, filled: false, validated: false, error: 'Could not verify' },
        },
      },
    ];

    render(<AutofillResult pilgrimReports={partialReports} onRepair={onRepair} />);

    expect(screen.getByText('DETAILS NEED ATTENTION')).toBeTruthy();
    expect(screen.getByText('4 / 5 fields verified')).toBeTruthy();
    expect(screen.getByText('Photo ID Number')).toBeTruthy();
    expect(screen.getByText('Could not verify')).toBeTruthy();

    const repairBtn = screen.getByText('⚡ Repair Missing Fields');
    expect(repairBtn).toBeTruthy();

    fireEvent.click(repairBtn);
    expect(onRepair).toHaveBeenCalledTimes(1);
  });
});
