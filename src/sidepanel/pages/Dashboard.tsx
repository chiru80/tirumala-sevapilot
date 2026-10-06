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
} from '../hooks';

import { getWorkflowById } from '../../services/workflows/registry';
import { BookingFlowTracker } from '../components/BookingFlowTracker';
import {
  TtdStatusCard,
  ActiveProfileCard,
  ReadinessCard,
  PrimaryAction,
  PilgrimSelection,
  AutofillProgress,
  AutofillResult,
  RepairPanel,
  QuickActions,
  PrivacyBadge,
  DiagnosticModal,
  ReleaseCountdownCard,
  BookingPreparationCard,
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
    status: ttdStatus,
    pageDetected,
    serviceName,
    serviceType,
    scanResult,
    currentTime,
    countdown,
    scanPage,
    openTtdWebsite,
    checkPageState,
  } = useTtdPage();

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
  } = useProfiles(serviceType);

  const readiness = useReadiness(
    activeProfile,
    selectedPilgrims,
    serviceType,
    pageDetected,
    scanResult,
  );

  const activeWorkflow = getWorkflowById(serviceType as string);

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
  } = useAutofillSession();

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
    if (!activeProfile) {
      onNavigate?.('profiles');
      return;
    }

    if (selectedPilgrims.length === 0) {
      setFillStatus(t('dashboard.selectDevotees'));
      return;
    }

    // If blocker is General Details mobile, navigate devotee to Profiles tab to complete it
    if (!readiness.hasValidGeneralContact && readiness.allPilgrimsReady) {
      onNavigate?.('profiles');
      return;
    }

    // If repair mode is active
    if (fillStage.stage === 'complete' && pilgrimReports.some(p => !p.allValidated)) {
      const failedIndices = pilgrimReports.filter(p => !p.allValidated).map(p => p.pilgrimIndex);
      const pilgrimsToRepair = selectedPilgrims.filter((_, idx) => failedIndices.includes(idx));
      const targetList = pilgrimsToRepair.length > 0 ? pilgrimsToRepair : selectedPilgrims;
      const settings = await getSettings();
      await handleRepairMissing(targetList, activeProfile, scanResult || {
        url: '',
        serviceType,
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

  // Keyboard Shortcuts Hook
  useDashboardShortcuts({
    onToggleCommandCenter: dialogs.toggleCommandCenter,
    onTriggerFill: handlePrimaryAction,
    canTriggerFill: Boolean(readiness.isReady && !isFilling),
    onToggleDiagnostics: dialogs.toggleDiagnostics,
  });

  // Flow Tracker Step
  const currentTrackerStep: 1 | 2 | 3 | 4 | 5 = !pageDetected
    ? 1
    : selectedPilgrims.length === 0
    ? 2
    : isFilling
    ? 3
    : fillStage.stage === 'complete' && pilgrimReports.some(p => !p.allValidated)
    ? 4
    : fillStage.stage === 'complete' && pilgrimReports.length > 0 && pilgrimReports.every(p => p.allValidated)
    ? 5
    : 3;

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

  const allVerified = pilgrimReports.length > 0 && pilgrimReports.every(p => p.allValidated);
  const isComplete = fillStage.stage === 'complete' && pilgrimReports.length > 0;

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Flow Tracker */}
      <BookingFlowTracker
        currentStep={currentTrackerStep}
        pageDetected={pageDetected}
        serviceDetected={Boolean(pageDetected && serviceName)}
        formDetected={Boolean(scanResult && (scanResult.totalFields > 0 || (scanResult.mappedFields && scanResult.mappedFields.length > 0)))}
      />

      {/* 1. TTD Connection & Service Status */}
      <TtdStatusCard
        status={ttdStatus}
        serviceName={serviceName}
        currentTime={currentTime}
        countdown={countdown}
        onOpenTtd={openTtdWebsite}
      />

      {/* 2. Official TTD Release Countdown */}
      <ReleaseCountdownCard
        serviceId={activeWorkflow?.serviceId}
        onOpenTtd={openTtdWebsite}
      />

      {/* 3. Booking Preparation Checklist & Status */}
      <BookingPreparationCard
        profile={activeProfile}
        selectedPilgrims={selectedPilgrims}
        readiness={{
          score: readiness.score,
          isComplete: readiness.isReady,
          isProfileReady: Boolean(readiness.allPilgrimsReady),
          isBookingReady: readiness.isReady,
          pilgrimCount: selectedPilgrims.length,
          readyPilgrimsCount: readiness.readyPilgrims,
          checks: [],
          missingFields: readiness.missingDetails,
          recommendations: readiness.recommendations,
        }}
        serviceId={activeWorkflow?.serviceId}
        onPrepare={() => {
          if (!activeProfile) onNavigate?.('profiles');
        }}
      />

      {/* 4. Active Profile Card */}
      <ActiveProfileCard
        profile={activeProfile}
        selectedCount={selectedPilgrims.length}
        health={profileHealth}
        onChangeProfile={() => onNavigate?.('profiles')}
      />


      {/* 3. Service-Aware Pilgrim Selection */}
      {activeProfile && activeProfile.pilgrims && activeProfile.pilgrims.length > 0 && (
        <PilgrimSelection
          pilgrims={activeProfile.pilgrims}
          selectedIds={selectedPilgrimIds}
          onToggle={(id) => togglePilgrimSelection(serviceType, id)}
          onSelectAll={() => selectAllPilgrims(serviceType)}
          onDeselectAll={() => deselectAllPilgrims(serviceType)}
          onEditPilgrim={() => onNavigate?.('profiles')}
          maxAllowed={activeWorkflow?.maxPilgrims}
          exactCount={activeWorkflow?.exactPilgrims}
        />
      )}

      {/* 4. Booking Readiness Assessment */}
      <ReadinessCard
        readiness={readiness}
        onFixProfile={() => onNavigate?.('profiles')}
      />

      {/* 5. Primary Action [ ⚡ FILL & VERIFY ] */}
      <PrimaryAction
        isReady={readiness.isReady}
        isFilling={isFilling}
        isComplete={isComplete}
        allVerified={allVerified}
        onClick={handlePrimaryAction}
        onStop={handleEmergencyStop}
        disabledReason={
          !pageDetected
            ? t('dashboard.openSupportedPage')
            : !activeProfile
            ? t('dashboard.selectProfile')
            : selectedPilgrims.length === 0
            ? t('dashboard.selectDevotees')
            : !readiness.allPilgrimsReady
            ? t('dashboard.fixProfile')
            : !readiness.hasValidGeneralContact
            ? t('dashboard.completeGeneralDetails')
            : !readiness.isReady
            ? t('dashboard.fixProfile')
            : undefined
        }
      />

      {/* 6. Autofill Status Notice Banner */}
      {fillStatus && (
        <div
          className={`p-3.5 rounded-2xl text-xs border transition-all ${
            statusType === 'success'
              ? 'bg-[#F2FBF6] border-[#2F8F68]/30 text-[#1B5E20] dark:bg-[#1B3E2B]/30 dark:text-[#A5D6A7]'
              : statusType === 'warning'
              ? 'bg-[#FFFBF0] border-[#C98A18]/30 text-[#8D6E18] dark:bg-[#3D2F1B]/30 dark:text-[#FFE082]'
              : statusType === 'error'
              ? 'bg-[#FFF5F5] border-[#B64747]/30 text-[#B64747] dark:bg-[#4E1C1C]/30 dark:text-[#EF9A9A]'
              : 'bg-[#F5F0FA] border-[#54258A]/20 text-[#3E1B68] dark:bg-[#2A1733] dark:text-[#E1BEE7]'
          }`}
        >
          <div className="flex items-start gap-2.5">
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

      {/* 7. Live Autofill Progress */}
      {isFilling && (
        <AutofillProgress
          currentPilgrim={currentProgressPilgrim}
          totalPilgrims={selectedPilgrims.length}
          currentField={currentProgressField}
          onCancel={handleEmergencyStop}
        />
      )}

      {/* 8. Autofill Verification Result */}
      {isComplete && !isFilling && (
        <AutofillResult
          pilgrimReports={pilgrimReports}
          onRepair={handlePrimaryAction}
        />
      )}

      {/* 9. Targeted Field Repair Panel */}
      {isComplete && !isFilling && !allVerified && (
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

      {/* 10. Quick Actions */}
      <QuickActions
        onNavigate={(page) => onNavigate?.(page)}
        onOpenPrivacy={() => dialogs.openSessionHistory()}
      />

      {/* 11. Privacy Badge & Keyboard Shortcut */}
      <div className="flex items-center justify-between pt-1">
        <PrivacyBadge />
        <span className="text-xs text-[#6F6477] dark:text-[#A692B4] font-medium">
          {t('dashboard.shortcutHint')}
        </span>
      </div>

      {/* Modals & Dialogs */}
      <PreFlightModal
        isOpen={dialogs.isPreFlightOpen}
        onClose={dialogs.closePreFlight}
        onProceed={executeFillAutofill}
        onFixDetails={() => {
          dialogs.closePreFlight();
          onNavigate?.('profiles');
        }}
        serviceName={serviceName}
        activeProfile={activeProfile}
        report={generatePreFlightReport()}
        fieldCount={scanResult?.mappedFields.length || selectedPilgrims.length * 5}
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
          serviceId: activeWorkflow?.serviceId || (serviceType ? String(serviceType) : undefined),
          serviceName: activeWorkflow?.serviceName || serviceName,
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
