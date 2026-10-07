// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadinessCard } from '../../src/sidepanel/components/diagnostics/ReadinessCard';
import type { UseReadinessResult } from '../../src/sidepanel/hooks/useReadiness';

describe('ReadinessCard Component', () => {
  it('renders 100% READY status when all checks pass', () => {
    const readyState: UseReadinessResult = {
      isReady: true,
      score: 100,
      checks: [
        { id: 'ttd-page', label: 'TTD Page', passed: true, message: 'TTD page detected', severity: 'info' },
        { id: 'profile', label: 'Profile', passed: true, message: 'Family selected', severity: 'info' },
        { id: 'selection', label: 'Devotees', passed: true, message: '6 pilgrims selected', severity: 'info' },
        { id: 'required-fields', label: 'Required Details', passed: true, message: 'All required details available', severity: 'info' },
        { id: 'general-details', label: 'General Details', passed: true, message: 'General details available', severity: 'info' },
      ],
      missingDetails: [],
      totalPilgrims: 6,
      readyPilgrims: 6,
      hasInvalidAadhaar: false,
      hasInvalidMobile: false,
      allPilgrimsReady: true,
      hasValidGeneralContact: true,
      recommendations: [],
    };

    render(<ReadinessCard readiness={readyState} onFixProfile={vi.fn()} />);

    expect(screen.getByText('100% READY')).toBeTruthy();
    expect(screen.getByText('TTD page detected')).toBeTruthy();
    expect(screen.getByText('Family selected')).toBeTruthy();
    expect(screen.getByText('6 pilgrims selected')).toBeTruthy();
    expect(screen.queryByText('Fix Profile →')).toBeNull();
  });

  it('renders incomplete status with warning and calls onFixProfile', () => {
    const onFixProfile = vi.fn();
    const incompleteState: UseReadinessResult = {
      isReady: false,
      score: 60,
      checks: [
        { id: 'ttd-page', label: 'TTD Page', passed: true, message: 'TTD page detected', severity: 'info' },
        { id: 'profile', label: 'Profile', passed: true, message: 'Family selected', severity: 'info' },
        { id: 'selection', label: 'Devotees', passed: true, message: '1 pilgrim selected', severity: 'info' },
        { id: 'required-fields', label: 'Required Details', passed: false, message: 'Pilgrim 1: Missing ID Number', severity: 'error' },
        { id: 'general-details', label: 'General Details', passed: true, message: 'General details available', severity: 'info' },
      ],
      missingDetails: ['Pilgrim 1: Missing ID Number'],
      totalPilgrims: 1,
      readyPilgrims: 0,
      hasInvalidAadhaar: true,
      hasInvalidMobile: false,
      allPilgrimsReady: false,
      hasValidGeneralContact: true,
      recommendations: ['Add ID number for Pilgrim 1'],
    };

    render(<ReadinessCard readiness={incompleteState} onFixProfile={onFixProfile} />);

    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('⚠ Pilgrim 1: Missing ID Number')).toBeTruthy();

    const fixBtn = screen.getByText('Fix Profile →');
    expect(fixBtn).toBeTruthy();

    fireEvent.click(fixBtn);
    expect(onFixProfile).toHaveBeenCalledTimes(1);
  });

  it('renders exact pilgrim limit error when selection does not match service requirement', () => {
    const exactLimitState: UseReadinessResult = {
      isReady: false,
      score: 50,
      checks: [
        { id: 'ttd-page', label: 'TTD Page', passed: true, message: 'TTD page detected', severity: 'info' },
        { id: 'profile', label: 'Profile', passed: true, message: 'Family selected', severity: 'info' },
        { id: 'exact-pilgrim-count', label: 'Pilgrim Limit', passed: false, message: 'Exactly 2 devotees required per booking (selected: 1)', severity: 'error' },
      ],
      missingDetails: ['Exactly 2 devotees required for Sri Srinivasa Divyanugraha Homam'],
      totalPilgrims: 1,
      readyPilgrims: 1,
      hasInvalidAadhaar: false,
      hasInvalidMobile: false,
      allPilgrimsReady: true,
      hasValidGeneralContact: true,
      recommendations: ['Select exactly 2 devotees for this service'],
    };

    render(<ReadinessCard readiness={exactLimitState} onFixProfile={vi.fn()} />);
    expect(screen.getByText('Exactly 2 devotees required per booking (selected: 1)')).toBeTruthy();
  });
});
