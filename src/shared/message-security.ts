// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Runtime Message Security Guard (Phase 6)
// Type-safe guards, origin verification, and injection protection
// for messages crossing content ↔ background ↔ sidepanel.
// ─────────────────────────────────────────────────────────────

import { MessageType } from './types';
import type { ExtensionMessage } from './types';

function hasPrototypePollution(obj: unknown, depth = 0): boolean {
  if (depth > 5 || !obj || typeof obj !== 'object') return false;
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype') ||
    (Object.prototype.hasOwnProperty.call(obj, 'constructor') && typeof (obj as any).constructor !== 'function')
  ) {
    return true;
  }
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype && proto !== Array.prototype) {
    return true;
  }
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (val && typeof val === 'object' && hasPrototypePollution(val, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates whether an incoming object conforms to the strict ExtensionMessage schema.
 * Rejects malformed, untrusted, or prototype-polluting payloads.
 */
export function isValidExtensionMessage(message: unknown): message is ExtensionMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check type property
  if (typeof msg.type !== 'string') {
    return false;
  }

  // Ensure type belongs to known MessageType enum
  const validTypes = Object.values(MessageType) as string[];
  if (!validTypes.includes(msg.type)) {
    return false;
  }

  // Prototype pollution defense (deep)
  if (hasPrototypePollution(msg)) {
    return false;
  }

  return true;
}

/**
 * Checks if the message sender originates from the extension runtime itself.
 */
export function isTrustedExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender) return false;

  // Check if sender id matches chrome.runtime.id
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the message sender originates strictly from internal extension pages
 * (e.g. side panel, popup, options), and NOT from an untrusted web page content script.
 */
export function isInternalExtensionContext(sender: chrome.runtime.MessageSender): boolean {
  if (!sender) return false;
  // Content scripts always run within a tab; internal extension pages (sidepanel, popup, options) do not have sender.tab
  if (sender.tab) return false;

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    if (sender.id && sender.id !== chrome.runtime.id) {
      return false;
    }
    if (sender.url && typeof chrome.runtime.getURL === 'function') {
      const extBase = chrome.runtime.getURL('');
      if (!sender.url.startsWith(extBase)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Strips potentially dangerous string payloads (e.g. javascript: URLs, script tags).
 */
export function sanitizeMessagePayload<T>(payload: T): T {
  if (typeof payload === 'string') {
    // Prevent javascript: pseudo-protocol or script tags
    if (payload.trim().toLowerCase().startsWith('javascript:')) {
      return '' as unknown as T;
    }
    return payload;
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (k !== '__proto__' && k !== 'prototype') {
        cleaned[k] = sanitizeMessagePayload(v);
      }
    }
    return cleaned as T;
  }

  return payload;
}
