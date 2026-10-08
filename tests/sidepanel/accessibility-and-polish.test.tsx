// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Test Suite: Phase 11 Accessibility & UI Polish
// Verifies ARIA roles, live regions, progress bars, keyboard focusability,
// button hit target dimensions, and sidepanel responsive constraints.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueueCard } from '../../src/sidepanel/components/dashboard/QueueCard';
import { BookingCockpit } from '../../src/sidepanel/components/dashboard/BookingCockpit';
import { AutofillProgress } from '../../src/sidepanel/components/dashboard/AutofillProgress';
import { TemporaryLockCard } from '../../src/sidepanel/components/dashboard/TemporaryLockCard';
import type { QueueSession } from '../../src/services/queue/types';
import type { TtdTemporaryLockState, Pilgrim } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('Phase 11: Accessibility (a11y) & Sidepanel Polish', () => {
  afterEach(() => {
    cleanup();
  });

  describe('1. QueueCard Accessibility', () => {
    it('provides role="region", aria-live="polite", and accessible action buttons', () => {
      const mockStop = vi.fn();
      const mockRefresh = vi.fn();

      const session: QueueSession = {
        sessionId: 'q_test_1',
        tabId: 1,
        state: 'QUEUE_WAITING',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reasons: ['Queue detected'],
        progress: {
          position: 142,
          officialWaitTime: '15 mins',
          isOfficialEstimate: true,
          lastUpdated: new Date().toISOString(),
        },
      };

      render(
        <QueueCard
          session={session}
          onStopMonitoring={mockStop}
          onRefreshManually={mockRefresh}
        />
      );

      const region = screen.getByRole('region', { name: /ttd digital queue status/i });
      expect(region).toBeTruthy();
      expect(region.getAttribute('aria-live')).toBe('polite');

      const stopBtn = screen.getByRole('button', { name: /stop monitoring/i });
      const refreshBtn = screen.getByRole('button', { name: /refresh manually/i });

      expect(stopBtn).toBeTruthy();
      expect(refreshBtn).toBeTruthy();

      // Check minimum hit target class
      expect(stopBtn.className).toContain('min-h-[36px]');
      expect(refreshBtn.className).toContain('min-h-[36px]');

      // Test keyboard interaction / click
      fireEvent.click(stopBtn);
      expect(mockStop).toHaveBeenCalledTimes(1);

      fireEvent.click(refreshBtn);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. BookingCockpit Accessibility & Polish', () => {
    const samplePilgrims: Pilgrim[] = [
      {
        id: 'p1',
        firstName: 'Srinivasa',
        lastName: 'Rao',
        fullName: 'Srinivasa Rao',
        age: 38,
        gender: Gender.MALE,
        idType: IdType.AADHAAR,
        idNumber: '123456789012',
        country: 'India',
        createdAt: new Date().toISOString(),
      },
    ];

    it('provides accessible role="region", status live region, and keyboard-operable fill button', () => {
      const mockFill = vi.fn();
      const mockStop = vi.fn();

      const { rerender } = render(
        <BookingCockpit
          serviceName="Special Entry Darshan ₹300"
          selectedPilgrims={samplePilgrims}
          isReady={true}
          isFilling={false}
          onFillClick={mockFill}
          onStopClick={mockStop}
        />
      );

      const region = screen.getByRole('region', { name: /booking cockpit/i });
      expect(region).toBeTruthy();

      const fillBtn = screen.getByRole('button', { name: /cockpit execute fill/i });
      expect(fillBtn).toBeTruthy();
      expect((fillBtn as HTMLButtonElement).disabled).toBe(false);
      expect(fillBtn.className).toContain('min-h-[44px]');
      expect(fillBtn.className).toContain('focus-visible:ring-2');

      fireEvent.click(fillBtn);
      expect(mockFill).toHaveBeenCalledTimes(1);

      // Verify disabled state when not ready
      rerender(
        <BookingCockpit
          serviceName="Special Entry Darshan ₹300"
          selectedPilgrims={samplePilgrims}
          isReady={false}
          isFilling={false}
          onFillClick={mockFill}
          onStopClick={mockStop}
        />
      );

      const disabledFillBtn = screen.getByRole('button', { name: /cockpit execute fill/i });
      expect((disabledFillBtn as HTMLButtonElement).disabled).toBe(true);
      expect(disabledFillBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('renders accessible stop button during active filling mode', () => {
      const mockStop = vi.fn();

      render(
        <BookingCockpit
          serviceName="Special Entry Darshan ₹300"
          selectedPilgrims={samplePilgrims}
          isReady={true}
          isFilling={true}
          onFillClick={vi.fn()}
          onStopClick={mockStop}
        />
      );

      const stopBtn = screen.getByRole('button', { name: /stop autofill process/i });
      expect(stopBtn).toBeTruthy();
      expect(stopBtn.className).toContain('min-h-[44px]');

      fireEvent.click(stopBtn);
      expect(mockStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. AutofillProgress ARIA ProgressBar', () => {
    it('renders progressbar with accurate valuenow, valuemin, valuemax, and label', () => {
      render(
        <AutofillProgress
          currentPilgrim={1}
          totalPilgrims={2}
          currentField="age"
          onCancel={vi.fn()}
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeTruthy();
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');

      const valueNow = Number(progressbar.getAttribute('aria-valuenow'));
      expect(valueNow).toBeGreaterThan(0);
      expect(valueNow).toBeLessThanOrEqual(100);
      expect(progressbar.getAttribute('aria-label')).toMatch(/Autofill progress/i);
    });
  });

  describe('4. TemporaryLockCard Alert Semantics', () => {
    it('renders role="alert" and aria-live="assertive" for server-side hold awareness', () => {
      const lockState: TtdTemporaryLockState = {
        status: 'temporary-lock',
        detectedAt: Date.now(),
        detectedAtIso: new Date().toISOString(),
        message: 'Your previous booking attempt is holding devotee ID.',
        supportingMessage: 'Please wait for lock release.',
        hasExplicitTimer: true,
        remainingSeconds: 180,
      };

      render(
        <TemporaryLockCard
          lockState={lockState}
          onCheckBookingHistory={vi.fn()}
          onTryAgain={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeTruthy();
      expect(alert.getAttribute('aria-live')).toBe('assertive');
      expect(screen.getByRole('button', { name: /check booking history/i })).toBeTruthy();
    });
  });
});
