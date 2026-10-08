// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Typed Message Protocol (Phase 11)
// Runtime schema validation for inter-context MV3 extension messages.
// Rejects unknown types, malformed payloads, or mismatched sessions.
// ─────────────────────────────────────────────────────────────

import type { AutomationState } from './types';
import logger from '@shared/logger';

export type AutomationMessageType =
  | 'AUTOMATION_START'
  | 'AUTOMATION_STOP'
  | 'AUTOMATION_STATE_UPDATE'
  | 'AUTOMATION_HEARTBEAT'
  | 'AUTOMATION_METRIC';

export interface BaseAutomationMessage {
  type: AutomationMessageType;
  sessionId: string;
  tabId?: number;
  documentId?: string;
  timestamp: number;
}

export interface AutomationStartMessage extends BaseAutomationMessage {
  type: 'AUTOMATION_START';
  serviceId?: string;
  autofillMode?: 'fast' | 'safe';
}

export interface AutomationStopMessage extends BaseAutomationMessage {
  type: 'AUTOMATION_STOP';
  reason?: string;
}

export interface AutomationStateUpdateMessage extends BaseAutomationMessage {
  type: 'AUTOMATION_STATE_UPDATE';
  state: AutomationState;
  previousState?: AutomationState;
  reason?: string;
}

export interface AutomationHeartbeatMessage extends BaseAutomationMessage {
  type: 'AUTOMATION_HEARTBEAT';
}

export interface AutomationMetricMessage extends BaseAutomationMessage {
  type: 'AUTOMATION_METRIC';
  operation: string;
  durationMs: number;
  success: boolean;
}

export type ValidatedAutomationMessage =
  | AutomationStartMessage
  | AutomationStopMessage
  | AutomationStateUpdateMessage
  | AutomationHeartbeatMessage
  | AutomationMetricMessage;

/**
 * Validates untrusted incoming message objects at runtime.
 * Throws or returns null if schema is invalid.
 */
export function validateAutomationMessage(
  raw: unknown,
  expectedSessionId?: string,
): ValidatedAutomationMessage | null {
  if (!raw || typeof raw !== 'object') {
    logger.debug('[MessageProtocol] Rejected non-object message');
    return null;
  }

  const msg = raw as Record<string, unknown>;

  // 1. Type validation
  const validTypes: AutomationMessageType[] = [
    'AUTOMATION_START',
    'AUTOMATION_STOP',
    'AUTOMATION_STATE_UPDATE',
    'AUTOMATION_HEARTBEAT',
    'AUTOMATION_METRIC',
  ];

  if (typeof msg.type !== 'string' || !validTypes.includes(msg.type as AutomationMessageType)) {
    logger.debug('[MessageProtocol] Rejected message with unknown type:', msg.type);
    return null;
  }

  // 2. Session ID validation
  if (typeof msg.sessionId !== 'string' || msg.sessionId.trim().length === 0) {
    logger.debug('[MessageProtocol] Rejected message missing valid sessionId');
    return null;
  }

  if (expectedSessionId && msg.sessionId !== expectedSessionId) {
    logger.warn('[MessageProtocol] Mismatched sessionId in message:', {
      expected: expectedSessionId,
      received: msg.sessionId,
    });
    return null;
  }

  // 3. Timestamp validation
  const timestamp = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();

  return {
    ...msg,
    timestamp,
  } as ValidatedAutomationMessage;
}
