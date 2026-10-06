// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Targeted MutationObserver
// ─────────────────────────────────────────────────

import { debounce } from '@shared/utils';
import { MUTATION_DEBOUNCE_MS } from '@shared/constants';
import logger from '@shared/logger';

/**
 * Create a targeted MutationObserver for detecting form changes.
 * Uses debouncing and targeted observation to prevent CPU spikes.
 */
export function createPageObserver(onFormChange: () => void): MutationObserver {
  let isObserving = false;

  const debouncedCallback = debounce(() => {
    logger.debug('DOM mutation detected — re-scanning');
    onFormChange();
  }, MUTATION_DEBOUNCE_MS);

  const observer = new MutationObserver((mutations) => {
    // Filter for relevant mutations (form-related changes)
    const relevant = mutations.some(mutation => {
      // Check added nodes for form elements
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (
            node.tagName === 'FORM' ||
            node.tagName === 'INPUT' ||
            node.tagName === 'SELECT' ||
            node.tagName === 'TEXTAREA' ||
            node.querySelector?.('input, select, textarea, form')
          ) {
            return true;
          }
        }
      }

      // Check if attributes on form elements changed
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        const tag = mutation.target.tagName;
        if (['INPUT', 'SELECT', 'TEXTAREA', 'FORM'].includes(tag)) {
          return true;
        }
      }

      return false;
    });

    if (relevant) {
      debouncedCallback();
    }
  });

  // Find the best observation target (form container or main content)
  const target = findObservationTarget(document);

  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['name', 'id', 'class', 'style', 'disabled', 'hidden'],
  });

  isObserving = true;
  logger.debug('MutationObserver started');

  // Also watch for SPA navigation
  watchNavigation(debouncedCallback);

  return observer;
}

/**
 * Find the most targeted observation root.
 * Prefers main content area over document.body to reduce noise.
 */
function findObservationTarget(doc: Document): Node {
  const candidates = [
    doc.querySelector('main'),
    doc.querySelector('#__next'), // Next.js root
    doc.querySelector('[role="main"]'),
    doc.querySelector('.main-content'),
    doc.querySelector('#root'),
    doc.querySelector('#app'),
    doc.body,
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return doc.body;
}

let navTitleObserver: MutationObserver | null = null;
let navPopstateListener: (() => void) | null = null;
let navHashListener: (() => void) | null = null;
let navCurrentEntryListener: (() => void) | null = null;
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;

/**
 * Watch for SPA-style navigation changes without continuous timer polling.
 */
function watchNavigation(callback: () => void): void {
  // Clear any existing watchers first
  stopNavigationWatchers();

  let lastUrl = window.location.href;
  const onUrlChange = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      callback();
    }
  };

  // 1. Popstate & Hashchange
  navPopstateListener = onUrlChange;
  navHashListener = onUrlChange;
  window.addEventListener('popstate', navPopstateListener);
  window.addEventListener('hashchange', navHashListener);

  // 2. Navigation API (Modern Chromium / Chrome 102+)
  if (typeof (window as any).navigation !== 'undefined') {
    navCurrentEntryListener = onUrlChange;
    (window as any).navigation.addEventListener('currententrychange', navCurrentEntryListener);
  }

  // 3. Monkey-patch pushState & replaceState for immediate notification
  try {
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const res = originalPushState!.apply(this, args);
      setTimeout(onUrlChange, 0);
      return res;
    };

    history.replaceState = function (...args) {
      const res = originalReplaceState!.apply(this, args);
      setTimeout(onUrlChange, 0);
      return res;
    };
  } catch {
    // If restricted by page security policy, popstate/hashchange/navigation remain active
  }

  // 4. Title change detection (often indicates route change in SPAs)
  navTitleObserver = new MutationObserver(onUrlChange);
  const titleEl = document.querySelector('title');
  if (titleEl) {
    navTitleObserver.observe(titleEl, { childList: true });
  }
}

function stopNavigationWatchers(): void {
  if (navTitleObserver) {
    navTitleObserver.disconnect();
    navTitleObserver = null;
  }
  if (navPopstateListener) {
    window.removeEventListener('popstate', navPopstateListener);
    navPopstateListener = null;
  }
  if (navHashListener) {
    window.removeEventListener('hashchange', navHashListener);
    navHashListener = null;
  }
  if (navCurrentEntryListener && typeof (window as any).navigation !== 'undefined') {
    (window as any).navigation.removeEventListener('currententrychange', navCurrentEntryListener);
    navCurrentEntryListener = null;
  }
  if (originalPushState) {
    history.pushState = originalPushState;
    originalPushState = null;
  }
  if (originalReplaceState) {
    history.replaceState = originalReplaceState;
    originalReplaceState = null;
  }
}

/**
 * Tear down page observation cleanly.
 */
export function stopPageObserver(observer?: MutationObserver): void {
  if (observer) {
    observer.disconnect();
  }
  stopNavigationWatchers();
  logger.debug('Page observation stopped');
}
