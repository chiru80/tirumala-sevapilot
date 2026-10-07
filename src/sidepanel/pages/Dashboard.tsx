import React from 'react';
import { getSettings } from '@storage/repository';
import type { PreFlightReport } from '@shared/types';
import { t } from '@i18n/index';

import {
  useProfiles,
  useTtdPage,
  useReadiness,
  useAutofillSession,
  useDashboardDialogs,
  useDashboardShortcuts,
  useSessionHistory,
  useBookingContext,
} from '../hooks';

import { getWorkflowById } from '../../services/workflows/registry';
import {
  ActiveProfileCard,
  PrimaryAction,
  PilgrimSelection,
  AutofillProgress,
  AutofillResult,
  RepairPanel,
  QuickActions,
  PrivacyBadge,
  DiagnosticModal,
  ReleaseTicker,
  HowItWorksCard,
  UpcomingReleasesCard,
  TemporaryLockCard,
} from '../components/dashboard';

import { PreFlightModal } from '../components/PreFlightModal';
import { CommandCenter } from '../components/CommandCenter';
import { NotificationCenter } from '../components/NotificationCenter';
import { SessionHistoryModal } from '../components/SessionHistoryModal';

export interface DashboardProps {
  onNavigate?: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  // ─── Domain Hooks ───
  const {
    pageDetected,
    serviceName,
    serviceType,
    serviceId,
    scanResult,
    scanPage,
    openTtdWebsite,
    checkPageState,
    temporaryLock: ttdLock,
    clearTemporaryLock: clearTtdLock,
  } = useTtdPage();

  const effectiveServiceId = serviceId || scanResult?.serviceId;
  const activeWorkflow = effectiveServiceId ? getWorkflowById(effectiveServiceId) : getWorkflowById(serviceType as string);

  const {
    profiles,
    activeProfile,
    health: profileHealth,
    selectedPilgrims,
    selectedPilgrimIds,
    switchProfile,
    togglePilgrimSelection,
    selectAllPilgrims,
    deselectAllPilgrims,
  } = useProfiles(serviceType, effectiveServiceId, activeWorkflow?.maxPilgrims);

  const readiness = useReadiness(
    activeProfile,
    selectedPilgrims,
    serviceType,
    pageDetected,
    scanResult,
    effectiveServiceId,
  );

  const {
    isFilling,
    fillStatus,
    statusType,
    fillStage,
    currentProgressPilgrim,
    currentProgressField,
    pilgrimReports,
    executeFill,
    handleEmergencyStop,
    handleRepairMissing,
    handleRetryField,
    setFillStatus,
    temporaryLock: sessionLock,
    clearTemporaryLock: clearSessionLock,
  } = useAutofillSession();

  const effectiveLock = sessionLock || ttdLock;

