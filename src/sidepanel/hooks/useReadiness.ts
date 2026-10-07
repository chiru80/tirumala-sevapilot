import { useMemo } from 'react';
import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim, ScanResult } from '@shared/types';
import {
  ReadinessEngine,
  type BookingReadiness,
  type BookingReadinessStatus,
} from '../../services/readiness-engine';

export type { BookingReadiness, BookingReadinessStatus };

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface UseReadinessResult {
  // Canonical Phase 1 readiness contract
  bookingReadiness?: BookingReadiness;
  status?: BookingReadinessStatus;
  headline?: string;
  userAction?: string;
  canFill?: boolean;

  // Backwards compatibility properties
  score: number;
  isReady: boolean;
  allPilgrimsReady?: boolean;
  hasValidGeneralContact?: boolean;
  checks: ReadinessCheck[];
  missingDetails: string[];
  totalPilgrims: number;
  readyPilgrims: number;
  hasInvalidAadhaar: boolean;
  hasInvalidMobile: boolean;
  recommendations: string[];
}

/**
 * Unified Readiness Hook (Phase 1 Canonical Contract).
 * Delegates directly to the authoritative ReadinessEngine, producing
 * ONE authoritative answer for booking readiness across all surfaces.
 */
export function useReadiness(
  activeProfile: Profile | null,
  selectedPilgrims: Pilgrim[],
  serviceType: ServiceType = ServiceType.DARSHAN,
  pageDetected: boolean = false,
  scanResult: ScanResult | null = null,
  serviceId?: string,
  _activeWorkflow?: unknown,
): UseReadinessResult {
  return useMemo(() => {
    const checks: ReadinessCheck[] = [];
    const effectiveServiceId =
      serviceId ||
      scanResult?.serviceId ||
      (serviceType !== ServiceType.DARSHAN && serviceType !== ServiceType.GENERIC
        ? serviceType
        : undefined);

    // 1. Evaluate against the authoritative Canonical BookingReadiness engine
    const bookingReadiness = ReadinessEngine.evaluateBookingReadiness(
      activeProfile,
      serviceType,
      effectiveServiceId,
      selectedPilgrims,
      pageDetected,
    );

    const evaluation = bookingReadiness.diagnostics?.evaluation ?? ReadinessEngine.evaluate(
      activeProfile,
      serviceType,
      effectiveServiceId,
      selectedPilgrims,
    );

    // 2. TTD Connection check
    checks.push({
      id: 'ttd-page',
      label: 'TTD Portal Connection',
      passed: pageDetected,
      severity: 'error',
      message: pageDetected
        ? 'Official TTD portal connected'
        : 'Open the official TTD booking page',
    });

    // 3. Profile selection check
    const hasProfile = Boolean(activeProfile);
    checks.push({
      id: 'profile-selected',
      label: 'Profile',
      passed: hasProfile,
      severity: 'error',
      message: activeProfile
        ? `Profile complete (${activeProfile.name})`
        : 'Profile needs attention',
    });

    // 4. Pilgrim selection check
    const pilgrimCount = selectedPilgrims.length;
    const hasPilgrims = pilgrimCount > 0;
    checks.push({
      id: 'pilgrims-selected',
      label: 'Pilgrims',
      passed: hasPilgrims,
      severity: 'error',
      message: hasPilgrims
        ? `Pilgrim selected (${pilgrimCount})`
        : 'Select pilgrims',
    });

    // 5. Required Pilgrim Details check
    const allPilgrimsReady = evaluation.isProfileReady;
    checks.push({
      id: 'required-details',
      label: 'Required Pilgrim Details',
      passed: allPilgrimsReady,
      severity: 'error',
      message: allPilgrimsReady
        ? 'Required pilgrim details verified'
        : `${evaluation.pilgrimCount - evaluation.readyPilgrimsCount} detail(s) need attention`,
    });

    // 6. General Details / Address check
    const generalOrAddrCheck = evaluation.checks.find(
      c => c.id === 'general_details' || c.id === 'srivari_address',
    );
    const hasValidContact = generalOrAddrCheck
      ? generalOrAddrCheck.status === 'ready'
      : true;

    if (generalOrAddrCheck) {
      checks.push({
        id: 'general-details',
        label: generalOrAddrCheck.label,
        passed: generalOrAddrCheck.status === 'ready',
        severity: generalOrAddrCheck.status === 'error' ? 'error' : 'warning',
        message: generalOrAddrCheck.message,
      });
    }

    // 7. Form scan status
    const formMapped = Boolean(
      scanResult && scanResult.mappedFields && scanResult.mappedFields.length > 0,
    );
    checks.push({
      id: 'form-detected',
      label: 'Pilgrim Form Detected',
      passed: formMapped,
      severity: 'info',
      message: formMapped
        ? `${scanResult?.mappedFields.length} fields detected on page`
        : 'Form will be auto-detected on Fill & Verify',
    });

    const hasInvalidAadhaar = evaluation.missingFields.some(f =>
      f.toLowerCase().includes('aadhaar'),
    );
    const hasInvalidMobile = evaluation.missingFields.some(f =>
      f.toLowerCase().includes('mobile'),
    );

    const isReady =
      pageDetected &&
      hasProfile &&
      hasPilgrims &&
      evaluation.isBookingReady;

    return {
      bookingReadiness,
      status: bookingReadiness.status,
      headline: bookingReadiness.headline,
      userAction: bookingReadiness.userAction,
      canFill: bookingReadiness.canFill,

      score: evaluation.score,
      isReady,
      allPilgrimsReady,
      hasValidGeneralContact: hasValidContact,
      checks,
      missingDetails: evaluation.missingFields,
      totalPilgrims: pilgrimCount,
      readyPilgrims: evaluation.readyPilgrimsCount,
      hasInvalidAadhaar,
      hasInvalidMobile,
      recommendations: evaluation.recommendations,
    };
  }, [activeProfile, selectedPilgrims, serviceType, pageDetected, scanResult, serviceId]);
}
