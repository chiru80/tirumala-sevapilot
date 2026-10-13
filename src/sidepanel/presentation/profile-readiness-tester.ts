/**
 * Tirumala SevaPilot — Profile Readiness Tester (Phase 13)
 * Pure, service-aware pre-booking validator based strictly on
 * CanonicalServiceRegistry and ReadinessEngine.
 * Never invents user data; never duplicates service rules.
 */

import type { Profile, Pilgrim } from '@shared/types';
import { getCanonicalService, CANONICAL_SPECIAL_ENTRY_300 } from '../../services/canonical-service-registry';
import { validateAadhaar } from '../../validation/aadhaar';
import { t } from '@i18n/index';

export interface ReadinessItemCheck {
  id: string;
  category: 'pilgrim' | 'id' | 'general' | 'special';
  label: string;
  passed: boolean;
  message?: string;
}

export interface ProfileReadinessReport {
  serviceId: string;
  serviceName: string;
  ticketPrice?: number;
  isReady: boolean;
  totalChecks: number;
  passedChecks: number;
  headline: string;
  summary: string;
  checklist: ReadinessItemCheck[];
  missingItems: string[];
  pilgrimCountSummary: {
    min: number;
    max: number;
    exact?: number;
    selected: number;
    isValidCount: boolean;
  };
}

