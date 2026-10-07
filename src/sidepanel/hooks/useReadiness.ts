import { useMemo } from 'react';
import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim, ScanResult } from '@shared/types';
import { ReadinessEngine } from '../../services/readiness-engine';

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface UseReadinessResult {
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
 * Unified Readiness Hook.
 * Delegates directly to the authoritative ServiceReadinessEngine
 * ensuring SED, SPAT, Homam, and Srivari Seva enforce exactly identical
 * requirements across Home, Profiles, and Autofill.
 */
export function useReadiness(
  activeProfile: Profile | null,
  selectedPilgrims: Pilgrim[],
  serviceType: ServiceType = ServiceType.DARSHAN,
  pageDetected: boolean = false,
  scanResult: ScanResult | null = null,
  serviceId?: string,
): UseReadinessResult {
  return useMemo(() => {
    const checks: ReadinessCheck[] = [];
    const effectiveServiceId =
      serviceId ||
      scanResult?.serviceId ||
      (serviceType !== ServiceType.DARSHAN && serviceType !== ServiceType.GENERIC
        ? serviceType
        : undefined);

    // Evaluate against the authoritative ServiceReadinessEngine
    const evaluation = ReadinessEngine.evaluate(
      activeProfile,
      serviceType,
      effectiveServiceId,
      selectedPilgrims,
    );

    // 1. TTD Connection check
    checks.push({
      id: 'ttd-page',
      label: 'TTD Portal Connection',
      passed: pageDetected,
      severity: 'error',
      message: pageDetected
        ? 'Official TTD portal connected'
        : 'Open the official TTD booking page',
    });

    // 2. Profile selection check
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

    // 3. Pilgrim selection check
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

    // 4. Required Pilgrim Details check (from engine)
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

    // 5. General Details / Address check
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

    // 6. Form scan status
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
