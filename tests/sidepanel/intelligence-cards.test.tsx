// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReleaseCountdownCard } from '../../src/sidepanel/components/dashboard/ReleaseCountdownCard';
import { BookingPreparationCard } from '../../src/sidepanel/components/dashboard/BookingPreparationCard';
import { Gender, IdType, type Profile, type Pilgrim } from '../../src/shared/types';
import type { ReadinessEvaluation } from '../../src/services/readiness-engine';

describe('Phase 5 — Intelligence Dashboard Cards', () => {
  afterEach(() => {
    cleanup();
  });

  describe('ReleaseCountdownCard', () => {
    it('renders NEXT TTD RELEASE and countdown with release pattern', () => {
      render(
        <ReleaseCountdownCard
          serviceId="special-entry-300"
          onOpenTtd={vi.fn()}
        />
      );

      expect(screen.getByRole('region', { name: /NEXT TTD RELEASE/i })).toBeDefined();
      expect(screen.getByText(/Special Entry Darshan.*300/i)).toBeDefined();
      // Should show release pattern for 3-month advance
      expect(screen.getByText(/3 MONTHS IN ADVANCE/i)).toBeDefined();
      // Should show target month
      expect(screen.getByText(/December 2026/i)).toBeDefined();
    });

    it('handles Open Official Source button click', () => {
      const handleOpen = vi.fn();
      render(
        <ReleaseCountdownCard
          serviceId="special-entry-300"
          onOpenTtd={handleOpen}
        />
      );

      const openBtn = screen.getByRole('button', { name: /open official/i });
      fireEvent.click(openBtn);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('renders PREPARE BOOKING button when callback is provided', () => {
      const handlePrepare = vi.fn();
      render(
        <ReleaseCountdownCard
          serviceId="special-entry-300"
          onOpenTtd={vi.fn()}
          onPrepareBooking={handlePrepare}
        />
      );

      const prepareBtn = screen.getByRole('button', { name: /PREPARE BOOKING/i });
      fireEvent.click(prepareBtn);
      expect(handlePrepare).toHaveBeenCalledTimes(1);
    });

    it('renders 1 MONTH IN ADVANCE pattern for Sri Srinivasa Divyanugraha Homam', () => {
      render(
        <ReleaseCountdownCard
          serviceId="sri-srinivasa-divyanugraha-homam"
          onOpenTtd={vi.fn()}
        />
      );

      expect(screen.getByText(/1 MONTH IN ADVANCE/i)).toBeDefined();
      expect(screen.getByText(/Sri Srinivasa Divyanugraha Vishesha Homam/i)).toBeDefined();
    });

    it('renders "Official release date not yet confirmed." and no fabricated countdown when unconfirmed', () => {
      render(
        <ReleaseCountdownCard
          serviceId="arjitha-sevas"
          onOpenTtd={vi.fn()}
        />
      );

      expect(screen.getAllByText(/Official release date not yet confirmed\./i).length).toBeGreaterThan(0);
      // No countdown timer text like "d " or "h " or "m " should be rendered
      expect(screen.queryByText(/COUNTDOWN \(IST\)/i)).toBeNull();
    });
  });

  describe('BookingPreparationCard', () => {
    const mockPilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Anusuri',
      lastName: 'Devotee',
      fullName: 'Anusuri Devotee',
      gender: Gender.MALE,
      age: 30,
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      country: 'India',
      createdAt: '2026-10-06T00:00:00Z',
      updatedAt: '2026-10-06T00:00:00Z',
    };

    const mockProfile: Profile = {
      id: 'prof-1',
      name: 'Family',
      pilgrims: [mockPilgrim],
      general: {
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      selectedPilgrims: { 'special-entry-300': ['p1'] },
      isDefault: true,
      createdAt: '2026-10-06T00:00:00Z',
      updatedAt: '2026-10-06T00:00:00Z',
    };

    const mockReadiness: ReadinessEvaluation = {
      score: 100,
      isComplete: true,
      isProfileReady: true,
      isBookingReady: true,
      pilgrimCount: 1,
      readyPilgrimsCount: 1,
      checks: [],
      missingFields: [],
      recommendations: [],
    };

    it('renders preparation checklist and PREPARE BOOKING button', () => {
      const onPrepare = vi.fn();
      render(
        <BookingPreparationCard
          profile={mockProfile}
          selectedPilgrims={[mockPilgrim]}
          readiness={mockReadiness}
          serviceId="special-entry-300"
          onPrepare={onPrepare}
        />
      );

      expect(screen.getByRole('region', { name: /BOOKING PREPARATION/i })).toBeDefined();
      expect(screen.getByText(/Profile selected/i)).toBeDefined();
      expect(screen.getByText(/Required pilgrims complete/i)).toBeDefined();
      expect(screen.getByText(/ID details verified/i)).toBeDefined();

      const prepareBtn = screen.getByRole('button', { name: /PREPARE BOOKING/i });
      fireEvent.click(prepareBtn);
      expect(onPrepare).toHaveBeenCalledTimes(1);

      // Transitions to READY FOR TTD
      expect(screen.getAllByText(/READY FOR TTD/i).length).toBeGreaterThan(0);
    });
  });
});
