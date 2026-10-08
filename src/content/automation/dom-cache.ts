// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — DOM Invalidation Cache (Phase 12)
// High-performance, zero-memory-leak caching layer for DOM elements,
// form roots, and page detection signals with deterministic invalidation.
// ─────────────────────────────────────────────────────────────

import logger from '@shared/logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttlMs: number;
}

/**
 * Controlled DOM Invalidation Cache.
 * Prevents repetitive, expensive full-document queries and forced reflows.
 */
export class DomInvalidationCache {
  private static instance: DomInvalidationCache | null = null;

  // WeakMap for DOM element metadata (auto-garbage collected when element is removed)
  private elementMetaMap = new WeakMap<Element, Record<string, unknown>>();

  // Key-value cache for string-keyed DOM queries and page signals
  private cache = new Map<string, CacheEntry<unknown>>();

  // Active document instance ID to invalidate cross-document cache leaks
  private activeDocumentId = '';

  // Current URL for route-aware invalidation
  private currentUrl = '';

  private hitCount = 0;
  private missCount = 0;

  private constructor() {
    this.updateActiveDocument();
  }

  public static getInstance(): DomInvalidationCache {
    if (!this.instance) {
      this.instance = new DomInvalidationCache();
    }
    return this.instance;
  }

  /**
   * Updates document tracking ID to prevent stale cache hits across navigation.
   */
  public updateActiveDocument(docId?: string, url?: string): void {
    const newDocId = docId || (typeof document !== 'undefined' ? (document as any).__sp_doc_id || 'doc_root' : 'doc_root');
    const newUrl = url || (typeof window !== 'undefined' ? window.location?.href || '' : '');

    if (this.activeDocumentId !== newDocId || this.currentUrl !== newUrl) {
      this.invalidateAll();
      this.activeDocumentId = newDocId;
      this.currentUrl = newUrl;
    }
  }

  /**
   * Retrieves a cached value if not expired and if any referenced element is still connected.
   */
  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      this.missCount++;
      return undefined;
    }

    // Verify element connectivity if the value is a DOM node
    if (entry.value instanceof Element && !entry.value.isConnected) {
      this.cache.delete(key);
      this.missCount++;
      return undefined;
    }

    this.hitCount++;
    return entry.value as T;
  }

  /**
   * Stores a value in cache with a bounded TTL (default 250ms for DOM states).
   */
  public set<T>(key: string, value: T, ttlMs = 250): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  /**
   * Stores element metadata in the WeakMap.
   */
  public setElementMeta<T>(element: Element, key: string, data: T): void {
    let meta = this.elementMetaMap.get(element);
    if (!meta) {
      meta = {};
      this.elementMetaMap.set(element, meta);
    }
    meta[key] = data;
  }

  /**
   * Retrieves element metadata from the WeakMap.
   */
  public getElementMeta<T>(element: Element, key: string): T | undefined {
    const meta = this.elementMetaMap.get(element);
    return meta ? (meta[key] as T) : undefined;
  }

  /**
   * Invalidates entries matching a prefix (e.g. 'pageStage:', 'queue:', 'form:').
   */
  public invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidates entire cache immediately (e.g. on route change, form submission, or DOM replacement).
   */
  public invalidateAll(): void {
    this.cache.clear();
    logger.debug('[DomInvalidationCache] Cache completely flushed.');
  }

  /**
   * Returns cache observability metrics (Zero PII).
   */
  public getMetrics(): { hitCount: number; missCount: number; size: number; hitRate: string } {
    const total = this.hitCount + this.missCount;
    const rate = total > 0 ? ((this.hitCount / total) * 100).toFixed(1) + '%' : '0%';
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      size: this.cache.size,
      hitRate: rate,
    };
  }

  /**
   * Resets metrics.
   */
  public resetMetrics(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

export const domCache = DomInvalidationCache.getInstance();
