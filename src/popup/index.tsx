import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { getProfiles, getSettings } from '@storage/repository';
import type { Profile, Pilgrim, TtdTemporaryLockState } from '@shared/types';
import { MessageType } from '@shared/types';
import { t, useI18n, setLanguage, type Language } from '@i18n/index';
import type { AutofillProgress, AutofillManagerResult } from '../content/autofill/types';

export type ViewState = 'HOME' | 'FILLING' | 'SUCCESS' | 'ATTENTION' | 'TEMPORARY_LOCK';

interface FailedFieldItem {
  pilgrimIndex?: number;
  pilgrimName?: string;
  field: string;
  fieldLabel: string;
  error: string;
}

function PopupApp() {
  const { language } = useI18n();
  const [viewState, setViewState] = useState<ViewState>('HOME');
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [pageDetected, setPageDetected] = useState(false);
  const [targetTabId, setTargetTabId] = useState<number | undefined>(undefined);
  const [fieldsDetectedCount, setFieldsDetectedCount] = useState<number>(0);
  const [progress, setProgress] = useState<AutofillProgress | null>(null);
  const [result, setResult] = useState<AutofillManagerResult | null>(null);
  const [failedItems, setFailedItems] = useState<FailedFieldItem[]>([]);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
  const [lockState, setLockState] = useState<TtdTemporaryLockState | null>(null);

  useEffect(() => {
    init();

    // Listen for progress messages from content script during autofill
    const listener = (msg: any) => {
      if (msg?.type === MessageType.AUTOFILL_PROGRESS && msg.payload) {
        setProgress(msg.payload as AutofillProgress);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function init() {
    try {
      const profiles = await getProfiles();
      const validProfiles = (profiles || []).filter((p): p is Profile => p != null && typeof p === 'object');
      const def = validProfiles.find(p => p.isDefault) ?? validProfiles[0] ?? null;
      setActiveProfile(def);

      let isTTD = false;
      if (chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setTargetTabId(tab?.id);
        const url = tab?.url || '';
        isTTD = url.includes('ttdevasthanams.ap.gov.in') || url.includes('tirupatibalaji.ap.gov.in');
        setPageDetected(isTTD);

        if (isTTD && tab?.id) {
          const scanRes = await chrome.runtime.sendMessage({
            type: MessageType.REQUEST_SCAN,
            payload: null,
            targetTabId: tab.id,
            timestamp: new Date().toISOString(),
          }).catch(() => null);

          if (scanRes?.success && scanRes.data) {
            setFieldsDetectedCount(scanRes.data.mappedFields?.length || 0);
            if (scanRes.data.temporaryLock) {
              setLockState(scanRes.data.temporaryLock);
              setViewState('TEMPORARY_LOCK');
            }
          }
        }
      }

      // Check readiness
      const missing: string[] = [];
      if (!isTTD) {
        missing.push('Open a TTD booking page in your browser');
      }

      const pilgrims = def?.pilgrims || [];
      if (pilgrims.length === 0) {
        missing.push('Add pilgrims to your profile');
      } else if (pilgrims.length > 6) {
        missing.push('Select up to 6 pilgrims (maximum 6 supported by TTD)');
      } else {
        // Verify required data
        const incomplete = pilgrims.filter(p => !p.fullName && (!p.firstName || !p.lastName));
        if (incomplete.length > 0) {
          missing.push(`Complete name for ${incomplete.length} pilgrim(s)`);
        }
        const missingIds = pilgrims.filter(p => !p.idNumber);
        if (missingIds.length > 0) {
          missing.push(`Enter ID numbers for ${missingIds.length} pilgrim(s)`);
        }
      }

      setMissingRequirements(missing);
    } catch {
      setMissingRequirements(['Unable to inspect browser tab']);
    }
  }

  const pilgrims: Pilgrim[] = activeProfile?.pilgrims || [];
  const isReady = missingRequirements.length === 0 && pilgrims.length > 0 && pilgrims.length <= 6;

  async function handleFillAndVerify(onlyRepair: boolean = false, targetItems?: FailedFieldItem[]) {
    if (!isReady && !onlyRepair) return;

    setViewState('FILLING');
    setProgress({
      state: 'DETECT_STEP',
      currentPilgrimIndex: 0,
      totalPilgrims: pilgrims.length,
      currentField: 'Starting verification...',
      pilgrimResults: [],
      generalResults: [],
      errors: [],
      startedAt: Date.now(),
      elapsedMs: 0,
      percent: 10,
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_FILL,
        payload: {
          pilgrims,
          profile: activeProfile,
          onlyRepairFailed: onlyRepair,
          targetFailedItems: targetItems || failedItems,
        },
        targetTabId,
        timestamp: new Date().toISOString(),
      });

      const res: AutofillManagerResult = response?.managerResult || {
        success: response?.success ?? false,
        state: response?.success ? 'COMPLETE' : 'ERROR',
        step: 'pilgrim',
        pilgrimResults: [],
        generalResults: [],
        totalVerified: response?.success ? (pilgrims.length * 5) : 0,
        totalFailed: response?.success ? 0 : 1,
        totalFields: pilgrims.length * 5,
        durationMs: 0,
        errors: response?.error ? [response.error] : [],
        needsAttention: !response?.success,
        failedItems: [],
      };

      setResult(res);

      if (response?.temporaryLock || res.temporaryLock || res.state === 'TTD_TEMPORARY_BOOKING_LOCK') {
        const lock = response?.temporaryLock || res.temporaryLock;
        setLockState(lock || {
          status: 'temporary-lock',
          detectedAt: Date.now(),
          detectedAtIso: new Date().toISOString(),
          message: 'Your previous booking attempt is still holding this pilgrim.',
          supportingMessage: 'TTD usually releases the lock after a few minutes.',
          hasExplicitTimer: false,
        });
        setViewState('TEMPORARY_LOCK');
        return;
      }

      if (res.success && res.totalFailed === 0) {
        setViewState('SUCCESS');
      } else {
        // Collect failed fields
        const failures: FailedFieldItem[] = res.failedItems && res.failedItems.length > 0
          ? res.failedItems
          : (res.errors || []).map((err, i) => ({
              pilgrimIndex: 0,
              pilgrimName: pilgrims[0]?.fullName || 'Pilgrim',
              field: 'field',
              fieldLabel: 'Field',
              error: err,
            }));
        setFailedItems(failures);
        setViewState('ATTENTION');
      }
    } catch {
      setViewState('ATTENTION');
      setFailedItems([{
        field: 'system',
        fieldLabel: 'Connection',
        error: 'Communication interrupted with TTD tab',
      }]);
    }
  }

  async function handleCancel() {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.STOP_AUTOFILL,
        payload: null,
        targetTabId,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Best effort
    }
    setViewState('HOME');
  }

  function openSidePanel() {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
    });
    window.close();
  }

  return (
    <div key={language} className="w-[360px] p-4 bg-white dark:bg-[#211526] text-gray-900 dark:text-[#F8EFD8] font-sans border border-gray-200 dark:border-gold-500/20 shadow-md rounded-2xl flex flex-col gap-3.5 selection:bg-purple-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gold-500/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#D4A72C] via-[#FFD700] to-[#8D6E18] p-[1.5px] shadow-xs shrink-0">
            <img
              src="/icons/icon48.png"
              alt="SevaPilot"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <h1 className="text-base font-bold text-[#5B2A86] dark:text-[#F8EFD8] tracking-tight">{t('popup.title')}</h1>
        </div>
        <button
          onClick={openSidePanel}
          className="text-xs font-semibold text-gray-500 dark:text-[#A692B4] hover:text-[#5B2A86] dark:hover:text-gold-300 transition-colors cursor-pointer px-2 py-1 rounded-lg border border-gray-200 dark:border-gold-500/20"
          title={t('popup.openSidepanel')}
        >
          {t('popup.sidepanel')} ↗
        </button>
      </div>

      {/* ─── HOME VIEW ─── */}
      {viewState === 'HOME' && (
        <div className="flex flex-col gap-3">
          {/* TTD Page Status */}
          <div className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2D1A38] border border-gray-100 dark:border-gold-500/20">
            <span className={`w-2.5 h-2.5 rounded-full ${pageDetected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className={pageDetected ? 'text-gray-800 dark:text-gray-200 font-semibold' : 'text-gray-600 dark:text-gray-400'}>
              {pageDetected ? t('popup.pageDetected') : t('popup.pageNotDetected')}
            </span>
          </div>

          {/* Devotees Overview */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gold-500/25 bg-white dark:bg-[#2D1A38]">
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {activeProfile?.name || 'Family'}
              </div>
              <div className="text-xs text-gray-500 dark:text-[#A692B4] mt-0.5">
                {pilgrims.length > 0
                  ? t('popup.pilgrimsSelected', { count: pilgrims.length, plural: pilgrims.length > 1 ? 's' : '' })
                  : t('popup.noPilgrimsSelected')}
              </div>
            </div>
            <div className="text-xs font-bold text-purple-700 dark:text-gold-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-800/40">
              {t('popup.maxAllowed', { count: pilgrims.length })}
            </div>
          </div>

          {/* Readiness Status */}
          {isReady ? (
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span>✓</span>
              <span>{t('popup.detailsReady')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
              <span className="font-bold text-sm text-amber-900 dark:text-amber-200">{t('popup.beforeFilling')}</span>
              <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-1">
                {missingRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Exactly One Dominant Primary Action */}
          <button
            onClick={() => handleFillAndVerify(false)}
            disabled={!isReady}
            className={`w-full min-h-[48px] rounded-xl font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#D4A72C] ${
              isReady
                ? 'bg-gradient-to-r from-[#5B2A86] via-[#4A2070] to-[#3B1758] hover:opacity-95 active:scale-[0.99] text-white border border-gold-500/40'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
            }`}
          >
            <span>⚡</span>
            <span>{t('popup.fillAndVerify')}</span>
          </button>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-3 pt-1 text-xs font-semibold text-gray-500 dark:text-[#A692B4] border-t border-gray-100 dark:border-gold-500/15">
            <button onClick={openSidePanel} className="hover:text-[#5B2A86] dark:hover:text-gold-300 cursor-pointer py-1">{t('nav.pilgrims')}</button>
            <span>•</span>
            <button onClick={openSidePanel} className="hover:text-[#5B2A86] dark:hover:text-gold-300 cursor-pointer py-1">{t('nav.profiles')}</button>
            <span>•</span>
            <button onClick={openSidePanel} className="hover:text-[#5B2A86] dark:hover:text-gold-300 cursor-pointer py-1">{t('dashboard.privacy')}</button>
            <span>•</span>
            <button onClick={openSidePanel} className="hover:text-[#5B2A86] dark:hover:text-gold-300 cursor-pointer py-1">{t('nav.settings')}</button>
          </div>
        </div>
      )}

      {/* ─── FILLING UI ─── */}
      {viewState === 'FILLING' && (
        <div className="flex flex-col gap-3.5 py-1">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('popup.fillingDetails')}</h2>
            <p className="text-xs text-gray-500 dark:text-[#A692B4] mt-0.5">
              {t('popup.pilgrimProgress', {
                current: Math.min((progress?.currentPilgrimIndex ?? 0) + 1, pilgrims.length || 1),
                total: pilgrims.length || 1,
              })}
            </p>
          </div>

          {/* Field Checklist */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50 dark:bg-[#2D1A38] border border-gray-200 dark:border-gold-500/20 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
              <span className="text-gray-800 dark:text-gray-200">{t('pilgrim.fullName')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
              <span className="text-gray-800 dark:text-gray-200">{t('pilgrim.age')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
              <span className="text-gray-800 dark:text-gray-200">{t('pilgrim.gender')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#5B2A86] dark:text-gold-300 animate-spin font-bold">⟳</span>
              <span className="text-gray-900 dark:text-white font-medium">{t('pilgrim.idType')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300 dark:text-gray-600 font-bold">○</span>
              <span className="text-gray-400 dark:text-gray-500">{t('pilgrim.idNumber')}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5B2A86] to-[#D4A72C] transition-all duration-200"
              style={{ width: `${progress?.percent ?? 40}%` }}
            />
          </div>

          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* ─── SUCCESS UI ─── */}
      {viewState === 'SUCCESS' && (
        <div className="flex flex-col gap-3.5 py-1">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span>✓</span>
            <span>{t('popup.allDetailsVerified')}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 px-1 font-semibold">
            <span>{pilgrims.length} / {pilgrims.length} pilgrims</span>
            <span>{pilgrims.length * 5} / {pilgrims.length * 5} fields</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">100%</span>
          </div>

          {/* List of Verified Pilgrims */}
          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-gray-50 dark:bg-[#2D1A38] border border-gray-200 dark:border-gold-500/20 max-h-36 overflow-y-auto">
            {pilgrims.map((p, idx) => (
              <div key={p.id || idx} className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 py-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                <span className="truncate">Pilgrim {idx + 1}: {p.fullName || `${p.firstName} ${p.lastName}`}</span>
              </div>
            ))}
          </div>

          {/* Safeguard Notes */}
          <div className="text-xs text-gray-500 dark:text-[#A692B4] bg-gray-50 dark:bg-[#2D1A38] p-2.5 rounded-xl border border-gray-200 dark:border-gold-500/20 space-y-1">
            <p className="font-semibold text-gray-800 dark:text-gray-200">{t('popup.reviewNotice')}</p>
          </div>

          <button
            onClick={() => setViewState('HOME')}
            className="w-full min-h-[44px] rounded-xl font-bold text-sm bg-[#5B2A86] text-white hover:bg-[#4A2070] transition-colors cursor-pointer"
          >
            {t('popup.done')}
          </button>
        </div>
      )}

      {/* ─── FAILURE / ATTENTION UI ─── */}
      {viewState === 'ATTENTION' && (
        <div className="flex flex-col gap-3.5 py-1">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800">
            <span>⚠</span>
            <span>{t('popup.detailsNeedAttention')}</span>
          </div>

          {/* Failed Items List */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-[#2D1A38] border border-gray-200 dark:border-gold-500/20 max-h-40 overflow-y-auto">
            {failedItems.map((item, idx) => (
              <div key={idx} className="text-xs border-b border-gray-200/60 dark:border-gray-700 pb-1.5 last:border-b-0 last:pb-0">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {item.pilgrimName || `Pilgrim ${(item.pilgrimIndex ?? 0) + 1}`}
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">{item.fieldLabel}</div>
                <div className="text-xs text-red-600 dark:text-red-400">{item.error || 'Could not verify'}</div>
              </div>
            ))}
          </div>

          {/* Repair Action: retries ONLY failed fields */}
          <button
            onClick={() => handleFillAndVerify(true, failedItems)}
            className="w-full min-h-[44px] rounded-xl font-bold text-sm bg-[#5B2A86] text-white hover:bg-[#4A2070] transition-colors cursor-pointer shadow-xs"
          >
            {t('popup.repairMissing')}
          </button>

          <button
            onClick={() => setViewState('HOME')}
            className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
          >
            {t('popup.backToHome')}
          </button>
        </div>
      )}

      {/* ─── TEMPORARY LOCK UI ─── */}
      {viewState === 'TEMPORARY_LOCK' && (
        <div className="flex flex-col gap-3.5 py-1">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800">
            <span>⚠</span>
            <span>TTD TEMPORARY LOCK</span>
          </div>

          <div className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100 bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <p className="font-bold">
              {lockState?.message || 'Your previous booking attempt is still holding this pilgrim.'}
            </p>
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              {lockState?.supportingMessage || 'TTD usually releases the temporary lock after a few minutes.'}
            </p>
          </div>

          <button
            onClick={() => {
              chrome.tabs?.create?.({ url: 'https://ttdevasthanams.ap.gov.in/booking-history' });
            }}
            className="w-full min-h-[44px] rounded-xl font-bold text-sm bg-[#5B2A86] text-white hover:bg-[#4A2070] transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <span>📜</span>
            <span>Check Booking History</span>
          </button>
          <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 font-medium">
            Make sure the previous attempt did not create a booking.
          </p>

          <button
            onClick={() => setViewState('HOME')}
            className="w-full min-h-[40px] rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export async function bootstrapPopup() {
  try {
    const settings = await getSettings();
    const validLanguages: Language[] = ['en', 'te', 'hi', 'ta', 'kn'];
    if (settings?.language && validLanguages.includes(settings.language as Language)) {
      setLanguage(settings.language as Language);
    }
  } catch {
    // Fallback gracefully
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <PopupApp />
      </React.StrictMode>,
    );
  }
}

bootstrapPopup();