export function testProfileReadiness(
  profile: Profile | null,
  selectedPilgrims: Pilgrim[],
  serviceId = 'special-entry-darshan-300'
): ProfileReadinessReport {
  const service = getCanonicalService(serviceId) || CANONICAL_SPECIAL_ENTRY_300;
  const checklist: ReadinessItemCheck[] = [];
  const missingItems: string[] = [];

  const minPilgrims = service.minPilgrims || 1;
  const maxPilgrims = service.maxPilgrims || 6;
  const exactPilgrims = service.exactPilgrims;
  const selectedCount = selectedPilgrims.length;

  const isValidPilgrimCount = exactPilgrims
    ? selectedCount === exactPilgrims
    : selectedCount >= minPilgrims && selectedCount <= maxPilgrims;

  // 1. Pilgrim count validation
  checklist.push({
    id: 'pilgrim-count',
    category: 'pilgrim',
    label: exactPilgrims
      ? (t('readiness.exactPilgrims', { count: exactPilgrims }) || `Exactly ${exactPilgrims} pilgrims required`)
      : (t('readiness.pilgrimRange', { min: minPilgrims, max: maxPilgrims }) || `${minPilgrims} to ${maxPilgrims} pilgrims`),
    passed: isValidPilgrimCount,
    message: isValidPilgrimCount
      ? undefined
      : exactPilgrims
      ? (t('readiness.mustSelectExact', { count: exactPilgrims }) || `Please select exactly ${exactPilgrims} pilgrims`)
      : (t('readiness.selectAtLeastOne') || 'Please select at least 1 pilgrim'),
  });
  if (!isValidPilgrimCount) {
    missingItems.push(exactPilgrims ? `Exactly ${exactPilgrims} pilgrims needed` : 'Pilgrim selection');
  }

  // 2. Pilgrim details (Name, Age, Gender)
  const allPilgrimsHaveDetails =
    selectedCount > 0 &&
    selectedPilgrims.every((p) => {
      const name = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
      const hasName = Boolean(name && name.length >= 2);
      const hasAge = typeof p.age === 'number' && p.age > 0 && p.age <= 120;
      const hasGender = Boolean(p.gender);
      return hasName && hasAge && hasGender;
    });

  checklist.push({
    id: 'pilgrim-details',
    category: 'pilgrim',
    label: t('readiness.pilgrimDetails') || 'Pilgrim details (Name, Age, Gender)',
    passed: allPilgrimsHaveDetails,
    message: allPilgrimsHaveDetails
      ? undefined
      : (t('readiness.missingPilgrimInfo') || 'One or more pilgrims are missing Name, Age, or Gender'),
  });
  if (!allPilgrimsHaveDetails) {
    missingItems.push(t('readiness.pilgrimDetails') || 'Pilgrim details');
  }

  // 3. ID Details (Type, Number, Validity)
  const allPilgrimsHaveValidId =
    selectedCount > 0 &&
    selectedPilgrims.every((p) => {
      if (!p.idType || !p.idNumber) return false;
      const num = p.idNumber.trim();
      if (p.idType.toUpperCase() === 'AADHAAR') {
        return validateAadhaar(num).valid;
      }
      return num.length >= 4;
    });

  checklist.push({
    id: 'id-details',
    category: 'id',
    label: t('readiness.idDetails') || 'Photo ID details (Aadhaar/Voter ID/Passport)',
    passed: allPilgrimsHaveValidId,
    message: allPilgrimsHaveValidId
      ? undefined
      : (t('readiness.invalidIdProof') || 'Valid Photo ID type and number required for all pilgrims'),
  });
  if (!allPilgrimsHaveValidId) {
    missingItems.push(t('readiness.idDetails') || 'Photo ID details');
  }

  // 4. General Details Step (Address, Email, Pincode) — ONLY if required by this service!
  if (service.hasGeneralDetailsStep) {
    const general = profile?.general;
    const hasEmail = Boolean(general?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(general.email));
    const hasAddress = Boolean(general?.city && general?.state);
    const hasPincode = Boolean(general?.pinCode && /^\d{6}$/.test(general.pinCode.trim()));

    checklist.push({
      id: 'general-email',
      category: 'general',
      label: t('readiness.contactEmail') || 'Contact email address',
      passed: hasEmail,
      message: hasEmail ? undefined : (t('readiness.emailMissing') || 'Valid email required for booking tickets'),
    });
    if (!hasEmail) missingItems.push(t('readiness.email') || 'Email');

    checklist.push({
      id: 'general-address',
      category: 'general',
      label: t('readiness.addressCityState') || 'Address (City & State)',
      passed: hasAddress,
      message: hasAddress ? undefined : (t('readiness.addressMissing') || 'City and State required in General Details'),
    });
    if (!hasAddress) missingItems.push(t('readiness.cityState') || 'City & State');

    checklist.push({
      id: 'general-pincode',
      category: 'general',
      label: t('readiness.pincode') || '6-digit Pincode',
      passed: hasPincode,
      message: hasPincode ? undefined : (t('readiness.pincodeMissing') || 'Pincode is missing or invalid'),
    });
    if (!hasPincode) missingItems.push(t('readiness.pincode') || 'Pincode');
  }

  // 5. Special Service Requirements (e.g. Gothram for Homam)
  if (service.fieldRules.generalFields?.gothram === 'REQUIRED') {
    const gothram = profile?.general?.gothram || profile?.gothram;
    const hasGothram = Boolean(gothram && gothram.trim().length >= 2);
    checklist.push({
      id: 'special-gothram',
      category: 'special',
      label: t('readiness.gothram') || 'Gothram (Mandatory for Homam)',
      passed: hasGothram,
      message: hasGothram ? undefined : (t('readiness.gothramMissing') || 'Gothram is required for Homam sankalpam'),
    });
    if (!hasGothram) missingItems.push(t('readiness.gothram') || 'Gothram');
  }

  // Calculate totals
  const totalChecks = checklist.length;
  const passedChecks = checklist.filter((c) => c.passed).length;
  const isReady = passedChecks === totalChecks;

  return {
    serviceId: service.serviceId,
    serviceName: service.displayName,
    ticketPrice: service.ticketPrice,
    isReady,
    totalChecks,
    passedChecks,
    headline: isReady
      ? (t('readiness.readyForBooking') || 'Ready for Booking')
      : (t('readiness.actionRequired') || 'Action Required'),
    summary: isReady
      ? (t('readiness.allItemsReady', { passed: passedChecks, total: totalChecks }) || `${passedChecks}/${totalChecks} required items ready`)
      : missingItems.length === 1
      ? (t('readiness.singleItemMissing', { item: missingItems[0] }) || `⚠️ ${missingItems[0]} is missing`)
      : (t('readiness.multipleItemsMissing', { count: missingItems.length, item: missingItems[0] }) || `⚠️ ${missingItems[0]} and ${missingItems.length - 1} more item(s) needed`),
    checklist,
    missingItems,
    pilgrimCountSummary: {
      min: minPilgrims,
      max: maxPilgrims,
      exact: exactPilgrims,
      selected: selectedCount,
      isValidCount: isValidPilgrimCount,
    },
  };
}
