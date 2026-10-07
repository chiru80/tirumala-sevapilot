// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Floating Page Assistant (Phase 3)
// Draggable, collapsible, position-persisted on-page companion
// ─────────────────────────────────────────────────

import { STORAGE_KEYS } from '@shared/constants';
import { executeAutofill } from './autofill/autofill-manager';
import { detectActiveBookingStep } from './autofill/page-workflow';
import logger from '@shared/logger';

let helperHost: HTMLElement | null = null;

interface Position {
  x: number;
  y: number;
}

export async function injectFloatingHelper(): Promise<void> {
  if (helperHost) return;

  // Check if disabled in settings
  try {
    const settingsRes = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = settingsRes[STORAGE_KEYS.SETTINGS] as any;
    if (settings && settings.floatingHelperEnabled === false) {
      return;
    }
  } catch {
    // Ignore storage read error
  }

  // Retrieve stored position
  let savedPos: Position = { x: window.innerWidth - 220, y: window.innerHeight - 150 };
  try {
    const posRes = await chrome.storage.local.get(STORAGE_KEYS.FLOATING_POS);
    if (posRes[STORAGE_KEYS.FLOATING_POS]) {
      savedPos = posRes[STORAGE_KEYS.FLOATING_POS] as Position;
      // Clamp to window boundaries
      savedPos.x = Math.max(10, Math.min(window.innerWidth - 180, savedPos.x));
      savedPos.y = Math.max(10, Math.min(window.innerHeight - 120, savedPos.y));
    }
  } catch {
    // Fallback to default
  }

  const host = document.createElement('div');
  host.id = 'sevapilot-floating-helper';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483645;';

  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      .sp-card {
        position: fixed;
        width: 190px;
        background: #FFFDF7;
        border: 1.5px solid #D4A72C;
        border-radius: 12px;
        box-shadow: 0 6px 22px rgba(91, 42, 134, 0.22);
        font-family: 'Inter', system-ui, sans-serif;
        color: #321B3F;
        font-size: 11px;
        overflow: hidden;
        user-select: none;
        transition: box-shadow 0.2s ease;
      }
      .sp-card.collapsed {
        width: auto;
        border-radius: 50px;
      }
      .sp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        background: #5B2A86;
        color: #FFFFFF;
        cursor: grab;
      }
      .sp-header:active {
        cursor: grabbing;
      }
      .sp-title {
        font-weight: 700;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .sp-toggle-btn {
        background: none;
        border: none;
        color: #F0CC63;
        font-size: 12px;
        cursor: pointer;
        padding: 0 2px;
      }
      .sp-body {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sp-collapsed-body {
        display: none;
      }
      .sp-card.collapsed .sp-body {
        display: none;
      }
      .sp-card.collapsed .sp-header {
        background: linear-gradient(135deg, #5B2A86, #421B68);
        border-radius: 50px;
        padding: 6px 12px;
      }
      .sp-status {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #2E7D5B;
        font-weight: 600;
        font-size: 10px;
      }
      .sp-autofill-btn {
        width: 100%;
        background: #5B2A86;
        color: #FFFFFF;
        border: 1px solid #D4A72C;
        border-radius: 6px;
        padding: 6px 8px;
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: background 0.15s ease;
      }
      .sp-autofill-btn:hover {
        background: #421B68;
        border-color: #F0CC63;
      }
      .sp-panel-link {
        text-align: center;
        color: #7650A3;
        text-decoration: underline;
        cursor: pointer;
        font-size: 10px;
        margin-top: 2px;
      }
    </style>
    <div class="sp-card" style="left: ${savedPos.x}px; top: ${savedPos.y}px;">
      <div class="sp-header" id="sp-drag-handle" title="Drag to reposition">
        <div class="sp-title">
          <span>🛕</span>
          <span>SevaPilot</span>
        </div>
        <button class="sp-toggle-btn" id="sp-collapse-btn" title="Collapse / Expand">▾</button>
      </div>
      <div class="sp-body">
        <div class="sp-status">
          <span>●</span>
          <span id="sp-status-text">Form Ready</span>
        </div>
        <button class="sp-autofill-btn" id="sp-fill-btn">
          <span>⚡</span>
          <span>Autofill</span>
        </button>
        <div class="sp-panel-link" id="sp-open-panel">Open Side Panel</div>
      </div>
    </div>
  `;

  document.body.appendChild(host);
  helperHost = host;

  const card = shadow.querySelector('.sp-card') as HTMLElement;
  const dragHandle = shadow.querySelector('#sp-drag-handle') as HTMLElement;
  const collapseBtn = shadow.querySelector('#sp-collapse-btn') as HTMLButtonElement;
  const fillBtn = shadow.querySelector('#sp-fill-btn') as HTMLButtonElement;
  const statusText = shadow.querySelector('#sp-status-text') as HTMLElement;
  const openPanelBtn = shadow.querySelector('#sp-open-panel') as HTMLElement;

  // Dragging logic
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initLeft = savedPos.x;
  let initTop = savedPos.y;

  dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initLeft = card.offsetLeft;
    initTop = card.offsetTop;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newX = initLeft + dx;
    let newY = initTop + dy;

    // Bounds check
    newX = Math.max(5, Math.min(window.innerWidth - card.offsetWidth - 5, newX));
    newY = Math.max(5, Math.min(window.innerHeight - card.offsetHeight - 5, newY));

    card.style.left = `${newX}px`;
    card.style.top = `${newY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      // Persist position
      chrome.storage.local.set({
        [STORAGE_KEYS.FLOATING_POS]: { x: card.offsetLeft, y: card.offsetTop },
      }).catch(() => {});
    }
  });

  // Collapse toggle
  collapseBtn.addEventListener('click', () => {
    card.classList.toggle('collapsed');
    collapseBtn.textContent = card.classList.contains('collapsed') ? '▸' : '▾';
  });

  // Robust step-aware autofill trigger function
  let isRunning = false;
  async function triggerAutofillAction() {
    if (isRunning) return;
    isRunning = true;
    fillBtn.disabled = true;
    fillBtn.textContent = 'Filling...';
    if (statusText) statusText.textContent = '⚡ Filling form...';

    logger.info('Floating helper autofill initiated');

    try {
      let pilgrims: any[] = [];
      let profile: any = null;
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
        const rawProfiles = (stored?.[STORAGE_KEYS.PROFILES] as any[]) || [];
        const profiles = Array.isArray(rawProfiles) ? rawProfiles.filter(p => p != null && typeof p === 'object') : [];
        profile = profiles.find((p: any) => p?.isDefault) || profiles[0] || null;
        if (profile && Array.isArray(profile.pilgrims)) {
          pilgrims = profile.pilgrims;
        }
      } catch {}

      const result = await executeAutofill({ doc: document, pilgrims, profile });

      if (result.success) {
        if (statusText) statusText.textContent = `✓ ${result.totalVerified}/${result.totalFields} fields filled`;
        fillBtn.textContent = '✓ Done';
      } else if (result.temporaryLock || result.state === 'TTD_TEMPORARY_BOOKING_LOCK') {
        if (statusText) statusText.textContent = '⏳ TTD Temporary Lock';
        fillBtn.textContent = 'Wait to Retry';
      } else {
        if (statusText) statusText.textContent = result.errors[0] || '⚠ Attention needed';
        fillBtn.textContent = '⚡ Retry';
      }
    } catch (err) {
      logger.error('Floating helper autofill error:', err);
      if (statusText) statusText.textContent = '✕ Fill error';
      fillBtn.textContent = '⚡ Autofill';
    } finally {
      setTimeout(() => {
        isRunning = false;
        fillBtn.disabled = false;
        fillBtn.innerHTML = '<span>⚡</span><span>Autofill</span>';
      }, 2500);
    }
  }

  // Periodic SPA step observer: resets "Form Ready" when transitioning between Pilgrim & General
  let lastObservedStep = detectActiveBookingStep(document);
  setInterval(() => {
    if (isRunning) return;
    const currentStep = detectActiveBookingStep(document);
    if (currentStep !== lastObservedStep) {
      lastObservedStep = currentStep;
      if (currentStep === 'PILGRIM_DETAILS' || currentStep === 'GENERAL_DETAILS') {
        if (statusText) {
          statusText.textContent = 'Form Ready';
        }
        fillBtn.innerHTML = '<span>⚡</span><span>Autofill</span>';
      }
    }
  }, 1000);

  // Fill button click listener
  fillBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await triggerAutofillAction();
  });

  // Event delegation on document
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest?.('#sp-fill-btn, #sevapilot-autofill-button');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    triggerAutofillAction();
  });

  // Open side panel
  openPanelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      payload: {},
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  });

  logger.debug('Floating assistant initialized');
}

export function removeFloatingHelper(): void {
  if (helperHost) {
    helperHost.remove();
    helperHost = null;
  }
}
