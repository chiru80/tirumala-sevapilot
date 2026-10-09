import React, { useState, useEffect } from 'react';
import { getSettings } from '@storage/repository';
import type { PreFlightReport } from '@shared/types';
import { t } from '@i18n/index';
import { safeOpenUrl } from '../../security/url-security';

import {
  useProfiles,
  useTtdPage,
  useReadiness,
  useAutofillSession,
} from '../hooks';

import { getWorkflowById } from '../../services/workflows/registry';
import { queueManager, type QueueSession, type QueueDetectionResult } from '../../services/queue';

// Phase 13 Design System & Presentation Layer
import { Badge, Button, Icon, Card } from '../design-system';
import { computeNextAction } from '../presentation/next-action';
import { testProfileReadiness } from '../presentation/profile-readiness-tester';
import { NextActionCard } from '../components/dashboard/NextActionCard';
import { BookingActionArea } from '../components/dashboard/BookingActionArea';
import { BookingReadinessSummary } from '../components/dashboard/BookingReadinessSummary';
import { BookingModeView } from '../components/dashboard/BookingModeView';
import { ServiceSelectorModal } from '../components/dashboard/ServiceSelectorModal';
import { TestProfileModal } from '../components/dashboard/TestProfileModal';
import { AutofillProgress } from '../components/dashboard/AutofillProgress';
import { AutofillResult } from '../components/dashboard/AutofillResult';
import { QueueCard } from '../components/dashboard/QueueCard';
import { PreFlightModal } from '../components/PreFlightModal';
import { UpcomingReleasesCard } from '../components/dashboard/UpcomingReleasesCard';
import { ActiveProfileCard } from '../components/dashboard/ActiveProfileCard';
import { HowItWorksCard } from '../components/dashboard/HowItWorksCard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { PrivacyBadge } from '../components/dashboard/PrivacyBadge';

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
    temporaryLock: ttdLock,
    clearTemporaryLock: clearTtdLock,
  } = useTtdPage();

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    serviceId || scanResult?.serviceId || ''
  );
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isTestProfileOpen, setIsTestProfileOpen] = useState(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isBookingMode, setIsBookingMode] = useState(false);

  // Sync selected service when TTD page detection detects a specific service
  useEffect(() => {
    if (serviceId) {
      setSelectedServiceId(serviceId);
    } else if (scanResult?.serviceId) {
      setSelectedServiceId(scanResult.serviceId);
    }
  }, [serviceId, scanResult?.serviceId]);

  const activeWorkflow = selectedServiceId ? getWorkflowById(selectedServiceId) : undefined;
  const effectiveDisplayName =
    serviceName ||
    activeWorkflow?.serviceName ||
    (selectedServiceId ? selectedServiceId : (t('readiness.unknownServiceName') || 'TTD Portal Service (Unspecified)'));

  const {
    profiles,
    activeProfile,
    health: profileHealth,
    selectedPilgrims,
    selectAllPilgrims,
    switchProfile,
  } = useProfiles(serviceType, selectedServiceId, activeWorkflow?.maxPilgrims);

  const readiness = useReadiness(
    activeProfile,
    selectedPilgrims,
    serviceType,
    pageDetected,
    scanResult,
    selectedServiceId,
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
    setFillStatus,
    temporaryLock: sessionLock,
    clearTemporaryLock: clearSessionLock,
  } = useAutofillSession();

  const effectiveLock = sessionLock || ttdLock;

  // ─── Queue Intelligence State & Observer ───
  const [queueSession, setQueueSession] = useState<QueueSession | null>(() => queueManager.getActiveSession());

  useEffect(() => {
    const unsubscribe = queueManager.onStateChange((session) => {
      setQueueSession({ ...session });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const sr = scanResult as any;
    if (sr?.isQueuePresent || sr?.stage === 'DIGITAL_QUEUE') {
      const active = queueManager.getActiveSession();
      if (!active || active.state === 'QUEUE_UNKNOWN' || active.state === 'QUEUE_NOT_PRESENT') {
        const detection: QueueDetectionResult = sr?.queueInfo || {
          state: 'QUEUE_WAITING',
          isQueuePresent: true,
          confidence: 100,
          reasons: ['guardian_stage'],
          isCaptchaPresent: false,
          isSessionExpired: false,
          isTemporaryLock: false,
        };
        queueManager.recordDetection(detection);
      }
    }
  }, [scanResult]);

  const handleFullEmergencyStop = () => {
    queueManager.emergencyStop();
    setQueueSession(null);
    handleEmergencyStop();
  };

  const handleQueueStopMonitoring = () => {
    queueManager.stopMonitoring();
    setQueueSession(null);
  };

  const handleQueueManualRefresh = async () => {
    await scanPage();
  };

  // ─── Profile Readiness Report ───
  const readinessReport = testProfileReadiness(activeProfile, selectedPilgrims, selectedServiceId);

  // ─── Compute Next Action ───
  const nextAction = computeNextAction({
    activeProfile,
    selectedPilgrims,
    serviceId: selectedServiceId,
    serviceDisplayName: effectiveDisplayName,
    pageDetected,
    productState: isFilling
      ? 'WORKING'
      : fillStage.stage === 'complete'
      ? 'COMPLETED'
      : effectiveLock
      ? 'BLOCKED'
      : pageDetected && readiness.isReady
      ? 'READY'
      : !pageDetected && (readiness.allPilgrimsReady || readiness.isReady || (activeProfile && selectedPilgrims.length > 0))
      ? 'READY'
      : 'USER_ACTION_REQUIRED',
    fillStage,
    temporaryLock: effectiveLock,
    queueSession,
    readiness,
  });

  // ─── Action Handlers ───
  const handlePrimaryActionTrigger = async () => {
    if (isFilling) {
      handleFullEmergencyStop();
      return;
    }

    switch (nextAction.primaryAction.actionType) {
      case 'NAVIGATE_PROFILE':
        onNavigate?.('profiles');
        break;

      case 'OPEN_TTD':
        await openTtdWebsite();
        break;

      case 'TRIGGER_FILL':
        await executeFillPipeline();
        break;

      case 'VIEW_HISTORY':
        await safeOpenUrl('https://ttdevasthanams.ap.gov.in/booking-history');
        break;

      case 'STOP':
        handleFullEmergencyStop();
        break;

      case 'RETRY_LOCK':
        setFillStatus(null);
        await scanPage();
        clearSessionLock();
        clearTtdLock();
        break;

      default:
        if (!activeProfile) {
          onNavigate?.('profiles');
        } else if (!pageDetected) {
          await openTtdWebsite();
        } else {
          await executeFillPipeline();
        }
        break;
    }
  };

  const executeFillPipeline = async () => {
    if (isFilling || !activeProfile) return;

    if (selectedPilgrims.length === 0) {
      selectAllPilgrims(selectedServiceId);
    }

    const settings = await getSettings();
    if (settings.autofillMode !== 'fast' && settings.confirmationMode === 'always-preview') {
      setIsPreFlightOpen(true);
      return;
    }

    await performDirectFill();
  };

  const performDirectFill = async () => {
    setIsPreFlightOpen(false);
    if (!activeProfile) return;

    let activeScan = scanResult;
    if (!activeScan || !activeScan.mappedFields || activeScan.mappedFields.length === 0) {
      activeScan = await scanPage();
    }

    const settings = await getSettings();
    const pilgrimsToFill = selectedPilgrims.length > 0 ? selectedPilgrims : (activeProfile.pilgrims || []).slice(0, activeWorkflow?.maxPilgrims || 6);

    await executeFill(
      pilgrimsToFill,
      activeProfile,
      activeScan || {
        url: '',
        serviceType,
        serviceId: selectedServiceId,
        workflowId: activeWorkflow?.workflowId,
        serviceConfidence: 1,
        totalFields: pilgrimsToFill.length * 5,
        mappedFields: [],
        unmappedFields: [],
        pilgrimCardCount: pilgrimsToFill.length,
        formFingerprint: '',
        timestamp: new Date().toISOString(),
      },
      settings.autofillMode,
      effectiveDisplayName,
    );
  };

  const generatePreFlightReport = (): PreFlightReport => ({
    ready: readiness.isReady,
    checks: readiness.checks.map((c) => ({
      id: c.id,
      label: c.label,
      passed: c.passed,
      severity: c.severity === 'info' ? 'warning' : c.severity,
      details: c.message,
    })),
    errorCount: readiness.checks.filter((c) => !c.passed && c.severity === 'error').length,
    warningCount: readiness.checks.filter((c) => !c.passed && c.severity === 'warning').length,
  });

  // ─── Full-Screen Signature Booking Mode ───
  if (isBookingMode) {
    return (
      <BookingModeView
        serviceDisplayName={effectiveDisplayName}
        ticketPrice={activeWorkflow?.ticketPrice}
        releaseTimingText="Official TTD Portal"
        preparedPilgrimCount={selectedPilgrims.length > 0 ? selectedPilgrims.length : (activeProfile?.pilgrims || []).length}
        nextAction={nextAction}
        onPrimaryAction={handlePrimaryActionTrigger}
        onExitBookingMode={() => setIsBookingMode(false)}
      />
    );
  }

  // ─── Standard Clean Home View ───
  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 1. Context Header: Current Service & Status */}
      <div className="flex items-center justify-between gap-2">
        {/* Service Selector Chip */}
        <button
          type="button"
          onClick={() => setIsServiceModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:border-[#54258A]/30 dark:hover:border-[#D4A72C]/40 bg-white dark:bg-[#2C1A35] text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] transition-all cursor-pointer shadow-2xs max-w-[240px]"
        >
          <span className="truncate">{effectiveDisplayName}</span>
          <Icon name="chevron-down" size={14} className="shrink-0 text-[#6B5A70] dark:text-[#A692B4]" />
        </button>

        {/* Booking Mode Pill */}
        <button
          type="button"
          onClick={() => setIsBookingMode(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#54258A]/10 hover:bg-[#54258A]/15 dark:bg-[#D4A72C]/15 dark:hover:bg-[#D4A72C]/25 text-xs font-bold text-[#54258A] dark:text-[#F8EFD8] transition-colors cursor-pointer"
        >
          <Icon name="sparkles" size={13} className="text-[#54258A] dark:text-[#D4A72C]" />
          <span>{t('bookingMode.enter') || 'Booking Mode'}</span>
        </button>
      </div>

      {/* 2. TEMPORARY LOCK ALERT BANNER */}
      {effectiveLock && (
        <div
          className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 shadow-xs space-y-2"
          role="alert"
        >
          <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/60 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base text-amber-600 dark:text-amber-400 font-bold">⚠</span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Temporary TTD lock
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">
              Server-side hold
            </span>
          </div>
          <p className="text-xs text-amber-900 dark:text-amber-100 font-medium">
            Your previous booking attempt is still active. TTD holds the slot temporarily before releasing.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => safeOpenUrl('https://ttdevasthanams.ap.gov.in/booking-history')}
            >
              {t('nextAction.checkBookingHistory') || 'CHECK BOOKING HISTORY'}
            </Button>
          </div>
        </div>
      )}

      {/* 3. TTD PAGE DETECTED BANNER */}
      {pageDetected && !effectiveLock && (
        <div
          className="rounded-2xl border border-[#2F8F68]/30 bg-[#F2FBF6] dark:bg-[#1B3E2B]/30 p-3 shadow-2xs flex items-center justify-between gap-2 transition-all"
          role="status"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2F8F68] animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F8F68] dark:text-[#4ADE80]">
                  TTD PAGE READY
                </span>
                {activeWorkflow?.ticketPrice && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#A5D6A7]">
                    ₹{activeWorkflow.ticketPrice}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-[#30213A] dark:text-[#F8EFD8] truncate">
                {effectiveDisplayName}
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#2F8F68]/15 text-[#1B5E20] dark:text-[#A5D6A7]">
            Ready to fill
          </span>
        </div>
      )}

      {/* 4. THE HERO: NEXT ACTION CARD */}
      <div className="sticky top-0 z-20 bg-[#FAF7F2] dark:bg-[#1E1028] pt-1 pb-1">
        <NextActionCard
          model={nextAction}
          onPrimaryClick={handlePrimaryActionTrigger}
          onSecondaryClick={() => {
            if (nextAction.secondaryAction?.actionType === 'NAVIGATE_PROFILE') {
              onNavigate?.('profiles');
            } else if (nextAction.secondaryAction?.actionType === 'OPEN_TTD') {
              openTtdWebsite();
            } else if (nextAction.secondaryAction?.actionType === 'TEST_PROFILE') {
              setIsTestProfileOpen(true);
            } else if (nextAction.secondaryAction?.actionType === 'SELECT_PILGRIMS') {
              onNavigate?.('profiles');
            } else if (nextAction.secondaryAction?.actionType === 'STOP') {
              handleFullEmergencyStop();
            } else if (nextAction.secondaryAction?.actionType === 'RETRY_LOCK') {
              handlePrimaryActionTrigger();
            }
          }}
        />
      </div>

      {/* 5. BOOKING ACTION AREA (Command Center with Select Profile, Fill Details, Review Fields, Save Profile) */}
      <BookingActionArea
        serviceDisplayName={effectiveDisplayName}
        ticketPrice={activeWorkflow?.ticketPrice}
        maxPilgrims={activeWorkflow?.maxPilgrims || 6}
        isUnknownService={readinessReport.isUnknownService}
        onOpenServiceSelector={() => setIsServiceModalOpen(true)}
        profiles={profiles}
        activeProfile={activeProfile}
        selectedPilgrims={selectedPilgrims}
        onSelectProfile={switchProfile}
        onManageProfiles={() => onNavigate?.('profiles')}
        onCreateProfile={() => onNavigate?.('profiles')}
        readinessReport={readinessReport}
        pageDetected={pageDetected}
        isFilling={isFilling}
        fillStage={fillStage}
        onPrimaryFill={handlePrimaryActionTrigger}
        onEmergencyStop={handleFullEmergencyStop}
        onOpenTtdPortal={openTtdWebsite}
        onEditProfile={() => onNavigate?.('profiles')}
      />

      {/* 6. ACTIVE PROFILE CARD */}
      <ActiveProfileCard
        profile={activeProfile}
        selectedCount={selectedPilgrims.length}
        health={profileHealth}
        onChangeProfile={() => onNavigate?.('profiles')}
        onManage={() => onNavigate?.('profiles')}
      />

      {/* 6. TTD DIGITAL QUEUE CARD (Only shown when queue active!) */}
      {queueSession && queueSession.state !== 'QUEUE_NOT_PRESENT' && queueSession.state !== 'QUEUE_EXITED' && (
        <QueueCard
          session={queueSession}
          onStopMonitoring={handleQueueStopMonitoring}
          onRefreshManually={handleQueueManualRefresh}
        />
      )}

      {/* 7. LIVE AUTOFILL PROGRESS (Only shown during active filling!) */}
      {isFilling && (
        <AutofillProgress
          currentPilgrim={currentProgressPilgrim}
          totalPilgrims={selectedPilgrims.length > 0 ? selectedPilgrims.length : 1}
          currentField={currentProgressField}
          onCancel={handleFullEmergencyStop}
        />
      )}

      {/* 8. AUTOFILL VERIFICATION RESULT (Only shown when completed!) */}
      {fillStage.stage === 'complete' && !isFilling && pilgrimReports.length > 0 && (
        <AutofillResult
          pilgrimReports={pilgrimReports}
          onRepair={handlePrimaryActionTrigger}
        />
      )}

      {/* 9. BOOKING READINESS CHECKLIST (Service-specific, 0% percentages) */}
      <BookingReadinessSummary
        report={readinessReport}
        onFixClick={() => onNavigate?.('profiles')}
        onTestClick={() => setIsTestProfileOpen(true)}
      />

      {/* 10. CONTEXTUAL RELEASE INFORMATION */}
      <UpcomingReleasesCard />

      {/* 11. HOW IT WORKS CARD */}
      <HowItWorksCard />

      {/* 12. QUICK ACTIONS & PRIVACY */}
      <QuickActions
        onNavigate={(page) => onNavigate?.(page)}
        onOpenBookingHistory={() => safeOpenUrl('https://ttdevasthanams.ap.gov.in/booking-history')}
        onOpenPrivacy={() => onNavigate?.('more')}
      />

      <div className="flex items-center justify-between pt-1">
        <PrivacyBadge />
      </div>

      {/* ─── Modals ─── */}
      <ServiceSelectorModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        currentServiceId={selectedServiceId}
        onSelectService={(id) => setSelectedServiceId(id)}
      />

      <TestProfileModal
        isOpen={isTestProfileOpen}
        onClose={() => setIsTestProfileOpen(false)}
        report={readinessReport}
        onFixProfile={() => onNavigate?.('profiles')}
        onOpenTtd={openTtdWebsite}
      />

      <PreFlightModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        onProceed={performDirectFill}
        onFixDetails={() => {
          setIsPreFlightOpen(false);
          onNavigate?.('profiles');
        }}
        serviceName={effectiveDisplayName}
        activeProfile={activeProfile}
        report={generatePreFlightReport()}
        fieldCount={selectedPilgrims.length * 5}
      />
    </div>
  );
}
