// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Storage Repository
// Type-safe CRUD for profiles, pilgrims, settings
// ─────────────────────────────────────────────────

import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_PROFILES, MAX_PILGRIMS_PER_PROFILE } from '@shared/constants';
import { generateId, now, deepClone } from '@shared/utils';
import logger from '@shared/logger';
import { Gender, IdType } from '@shared/types';
import type { Profile, Pilgrim, Settings, NotificationItem, SessionHistoryItem, GeneralDetails } from '@shared/types';

// ─── Profiles ───

/** Get all profiles from storage */
export async function getProfiles(): Promise<Profile[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
  const raw = (result[STORAGE_KEYS.PROFILES] as Profile[] | undefined) ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Profile => p != null && typeof p === 'object')
    .map(p => ({
      ...p,
      pilgrims: Array.isArray(p.pilgrims) ? p.pilgrims : [],
      selectedPilgrims: p.selectedPilgrims || {},
    }));
}

/** Get a single profile by ID */
export async function getProfile(id: string): Promise<Profile | null> {
  const profiles = await getProfiles();
  return profiles.find(p => p.id === id) ?? null;
}

/**
 * Lightweight sequential write queue to serialize storage mutations
 * and prevent lost updates during concurrent profile/pilgrim/settings changes.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

export function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.catch(() => {});
  return next;
}

/** Save a new profile */
export async function createProfile(
  name: string,
  description?: string,
  defaultService?: string,
): Promise<Profile> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();

    if (profiles.length >= MAX_PROFILES) {
      throw new Error(`Maximum ${MAX_PROFILES} profiles allowed`);
    }

    const profile: Profile = {
      id: generateId(),
      name,
      description,
      defaultService,
      pilgrims: [],
      selectedPilgrims: {},
      isDefault: profiles.length === 0, // First profile is default
      createdAt: now(),
      updatedAt: now(),
    };

    profiles.push(profile);
    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`Profile created: ${name}`);
    return profile;
  });
}

/** Update an existing profile */
export async function updateProfile(
  id: string,
  updates: Partial<Omit<Profile, 'id' | 'createdAt'>>,
): Promise<Profile> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const index = profiles.findIndex(p => p.id === id);

    if (index === -1) throw new Error('Profile not found');

    profiles[index] = {
      ...profiles[index],
      ...updates,
      updatedAt: now(),
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.debug(`Profile updated: ${id}`);
    return profiles[index];
  });
}

/** Update general details for a profile (Step 2 booking details: Email, City, State, Country, PIN code) */
export async function updateGeneralDetails(
  profileId: string,
  general: GeneralDetails,
): Promise<Profile> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index === -1) throw new Error('Profile not found');

    profiles[index] = {
      ...profiles[index],
      general: {
        ...profiles[index].general,
        ...general,
      },
      updatedAt: now(),
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`General details updated for profile: ${profileId}`);
    return profiles[index];
  });
}

/** Delete a profile */
export async function deleteProfile(id: string): Promise<void> {
  return enqueueWrite(async () => {
    let profiles = await getProfiles();
    profiles = profiles.filter(p => p.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`Profile deleted: ${id}`);
  });
}

/** Set a profile as default */
export async function setDefaultProfile(id: string): Promise<void> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    for (const profile of profiles) {
      profile.isDefault = profile.id === id;
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
  });
}

/** Duplicate an existing profile with fresh IDs for profile and pilgrims */
export async function duplicateProfile(id: string): Promise<Profile> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const source = profiles.find(p => p.id === id);
    if (!source) throw new Error('Source profile not found');

    if (profiles.length >= MAX_PROFILES) {
      throw new Error(`Maximum ${MAX_PROFILES} profiles allowed`);
    }

    const idMap = new Map<string, string>();
    const clonedPilgrims: Pilgrim[] = source.pilgrims.map(p => {
      const newId = generateId();
      idMap.set(p.id, newId);
      return {
        ...deepClone(p),
        id: newId,
        createdAt: now(),
        updatedAt: now(),
      };
    });

    const clonedSelected: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(source.selectedPilgrims || {})) {
      clonedSelected[key] = ids.map(oldId => idMap.get(oldId) || oldId);
    }

    const newProfile: Profile = {
      id: generateId(),
      name: `${source.name} (Copy)`,
      description: source.description,
      pilgrims: clonedPilgrims,
      selectedPilgrims: clonedSelected,
      isDefault: false,
      createdAt: now(),
      updatedAt: now(),
    };

    profiles.push(newProfile);
    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`Profile duplicated: ${source.name} -> ${newProfile.name}`);
    return newProfile;
  });
}

