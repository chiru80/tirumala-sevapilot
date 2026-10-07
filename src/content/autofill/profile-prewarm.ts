// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Profile Prewarming (Phase 3)
// Precomputes normalized, immutable booking payloads for
// pilgrims and general contact details. Caches the result
// to eliminate repeated string normalization and object allocations.
// ─────────────────────────────────────────────────

import type { Pilgrim, Profile } from '@shared/types';
import { resolveGeneralDetails, getEffectiveAge } from '@shared/utils';
import { getCanonicalService } from '../../services/canonical-service-registry';

export interface PrewarmedPilgrimData {
  index: number;
  originalId: string;
  fullName: string;
  age: number | undefined;
  ageStr: string;
  gender: string;
  idType: string;
  idNumber: string;
  sanitizedIdNumber: string;
  mobile?: string;
  email?: string;
  dateOfBirth?: string;
}

export interface PrewarmedGeneralData {
  gothram: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
}

export interface PrewarmedBookingPlan {
  cacheKey: string;
  timestamp: number;
  serviceId?: string;
  pilgrims: PrewarmedPilgrimData[];
  general: PrewarmedGeneralData;
  targetCount: number;
  hasGeneralDetailsStep: boolean;
}

// Bounded in-memory cache
const prewarmCache = new Map<string, PrewarmedBookingPlan>();
const MAX_CACHE_ENTRIES = 10;

function computeCacheKey(profile: Profile, targetPilgrims: Pilgrim[], serviceId?: string): string {
  const pilgrimSignature = targetPilgrims.map(p => `${p.id}:${p.updatedAt || ''}`).join('|');
  return `${profile.id}:${profile.updatedAt || ''}:${serviceId || 'default'}:${pilgrimSignature}`;
}

export function prewarmBookingProfile(
  profile: Profile,
  pilgrims?: Pilgrim[],
  serviceId?: string,
): PrewarmedBookingPlan {
  const canonical = serviceId ? getCanonicalService(serviceId) : undefined;
  const maxAllowed = canonical?.maxPilgrims ?? 6;
  const targetPilgrims = (pilgrims ?? profile.pilgrims ?? []).slice(0, maxAllowed);

  const cacheKey = computeCacheKey(profile, targetPilgrims, serviceId);
  const existing = prewarmCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  // Normalize pilgrims
  const prewarmedPilgrims: PrewarmedPilgrimData[] = targetPilgrims.map((p, idx) => {
    const rawName = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim();
    const effectiveAge = getEffectiveAge(p);
    const ageStr = effectiveAge !== undefined ? String(effectiveAge) : '';
    const rawGender = p.gender || '';
    const rawIdType = p.idType || '';
    const rawIdNumber = (p.idNumber || '').trim();

    return {
      index: idx,
      originalId: p.id,
      fullName: rawName,
      age: effectiveAge,
      ageStr,
      gender: rawGender,
      idType: rawIdType,
      idNumber: rawIdNumber,
      sanitizedIdNumber: rawIdNumber,
      mobile: p.mobile?.trim(),
      email: p.email?.trim(),
      dateOfBirth: p.dateOfBirth?.trim(),
    };
  });

  // Normalize general details
  const genDetails = resolveGeneralDetails(profile);
  const prewarmedGeneral: PrewarmedGeneralData = {
    gothram: genDetails.gothram,
    email: genDetails.email,
    mobile: genDetails.mobile,
    city: genDetails.city,
    state: genDetails.state,
    country: genDetails.country || '',
    pinCode: genDetails.pinCode,
  };

  const plan: PrewarmedBookingPlan = {
    cacheKey,
    timestamp: Date.now(),
    serviceId,
    pilgrims: prewarmedPilgrims,
    general: prewarmedGeneral,
    targetCount: prewarmedPilgrims.length,
    hasGeneralDetailsStep: canonical ? canonical.hasGeneralDetailsStep : true,
  };

  // Manage cache capacity
  if (prewarmCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = prewarmCache.keys().next().value;
    if (oldestKey) prewarmCache.delete(oldestKey);
  }
  prewarmCache.set(cacheKey, plan);

  return plan;
}

export function invalidatePrewarmCache(): void {
  prewarmCache.clear();
}
export const clearPrewarmCache = invalidatePrewarmCache;
