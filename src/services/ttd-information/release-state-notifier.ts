// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Release State Notifier (Phase 7)
// Manages and detects meaningful lifecycle state transitions for TTD releases:
// - RELEASE_UPCOMING
// - RELEASE_TODAY
// - RELEASE_UPDATED
// - RELEASE_STARTED
// - RELEASE_PASSED
// Deduplicates notifications during background polling.
// Only notifies when an actual state transition occurs.
// ─────────────────────────────────────────────────────────────

import type { ReleaseEvent } from './release-types';
import { getReleaseEpochMs } from './ttd-release-calendar';

export type ReleaseNotificationState =
  | 'RELEASE_UPCOMING'
  | 'RELEASE_TODAY'
  | 'RELEASE_UPDATED'
  | 'RELEASE_STARTED'
  | 'RELEASE_PASSED';

export interface ReleaseNotificationEvent {
  eventId: string;
  serviceId: string;
  serviceName: string;
  state: ReleaseNotificationState;
  previousState?: ReleaseNotificationState;
  releaseDate?: string;
  releaseTime?: string;
  targetDateTimeIST: string;
  headline: string;
  message: string;
  timestamp: string;
}

export class ReleaseStateNotifier {
  private lastEmittedStates: Map<string, ReleaseNotificationState> = new Map();

  /**
   * Resets the transition history.
   */
  public reset(): void {
    this.lastEmittedStates.clear();
  }

  /**
   * Determines the current lifecycle state for an event at `nowMs`.
   */
  public determineState(event: ReleaseEvent, nowMs: number = Date.now()): ReleaseNotificationState {
    if (event.isUpdated) {
      return 'RELEASE_UPDATED';
    }

    if (!event.releaseDate || !event.releaseTime) {
      return 'RELEASE_UPCOMING';
    }

    const epochMs = getReleaseEpochMs(event.releaseDate, event.releaseTime);
    if (isNaN(epochMs)) {
      return 'RELEASE_UPCOMING';
    }

    const diffMs = epochMs - nowMs;
    const diffSeconds = Math.floor(diffMs / 1000);

    // Passed: more than 2 hours after release
    if (diffSeconds < -7200) {
      return 'RELEASE_PASSED';
    }

    // Started: release time reached (within 2 hours window)
    if (diffSeconds <= 0 && diffSeconds >= -7200) {
      return 'RELEASE_STARTED';
    }

    // Check if release is today in IST (UTC+05:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(nowMs + istOffsetMs);
    const todayIstStr = nowIst.toISOString().slice(0, 10);

    if (event.releaseDate === todayIstStr) {
      return 'RELEASE_TODAY';
    }

    return 'RELEASE_UPCOMING';
  }

  /**
   * Evaluates if a notification should be fired for this event.
   * Only returns a notification if the state has changed since last evaluation.
   * Returns null if state hasn't transitioned (prevents repeated notifications during polling).
   */
  public evaluateTransition(
    event: ReleaseEvent,
    nowMs: number = Date.now()
  ): ReleaseNotificationEvent | null {
    const currentState = this.determineState(event, nowMs);
    const previousState = this.lastEmittedStates.get(event.id);

    if (previousState === currentState) {
      return null; // No transition -> suppress notification during repeated polling
    }

    this.lastEmittedStates.set(event.id, currentState);

    const serviceName = event.displayName || event.serviceName || event.serviceId;
    const targetDateTimeIST = event.releaseDate && event.releaseTime
      ? `${event.releaseDate} ${event.releaseTime} IST`
      : 'TBD';

    let headline = '';
    let message = '';

    switch (currentState) {
      case 'RELEASE_UPDATED':
        headline = `Release Updated: ${serviceName}`;
        message = event.changeNotes || `TTD has updated the release schedule to ${targetDateTimeIST}.`;
        break;
      case 'RELEASE_STARTED':
        headline = `Quota Released Now: ${serviceName}`;
        message = `The booking quota for ${serviceName} is now released on official TTD portal.`;
        break;
      case 'RELEASE_TODAY':
        headline = `Releases Today: ${serviceName}`;
        message = `Quota releases today at ${event.releaseTime || '10:00'} IST. Please prepare devotee details.`;
        break;
      case 'RELEASE_PASSED':
        headline = `Quota Release Closed: ${serviceName}`;
        message = `The booking window for ${targetDateTimeIST} has completed.`;
        break;
      case 'RELEASE_UPCOMING':
      default:
        headline = `Upcoming Release: ${serviceName}`;
        message = `Next release scheduled for ${targetDateTimeIST}.`;
        break;
    }

    return {
      eventId: event.id,
      serviceId: event.serviceId,
      serviceName,
      state: currentState,
      previousState,
      releaseDate: event.releaseDate,
      releaseTime: event.releaseTime,
      targetDateTimeIST,
      headline,
      message,
      timestamp: new Date(nowMs).toISOString(),
    };
  }
}

export const releaseStateNotifier = new ReleaseStateNotifier();