// ─── Pilgrims ───

/** Add a pilgrim to a profile */
export async function addPilgrim(
  profileId: string,
  pilgrim: Omit<Pilgrim, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Pilgrim> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) throw new Error('Profile not found');
    if (profile.pilgrims.length >= MAX_PILGRIMS_PER_PROFILE) {
      throw new Error(`Maximum ${MAX_PILGRIMS_PER_PROFILE} pilgrims per profile`);
    }

    const newPilgrim: Pilgrim = {
      ...pilgrim,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };

    profile.pilgrims.push(newPilgrim);
    profile.updatedAt = now();

    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`Pilgrim added to profile ${profileId}`);
    return newPilgrim;
  });
}

/** Update a pilgrim within a profile */
export async function updatePilgrim(
  profileId: string,
  pilgrimId: string,
  updates: Partial<Omit<Pilgrim, 'id' | 'createdAt'>>,
): Promise<Pilgrim> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    const index = profile.pilgrims.findIndex(p => p.id === pilgrimId);
    if (index === -1) throw new Error('Pilgrim not found');

    profile.pilgrims[index] = {
      ...profile.pilgrims[index],
      ...updates,
      updatedAt: now(),
    };
    profile.updatedAt = now();

    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    return profile.pilgrims[index];
  });
}

/** Delete a pilgrim from a profile */
export async function deletePilgrim(
  profileId: string,
  pilgrimId: string,
): Promise<void> {
  return enqueueWrite(async () => {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    profile.pilgrims = profile.pilgrims.filter(p => p.id !== pilgrimId);

    // Also remove from selected pilgrims
    if (profile.selectedPilgrims) {
      for (const key of Object.keys(profile.selectedPilgrims)) {
        profile.selectedPilgrims[key] = profile.selectedPilgrims[key].filter(
          id => id !== pilgrimId,
        );
      }
    }

    profile.updatedAt = now();
    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    logger.info(`Pilgrim deleted from profile ${profileId}`);
  });
}

/** Duplicate a pilgrim within the same profile */
export async function duplicatePilgrim(
  profileId: string,
  pilgrimId: string,
): Promise<Pilgrim> {
  const profiles = await getProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) throw new Error('Profile not found');

  const source = profile.pilgrims.find(p => p.id === pilgrimId);
  if (!source) throw new Error('Pilgrim not found');

  const duplicate = deepClone(source);
  duplicate.id = generateId();
  duplicate.fullName = `${source.fullName} (Copy)`;
  duplicate.createdAt = now();
  duplicate.updatedAt = now();

  return addPilgrim(profileId, duplicate);
}

/** Reorder pilgrims within a profile */
export async function reorderPilgrims(
  profileId: string,
  pilgrimIds: string[],
): Promise<void> {
  const profiles = await getProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) throw new Error('Profile not found');

  const reordered: Pilgrim[] = [];
  for (const id of pilgrimIds) {
    const pilgrim = profile.pilgrims.find(p => p.id === id);
    if (pilgrim) reordered.push(pilgrim);
  }

  profile.pilgrims = reordered;
  profile.updatedAt = now();
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
}

/** Update selected pilgrims for a service */
export async function updateSelectedPilgrims(
  profileId: string,
  serviceKey: string,
  pilgrimIds: string[],
): Promise<void> {
  const profiles = await getProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) throw new Error('Profile not found');
  if (!profile.selectedPilgrims) {
    profile.selectedPilgrims = {};
  }
  profile.selectedPilgrims[serviceKey] = pilgrimIds;
  profile.updatedAt = now();
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
}

// ─── Settings ───

/** Get application settings */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
}

/** Save application settings */
export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  return enqueueWrite(async () => {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    logger.debug('Settings saved');
    return updated;
  });
}

// ─── Notifications ───

/** Get local notifications */
export async function getNotifications(): Promise<NotificationItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTIFICATIONS);
  return (result[STORAGE_KEYS.NOTIFICATIONS] as NotificationItem[] | undefined) ?? [];
}

/** Add a new notification (keeps up to 30 latest) */
export async function addNotification(notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> {
  const current = await getNotifications();
  const newItem: NotificationItem = {
    ...notification,
    id: generateId(),
    timestamp: now(),
    read: false,
  };
  const updated = [newItem, ...current].slice(0, 30);
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATIONS]: updated });
  return newItem;
}

