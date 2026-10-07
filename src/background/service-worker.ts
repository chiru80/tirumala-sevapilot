// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Background Service Worker
// ─────────────────────────────────────────────────

import { handleMessage } from './message-router';
import { runMigrations } from '@storage/migrations';
import * as repo from '@storage/repository';
import logger from '@shared/logger';
import { MessageType } from '@shared/types';
import type { ExtensionMessage, Profile } from '@shared/types';
import { isSupportedDomain } from '@shared/utils';

// ─── Extension Lifecycle ───

chrome.runtime.onInstalled.addListener((details) => {
  // Clear any pending runtime.lastError
  if (chrome.runtime?.lastError) {
    void chrome.runtime.lastError;
  }

  // Configure side panel behavior safely within onInstalled
  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      if (chrome.runtime?.lastError) void chrome.runtime.lastError;
    });
  }

  // Setup contextual menu
  setupContextMenu();

  if (details.reason === 'install') {
    logger.info('SevaPilot installed for the first time');
  } else if (details.reason === 'update') {
    logger.info(`SevaPilot updated from ${details.previousVersion || 'previous version'}`);
    // Run data migrations asynchronously with graceful error boundary
    runMigrations().catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('No SW') || msg.includes('context invalidated')) {
        logger.warn('Service worker lifecycle transitioning during update; migration deferred');
      } else {
        logger.error('Migration failed during update', error);
      }
    });
  }
});

import { isValidExtensionMessage } from '@shared/message-security';

// ─── Message Routing ───

chrome.runtime.onMessage.addListener(
  (rawMessage: unknown, sender, sendResponse) => {
    // 1. Validate structure and message type
    if (!isValidExtensionMessage(rawMessage)) {
      logger.warn('Rejected malformed message in background service worker');
      sendResponse({ success: false, error: 'Malformed message rejected' });
      return false;
    }

    // 2. Validate tab sender origin
    if (sender.tab?.url && !isSupportedDomain(sender.tab.url)) {
      logger.warn('Rejected message from unsupported origin:', sender.tab.url);
      sendResponse({ success: false, error: 'Unauthorized tab origin' });
      return false;
    }

    handleMessage(rawMessage, sender, sendResponse);
    return true; // Keep channel open for async
  },
);

// ─── Keyboard Commands ───

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  switch (command) {
    case 'open-sevapilot':
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
      break;

    case 'scan-page':
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: MessageType.SCAN_PAGE,
          payload: null,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
      break;

    case 'autofill-page':
      if (tab?.id) {
        // Open side panel and trigger autofill
        await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        if (tab.url && isSupportedDomain(tab.url)) {
          try {
            const profiles = (await repo.getProfiles()) || [];
            const validProfiles = profiles.filter((p): p is Profile => p != null && typeof p === 'object');
            const active = validProfiles.find(p => p.isDefault) || validProfiles[0];
            if (active?.pilgrims && active.pilgrims.length > 0) {
              chrome.tabs.sendMessage(tab.id, {
                type: MessageType.FILL_FIELDS,
                payload: {
                  pilgrims: active.pilgrims,
                  profile: active,
                },
                timestamp: new Date().toISOString(),
              }).catch(() => {});
            }
          } catch (cmdErr) {
            logger.debug('Autofill command failed:', cmdErr);
          }
        }
      }
      break;
  }
});

// ─── Context Menu (optional side panel opener) ───

function setupContextMenu(): void {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime?.lastError) void chrome.runtime.lastError;
      chrome.contextMenus.create(
        {
          id: 'open-sevapilot',
          title: 'Open SevaPilot',
          contexts: ['page'],
          documentUrlPatterns: [
            'https://ttdevasthanams.ap.gov.in/*',
            'https://tirupatibalaji.ap.gov.in/*',
          ],
        },
        () => {
          if (chrome.runtime?.lastError) void chrome.runtime.lastError;
        }
      );
    });
  } catch {
    // Harmless if context menu already exists or not supported
  }
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-sevapilot' && tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

logger.info('SevaPilot service worker initialized');
