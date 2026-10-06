// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Page State Tracker
// ─────────────────────────────────────────────────

import type { PageState } from '@shared/types';
import { ServiceType } from '@shared/types';

let currentState: PageState = {
  url: '',
  isSupported: false,
  formDetected: false,
  fieldCount: 0,
};

export function getPageState(): PageState {
  return { ...currentState };
}

export function updatePageState(update: Partial<PageState>): void {
  currentState = { ...currentState, ...update };
}

export function resetPageState(): void {
  currentState = {
    url: window.location.href,
    isSupported: false,
    formDetected: false,
    fieldCount: 0,
  };
}
