// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AutofillProgress } from '../../src/sidepanel/components/dashboard/AutofillProgress';

describe('AutofillProgress Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders devotee progress and active field checklist with accessible status', () => {
    render(
      <AutofillProgress
        currentPilgrim={3}
        totalPilgrims={6}
        currentField="idType"
        onCancel={vi.fn()}
      />
    );

    // Verify accessibility contract
    const statusElem = screen.getByRole('status');
    expect(statusElem).toBeTruthy();
    expect(statusElem.getAttribute('aria-live')).toBe('polite');
    expect(statusElem.getAttribute('aria-label')).toMatch(/Filling (?:& Verifying )?Pilgrim 3 of 6/i);

    // Verify user-visible text
    expect(screen.getByText(/Filling & Verifying/i)).toBeTruthy();
    expect(screen.getByText('Pilgrim 3 of 6')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Age')).toBeTruthy();
    expect(screen.getByText('Gender')).toBeTruthy();
    expect(screen.getByText('Photo ID Proof')).toBeTruthy();
    expect(screen.getByText('Photo ID Number')).toBeTruthy();
  });


  it('triggers onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <AutofillProgress
        currentPilgrim={1}
        totalPilgrims={2}
        currentField="name"
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelBtn).toBeTruthy();

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has accessible live region attributes', () => {
    render(
      <AutofillProgress
        currentPilgrim={1}
        totalPilgrims={1}
        currentField="name"
        onCancel={vi.fn()}
      />
    );

    const statusElem = screen.getByRole('status');
    expect(statusElem).toBeTruthy();
    expect(statusElem.getAttribute('aria-live')).toBe('polite');
  });
});
