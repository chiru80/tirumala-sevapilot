// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Extension Context Invalidation Guard
// Protects orphaned content scripts from throwing uncaught errors
// when an extension is updated, reloaded, or disabled in Chrome.
// ─────────────────────────────────────────────────────────────

type TeardownCallback = () => void;
const teardownCallbacks = new Set<TeardownCallback>();

/**
 * Checks whether the Chrome extension runtime context is still valid.
 * When an extension is reloaded or updated, chrome.runtime.id becomes undefined
 * or throws "Extension context invalidated."
 */
export function isExtensionContextValid(): boolean {
  if (typeof chrome === 'undefined') {
    // In test or non-extension environments without chrome mock, allow DOM processing
    return true;
  }
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

/**
 * Register a cleanup function to be called when extension context is invalidated.
 */
export function onContextInvalidated(callback: TeardownCallback): () => void {
  teardownCallbacks.add(callback);
  return () => {
    teardownCallbacks.delete(callback);
  };
}

/**
 * Triggers all registered cleanup functions and stops orphaned background activity.
 */
export function teardownOrphanedContentScript(): void {
  for (const callback of Array.from(teardownCallbacks)) {
    try {
      callback();
    } catch {
      // Ignore errors during emergency teardown
    }
  }
  teardownCallbacks.clear();
}

/**
 * Safely send a message to background service worker without throwing
 * "Extension context invalidated" or uncaught Promise rejections.
 */
export async function safeSendMessage<T = any>(message: unknown): Promise<T | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime || !isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return null;
  }

  try {
    return await chrome.runtime.sendMessage(message).catch((_err: unknown) => {
      // Rejection when service worker is sleeping or restarting
      return null;
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('context invalidated') || errorMsg.includes('Extension context')) {
      teardownOrphanedContentScript();
    }
    return null;
  }
}

/**
 * Safely read from chrome.storage.local without throwing when context is invalidated.
 */
export async function safeStorageGet(keys: string | string[] | null): Promise<Record<string, any>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return {};
  }

  try {
    return (await chrome.storage.local.get(keys)) || {};
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('context invalidated') || errorMsg.includes('Extension context')) {
      teardownOrphanedContentScript();
    }
    return {};
  }
}

/**
 * Safely write to chrome.storage.local without throwing when context is invalidated.
 */
export async function safeStorageSet(items: Record<string, any>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  try {
    await chrome.storage.local.set(items);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('context invalidated') || errorMsg.includes('Extension context')) {
      teardownOrphanedContentScript();
    }
  }
}

// ─── Global Error & Rejection Traps ───
// Catch unhandled "Extension context invalidated" errors that originate from browser internals
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const msg = event.message || (event.error instanceof Error ? event.error.message : '');
      if (typeof msg === 'string' && msg.includes('Extension context invalidated')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        teardownOrphanedContentScript();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || '');
      if (reason.includes('Extension context invalidated') || reason.includes('context invalidated')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        teardownOrphanedContentScript();
      }
    },
    true
  );
}
