/**
 * Tirumala SevaPilot — Profile Readiness Tester (Phase 13 / 14A)
 * Pure, service-aware pre-booking validator based strictly on
 * CanonicalServiceRegistry and ReadinessEngine.
 * Never invents user data; never duplicates service rules.
 * Fails closed on unknown services; validates full ID requirements.
 */

import type { Profile, Pilgrim } from '@shared/types';
import { getCanonicalService, SAFE_CANONICAL_UNKNOWN_SERVICE } from '../../services/canonical-service-registry';
import { validateIdProof } from '../../validation/id-proof';
import { t } from '@i18n/index';

export interface ReadinessItemCheck {
  id: string;
  category: 'pilgrim' | 'id' | 'general' | 'special';
  label: string;
  passed: boolean;
  message?: string;
}

export interface PilgrimValidationItem {
  pilgrimId: string;
  pilgrimIndex: number;
  name: string;
  age?: number;
  gender?: string;
  idType?: string;
  idNumberMasked?: string;
  isValid: boolean;
  errors: string[];
}

export interface ProfileReadinessReport {
  serviceId: string;
  serviceName: string;
  ticketPrice?: number;
  isReady: boolean;
  isUnknownService?: boolean;
  totalChecks: number;
  passedChecks: number;
  headline: string;
  summary: string;
  checklist: ReadinessItemCheck[];
  missingItems: string[];
  pilgrimValidationItems: PilgrimValidationItem[];
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
  const canonical = getCanonicalService(serviceId);
  const isUnknownService = !canonical;
  const service = canonical || SAFE_CANONICAL_UNKNOWN_SERVICE;
  const checklist: ReadinessItemCheck[] = [];
  const missingItems: string[] = [];

  // 0. Unknown service fail-closed check
  if (isUnknownService) {
    checklist.push({
      id: 'unknown-service-requirements',
      category: 'special',
      label: t('readiness.serviceRequirementsUnavailable') || 'Service Requirements Unavailable',
      passed: false,
      message:
        t('readiness.unknownServiceDesc') ||
        'Service requirements cannot be determined for unknown service ID. Select or navigate to a recognized TTD service.',
    });
    missingItems.push(t('readiness.serviceRequirementsUnavailable') || 'Service requirements unavailable');
  }

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

  // 2. Per-Pilgrim Validation items with actionable errors
  const isSrivariSeva = service.serviceId === 'srivari-seva';

  const pilgrimValidationItems: PilgrimValidationItem[] = selectedPilgrims.map((p, idx) => {
    const errors: string[] = [];
    const name = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim();
    if (!name || name.length < 2) {
      errors.push(t('readiness.errNameRequired') || 'Full name is required (at least 2 characters)');
    }

    if (typeof p.age !== 'number' || p.age < 1 || p.age > 120) {
      errors.push(t('readiness.errAgeRange') || 'Age must be between 1 and 120');
    } else if (isSrivariSeva && (p.age < 18 || p.age > 60)) {
      errors.push(t('readiness.errSrivariAgeRange') || 'Srivari Seva requires age between 18 and 60 years');
    }

    if (!p.gender) {
      errors.push(t('readiness.errGenderRequired') || 'Gender selection is required');
    }
    if (!p.idType) {
      errors.push(t('readiness.errIdTypeRequired') || 'Photo ID type is required');
    }
    if (!p.idNumber || p.idNumber.trim().length === 0) {
      errors.push(t('readiness.errIdNumberRequired') || 'Photo ID number is required');
    } else {
      const num = p.idNumber.trim();
      const idResult = validateIdProof(p.idType, num);
      if (!idResult.valid) {
        errors.push(idResult.error || t('readiness.invalidIdProof') || 'Invalid Photo ID number');
      }
    }

    if (service.specialRequirements?.photo && !p.photo) {
      errors.push(t('readiness.errPhotoRequired') || 'Recent photo upload is required for this service');
    }

    const masked = p.idNumber ? ('•••• ' + p.idNumber.trim().slice(-4)) : '—';

    return {
      pilgrimId: p.id,
      pilgrimIndex: idx,
      name: name || `Pilgrim ${idx + 1}`,
      age: p.age,
      gender: p.gender,
      idType: p.idType,
      idNumberMasked: masked,
      isValid: errors.length === 0,
      errors,
    };
  });

  // 3. Pilgrim details overall check (Name, Age, Gender)
  const allPilgrimsHaveDetails =
    selectedCount > 0 &&
    pilgrimValidationItems.every(
      (item) => !item.errors.some((e) => e.includes('name') || e.includes('Age') || e.includes('Gender'))
    );

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

  // 4. ID Details (Type, Number, Validity)
  const allPilgrimsHaveValidId =
    selectedCount > 0 &&
    pilgrimValidationItems.every(
      (item) => !item.errors.some((e) => e.includes('ID') || e.includes('Aadhaar') || e.includes('Passport') || e.includes('PAN'))
    );

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

  // 5. General Details Step (Address, Email, Pincode) — ONLY if required by this canonical service!
  if (service.hasGeneralDetailsStep && !isUnknownService) {
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

  // 6. Special Service Requirements (e.g. Gothram for Homam)
  if (!isUnknownService && service.fieldRules.generalFields?.gothram === 'REQUIRED') {
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
  // Unknown service FAILS CLOSED: isReady is strictly false
  const isReady =
    !isUnknownService &&
    passedChecks === totalChecks &&
    (selectedCount > 0 ? pilgrimValidationItems.every((p) => p.isValid) : false);

  const headline = isUnknownService
    ? (t('readiness.requirementsUnavailable') || 'Requirements Unavailable')
    : isReady
    ? (t('readiness.readyForBooking') || 'Ready for Booking')
    : (t('readiness.actionRequired') || 'Action Required');

  const summary = isUnknownService
    ? (t('readiness.unknownServiceSummary') || 'Service requirements cannot be determined for this service. Please select a recognized service.')
    : isReady
    ? (t('readiness.allItemsReady', { passed: passedChecks, total: totalChecks }) || `${passedChecks}/${totalChecks} required items ready`)
    : missingItems.length === 1
    ? (t('readiness.singleItemMissing', { item: missingItems[0] }) || `⚠️ ${missingItems[0]} is missing`)
    : (t('readiness.multipleItemsMissing', { count: missingItems.length - 1, item: missingItems[0] }) || `⚠️ ${missingItems[0]} and ${missingItems.length - 1} more item(s) needed`);

  return {
    serviceId: isUnknownService ? serviceId : service.serviceId,
    serviceName: isUnknownService ? (t('readiness.unknownServiceName') || 'TTD Portal Service (Unspecified)') : service.displayName,
    ticketPrice: isUnknownService ? undefined : service.ticketPrice,
    isReady,
    isUnknownService,
    totalChecks,
    passedChecks,
    headline,
    summary,
    checklist,
    missingItems,
    pilgrimValidationItems,
    pilgrimCountSummary: {
      min: minPilgrims,
      max: maxPilgrims,
      exact: exactPilgrims,
      selected: selectedCount,
      isValidCount: isValidPilgrimCount,
    },
  };
}
