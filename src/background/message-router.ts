// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Message Router
// Routes messages between sidepanel ↔ content script
// ─────────────────────────────────────────────────

import { MessageType } from '@shared/types';
import type { ExtensionMessage, Profile } from '@shared/types';
import * as repo from '@storage/repository';
import logger from '@shared/logger';

import { isSupportedDomain } from '@shared/utils';

/**
 * Safely send a message to a specific target tab's content script.
 * Never guesses or falls back to arbitrary open TTD tabs.
 */
export async function sendToTargetTab(
  message: ExtensionMessage,
  explicitTabId?: number,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    let tabId = explicitTabId;

    if (!tabId) {
      // 1. Try finding active tab in current or last focused window
      let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      }

      if (tab?.id && tab.url && isSupportedDomain(tab.url)) {
        tabId = tab.id;
      }
    }

    // Fail closed: Never search for an arbitrary open TTD tab when target is missing or inactive
    if (!tabId) {
      return {
        success: false,
        error: 'Please open a supported TTD booking page.',
      };
    }

    // Fetch tab to verify it is still open and matches official TTD domain
    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return {
        success: false,
        error: 'Please open a supported TTD booking page.',
      };
    }

    const url = tab.url || '';
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('devtools://') ||
      !isSupportedDomain(url)
    ) {
      return {
        success: false,
        error: 'Please open a supported TTD booking page.',
      };
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response ?? { success: true };
    } catch {
      // Content script may not be connected yet (e.g. extension freshly reloaded)
      try {
        const manifest = chrome.runtime.getManifest();
        const scripts = manifest.content_scripts?.[0]?.js;
        if (scripts && scripts.length > 0) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: scripts,
          });
          // Wait briefly for content script to mount
          await new Promise(r => setTimeout(r, 200));
          const retryResponse = await chrome.tabs.sendMessage(tabId, message);
          return retryResponse ?? { success: true };
        }
      } catch (injectErr) {
        logger.debug('Script auto-injection attempt failed:', injectErr);
      }

      return {
        success: false,
        error: 'Please reload the TTD page (press F5 or click Refresh) to reconnect SevaPilot',
      };
    }
  } catch (err) {
    logger.debug('Tab communication failed:', err);
    return { success: false, error: 'Please open a supported TTD booking page.' };
  }
}

/**
 * Route messages between extension contexts.
 */
export async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    const targetTabId: number | undefined = (message as any)?.targetTabId ?? (message?.payload as any)?.targetTabId;

    switch (message.type) {
      // ─── Forward to content script ───
      case MessageType.SCAN_PAGE:
      case MessageType.REQUEST_SCAN: {
        const response = await sendToTargetTab({
          type: MessageType.SCAN_PAGE,
          payload: message.payload,
          timestamp: new Date().toISOString(),
        }, targetTabId);
        sendResponse(response);
        break;
      }

      case MessageType.FILL_FIELDS:
      case MessageType.REQUEST_FILL: {
        let payload = (message?.payload || {}) as any;
        if (!payload.pilgrims || !Array.isArray(payload.pilgrims) || payload.pilgrims.length === 0) {
          const profiles = (await repo.getProfiles()) || [];
          const validProfiles = profiles.filter((p): p is Profile => p != null && typeof p === 'object');
          const active = validProfiles.find(p => p.isDefault) || validProfiles[0];
          if (active?.pilgrims && Array.isArray(active.pilgrims) && active.pilgrims.length > 0) {
            payload = {
              ...payload,
              pilgrims: active.pilgrims,
              profile: active,
            };
          }
        }

        // Validate payload constraints before forwarding to content script
        if (payload?.pilgrims && Array.isArray(payload.pilgrims)) {
          if (payload.pilgrims.length > 6) {
            sendResponse({ success: false, error: 'Maximum 6 pilgrims allowed per booking.' });
            break;
          }
          // Sanitize & validate each pilgrim
          payload.pilgrims = payload.pilgrims.map((p: any) => ({
            ...p,
            fullName: String(p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim(),
            age: typeof p.age === 'number' ? p.age : parseInt(String(p.age || '0'), 10) || 0,
            gender: String(p.gender || 'Male').trim(),
            idType: String(p.idType || 'Aadhaar Card').trim(),
            idNumber: String(p.idNumber || '').trim(),
          }));
        }

        const response = await sendToTargetTab({
          type: MessageType.FILL_FIELDS,
          payload,
          timestamp: new Date().toISOString(),
        }, targetTabId);
        sendResponse(response);
        break;
      }

      case MessageType.STOP_AUTOFILL: {
        const response = await sendToTargetTab({
          type: MessageType.STOP_AUTOFILL,
          payload: null,
          timestamp: new Date().toISOString(),
        }, targetTabId);
        sendResponse(response);
        break;
      }

      case MessageType.HIGHLIGHT_FIELDS:
      case MessageType.CLEAR_HIGHLIGHTS: {
        const response = await sendToTargetTab(message, targetTabId);
        sendResponse(response);
        break;
      }

      case MessageType.OPEN_SIDE_PANEL: {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_PAGE_STATE: {
        const response = await sendToTargetTab(message, targetTabId);
        sendResponse(response);
        break;
      }

      // ─── Forward from content script to sidepanel ───
      case MessageType.PAGE_DETECTED:
      case MessageType.SCAN_RESULT:
      case MessageType.FILL_COMPLETE:
      case MessageType.AUTOFILL_PROGRESS:
      case MessageType.FORM_CHANGED: {
        // Only forward to extension views if message originated from a tab
        if (sender.tab) {
          chrome.runtime.sendMessage(message).catch(() => {
            // Harmless if side panel is not currently open
          });
        }
        sendResponse({ success: true });
        break;
      }

      // ─── Profile operations ───
      case MessageType.GET_PROFILES: {
        const profiles = await repo.getProfiles();
        sendResponse({ success: true, data: profiles });
        break;
      }

      case MessageType.SAVE_PROFILE: {
        const { id, ...updates } = (message.payload || {}) as Record<string, unknown>;
        if (id) {
          const profile = await repo.updateProfile(id as string, updates);
          sendResponse({ success: true, data: profile });
        } else {
          sendResponse({ success: false, error: 'Missing profile ID' });
        }
        break;
      }

      case MessageType.DELETE_PROFILE: {
        const { profileId } = (message.payload || {}) as { profileId: string };
        if (profileId) {
          await repo.deleteProfile(profileId);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Missing profileId' });
        }
        break;
      }

      // ─── Settings ───
      case MessageType.GET_SETTINGS: {
        const settings = await repo.getSettings();
        sendResponse({ success: true, data: settings });
        break;
      }

      case MessageType.SAVE_SETTINGS: {
        const updated = await repo.saveSettings(
          (message.payload || {}) as Record<string, unknown>,
        );
        sendResponse({ success: true, data: updated });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown message type: ${(message as { type?: string })?.type || 'undefined'}` });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug('Message routing exception:', errorMsg);
    sendResponse({
      success: false,
      error: errorMsg,
    });
  }
}
