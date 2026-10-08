// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — TTD Fetch Coordinator (Phase 7)
// Manages network requests with:
// - Request coalescing (deduplicates concurrent fetches across popup/sidepanel)
// - Bounded refresh cooldown (prevents rapid repetitive polling)
// - Cache-first freshness window lookup
// - Graceful network offline fallback (never blocks autofill or crashes)
// ─────────────────────────────────────────────────────────────

import { getCachedTtdData, setCachedTtdData } from './ttd-cache';
import { validateTtdSource } from './ttd-source-validator';

export interface CoordinatedFetchOptions {
  sourceUrl: string;
  cooldownMs?: number; // Minimum wait before re-fetching (default: 5 minutes)
  expiresInMs?: number; // Cache TTL (default: 24 hours)
  forceRefresh?: boolean;
}

export class TtdFetchCoordinator {
  private inFlightRequests: Map<string, Promise<unknown>> = new Map();
  private lastFetchTimestamps: Map<string, number> = new Map();

  /**
   * Resets coordinator state (for testing).
   */
  public reset(): void {
    this.inFlightRequests.clear();
    this.lastFetchTimestamps.clear();
  }

  /**
   * Executes a coordinated fetch for a given cache key and fetcher function.
   * If an identical fetch is already in flight, awaits the existing promise.
   * If cache is fresh and cooldown has not elapsed, returns cached data.
   */
  public async coordinateFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CoordinatedFetchOptions
  ): Promise<{ data: T | null; fromCache: boolean; error?: string }> {
    const cooldownMs = options.cooldownMs ?? 5 * 60 * 1000; // 5 min default
    const nowMs = Date.now();

    // 1. Check cache first unless forced
    if (!options.forceRefresh) {
      try {
        const cached = await getCachedTtdData<T>(key);
        if (cached && cached.status === 'FRESH') {
          return { data: cached.data, fromCache: true };
        }
      } catch {
        // Cache read failure is non-fatal; continue to fetch
      }
    }

    // 2. Enforce cooldown if recently fetched and not forced
    const lastFetch = this.lastFetchTimestamps.get(key) || 0;
    if (!options.forceRefresh && nowMs - lastFetch < cooldownMs) {
      try {
        const staleCached = await getCachedTtdData<T>(key);
        if (staleCached) {
          return { data: staleCached.data, fromCache: true };
        }
      } catch {
        // Continue
      }
    }

    // 3. Request Coalescing: return in-flight promise if one is already active
    if (this.inFlightRequests.has(key)) {
      try {
        const existingData = (await this.inFlightRequests.get(key)) as T;
        return { data: existingData, fromCache: false };
      } catch (err: unknown) {
        return { data: null, fromCache: false, error: (err as Error)?.message || 'Fetch failed' };
      }
    }

    // 4. Validate official source before issuing network request
    const sourceValidation = validateTtdSource(options.sourceUrl);
    if (!sourceValidation.isValid) {
      return {
        data: null,
        fromCache: false,
        error: `Fetch rejected for unofficial source: ${sourceValidation.reason}`,
      };
    }

    // 5. Execute fetch with coalescing lock
    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.lastFetchTimestamps.set(key, Date.now());

        if (result !== null && result !== undefined) {
          await setCachedTtdData(key, result, {
            sourceUrl: options.sourceUrl,
            expiresInMs: options.expiresInMs,
            isVerified: true,
          });
        }
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, fetchPromise);

    try {
      const data = await fetchPromise;
      return { data, fromCache: false };
    } catch (err: unknown) {
      this.inFlightRequests.delete(key);
      // Graceful fallback to cached data even if stale on network failure
      const fallbackCached = await getCachedTtdData<T>(key);
      if (fallbackCached) {
        return { data: fallbackCached.data, fromCache: true, error: (err as Error)?.message };
      }
      return { data: null, fromCache: false, error: (err as Error)?.message || 'Network error' };
    }
  }
}

export const ttdFetchCoordinator = new TtdFetchCoordinator();