/** Mark a notification as read */
export async function markNotificationRead(id: string): Promise<void> {
  const current = await getNotifications();
  const updated = current.map(n => (n.id === id ? { ...n, read: true } : n));
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATIONS]: updated });
}

/** Clear all notifications */
export async function clearNotifications(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATIONS]: [] });
}

// ─── Session History (Privacy-Safe: Zero PII) ───

/** Get session history */
export async function getSessionHistory(): Promise<SessionHistoryItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION_HISTORY);
  return (result[STORAGE_KEYS.SESSION_HISTORY] as SessionHistoryItem[] | undefined) ?? [];
}

/** Record a booking session (strictly no names or ID numbers) */
export async function recordSessionHistory(session: Omit<SessionHistoryItem, 'id' | 'timestamp'>): Promise<SessionHistoryItem> {
  const current = await getSessionHistory();
  const newItem: SessionHistoryItem = {
    ...session,
    id: generateId(),
    timestamp: now(),
  };
  // Store up to 25 recent sessions
  const updated = [newItem, ...current].slice(0, 25);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION_HISTORY]: updated });
  return newItem;
}

/** Clear session history */
export async function clearSessionHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION_HISTORY]: [] });
}

// ─── Data Import Safety ───

export interface ImportValidationResult {
  valid: boolean;
  profiles?: Profile[];
  error?: string;
  summary?: {
    profileCount: number;
    pilgrimCount: number;
  };
}

const VALID_GENDERS: Record<string, Gender> = {
  male: Gender.MALE,
  m: Gender.MALE,
  female: Gender.FEMALE,
  f: Gender.FEMALE,
  other: Gender.OTHER,
  o: Gender.OTHER,
  transgender: Gender.OTHER,
};

const VALID_ID_TYPES: Record<string, IdType> = {
  aadhaar: IdType.AADHAAR,
  aadhar: IdType.AADHAAR,
  passport: IdType.PASSPORT,
  'voter id': IdType.VOTER_ID,
  voter: IdType.VOTER_ID,
  voter_id: IdType.VOTER_ID,
  pan: IdType.PAN,
  'driving license': IdType.DRIVING_LICENSE,
  driving_license: IdType.DRIVING_LICENSE,
  dl: IdType.DRIVING_LICENSE,
  'ration card': IdType.RATION_CARD,
  ration_card: IdType.RATION_CARD,
};

function safeTimestamp(ts: unknown): string {
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return now();
}

