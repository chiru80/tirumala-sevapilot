// ─────────────────────────────────────────────────────────────
// Tirumala SevaPilot — Release Change Detector (Phase 7)
// Detects when TTD updates or postpones a confirmed release schedule.
// Preserves previous release dates/times and flags RELEASE_UPDATED.
// ─────────────────────────────────────────────────────────────

import type { ReleaseEvent } from './release-types';

export interface ReleaseChangeEvent {
  hasChanged: boolean;
  previousReleaseDate?: string;
  previousReleaseTime?: string;
  changeNotes?: string;
  fieldChanges: Array<{
    field: 'releaseDate' | 'releaseTime' | 'targetBookingDates' | 'status';
    previousValue: string;
    newValue: string;
  }>;
  summaryText: string;
  updatedEvent: ReleaseEvent;
}

/**
 * Compares an incoming release event against an existing known event for the same service.
 * Detects rescheduling, postponement, or time shifts.
 */
export function detectReleaseChanges(
  existingEvent: ReleaseEvent | null | undefined,
  incomingEvent: ReleaseEvent
): ReleaseChangeEvent {
  if (!existingEvent) {
    return {
      hasChanged: false,
      fieldChanges: [],
      summaryText: '',
      updatedEvent: incomingEvent,
    };
  }

  const fieldChanges: ReleaseChangeEvent['fieldChanges'] = [];

  // 1. Date change
  if (
    existingEvent.releaseDate &&
    incomingEvent.releaseDate &&
    existingEvent.releaseDate !== incomingEvent.releaseDate
  ) {
    fieldChanges.push({
      field: 'releaseDate',
      previousValue: existingEvent.releaseDate,
      newValue: incomingEvent.releaseDate,
    });
  }

  // 2. Time change
  if (
    existingEvent.releaseTime &&
    incomingEvent.releaseTime &&
    existingEvent.releaseTime !== incomingEvent.releaseTime
  ) {
    fieldChanges.push({
      field: 'releaseTime',
      previousValue: existingEvent.releaseTime,
      newValue: incomingEvent.releaseTime,
    });
  }

  // 3. Target booking dates change
  if (
    existingEvent.targetBookingDates &&
    incomingEvent.targetBookingDates &&
    existingEvent.targetBookingDates !== incomingEvent.targetBookingDates
  ) {
    fieldChanges.push({
      field: 'targetBookingDates',
      previousValue: existingEvent.targetBookingDates,
      newValue: incomingEvent.targetBookingDates,
    });
  }

  const hasChanged = fieldChanges.length > 0;

  if (!hasChanged) {
    return {
      hasChanged: false,
      fieldChanges: [],
      summaryText: '',
      updatedEvent: incomingEvent,
    };
  }

  const dateChange = fieldChanges.find(c => c.field === 'releaseDate');
  const timeChange = fieldChanges.find(c => c.field === 'releaseTime');

  let summaryText = 'Release schedule rescheduled by official TTD announcement.';
  if (dateChange && timeChange) {
    summaryText = `Release schedule rescheduled from ${dateChange.previousValue} ${timeChange.previousValue} to ${dateChange.newValue} ${timeChange.newValue}.`;
  } else if (dateChange) {
    summaryText = `Release date rescheduled from ${dateChange.previousValue} to ${dateChange.newValue}.`;
  } else if (timeChange) {
    summaryText = `Release time rescheduled from ${timeChange.previousValue} to ${timeChange.newValue}.`;
  }

  const updatedEvent: ReleaseEvent = {
    ...incomingEvent,
    isUpdated: true,
    previousReleaseDate: existingEvent.releaseDate,
    previousReleaseTime: existingEvent.releaseTime,
    changeNotes: summaryText,
  };

  return {
    hasChanged: true,
    previousReleaseDate: existingEvent.releaseDate,
    previousReleaseTime: existingEvent.releaseTime,
    changeNotes: summaryText,
    fieldChanges,
    summaryText,
    updatedEvent,
  };
}
