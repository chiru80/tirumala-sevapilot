// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { computeNextAction } from '../../src/sidepanel/presentation/next-action';
import { testProfileReadiness } from '../../src/sidepanel/presentation/profile-readiness-tester';
import { NextActionCard } from '../../src/sidepanel/components/dashboard/NextActionCard';
import { BookingModeView } from '../../src/sidepanel/components/dashboard/BookingModeView';
import { ServiceSelectorModal } from '../../src/sidepanel/components/dashboard/ServiceSelectorModal';
import { TestProfileModal } from '../../src/sidepanel/components/dashboard/TestProfileModal';
import { Gender, IdType, type Profile, type Pilgrim } from '../../src/shared/types';
import { generateVerhoeffChecksum } from '../../src/validation/aadhaar';

const validMockAadhaar = '23456789012' + generateVerhoeffChecksum('23456789012');

const mockPilgrim: Pilgrim = {
  id: 'pilgrim-1',
  firstName: 'Venkatesh',
  lastName: 'Rao',
  fullName: 'Venkatesh Rao',
  age: 42,
  gender: Gender.MALE,
  idType: IdType.AADHAAR,
  idNumber: validMockAadhaar,
  country: 'India',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockProfile: Profile = {
  id: 'prof-1',
  name: 'Tirupati Yatra 2026',
  isDefault: true,
  general: {
    email: 'pilgrim@example.com',
    mobile: '9876543210',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    pinCode: '517501',
  },
  pilgrims: [mockPilgrim],
  selectedPilgrims: {
    'special-entry-darshan-300': ['pilgrim-1'],
    'padmavathi-supadham-entry-200': ['pilgrim-1'],
    'srivani-donation-10000': ['pilgrim-1'],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Phase 13: Professional UI/UX & User-First Booking Experience', () => {
  afterEach(() => {
    cleanup();
  });

  // ─── 1. Next Action Presentation Engine ───────────────────────────
  describe('computeNextAction presentation mapper', () => {
    it('presents clean NO_PROFILE action when activeProfile is null', () => {
      const action = computeNextAction({
        activeProfile: null,
        selectedPilgrims: [],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: false,
        productState: 'READY',
        readiness: { isReady: false, checks: [] } as any,
      });

      expect(action.category).toBe('NO_PROFILE');
      expect(action.statusText).toBe('Setup Needed');
      expect(action.headline).toBe('Complete your profile');
      expect(action.primaryAction.label).toBe('CREATE PROFILE');
      expect(action.primaryAction.actionType).toBe('NAVIGATE_PROFILE');
      expect(action.headline).not.toMatch(/FIELD_RESOLUTION|DOM_REPLACED/i);
    });

    it('presents clean PROFILE_INCOMPLETE when no pilgrims are selected', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: false,
        productState: 'READY',
        readiness: { isReady: false, checks: [] } as any,
      });

      expect(action.category).toBe('PROFILE_INCOMPLETE');
      expect(action.statusText).toBe('Devotees Needed');
      expect(action.primaryAction.label).toBe('SELECT PILGRIMS');
      expect(action.primaryAction.actionType).toBe('SELECT_PILGRIMS');
    });

    it('presents READY action when profile is prepared but TTD page is not open', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: false,
        productState: 'READY',
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('READY');
      expect(action.badgeVariant).toBe('ready');
      expect(action.statusText).toBe('Ready');
      expect(action.primaryAction.label).toBe('PREPARE BOOKING');
      expect(action.secondaryAction?.label).toBe('OPEN TTD BOOKING');
    });

    it('presents dominant ⚡ FILL & VERIFY when on TTD page and ready', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'READY',
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('TTD_DETECTED');
      expect(action.badgeVariant).toBe('ready');
      expect(action.primaryAction.label).toBe('⚡ FILL & VERIFY');
      expect(action.primaryAction.actionType).toBe('TRIGGER_FILL');
      expect(action.primaryAction.variant).toBe('primary');
    });

    it('presents calm WORKING state with stop button during active autofill', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'WORKING',
        fillStage: { stage: 'filling', currentField: 'Aadhaar Number', currentPilgrim: 0 },
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('WORKING');
      expect(action.badgeVariant).toBe('working');
      expect(action.statusText).toBe('Filling');
      expect(action.primaryAction.label).toBe('Stop');
      expect(action.primaryAction.actionType).toBe('STOP');
      expect(action.primaryAction.variant).toBe('danger');
    });

    it('presents clear USER_ACTION_REQUIRED at human trust boundaries (CAPTCHA/OTP/Payment)', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'USER_ACTION_REQUIRED',
        userActionPrompt: 'Please complete the CAPTCHA to proceed',
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('USER_ACTION_REQUIRED');
      expect(action.badgeVariant).toBe('actionRequired');
      expect(action.statusText).toBe('Action Needed');
      expect(action.description).toMatch(/CAPTCHA/i);
      expect(action.primaryAction.label).toBe('Continue on TTD');
    });

    it('presents safe QUEUE_WAITING state when TTD digital queue is detected', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'READY',
        queueSession: {
          state: 'QUEUE_ACTIVE',
          progress: { officialWaitTime: '12 mins' },
        } as any,
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('QUEUE_WAITING');
      expect(action.badgeVariant).toBe('working');
      expect(action.statusText).toBe('In Queue');
      expect(action.description).toContain('12 mins');
      expect(action.primaryAction.actionType).toBe('STOP');
    });

    it('presents BLOCKED state on temporary booking lock with history action and NO retry action while active', () => {
      const action = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'BLOCKED',
        temporaryLock: { status: 'temporary-lock' },
        readiness: { isReady: true, checks: [] } as any,
      });

      expect(action.category).toBe('BLOCKED');
      expect(action.badgeVariant).toBe('blocked');
      expect(action.headline).toBe('Previous booking attempt is still active');
      expect(action.primaryAction.label).toBe('CHECK BOOKING HISTORY');
      expect(action.secondaryAction).toBeUndefined();
    });

    it('maps queue states in strict safety priority order (CAPTCHA, session expired, completed)', () => {
      const captchaAction = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'WORKING',
        queueSession: {
          sessionId: 'q-1',
          startTime: Date.now(),
          isQueuePresent: true,
          state: 'QUEUE_CAPTCHA_REQUIRED',
        } as any,
        readiness: { isReady: true, checks: [] } as any,
      });
      expect(captchaAction.category).toBe('USER_ACTION_REQUIRED');
      expect(captchaAction.badgeVariant).toBe('actionRequired');
      expect(captchaAction.headline).toBe('Solve CAPTCHA on TTD');
      expect(captchaAction.primaryAction.actionType).toBe('OPEN_TTD');

      const expiredAction = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'WORKING',
        queueSession: {
          sessionId: 'q-2',
          startTime: Date.now(),
          isQueuePresent: true,
          state: 'QUEUE_SESSION_EXPIRED',
        } as any,
        readiness: { isReady: true, checks: [] } as any,
      });
      expect(expiredAction.category).toBe('BLOCKED');
      expect(expiredAction.badgeVariant).toBe('blocked');
      expect(expiredAction.headline).toBe('Queue Session Expired');

      const completedAction = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'WORKING',
        queueSession: {
          sessionId: 'q-3',
          startTime: Date.now(),
          isQueuePresent: true,
          state: 'QUEUE_COMPLETED',
        } as any,
        readiness: { isReady: true, checks: [] } as any,
      });
      expect(completedAction.category).toBe('COMPLETED');
      expect(completedAction.badgeVariant).toBe('completed');
      expect(completedAction.headline).toBe('Queue Complete — Ready to Book');
    });
  });

  // ─── 2. Service-Aware Readiness Engine ───────────────────────────
  describe('profile-readiness-tester service validation', () => {
    it('validates SED ₹300 requires general details and pilgrim ID', () => {
      const result = testProfileReadiness(mockProfile, [mockPilgrim], 'special-entry-darshan-300');
      expect(result.serviceName).toBe('Special Entry Darshan ₹300');
      expect(result.isReady).toBe(true);

      const emailCheck = result.checklist.find(i => i.id === 'general-email');
      expect(emailCheck).toBeDefined();
      expect(emailCheck?.passed).toBe(true);

      const idCheck = result.checklist.find(i => i.id === 'id-details');
      expect(idCheck).toBeDefined();
      expect(idCheck?.passed).toBe(true);
    });

    it('validates Padmavathi ₹200 does NOT require general contact details', () => {
      const profileNoGeneral: Profile = {
        ...mockProfile,
        general: undefined,
      };
      const result = testProfileReadiness(profileNoGeneral, [mockPilgrim], 'padmavathi-supadham-entry-200');
      const emailCheck = result.checklist.find(i => i.id === 'general-email');
      expect(emailCheck).toBeUndefined();
      expect(result.isReady).toBe(true);
    });

    it('flags missing gothram for services that require gothram', () => {
      const profileNoGothram: Profile = {
        ...mockProfile,
        general: {
          ...mockProfile.general,
          gothram: undefined,
        },
        gothram: undefined,
      };
      const result = testProfileReadiness(profileNoGothram, [mockPilgrim], 'homam-1600');
      const gothramCheck = result.checklist.find(i => i.id === 'special-gothram');
      expect(gothramCheck).toBeDefined();
      expect(gothramCheck?.passed).toBe(false);
      expect(result.isReady).toBe(false);
    });

    it('fails closed when given an unknown service ID', () => {
      const result = testProfileReadiness(mockProfile, [mockPilgrim], 'unknown-unrecognized-service');
      expect(result.isReady).toBe(false);
      expect(result.isUnknownService).toBe(true);
      expect(result.headline).toBe('Requirements Unavailable');
      expect(result.checklist.some(c => c.id === 'unknown-service-requirements' && c.passed === false)).toBe(true);
      expect(result.missingItems).toContain('Service Requirements Unavailable');
    });

    it('enforces Srivari Seva age limit (18 to 60)', () => {
      const underAgePilgrim = { ...mockPilgrim, age: 16 };
      const overAgePilgrim = { ...mockPilgrim, age: 65 };
      const validAgePilgrim = { ...mockPilgrim, age: 30 };

      const underResult = testProfileReadiness(mockProfile, [underAgePilgrim], 'srivari-seva');
      expect(underResult.isReady).toBe(false);
      expect(underResult.pilgrimValidationItems[0].isValid).toBe(false);
      expect(underResult.pilgrimValidationItems[0].errors).toContain('Srivari Seva requires age between 18 and 60 years');

      const overResult = testProfileReadiness(mockProfile, [overAgePilgrim], 'srivari-seva');
      expect(overResult.isReady).toBe(false);
      expect(overResult.pilgrimValidationItems[0].isValid).toBe(false);
      expect(overResult.pilgrimValidationItems[0].errors).toContain('Srivari Seva requires age between 18 and 60 years');

      const validResult = testProfileReadiness(mockProfile, [validAgePilgrim], 'srivari-seva');
      expect(validResult.pilgrimValidationItems[0].errors).not.toContain('Srivari Seva requires age between 18 and 60 years');
    });

    it('validates non-Aadhaar IDs according to selected ID format requirements', () => {
      const badPanPilgrim = { ...mockPilgrim, idType: IdType.PAN, idNumber: '12345' };
      const badVoterPilgrim = { ...mockPilgrim, idType: IdType.VOTER_ID, idNumber: 'AB' };
      const validPanPilgrim = { ...mockPilgrim, idType: IdType.PAN, idNumber: 'ABCDE1234F' };

      const resBadPan = testProfileReadiness(mockProfile, [badPanPilgrim], 'special-entry-darshan-300');
      expect(resBadPan.isReady).toBe(false);
      expect(resBadPan.pilgrimValidationItems[0].isValid).toBe(false);

      const resBadVoter = testProfileReadiness(mockProfile, [badVoterPilgrim], 'special-entry-darshan-300');
      expect(resBadVoter.isReady).toBe(false);
      expect(resBadVoter.pilgrimValidationItems[0].isValid).toBe(false);

      const resGoodPan = testProfileReadiness(mockProfile, [validPanPilgrim], 'special-entry-darshan-300');
      expect(resGoodPan.pilgrimValidationItems[0].isValid).toBe(true);
    });

    it('correctly calculates additional missing count without overstating by one', () => {
      const incompleteProfile: Profile = {
        ...mockProfile,
        general: {
          ...mockProfile.general,
          email: '',
          city: '',
          state: '',
          pinCode: '',
        },
      };
      const result = testProfileReadiness(incompleteProfile, [mockPilgrim], 'special-entry-darshan-300');
      const missingCount = result.missingItems.length;
      expect(missingCount).toBeGreaterThan(1);
      expect(result.summary).toContain(`${missingCount - 1} more item(s) needed`);
    });
  });

  // ─── 3. NextActionCard Component Tests ────────────────────────────
  describe('NextActionCard UI Component', () => {
    it('renders with dominant accessible button and fires onPrimaryClick', () => {
      const onPrimary = vi.fn();
      const onSecondary = vi.fn();
      const model = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'READY',
        readiness: { isReady: true, checks: [] } as any,
      });

      render(
        <NextActionCard
          model={model}
          onPrimaryClick={onPrimary}
          onSecondaryClick={onSecondary}
        />
      );

      const primaryBtn = screen.getByRole('button', { name: /⚡ FILL & VERIFY/i });
      expect(primaryBtn).toBeTruthy();
      expect(primaryBtn.id).toBe('sp-hero-primary-action-btn');

      fireEvent.click(primaryBtn);
      expect(onPrimary).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 4. BookingModeView Full-Screen Mode ──────────────────────────
  describe('BookingModeView Full-Screen Experience', () => {
    it('renders uncluttered ultra-focused view and supports exit', () => {
      const onExit = vi.fn();
      const onPrimary = vi.fn();
      const nextAction = computeNextAction({
        activeProfile: mockProfile,
        selectedPilgrims: [mockPilgrim],
        serviceDisplayName: 'Special Entry Darshan ₹300',
        pageDetected: true,
        productState: 'READY',
        readiness: { isReady: true, checks: [] } as any,
      });

      render(
        <BookingModeView
          serviceDisplayName="Special Entry Darshan ₹300"
          ticketPrice={300}
          preparedPilgrimCount={1}
          nextAction={nextAction}
          onPrimaryAction={onPrimary}
          onExitBookingMode={onExit}
        />
      );

      // Verify exit button works
      const exitBtn = screen.getByRole('button', { name: /Exit Mode/i });
      expect(exitBtn).toBeTruthy();
      fireEvent.click(exitBtn);
      expect(onExit).toHaveBeenCalledTimes(1);

      // Verify dominant action button is present and clickable
      const fillBtn = screen.getByRole('button', { name: /⚡ FILL & VERIFY/i });
      expect(fillBtn).toBeTruthy();
      fireEvent.click(fillBtn);
      expect(onPrimary).toHaveBeenCalledTimes(1);

      // Verify devotee count summary
      expect(screen.getByText(/1 Devotee\(s\) Prepared/i)).toBeTruthy();
    });
  });

  // ─── 5. Service Selector & Test Profile Modals ────────────────────
  describe('ServiceSelectorModal & TestProfileModal', () => {
    it('ServiceSelectorModal allows switching services', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <ServiceSelectorModal
          isOpen={true}
          currentServiceId="special-entry-darshan-300"
          onSelectService={onSelect}
          onClose={onClose}
        />
      );

      expect(screen.getByText(/Select TTD Service/i)).toBeTruthy();
      expect(screen.getByText(/Padmavathi \/ Sri PAT/i)).toBeTruthy();

      // Click on Padmavathi ₹200
      const padmaBtn = screen.getByRole('button', { name: /Padmavathi \/ Sri PAT/i });
      fireEvent.click(padmaBtn);
      expect(onSelect).toHaveBeenCalledWith('padmavathi-supadham-entry-200');
    });

    it('TestProfileModal runs pre-flight tests safely without touching TTD', () => {
      const onClose = vi.fn();
      const onFix = vi.fn();
      const onOpenTtd = vi.fn();
      const report = testProfileReadiness(mockProfile, [mockPilgrim], 'special-entry-darshan-300');

      render(
        <TestProfileModal
          isOpen={true}
          report={report}
          onClose={onClose}
          onFixProfile={onFix}
          onOpenTtd={onOpenTtd}
        />
      );

      expect(screen.getByText(/Pre-Booking Readiness Check/i)).toBeTruthy();
      expect(screen.getByText(/Ready for Booking/i)).toBeTruthy();

      const openBtn = screen.getByRole('button', { name: /Open TTD/i });
      fireEvent.click(openBtn);
      expect(onOpenTtd).toHaveBeenCalledTimes(1);
    });
  });
});