/** Validate imported JSON payload against Profile schema with strict runtime hardening */
export function validateImportPayload(raw: unknown): ImportValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Imported content is not valid JSON.' };
  }

  let rawProfiles: unknown[] = [];
  if (Array.isArray(raw)) {
    rawProfiles = raw;
  } else if ('profiles' in (raw as Record<string, unknown>)) {
    const p = (raw as Record<string, unknown>).profiles;
    if (Array.isArray(p)) {
      rawProfiles = p;
    } else {
      return { valid: false, error: 'JSON profiles property must be an array.' };
    }
  } else {
    return { valid: false, error: 'JSON does not contain a recognized SevaPilot profile structure.' };
  }

  if (rawProfiles.length === 0) {
    return { valid: false, error: 'No profiles found in import file.' };
  }

  if (rawProfiles.length > MAX_PROFILES) {
    return { valid: false, error: `Import exceeds maximum allowed profiles limit (${MAX_PROFILES}).` };
  }

  const normalizedProfiles: Profile[] = [];
  let totalPilgrims = 0;

  for (const rawProfile of rawProfiles) {
    if (!rawProfile || typeof rawProfile !== 'object') {
      return { valid: false, error: 'Invalid profile object in import payload.' };
    }

    const p = rawProfile as Record<string, any>;
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
      return { valid: false, error: 'A profile is missing a required name.' };
    }

    if (!Array.isArray(p.pilgrims)) {
      return { valid: false, error: `Profile "${p.name}" has invalid pilgrims structure.` };
    }

    if (p.pilgrims.length > MAX_PILGRIMS_PER_PROFILE) {
      return { valid: false, error: `Profile "${p.name}" exceeds maximum allowed devotee limit (${MAX_PILGRIMS_PER_PROFILE}).` };
    }

    // Validate selected pilgrims
    const selectedPilgrims: Record<string, string[]> = {};
    if (p.selectedPilgrims && typeof p.selectedPilgrims === 'object' && !Array.isArray(p.selectedPilgrims)) {
      for (const [svc, ids] of Object.entries(p.selectedPilgrims)) {
        if (Array.isArray(ids)) {
          selectedPilgrims[svc] = ids.filter((id): id is string => typeof id === 'string');
        }
      }
    }

    // Validate general details
    let general: GeneralDetails | undefined = undefined;
    if (p.general && typeof p.general === 'object') {
      const g = p.general;
      let mobileVal = typeof g.mobile === 'string' ? g.mobile.trim() : undefined;
      if (mobileVal) {
        const cleaned = mobileVal.replace(/[\s-+]/g, '');
        const normMob = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) : cleaned;
        if (!/^[6-9]\d{9}$/.test(normMob)) {
          return { valid: false, error: `Invalid booking mobile number in profile "${p.name}".` };
        }
        mobileVal = normMob;
      }

      general = {
        mobile: mobileVal,
        email: typeof g.email === 'string' ? g.email.trim() : undefined,
        city: typeof g.city === 'string' ? g.city.trim() : undefined,
        state: typeof g.state === 'string' ? g.state.trim() : undefined,
        country: typeof g.country === 'string' ? g.country.trim() : 'India',
        pinCode: typeof g.pinCode === 'string' ? g.pinCode.trim() : undefined,
      };
    }

    const seenIds = new Set<string>();
    const normalizedPilgrims: Pilgrim[] = [];

    for (const rawPilgrim of p.pilgrims) {
      if (!rawPilgrim || typeof rawPilgrim !== 'object') {
        return { valid: false, error: `Invalid devotee record in profile "${p.name}".` };
      }

      const pilgrim = rawPilgrim as Record<string, any>;
      const fullName = typeof pilgrim.fullName === 'string' && pilgrim.fullName.trim()
        ? pilgrim.fullName.trim()
        : (typeof pilgrim.firstName === 'string' && pilgrim.firstName.trim()
            ? `${pilgrim.firstName.trim()} ${typeof pilgrim.lastName === 'string' ? pilgrim.lastName.trim() : ''}`.trim()
            : '');

      if (!fullName) {
        return { valid: false, error: `A devotee in profile "${p.name}" is missing a required name.` };
      }

      // Gender validation
      const gKey = typeof pilgrim.gender === 'string' ? pilgrim.gender.trim().toLowerCase() : '';
      const normGender = VALID_GENDERS[gKey];
      if (!normGender) {
        return { valid: false, error: `Devotee "${fullName}" in profile "${p.name}" has invalid or missing gender.` };
      }

      // ID Type validation
      const idKey = typeof pilgrim.idType === 'string' ? pilgrim.idType.trim().toLowerCase() : '';
      const normIdType = VALID_ID_TYPES[idKey];
      if (!normIdType) {
        return { valid: false, error: `Devotee "${fullName}" in profile "${p.name}" has invalid or missing ID proof type.` };
      }

      // Required ID number
      if (typeof pilgrim.idNumber !== 'string' || !pilgrim.idNumber.trim()) {
        return { valid: false, error: `Devotee "${fullName}" in profile "${p.name}" is missing required ID number.` };
      }
      const cleanIdNumber = pilgrim.idNumber.trim();

      // Deduplication within profile
      const idDedupKey = `${normIdType}:${cleanIdNumber.toUpperCase()}`;
      if (seenIds.has(idDedupKey)) {
        return { valid: false, error: `Duplicate ID number "${cleanIdNumber}" detected within profile "${p.name}".` };
      }
      seenIds.add(idDedupKey);

      // Mobile validation (optional for pilgrim)
      let pilgrimMobile: string | undefined = undefined;
      if (pilgrim.mobile && typeof pilgrim.mobile === 'string' && pilgrim.mobile.trim()) {
        const cleaned = pilgrim.mobile.trim().replace(/[\s-+]/g, '');
        const normMob = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) : cleaned;
        if (!/^[6-9]\d{9}$/.test(normMob)) {
          return { valid: false, error: `Invalid mobile number "${pilgrim.mobile}" for devotee "${fullName}" in profile "${p.name}".` };
        }
        pilgrimMobile = normMob;
      }

      // Age validation
      let pilgrimAge: number | undefined = undefined;
      if (pilgrim.age !== undefined && pilgrim.age !== null && pilgrim.age !== '') {
        const n = Number(pilgrim.age);
        if (isNaN(n) || n < 0 || n > 125) {
          return { valid: false, error: `Invalid age "${pilgrim.age}" for devotee "${fullName}".` };
        }
        pilgrimAge = Math.floor(n);
      }

      normalizedPilgrims.push({
        id: typeof pilgrim.id === 'string' && pilgrim.id ? pilgrim.id : generateId(),
        firstName: typeof pilgrim.firstName === 'string' && pilgrim.firstName.trim() ? pilgrim.firstName.trim() : fullName.split(' ')[0],
        middleName: typeof pilgrim.middleName === 'string' ? pilgrim.middleName.trim() : undefined,
        lastName: typeof pilgrim.lastName === 'string' && pilgrim.lastName.trim() ? pilgrim.lastName.trim() : (fullName.split(' ').slice(1).join(' ') || fullName),
        fullName,
        gender: normGender,
        idType: normIdType,
        idNumber: cleanIdNumber,
        dateOfBirth: typeof pilgrim.dateOfBirth === 'string' ? pilgrim.dateOfBirth.trim() : undefined,
        age: pilgrimAge,
        mobile: pilgrimMobile,
        email: typeof pilgrim.email === 'string' ? pilgrim.email.trim() : undefined,
        address: typeof pilgrim.address === 'string' ? pilgrim.address.trim() : undefined,
        city: typeof pilgrim.city === 'string' ? pilgrim.city.trim() : undefined,
        state: typeof pilgrim.state === 'string' ? pilgrim.state.trim() : undefined,
        country: typeof pilgrim.country === 'string' && pilgrim.country.trim() ? pilgrim.country.trim() : 'India',
        pinCode: typeof pilgrim.pinCode === 'string' ? pilgrim.pinCode.trim() : undefined,
        notes: typeof pilgrim.notes === 'string' ? pilgrim.notes.trim() : undefined,
        createdAt: safeTimestamp(pilgrim.createdAt),
        updatedAt: safeTimestamp(pilgrim.updatedAt),
      });
    }

    totalPilgrims += normalizedPilgrims.length;
    normalizedProfiles.push({
      id: typeof p.id === 'string' && p.id ? p.id : generateId(),
      name: p.name.trim(),
      description: typeof p.description === 'string' ? p.description.trim() : undefined,
      defaultService: typeof p.defaultService === 'string' ? p.defaultService : undefined,
      isDefault: Boolean(p.isDefault),
      selectedPilgrims,
      general,
      pilgrims: normalizedPilgrims,
      createdAt: safeTimestamp(p.createdAt),
      updatedAt: safeTimestamp(p.updatedAt),
    });
  }

  return {
    valid: true,
    profiles: normalizedProfiles,
    summary: {
      profileCount: normalizedProfiles.length,
      pilgrimCount: totalPilgrims,
    },
  };
}