  const handleCheckBookingHistory = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      await chrome.tabs.create({ url: 'https://ttdevasthanams.ap.gov.in/booking-history' });
    } else {
      window.open('https://ttdevasthanams.ap.gov.in/booking-history', '_blank', 'noopener,noreferrer');
    }
  };

  const handleRetryAfterLock = async () => {
    setFillStatus(null);
    const updatedScan = await scanPage();
    if (updatedScan?.temporaryLock?.status === 'temporary-lock') {
      return;
    }
    clearSessionLock();
    clearTtdLock();
  };

  const dialogs = useDashboardDialogs();
  const {
    notifications,
    sessionHistory,
    markRead,
    clearAllNotifications,
    clearAllHistory,
  } = useSessionHistory();

  // ─── Primary Fill & Verify Action Handler ───
  const handlePrimaryAction = async () => {
    if (isFilling) return;

    if (!activeProfile) {
      onNavigate?.('profiles');
      return;
    }

    if (selectedPilgrims.length === 0) {
      setFillStatus(t('dashboard.selectPilgrims'));
      return;
    }

    if (!readiness.hasValidGeneralContact && readiness.allPilgrimsReady) {
      onNavigate?.('profiles');
      return;
    }

    // Repair mode for failed fields
    if (fillStage.stage === 'complete' && pilgrimReports.some(p => !p.allValidated)) {
      const failedIndices = pilgrimReports.filter(p => !p.allValidated).map(p => p.pilgrimIndex);
      const pilgrimsToRepair = selectedPilgrims.filter((_, idx) => failedIndices.includes(idx));
      const targetList = pilgrimsToRepair.length > 0 ? pilgrimsToRepair : selectedPilgrims;
      const settings = await getSettings();
      await handleRepairMissing(targetList, activeProfile, scanResult || {
        url: '',
        serviceType,
        serviceId: effectiveServiceId,
        workflowId: activeWorkflow?.workflowId,
        serviceConfidence: 1,
        totalFields: 0,
        mappedFields: [],
        unmappedFields: [],
        pilgrimCardCount: 0,
        formFingerprint: '',
        timestamp: new Date().toISOString(),
      }, settings.autofillMode, serviceName);
      return;
    }

    const settings = await getSettings();
    if (settings.autofillMode !== 'fast' && settings.confirmationMode === 'always-preview') {
      dialogs.openPreFlight();
      return;
    }

    await executeFillAutofill();
  };

  const executeFillAutofill = async () => {
    if (isFilling) return;
    dialogs.closePreFlight();
    if (!activeProfile) return;

    let activeScan = scanResult;
    if (!activeScan || !activeScan.mappedFields || activeScan.mappedFields.length === 0) {
      activeScan = await scanPage();
    }

    const settings = await getSettings();
    await executeFill(
      selectedPilgrims,
      activeProfile,
      activeScan || {
        url: '',
        serviceType,
        serviceId: effectiveServiceId,
        workflowId: activeWorkflow?.workflowId,
        serviceConfidence: 1,
        totalFields: selectedPilgrims.length * 5,
        mappedFields: [],
        unmappedFields: [],
        pilgrimCardCount: selectedPilgrims.length,
        formFingerprint: '',
        timestamp: new Date().toISOString(),
      },
      settings.autofillMode,
      serviceName,
    );
  };

  // ─── Phase 2 Booking Cockpit UI Adapter Hook ───
  const cockpit = useBookingContext({
    activeProfile,
    selectedPilgrims,
    serviceType,
    serviceId: effectiveServiceId,
    pageDetected,
    scanResult,
    workflowId: activeWorkflow?.workflowId,
    readiness,
    isFilling,
    fillStage,
    pilgrimReports,
    temporaryLock: effectiveLock,
    onNavigate,
    openTtdWebsite,
    handlePrimaryAction,
    handleEmergencyStop,
    handleRetryAfterLock,
    handleCheckBookingHistory,
    selectAllPilgrims: (id) => selectAllPilgrims(id || effectiveServiceId || (serviceType ? String(serviceType) : 'special-entry-darshan-300')),
  });

  // Keyboard Shortcuts Hook
  useDashboardShortcuts({
    onToggleCommandCenter: dialogs.toggleCommandCenter,
    onTriggerFill: handlePrimaryAction,
    canTriggerFill: Boolean(readiness.isReady && !isFilling),
    onToggleDiagnostics: dialogs.toggleDiagnostics,
  });

  const generatePreFlightReport = (): PreFlightReport => ({
    ready: readiness.isReady,
    checks: readiness.checks.map(c => ({
      id: c.id,
      label: c.label,
      passed: c.passed,
      severity: c.severity === 'info' ? 'warning' : c.severity,
      details: c.message,
    })),
    errorCount: readiness.checks.filter(c => !c.passed && c.severity === 'error').length,
    warningCount: readiness.checks.filter(c => !c.passed && c.severity === 'warning').length,
  });

  return (
    <div className="space-y-3 pb-4">
      {/* 1. TOP VERIFIED RELEASE TICKER */}
      <ReleaseTicker />

      <div className="px-4 space-y-3">
        {/* 2. TEMPORARY LOCK ALERT BANNER (SERVER-SIDE HOLD) */}
        {cockpit.isLocked && effectiveLock && (
          <div
            className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 p-3 shadow-xs space-y-1.5"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/60 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base text-amber-600 dark:text-amber-400 font-bold">⚠</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  BOOKING STATUS: Temporary TTD lock
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">
                Server-side hold
              </span>
            </div>
            <p className="text-xs text-amber-900 dark:text-amber-100 font-medium">
              Your previous booking attempt is still active. TTD holds the slot temporarily before releasing.
            </p>
          </div>
        )}

        {/* 3. TTD PAGE DETECTED CONTEXTUAL COCKPIT BANNER */}
        {pageDetected && !cockpit.isLocked && (
          <div
            className="rounded-2xl border border-[#2F8F68]/30 bg-[#F2FBF6] dark:bg-[#1B3E2B]/30 p-3 shadow-2xs flex items-center justify-between gap-2 transition-all"
            role="status"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2F8F68] animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F8F68] dark:text-[#4ADE80]">
                    {t('home.ttdPageReady') || 'TTD PAGE READY'}
                  </span>
                  {cockpit.serviceInfo.ticketPrice && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#A5D6A7]">
                      ₹{cockpit.serviceInfo.ticketPrice}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#30213A] dark:text-[#F8EFD8] truncate">
                  {cockpit.serviceInfo.displayName || serviceName || 'Supported TTD Booking'}
                </p>
              </div>
            </div>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                readiness.isReady
                  ? 'bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#A5D6A7]'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
              }`}
            >
              {readiness.isReady
                ? `✓ ${t('home.readyToFill') || 'Ready to fill'}`
                : `⚠ ${t('home.actionRequired') || 'Action required'}`}
            </span>
          </div>
        )}

        {/* 3. DOMINANT PRIMARY CTA (STICKY) */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur pt-1 pb-1">
          <PrimaryAction
            contextState={cockpit.contextState}
            actionLabel={cockpit.primaryAction.label}
            supportingText={cockpit.primaryAction.supportingText}
            secondaryAction={cockpit.primaryAction.secondary}
            isReady={readiness.isReady}
            isFilling={isFilling}
            isComplete={cockpit.isComplete}
            allVerified={cockpit.allVerified}
            isTemporaryLock={cockpit.isLocked}
            onClick={cockpit.primaryAction.onClick}
            onStop={handleEmergencyStop}
            disabledReason={cockpit.primaryAction.supportingText}
          />
        </div>

        {/* 4. SIMPLE "HOW IT WORKS" (COMPACT 4-STEP CARD) */}
        <div id="sp-how-it-works-section">
          <HowItWorksCard />
        </div>

        {/* 5. UPCOMING TTD RELEASES CARD */}
        <UpcomingReleasesCard />

        {/* 6. CONTEXTUAL PROFILE STATUS */}
        <ActiveProfileCard
          profile={activeProfile}
          selectedCount={selectedPilgrims.length}
          health={profileHealth}
          onChangeProfile={() => onNavigate?.('profiles')}
          onManage={() => onNavigate?.('profiles')}
        />

        {/* 7. PILGRIM SELECTION (WHEN ACTIVE ON TTD PAGE OR DEVOTEES AVAILABLE) */}
        {activeProfile && activeProfile.pilgrims && activeProfile.pilgrims.length > 0 && pageDetected && (
          <PilgrimSelection
            pilgrims={activeProfile.pilgrims}
            selectedIds={selectedPilgrimIds}
            onToggle={(id) => togglePilgrimSelection(effectiveServiceId || serviceType, id)}
            onSelectAll={() => selectAllPilgrims(effectiveServiceId || serviceType)}
            onDeselectAll={() => deselectAllPilgrims(effectiveServiceId || serviceType)}
            onEditPilgrim={() => onNavigate?.('profiles')}
            maxAllowed={cockpit.serviceInfo.maxPilgrims}
            exactCount={cockpit.serviceInfo.exactPilgrims}
          />
        )}

        {/* 7. LIVE AUTOFILL PROGRESS & STATUS NOTICE */}
        {isFilling && (
          <AutofillProgress
            currentPilgrim={currentProgressPilgrim}
            totalPilgrims={selectedPilgrims.length}
            currentField={currentProgressField}
            onCancel={handleEmergencyStop}
          />
        )}

        {fillStatus && (
          <div
            className={`p-3 rounded-xl text-xs border transition-all ${
              statusType === 'success'
                ? 'bg-[#F2FBF6] border-[#2F8F68]/30 text-[#1B5E20] dark:bg-[#1B3E2B]/30 dark:text-[#A5D6A7]'
                : statusType === 'warning'
                ? 'bg-[#FFFBF0] border-[#C98A18]/30 text-[#8D6E18] dark:bg-[#3D2F1B]/30 dark:text-[#FFE082]'
                : statusType === 'error'
                ? 'bg-[#FFF5F5] border-[#B64747]/30 text-[#B64747] dark:bg-[#4E1C1C]/30 dark:text-[#EF9A9A]'
                : 'bg-[#F5F0FA] border-[#54258A]/20 text-[#3E1B68] dark:bg-[#2A1733] dark:text-[#E1BEE7]'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="font-bold text-sm shrink-0">
                {statusType === 'success' ? '✓' : statusType === 'warning' ? '⚠' : statusType === 'error' ? '✕' : 'ℹ'}
              </span>
              <div className="flex-1">
                <p className="leading-relaxed font-medium">{fillStatus}</p>
                {statusType === 'error' && (
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    <button onClick={() => scanPage()} className="underline cursor-pointer text-[#54258A] dark:text-[#D4A72C]">
                      {t('dashboard.scanPage')}
                    </button>
                    <button onClick={() => checkPageState()} className="underline cursor-pointer text-[#54258A] dark:text-[#D4A72C]">
                      {t('dashboard.checkingConnection')}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setFillStatus(null)}
                className="text-[#6F6477] hover:text-[#30213A] text-sm font-bold cursor-pointer ml-1 p-0.5"
                aria-label={t('dashboard.cancel')}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 8. AUTOFILL VERIFICATION RESULT & REPAIR PANEL */}
        {cockpit.isComplete && !isFilling && (
          <AutofillResult
            pilgrimReports={pilgrimReports}
            onRepair={handlePrimaryAction}
          />
        )}

        {cockpit.isComplete && !isFilling && !cockpit.allVerified && (
          <RepairPanel
            pilgrimReports={pilgrimReports}
            onRetryField={async (pilgrimIndex, fieldType) => {
              const pilgrim = selectedPilgrims[pilgrimIndex];
              if (!pilgrim || !activeProfile) return;
              const settings = await getSettings();
              await handleRetryField({ pilgrimKey: fieldType, label: fieldType }, [pilgrim], activeProfile, settings.autofillMode);
            }}
            onRepairAll={handlePrimaryAction}
          />
        )}

        {/* 9. BOOKING READINESS (CLEAN CONSUMER-LEVEL STATUS — ZERO PERCENTAGES) */}
        <div
          className="pt-1 flex items-center justify-between text-xs text-[#6F6477] dark:text-[#A692B4]"
          role="region"
          aria-label={t('dashboard.bookingReadiness') || 'Booking Readiness'}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                readiness.isReady ? 'bg-[#2F8F68]' : 'bg-[#C98A18]'
              }`}
            />
            <span className="font-semibold">
              {t('dashboard.bookingReadiness') || 'Booking Readiness'}:{' '}
              <span className={readiness.isReady ? 'text-[#1B5E20] dark:text-[#A5D6A7]' : 'text-[#8D6E18] dark:text-[#FFE082]'}>
                {readiness.isReady ? (t('dashboard.ready') || 'Ready') : (t('home.actionRequired') || 'Action required')}
              </span>
            </span>
          </div>
        </div>

        {/* 10. QUICK ACTIONS */}
        <QuickActions
          onNavigate={(page) => onNavigate?.(page)}
          onOpenBookingHistory={handleCheckBookingHistory}
          onOpenPrivacy={() => dialogs.openSessionHistory()}
        />

        {/* 11. PRIVACY BADGE & FOOTER SHORTCUT HINT */}
        <div className="flex items-center justify-between pt-1">
          <PrivacyBadge />
          <span className="text-xs text-[#6F6477] dark:text-[#A692B4] font-medium">
            {t('dashboard.shortcutHint')}
          </span>
        </div>
      </div>

      {/* ─── Modals & Dialogs (Loaded on Demand) ─── */}
      <PreFlightModal
        isOpen={dialogs.isPreFlightOpen}
        onClose={dialogs.closePreFlight}
        onProceed={executeFillAutofill}
        onFixDetails={() => {
          dialogs.closePreFlight();
          onNavigate?.('profiles');
        }}
        serviceName={cockpit.serviceInfo.displayName}
        activeProfile={activeProfile}
        report={generatePreFlightReport()}
        fieldCount={scanResult?.mappedFields?.length || selectedPilgrims.length * 5}
      />

      <CommandCenter
        isOpen={dialogs.isCommandCenterOpen}
        onClose={dialogs.closeCommandCenter}
        profiles={profiles}
        onSelectProfile={(p) => switchProfile(p.id)}
        onNavigate={(tab) => onNavigate?.(tab)}
        onTriggerAutofill={handlePrimaryAction}
        onScanPage={scanPage}
      />

      <NotificationCenter
        isOpen={dialogs.isNotificationCenterOpen}
        onClose={dialogs.closeNotificationCenter}
        notifications={notifications}
        onMarkRead={markRead}
        onClearAll={clearAllNotifications}
        onNavigate={(tab) => onNavigate?.(tab)}
      />

      <SessionHistoryModal
        isOpen={dialogs.isSessionHistoryOpen}
        onClose={dialogs.closeSessionHistory}
        sessions={sessionHistory}
        onClearHistory={clearAllHistory}
      />

      <DiagnosticModal
        isOpen={dialogs.showDiagnostics}
        onClose={dialogs.toggleDiagnostics}
        data={{
          ttdDetected: pageDetected,
          serviceId: cockpit.serviceInfo.serviceId,
          serviceName: cockpit.serviceInfo.displayName,
          workflowVersion: activeWorkflow?.workflowVersion || '1.0.0',
          currentStep: fillStage.stage.toUpperCase(),
          rowsDetected: scanResult?.pilgrimCardCount || selectedPilgrims.length,
          fieldsDetected: scanResult?.totalFields || selectedPilgrims.length * 5,
          fieldsVerified: pilgrimReports.reduce((acc, p) => acc + Object.values(p.fields).filter((f: any) => f?.validated).length, 0),
          confidence: readiness?.score || 0,
          durationMs: 0,
          failureReason: (statusType === 'error' && fillStatus) ? fillStatus : undefined,
        }}
      />
    </div>
  );
}
