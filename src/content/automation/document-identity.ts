// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Document Identity & SPA Navigation (Phase 11)
// Tracks document lifecycle instances and multi-signal SPA transitions
// to halt stale automation when pages or DOM contexts are replaced.
// ─────────────────────────────────────────────────────────────

import type { NavigationContext } from './types';
import logger from '@shared/logger';

const DOC_ID_KEY = '__sp_document_instance_id__';

/**
 * Retrieves or initializes a unique document instance ID for the given Document.
 * Stored safely as an unenumerable property on the document object.
 */
export function getDocumentInstanceId(doc: Document = document): string {
  try {
    const customDoc = doc as unknown as Record<string, unknown>;
    if (typeof customDoc[DOC_ID_KEY] === 'string' && customDoc[DOC_ID_KEY]) {
      return customDoc[DOC_ID_KEY] as string;
    }

    const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    Object.defineProperty(doc, DOC_ID_KEY, {
      value: newId,
      writable: false,
      configurable: true,
      enumerable: false,
    });
    return newId;
  } catch {
    return `doc_fallback_${Date.now()}`;
  }
}

/**
 * Creates current navigation snapshot.
 */
export function createNavigationContext(
  tabId = 0,
  frameId = 0,
  doc: Document = document,
): NavigationContext {
  const url = typeof window !== 'undefined' ? window.location?.href || '' : '';
  return {
    tabId,
    frameId,
    documentId: getDocumentInstanceId(doc),
    url,
    timestamp: Date.now(),
  };
}

export type NavigationListener = (context: NavigationContext, reason: string) => void;

/**
 * SPANavigationDetector
 * Listens to history.pushState, history.replaceState, popstate, hashchange,
 * and DOM route mutations to alert automation engines of SPA page replacement.
 */
export class SPANavigationDetector {
  private lastUrl = '';
  private lastDocId = '';
  private isListening = false;
  private readonly listeners: Set<NavigationListener> = new Set();
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private urlCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.lastUrl = window.location?.href || '';
      this.lastDocId = getDocumentInstanceId(document);
    }
  }

  public startListening(tabId = 0, frameId = 0): void {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    // 1. Intercept pushState & replaceState
    try {
      this.originalPushState = history.pushState.bind(history);
      this.originalReplaceState = history.replaceState.bind(history);

      const handleStateChange = (reason: string) => {
        setTimeout(() => this.checkNavigation(tabId, frameId, reason), 10);
      };

      history.pushState = (...args) => {
        this.originalPushState?.(...args);
        handleStateChange('pushState');
      };

      history.replaceState = (...args) => {
        this.originalReplaceState?.(...args);
        handleStateChange('replaceState');
      };
    } catch (e) {
      logger.debug('[SPANavigationDetector] Could not patch history API:', e);
    }

    // 2. Standard DOM event listeners
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('hashchange', this.onHashChange);

    // 3. Conservative bounded poll (every 2.5s) as a safety net for stealth SPA navigations
    this.urlCheckTimer = setInterval(() => {
      this.checkNavigation(tabId, frameId, 'polling_check');
    }, 2500);

    logger.debug('[SPANavigationDetector] Navigation listener started.');
  }

  private onPopState = () => {
    this.checkNavigation(0, 0, 'popstate');
  };

  private onHashChange = () => {
    this.checkNavigation(0, 0, 'hashchange');
  };

  /**
   * Evaluates if URL or Document instance has changed.
   */
  public checkNavigation(tabId = 0, frameId = 0, reason = 'unknown'): boolean {
    if (typeof window === 'undefined') return false;

    const currentUrl = window.location?.href || '';
    const currentDocId = getDocumentInstanceId(document);

    const urlChanged = currentUrl !== this.lastUrl;
    const docChanged = currentDocId !== this.lastDocId;

    if (urlChanged || docChanged) {
      this.lastUrl = currentUrl;
      this.lastDocId = currentDocId;

      const context: NavigationContext = {
        tabId,
        frameId,
        documentId: currentDocId,
        url: currentUrl,
        timestamp: Date.now(),
      };

      logger.info(`[SPANavigationDetector] SPA navigation detected via ${reason}:`, {
        urlChanged,
        docChanged,
        url: currentUrl,
      });

      for (const listener of this.listeners) {
        try {
          listener(context, reason);
        } catch (e) {
          logger.error('[SPANavigationDetector] Listener error:', e);
        }
      }
      return true;
    }

    return false;
  }

  public onNavigation(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public stopListening(): void {
    if (!this.isListening || typeof window === 'undefined') return;
    this.isListening = false;

    // Restore original history functions
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }

    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('hashchange', this.onHashChange);

    if (this.urlCheckTimer) {
      clearInterval(this.urlCheckTimer);
      this.urlCheckTimer = null;
    }

    this.listeners.clear();
    logger.debug('[SPANavigationDetector] Navigation listener stopped.');
  }
}