/** Safely import profiles with canonical runtime validation and automatic rollback backup */
export async function importProfilesSafely(incoming: unknown): Promise<{ importedCount: number; backupCreated: boolean }> {
  const validation = validateImportPayload(incoming);
  if (!validation.valid || !validation.profiles) {
    throw new Error(validation.error || 'Import validation failed.');
  }

  const incomingProfiles = validation.profiles;
  const current = await getProfiles();

  // Create automatic internal rollback backup before writing
  const backupKey = `sp_auto_backup_pre_import_${Date.now()}`;
  let backupCreated = false;
  try {
    await chrome.storage.local.set({ [backupKey]: current });
    backupCreated = true;
  } catch {
    // Non-fatal if backup key set fails
  }

  try {
    // Generate fresh unique IDs to avoid key collisions
    const sanitized = incomingProfiles.map(p => ({
      ...p,
      id: generateId(),
      isDefault: false,
      pilgrims: p.pilgrims.map(pilgrim => ({
        ...pilgrim,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      })),
      createdAt: now(),
      updatedAt: now(),
    }));

    const merged = [...current, ...sanitized].slice(0, MAX_PROFILES);
    if (merged.length > 0 && !merged.some(p => p.isDefault)) {
      merged[0].isDefault = true;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: merged });

    // Import succeeded: remove temporary rollback backup
    if (backupCreated) {
      await chrome.storage.local.remove(backupKey).catch(() => {});
    }

    logger.info(`Safely imported ${sanitized.length} profile(s).`);
    return {
      importedCount: sanitized.length,
      backupCreated,
    };
  } catch (err) {
    // Rollback to original profiles on write failure
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: current });
    } catch {
      // Retain backupKey for emergency recovery
    }
    throw err;
  }
}

// ─── Clear All ───

/** Delete ALL local data. Requires explicit confirmation. */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
  logger.warn('All local data cleared');
}
