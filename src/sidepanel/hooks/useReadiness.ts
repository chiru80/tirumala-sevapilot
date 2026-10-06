import { useMemo } from 'react';
import { ServiceType } from '@shared/types';
import type { Profile, Pilgrim, ScanResult } from '@shared/types';
import { calculateProfileHealth } from '../../services/profile-health';
import { getWorkflowById } from '../../services/workflows/registry';

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
    const missingDetails: string[] = [];
    const recommendations: string[] = [];

    const workflow = serviceId ? getWorkflowById(serviceId) : getWorkflowById(serviceType as string);
    const requiresGeneralContact = workflow ? workflow.hasGeneralDetailsStep : true;

    // 1. TTD Connection check
    checks.push({
      id: 'ttd-page',
      label: 'TTD Portal Connection',
      passed: pageDetected,
      severity: 'error',
      message: pageDetected ? 'Official TTD portal connected' : 'Please open ttdevasthanams.ap.gov.in',
    });

    // 2. Profile selection check
    const hasProfile = Boolean(activeProfile);
    checks.push({
      id: 'profile-selected',
      label: 'Profile',
      passed: hasProfile,
      severity: 'error',
      message: activeProfile ? `Profile: Complete (${activeProfile.name})` : 'No profile selected',
    });

    // 3. Pilgrim selection & health check
    const pilgrimCount = selectedPilgrims.length;
    const hasPilgrims = pilgrimCount > 0;
    const health = calculateProfileHealth(selectedPilgrims);

    checks.push({
      id: 'pilgrims-selected',
      label: 'Pilgrims',
      passed: hasPilgrims,
      severity: 'error',
      message: hasPilgrims ? `${pilgrimCount} selected` : 'No devotees selected for booking',
    });

    // Detail completeness checks (only 5 core identity fields required for devotees)
    let hasInvalidAadhaar = false;
    let hasInvalidMobile = false;

    for (const p of selectedPilgrims) {
      if (p.idType === 'Aadhaar' && p.idNumber && p.idNumber.replace(/\D/g, '').length !== 12) {
        hasInvalidAadhaar = true;
      }
      // Individual devotee mobile is OPTIONAL, but if provided, validate 10 digits format
      if (p.mobile && p.mobile.trim()) {
        const mob = p.mobile.replace(/\D/g, '');
        if (mob.length !== 10) {
          hasInvalidMobile = true;
        }
      }
    }

    const allPilgrimsReady = hasPilgrims && health.ready === pilgrimCount;
    checks.push({
      id: 'required-details',
      label: 'Devotee Required Details',
      passed: allPilgrimsReady,
      severity: 'error',
      message: allPilgrimsReady
        ? 'All required devotee details verified'
        : `${health.incomplete} devotee(s) require additional details`,
    });

    // General Details / Booking Contact check — service-aware
    // For Homam: gothram + email + address are required, mobile is NOT part of Homam workflow
    // For SED-300: address + mobile
    // For Padmavathi: no General Details at all
    const generalStep = workflow?.steps?.find(s => s.stepType === 'GENERAL_DETAILS');
    const generalRequiredFields = generalStep?.requiredFields || [];
    const requiresGothram = generalRequiredFields.includes('gothram');
    const requiresEmail = generalRequiredFields.includes('email');
    const requiresMobile = generalStep ? generalRequiredFields.includes('mobile') : true;
    const requiresCity = generalRequiredFields.length > 0 ? generalRequiredFields.includes('city') : true;
    const requiresState = generalRequiredFields.length > 0 ? generalRequiredFields.includes('state') : true;
    const requiresCountry = generalRequiredFields.length > 0 ? generalRequiredFields.includes('country') : true;
    const requiresPinCode = generalRequiredFields.length > 0 ? (generalRequiredFields.includes('pinCode') || generalRequiredFields.includes('pincode')) : true;

    const generalMobile = (activeProfile?.general?.mobile || '').replace(/\D/g, '');
    const generalGothram = (activeProfile?.general?.gothram || '').trim();
    const generalEmail = (activeProfile?.general?.email || '').trim();

    let generalReady = true;
    const generalMissing: string[] = [];

    if (!requiresGeneralContact) {
      // Service has no General Details step — automatically satisfied
    } else {
      // Mobile check — only if explicitly required by the workflow/step!
      if (requiresMobile) {
        if (!generalMobile || generalMobile.length !== 10) {
          generalReady = false;
          generalMissing.push('mobile');
        }
      }
      // Gothram check (service-specific, e.g. Homam)
      if (requiresGothram && !generalGothram) {
        generalReady = false;
        generalMissing.push('gothram');
      }
      // Email check (service-specific, e.g. Homam)
      if (requiresEmail && !generalEmail) {
        generalReady = false;
        generalMissing.push('email');
      }
      // City check
      if (requiresCity && !(activeProfile?.general?.city || '').trim()) {
        generalReady = false;
        generalMissing.push('city');
      }
      // State check
      if (requiresState && !(activeProfile?.general?.state || '').trim()) {
        generalReady = false;
        generalMissing.push('state');
      }
      // Country check
      if (requiresCountry && !(activeProfile?.general?.country || '').trim()) {
        generalReady = false;
        generalMissing.push('country');
      }
      // PIN code check
      if (requiresPinCode && !(activeProfile?.general?.pinCode || (activeProfile?.general as any)?.pincode || '').trim()) {
        generalReady = false;
        generalMissing.push('pincode');
      }
    }

    const hasValidContact = requiresGeneralContact ? generalReady : true;

    // Exact pilgrim count enforcement (e.g. exactly 2 persons for Homam)
    const exactPilgrims = workflow?.exactPilgrims;
    const exactPilgrimPassed = !exactPilgrims || pilgrimCount === exactPilgrims;
    if (exactPilgrims && pilgrimCount !== exactPilgrims) {
      checks.push({
        id: 'exact-pilgrim-count',
        label: 'Pilgrim Limit',
        passed: false,
        severity: 'error',
        message: `Maximum 2 persons per booking (selected: ${pilgrimCount})`,
      });
      missingDetails.push(`Maximum 2 persons per booking required for ${workflow.serviceName}`);
    }

    checks.push({
      id: 'general-details',
      label: 'General Details',
      passed: hasValidContact,
      severity: requiresGeneralContact ? 'warning' : 'info',
      message: !requiresGeneralContact
        ? 'Not required for this service'
        : hasValidContact
        ? `All general details ready${requiresGothram ? ' (incl. Gothram)' : ''}`
        : `Missing: ${generalMissing.join(', ')}`,
    });

    // Form scanned status
    const formMapped = Boolean(scanResult && scanResult.mappedFields && scanResult.mappedFields.length > 0);
    checks.push({
      id: 'form-detected',
      label: 'Pilgrim Form Detected',
      passed: formMapped,
      severity: 'info',
      message: formMapped
        ? `${scanResult?.mappedFields.length} fields detected on page`
        : 'Form will be auto-detected on Fill & Verify',
    });

    // Calculate overall score (0 to 100)
    let score = 0;
    if (pageDetected) score += 20;
    if (hasProfile) score += 15;
    if (hasPilgrims) score += 15;
    if (hasPilgrims && pilgrimCount > 0) {
      score += Math.round((health.ready / pilgrimCount) * 35);
    }
    if (hasValidContact) score += 15;
    if (!exactPilgrimPassed) {
      score = Math.min(score, 85);
    }

    // Collect missing details strings for quick reporting
    if (!pageDetected) missingDetails.push('Open TTD Booking page');
    if (!hasProfile) missingDetails.push('Select or create a Profile');
    if (!hasPilgrims) missingDetails.push('Select at least 1 devotee');
    if (health.missingByField['fullName']) missingDetails.push(`Name missing (${health.missingByField['fullName']})`);
    if (health.missingByField['idNumber'] || hasInvalidAadhaar) missingDetails.push('ID Number needs attention');
    if (hasInvalidMobile) missingDetails.push('Devotee mobile format invalid (10 digits)');
    if (requiresGeneralContact && !hasValidContact) {
      if (generalMissing.length > 0) {
        missingDetails.push(`General Details: ${generalMissing.join(', ')} required`);
      } else {
        missingDetails.push('General Details incomplete');
      }
    }

    const isReady = pageDetected && hasProfile && hasPilgrims && allPilgrimsReady && hasValidContact && exactPilgrimPassed;

    return {
      score: Math.min(score, 100),
      isReady,
      allPilgrimsReady,
      hasValidGeneralContact: hasValidContact,
      checks,
      missingDetails,
      totalPilgrims: pilgrimCount,
      readyPilgrims: health.ready,
      hasInvalidAadhaar,
      hasInvalidMobile,
      recommendations,
    };
  }, [activeProfile, selectedPilgrims, serviceType, pageDetected, scanResult, serviceId]);
}
