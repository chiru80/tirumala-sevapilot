// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Release & Information Cache (Phase 5)
// Lightweight cache built directly on chrome.storage.local.
// Zero-PII: Only stores public TTD release schedules & source metadata.
// ─────────────────────────────────────────────────────────────

import { validateTtdSource } from './ttd-source-validator';

export interface TtdCacheEntry<T> {
  schemaVersion?: number;
  sourceUrl: string;
  fetchedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  verified: boolean;
  status: 'FRESH' | 'STALE' | 'UNVERIFIED';
  data: T;
  lastVerifiedAt?: string;
}

export const CURRENT_CACHE_SCHEMA_VERSION = 1;
const CACHE_PREFIX = 'sp_ttd_cache_';
const MAX_CACHE_ENTRIES = 50;

/**
 * In-memory fallback cache for non-extension or testing environments.
 */
const memoryCache = new Map<string, TtdCacheEntry<unknown>>();

function getStorageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Checks whether chrome.storage.local is available in current runtime.
 */
function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.storage) &&
    Boolean(chrome.storage.local)
  );
}

/**
 * Stores an item in the TTD intelligence cache.
 * Validates official source URL before marking entry as verified.
 */
export async function setCachedTtdData<T>(
  key: string,
  data: T,
  options: {
    sourceUrl: string;
    expiresInMs?: number; // Defaults to 24 hours
    isVerified?: boolean;
  }
): Promise<TtdCacheEntry<T>> {
  const now = new Date();
  const sourceValidation = validateTtdSource(options.sourceUrl);
  const isVerified = (options.isVerified ?? true) && sourceValidation.isValid;

  const defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours
  const ttlMs = options.expiresInMs ?? defaultTtlMs;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  const entry: TtdCacheEntry<T> = {
    schemaVersion: CURRENT_CACHE_SCHEMA_VERSION,
    sourceUrl: options.sourceUrl,
    fetchedAt: now.toISOString(),
    expiresAt,
    verified: isVerified,
    status: isVerified ? 'FRESH' : 'UNVERIFIED',
    data,
    lastVerifiedAt: isVerified ? now.toISOString() : undefined,
  };

  const storageKey = getStorageKey(key);

  if (isChromeStorageAvailable()) {
    try {
      await chrome.storage.local.set({ [storageKey]: entry });
    } catch {
      memoryCache.set(key, entry);
    }
  } else {
    // Bound memory cache size
    if (memoryCache.size >= MAX_CACHE_ENTRIES && !memoryCache.has(key)) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, entry);
  }

  return entry;
}

/**
 * Retrieves a cached TTD entry by key.
 * Evaluates staleness automatically. If expired, marks entry STALE.
 * Gracefully handles version mismatches or schema corruption.
 */
export async function getCachedTtdData<T>(
  key: string,
  now: Date = new Date()
): Promise<TtdCacheEntry<T> | null> {
  const storageKey = getStorageKey(key);
  let rawEntry: TtdCacheEntry<T> | null = null;

  if (isChromeStorageAvailable()) {
    try {
      const res = await chrome.storage.local.get(storageKey);
      rawEntry = (res[storageKey] as TtdCacheEntry<T>) || null;
    } catch {
      rawEntry = (memoryCache.get(key) as TtdCacheEntry<T>) || null;
    }
  } else {
    rawEntry = (memoryCache.get(key) as TtdCacheEntry<T>) || null;
  }

  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  // Graceful corruption / version handling: if corrupted, ignore
  if (!rawEntry.fetchedAt || !rawEntry.sourceUrl) {
    return null;
  }

  // Evaluate staleness
  const expiresMs = new Date(rawEntry.expiresAt).getTime();
  const isExpired = isNaN(expiresMs) || now.getTime() > expiresMs;

  if (isExpired) {
    return {
      ...rawEntry,
      status: 'STALE',
    };
  }

  return rawEntry;
}

/**
 * Clears cached TTD entries from storage.
 */
export async function clearTtdCache(): Promise<void> {
  memoryCache.clear();
  if (isChromeStorageAvailable()) {
    try {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch {
      // Fallback
    }
  }
}

/**
 * Formats "Last verified" message for UI display.
 */
export function formatLastVerified(entry: TtdCacheEntry<unknown> | null | undefined): string {
  if (!entry || !entry.lastVerifiedAt) {
    return 'Source needs verification';
  }

  try {
    const d = new Date(entry.lastVerifiedAt);
    return `Last verified: ${d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    })} IST`;
  } catch {
    return `Last verified: ${entry.lastVerifiedAt}`;
  }
}
